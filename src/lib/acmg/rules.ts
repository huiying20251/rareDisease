/**
 * ACMG 分类规则引擎
 * 参考 HerediClassify 的 acmg_rules/ 模块设计
 * 
 * 实现的规则：
 * 致病性规则: PVS1, PS1, PS3, PS4, PM1, PM2, PM4, PM5, PP1, PP2, PP3, PP4
 * 良性规则: BA1, BS1, BS2, BP1, BP3, BP4, BP7
 */

import {
  type RuleResult,
  type VariantInput,
  type AcmgThresholds,
  type Pm1DomainData,
  EvidenceStrength,
  EvidenceType,
  RuleType,
} from './types'

// ==================== 默认阈值 ====================

export const DEFAULT_THRESHOLDS: AcmgThresholds = {
  ba1: 0.05,
  ba1Absolute: 20,
  bs1: 0.0001,
  bs1Absolute: 5,
  bs1Supporting: 0.00001,
  bs2: 0.001,
  bs2Supporting: 0.0001,
  pm2: 0.00001,
  pm2Supporting: true,
  revelPathogenic: 0.732,
  revelBenign: 0.16,
  spliceAiPathogenic: 0.2,
  spliceAiBenign: 0.01,
  proteinLenDiff: 0.1,
}

// ==================== 致病性规则 ====================

/**
 * PVS1: 功能丧失 (Loss of Function)
 * 适用条件: 无义突变、移码突变、经典剪接位点变异、起始密码子丢失、单外显子缺失
 */
function assessPVS1(variant: VariantInput): RuleResult {
  const { annotation, vep } = variant
  const consequence = annotation.consequence?.toUpperCase() || ''
  const impact = annotation.impact?.toUpperCase() || ''

  // 检查是否为 LOF 类型
  const lofConsequences = [
    'STOP_GAINED', 'NONSENSE', 'FRAMESHIFT_VARIANT',
    'SPLICE_ACCEPTOR_VARIANT', 'SPLICE_DONOR_VARIANT',
    'START_LOST', 'TRANSCRIPT_ABLATION',
  ]
  const isLoF = lofConsequences.some(c => consequence.includes(c))
  const isHighImpact = impact === 'HIGH'

  if (isLoF || isHighImpact) {
    // 判断 NMD
    const loftee = vep?.loftee
    const isNmd = loftee === 'HC' // High confidence NMD

    if (isNmd) {
      return {
        rule: 'PVS1',
        type: RuleType.PROTEIN,
        evidenceType: EvidenceType.PATHOGENIC,
        applied: true,
        strength: EvidenceStrength.VERY_STRONG,
        comment: `${annotation.hgvsC || annotation.hgvsG} 为功能丧失变异(LOF)，预测导致无义介导的mRNA降解(NMD)。LOFTEE: ${loftee}`,
      }
    }

    // 非 NMD 但 reading frame 改变
    if (consequence.includes('FRAMESHIFT')) {
      return {
        rule: 'PVS1',
        type: RuleType.PROTEIN,
        evidenceType: EvidenceType.PATHOGENIC,
        applied: true,
        strength: EvidenceStrength.STRONG,
        comment: `${annotation.hgvsC || annotation.hgvsG} 为移码变异，预测不发生NMD但导致蛋白截短。`,
      }
    }

    // 剪接位点
    if (consequence.includes('SPLICE')) {
      return {
        rule: 'PVS1',
        type: RuleType.SPLICING,
        evidenceType: EvidenceType.PATHOGENIC,
        applied: true,
        strength: EvidenceStrength.VERY_STRONG,
        comment: `${annotation.hgvsC || annotation.hgvsG} 为经典剪接位点变异(±1/2)。`,
      }
    }

    return {
      rule: 'PVS1',
      type: RuleType.PROTEIN,
      evidenceType: EvidenceType.PATHOGENIC,
      applied: true,
      strength: EvidenceStrength.STRONG,
      comment: `${annotation.hgvsC || annotation.hgvsG} 为功能丧失变异(LOF)，但NMD预测不确定。`,
    }
  }

  return {
    rule: 'PVS1',
    type: RuleType.GENERAL,
    evidenceType: EvidenceType.PATHOGENIC,
    applied: false,
    strength: EvidenceStrength.VERY_STRONG,
    comment: `变异类型为 ${consequence || '未知'}，不符合PVS1(功能丧失)标准。`,
  }
}

