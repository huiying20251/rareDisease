'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Dna, Plus, MessageSquare, Info } from 'lucide-react'
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
  className?: string
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  className,
}: ConversationSidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

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
          <Dna className="size-5 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold tracking-tight text-foreground truncate">
            RareHelper
          </h2>
          <p className="text-[11px] text-muted-foreground">罕见病智能解读助手</p>
        </div>
      </div>

      <Separator />

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
                <button
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation.id)}
                  onMouseEnter={() => setHoveredId(conversation.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={cn(
                    'flex w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors',
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
              )
            })
          )}
        </div>
      </ScrollArea>

      <Separator />

      {/* Footer */}
      <div className="p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
        >
          <Info className="size-4" />
          关于
        </Button>
      </div>
    </div>
  )
}
