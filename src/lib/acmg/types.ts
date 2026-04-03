/**
 * ACMG/AMP 变异致病性分类引擎 - 类型定义
 * 参考 HerediClassify 架构设计
 */

// ==================== 证据等级 ====================

export enum EvidenceStrength {
  STAND_ALONE = 'stand_alone',
  VERY_STRONG = 'very_strong',
  STRONG = 'strong',
  MODERATE = 'moderate',
  SUPPORTING = 'supporting',
}

export enum EvidenceType {
  PATHOGENIC = 'pathogenic',
  BENIGN = 'benign',
}

export enum RuleType {
  GENERAL = 'general',
  PROTEIN = 'protein',
  SPLICING = 'splicing',
}

// ==================== 规则结果 ====================

export interface RuleResult {
  rule: string           // PVS1, PS1, PM2, BA1, etc.
  type: RuleType
  evidenceType: EvidenceType
  applied: boolean       // 是否适用
  strength: EvidenceStrength
  comment: string        // 适用/不适用的原因说明
}

// ==================== ACMG 五级分类 ====================

export enum AcmgClassification {
  PATHOGENIC = 'Pathogenic',
  LIKELY_PATHOGENIC = 'Likely Pathogenic',
  VUS = 'VUS',
  LIKELY_BENIGN = 'Likely Benign',
  BENIGN = 'Benign',
}

export const ACMG_CLASSIFICATION_ORDER = [
  AcmgClassification.PATHOGENIC,
  AcmgClassification.LIKELY_PATHOGENIC,
  AcmgClassification.VUS,
  AcmgClassification.LIKELY_BENIGN,
  AcmgClassification.BENIGN,
] as const

export const ACMG_CLASSIFICATION_LABELS: Record<AcmgClassification, string> = {
  [AcmgClassification.PATHOGENIC]: '致病',
  [AcmgClassification.LIKELY_PATHOGENIC]: '可能致病',
  [AcmgClassification.VUS]: '意义不明',
  [AcmgClassification.LIKELY_BENIGN]: '可能良性',
  [AcmgClassification.BENIGN]: '良性',
}

export const ACMG_CLASSIFICATION_COLORS: Record<AcmgClassification, string> = {
  [AcmgClassification.PATHOGENIC]: 'text-red-600',
  [AcmgClassification.LIKELY_PATHOGENIC]: 'text-orange-500',
  [AcmgClassification.VUS]: 'text-yellow-500',
  [AcmgClassification.LIKELY_BENIGN]: 'text-blue-400',
  [AcmgClassification.BENIGN]: 'text-green-500',
}

// ==================== 变异注释数据 ====================

export interface VariantAnnotation {
  chromosome: string
  position: number
  reference: string
  alternate: string
  genomeBuild: string
  gene?: string
  transcript?: string
  refseqTranscript?: string
  hgvsC?: string
  hgvsP?: string
  hgvsG?: string
  rsId?: string
  consequence?: string
  impact?: string
  maneStatus?: string
}

export interface ClinVarData {
  variationId?: string
  clinicalSignificance?: string
  reviewStatus?: string
  lastEvaluated?: string
  diseases?: string[]
  rsId?: string
}

export interface GnomadData {
  popmaxFreq?: number
  popmaxPop?: string
  popmaxAlleleCount?: number
  afGlobal?: number
  afAfr?: number
  afAmr?: number
  afEas?: number
  afNfe?: number
  afSas?: number
  homCount?: number
  hemiCount?: number
}

export interface HgmdData {
  accession?: string
  classType?: string      // DM | DM? | DP | DFP | RCV
  description?: string
  gene?: string
  disease?: string
  pubmedId?: string
  mutationType?: string
}

export interface VepConsequence {
  mostSevereConsequence?: string
  siftScore?: number
  polyphenScore?: number
  caddScore?: number
  revelScore?: number
  spliceAiDsMax?: number
  spliceAiAgMax?: number
  loftee?: string         // HC | LC | NMD
  exonNumber?: number
  intronNumber?: number
}

export interface Pm1DomainData {
  gene: string
  domainName: string
  domainSource: string
  domainId?: string
  startPos: number
  endPos: number
  criticalRegion: boolean
  description?: string
}

// ==================== 完整变异输入 ====================

export interface VariantInput {
  annotation: VariantAnnotation
  clinvar?: ClinVarData
  gnomad?: GnomadData
  hgmd?: HgmdData
  vep?: VepConsequence
  pm1Domains?: Pm1DomainData[]
}

// ==================== ACMG 阈值配置 ====================

export interface AcmgThresholds {
  ba1: number             // 默认 0.05
  ba1Absolute: number     // 默认 20
  bs1: number             // 默认 0.0001
  bs1Absolute: number     // 默认 5
  bs1Supporting: number   // 默认 0.00001
  bs2: number             // 默认 0.001
  bs2Supporting: number   // 默认 0.0001
  pm2: number             // 默认 0.00001
  pm2Supporting: boolean  // 默认 true
  revelPathogenic: number // 默认 0.732
  revelBenign: number     // 默认 0.16
  spliceAiPathogenic: number // 默认 0.2
  spliceAiBenign: number   // 默认 0.01
  proteinLenDiff: number  // PVS1 蛋白长度变化百分比阈值
}

// ==================== 分类结果 ====================

export interface ClassificationResult {
  classification: AcmgClassification
  classificationLabel: string
  ruleResults: RuleResult[]
  evidenceSummary: EvidenceSummary
  timestamp: string
}

export interface EvidenceSummary {
  pathogenicVeryStrong: number
  pathogenicStrong: number
  pathogenicModerate: number
  pathogenicSupporting: number
  benignStandAlone: number
  benignStrong: number
  benignModerate: number
  benignSupporting: number
}

// ==================== 证据强度计数 ====================

export function createEvidenceSummary(rules: RuleResult[]): EvidenceSummary {
  const summary: EvidenceSummary = {
    pathogenicVeryStrong: 0,
    pathogenicStrong: 0,
    pathogenicModerate: 0,
    pathogenicSupporting: 0,
    benignStandAlone: 0,
    benignStrong: 0,
    benignModerate: 0,
    benignSupporting: 0,
  }

  for (const rule of rules) {
    if (!rule.applied) continue

    if (rule.evidenceType === EvidenceType.PATHOGENIC) {
      switch (rule.strength) {
        case EvidenceStrength.VERY_STRONG: summary.pathogenicVeryStrong++; break
        case EvidenceStrength.STRONG: summary.pathogenicStrong++; break
        case EvidenceStrength.MODERATE: summary.pathogenicModerate++; break
        case EvidenceStrength.SUPPORTING: summary.pathogenicSupporting++; break
      }
    } else {
      switch (rule.strength) {
        case EvidenceStrength.STAND_ALONE: summary.benignStandAlone++; break
        case EvidenceStrength.STRONG: summary.benignStrong++; break
        case EvidenceStrength.MODERATE: summary.benignModerate++; break
        case EvidenceStrength.SUPPORTING: summary.benignSupporting++; break
      }
    }
  }

  return summary
}