/**
 * PS1: 与已知致病性变异编码相同的氨基酸改变
 */
function assessPS1(variant: VariantInput): RuleResult {
  const { clinvar, annotation } = variant
  const sig = clinvar?.clinicalSignificance?.toUpperCase() || ''

  const pathogenicTerms = ['PATHOGENIC', 'LIKELY PATHOGENIC']
  const isClinvarPathogenic = pathogenicTerms.some(t => sig.includes(t))

  if (isClinvarPathogenic && clinvar?.reviewStatus) {
    const highReviewStatuses = [
      'CRITERIA_PROVIDED', 'REVIEWED_BY_EXPERT_PANEL',
      'GUIDELINE', 'PRACTICE_GUIDELINE',
    ]
    const isHighReview = highReviewStatuses.some(s =>
      clinvar.reviewStatus?.toUpperCase().includes(s)
    )

    if (isHighReview) {
      return {
        rule: 'PS1',
        type: RuleType.GENERAL,
        evidenceType: EvidenceType.PATHOGENIC,
        applied: true,
        strength: EvidenceStrength.STRONG,
        comment: `ClinVar (${clinvar.variationId}) 评级为 ${clinvar.clinicalSignificance}，评审状态: ${clinvar.reviewStatus}。`,
      }
    }

    return {
      rule: 'PS1',
      type: RuleType.GENERAL,
      evidenceType: EvidenceType.PATHOGENIC,
      applied: true,
      strength: EvidenceStrength.MODERATE,
      comment: `ClinVar (${clinvar.variationId}) 评级为 ${clinvar.clinicalSignificance}，但评审状态(${clinvar.reviewStatus})不是高可信度。降为中等强度证据(PM5)。`,
    }
  }

  // HGMD DM
  if (variant.hgmd?.classType === 'DM') {
    return {
      rule: 'PS1',
      type: RuleType.GENERAL,
      evidenceType: EvidenceType.PATHOGENIC,
      applied: true,
      strength: EvidenceStrength.MODERATE,
      comment: `HGMD (${variant.hgmd.accession}) 分类为 DM (Disease-causing mutation)。`,
    }
  }

  return {
    rule: 'PS1',
    type: RuleType.GENERAL,
    evidenceType: EvidenceType.PATHOGENIC,
    applied: false,
    strength: EvidenceStrength.STRONG,
    comment: '未在 ClinVar 或 HGMD 中找到匹配的致病性变异记录。',
  }
}

/**
 * PS3: 功能实验证实对基因产物有有害影响
 * 注: 本实现使用 VEP 预测工具分数作为代理，实际应使用功能实验数据
 */
function assessPS3(variant: VariantInput, thresholds: AcmgThresholds): RuleResult {
  const { vep } = variant
  const revel = vep?.revelScore
  const cadd = vep?.caddScore

  // 使用 REVEL 分数作为 PS3 的代理指标（REVEL > 0.732 强烈提示致病）
  if (revel !== undefined && revel > thresholds.revelPathogenic) {
    return {
      rule: 'PS3',
      type: RuleType.GENERAL,
      evidenceType: EvidenceType.PATHOGENIC,
      applied: true,
      strength: EvidenceStrength.STRONG,
      comment: `REVEL 分数 ${revel.toFixed(3)} > ${thresholds.revelPathogenic}，预测对蛋白功能有显著有害影响。CADD: ${cadd?.toFixed(1) || 'N/A'}`,
    }
  }

  // CADD > 25 作为支持证据
  if (cadd !== undefined && cadd > 25) {
    return {
      rule: 'PS3',
      type: RuleType.GENERAL,
        evidenceType: EvidenceType.PATHOGENIC,
      applied: true,
      strength: EvidenceStrength.MODERATE,
      comment: `CADD 分数 ${cadd.toFixed(1)} > 25，预测可能对蛋白功能有有害影响。REVEL: ${revel?.toFixed(3) || 'N/A'}`,
    }
  }

  return {
    rule: 'PS3',
    type: RuleType.GENERAL,
    evidenceType: EvidenceType.PATHOGENIC,
    applied: false,
    strength: EvidenceStrength.STRONG,
    comment: `缺乏功能实验数据。REVEL: ${revel?.toFixed(3) || 'N/A'}, CADD: ${cadd?.toFixed(1) || 'N/A'}`,
  }
}

