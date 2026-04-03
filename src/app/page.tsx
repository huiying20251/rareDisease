'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { ChatLayout } from '@/components/chat/chat-layout'
import { ConversationSidebar, type Conversation } from '@/components/chat/conversation-sidebar'
import { KnowledgePanel } from '@/components/chat/knowledge-panel'
import { MessageList } from '@/components/chat/message-list'
import { ChatInput } from '@/components/chat/chat-input'
import type { Message } from '@/components/chat/message-bubble'

// ==================== Sidebar Shell with Tabs ====================

import { MessageSquare, Database, Dna, FlaskConical } from 'lucide-react'
import { VariantClassificationPanel } from '@/components/variant/classification-panel'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'

function SidebarShell({
  activeTab,
  onTabChange,
  children,
}: {
  activeTab: 'conversations' | 'knowledge' | 'variant'
  onTabChange: (tab: 'conversations' | 'knowledge' | 'variant') => void
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full flex-col bg-background border-r border-border">
      {/* Header with Logo + Tabs */}
      <div className="px-4 pt-4 pb-0">
        <div className="flex items-center gap-3 mb-3">
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
        {/* Tab Bar */}
        <div className="flex rounded-lg bg-muted/50 p-0.5">
          <button
            onClick={() => onTabChange('conversations')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
              activeTab === 'conversations'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <MessageSquare className="size-3.5" />
            对话
          </button>
          <button
            onClick={() => onTabChange('knowledge')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
              activeTab === 'knowledge'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Database className="size-3.5" />
            知识库
          </button>
          <button
            onClick={() => onTabChange('variant')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
              activeTab === 'variant'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <FlaskConical className="size-3.5" />
            变异解读
          </button>
        </div>
      </div>
      <Separator className="mt-3" />
      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {children}
      </div>
    </div>
  )
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<'conversations' | 'knowledge' | 'variant'>('conversations')
  const isSendingRef = useRef(false)

  const currentMessages = activeConversationId ? (messagesMap[activeConversationId] ?? []) : []

  // ===== Load conversations on mount =====
  useEffect(() => {
    async function loadConversations() {
      try {
        const res = await fetch('/api/conversations')
        if (res.ok) {
          const data = await res.json()
          setConversations(data.conversations ?? [])
        }
      } catch (error) {
        console.error('Failed to load conversations:', error)
      } finally {
        setIsInitialized(true)
      }
    }
    loadConversations()
  }, [])

  // ===== Load messages for a conversation =====
  const loadConversationMessages = useCallback(async (conversationId: string) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}`)
      if (res.ok) {
        const data = await res.json()
        const messages: Message[] = (data.messages ?? []).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          contentType: m.contentType,
          createdAt: new Date(m.createdAt),
          metadata: m.metadata,
        }))
        setMessagesMap((prev) => ({
          ...prev,
          [conversationId]: messages,
        }))
        return messages
      }
    } catch (error) {
      console.error('Failed to load conversation messages:', error)
    }
    return []
  }, [])

  // ===== Select a conversation and load its messages =====
  const handleSelectConversation = useCallback(
    async (id: string) => {
      setActiveConversationId(id)
      setMobileSidebarOpen(false)

      // Load messages if not already cached
      if (!messagesMap[id]) {
        await loadConversationMessages(id)
      }
    },
    [messagesMap, loadConversationMessages]
  )

  // ===== Create a new conversation =====
  const handleNewConversation = useCallback(() => {
    setActiveConversationId(null)
    setMobileSidebarOpen(false)
  }, [])

  // ===== Delete a conversation =====
  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
        setConversations((prev) => prev.filter((c) => c.id !== id))
        if (activeConversationId === id) {
          setActiveConversationId(null)
        }
        setMessagesMap((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      } catch (error) {
        console.error('Failed to delete conversation:', error)
      }
    },
    [activeConversationId]
  )

  // ===== Send a message =====
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (isSendingRef.current || isLoading) return
      isSendingRef.current = true
      setIsLoading(true)

      let convId = activeConversationId

      try {
        // Optimistically add the user message to the UI
        const tempUserMsg: Message = {
          id: `temp-${Date.now()}`,
          role: 'user',
          content,
          contentType: 'text',
          createdAt: new Date(),
        }

        // If no active conversation, we'll get the ID from the response
        const previousConvId = convId
        if (!convId) {
          convId = `pending-${Date.now()}`
          setActiveConversationId(convId)
          setMessagesMap((prev) => ({
            ...prev,
            [convId]: [tempUserMsg],
          }))
        } else {
          setMessagesMap((prev) => ({
            ...prev,
            [convId]: [...(prev[convId] ?? []), tempUserMsg],
          }))
        }

        // Call the chat API
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: previousConvId || null,
            message: content,
          }),
        })

        if (!res.ok) {
          throw new Error(`Chat API error: ${res.status}`)
        }

        const data = await res.json()
        const { userMessage, assistantMessage, conversationId: returnedConvId } = data

        const finalConvId = returnedConvId ?? convId

        // Update conversation ID if it was newly created
        if (finalConvId !== convId) {
          // Move messages from temp ID to real ID
          setMessagesMap((prev) => {
            const next = { ...prev }
            next[finalConvId] = []
            delete next[convId]
            return next
          })
          convId = finalConvId
          setActiveConversationId(finalConvId)
        }

        // Replace temp user message with real one, add assistant message
        const realUserMsg: Message = {
          id: userMessage.id,
          role: userMessage.role,
          content: userMessage.content,
          contentType: userMessage.contentType,
          createdAt: new Date(userMessage.createdAt),
        }

        const realAssistantMsg: Message = {
          id: assistantMessage.id,
          role: assistantMessage.role,
          content: assistantMessage.content,
          contentType: assistantMessage.contentType,
          createdAt: new Date(assistantMessage.createdAt),
          metadata: assistantMessage.metadata,
        }

        setMessagesMap((prev) => ({
          ...prev,
          [convId!]: [
            ...(prev[convId!] ?? []).filter((m) => !m.id.startsWith('temp-')),
            realUserMsg,
            realAssistantMsg,
          ],
        }))

        // Refresh conversation list (the new conversation should appear)
        const convRes = await fetch('/api/conversations')
        if (convRes.ok) {
          const convData = await convRes.json()
          setConversations(convData.conversations ?? [])
        }
      } catch (error) {
        console.error('Failed to send message:', error)

        // Show error as assistant message
        const errorMsg: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: '抱歉，消息发送失败，请稍后重试。',
          contentType: 'text',
          createdAt: new Date(),
        }
        if (convId) {
          setMessagesMap((prev) => ({
            ...prev,
            [convId]: [...(prev[convId] ?? []), errorMsg],
          }))
        }
      } finally {
        setIsLoading(false)
        isSendingRef.current = false
      }
    },
    [activeConversationId, isLoading]
  )

  const handleSuggestionClick = useCallback(
    (text: string) => {
      handleSendMessage(text)
    },
    [handleSendMessage]
  )

  const handleCancel = useCallback(() => {
    setIsLoading(false)
    isSendingRef.current = false
  }, [])

  // ===== Regenerate last response =====
  const handleRegenerate = useCallback(() => {
    if (!activeConversationId || isLoading || !currentMessages.length) return
    // Find the last user message to resend
    const lastUserMsg = [...currentMessages].reverse().find((m) => m.role === 'user')
    if (!lastUserMsg) return
    // Remove the last assistant message
    setMessagesMap((prev) => {
      const msgs = [...(prev[activeConversationId] ?? [])]
      const lastIdx = msgs.length - 1
      if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
        msgs.splice(lastIdx, 1)
      }
      return { ...prev, [activeConversationId]: msgs }
    })
    // Resend the last user message
    handleSendMessage(lastUserMsg.content)
  }, [activeConversationId, currentMessages, isLoading, handleSendMessage])

  return (
    <ChatLayout
      sidebarOpen={sidebarOpen}
      onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
      onMobileToggleSidebar={() => setMobileSidebarOpen((prev) => !prev)}
      mobileSidebarOpen={mobileSidebarOpen}
      sidebarContent={
        <SidebarShell activeTab={sidebarTab} onTabChange={setSidebarTab}>
          {sidebarTab === 'conversations' ? (
            <ConversationSidebar
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelectConversation={handleSelectConversation}
              onNewConversation={handleNewConversation}
              onDeleteConversation={handleDeleteConversation}
              isEmbedded
            />
          ) : sidebarTab === 'knowledge' ? (
            <KnowledgePanel />
          ) : (
            <VariantClassificationPanel />
          )}
        </SidebarShell>
      }
    >
      <MessageList
        messages={currentMessages}
        isLoading={isLoading}
        onSuggestionClick={handleSuggestionClick}
        onRegenerate={handleRegenerate}
      />
      <ChatInput
        onSend={handleSendMessage}
        disabled={isLoading}
        onCancel={handleCancel}
      />
    </ChatLayout>
  )
}
