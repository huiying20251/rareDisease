'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SendHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  onCancel?: () => void
}

export function ChatInput({ onSend, disabled = false, onCancel }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const maxHeight = 4 * 24 // 4 lines at 24px per line
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
    }
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (trimmed && !disabled) {
      onSend(trimmed)
      setValue('')
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }, [value, disabled, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleClear = useCallback(() => {
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.focus()
    }
  }, [])

  return (
    <div className="border-t bg-background px-4 py-3">
      <div className="mx-auto max-w-3xl">
        <div
          className={cn(
            'flex items-end gap-2 rounded-xl border bg-muted/50 px-3 py-2 transition-colors',
            'focus-within:border-brand/50 focus-within:bg-background focus-within:ring-1 focus-within:ring-brand/20'
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="输入变异信息、临床表型或产品咨询..."
            rows={1}
            className="max-h-24 min-h-[36px] flex-1 resize-none border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
          {value && !disabled && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </Button>
          )}
          {disabled ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!value.trim()}
              className="size-8 shrink-0 rounded-lg bg-brand text-white hover:bg-brand-dark disabled:opacity-40"
            >
              <SendHorizontal className="size-4" />
            </Button>
          )}
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          RareHelper 基于 AI 生成回复，内容仅供参考，不能替代专业医疗诊断
        </p>
      </div>
    </div>
  )
}