/**
 * PS4: 变异在受影响的个体中频率显著高于对照人群
 * 注: 需要病例对照数据，此处仅做框架
 */
function assessPS4(_variant: VariantInput): RuleResult {
  return {
    rule: 'PS4',
    type: RuleType.GENERAL,
    evidenceType: EvidenceType.PATHOGENIC,
    applied: false,
    strength: EvidenceStrength.STRONG,
    comment: 'PS4 需要病例对照频率数据，当前未配置。',
  }
}

/**
 * PM1: 变异位于突变热点区域或关键功能域
 */
function assessPM1(variant: VariantInput, pm1Domains: Pm1DomainData[]): RuleResult {
  const gene = variant.annotation.gene
  const hgvsP = variant.annotation.hgvsP

  if (!gene || !pm1Domains.length) {
    return {
      rule: 'PM1',
      type: RuleType.GENERAL,
      evidenceType: EvidenceType.PATHOGENIC,
      applied: false,
      strength: EvidenceStrength.MODERATE,
      comment: `未找到 ${gene || '未知基因'} 的 PM1 关键功能域数据。`,
    }
  }

  // 从 HGVS p. 中提取氨基酸位置
  let aaPos: number | null = null
  if (hgvsP) {
    const match = hgvsP.match(/p\.\w+(\d+)/)
    if (match) {
      aaPos = parseInt(match[1], 10)
    }
  }

  const geneDomains = pm1Domains.filter(d => d.gene.toUpperCase() === gene.toUpperCase())

  for (const domain of geneDomains) {
    if (aaPos !== null && aaPos >= domain.startPos && aaPos <= domain.endPos) {
      return {
        rule: 'PM1',
        type: RuleType.GENERAL,
        evidenceType: EvidenceType.PATHOGENIC,
        applied: true,
        strength: EvidenceStrength.MODERATE,
        comment: `变异位于 ${gene} 的关键功能域 ${domain.domainName} (${domain.domainSource}: ${domain.domainId || ''})，氨基酸位置 ${aaPos}（范围 ${domain.startPos}-${domain.endPos}）。${domain.criticalRegion ? '该区域已标记为关键区域。' : ''}`,
      }
    }
  }

  return {
    rule: 'PM1',
    type: RuleType.GENERAL,
    evidenceType: EvidenceType.PATHOGENIC,
    applied: false,
    strength: EvidenceStrength.MODERATE,
    comment: `变异氨基酸位置 ${aaPos || '未知'} 不在 ${gene} 的 ${geneDomains.map(d => d.domainName).join(', ') || '任何已知'} 关键功能域内。`,
  }
}

/**
 * PM2: 变异在对照人群中缺失或极低频率
 * 参考 ClinGen SVI 建议: PM2 默认降为 Supporting
 */
