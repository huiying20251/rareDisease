'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  FileText,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Database,
  X,
  HardDrive,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ==================== Types ====================

export interface DocumentItem {
  id: string
  filename: string
  originalName: string
  mimeType: string
  fileSize: number
  documentType: string
  status: string
  uploadedAt: string
  processedAt?: string | null
  errorMessage?: string | null
  _count?: { chunks: number }
}

interface KnowledgePanelProps {
  className?: string
}

// ==================== Helpers ====================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'completed':
      return {
        icon: CheckCircle2,
        label: '已完成',
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      }
    case 'processing':
      return {
        icon: Loader2,
        label: '处理中',
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        badge: 'border-amber-200 bg-amber-50 text-amber-700',
      }
    case 'failed':
      return {
        icon: AlertCircle,
        label: '失败',
        color: 'text-red-600',
        bg: 'bg-red-50',
        badge: 'border-red-200 bg-red-50 text-red-700',
      }
    default:
      return {
        icon: Clock,
        label: '等待中',
        color: 'text-muted-foreground',
        bg: 'bg-muted',
        badge: 'border-border bg-muted text-muted-foreground',
      }
  }
}

function getFileIcon(type: string) {
  switch (type) {
    case 'pdf':
      return '📄'
    case 'xlsx':
      return '📊'
    default:
      return '📎'
  }
}

// ==================== Drop Zone ====================

function DropZone({ onUpload }: { onUpload: (files: File[]) => void }) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => {
          const ext = f.name.split('.').pop()?.toLowerCase() || ''
          return ['pdf', 'xlsx', 'xls', 'csv'].includes(ext)
        }
      )
      if (files.length > 0) onUpload(files)
    },
    [onUpload]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : []
      if (files.length > 0) onUpload(files)
      // Reset input
      if (inputRef.current) inputRef.current.value = ''
    },
    [onUpload]
  )

  return (
    <div className="p-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-4 transition-all',
          isDragOver
            ? 'border-brand bg-brand-light/30'
            : 'border-border bg-muted/30 hover:border-brand/40 hover:bg-muted/50'
        )}
      >
        <Upload className={cn('size-5', isDragOver ? 'text-brand' : 'text-muted-foreground')} />
        <div className="text-center">
          <p className="text-xs font-medium text-foreground">
            拖拽文件到此处上传
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            支持 PDF、Excel（最大 50MB）
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.xlsx,.xls,.csv"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  )
}

// ==================== Knowledge Panel ====================

export function KnowledgePanel({ className }: KnowledgePanelProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [uploadingCount, setUploadingCount] = useState(0)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [totalChunks, setTotalChunks] = useState(0)
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null)

  const loadDocuments = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/documents')
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents ?? [])
        const chunks = (data.documents ?? []).reduce(
          (sum: number, d: DocumentItem) => sum + (d._count?.chunks ?? 0),
          0
        )
        setTotalChunks(chunks)
      }
    } catch (error) {
      console.error('Failed to load documents:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Poll for documents that are processing
  const startPolling = useCallback(() => {
    const hasProcessing = documents.some(
      (d) => d.status === 'pending' || d.status === 'processing'
    )
    if (hasProcessing) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
      pollTimerRef.current = setInterval(loadDocuments, 3000)
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [documents, loadDocuments])

  useEffect(() => {
    loadDocuments()
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [loadDocuments])

  useEffect(() => {
    startPolling()
  }, [startPolling])

  const handleUpload = useCallback(
    async (files: File[]) => {
      setUploadingCount(files.length)
      for (const file of files) {
        try {
          const formData = new FormData()
          formData.append('file', file)
          const res = await fetch('/api/documents', {
            method: 'POST',
            body: formData,
          })
          if (res.ok) {
            // Immediately reload to show the new document
            await loadDocuments()
          }
        } catch (error) {
          console.error('Failed to upload:', file.name, error)
        }
      }
      setUploadingCount(0)
    },
    [loadDocuments]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/documents/${id}`, { method: 'DELETE' })
        setDocuments((prev) => prev.filter((d) => d.id !== id))
      } catch (error) {
        console.error('Failed to delete document:', error)
      }
    },
    []
  )

  const handleInitKnowledge = useCallback(async () => {
    try {
      const res = await fetch('/api/knowledge/init', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        alert(data.message || '知识库初始化完成')
      }
    } catch (error) {
      console.error('Failed to init knowledge:', error)
    }
  }, [])

  return (
    <div
      className={cn(
        'flex h-full flex-col bg-background border-r border-border',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="flex size-9 items-center justify-center rounded-xl bg-brand/10">
          <Database className="size-5 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold tracking-tight text-foreground truncate">
            知识库
          </h2>
          <p className="text-[11px] text-muted-foreground">文档管理与检索</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 px-4 pb-3">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <FileText className="size-3.5" />
          <span>{documents.length} 个文档</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <HardDrive className="size-3.5" />
          <span>{totalChunks} 个文本块</span>
        </div>
      </div>

      {/* Drop Zone */}
      <DropZone onUpload={handleUpload} />

      {uploadingCount > 0 && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg bg-brand-light/30 px-3 py-2">
          <Loader2 className="size-4 animate-spin text-brand" />
          <span className="text-xs text-brand-dark">
            正在上传 {uploadingCount} 个文件...
          </span>
        </div>
      )}

      {/* Document List */}
      <ScrollArea className="flex-1 chat-scrollbar px-2">
        <div className="flex flex-col gap-1 pb-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <FileText className="size-8 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">暂无文档</p>
              <p className="text-[10px] text-muted-foreground">
                上传 PDF 或 Excel 文件以丰富知识库
              </p>
            </div>
          ) : (
            documents.map((doc) => {
              const statusConfig = getStatusConfig(doc.status)
              const StatusIcon = statusConfig.icon
              return (
                <div
                  key={doc.id}
                  onMouseEnter={() => setHoveredId(doc.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="group flex items-start gap-2 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <span className="mt-0.5 text-base shrink-0">
                    {getFileIcon(doc.documentType)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {doc.originalName}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] px-1.5 py-0', statusConfig.badge)}
                      >
                        <StatusIcon
                          className={cn(
                            'size-3 mr-1',
                            doc.status === 'processing' && 'animate-spin'
                          )}
                        />
                        {statusConfig.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatFileSize(doc.fileSize)}
                      </span>
                      {doc._count && doc._count.chunks > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {doc._count.chunks} 块
                        </span>
                      )}
                    </div>
                    {doc.status === 'failed' && doc.errorMessage && (
                      <p className="mt-1 text-[10px] text-red-500 line-clamp-1">
                        {doc.errorMessage}
                      </p>
                    )}
                  </div>
                  {hoveredId === doc.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(doc.id)
                      }}
                      className="size-7 shrink-0 text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleInitKnowledge}
          className="w-full justify-start gap-2 text-muted-foreground hover:text-brand"
        >
          <Database className="size-4" />
          初始化知识库索引
        </Button>
      </div>
    </div>
  )
}
