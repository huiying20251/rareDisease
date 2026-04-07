import { NextRequest, NextResponse } from 'next/server'
import { searchKnowledgeBase } from '@/lib/rag-service'

/**
 * POST /api/knowledge/search - Search across entire knowledge base
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, limit } = body

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ error: '搜索查询不能为空' }, { status: 400 })
    }

    const searchLimit = typeof limit === 'number' ? Math.min(50, Math.max(1, limit)) : 10

    const result = await searchKnowledgeBase(query, searchLimit)

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('Knowledge search failed:', error)
    const message = error instanceof Error ? error.message : '知识库搜索失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