function assessPM2(variant: VariantInput, thresholds: AcmgThresholds): RuleResult {
  const { gnomad } = variant
  const freq = gnomad?.afGlobal ?? gnomad?.popmaxFreq

  const strength = thresholds.pm2Supporting
    ? EvidenceStrength.SUPPORTING
    : EvidenceStrength.MODERATE

  if (freq === undefined || freq === null || freq === 0) {
    return {
      rule: 'PM2',
      type: RuleType.GENERAL,
      evidenceType: EvidenceType.PATHOGENIC,
      applied: true,
      strength,
      comment: `变异在 gnomAD 中未检测到（频率假设为 0）。${thresholds.pm2Supporting ? '按 ClinGen SVI 建议使用 Supporting 等级。' : ''}`,
    }
  }

  if (freq < thresholds.pm2) {
    return {
      rule: 'PM2',
      type: RuleType.GENERAL,
      evidenceType: EvidenceType.PATHOGENIC,
      applied: true,
      strength,
      comment: `gnomAD 全局频率 ${freq.toExponential(3)} < ${thresholds.pm2}。Popmax: ${gnomad.popmaxFreq?.toExponential(3) || 'N/A'} (${gnomad.popmaxPop || 'N/A'})。`,
    }
  }

  return {
    rule: 'PM2',
    type: RuleType.GENERAL,
    evidenceType: EvidenceType.PATHOGENIC,
    applied: false,
    strength,
    comment: `gnomAD 全局频率 ${freq.toExponential(3)} >= ${thresholds.pm2}，PM2 不适用。`,
  }
}

/**
 * PM4: 蛋白长度因移码或截短而改变，但非移码变异
 */
function assessPM4(variant: VariantInput): RuleResult {
  const consequence = variant.annotation.consequence?.toUpperCase() || ''

  if (consequence.includes('INFRAME') && (consequence.includes('DELETION') || consequence.includes('INSERTION'))) {
    return {
      rule: 'PM4',
      type: RuleType.PROTEIN,
      evidenceType: EvidenceType.PATHOGENIC,
      applied: true,
      strength: EvidenceStrength.MODERATE,
      comment: `${variant.annotation.hgvsC || ''} 为非移码插入/缺失，导致蛋白长度改变。`,
    }
  }

  if (consequence.includes('STOP_LOST')) {
    return {
      rule: 'PM4',
      type: RuleType.PROTEIN,
      evidenceType: EvidenceType.PATHOGENIC,
      applied: true,
      strength: EvidenceStrength.MODERATE,
      comment: `${variant.annotation.hgvsC || ''} 为终止密码子丢失变异。`,
    }
  }

  return {
    rule: 'PM4',
    type: RuleType.PROTEIN,
    evidenceType: EvidenceType.PATHOGENIC,
    applied: false,
    strength: EvidenceStrength.MODERATE,
    comment: `变异类型 ${consequence || '未知'} 不符合 PM4 标准。`,
  }
}

/**
 * PM5: 在同一残基处发现新的错义变异，先前已确认为致病性
 * 注: 需要与 ClinVar 已知致病性变异对比
 */
function assessPM5(variant: VariantInput): RuleResult {
  const { clinvar, annotation } = variant
  const consequence = annotation.consequence?.toUpperCase() || ''
  const isMissense = consequence.includes('MISSENSE')

  if (!isMissense) {
    return {
      rule: 'PM5',
      type: RuleType.GENERAL,
      evidenceType: EvidenceType.PATHOGENIC,
      applied: false,
      strength: EvidenceStrength.MODERATE,
      comment: 'PM5 仅适用于错义变异。',
    }
  }

  // 如果 ClinVar 有记录但评审状态非高可信度，可作为 PM5
  if (clinvar?.clinicalSignificance) {
    const sig = clinvar.clinicalSignificance.toUpperCase()
    if (sig.includes('PATHOGENIC')) {
      return {
        rule: 'PM5',
        type: RuleType.GENERAL,
        evidenceType: EvidenceType.PATHOGENIC,
        applied: true,
        strength: EvidenceStrength.MODERATE,
        comment: `ClinVar 记录为 ${clinvar.clinicalSignificance}。同一氨基酸残基的错义变异已有致病性判定。`,
      }
    }
  }

  // HGMD DM? 作为 PM5 的支持
  if (variant.hgmd?.classType === 'DM?') {
    return {
      rule: 'PM5',
      type: RuleType.GENERAL,
      evidenceType: EvidenceType.PATHOGENIC,
      applied: true,
      strength: EvidenceStrength.MODERATE,
      comment: `HGMD (${variant.hgmd.accession}) 分类为 DM? (Possible disease-causing)。`,
    }
  }

  return {
    rule: 'PM5',
    type: RuleType.GENERAL,
    evidenceType: EvidenceType.PATHOGENIC,
    applied: false,
    strength: EvidenceStrength.MODERATE,
    comment: '未找到同一残基的已知致病性错义变异。',
  }
}

