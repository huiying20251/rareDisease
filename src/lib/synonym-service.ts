/**
 * 同义词/模糊匹配服务 (L2 层)
 * 提供术语的同义词查找、查询扩展和种子数据生成
 */
import { db } from '@/lib/db'
import { cut } from '@/lib/jieba-service'

// ==================== Types ====================

export interface SynonymEntry {
  term: string
  canonical: string
  category: string
}

// ==================== Helper Functions ====================

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

// ==================== Core Functions ====================

/**
 * 查询同义词表，获取规范词形式
 * 支持精确匹配（不区分大小写）和前缀匹配
 * @param term - 要查询的术语
 * @returns 匹配的同义词条目数组
 */
export async function getSynonyms(term: string): Promise<SynonymEntry[]> {
  if (!term || term.trim().length === 0) return []

  const trimmed = term.trim()
  const lowerTerm = trimmed.toLowerCase()

  try {
    // 精确匹配（不区分大小写）
    const exactMatches = await db.synonym.findMany({
      where: {
        term: lowerTerm,
      },
      select: {
        term: true,
        canonical: true,
        category: true,
      },
    })

    // 前缀匹配（用于部分术语查询）
    const prefixMatches = await db.synonym.findMany({
      where: {
        term: {
          startsWith: lowerTerm,
        },
      },
      select: {
        term: true,
        canonical: true,
        category: true,
      },
      take: 20,
    })

    // 合并去重：精确匹配优先
    const seen = new Set<string>()
    const results: SynonymEntry[] = []

    for (const match of [...exactMatches, ...prefixMatches]) {
      const key = `${match.term}|${match.canonical}`
      if (!seen.has(key)) {
        seen.add(key)
        results.push({
          term: match.term,
          canonical: match.canonical,
          category: match.category,
        })
      }
    }

    return results
  } catch (error) {
    console.error('getSynonyms error:', error)
    return []
  }
}

/**
 * 使用同义词扩展用户查询
 * 对查询进行分词，为每个词查找同义词，返回包含原始词和同义词的扩展查询
 * @param query - 用户输入的查询字符串
 * @returns 扩展后的查询字符串（空格分隔的词）
 */
export async function expandQuery(query: string): Promise<string> {
  if (!query || query.trim().length === 0) return ''

  try {
    // 使用 jieba 分词
    const tokens = cut(query).filter((t) => t.trim().length > 0)

    const expandedTerms = new Set<string>()

    for (const token of tokens) {
      // 添加原始词
      const lowerToken = token.toLowerCase()
      expandedTerms.add(lowerToken)

      // 查找同义词
      const synonyms = await getSynonyms(token)
      for (const syn of synonyms) {
        expandedTerms.add(syn.canonical.toLowerCase())
        // 也添加同义词表中的 term 本身（可能是不同的别名写法）
        if (syn.term !== lowerToken) {
          expandedTerms.add(syn.term.toLowerCase())
        }
      }
    }

    return Array.from(expandedTerms).join(' ')
  } catch (error) {
    console.error('expandQuery error:', error)
    // 降级：返回原始查询
    return query.trim()
  }
}

/**
 * 从现有结构化数据生成同义词种子数据
 * 用于初始化时批量填充 Synonym 表
 *
 * 数据来源：
 * - Gene 记录 → geneSymbol 作为 canonical，小写变体作为 term
 * - Disease 记录 → 解析 aliases JSON，每个别名映射到疾病名称
 * - HpoTerm 记录 → 解析 synonyms JSON，每个同义词映射到 HPO 名称
 *
 * @returns 同义词条目数组，用于批量插入
 */
export async function buildSynonymSeedData(): Promise<SynonymEntry[]> {
  const entries: SynonymEntry[] = []
  const seen = new Set<string>() // 去重：term|canonical|category

  function addEntry(term: string, canonical: string, category: string) {
    const trimmedTerm = term.trim().toLowerCase()
    const trimmedCanonical = canonical.trim()
    if (!trimmedTerm || !trimmedCanonical) return
    if (trimmedTerm === trimmedCanonical.toLowerCase()) return

    const key = `${trimmedTerm}|${trimmedCanonical}|${category}`
    if (seen.has(key)) return
    seen.add(key)

    entries.push({
      term: trimmedTerm,
      canonical: trimmedCanonical,
      category,
    })
  }

  try {
    // 1. 从 Gene 记录生成同义词
    const genes = await db.gene.findMany({
      select: { geneSymbol: true, fullName: true },
    })

    for (const gene of genes) {
      // geneSymbol 作为 canonical，小写变体作为 term
      addEntry(gene.geneSymbol.toLowerCase(), gene.geneSymbol, 'gene')

      // fullName 也作为别名映射到 geneSymbol
      if (gene.fullName) {
        addEntry(gene.fullName.toLowerCase(), gene.geneSymbol, 'gene')
      }
    }

    // 2. 从 Disease 记录生成同义词
    const diseases = await db.disease.findMany({
      select: { name: true, aliases: true },
    })

    for (const disease of diseases) {
      // 疾病名自身的小写作为 term
      addEntry(disease.name.toLowerCase(), disease.name, 'disease')

      // 解析 aliases JSON
      const aliases = safeJsonParse<string[]>(disease.aliases, [])
      for (const alias of aliases) {
        addEntry(alias.toLowerCase(), disease.name, 'disease')
      }
    }

    // 3. 从 HpoTerm 记录生成同义词
    const hpoTerms = await db.hpoTerm.findMany({
      select: { name: true, synonyms: true, hpoId: true },
    })

    for (const hpo of hpoTerms) {
      // HPO 名称自身的小写作为 term
      addEntry(hpo.name.toLowerCase(), hpo.name, 'hpo')

      // HPO ID 作为别名映射到名称
      addEntry(hpo.hpoId.toLowerCase(), hpo.name, 'hpo')

      // 解析 synonyms JSON
      const synonyms = safeJsonParse<string[]>(hpo.synonyms, [])
      for (const syn of synonyms) {
        addEntry(syn.toLowerCase(), hpo.name, 'hpo')
      }
    }

    console.log(`Built ${entries.length} synonym seed entries`)
    return entries
  } catch (error) {
    console.error('buildSynonymSeedData error:', error)
    return entries
  }
}

/**
 * 批量插入同义词数据到数据库
 * 使用 createMany 进行高效批量插入，跳过重复项
 * @param entries - 同义词条目数组
 */
export async function seedSynonyms(entries: SynonymEntry[]): Promise<number> {
  if (entries.length === 0) return 0

  try {
    // 使用 createMany 批量插入，跳过已存在的项
    const result = await db.synonym.createMany({
      data: entries,
      skipDuplicates: true,
    })

    console.log(`Seeded ${result.count} synonym entries (skipped duplicates)`)
    return result.count
  } catch (error) {
    console.error('seedSynonyms error:', error)
    return 0
  }
}
