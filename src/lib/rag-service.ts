/**
 * RAG 检索服务
 * 组合 L1 (FTS5 BM25) + L2 (同义词/模糊匹配) + 结构化数据库查询
 * 提供统一的混合检索和上下文构建能力
 */
import { initJieba, tokenizeQuery } from '@/lib/jieba-service'
import { initFts5, fts5Search, Fts5SearchResult } from '@/lib/fts5-init'
import { expandQuery } from '@/lib/synonym-service'
import {
  searchGenes,
  searchDiseases,
  searchHpoTerms,
  searchProducts,
  GeneResult,
  DiseaseResult,
  HpoTermResult,
  ProductResult,
} from '@/lib/knowledge-service'

// ==================== Types ====================

export interface RAGResult {
  structured: {
    genes: GeneResult[]
    diseases: DiseaseResult[]
    hpoTerms: HpoTermResult[]
    products: ProductResult[]
  }
  documents: Fts5SearchResult[]
  ragContext: string
}

// ==================== Initialization Guard ====================

let initialized = false

/**
 * 确保 RAG 服务依赖已初始化（jieba 分词 + FTS5 索引）
 */
async function ensureInitialized() {
  if (initialized) return
  try {
    initJieba()
    await initFts5()
    initialized = true
  } catch (error) {
    console.error('RAG service initialization error:', error)
    // 即使初始化失败也标记为已尝试，避免反复重试
    initialized = true
  }
}

// ==================== Core Functions ====================

/**
 * 混合搜索：结合同义词扩展 (L2) + FTS5 BM25 全文搜索 (L1)
 *
 * 流程：
 * 1. 使用同义词服务扩展查询词
 * 2. 使用 jieba 对扩展查询进行分词
 * 3. 使用 FTS5 BM25 进行全文搜索
 * 4. 返回带有来源类型标签的搜索结果
 *
 * @param query - 用户搜索查询
 * @param options - 搜索选项
 * @returns FTS5 搜索结果数组
 */
export async function hybridSearch(
  query: string,
  options?: { limit?: number; documentTypes?: string[] }
): Promise<Fts5SearchResult[]> {
  if (!query || query.trim().length === 0) return []

  await ensureInitialized()

  const limit = options?.limit ?? 10
  const documentTypes = options?.documentTypes

  try {
    // Step 1: 同义词扩展 (L2)
    const expandedQuery = await expandQuery(query)

    // Step 2: jieba 分词
    const tokenizedQuery = tokenizeQuery(expandedQuery)

    if (!tokenizedQuery || tokenizedQuery.trim().length === 0) {
      // 降级：直接使用原始查询分词
      const fallbackTokenized = tokenizeQuery(query)
      if (!fallbackTokenized || fallbackTokenized.trim().length === 0) return []
      return fts5Search(fallbackTokenized, limit)
    }

    // Step 3: FTS5 BM25 全文搜索 (L1)
    const results = await fts5Search(tokenizedQuery, limit)

    // Step 4: 按文档类型过滤（如果指定）
    if (documentTypes && documentTypes.length > 0) {
      return results.filter((r) =>
        documentTypes.some((t) => r.documentType === t)
      )
    }

    return results
  } catch (error) {
    console.error('hybridSearch error:', error)
    // 降级：直接用原始查询搜索
    try {
      return await fts5Search(tokenizeQuery(query), limit)
    } catch {
      return []
    }
  }
}

/**
 * 构建 RAG 上下文字符串，用于注入到 LLM 提示中
 * 将搜索结果格式化为带来源引用的 Markdown
 *
 * @param query - 用户查询
 * @param maxChunks - 最大 chunk 数量（默认 8，控制 LLM 上下文长度）
 * @returns 格式化的 Markdown 上下文字符串
 */
export async function buildRagContext(
  query: string,
  maxChunks: number = 8
): Promise<string> {
  if (!query || query.trim().length === 0) return ''

  try {
    const results = await hybridSearch(query, { limit: maxChunks })

    if (results.length === 0) {
      return ''
    }

    const sections: string[] = []

    for (let i = 0; i < Math.min(results.length, maxChunks); i++) {
      const r = results[i]

      // 构建来源信息
      const sourceParts: string[] = []
      if (r.documentName) sourceParts.push(`文档: ${r.documentName}`)
      if (r.pageNumber) sourceParts.push(`第${r.pageNumber}页`)
      if (r.sheetName) sourceParts.push(`工作表: ${r.sheetName}`)
      if (r.sectionTitle) sourceParts.push(`章节: ${r.sectionTitle}`)

      const sourceInfo = sourceParts.length > 0
        ? ` [${sourceParts.join(' | ')}]`
        : ''

      // 使用 snippet（高亮片段）或 content
      const content = r.snippet || r.content || ''

      sections.push(`[来源${i + 1}]${sourceInfo}\n${content}`)
    }

    const context = `参考资料：\n${'---\n'.join(sections)}`
    return context
  } catch (error) {
    console.error('buildRagContext error:', error)
    return ''
  }
}

/**
 * 统一知识库搜索：同时搜索结构化数据和非结构化文档
 * 并行执行结构化搜索和文档搜索，返回合并结果
 *
 * @param query - 用户查询
 * @returns 包含结构化搜索结果、文档搜索结果和 RAG 上下文的完整结果
 */
export async function searchKnowledgeBase(query: string): Promise<RAGResult> {
  if (!query || query.trim().length === 0) {
    return {
      structured: {
        genes: [],
        diseases: [],
        hpoTerms: [],
        products: [],
      },
      documents: [],
      ragContext: '',
    }
  }

  await ensureInitialized()

  try {
    // 并行执行所有搜索
    const [genes, diseases, hpoTerms, products, documents, ragContext] =
      await Promise.all([
        searchGenes(query).catch(() => [] as GeneResult[]),
        searchDiseases(query).catch(() => [] as DiseaseResult[]),
        searchHpoTerms(query).catch(() => [] as HpoTermResult[]),
        searchProducts(query).catch(() => [] as ProductResult[]),
        hybridSearch(query).catch(() => [] as Fts5SearchResult[]),
        buildRagContext(query).catch(() => ''),
      ])

    return {
      structured: {
        genes,
        diseases,
        hpoTerms,
        products,
      },
      documents,
      ragContext,
    }
  } catch (error) {
    console.error('searchKnowledgeBase error:', error)
    return {
      structured: {
        genes: [],
        diseases: [],
        hpoTerms: [],
        products: [],
      },
      documents: [],
      ragContext: '',
    }
  }
}