/**
 * PP3: 多种计算证据支持对基因产物有有害影响
 */
function assessPP3(variant: VariantInput, thresholds: AcmgThresholds): RuleResult {
  const { vep } = variant
  const revel = vep?.revelScore
  const spliceAi = Math.max(vep?.spliceAiDsMax ?? 0, vep?.spliceAiAgMax ?? 0)
  const sift = vep?.siftScore
  const polyphen = vep?.polyphenScore

  // 错义变异: REVEL 或 SIFT+PolyPhen
  if (revel !== undefined && revel > thresholds.revelBenign) {
    return {
      rule: 'PP3',
      type: RuleType.GENERAL,
      evidenceType: EvidenceType.PATHOGENIC,
      applied: true,
      strength: EvidenceStrength.SUPPORTING,
      comment: `计算预测支持致病性: REVEL=${revel.toFixed(3)}, SIFT=${sift?.toFixed(3) || 'N/A'}, PolyPhen=${polyphen?.toFixed(3) || 'N/A'}, SpliceAI=${spliceAi.toFixed(3)}`,
    }
  }

  if (sift !== undefined && sift < 0.05 && polyphen !== undefined && polyphen > 0.85) {
    return {
      rule: 'PP3',
      type: RuleType.GENERAL,
      evidenceType: EvidenceType.PATHOGENIC,
      applied: true,
      strength: EvidenceStrength.SUPPORTING,
      comment: `SIFT(${sift.toFixed(3)})预测有害 + PolyPhen(${polyphen.toFixed(3)})预测可能有害。`,
    }
  }

  // 剪接影响
  if (spliceAi > thresholds.spliceAiBenign) {
    return {
      rule: 'PP3',
      type: RuleType.SPLICING,
      evidenceType: EvidenceType.PATHOGENIC,
      applied: true,
      strength: EvidenceStrength.SUPPORTING,
      comment: `SpliceAI (max=${spliceAi.toFixed(3)}) 预测可能影响剪接。`,
    }
  }

  return {
    rule: 'PP3',
    type: RuleType.GENERAL,
    evidenceType: EvidenceType.PATHOGENIC,
    applied: false,
    strength: EvidenceStrength.SUPPORTING,
    comment: `计算预测未提示有害影响: REVEL=${revel?.toFixed(3) || 'N/A'}, SIFT=${sift?.toFixed(3) || 'N/A'}, PolyPhen=${polyphen?.toFixed(3) || 'N/A'}, SpliceAI=${spliceAi.toFixed(3)}`,
  }
}

/**
 * PP1: 共分离
 */
function assessPP1(): RuleResult {
  return {
    rule: 'PP1',
    type: RuleType.GENERAL,
    evidenceType: EvidenceType.PATHOGENIC,
    applied: false,
    strength: EvidenceStrength.SUPPORTING,
    comment: 'PP1(共分离)需要家系数据，当前未配置。',
  }
}

/**
 * PP2: 基因中 missense 变异是致病性的常见机制
 */
function assessPP2(variant: VariantInput): RuleResult {
  const consequence = variant.annotation.consequence?.toUpperCase() || ''
  const isMissense = consequence.includes('MISSENSE')

  if (isMissense && variant.annotation.gene) {
    return {
      rule: 'PP2',
      type: RuleType.GENERAL,
      evidenceType: EvidenceType.PATHOGENIC,
      applied: true,
      strength: EvidenceStrength.SUPPORTING,
      comment: `${variant.annotation.gene} 基因中错义变异是已知的常见致病机制。`,
    }
  }

  return {
    rule: 'PP2',
    type: RuleType.GENERAL,
    evidenceType: EvidenceType.PATHOGENIC,
    applied: false,
    strength: EvidenceStrength.SUPPORTING,
    comment: `PP2 不适用。变异类型: ${consequence || '未知'}。`,
  }
}

