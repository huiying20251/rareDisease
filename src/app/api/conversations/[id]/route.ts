import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

type RouteContext = {
  params: Promise<{ id: string }>
}

/**
 * GET /api/conversations/[id]
 * Get a single conversation with all its messages
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params

    const conversation = await db.conversation.findUnique({
      where: { id },
    })

    if (!conversation) {
      return NextResponse.json(
        { error: '对话不存在' },
        { status: 404 }
      )
    }

    const messages = await db.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ conversation, messages })
  } catch (error) {
    console.error('Failed to get conversation:', error)
    return NextResponse.json(
      { error: '获取对话失败' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/conversations/[id]
 * Delete a conversation and all its messages (cascade)
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params

    const conversation = await db.conversation.findUnique({
      where: { id },
    })

    if (!conversation) {
      return NextResponse.json(
        { error: '对话不存在' },
        { status: 404 }
      )
    }

    await db.conversation.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete conversation:', error)
    return NextResponse.json(
      { error: '删除对话失败' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/conversations/[id]
 * Update conversation title
 * Body: { title: string }
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const title = body.title?.trim()

    if (!title) {
      return NextResponse.json(
        { error: '标题不能为空' },
        { status: 400 }
      )
    }

    const conversation = await db.conversation.findUnique({
      where: { id },
    })

    if (!conversation) {
      return NextResponse.json(
        { error: '对话不存在' },
        { status: 404 }
      )
    }

    const updated = await db.conversation.update({
      where: { id },
      data: { title },
    })

    return NextResponse.json({ conversation: updated })
  } catch (error) {
    console.error('Failed to update conversation:', error)
    return NextResponse.json(
      { error: '更新对话失败' },
      { status: 500 }
    )
  }
}
