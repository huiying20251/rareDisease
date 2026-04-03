/**
 * FTS5 全文索引初始化
 * 使用外部内容表模式，通过触发器自动同步 DocumentChunk 数据
 */
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function initFts5() {
  // 检查 FTS5 表是否已存在
  try {
    const result = await db.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='document_chunks_fts'"
    )
    const rows = result as any[]
    if (rows && rows.length > 0) {
      console.log('FTS5 already initialized')
      return
    }
  } catch {
    // Continue with creation
  }

  const sqls = [
    // 创建 FTS5 虚拟表（外部内容模式）
    `CREATE VIRTUAL TABLE IF NOT EXISTS document_chunks_fts USING fts5(
      tokenized_content,
      content,
      section_title,
      document_id,
      tokenize='unicode61'
    )`,
    // 插入触发器：新 chunk 写入时同步到 FTS5
    `CREATE TRIGGER IF NOT EXISTS doc_chunks_fts_insert AFTER INSERT ON DocumentChunk BEGIN
      INSERT INTO document_chunks_fts(rowid, tokenized_content, content, section_title, document_id)
      VALUES (NEW.rowid, COALESCE(NEW.tokenizedContent, NEW.content), NEW.content, COALESCE(NEW.sectionTitle, ''), NEW.documentId);
    END`,
    // 删除触发器
    `CREATE TRIGGER IF NOT EXISTS doc_chunks_fts_delete AFTER DELETE ON DocumentChunk BEGIN
      INSERT INTO document_chunks_fts(document_chunks_fts, rowid, tokenized_content, content, section_title, document_id)
      VALUES ('delete', OLD.rowid, COALESCE(OLD.tokenizedContent, OLD.content), OLD.content, COALESCE(OLD.sectionTitle, ''), OLD.documentId);
    END`,
    // 更新触发器
    `CREATE TRIGGER IF NOT EXISTS doc_chunks_fts_update AFTER UPDATE ON DocumentChunk BEGIN
      INSERT INTO document_chunks_fts(document_chunks_fts, rowid, tokenized_content, content, section_title, document_id)
      VALUES ('delete', OLD.rowid, COALESCE(OLD.tokenizedContent, OLD.content), OLD.content, COALESCE(OLD.sectionTitle, ''), OLD.documentId);
      INSERT INTO document_chunks_fts(rowid, tokenized_content, content, section_title, document_id)
      VALUES (NEW.rowid, COALESCE(NEW.tokenizedContent, NEW.content), NEW.content, COALESCE(NEW.sectionTitle, ''), NEW.documentId);
    END`,
  ]

  for (const sql of sqls) {
    try {
      await db.$executeRawUnsafe(sql)
    } catch (e) {
      console.error('FTS5 init SQL error:', e)
    }
  }

  console.log('FTS5 initialized successfully')
}

/**
 * 重建所有现有 chunks 的 FTS5 索引
 */
export async function rebuildFts5Index() {
  // 清空 FTS5 表
  try {
    await db.$executeRawUnsafe(`DELETE FROM document_chunks_fts`)
  } catch {
    // ignore if empty
  }

  // 重新插入所有现有 chunks
  const chunks = await db.documentChunk.findMany({
    select: {
      rowid: true,
      id: true,
      tokenizedContent: true,
      content: true,
      sectionTitle: true,
      documentId: true,
    },
    orderBy: { chunkIndex: 'asc' },
  })

  // Prisma doesn't expose rowid, so we use a different approach:
  // Delete and re-create triggers won't work for bulk, so we insert directly
  for (const chunk of chunks) {
    try {
      const tokenized = chunk.tokenizedContent || chunk.content
      await db.$executeRawUnsafe(
        `INSERT INTO document_chunks_fts(rowid, tokenized_content, content, section_title, document_id)
         VALUES ((SELECT rowid FROM DocumentChunk WHERE id = ?), ?, ?, ?, ?)`,
        chunk.id,
        tokenized,
        chunk.content,
        chunk.sectionTitle || '',
        chunk.documentId
      )
    } catch (e) {
      console.error(`Failed to index chunk ${chunk.id}:`, e)
    }
  }

  console.log(`Rebuilt FTS5 index for ${chunks.length} chunks`)
}

export interface Fts5SearchResult {
  chunkId: string
  content: string
  sectionTitle: string | null
  documentId: string
  documentName: string
  documentType: string
  pageNumber: number | null
  sheetName: string | null
  rank: number
  snippet: string
}

/**
 * FTS5 BM25 全文搜索
 * @param query - 搜索查询词（已 jieba 分词，空格分隔）
 * @param limit - 最大返回结果数
 * @returns 按相关性排序的搜索结果
 */
export async function fts5Search(
  query: string,
  limit: number = 10
): Promise<Fts5SearchResult[]> {
  if (!query || query.trim().length === 0) return []

  // FTS5 MATCH 语法：用 OR 连接多个词，并支持前缀查询
  const terms = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => `"${t.replace(/"/g, '""')}"*`)  // 前缀查询

  if (terms.length === 0) return []

  const matchExpr = terms.join(' OR ')

  try {
    const results = await db.$queryRawUnsafe<Fts5SearchResult[]>(
      `SELECT
        dc.id as chunkId,
        dc.content as content,
        dc.sectionTitle as sectionTitle,
        dc.documentId as documentId,
        d.originalName as documentName,
        d.documentType as documentType,
        dc.pageNumber as pageNumber,
        dc.sheetName as sheetName,
        fts.rank as rank,
        snippet(document_chunks_fts, 2, '<mark>', '</mark>', '...', 32) as snippet
      FROM document_chunks_fts AS fts
      JOIN DocumentChunk AS dc ON dc.rowid = fts.rowid
      JOIN Document AS d ON d.id = dc.documentId
      WHERE document_chunks_fts MATCH ?
      ORDER BY fts.rank
      LIMIT ?`,
      matchExpr,
      limit
    )

    return results
  } catch (e) {
    console.error('FTS5 search error:', e)
    return []
  }
}