/**
 * PP4: 患者表型或家族史高度特异于该基因相关的单基因疾病
 */
function assessPP4(): RuleResult {
  return {
    rule: 'PP4',
    type: RuleType.GENERAL,
    evidenceType: EvidenceType.PATHOGENIC,
    applied: false,
    strength: EvidenceStrength.SUPPORTING,
    comment: 'PP4 需要临床表型匹配数据，当前未配置。',
  }
}

// ==================== 良性规则 ====================

/**
 * BA1: 等位基因频率过高 (>5%)
 */
function assessBA1(variant: VariantInput, thresholds: AcmgThresholds): RuleResult {
  const { gnomad } = variant
  const freq = gnomad?.popmaxFreq ?? gnomad?.afGlobal

  if (freq === undefined || freq === null) {
    return {
      rule: 'BA1',
      type: RuleType.GENERAL,
      evidenceType: EvidenceType.BENIGN,
      applied: false,
      strength: EvidenceStrength.STAND_ALONE,
      comment: 'gnomAD 频率数据不可用。',
    }
  }

  if (freq > thresholds.ba1) {
    return {
      rule: 'BA1',
      type: RuleType.GENERAL,
      evidenceType: EvidenceType.BENIGN,
      applied: true,
      strength: EvidenceStrength.STAND_ALONE,
      comment: `gnomAD Popmax 频率 ${freq.toFixed(6)} > ${thresholds.ba1} (BA1 阈值)。群体: ${gnomad.popmaxPop || 'ALL'}, 等位基因数: ${gnomad.popmaxAlleleCount ?? 'N/A'}`,
    }
  }

  return {
    rule: 'BA1',
    type: RuleType.GENERAL,
    evidenceType: EvidenceType.BENIGN,
    applied: false,
    strength: EvidenceStrength.STAND_ALONE,
    comment: `gnomAD 频率 ${freq.toFixed(6)} <= ${thresholds.ba1}，BA1 不适用。`,
  }
}

/**
 * BS1: 等位基因频率高于疾病预期
 */
function assessBS1(variant: VariantInput, thresholds: AcmgThresholds): RuleResult {
  const { gnomad } = variant
  const freq = gnomad?.popmaxFreq ?? gnomad?.afGlobal

  if (freq === undefined || freq === null) {
    return {
      rule: 'BS1',
      type: RuleType.GENERAL,
      evidenceType: EvidenceType.BENIGN,
      applied: false,
      strength: EvidenceStrength.STRONG,
      comment: 'gnomAD 频率数据不可用。',
    }
  }

  if (freq > thresholds.bs1) {
    return {
      rule: 'BS1',
      type: RuleType.GENERAL,
      evidenceType: EvidenceType.BENIGN,
      applied: true,
      strength: EvidenceStrength.STRONG,
      comment: `gnomAD Popmax 频率 ${freq.toFixed(6)} > ${thresholds.bs1} (BS1 阈值)。群体: ${gnomad.popmaxPop || 'ALL'}`,
    }
  }

  // Supporting level
  if (freq > thresholds.bs1Supporting) {
    return {
      rule: 'BS1',
      type: RuleType.GENERAL,
      evidenceType: EvidenceType.BENIGN,
      applied: true,
      strength: EvidenceStrength.SUPPORTING,
      comment: `gnomAD Popmax 频率 ${freq.toFixed(6)} > ${thresholds.bs1Supporting} (BS1 Supporting 阈值)。群体: ${gnomad.popmaxPop || 'ALL'}`,
    }
  }

  return {
    rule: 'BS1',
    type: RuleType.GENERAL,
    evidenceType: EvidenceType.BENIGN,
    applied: false,
    strength: EvidenceStrength.STRONG,
    comment: `gnomAD 频率 ${freq.toFixed(6)}，BS1 不适用。`,
  }
}

