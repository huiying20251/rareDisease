export { classifyVariant } from './classifier'
export { applyAllRules, DEFAULT_THRESHOLDS } from './rules'
export { classifyAcmgStandard } from './schemata'
export type {
  RuleResult,
  VariantInput,
  AcmgThresholds,
  ClassificationResult,
  EvidenceSummary,
  VariantAnnotation,
  ClinVarData,
  GnomadData,
  HgmdData,
  VepConsequence,
  Pm1DomainData,
} from './types'
export {
  EvidenceStrength,
  EvidenceType,
  RuleType,
  AcmgClassification,
  ACMG_CLASSIFICATION_ORDER,
  ACMG_CLASSIFICATION_LABELS,
  ACMG_CLASSIFICATION_COLORS,
} from './types'
export { createEvidenceSummary } from './types'
