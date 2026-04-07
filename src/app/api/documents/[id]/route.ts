import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const UPLOAD_DIR = '/home/z/my-project/uploads'

/**
 * GET /api/documents/[id] - Get single document with chunks
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const document = await db.document.findUnique({
      where: { id },
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' },
        },
        _count: {
          select: { chunks: true },
        },
      },
    })

    if (!document) {
      return NextResponse.json({ error: '文档不存在' }, { status: 404 })
    }

    const totalChunks = document._count.chunks

    return NextResponse.json({
      ...document,
      totalChunks,
    })
  } catch (error: unknown) {
    console.error('Failed to get document:', error)
    const message = error instanceof Error ? error.message : '获取文档详情失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/documents/[id] - Delete document
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Find document first to get the filename
    const document = await db.document.findUnique({
      where: { id },
      select: { filename: true },
    })

    if (!document) {
      return NextResponse.json({ error: '文档不存在' }, { status: 404 })
    }

    // Delete from DB (cascades to chunks via schema)
    await db.document.delete({
      where: { id },
    })

    // Delete the physical file from uploads directory
    try {
      const filePath = `${UPLOAD_DIR}/${document.filename}`
      const { unlink } = await import('node:fs/promises')
      await unlink(filePath)
    } catch {
      // File may not exist, ignore
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Failed to delete document:', error)
    const message = error instanceof Error ? error.message : '删除文档失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
