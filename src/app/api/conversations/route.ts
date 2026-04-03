import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/conversations
 * List all conversations ordered by updatedAt desc
 */
export async function GET() {
  try {
    const conversations = await db.conversation.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('Failed to list conversations:', error)
    return NextResponse.json(
      { error: '获取对话列表失败' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/conversations
 * Create a new conversation
 * Body: { title?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const title = body.title?.trim() || '新对话'

    const conversation = await db.conversation.create({
      data: { title },
    })

    return NextResponse.json({ conversation }, { status: 201 })
  } catch (error) {
    console.error('Failed to create conversation:', error)
    return NextResponse.json(
      { error: '创建对话失败' },
      { status: 500 }
    )
  }
}