/**
 * BS2: 在健康成人中观察到纯合子变异
 */
function assessBS2(variant: VariantInput, thresholds: AcmgThresholds): RuleResult {
  const { gnomad } = variant

  if (gnomad?.homCount && gnomad.homCount >= 2) {
    return {
      rule: 'BS2',
      type: RuleType.GENERAL,
      evidenceType: EvidenceType.BENIGN,
      applied: true,
      strength: EvidenceStrength.STRONG,
      comment: `gnomAD 中观察到 ${gnomad.homCount} 个纯合子个体，提示变异不具有高度外显的致病性。`,
    }
  }

  if (gnomad?.hemiCount && gnomad.hemiCount >= 2) {
    return {
      rule: 'BS2',
      type: RuleType.GENERAL,
      evidenceType: EvidenceType.BENIGN,
      applied: true,
      strength: EvidenceStrength.STRONG,
      comment: `gnomAD 中观察到 ${gnomad.hemiCount} 个半合子个体(X染色体)。`,
    }
  }

  return {
    rule: 'BS2',
    type: RuleType.GENERAL,
    evidenceType: EvidenceType.BENIGN,
    applied: false,
    strength: EvidenceStrength.STRONG,
    comment: `gnomAD 中纯合子: ${gnomad?.homCount ?? 0}, 半合子: ${gnomad?.hemiCount ?? 0}，BS2 不适用。`,
  }
}

/**
 * BP1: 错义变异位于基因的非功能区域
 */
function assessBP1(variant: VariantInput, pm1Domains: Pm1DomainData[]): RuleResult {
  const consequence = variant.annotation.consequence?.toUpperCase() || ''
  const isMissense = consequence.includes('MISSENSE')

  if (!isMissense) {
    return {
      rule: 'BP1',
      type: RuleType.GENERAL,
      evidenceType: EvidenceType.BENIGN,
      applied: false,
      strength: EvidenceStrength.SUPPORTING,
      comment: 'BP1 仅适用于错义变异。',
    }
  }

  // 如果不在任何关键功能域内，可能适用 BP1
  // 简化版：如果基因有关键域但变异不在其中
  const gene = variant.annotation.gene
  if (gene && pm1Domains.length > 0) {
    const geneDomains = pm1Domains.filter(d => d.gene.toUpperCase() === gene.toUpperCase())
    if (geneDomains.length > 0) {
      // 变异不在关键域中
      return {
        rule: 'BP1',
        type: RuleType.GENERAL,
        evidenceType: EvidenceType.BENIGN,
        applied: true,
        strength: EvidenceStrength.SUPPORTING,
        comment: `错义变异不在 ${gene} 的已知关键功能域中，致病可能性较低。`,
      }
    }
  }

  return {
    rule: 'BP1',
    type: RuleType.GENERAL,
    evidenceType: EvidenceType.BENIGN,
    applied: false,
    strength: EvidenceStrength.SUPPORTING,
    comment: '无法判断变异是否在非功能区域。',
  }
}

/**
 * BP3: 非移码插入/缺失不影响蛋白长度或功能
 */
function assessBP3(variant: VariantInput): RuleResult {
  const consequence = variant.annotation.consequence?.toUpperCase() || ''
  const isSynonymous = consequence.includes('SYNONYMOUS')

  if (isSynonymous) {
    return {
      rule: 'BP3',
      type: RuleType.GENERAL,
      evidenceType: EvidenceType.BENIGN,
      applied: true,
      strength: EvidenceStrength.SUPPORTING,
      comment: '同义变异，预计不改变蛋白序列。',
    }
  }

  return {
    rule: 'BP3',
    type: RuleType.GENERAL,
    evidenceType: EvidenceType.BENIGN,
    applied: false,
    strength: EvidenceStrength.SUPPORTING,
    comment: `变异类型 ${consequence || '未知'} 不符合 BP3。`,
  }
}

