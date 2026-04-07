/**
 * ACMG 分类器主入口
 * 整合外部 API 数据 + 本地数据库 + 规则引擎 → 最终分类
 */

import { applyAllRules, DEFAULT_THRESHOLDS } from './rules'
import { classifyAcmgStandard } from './schemata'
import type {
  RuleResult,
  VariantInput,
  AcmgThresholds,
  ClassificationResult,
  Pm1DomainData,
  VariantAnnotation,
  ClinVarData,
  GnomadData,
  HgmdData,
  VepConsequence,
} from './types'
import {
  AcmgClassification,
  ACMG_CLASSIFICATION_LABELS,
  createEvidenceSummary,
} from './types'
import { db } from '@/lib/db'

// ==================== 分类入口 ====================

export async function classifyVariant(
  annotation: VariantAnnotation,
  clinvar?: ClinVarData,
  gnomad?: GnomadData,
  hgmd?: HgmdData,
  vep?: VepConsequence,
  customThresholds?: Partial<AcmgThresholds>,
): Promise<ClassificationResult> {
  // 获取阈值（先查基因特异的，再用默认的）
  const gene = annotation.gene
  const geneThresholds = gene
    ? await getGeneThresholds(gene)
    : null

  const thresholds: AcmgThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...geneThresholds,
    ...customThresholds,
  }

  // 获取 PM1 域数据
  const pm1Domains = gene
    ? await getLocalPm1Domains(gene)
    : []

  // 组装输入
  const input: VariantInput = {
    annotation,
    clinvar,
    gnomad,
    hgmd,
    vep,
    pm1Domains,
  }

  // 执行规则
  const ruleResults = applyAllRules(input, thresholds, pm1Domains)

  // 冲突处理 + 分类
  const { classification, conflicts } = classifyAcmgStandard(ruleResults)

  // 创建结果
  const result: ClassificationResult = {
    classification,
    classificationLabel: ACMG_CLASSIFICATION_LABELS[classification],
    ruleResults,
    evidenceSummary: createEvidenceSummary(ruleResults),
    timestamp: new Date().toISOString(),
  }

  // 如果有冲突，添加到第一个相关规则注释
  if (conflicts.length > 0) {
    const pvs1 = ruleResults.find(r => r.rule === 'PVS1')
    if (pvs1) {
      pvs1.comment += ` [⚠️ 冲突警告: ${conflicts.join('; ')}]`
    }
  }

  // 缓存到数据库
  await cacheVariantResult(annotation, clinvar, gnomad, hgmd, vep, result)

  return result
}

// ==================== 阈值管理 ====================

async function getGeneThresholds(gene: string): Promise<Partial<AcmgThresholds> | null> {
  try {
    const threshold = await db.acmgThreshold.findUnique({
      where: { gene },
    })
    if (!threshold) return null

    return {
      ba1: threshold.thresholdBa1,
      ba1Absolute: threshold.thresholdBa1Absolute,
      bs1: threshold.thresholdBs1,
      bs1Absolute: threshold.thresholdBs1Absolute,
      bs1Supporting: threshold.thresholdBs1Supporting,
      bs2: threshold.thresholdBs2,
      bs2Supporting: threshold.thresholdBs2Supporting,
      pm2: threshold.thresholdPm2,
      pm2Supporting: threshold.thresholdPm2Supporting,
      revelPathogenic: threshold.thresholdRevelPathogenic,
      revelBenign: threshold.thresholdRevelBenign,
      spliceAiPathogenic: threshold.thresholdSpliceAiPathogenic,
      spliceAiBenign: threshold.thresholdSpliceAiBenign,
      proteinLenDiff: threshold.thresholdProteinLenDiff,
    }
  } catch {
    return null
  }
}

// ==================== PM1 域查询 ====================

async function getLocalPm1Domains(gene: string): Promise<Pm1DomainData[]> {
  try {
    const domains = await db.pm1Domain.findMany({
      where: { gene },
    })
    return domains.map(d => ({
      gene: d.gene,
      domainName: d.domainName,
      domainSource: d.domainSource,
      domainId: d.domainId || undefined,
      startPos: d.startPos,
      endPos: d.endPos,
      criticalRegion: d.criticalRegion,
      description: d.description || undefined,
    }))
  } catch {
    return []
  }
}

// ==================== 结果缓存 ====================

