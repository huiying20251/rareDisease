export type IntentType =
  | 'variant_interpretation'
  | 'hpo_matching'
  | 'product_recommendation'
  | 'disease_recommendation'
  | 'general'

export interface IntentResult {
  intent: IntentType
  confidence: number
  extractedData?: Record<string, any>
}

// ==================== Keyword Rules ====================

const VARIANT_KEYWORDS = [
  '变异', '致病', 'ACMG', '评级', '解读', '突变', 'pathogenic',
  'likely pathogenic', 'VUS', 'benign', '变异分类', '致病性',
  '基因突变', '位点', '杂合', '纯合', '半合子', '移码',
  '错义', '无义', '剪接', 'frameshift', 'missense', 'nonsense',
  'splicing', 'splice', 'LOF', 'loss of function',
]

const HPO_KEYWORDS = [
  '表型', 'HPO', '匹配', '临床表型', '表型匹配',
  'HP:', 'human phenotype',
]

const SYMPTOM_KEYWORDS = [
  '智力障碍', '癫痫', '肌张力低下', '发育迟缓', '智力低下',
  '抽搐', '惊厥', '肌张力低', '生长迟缓', '身材矮小',
  '自闭症', '孤独症', '小头畸形', '肌无力', '肌营养不良',
  '共济失调', '耳聋', '听力下降', '视网膜色素变性',
  '肝肿大', '脊柱侧弯', '多指', '多趾', '面部畸形',
  '皮肤色素', '咖啡牛奶斑', '语言迟缓', '说话晚',
  '心脏畸形', '先心病', '走路不稳', '视力下降',
  '肾异常', '肾脏异常', '肌酸激酶', 'CK升高',
]

const PRODUCT_KEYWORDS = [
  '产品', '测序', 'Panel', 'WES', 'WGS', '检测服务', 'CNV',
  'Sanger', 'CMA', '基因检测', '全外显子', '全基因组',
  '基因Panel', '基因芯片', '线粒体测序', '靶向测序',
  '检测项目', '检测方案', '检测产品', '服务价格',
  '报告周期', '检测周期', '基因组学服务',
]

const DISEASE_KEYWORDS = [
  '疾病', '诊断', '什么病', '可能', '疑似', '综合征',
  '遗传病', '罕见病', '什么疾病', '患病', '发病率',
  '鉴别诊断', '确诊', '临床诊断',
]

// Common gene symbols to detect
const GENE_SYMBOLS = [
  'BRCA1', 'BRCA2', 'TP53', 'CFTR', 'DMD', 'NF1', 'RET',
  'FBN1', 'MYH7', 'SCN1A', 'SMN1', 'TSC1', 'TSC2', 'MLH1',
  'MSH2', 'MSH6', 'PMS2', 'APC', 'RB1', 'WT1', 'EGFR',
  'ALK', 'BRAF', 'KRAS', 'PIK3CA', 'CDH1', 'PALB2', 'ATM',
  'CHEK2', 'PTEN', 'STK11',
]

// Variant notation patterns
const VARIANT_PATTERNS = [
  // cDNA notation: c.5266dupC, c.181T>G, c.3356_3357del, etc.
  /\bc\.\d+[A-Z*]?(?:_\d+[A-Z*]?)?(?:dup|del|ins|inv|>[A-Z*])\w*/i,
  // Protein notation: p.Arg1756Profs, p.Cys44Phe, p.(=), etc.
  /\bp\.(?:\([A-Za-z]+\)|[A-Za-z]{3}\d+[A-Za-z]*(?:fs\*?)?(?:Ter)?)\w*/i,
  // gDNA notation: g.12345A>G
  /\bg\.\d+[A-Z]>(?:[A-Z])/i,
  // Exon notation: exon 5, 外显子5
  /(?:exon|外显子)\s*\d+/i,
  // HGVS full format with gene: BRCA1:c.5266dupC
  /[A-Z0-9]+:\s*c\.\w+/i,
  // chr:pos format: chr17:43044295
  /chr\d+:\d+/i,
  // rsID: rs123456
  /\brs\d+\b/i,
]

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function extractGeneSymbol(text: string): string | undefined {
  for (const gene of GENE_SYMBOLS) {
    const regex = new RegExp(`\\b${gene}\\b`, 'i')
    if (regex.test(text)) {
      return gene
    }
  }
  return undefined
}

function extractVariantNotation(text: string): string | undefined {
  for (const pattern of VARIANT_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      return match[0]
    }
  }
  return undefined
}

function countMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase()
  let count = 0
  for (const keyword of keywords) {
    if (lower.includes(keyword.toLowerCase())) {
      count++
    }
  }
  return count
}

export function classifyIntent(userMessage: string): IntentResult {
  const text = userMessage.trim()
  if (!text) {
    return { intent: 'general', confidence: 0.5 }
  }

  const scores: Record<IntentType, number> = {
    variant_interpretation: 0,
    hpo_matching: 0,
    product_recommendation: 0,
    disease_recommendation: 0,
    general: 1, // base score
  }

  // Extract structured data
  const geneSymbol = extractGeneSymbol(text)
  const variantNotation = extractVariantNotation(text)

  // ---- Variant Interpretation ----
  scores.variant_interpretation += countMatches(text, VARIANT_KEYWORDS) * 2
  if (geneSymbol) scores.variant_interpretation += 5
  if (variantNotation) scores.variant_interpretation += 8

  // ---- HPO Matching ----
  scores.hpo_matching += countMatches(text, HPO_KEYWORDS) * 3
  scores.hpo_matching += countMatches(text, SYMPTOM_KEYWORDS) * 2
  // HPO matching is also likely when user describes multiple symptoms
  const symptomCount = countMatches(text, SYMPTOM_KEYWORDS)
  if (symptomCount >= 2) {
    scores.hpo_matching += 4
  }

  // ---- Product Recommendation ----
  scores.product_recommendation += countMatches(text, PRODUCT_KEYWORDS) * 2

  // ---- Disease Recommendation ----
  scores.disease_recommendation += countMatches(text, DISEASE_KEYWORDS) * 2
  // If multiple symptoms but not HPO-specific keywords, still consider disease
  if (symptomCount >= 2 && scores.hpo_matching < 10) {
    scores.disease_recommendation += 3
  }

  // ---- General ----
  // Boost general if it's a greeting or simple question
  const greetings = ['你好', '嗨', 'hi', 'hello', '感谢', '谢谢', '再见']
  if (greetings.some((g) => text.toLowerCase().includes(g))) {
    scores.general += 5
  }

  // Determine winner
  let bestIntent: IntentType = 'general'
  let bestScore = 0
  for (const [intent, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score
      bestIntent = intent as IntentType
    }
  }

  // Calculate confidence (normalized)
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0)
  const confidence = totalScore > 0 ? bestScore / totalScore : 0.5

  // Build extracted data
  const extractedData: Record<string, any> = {}
  if (geneSymbol) extractedData.geneSymbol = geneSymbol
  if (variantNotation) extractedData.variantNotation = variantNotation
  if (bestIntent === 'variant_interpretation' && geneSymbol && variantNotation) {
    extractedData.gene = geneSymbol
    extractedData.variant = variantNotation
  }

  return {
    intent: bestIntent,
    confidence: Math.min(Math.max(confidence, 0.3), 0.99),
    extractedData: Object.keys(extractedData).length > 0 ? extractedData : undefined,
  }
}
