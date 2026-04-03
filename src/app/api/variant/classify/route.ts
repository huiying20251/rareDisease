import { NextRequest, NextResponse } from 'next/server'
import { classifyVariant } from '@/lib/acmg'
import { annotateWithVep, annotateWithVepByRsid } from '@/lib/api-clients/vep-client'
import { queryClinVarByPosition, queryClinVarByRsid, queryGnomadByPosition } from '@/lib/api-clients/clinvar-client'

/**
 * POST /api/variant/classify
 * 
 * 执行完整的 ACMG 变异分类流程：
 * 1. 解析输入（VCF/rsID）
 * 2. 调用 VEP 获取注释 + 预测分数
 * 3. 调用 ClinVar 获取临床意义
 * 4. 调用 gnomAD 获取人群频率
 * 5. 查询本地 HGMD 数据库
 * 6. 执行 ACMG 规则引擎
 * 7. 返回分类结果
 * 
 * Body: {
 *   inputType: 'vcf' | 'rsid',
 *   input: string,           // "17:43045678:G:A" 或 "rs80357713"
 *   genomeBuild?: string,    // 默认 GRCh38
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { inputType, input, genomeBuild } = body

    if (!inputType || !input || typeof input !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的输入类型(inputType)和输入值(input)' },
        { status: 400 },
      )
    }

    const trimmedInput = input.trim()
    const startTime = Date.now()

    // ===== Step 1: VEP 注释 =====
    let vepResult: Awaited<ReturnType<typeof annotateWithVep>> | null = null

    if (inputType === 'rsid') {
      vepResult = await annotateWithVepByRsid(trimmedInput)
    } else if (inputType === 'vcf') {
      // Parse VCF format: chr17:43045678:G:A or 17:43045678 G A etc.
      const parsed = parseVcfInput(trimmedInput)
      if (parsed) {
        vepResult = await annotateWithVep(parsed.chrom, parsed.pos, parsed.ref, parsed.alt)
      }
    }

    if (!vepResult) {
      return NextResponse.json(
        { error: 'VEP 注释失败，请检查输入格式。支持格式：rsID(rs80357713) 或 VCF(chr17:43045678:G:A)' },
        { status: 422 },
      )
    }

    // ===== Step 2: ClinVar 查询 =====
    let clinvarData = vepResult.annotation.rsId
      ? await queryClinVarByRsid(vepResult.annotation.rsId)
      : await queryClinVarByPosition(
          vepResult.annotation.chromosome,
          vepResult.annotation.position,
          vepResult.annotation.reference,
          vepResult.annotation.alternate,
        )

    // ===== Step 3: gnomAD 补充查询 =====
    const gnomadFromApi = await queryGnomadByPosition(
      vepResult.annotation.chromosome,
      vepResult.annotation.position,
      vepResult.annotation.reference,
      vepResult.annotation.alternate,
    )

    // 合并 gnomAD 数据（VEP + 直接查询）
    const mergedGnomad = { ...vepResult.gnomad, ...gnomadFromApi }

    // ===== Step 4: 本地 HGMD 查询 =====
    let hgmdData = null
    try {
      const { db } = await import('@/lib/db')
      const hgmdRecord = await db.hgmdImport.findFirst({
        where: {
          chromosome: vepResult.annotation.chromosome,
          position: vepResult.annotation.position,
          reference: vepResult.annotation.reference,
          alternate: vepResult.annotation.alternate,
        },
      })
      if (hgmdRecord) {
        hgmdData = {
          accession: hgmdRecord.accession,
          classType: hgmdRecord.classType,
          description: hgmdRecord.description || undefined,
          gene: hgmdRecord.gene,
          disease: hgmdRecord.disease || undefined,
          pubmedId: hgmdRecord.pubmedId || undefined,
          mutationType: hgmdRecord.mutationType || undefined,
        }
      }
    } catch {
      // HGMD not available
    }

    // ===== Step 5: ACMG 分类 =====
    const result = await classifyVariant(
      vepResult.annotation,
      clinvarData || undefined,
      mergedGnomad,
      hgmdData || undefined,
      vepResult.vep,
    )

    const elapsed = Date.now() - startTime

    return NextResponse.json({
      success: true,
      elapsed: `${elapsed}ms`,
      input: {
        type: inputType,
        raw: trimmedInput,
      },
      annotation: vepResult.annotation,
      clinvar: clinvarData,
      gnomad: mergedGnomad,
      hgmd: hgmdData,
      vep: vepResult.vep,
      classification: {
        level: result.classification,
        label: result.classificationLabel,
        rules: result.ruleResults.map(r => ({
          rule: r.rule,
          applied: r.applied,
          strength: r.strength,
          type: r.evidenceType,
          comment: r.comment,
        })),
        evidence: result.evidenceSummary,
      },
    })
  } catch (error) {
    console.error('Variant classification error:', error)
    return NextResponse.json(
      { error: '变异分类失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

// ==================== 工具函数 ====================

function parseVcfInput(input: string): { chrom: string; pos: number; ref: string; alt: string } | null {
  // 支持格式: chr17:43045678:G:A, 17:43045678:G>A, 17 43045678 G A, 17:43045678 G/A

  // 格式1: colon-separated: chr17:43045678:G:A or chr17:43045678 G>A
  const colonMatch = input.match(/^(?:chr)?([0-9XYMT]+)[:\s](\d+)[:\s]+([ACGTN]+)[:\s>]+([ACGTN]+)$/i)
  if (colonMatch) {
    return {
      chrom: colonMatch[1].toUpperCase() === 'M' ? 'MT' : colonMatch[1].toUpperCase(),
      pos: parseInt(colonMatch[2], 10),
      ref: colonMatch[3].toUpperCase(),
      alt: colonMatch[4].toUpperCase(),
    }
  }

  // 格式2: tab/space separated
  const spaceMatch = input.match(/^(?:chr)?([0-9XYMT]+)[\s\t]+(\d+)[\s\t]+([ACGTN]+)[\s\t]+([ACGTN]+)$/i)
  if (spaceMatch) {
    return {
      chrom: spaceMatch[1].toUpperCase() === 'M' ? 'MT' : spaceMatch[1].toUpperCase(),
      pos: parseInt(spaceMatch[2], 10),
      ref: spaceMatch[3].toUpperCase(),
      alt: spaceMatch[4].toUpperCase(),
    }
  }

  return null
}
