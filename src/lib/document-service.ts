/**
 * 文档处理服务
 * 支持 PDF 和 Excel 文档的解析、智能分块与向量化准备
 * 服务端专用模块（不使用 'use client'）
 */

import fs from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import { tokenizeForFts5, initJieba } from '@/lib/jieba-service'

// ==================== 类型定义 ====================

/** PDF 解析后的单页结果 */
interface PdfPage {
  pageNumber: number
  text: string
}

/** PDF 解析完整结果 */
interface PdfParseResult {
  pages: PdfPage[]
  metadata: {
    title?: string
    author?: string
    creator?: string
    producer?: string
    creationDate?: string
    pageCount: number
  }
}

/** Excel 单行自然语言描述 */
interface ExcelRowDescription {
  rowIndex: number
  description: string
}

/** Excel Sheet 解析结果 */
interface ExcelSheetResult {
  sheetName: string
  headers: string[]
  rows: ExcelRowDescription[]
  fullText: string
}

/** Excel 解析完整结果 */
interface ExcelParseResult {
  sheets: ExcelSheetResult[]
  metadata: {
    sheetCount: number
    sheetNames: string[]
  }
}

/** 文本块数据 */
interface TextChunk {
  content: string
  pageNumber?: number
  sheetName?: string
  sectionTitle?: string
  chunkMetadata: Record<string, unknown>
}

// ==================== 配置常量 ====================

const CHUNK_SIZE = 2000
const CHUNK_OVERLAP_RATIO = 0.15
const CHUNK_OVERLAP = Math.floor(CHUNK_SIZE * CHUNK_OVERLAP_RATIO) // 300

// ==================== 工具函数 ====================

/**
 * 格式化文件大小为人类可读字符串
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const size = bytes / Math.pow(k, i)
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

// ==================== PDF 解析 ====================

/**
 * 解析 PDF 文件，提取逐页文本
 */
async function parsePdf(filePath: string): Promise<PdfParseResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse')
  const dataBuffer = fs.readFileSync(filePath)

  const result = await pdfParse(dataBuffer)

  // pdf-parse 返回 numpages, text (全文), info 等
  const text = result.text || ''
  const numpages = result.numpages || 0
  const info = result.info || {}

  // 按分页符分割文本为每页内容
  const pageTexts = text.split(/\f/).filter((p: string) => p.trim().length > 0)

  const pages: PdfPage[] = pageTexts.map((pageText: string, index: number) => ({
    pageNumber: index + 1,
    text: pageText.trim(),
  }))

  // 如果页面分割失败（某些 PDF 没有 \f 分页符），将全文作为单页
  if (pages.length === 0 && text.trim().length > 0) {
    pages.push({
      pageNumber: 1,
      text: text.trim(),
    })
  }

  return {
    pages,
    metadata: {
      title: info.Title || undefined,
      author: info.Author || undefined,
      creator: info.Creator || undefined,
      producer: info.Producer || undefined,
      creationDate: info.CreationDate || undefined,
      pageCount: numpages,
    },
  }
}

// ==================== Excel 解析 ====================

/**
 * 检测单元格是否为表头（第一行或看起来像表头）
 */
function isHeaderRow(row: Record<string, unknown>[], rowIndex: number): boolean {
  if (rowIndex !== 0) return false
  const values = Object.values(row[0] || {})
  return values.every((v) => typeof v === 'string' && v.trim().length > 0 && v.trim().length < 50)
}

/**
 * 将一行数据转换为自然语言描述
 * 例如: "BRCA1 gene, mutation c.5266dupC, ACMG Pathogenic"
 */
function rowToDescription(headers: string[], rowValues: unknown[]): string {
  const parts: string[] = []

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]
    const value = rowValues[i]
    if (value === undefined || value === null || String(value).trim() === '') continue

    const strValue = String(value).trim()
    parts.push(`${header}: ${strValue}`)
  }

  return parts.join(', ')
}

/**
 * 解析 Excel 文件，将每个 Sheet 转为自然语言描述
 */
