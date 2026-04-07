/**
 * ACMG 分类规则组合 Schema
 * 参考 HerediClassify classification_schemata/rule_combinations.py
 * 
 * 分类组合逻辑：
 * - Benign: BA1(stand_alone) 或 BS1×2(strong) 等
 * - Likely Benign: BS1(strong) + 1个支持证据 等
 * - Likely Pathogenic: PVS1(very_strong) + PM2(moderate) 等
 * - Pathogenic: PVS1×2(very_strong) 或 PVS1+PS1 等
 */

import type { EvidenceSummary } from './types'
import { AcmgClassification } from './types'

interface RuleCombo {
  pathVeryStrong?: number
  pathStrong?: number
  pathModerate?: number
  pathSupporting?: number
  benignStandAlone?: number
  benignStrong?: number
  benignModerate?: number
  benignSupporting?: number
}

function matchesCombo(summary: EvidenceSummary, combo: RuleCombo): boolean {
  if (combo.pathVeryStrong !== undefined && summary.pathogenicVeryStrong < combo.pathVeryStrong) return false
  if (combo.pathStrong !== undefined && summary.pathogenicStrong < combo.pathStrong) return false
  if (combo.pathModerate !== undefined && summary.pathogenicModerate < combo.pathModerate) return false
  if (combo.pathSupporting !== undefined && summary.pathogenicSupporting < combo.pathSupporting) return false
  if (combo.benignStandAlone !== undefined && summary.benignStandAlone < combo.benignStandAlone) return false
  if (combo.benignStrong !== undefined && summary.benignStrong < combo.benignStrong) return false
  if (combo.benignModerate !== undefined && summary.benignModerate < combo.benignModerate) return false
  if (combo.benignSupporting !== undefined && summary.benignSupporting < combo.benignSupporting) return false
  return true
}

// ==================== Benign 组合 ====================

const benignCombos: RuleCombo[] = [
  { benignStandAlone: 1 },                              // BA1 alone
  { benignStrong: 2 },                                  // 2×strong benign
]

const likelyBenignCombos: RuleCombo[] = [
  { benignStrong: 1, benignSupporting: 1 },             // 1 strong + 1 supporting
  { benignSupporting: 2 },                              // 2×supporting
]

// ==================== Pathogenic 组合 ====================

const pathogenicCombos: RuleCombo[] = [
  { pathVeryStrong: 2 },                                // 2×very_strong
  { pathVeryStrong: 1, pathStrong: 1 },                 // PVS1 + PS1/PS2/PS3/PS4
  { pathVeryStrong: 1, pathModerate: 2 },               // PVS1 + PM1+PM2
  { pathVeryStrong: 1, pathModerate: 1, pathSupporting: 1 }, // PVS1 + PM1 + PP1
  { pathVeryStrong: 1, pathSupporting: 2 },             // PVS1 + PP1+PP3
  { pathStrong: 2 },                                    // PS1+PS4 等 2×strong
  { pathStrong: 1, pathModerate: 3 },                   // 1 strong + 3 moderate
  { pathStrong: 1, pathModerate: 2, pathSupporting: 2 }, // 1 strong + 2 moderate + 2 supporting
  { pathStrong: 1, pathModerate: 1, pathSupporting: 4 }, // 1 strong + 1 moderate + 4 supporting
]

const likelyPathogenicCombos: RuleCombo[] = [
  { pathVeryStrong: 1, pathModerate: 1 },               // PVS1 + PM2
  { pathVeryStrong: 1, pathSupporting: 1 },             // PVS1 + PP3
  { pathStrong: 1, pathModerate: 1 },                   // PS1 + PM2
  { pathStrong: 1, pathSupporting: 2 },                 // PS1 + PP1+PP3
  { pathModerate: 3 },                                  // PM1+PM2+PM5
  { pathModerate: 2, pathSupporting: 2 },               // PM1+PM2 + PP1+PP3
  { pathModerate: 1, pathSupporting: 4 },               // PM2 + 4×supporting
]

// ==================== 冲突规则检查 ====================

/**
 * 检查 PVS1 和 PM4 的冲突
 * PVS1 (LOF) 和 PM4 (蛋白长度变化但非LOF) 不应同时适用
 */
function checkPvs1Pm4Conflict(rules: { applied: boolean; rule: string }[]): boolean {
  const pvs1 = rules.find(r => r.rule === 'PVS1' && r.applied)
  const pm4 = rules.find(r => r.rule === 'PM4' && r.applied)
  if (pvs1 && pm4) return true
  return false
}

/**
 * 检查 BA1 和 BS1 的冲突
 * BA1 (stand_alone benign) 和 BS1 (strong benign) 不应同时适用
 */
