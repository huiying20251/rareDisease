'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { ChatLayout } from '@/components/chat/chat-layout'
import { ConversationSidebar, type Conversation } from '@/components/chat/conversation-sidebar'
import { MessageList } from '@/components/chat/message-list'
import { ChatInput } from '@/components/chat/chat-input'
import type { Message } from '@/components/chat/message-bubble'

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
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

  return (
    <ChatLayout
      sidebarOpen={sidebarOpen}
      onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
      onMobileToggleSidebar={() => setMobileSidebarOpen((prev) => !prev)}
      mobileSidebarOpen={mobileSidebarOpen}
      sidebarContent={
        <ConversationSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
        />
      }
    >
      <MessageList
        messages={currentMessages}
        isLoading={isLoading}
        onSuggestionClick={handleSuggestionClick}
      />
      <ChatInput
        onSend={handleSendMessage}
        disabled={isLoading}
        onCancel={handleCancel}
      />
    </ChatLayout>
  )
}