async function parseExcel(filePath: string): Promise<ExcelParseResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx')
  const workbook = XLSX.readFile(filePath, { type: 'file' })
  const sheetNames = workbook.SheetNames

  const sheets: ExcelSheetResult[] = []

  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName]

    // 转为 JSON 数组（header: 1 使用第一行作为 key）
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: '',
    })

    if (jsonData.length === 0) {
      sheets.push({
        sheetName,
        headers: [],
        rows: [],
        fullText: `Sheet "${sheetName}" 为空`,
      })
      continue
    }

    // 提取表头
    const headers = Object.keys(jsonData[0])

    // 将每行转为自然语言描述
    const rows: ExcelRowDescription[] = jsonData.map((row, index) => ({
      rowIndex: index + 1, // 1-based
      description: rowToDescription(headers, headers.map((h) => row[h])),
    }))

    // 构建完整文本（包含表头行和描述行）
    const headerLine = `表头: ${headers.join(' | ')}`
    const rowLines = rows.map((r) => `[行${r.rowIndex}] ${r.description}`)
    const fullText = [headerLine, ...rowLines].join('\n')

    sheets.push({
      sheetName,
      headers,
      rows,
      fullText,
    })
  }

  return {
    sheets,
    metadata: {
      sheetCount: sheetNames.length,
      sheetNames,
    },
  }
}

// ==================== 智能分块 ====================

/**
 * 检测文本是否为表格（包含多个 | 或制表符分隔模式）
 */
function isTableText(text: string): boolean {
  const lines = text.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length < 2) return false

  // 检查是否有至少 3 行包含 |（Markdown 表格格式）
  const pipeLines = lines.filter((l) => l.includes('|'))
  if (pipeLines.length >= 3) return true

  // 检查制表符分隔（至少 3 行，每行有 2+ 个制表符）
  const tabLines = lines.filter((l) => (l.match(/\t/g) || []).length >= 2)
  if (tabLines.length >= 3) return true

  return false
}

/**
 * 将表格文本转为自然语言描述
 * 支持 Markdown 表格和制表符分隔表格
 */
function tableToNaturalLanguage(tableText: string): string {
  const lines = tableText.split('\n').filter((l) => l.trim().length > 0)

  if (lines.length === 0) return tableText

  // 检测分隔符类型
  const separator = lines[0].includes('|') ? '|' : '\t'

  // 解析表头（跳过 Markdown 分隔行如 |---|---|）
  const headerLine = lines[0]
  let headers = headerLine.split(separator).map((h) => h.trim()).filter(Boolean)
  let dataStartIndex = 1

  // 检查第二行是否是 Markdown 分隔行
  if (lines.length > 1 && /^[|\-:\s]+$/.test(lines[1].trim())) {
    dataStartIndex = 2
  }

  // 构建描述行
  const descriptions: string[] = [`表格包含字段: ${headers.join(', ')}`]

  for (let i = dataStartIndex; i < lines.length; i++) {
    const cells = lines[i].split(separator).map((c) => c.trim()).filter(Boolean)
    if (cells.length === 0) continue

    const parts: string[] = []
    for (let j = 0; j < Math.min(headers.length, cells.length); j++) {
      if (cells[j]) {
        parts.push(`${headers[j]}: ${cells[j]}`)
      }
    }
    if (parts.length > 0) {
      descriptions.push(`- ${parts.join(', ')}`)
    }
  }

  return descriptions.join('\n')
}

/**
 * 从文本中提取章节标题（基于常见标题模式）
 */
function extractSectionTitle(text: string): string | undefined {
  // 匹配中文数字标题: 一、二、三、或 第X章
  const cnNumberMatch = text.match(/^[\s]*[一二三四五六七八九十]+[、.．]/m)
  if (cnNumberMatch) return text.substring(0, text.indexOf(cnNumberMatch[0]) + cnNumberMatch[0].length).trim()

  // 匹配 Markdown 标题: # ## ###
  const mdMatch = text.match(/^#{1,6}\s+(.+)$/m)
  if (mdMatch) return mdMatch[1].trim()

  // 匹配数字编号: 1. 1.1 1.1.1
  const numMatch = text.match(/^\s*\d+(?:\.\d+)*[.．、]\s*(.{1,50})/m)
  if (numMatch) return numMatch[1].trim()

  return undefined
}

/**
 * 将文本按优先级分割：段落(\n\n) → 行(\n) → 句子边界
 * 确保单个片段不超过 maxLen 字符
 */
function splitTextSmart(text: string, maxLen: number): string[] {
  // 先尝试按段落分割
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0)

  const segments: string[] = []

  for (const para of paragraphs) {
    if (para.length <= maxLen) {
      segments.push(para.trim())
      continue
    }

    // 段落太长，按行分割
    const lines = para.split('\n').filter((l) => l.trim().length > 0)
    let currentSegment = ''

    for (const line of lines) {
      if (currentSegment.length + line.length + 1 <= maxLen) {
        currentSegment = currentSegment ? `${currentSegment}\n${line}` : line
      } else {
        if (currentSegment) {
          segments.push(currentSegment.trim())
        }
        // 单行也超长，按句子分割
        if (line.length > maxLen) {
          const sentences = splitBySentences(line, maxLen)
          segments.push(...sentences)
          currentSegment = ''
        } else {
          currentSegment = line
        }
      }
    }

    if (currentSegment) {
      segments.push(currentSegment.trim())
    }
  }

  return segments.filter((s) => s.trim().length > 0)
}