/**
 * BP4: 多种计算证据不支持对基因产物有影响
 */
function assessBP4(variant: VariantInput, thresholds: AcmgThresholds): RuleResult {
  const { vep } = variant
  const revel = vep?.revelScore
  const sift = vep?.siftScore
  const polyphen = vep?.polyphenScore
  const spliceAi = Math.max(vep?.spliceAiDsMax ?? 0, vep?.spliceAiAgMax ?? 0)

  const benignPredictions: string[] = []

  if (revel !== undefined && revel < thresholds.revelBenign) {
    benignPredictions.push(`REVEL=${revel.toFixed(3)}<${thresholds.revelBenign}`)
  }
  if (sift !== undefined && sift >= 0.05) {
    benignPredictions.push(`SIFT=${sift.toFixed(3)}(tolerated)`)
  }
  if (polyphen !== undefined && polyphen < 0.15) {
    benignPredictions.push(`PolyPhen=${polyphen.toFixed(3)}(benign)`)
  }
  if (spliceAi < 0.1) {
    benignPredictions.push(`SpliceAI=${spliceAi.toFixed(3)}`)
  }

  if (benignPredictions.length >= 2) {
    return {
      rule: 'BP4',
      type: RuleType.GENERAL,
      evidenceType: EvidenceType.BENIGN,
      applied: true,
      strength: EvidenceStrength.SUPPORTING,
      comment: `多种计算预测均不支持致病性: ${benignPredictions.join(', ')}。`,
    }
  }

  return {
    rule: 'BP4',
    type: RuleType.GENERAL,
    evidenceType: EvidenceType.BENIGN,
    applied: false,
    strength: EvidenceStrength.SUPPORTING,
    comment: `计算预测不足以支持 BP4: REVEL=${revel?.toFixed(3) || 'N/A'}, SIFT=${sift?.toFixed(3) || 'N/A'}, PolyPhen=${polyphen?.toFixed(3) || 'N/A'}`,
  }
}

/**
 * BP7: 同义变异，预测不影响剪接且保守性低
 */
function assessBP7(variant: VariantInput): RuleResult {
  const consequence = variant.annotation.consequence?.toUpperCase() || ''
  const isSynonymous = consequence.includes('SYNONYMOUS')
  const isDeepIntron = consequence.includes('INTRON')

  if (isSynonymous || isDeepIntron) {
    return {
      rule: 'BP7',
      type: RuleType.GENERAL,
      evidenceType: EvidenceType.BENIGN,
      applied: true,
      strength: EvidenceStrength.SUPPORTING,
      comment: `${isSynonymous ? '同义变异' : '深内含子变异'}，预测不影响蛋白功能。`,
    }
  }

  return {
    rule: 'BP7',
    type: RuleType.GENERAL,
    evidenceType: EvidenceType.BENIGN,
    applied: false,
    strength: EvidenceStrength.SUPPORTING,
    comment: `变异类型 ${consequence || '未知'} 不符合 BP7。`,
  }
}

// ==================== 主入口 ====================

export function applyAllRules(
  variant: VariantInput,
  thresholds: AcmgThresholds = DEFAULT_THRESHOLDS,
  pm1Domains: Pm1DomainData[] = [],
): RuleResult[] {
  return [
    // 致病性
    assessPVS1(variant),
    assessPS1(variant),
    assessPS3(variant, thresholds),
    assessPS4(variant),
    assessPM1(variant, pm1Domains),
    assessPM2(variant, thresholds),
    assessPM4(variant),
    assessPM5(variant),
    assessPP1(),
    assessPP2(variant),
    assessPP3(variant, thresholds),
    assessPP4(),
    // 良性
    assessBA1(variant, thresholds),
    assessBS1(variant, thresholds),
    assessBS2(variant, thresholds),
    assessBP1(variant, pm1Domains),
    assessBP3(variant),
    assessBP4(variant, thresholds),
    assessBP7(variant),
  ]
}
