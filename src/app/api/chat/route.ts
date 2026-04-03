import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { classifyIntent } from '@/lib/intent-classifier'
import { generateLlmResponse } from '@/lib/llm-service'
import {
  searchProducts,
  searchHpoTerms,
  searchGenes,
  searchDiseases,
  getRelatedDiseases,
  getRecommendedProducts,
} from '@/lib/knowledge-service'
import type { IntentType } from '@/lib/intent-classifier'
import { parseVariantNotation, canRunAcmgPipeline, formatVcfString } from '@/lib/variant-parser'
import { annotateWithVep, annotateWithVepByRsid } from '@/lib/api-clients/vep-client'
import { queryClinVarByPosition, queryClinVarByRsid, queryGnomadByPosition } from '@/lib/api-clients/clinvar-client'
import { classifyVariant } from '@/lib/acmg'
import type { GnomadData, VepConsequence, ClinVarData, ClassificationResult } from '@/lib/acmg/types'

/**
 * POST /api/chat
 * Main chat endpoint: accepts a user message, classifies intent,
 * queries knowledge base, calls LLM, and saves everything to DB.
 *
 * Body: { conversationId?: string, message: string }
 * Returns: { userMessage, assistantMessage }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId: inputConversationId, message: userContent } = body

    if (!userContent || typeof userContent !== 'string' || userContent.trim().length === 0) {
      return NextResponse.json(
        { error: '消息内容不能为空' },
        { status: 400 }
      )
    }

    // ===== 1. Ensure conversation exists =====
    let conversationId = inputConversationId

    if (!conversationId || conversationId.trim() === '') {
      // Create a new conversation
      const title = userContent.length > 20 ? userContent.slice(0, 20) + '...' : userContent
      const conv = await db.conversation.create({
        data: { title },
      })
      conversationId = conv.id
    } else {
      // Verify conversation exists
      const existing = await db.conversation.findUnique({
        where: { id: conversationId },
      })
      if (!existing) {
        return NextResponse.json(
          { error: '对话不存在' },
          { status: 404 }
        )
      }

      // Update conversation title if it's the first message
      const messageCount = await db.message.count({
        where: { conversationId },
      })
      if (messageCount === 0) {
        const title = userContent.length > 20 ? userContent.slice(0, 20) + '...' : userContent
        await db.conversation.update({
          where: { id: conversationId },
          data: { title },
        })
      }
    }

    // ===== 2. Save user message =====
    const userMessage = await db.message.create({
      data: {
        conversationId,
        role: 'user',
        content: userContent.trim(),
        contentType: 'text',
        metadata: '{}',
      },
    })

    // ===== 3. Classify intent =====
    const intentResult = classifyIntent(userContent)
    const intent: IntentType = intentResult.intent

    // ===== 4. Query knowledge base based on intent =====
    let knowledgeContext = ''
    let metadata: Record<string, any> = {}

    try {
      switch (intent) {
        case 'variant_interpretation': {
          const extractedGene = intentResult.extractedData?.geneSymbol
          const variantNotation = intentResult.extractedData?.variantNotation
          const parts: string[] = []

          // Parse variant notation to determine query strategy
          const parsed = parseVariantNotation(variantNotation, userContent)

          // Declare at case-block scope for later KB search reference
          let vepResult: { annotation: any; vep: VepConsequence; gnomad: GnomadData } | null = null

          if (canRunAcmgPipeline(parsed)) {
            // ===== Full ACMG Pipeline (VCF or rsID format) =====
            console.log(`[ACMG Pipeline] Starting full pipeline for variant: ${JSON.stringify(parsed)}`)

            let clinvarData: ClinVarData | null = null
            let gnomadData: GnomadData | null = null
            let classificationResult: ClassificationResult | null = null

            try {
              // Step 1: VEP Annotation (includes basic gnomAD frequency)
              if (parsed.format === 'rsid' && parsed.rsid) {
                console.log(`[ACMG Pipeline] Calling VEP by rsID: ${parsed.rsid}`)
                vepResult = await annotateWithVepByRsid(parsed.rsid)
              } else if (parsed.format === 'vcf' && parsed.chrom && parsed.pos && parsed.ref && parsed.alt) {
                console.log(`[ACMG Pipeline] Calling VEP by position: ${formatVcfString(parsed.chrom, parsed.pos, parsed.ref, parsed.alt)}`)
                vepResult = await annotateWithVep(parsed.chrom, parsed.pos, parsed.ref, parsed.alt)
              }

              if (vepResult) {
                const { annotation, vep } = vepResult
                const chrom = annotation.chromosome
                const pos = annotation.position
                const ref = annotation.reference
                const alt = annotation.alternate

                // Build VEP annotation context
                parts.push(`## VEP 变异注释
- **基因**: ${annotation.gene || '未知'}
- **染色体**: ${chrom}
- **位置**: ${pos}
- **参考/替换**: ${ref} → ${alt}
- **转录本**: ${annotation.refseqTranscript || annotation.transcript || '未知'} (${annotation.maneStatus || ''})
- **HGVS cDNA**: ${annotation.hgvsC || '未知'}
- **HGVS 蛋白**: ${annotation.hgvsP || '未知'}
- **变异后果**: ${annotation.consequence || '未知'} (${annotation.impact || ''})
- **rsID**: ${annotation.rsId || '无'}
${vep.siftScore !== undefined ? `- **SIFT 分数**: ${vep.siftScore.toFixed(3)}` : ''}
${vep.polyphenScore !== undefined ? `- **PolyPhen 分数**: ${vep.polyphenScore.toFixed(3)}` : ''}
${vep.caddScore !== undefined ? `- **CADD 分数**: ${vep.caddScore.toFixed(1)}` : ''}
${vep.revelScore !== undefined ? `- **REVEL 分数**: ${vep.revelScore.toFixed(3)}` : ''}
${vep.spliceAiDsMax !== undefined ? `- **SpliceAI DSmax**: ${vep.spliceAiDsMax.toFixed(3)}` : ''}
${vep.loftee ? `- **LOFTEE**: ${vep.loftee}` : ''}`.trim())

                // Step 2: ClinVar query (parallel with gnomAD)
              }

              // Run ClinVar and gnomAD queries in parallel
              const apiPromises: Promise<void>[] = []

              if (vepResult) {
                // ClinVar query
                if (parsed.format === 'rsid' && parsed.rsid) {
                  apiPromises.push(
                    queryClinVarByRsid(parsed.rsid).then((data) => { clinvarData = data }).catch(() => { /* non-fatal */ })
                  )
                } else if (parsed.format === 'vcf' && parsed.chrom && parsed.pos && parsed.ref && parsed.alt) {
                  apiPromises.push(
                    queryClinVarByPosition(parsed.chrom, parsed.pos, parsed.ref, parsed.alt).then((data) => { clinvarData = data }).catch(() => { /* non-fatal */ })
                  )
                }

                // gnomAD query (supplementary data)
                apiPromises.push(
                  queryGnomadByPosition(
                    vepResult.annotation.chromosome,
                    vepResult.annotation.position,
                    vepResult.annotation.reference,
                    vepResult.annotation.alternate,
                  ).then((data) => { gnomadData = data }).catch(() => { /* non-fatal */ })
                )
              }

              await Promise.allSettled(apiPromises)

              // Build ClinVar context
              if (clinvarData) {
                const clinvarParts = [`## ClinVar 临床意义
- **变异 ID**: ${clinvarData.variationId || '未知'}`]
                if (clinvarData.clinicalSignificance) {
                  clinvarParts.push(`- **临床意义**: ${clinvarData.clinicalSignificance}`)
                }
                if (clinvarData.reviewStatus) {
                  clinvarParts.push(`- **审核状态**: ${clinvarData.reviewStatus}`)
                }
                if (clinvarData.lastEvaluated) {
                  clinvarParts.push(`- **最后审核**: ${clinvarData.lastEvaluated}`)
                }
                if (clinvarData.diseases && clinvarData.diseases.length > 0) {
                  clinvarParts.push(`- **相关疾病**: ${clinvarData.diseases.join('、')}`)
                }
                parts.push(clinvarParts.join('\n'))
              } else {
                parts.push('## ClinVar 临床意义\n该变异在 ClinVar 数据库中未找到记录。')
              }

              // Build gnomAD context (merge VEP gnomAD + direct gnomAD data)
              const mergedGnomad: GnomadData = {
                ...vepResult?.gnomad,
              }
              if (gnomadData) {
                // Direct gnomAD data may be more complete, use it to supplement
                if (gnomadData.homCount !== undefined) mergedGnomad.homCount = gnomadData.homCount
                if (gnomadData.hemiCount !== undefined) mergedGnomad.hemiCount = gnomadData.hemiCount
                // Prefer direct gnomAD frequencies if VEP didn't provide them
                if (gnomadData.afGlobal !== undefined && !mergedGnomad.afGlobal) mergedGnomad.afGlobal = gnomadData.afGlobal
                if (gnomadData.popmaxFreq !== undefined && !mergedGnomad.popmaxFreq) mergedGnomad.popmaxFreq = gnomadData.popmaxFreq
                if (gnomadData.popmaxPop && !mergedGnomad.popmaxPop) mergedGnomad.popmaxPop = gnomadData.popmaxPop
              }

              const gnomadParts = ['## gnomAD 人群频率']
              if (mergedGnomad.afGlobal !== undefined) {
                gnomadParts.push(`- **全球等位基因频率 (AF)**: ${mergedGnomad.afGlobal < 0.0001 ? mergedGnomad.afGlobal.toExponential(2) : mergedGnomad.afGlobal.toFixed(6)}`)
              } else {
                gnomadParts.push('- **全球等位基因频率 (AF)**: 未在 gnomAD 数据库中找到')
              }
              if (mergedGnomad.popmaxFreq !== undefined) {
                gnomadParts.push(`- **Popmax 频率**: ${mergedGnomad.popmaxFreq < 0.0001 ? mergedGnomad.popmaxFreq.toExponential(2) : mergedGnomad.popmaxFreq.toFixed(6)} (${mergedGnomad.popmaxPop || ''})`)
              }
              if (mergedGnomad.afEas !== undefined) {
                gnomadParts.push(`- **东亚 (EAS) 频率**: ${mergedGnomad.afEas < 0.0001 ? mergedGnomad.afEas.toExponential(2) : mergedGnomad.afEas.toFixed(6)}`)
              }
              if (mergedGnomad.homCount !== undefined) {
                gnomadParts.push(`- **纯合子数**: ${mergedGnomad.homCount}`)
              }
              if (mergedGnomad.hemiCount !== undefined) {
                gnomadParts.push(`- **半合子数**: ${mergedGnomad.hemiCount}`)
              }
              parts.push(gnomadParts.join('\n'))

              // Step 3: Run ACMG Classification
              if (vepResult) {
                console.log('[ACMG Pipeline] Running ACMG classifier...')
                classificationResult = await classifyVariant(
                  vepResult.annotation,
                  clinvarData || undefined,
                  Object.keys(mergedGnomad).length > 0 ? mergedGnomad : undefined,
                  undefined, // HGMD not available in chat flow
                  vepResult.vep,
                )

                console.log(`[ACMG Pipeline] Classification: ${classificationResult.classification} (${classificationResult.classificationLabel})`)

                // Build ACMG classification context
                const acmgParts = [`## ACMG 致病性分类结果
- **分类**: ${classificationResult.classification} (${classificationResult.classificationLabel})`]

                const appliedRules = classificationResult.ruleResults.filter(r => r.applied)
                const pathogenicRules = appliedRules.filter(r => r.evidenceType === 'pathogenic')
                const benignRules = appliedRules.filter(r => r.evidenceType === 'benign')

                if (pathogenicRules.length > 0) {
                  acmgParts.push(`- **致病性证据 (已应用 ${pathogenicRules.length} 条):`)
                  for (const rule of pathogenicRules) {
                    acmgParts.push(`  - ${rule.rule} [${rule.strength}]: ${rule.comment}`)
                  }
                  acmgParts.push('')
                }
                if (benignRules.length > 0) {
                  acmgParts.push(`- **良性证据 (已应用 ${benignRules.length} 条):`)
                  for (const rule of benignRules) {
                    acmgParts.push(`  - ${rule.rule} [${rule.strength}]: ${rule.comment}`)
                  }
                  acmgParts.push('')
                }

                const summary = classificationResult.evidenceSummary
                acmgParts.push('- **证据汇总**:')
                if (summary.pathogenicVeryStrong > 0) acmgParts.push(`  - 致病性极强证据: ${summary.pathogenicVeryStrong}`)
                if (summary.pathogenicStrong > 0) acmgParts.push(`  - 致病性强证据: ${summary.pathogenicStrong}`)
                if (summary.pathogenicModerate > 0) acmgParts.push(`  - 致病性中等证据: ${summary.pathogenicModerate}`)
                if (summary.pathogenicSupporting > 0) acmgParts.push(`  - 致病性支持证据: ${summary.pathogenicSupporting}`)
                if (summary.benignStandAlone > 0) acmgParts.push(`  - 良性独立证据: ${summary.benignStandAlone}`)
                if (summary.benignStrong > 0) acmgParts.push(`  - 良性强证据: ${summary.benignStrong}`)
                if (summary.benignModerate > 0) acmgParts.push(`  - 良性中等证据: ${summary.benignModerate}`)
                if (summary.benignSupporting > 0) acmgParts.push(`  - 良性支持证据: ${summary.benignSupporting}`)

                parts.push(acmgParts.join('\n'))

                // Set comprehensive metadata
                metadata = {
                  gene: vepResult.annotation.gene || extractedGene,
                  variant: vepResult.annotation.rsId || formatVcfString(vepResult.annotation.chromosome, vepResult.annotation.position, vepResult.annotation.reference, vepResult.annotation.alternate),
                  hgvsC: vepResult.annotation.hgvsC,
                  hgvsP: vepResult.annotation.hgvsP,
                  acmgClassification: classificationResult.classification,
                  acmgClassificationLabel: classificationResult.classificationLabel,
                  clinvarSignificance: clinvarData?.clinicalSignificance,
                  gnomadFrequency: mergedGnomad.afGlobal ?? 0,
                  appliedRules: appliedRules.map(r => r.rule),
                  evidenceSummary: classificationResult.evidenceSummary,
                  consequence: vepResult.annotation.consequence,
                  impact: vepResult.annotation.impact,
                }
              }
            } catch (acmgError) {
              console.error('[ACMG Pipeline] Pipeline failed, falling back to KB mode:', acmgError)
              // Fall through to knowledge base search below
            }
          } else if (parsed.format === 'hgvs') {
            // HGVS-only format: cannot resolve genomic position, LLM-only mode
            console.log(`[ACMG Pipeline] HGVS-only format detected (${parsed.hgvs}), using LLM-only mode`)
            parts.push(`## 变异信息（HGVS 格式）
- **HGVS 表示**: ${parsed.hgvs}
- **注意**: 仅提供 HGVS 格式，无法自动获取基因组坐标，因此未执行完整的 ACMG 自动分类流程。
- **基因**: ${parsed.geneSymbol || extractedGene || '未指定'}`)
          } else {
            console.log('[ACMG Pipeline] No parseable variant detected, using KB-only mode')
          }

          // Always include knowledge base gene/disease info as supplementary context
          const geneForKbSearch = vepResult?.annotation?.gene || parsed.geneSymbol || extractedGene
          if (geneForKbSearch) {
            const genes = await searchGenes(geneForKbSearch)
            if (genes.length > 0) {
              // Only add if not already added from VEP
              if (!parts.some(p => p.includes('## 基因信息'))) {
                parts.push(`## 基因信息（知识库）\n${genes.map((g) => `- ${g.geneSymbol}: ${g.fullName ?? ''} ${g.description ?? ''}`).join('\n')}`)
              }
            }
            const diseases = await searchDiseases(geneForKbSearch)
            if (diseases.length > 0) {
              // Only add if not already added from VEP
              if (!parts.some(p => p.includes('## 相关疾病'))) {
                parts.push(`## 相关疾病\n${diseases.slice(0, 5).map((d) => `- ${d.name} (${d.omimId ?? '无OMIM ID'}): ${d.description ?? ''}`).join('\n')}`)
              }
            }
          }

          knowledgeContext = parts.length > 0
            ? `以下是通过多源数据整合获取的变异解读信息，请在此基础上为用户提供专业、全面的变异致病性解读：\n\n${parts.join('\n\n')}`
            : ''

          break
        }

        case 'hpo_matching': {
          // Search HPO terms and find related diseases
          const parts: string[] = []

          // Extract potential HPO terms or symptoms from the message
          const hpoTerms = await searchHpoTerms(userContent)
          if (hpoTerms.length > 0) {
            metadata.matchedTerms = hpoTerms.slice(0, 10).map((t) => ({
              hpoId: t.hpoId,
              name: t.name,
              score: 0.9,
            }))
            parts.push(`## 匹配的HPO术语\n${hpoTerms.slice(0, 10).map((t) => `- ${t.hpoId}: ${t.name} - ${t.definition ?? ''}`).join('\n')}`)
          }

          // Find related diseases
          const hpoNames = hpoTerms.map((t) => [t.name, t.hpoId]).flat()
          if (hpoNames.length > 0) {
            const relatedDiseases = await getRelatedDiseases(hpoNames)
            if (relatedDiseases.length > 0) {
              parts.push(`## 可能的相关疾病\n${relatedDiseases.slice(0, 8).map((d) => `- ${d.name} (${d.omimId ?? '无OMIM ID'}): ${d.description ?? ''}`).join('\n')}`)
            }
          }

          knowledgeContext = parts.length > 0
            ? `以下是知识库匹配结果，请在回答时参考：\n\n${parts.join('\n\n')}`
            : ''

          break
        }

        case 'product_recommendation': {
          // Search products and recommend based on query
          const products = await searchProducts(userContent)
          if (products.length > 0) {
            metadata.products = products.slice(0, 5).map((p) => ({
              name: p.name,
              category: p.category,
              description: p.description,
            }))
            knowledgeContext = `以下是相关的检测产品信息，请在推荐时参考：\n\n${products.map((p) => `### ${p.name}（${p.category}）\n${p.description}\n特性：${p.features.join('、')}\n适用症：${p.indications.join('、')}`).join('\n\n')}`
          } else {
            // Try to find products based on symptom keywords
            const symptomKeywords = userContent.split(/[,，、\s]+/).filter((w) => w.length >= 2)
            const recommendedProducts = await getRecommendedProducts(symptomKeywords)
            if (recommendedProducts.length > 0) {
              metadata.products = recommendedProducts.slice(0, 5).map((p) => ({
                name: p.name,
                category: p.category,
                description: p.description,
              }))
              knowledgeContext = `以下是可能与用户症状相关的检测产品：\n\n${recommendedProducts.map((p) => `### ${p.name}（${p.category}）\n${p.description}`).join('\n\n')}`
            }
          }

          break
        }

        case 'disease_recommendation': {
          // Search diseases and HPO terms
          const parts: string[] = []

          const diseases = await searchDiseases(userContent)
          if (diseases.length > 0) {
            metadata.diseases = diseases.slice(0, 8).map((d) => ({
              name: d.name,
              omimId: d.omimId ?? '',
              score: 90,
            }))
            parts.push(`## 匹配的疾病\n${diseases.slice(0, 8).map((d) => `- ${d.name} (${d.omimId ?? '无OMIM ID'}): ${d.description ?? ''} | 遗传方式：${d.inheritance.join('、')} | 相关基因：${d.geneSymbols.join('、')}`).join('\n')}`)
          }

          // Also search HPO terms to find related diseases
          const hpoTerms = await searchHpoTerms(userContent)
          const hpoNames = hpoTerms.map((t) => [t.name, t.hpoId]).flat()
          if (hpoNames.length > 0) {
            const relatedDiseases = await getRelatedDiseases(hpoNames)
            // Merge with previously found diseases, avoiding duplicates
            const existingNames = new Set(diseases.map((d) => d.name))
            const newDiseases = relatedDiseases.filter((d) => !existingNames.has(d.name))
            if (newDiseases.length > 0) {
              parts.push(`## 表型相关疾病\n${newDiseases.slice(0, 5).map((d) => `- ${d.name} (${d.omimId ?? '无OMIM ID'}): ${d.description ?? ''}`).join('\n')}`)
            }

            if (!metadata.diseases || metadata.diseases.length === 0) {
              metadata.diseases = relatedDiseases.slice(0, 8).map((d) => ({
                name: d.name,
                omimId: d.omimId ?? '',
                score: 85,
              }))
            }

            if (hpoTerms.length > 0) {
              metadata.matchedSymptoms = hpoTerms.slice(0, 6).map((t) => t.name)
            }
          }

          knowledgeContext = parts.length > 0
            ? `以下是知识库中匹配的疾病信息，请在回答时参考：\n\n${parts.join('\n\n')}`
            : ''

          break
        }

        default: {
          // General intent - try broad search
          const parts: string[] = []

          const genes = await searchGenes(userContent)
          if (genes.length > 0) {
            parts.push(`## 相关基因\n${genes.slice(0, 3).map((g) => `- ${g.geneSymbol}: ${g.fullName ?? ''}`).join('\n')}`)
          }

          const diseases = await searchDiseases(userContent)
          if (diseases.length > 0) {
            parts.push(`## 相关疾病\n${diseases.slice(0, 3).map((d) => `- ${d.name}: ${d.description ?? ''}`).join('\n')}`)
          }

          const products = await searchProducts(userContent)
          if (products.length > 0) {
            parts.push(`## 相关产品\n${products.slice(0, 3).map((p) => `- ${p.name}: ${p.description}`).join('\n')}`)
          }

          knowledgeContext = parts.length > 0
            ? `以下是可能相关的参考信息：\n\n${parts.join('\n\n')}`
            : ''
          break
        }
      }
    } catch (kbError) {
      console.error('Knowledge base query error (non-fatal):', kbError)
      // Continue without knowledge context
      knowledgeContext = ''
    }

    // ===== 5. Get conversation history for LLM context =====
    const historyMessages = await db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: {
        role: true,
        content: true,
      },
    })

    // Convert to LlmMessage format, exclude the current user message (it was already saved)
    const history = historyMessages
      .slice(0, -1) // Exclude the just-saved user message to avoid duplication
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

    // ===== 6. Call LLM =====
    const llmResponse = await generateLlmResponse(
      userContent.trim(),
      intent,
      history,
      knowledgeContext || undefined
    )

    // Merge LLM-returned metadata with knowledge base metadata
    if (llmResponse.metadata && Object.keys(llmResponse.metadata).length > 0) {
      metadata = { ...metadata, ...llmResponse.metadata }
    }

    // ===== 7. Determine content type =====
    const contentType = intent === 'general' ? 'text' : intent

    // ===== 8. Save assistant message =====
    const assistantMessage = await db.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: llmResponse.content,
        contentType,
        metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : '{}',
      },
    })

    // ===== 9. Return both messages =====
    return NextResponse.json({
      userMessage: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        contentType: userMessage.contentType,
        createdAt: userMessage.createdAt,
        metadata: userMessage.metadata,
      },
      assistantMessage: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        contentType: assistantMessage.contentType,
        createdAt: assistantMessage.createdAt,
        metadata: assistantMessage.metadata,
      },
      conversationId,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: '处理消息失败，请稍后重试' },
      { status: 500 }
    )
  }
}