async function cacheVariantResult(
  annotation: VariantAnnotation,
  clinvar?: ClinVarData,
  gnomad?: GnomadData,
  hgmd?: HgmdData,
  vep?: VepConsequence,
  result?: ClassificationResult,
): Promise<void> {
  try {
    await db.variantAnnotation.upsert({
      where: {
        chromosome_position_reference_alternate_genomeBuild: {
          chromosome: annotation.chromosome,
          position: annotation.position,
          reference: annotation.reference,
          alternate: annotation.alternate,
          genomeBuild: annotation.genomeBuild || 'GRCh38',
        },
      },
      create: {
        chromosome: annotation.chromosome,
        position: annotation.position,
        reference: annotation.reference,
        alternate: annotation.alternate,
        genomeBuild: annotation.genomeBuild || 'GRCh38',
        gene: annotation.gene,
        transcript: annotation.transcript,
        refseqTranscript: annotation.refseqTranscript,
        hgvsC: annotation.hgvsC,
        hgvsP: annotation.hgvsP,
        hgvsG: annotation.hgvsG,
        rsId: annotation.rsId,
        consequence: annotation.consequence,
        impact: annotation.impact,
        maneStatus: annotation.maneStatus,
        clinvarId: clinvar?.variationId,
        clinvarSignificance: clinvar?.clinicalSignificance,
        clinvarReviewStatus: clinvar?.reviewStatus,
        clinvarDiseases: JSON.stringify(clinvar?.diseases || []),
        clinvarLastEval: clinvar?.lastEvaluated,
        gnomadPopmaxFreq: gnomad?.popmaxFreq,
        gnomadPopmaxPop: gnomad?.popmaxPop,
        gnomadAfGlobal: gnomad?.afGlobal,
        gnomadAfAfr: gnomad?.afAfr,
        gnomadAfAmr: gnomad?.afAmr,
        gnomadAfEas: gnomad?.afEas,
        gnomadAfNfe: gnomad?.afNfe,
        gnomadAfSas: gnomad?.afSas,
        gnomadHomCount: gnomad?.homCount,
        gnomadHemiCount: gnomad?.hemiCount,
        hgmdAccession: hgmd?.accession,
        hgmdClass: hgmd?.classType,
        hgmdDescription: hgmd?.description,
        hgmdGene: hgmd?.gene,
        hgmdDisease: hgmd?.disease,
        hgmdPubmedId: hgmd?.pubmedId,
        hgmdMutationType: hgmd?.mutationType,
        vepSiftScore: vep?.siftScore,
        vepPolyphenScore: vep?.polyphenScore,
        vepCaddScore: vep?.caddScore,
        vepRevelScore: vep?.revelScore,
        vepSpliceAiDsMax: vep?.spliceAiDsMax,
        vepSpliceAiAgMax: vep?.spliceAiAgMax,
        acmgClassification: result?.classification || AcmgClassification.VUS,
        acmgRulesApplied: JSON.stringify(result?.ruleResults || []),
        acmgClassifiedAt: result ? new Date() : null,
        dataSources: JSON.stringify([]),
      },
      update: {
        gene: annotation.gene,
        transcript: annotation.transcript,
        refseqTranscript: annotation.refseqTranscript,
        hgvsC: annotation.hgvsC,
        hgvsP: annotation.hgvsP,
        hgvsG: annotation.hgvsG,
        rsId: annotation.rsId,
        consequence: annotation.consequence,
        impact: annotation.impact,
        maneStatus: annotation.maneStatus,
        clinvarId: clinvar?.variationId,
        clinvarSignificance: clinvar?.clinicalSignificance,
        clinvarReviewStatus: clinvar?.reviewStatus,
        clinvarDiseases: JSON.stringify(clinvar?.diseases || []),
        clinvarLastEval: clinvar?.lastEvaluated,
        gnomadPopmaxFreq: gnomad?.popmaxFreq,
        gnomadPopmaxPop: gnomad?.popmaxPop,
        gnomadAfGlobal: gnomad?.afGlobal,
        gnomadAfAfr: gnomad?.afAfr,
        gnomadAfAmr: gnomad?.afAmr,
        gnomadAfEas: gnomad?.afEas,
        gnomadAfNfe: gnomad?.afNfe,
        gnomadAfSas: gnomad?.afSas,
        gnomadHomCount: gnomad?.homCount,
        gnomadHemiCount: gnomad?.hemiCount,
        hgmdAccession: hgmd?.accession,
        hgmdClass: hgmd?.classType,
        hgmdDescription: hgmd?.description,
        hgmdGene: hgmd?.gene,
        hgmdDisease: hgmd?.disease,
        hgmdPubmedId: hgmd?.pubmedId,
        hgmdMutationType: hgmd?.mutationType,
        vepSiftScore: vep?.siftScore,
        vepPolyphenScore: vep?.polyphenScore,
        vepCaddScore: vep?.caddScore,
        vepRevelScore: vep?.revelScore,
        vepSpliceAiDsMax: vep?.spliceAiDsMax,
        vepSpliceAiAgMax: vep?.spliceAiAgMax,
        acmgClassification: result?.classification || AcmgClassification.VUS,
        acmgRulesApplied: JSON.stringify(result?.ruleResults || []),
        acmgClassifiedAt: result ? new Date() : null,
      },
    })
  } catch (error) {
    console.error('Failed to cache variant result:', error)
  }
}