/**
 * 按句子边界分割过长的文本
 * 中文句号、英文句号、问号、感叹号等
 */
function splitBySentences(text: string, maxLen: number): string[] {
  const sentences: string[] = []
  // 在标点处断开，保留标点在前一句
  const sentenceRegex = /[^。！？.!?\n]+[。！？.!?]*/g
  let match: RegExpExecArray | null
  let buffer = ''

  while ((match = sentenceRegex.exec(text)) !== null) {
    const sentence = match[0].trim()
    if (!sentence) continue

    if (buffer.length + sentence.length <= maxLen) {
      buffer = buffer ? `${buffer}${sentence}` : sentence
    } else {
      if (buffer) sentences.push(buffer)
      // 如果单个句子也超长，强制截断
      if (sentence.length > maxLen) {
        sentences.push(sentence.substring(0, maxLen))
        buffer = sentence.substring(maxLen)
      } else {
        buffer = sentence
      }
    }
  }

  if (buffer) sentences.push(buffer)

  // 如果没有任何匹配（无标点），强制按 maxLen 分割
  if (sentences.length === 0 && text.trim().length > 0) {
    for (let i = 0; i < text.length; i += maxLen) {
      sentences.push(text.substring(i, i + maxLen))
    }
  }

  return sentences.filter((s) => s.trim().length > 0)
}

/**
 * 智能文本分块主函数
 * - chunkSize: ~2000 字符（适合密集医学文本）
 * - overlap: 15%
 * - 按段落 → 行 → 句子 的优先级分割
 * - 表格自动检测并转为自然语言
 * - 保留页码、Sheet名、章节标题等元信息
 */
function chunkText(
  text: string,
  options: {
    pageNumber?: number
    sheetName?: string
    sectionTitle?: string
  } = {}
): TextChunk[] {
  const { pageNumber, sheetName, sectionTitle } = options
  const chunks: TextChunk[] = []

  if (!text || text.trim().length === 0) return chunks

  const processedText = text.trim()

  // 检测是否为表格文本
  const isTable = isTableText(processedText)
  const textToChunk = isTable ? tableToNaturalLanguage(processedText) : processedText

  // 分割为小段
  const segments = splitTextSmart(textToChunk, CHUNK_SIZE)

  // 合并小段为符合大小要求的块
  let currentChunk = ''
  let currentSectionTitle = sectionTitle

  for (const segment of segments) {
    // 尝试提取章节标题
    const segTitle = extractSectionTitle(segment)
    if (segTitle) {
      currentSectionTitle = segTitle
    }

    // 如果当前块为空或添加后不超限，直接加入
    if (!currentChunk) {
      currentChunk = segment
    } else if (currentChunk.length + segment.length + 2 <= CHUNK_SIZE) {
      currentChunk = `${currentChunk}\n\n${segment}`
    } else {
      // 保存当前块
      if (currentChunk.trim().length > 0) {
        chunks.push({
          content: currentChunk.trim(),
          pageNumber,
          sheetName,
          sectionTitle: currentSectionTitle,
          chunkMetadata: {
            isTable,
            charCount: currentChunk.length,
          },
        })
      }

      // 处理重叠：从当前块的末尾取 overlap 字符作为新块开头
      if (currentChunk.length > CHUNK_OVERLAP) {
        const overlapText = currentChunk.substring(currentChunk.length - CHUNK_OVERLAP)
        currentChunk = `${overlapText}\n\n${segment}`
      } else {
        currentChunk = segment
      }
    }
  }

  // 保存最后一个块
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      pageNumber,
      sheetName,
      sectionTitle: currentSectionTitle,
      chunkMetadata: {
        isTable,
        charCount: currentChunk.length,
      },
    })
  }

  return chunks
}

// ==================== 主处理管线 ====================

/**
 * 处理文档：解析 → 分块 → 分词 → 存储
 * 这是文档知识库的核心处理函数
 */
