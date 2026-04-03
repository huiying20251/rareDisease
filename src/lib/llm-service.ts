import ZAI from 'z-ai-web-dev-sdk'
import type { IntentType } from './intent-classifier'

// ==================== Types ====================

export interface LlmMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface LlmResponse {
  content: string
  intent: IntentType
  metadata?: Record<string, any>
}

// ==================== System Prompts ====================

const FENCE = '```'

const BASE_SYSTEM_PROMPT = `你是 RareHelper（罕见病智能解读助手），一个专业的基因组学和罕见病智能问答助手。你具备以下专业知识：

1. **基因变异解读**：精通ACMG/AMP变异致病性分类标准（Pathogenic、Likely Pathogenic、VUS、Likely Benign、Benign）
2. **临床表型分析**：熟悉人类表型本体（HPO）术语体系，能准确匹配临床表型
3. **遗传病知识**：掌握罕见遗传病的临床表现、遗传方式、诊断策略
4. **基因检测产品**：了解各类基因检测产品（Panel、WES、WGS、CNV等）的适用场景

请遵守以下规则：
- 所有回复使用中文
- 回答要专业、准确、有条理
- 对于不确定的信息，明确告知用户
- 建议仅供参考，最终的诊断和检测方案应由专业医生决定
- 使用 Markdown 格式化回复（加粗、列表等）
- 避免过于技术化的术语，必要时提供通俗解释`

const VARIANT_JSON_EXAMPLE = `${FENCE}json
{
  "gene": "基因符号",
  "variant": "变异位点",
  "classification": "ACMG分类",
  "evidenceLevel": "证据等级（强/中等/支持）",
  "details": "简要说明"
}
${FENCE}`

const HPO_JSON_EXAMPLE = `${FENCE}json
{
  "matchedTerms": [
    { "hpoId": "HP:XXXXXXX", "name": "表型名称", "score": 0.95 }
  ],
  "summary": "匹配总结"
}
${FENCE}`

const PRODUCT_JSON_EXAMPLE = `${FENCE}json
{
  "products": [
    { "name": "产品名称", "category": "产品类别", "description": "产品描述" }
  ],
  "recommendation": "推荐总结"
}
${FENCE}`

const DISEASE_JSON_EXAMPLE = `${FENCE}json
{
  "diseases": [
    { "name": "疾病名称", "omimId": "OMIM编号", "score": 92 }
  ],
  "matchedSymptoms": ["匹配的症状列表"]
}
${FENCE}`

const INTENT_PROMPTS: Record<IntentType, string> = {
  variant_interpretation: `当前用户请求的是**基因变异致病性解读**。

你将收到来自多源数据库整合的参考资料，包括：
- **VEP 变异注释**：Ensembl VEP 提供的基因、转录本、HGVS 命名、变异后果、功能预测分数（SIFT、PolyPhen、CADD、REVEL、SpliceAI）等
- **ClinVar 临床意义**：NCBI ClinVar 数据库中的临床致病性判定、审核状态、相关疾病
- **gnomAD 人群频率**：gnomAD 数据库中的等位基因频率（全球、Popmax、东亚等）
- **ACMG 致病性分类结果**：基于 ACMG/AMP 规则引擎自动计算的致病性分类，包括已应用的规则及其证据强度

请按照以下结构回复（基于参考资料中的真实数据）：
1. **变异基本信息**：基因、变异位点、变异类型（如移码、错义、剪接等）、转录本信息
2. **ACMG 致病性分类**：明确引用参考资料中的 ACMG 分类结果，逐条解释已应用的规则及其判定依据
3. **数据库交叉验证**：
   - ClinVar 中的临床意义与 ACMG 结果是否一致
   - gnomAD 频率数据对分类的影响（如 PM2: 在人群中极为罕见）
   - 功能预测分数（SIFT、PolyPhen、CADD、REVEL 等）的解读
4. **临床意义**：该变异与相关疾病的关系，引用 ClinVar 中记录的疾病
5. **建议**：后续验证或遗传咨询建议

**重要规则**：
- 必须基于参考资料中的真实数据进行解读，不要编造数据
- 如果参考资料中有 ACMG 分类结果，必须优先引用该结果
- 如果参考资料中仅有部分数据（如只有基因信息，没有完整变异注释），请明确说明哪些分析无法完成
- 如果参考资料为空，请说明需要提供基因组坐标（VCF 格式或 rsID）才能执行自动分类
- 每个已应用的 ACMG 规则都要用通俗语言解释其含义和适用原因

请在回复末尾附加一段 JSON 格式的结构化数据（用 ${FENCE}json 代码块包裹），格式如下：
${VARIANT_JSON_EXAMPLE}`,

  hpo_matching: `当前用户请求的是**临床表型匹配**（HPO Matching）。

请按照以下结构回复：
1. **识别到的表型**：从用户描述中提取的临床表型
2. **匹配的HPO术语**：每个匹配的HPO术语及其ID、名称、匹配度说明
3. **表型分析**：这些表型组合可能提示的疾病方向
4. **建议**：进一步表型描述或检测建议

请在回复末尾附加一段 JSON 格式的结构化数据（用 ${FENCE}json 代码块包裹），格式如下：
${HPO_JSON_EXAMPLE}`,

  product_recommendation: `当前用户请求的是**基因检测产品推荐**。

请按照以下结构回复：
1. **需求分析**：根据用户描述的临床情况，分析检测需求
2. **推荐产品**：列出适合的检测产品，包括名称、类别、特点
3. **方案对比**：简要对比不同方案的优缺点
4. **建议**：推荐优先选择的方案及理由

请在回复末尾附加一段 JSON 格式的结构化数据（用 ${FENCE}json 代码块包裹），格式如下：
${PRODUCT_JSON_EXAMPLE}`,

  disease_recommendation: `当前用户请求的是**疾病推荐**（基于症状的鉴别诊断建议）。

请按照以下结构回复：
1. **症状总结**：归纳用户描述的症状/表型
2. **可能疾病列表**：按可能性排序，列出可能的疾病，包括名称、OMIM ID、遗传方式
3. **匹配分析**：每个疾病与用户症状的匹配程度
4. **建议**：推荐的进一步检查或检测方案

请在回复末尾附加一段 JSON 格式的结构化数据（用 ${FENCE}json 代码块包裹），格式如下：
${DISEASE_JSON_EXAMPLE}`,

  general: '',
}