function checkBa1Bs1Conflict(rules: { applied: boolean; rule: string }[]): boolean {
  const ba1 = rules.find(r => r.rule === 'BA1' && r.applied)
  const bs1 = rules.find(r => r.rule === 'BS1' && r.applied)
  if (ba1 && bs1) return true
  return false
}

/**
 * 检查致病性和良性证据之间的冲突
 */
function checkPathoBenignConflict(rules: { applied: boolean; evidenceType: string; rule: string }[]): {
  hasConflict: boolean
  description: string
} {
  const pathRules = rules.filter(r => r.applied && r.evidenceType === 'pathogenic')
  const benignRules = rules.filter(r => r.applied && r.evidenceType === 'benign')

  if (pathRules.length === 0 || benignRules.length === 0) {
    return { hasConflict: false, description: '' }
  }

  // BA1 vs 任何致病性证据
  const ba1 = rules.find(r => r.rule === 'BA1' && r.applied)
  if (ba1 && pathRules.length > 0) {
    return {
      hasConflict: true,
      description: `BA1 (独立良性证据) 与致病性证据 ${pathRules.map(r => r.rule).join(', ')} 冲突`
    }
  }

  // PVS1+PM2_Supporting vs BS1
  const pvs1 = rules.find(r => r.rule === 'PVS1' && r.applied)
  const bs1 = rules.find(r => r.rule === 'BS1' && r.applied)
  if (pvs1 && bs1) {
    return {
      hasConflict: true,
      description: 'PVS1 (功能丧失) 与 BS1 (频率高于预期) 存在潜在冲突'
    }
  }

  return { hasConflict: false, description: '' }
}

// ==================== 主分类函数 ====================

export interface ClassificationWithConflicts {
  classification: AcmgClassification
  conflicts: string[]
  matchedCombo?: string
}

/**
 * ACMG 标准五级分类
 * 参考: Richards et al. 2015, ClinGen SVI recommendations
 */
export function classifyAcmgStandard(rules: { applied: boolean; rule: string; evidenceType: string; strength: string }[]): ClassificationWithConflicts {
  const appliedRules = rules.filter(r => r.applied)
  const summary = summarizeAppliedRules(appliedRules)

  const conflicts: string[] = []

  // 检查冲突
  if (checkPvs1Pm4Conflict(appliedRules)) {
    conflicts.push('PVS1 和 PM4 不应同时适用')
  }
  if (checkBa1Bs1Conflict(appliedRules)) {
    conflicts.push('BA1 和 BS1 冲突，优先使用 BA1')
  }
  const pathoBenignConflict = checkPathoBenignConflict(appliedRules)
  if (pathoBenignConflict.hasConflict) {
    conflicts.push(pathoBenignConflict.description)
  }

  // 1. BA1 → 独立良性
  if (summary.benignStandAlone >= 1) {
    return { classification: AcmgClassification.BENIGN, conflicts, matchedCombo: 'BA1 (stand_alone)' }
  }

  // 2. Benign 组合
  for (const combo of benignCombos) {
    if (matchesCombo(summary, combo)) {
      return { classification: AcmgClassification.BENIGN, conflicts }
    }
  }

  // 3. Likely Benign 组合
  for (const combo of likelyBenignCombos) {
    if (matchesCombo(summary, combo)) {
      return { classification: AcmgClassification.LIKELY_BENIGN, conflicts }
    }
  }

  // 4. Pathogenic 组合
  for (const combo of pathogenicCombos) {
    if (matchesCombo(summary, combo)) {
      return { classification: AcmgClassification.PATHOGENIC, conflicts }
    }
  }

  // 5. Likely Pathogenic 组合
  for (const combo of likelyPathogenicCombos) {
    if (matchesCombo(summary, combo)) {
      return { classification: AcmgClassification.LIKELY_PATHOGENIC, conflicts }
    }
  }

  // 6. 默认 VUS
  return { classification: AcmgClassification.VUS, conflicts }
}

function summarizeAppliedRules(rules: { evidenceType: string; strength: string }[]): EvidenceSummary {
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
    const isPathogenic = rule.evidenceType === 'pathogenic'
    if (rule.strength === 'very_strong' && isPathogenic) {
      summary.pathogenicVeryStrong++
    } else if (rule.strength === 'strong') {
      if (isPathogenic) { summary.pathogenicStrong++ } else { summary.benignStrong++ }
    } else if (rule.strength === 'moderate') {
      if (isPathogenic) { summary.pathogenicModerate++ } else { summary.benignModerate++ }
    } else if (rule.strength === 'supporting') {
      if (isPathogenic) { summary.pathogenicSupporting++ } else { summary.benignSupporting++ }
    } else if (rule.strength === 'stand_alone') {
      summary.benignStandAlone++
    }
  }

  return summary
}
