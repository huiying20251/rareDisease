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
          // Search for genes and diseases related to the variant
          const extractedGene = intentResult.extractedData?.geneSymbol
          const parts: string[] = []

          if (extractedGene) {
            const genes = await searchGenes(extractedGene)
            if (genes.length > 0) {
              parts.push(`## 基因信息\n${genes.map((g) => `- ${g.geneSymbol}: ${g.fullName ?? ''} ${g.description ?? ''}`).join('\n')}`)
            }
            const diseases = await searchDiseases(extractedGene)
            if (diseases.length > 0) {
              parts.push(`## 相关疾病\n${diseases.slice(0, 5).map((d) => `- ${d.name} (${d.omimId ?? '无OMIM ID'}): ${d.description ?? ''}`).join('\n')}`)
            }
          }

          knowledgeContext = parts.length > 0
            ? `以下是与用户查询相关的知识库信息，请在回答时参考：\n\n${parts.join('\n\n')}`
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
