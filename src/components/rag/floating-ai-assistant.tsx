'use client'

import { useState, useEffect, useRef } from 'react'
import { Bot, X, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AIAssistant } from './ai-assistant'

export function FloatingAIAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div ref={panelRef} className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {/* Expanded Panel */}
      <div
        className={cn(
          'w-[90vw] sm:w-[400px] max-h-[70vh] sm:max-h-[500px] overflow-hidden rounded-xl border bg-background shadow-xl transition-all duration-300 ease-out origin-bottom-right',
          isOpen
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-4 scale-95 pointer-events-none invisible'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/30">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-medium">AI Assistant</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-muted"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(70vh-60px)] sm:max-h-[440px] overflow-y-auto">
          <AIAssistant hideHeader />
        </div>
      </div>

      {/* Floating Action Button */}
      <Button
        size="lg"
        className={cn(
          'h-14 w-14 rounded-full shadow-lg transition-all duration-200',
          'hover:scale-110 hover:shadow-xl',
          'active:scale-95',
          isOpen && 'rotate-90'
        )}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
      >
        <MessageCircle className={cn(
          'h-6 w-6 transition-transform duration-200',
          isOpen && 'rotate-90'
        )} />
      </Button>
    </div>
  )
}
