/**
 * jieba 中文分词服务
 * 支持自定义医学专业词典，用于 FTS5 索引前分词
 */
import path from 'path'

// 医学专业词典路径
const MEDICAL_DICT_PATH = path.join(process.cwd(), 'data', 'medical_dict.txt')

let isLoaded = false
let jiebaModule: any = null
let jiebaLoadAttempted = false

/**
 * 延迟加载 nodejieba，处理原生模块不可用的情况
 * 使用完全动态路径避免 Turbopack 静态解析
 */
function getJieba(): any | null {
  if (jiebaLoadAttempted) return jiebaModule
  jiebaLoadAttempted = true

  try {
    // Dynamic require for native nodejieba module to avoid Turbopack static analysis
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    jiebaModule = require('nodejieba')
  } catch {
    console.warn('nodejieba is not available. Using fallback tokenization.')
    jiebaModule = null
  }
  return jiebaModule
}

/**
 * 初始化 jieba，加载自定义医学词典
 */
export function initJieba() {
  if (isLoaded) return

  const jieba = getJieba()
  if (!jieba) {
    isLoaded = true
    return
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs')
    if (fs.existsSync(MEDICAL_DICT_PATH)) {
      jieba.load({ userDict: MEDICAL_DICT_PATH })
      console.log('Jieba loaded with custom medical dictionary')
    }
  } catch {
    console.log('Jieba initialized (no custom dict found, using defaults)')
  }

  isLoaded = true
}

/**
 * 精确分词模式
 * 返回分词结果数组
 */
export function cut(text: string): string[] {
  const jieba = getJieba()
  if (jieba) {
    try {
      return jieba.cut(text) as string[]
    } catch {
      // fall through
    }
  }
  // fallback: 按空格和标点分割
  return text.split(/[\s,，。.!！?？;；:：、\n\r\t]+/).filter(Boolean)
}

/**
 * 搜索引擎模式分词
 * 对长词会再拆分，适合搜索场景
 */
export function cutForSearch(text: string): string[] {
  const jieba = getJieba()
  if (jieba) {
    try {
      return jieba.cutForSearch(text) as string[]
    } catch {
      // fall through
    }
  }
  return cut(text)
}

/**
 * 关键词提取
 * 基于 TF-IDF 算法提取文本中的关键词
 */
export function extractKeywords(text: string, topN: number = 10): string[] {
  const jieba = getJieba()
  if (jieba) {
    try {
      return jieba.extract(text, topN) as string[]
    } catch {
      // fall through
    }
  }
  return cut(text).slice(0, topN)
}

/**
 * 对文本进行分词并返回空格连接的字符串（用于 FTS5 索引）
 * 过滤掉标点符号和单字符停用词
 */
export function tokenizeForFts5(text: string): string {
  // 对搜索模式分词，获取更细粒度的词
  const words = cutForSearch(text)

  // 过滤停用词和标点
  const stopwords = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
    '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着',
    '没有', '看', '好', '自己', '这', '他', '她', '它', '们', '那',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
    'under', 'again', 'further', 'then', 'once', 'and', 'but', 'or', 'nor',
    'not', 'so', 'if', 'than', 'too', 'very', 'just', 'because', 'about',
  ])

  const filtered = words.filter((w) => {
    // 保留：英文单词、数字、长度>=2的中文词、基因名格式（如BRCA1）
    if (/^[a-zA-Z0-9]/.test(w)) return true // 英文/数字保留
    if (/^[\u4e00-\u9fa5]{2,}$/.test(w)) return true // 中文词>=2字保留
    return false
  })

  return filtered.join(' ')
}

/**
 * 对查询词进行分词，用于 FTS5 搜索
 * 与 tokenizeForFts5 类似但保留更多词以匹配
 */
export function tokenizeQuery(query: string): string {
  const words = cutForSearch(query)
  const filtered = words.filter((w) => {
    if (/^[a-zA-Z0-9]/.test(w)) return true
    if (/^[\u4e00-\u9fa5]{2,}$/.test(w)) return true
    if (/^[\u4e00-\u9fa5]$/.test(w)) return false // 单字中文过滤（除非是特殊字）
    return true
  })
  return filtered.join(' ')
}
