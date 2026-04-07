import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { initFts5 } from '@/lib/fts5-init'
import { processDocument } from '@/lib/document-service'
import { createId } from '@paralleldrive/cuid2'

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
]

const ALLOWED_EXTENSIONS = ['pdf', 'xlsx', 'xls', 'csv']

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

const UPLOAD_DIR = '/home/z/my-project/uploads'

function getDocumentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx'
  if (ext === 'csv') return 'xlsx' // treat csv as xlsx type
  return 'unknown'
}

/**
 * GET /api/documents - List all documents with pagination and stats
 */
export async function GET(request: NextRequest) {
  try {
    // Initialize FTS5 on first request
    await initFts5()

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const status = searchParams.get('status') || undefined

    const where: Record<string, unknown> = {}
    if (status) {
      where.status = status
    }

    const [documents, total] = await Promise.all([
      db.document.findMany({
        where,
        include: {
          _count: {
            select: { chunks: true },
          },
        },
        orderBy: { uploadedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.document.count({ where }),
    ])

    return NextResponse.json({
      documents,
      total,
      page,
      limit,
    })
  } catch (error: unknown) {
    console.error('Failed to list documents:', error)
    const message = error instanceof Error ? error.message : '获取文档列表失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/documents - Upload a new document
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: '请选择要上传的文件' }, { status: 400 })
    }

    // Validate file type
    const filename = file.name
    const ext = filename.split('.').pop()?.toLowerCase() || ''

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `不支持的文件格式，仅支持: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      )
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `不支持的文件类型: ${file.type}` },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `文件大小超过限制，最大 ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      )
    }

    // Generate unique filename
    const uniqueFilename = `${createId()}.${ext}`
    const filePath = `${UPLOAD_DIR}/${uniqueFilename}`

    // Save file to disk
    const buffer = Buffer.from(await file.arrayBuffer())
    await Bun.write(filePath, buffer)

    // Determine document type
    const documentType = getDocumentType(filename)

    // Create document record in DB
    const doc = await db.document.create({
      data: {
        filename: uniqueFilename,
        originalName: filename,
        mimeType: file.type,
        fileSize: file.size,
        documentType,
        status: 'pending',
      },
    })

    // Trigger async processing (non-blocking)
    setTimeout(() => processDocument(doc.id), 100)

    return NextResponse.json(
      {
        document: doc,
        message: '文件上传成功，正在处理...',
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error('Failed to upload document:', error)
    const message = error instanceof Error ? error.message : '文件上传失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