// ==================== LLM Service ====================

const MAX_HISTORY_MESSAGES = 20
const MAX_RETRIES = 3

function getSystemPrompt(intent: IntentType): string {
  const intentPrompt = INTENT_PROMPTS[intent]
  if (intent === 'general' || !intentPrompt) {
    return BASE_SYSTEM_PROMPT
  }
  return `${BASE_SYSTEM_PROMPT}\n\n${intentPrompt}`
}

/**
 * Extract JSON block from LLM response text
 */
function extractJsonBlock(text: string): Record<string, any> | undefined {
  // Try to find a ```json code block
  const jsonBlockRegex = /```json\s*\n?([\s\S]*?)\n?```/
  const match = text.match(jsonBlockRegex)
  if (match?.[1]) {
    try {
      return JSON.parse(match[1].trim()) as Record<string, any>
    } catch {
      // fall through
    }
  }

  // Try to find any JSON object in the text
  const jsonObjectRegex = /\{[\s\S]*\}/
  const jsonMatch = text.match(jsonObjectRegex)
  if (jsonMatch?.[0]) {
    try {
      return JSON.parse(jsonMatch[0]) as Record<string, any>
    } catch {
      // fall through
    }
  }

  return undefined
}

/**
 * Clean the response by removing the JSON block from the text
 */
function cleanResponse(text: string): string {
  return text.replace(/```json\s*\n?[\s\S]*?\n?```/g, '').trim()
}

/**
 * Send a chat completion request to the LLM
 */
async function callLlm(
  messages: LlmMessage[],
  systemPrompt: string
): Promise<string> {
  const zai = await ZAI.create()

  const apiMessages = [
    { role: 'assistant' as const, content: systemPrompt },
    ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ]

  const completion = await zai.chat.completions.create({
    messages: apiMessages,
    thinking: { type: 'disabled' },
  })

  const response = completion.choices[0]?.message?.content
  if (!response) {
    throw new Error('LLM returned empty response')
  }

  return response
}

/**
 * Delay utility for exponential backoff
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Main LLM service function
 * @param userMessage - The user's message
 * @param intent - The classified intent
 * @param history - Previous conversation messages
 * @param knowledgeContext - Optional knowledge base context to include
 * @returns Structured response with content and metadata
 */
export async function generateLlmResponse(
  userMessage: string,
  intent: IntentType,
  history: LlmMessage[],
  knowledgeContext?: string
): Promise<LlmResponse> {
  const systemPrompt = getSystemPrompt(intent)

  // Build the full message history, keeping only recent messages
  const recentHistory = history.slice(-MAX_HISTORY_MESSAGES)

  // If there's knowledge context, prepend it to the user message
  let enhancedUserMessage = userMessage
  if (knowledgeContext) {
    enhancedUserMessage = `[参考资料]\n${knowledgeContext}\n\n[用户问题]\n${userMessage}`
  }

  const messages: LlmMessage[] = [...recentHistory, { role: 'user', content: enhancedUserMessage }]

  // Retry with exponential backoff
  let lastError: Error | null = null
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const rawResponse = await callLlm(messages, systemPrompt)

      // Extract structured metadata if it's a specialized intent
      let metadata: Record<string, any> | undefined
      if (intent !== 'general') {
        metadata = extractJsonBlock(rawResponse)
      }

      const content = cleanResponse(rawResponse)

      return {
        content,
        intent,
        metadata,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < MAX_RETRIES - 1) {
        await delay(Math.pow(2, attempt) * 1000) // 1s, 2s, 4s
      }
    }
  }

  // All retries failed
  return {
    content: `抱歉，在生成回复时遇到了技术问题。请稍后重试。\n\n错误信息：${lastError?.message ?? '未知错误'}`,
    intent: 'general',
  }
}
