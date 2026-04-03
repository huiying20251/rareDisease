'use client'

import { useRef, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble, type Message } from '@/components/chat/message-bubble'
import { WelcomeScreen } from '@/components/chat/welcome-screen'
import { TypingIndicator } from '@/components/chat/typing-indicator'

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
  onSuggestionClick: (text: string) => void
}

export function MessageList({
  messages,
  isLoading,
  onSuggestionClick,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 overflow-hidden">
        <WelcomeScreen onSuggestionClick={onSuggestionClick} />
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1 chat-scrollbar">
      <div className="flex flex-col">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isLoading && (
          <div className="flex gap-3 px-4 py-3">
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-muted px-2 py-1">
              <TypingIndicator />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
