'use client'

import { useState, type ReactNode } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { PanelLeftClose, PanelLeftOpen, Menu } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ChatLayoutProps {
  children: ReactNode
  sidebarContent: ReactNode
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onMobileToggleSidebar: () => void
  mobileSidebarOpen: boolean
}

export function ChatLayout({
  children,
  sidebarContent,
  sidebarOpen,
  onToggleSidebar,
  onMobileToggleSidebar,
  mobileSidebarOpen,
}: ChatLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:flex shrink-0 transition-all duration-300 ease-in-out overflow-hidden',
          sidebarOpen ? 'w-72' : 'w-0'
        )}
      >
        <div className="w-72 h-full">{sidebarContent}</div>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center gap-2 border-b border-border bg-background/80 backdrop-blur-sm px-3 py-2">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden size-8"
            onClick={onMobileToggleSidebar}
          >
            <Menu className="size-5" />
          </Button>

          {/* Desktop sidebar toggle */}
          <div className="hidden md:block">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={onToggleSidebar}
                >
                  {sidebarOpen ? (
                    <PanelLeftClose className="size-4" />
                  ) : (
                    <PanelLeftOpen className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {sidebarOpen ? '收起侧栏' : '展开侧栏'}
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="flex-1 min-w-0" />
        </div>

        {/* Chat Content */}
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      </main>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileSidebarOpen} onOpenChange={onMobileToggleSidebar}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">对话列表</SheetTitle>
          {sidebarContent}
        </SheetContent>
      </Sheet>
    </div>
  )
}
