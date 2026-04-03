'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, MessageSquare, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export interface Conversation {
  id: string
  title: string
  createdAt: Date
  updatedAt: Date
}

interface ConversationSidebarProps {
  conversations: Conversation[]
  activeConversationId: string | null
  onSelectConversation: (id: string) => void
  onNewConversation: () => void
  onDeleteConversation?: (id: string) => void
  isEmbedded?: boolean
  className?: string
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  isEmbedded = false,
  className,
}: ConversationSidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <div
      className={cn(
        'flex h-full flex-col',
        !isEmbedded && 'bg-background border-r border-border',
        className
      )}
    >
      {/* Header - only when not embedded (standalone mode) */}
      {!isEmbedded && (
        <>
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="flex size-9 items-center justify-center rounded-xl bg-brand/10">
              <span className="text-brand text-lg font-bold">RH</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold tracking-tight text-foreground truncate">
                RareHelper
              </h2>
              <p className="text-[11px] text-muted-foreground">罕见病智能解读助手</p>
            </div>
          </div>
          <div className="border-t border-border" />
        </>
      )}

      {/* New Conversation Button */}
      <div className="p-3">
        <Button
          onClick={onNewConversation}
          variant="outline"
          className="w-full justify-start gap-2 border-brand/30 text-brand hover:bg-brand-light/30 hover:text-brand-dark"
        >
          <Plus className="size-4" />
          新建对话
        </Button>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1 chat-scrollbar px-2">
        <div className="flex flex-col gap-0.5 pb-2">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <MessageSquare className="size-8 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">暂无对话记录</p>
            </div>
          ) : (
            conversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId
              return (
                <div
                  key={conversation.id}
                  className="group flex items-center rounded-lg transition-colors"
                >
                  <button
                    onClick={() => onSelectConversation(conversation.id)}
                    onMouseEnter={() => setHoveredId(conversation.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className={cn(
                      'flex flex-1 flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors',
                      isActive
                        ? 'bg-brand-light/50 text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <span className="text-sm font-medium truncate">
                      {conversation.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {formatDistanceToNow(conversation.updatedAt, {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </span>
                  </button>
                  {(hoveredId === conversation.id || isActive) && onDeleteConversation && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteConversation(conversation.id)
                      }}
                      className="size-7 shrink-0 mr-1 text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
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
    </div>
  )
}