export async function processDocument(docId: string): Promise<void> {
  // 初始化 jieba 分词器
  initJieba()

  try {
    // 1. 获取文档记录并更新状态为 processing
    const document = await db.document.findUnique({
      where: { id: docId },
    })

    if (!document) {
      throw new Error(`文档 ${docId} 不存在`)
    }

    await db.document.update({
      where: { id: docId },
      data: { status: 'processing' },
    })

    // 2. 确定文件路径
    const filePath = path.join(process.cwd(), 'uploads', document.filename)
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`)
    }

    // 3. 根据文档类型解析
    let allChunks: TextChunk[] = []
    let fullText = ''
    let docMetadata: Record<string, unknown> = {}

    if (document.documentType === 'pdf') {
      const pdfResult = await parsePdf(filePath)

      // 合并所有页面文本
      const pageTexts = pdfResult.pages.map((p) => p.text)
      fullText = pageTexts.join('\n\n')

      // 对每一页进行分块
      for (const page of pdfResult.pages) {
        if (page.text.trim().length === 0) continue
        const pageChunks = chunkText(page.text, {
          pageNumber: page.pageNumber,
        })
        allChunks.push(...pageChunks)
      }

      // 设置文档元数据
      docMetadata = {
        pages: pdfResult.metadata.pageCount,
        author: pdfResult.metadata.author,
        title: pdfResult.metadata.title,
        creator: pdfResult.metadata.creator,
        producer: pdfResult.metadata.producer,
      }
    } else if (document.documentType === 'xlsx') {
      const excelResult = await parseExcel(filePath)

      // 合并所有 Sheet 文本
      const sheetTexts = excelResult.sheets.map((s) => s.fullText)
      fullText = sheetTexts.join('\n\n')

      // 对每个 Sheet 进行分块
      for (const sheet of excelResult.sheets) {
        if (sheet.fullText.trim().length === 0) continue
        const sheetChunks = chunkText(sheet.fullText, {
          sheetName: sheet.sheetName,
        })
        allChunks.push(...sheetChunks)
      }

      // 设置文档元数据
      docMetadata = {
        sheetCount: excelResult.metadata.sheetCount,
        sheetNames: excelResult.metadata.sheetNames,
      }
    } else {
      throw new Error(`不支持的文档类型: ${document.documentType}`)
    }

    // 4. 如果全文为空，标记失败
    if (fullText.trim().length === 0 || allChunks.length === 0) {
      throw new Error('文档解析结果为空，无法提取文本内容')
    }

    // 5. 对每个块进行分词并保存到数据库
    const chunkCreateData = allChunks.map((chunk, index) => {
      const tokenized = tokenizeForFts5(chunk.content)

      return {
        documentId: docId,
        chunkIndex: index,
        content: chunk.content,
        tokenizedContent: tokenized,
        charCount: chunk.content.length,
        pageNumber: chunk.pageNumber,
        sheetName: chunk.sheetName,
        sectionTitle: chunk.sectionTitle,
        chunkMetadata: JSON.stringify(chunk.chunkMetadata),
      }
    })

    // 批量创建块（分批处理避免 SQL 语句过长）
    const BATCH_SIZE = 50
    for (let i = 0; i < chunkCreateData.length; i += BATCH_SIZE) {
      const batch = chunkCreateData.slice(i, i + BATCH_SIZE)
      await db.documentChunk.createMany({ data: batch })
    }

    // 6. 更新文档记录：保存全文、元数据、状态
    await db.document.update({
      where: { id: docId },
      data: {
        status: 'completed',
        textContent: fullText,
        docMetadata: JSON.stringify(docMetadata),
        processedAt: new Date(),
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[document-service] 处理文档 ${docId} 失败:`, errorMessage)

    // 更新文档状态为失败
    await db.document.update({
      where: { id: docId },
      data: {
        status: 'failed',
        errorMessage: errorMessage,
      },
    })

    throw error
  }
}

/**
 * 重新处理文档：删除所有现有块后重新解析
 * 用于文档更新或处理流程修复
 */
export async function reprocessDocument(docId: string): Promise<void> {
  // 1. 验证文档存在
  const document = await db.document.findUnique({
    where: { id: docId },
  })

  if (!document) {
    throw new Error(`文档 ${docId} 不存在`)
  }

  // 2. 删除所有现有关联块
  await db.documentChunk.deleteMany({
    where: { documentId: docId },
  })

  // 3. 重置文档状态
  await db.document.update({
    where: { id: docId },
    data: {
      status: 'pending',
      textContent: null,
      docMetadata: '{}',
      errorMessage: null,
      processedAt: null,
    },
  })

  // 4. 重新处理
  await processDocument(docId)
}
