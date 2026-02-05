'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Bot, Send, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ExternalLink, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface Source {
  taskId: string
  title: string
  similarity: number
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  confidence?: 'high' | 'medium' | 'low'
}

const DEFAULT_SUGGESTIONS = [
  'What tasks are pending?',
  'Which tasks are urgent?',
  'Summarize tasks by status',
  'What are my high priority items?',
  'Show overdue tasks',
  'What tasks are assigned to me?',
]

const confidenceColors = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-red-100 text-red-800',
}

export function PermanentAIBar() {
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS)
  const [suggestionsSource, setSuggestionsSource] = useState<'static' | 'ai'>('static')
  const [isHoveringCarousel, setIsHoveringCarousel] = useState(false)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(true)

  const carouselRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const autoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Check scroll position to show/hide arrows
  const updateArrowVisibility = useCallback(() => {
    const carousel = carouselRef.current
    if (!carousel) return

    const { scrollLeft, scrollWidth, clientWidth } = carousel
    setShowLeftArrow(scrollLeft > 0)
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10)
  }, [])

  // Scroll carousel by amount
  const scrollCarousel = useCallback((direction: 'left' | 'right') => {
    const carousel = carouselRef.current
    if (!carousel) return

    const scrollAmount = direction === 'left' ? -200 : 200
    carousel.scrollBy({ left: scrollAmount, behavior: 'smooth' })
  }, [])

  // Keyboard navigation for carousel
  const handleCarouselKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      scrollCarousel('left')
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      scrollCarousel('right')
    }
  }, [scrollCarousel])

  // Auto-scroll logic
  useEffect(() => {
    const carousel = carouselRef.current
    if (!carousel || isHoveringCarousel) {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current)
        autoScrollIntervalRef.current = null
      }
      return
    }

    autoScrollIntervalRef.current = setInterval(() => {
      const { scrollLeft, scrollWidth, clientWidth } = carousel

      // If at the end, scroll back to start
      if (scrollLeft >= scrollWidth - clientWidth - 10) {
        carousel.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        carousel.scrollBy({ left: 150, behavior: 'smooth' })
      }
    }, 3000)

    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current)
      }
    }
  }, [isHoveringCarousel])

  // Update arrow visibility on scroll
  useEffect(() => {
    const carousel = carouselRef.current
    if (!carousel) return

    carousel.addEventListener('scroll', updateArrowVisibility)
    updateArrowVisibility()

    return () => carousel.removeEventListener('scroll', updateArrowVisibility)
  }, [updateArrowVisibility])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && isExpanded) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isExpanded])

  const executeQuery = async (queryText: string) => {
    // Add user message
    const userMessage: Message = { role: 'user', content: queryText }
    setMessages(prev => [...prev, userMessage])
    setIsExpanded(true)
    setIsLoading(true)

    try {
      const res = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText }),
      })

      const data = await res.json()

      if (!res.ok) {
        const errorMessage: Message = {
          role: 'assistant',
          content: data.error || 'Failed to get response',
          confidence: 'low',
        }
        setMessages(prev => [...prev, errorMessage])
        return
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        confidence: data.confidence,
      }
      setMessages(prev => [...prev, assistantMessage])

      // Update suggestions with AI-provided follow-ups if available
      if (data.suggestedQuestions && data.suggestedQuestions.length > 0) {
        setSuggestions(data.suggestedQuestions)
        setSuggestionsSource('ai')
        // Reset carousel scroll position
        if (carouselRef.current) {
          carouselRef.current.scrollTo({ left: 0, behavior: 'smooth' })
        }
      }
    } catch (err) {
      console.error('AI Assistant error:', err)
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Failed to connect to AI Assistant',
        confidence: 'low',
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || isLoading) return

    const queryText = query.trim()
    setQuery('')
    await executeQuery(queryText)
  }

  const handleSuggestionClick = (suggestion: string) => {
    setQuery('')
    executeQuery(suggestion)
  }

  const clearConversation = () => {
    setMessages([])
    setIsExpanded(false)
    setSuggestions(DEFAULT_SUGGESTIONS)
    setSuggestionsSource('static')
  }

  const hasConversation = messages.length > 0

  return (
    <div
      className={cn(
        'fixed bottom-0 z-40 border-t bg-background shadow-lg transition-all duration-300 ease-out',
        // Desktop: offset for sidebar, Mobile: full width
        'left-0 md:left-64 right-0',
        isExpanded ? 'max-h-[50vh]' : 'max-h-[120px]'
      )}
    >
      {/* Expanded Conversation Area */}
      {isExpanded && (
        <div className="flex flex-col h-full animate-in slide-in-from-bottom-4 duration-300">
          {/* Header with clear and minimize buttons */}
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearConversation}
              className="text-xs"
            >
              Clear chat
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="text-xs gap-1"
            >
              Minimize
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 max-h-[calc(50vh-180px)]">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  'flex flex-col gap-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200',
                  message.role === 'user' ? 'items-end' : 'items-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  {message.role === 'assistant' && message.confidence && (
                    <Badge className={cn('mb-2', confidenceColors[message.confidence])}>
                      {message.confidence} confidence
                    </Badge>
                  )}
                  <div className="whitespace-pre-wrap">{message.content}</div>

                  {/* Sources */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">Sources:</span>
                      {message.sources.slice(0, 3).map((source) => (
                        <Link
                          key={source.taskId}
                          href={`/tasks/${source.taskId}`}
                          className="flex items-center justify-between p-1.5 rounded hover:bg-background/50 transition-colors text-xs group"
                        >
                          <span className="truncate flex-1">{source.title}</span>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[10px]">
                              {Math.round(source.similarity * 100)}%
                            </Badge>
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex flex-col gap-2 items-start animate-in fade-in-0 duration-200">
                <div className="max-w-[80%] rounded-lg px-3 py-2 bg-muted">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Suggestion Carousel */}
      <div
        className="relative group"
        onMouseEnter={() => setIsHoveringCarousel(true)}
        onMouseLeave={() => setIsHoveringCarousel(false)}
        onKeyDown={handleCarouselKeyDown}
        tabIndex={0}
        role="region"
        aria-label="Suggested questions"
      >
        {/* Left Arrow */}
        <button
          onClick={() => scrollCarousel('left')}
          className={cn(
            'absolute left-0 top-0 bottom-0 z-10 flex items-center justify-center w-8 bg-gradient-to-r from-background to-transparent',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
            !showLeftArrow && 'pointer-events-none'
          )}
          aria-label="Scroll left"
        >
          <ChevronLeft className={cn('h-5 w-5 text-muted-foreground transition-opacity', !showLeftArrow && 'opacity-0')} />
        </button>

        {/* Carousel - touch scrollable */}
        <div
          ref={carouselRef}
          className="flex gap-2 overflow-x-auto px-4 py-2 scroll-smooth snap-x snap-mandatory touch-pan-x"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 text-sm rounded-full transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 snap-start',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                suggestionsSource === 'ai'
                  ? 'bg-primary/10 hover:bg-primary/20 text-primary'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              )}
            >
              {suggestionsSource === 'ai' && <Sparkles className="h-3 w-3" />}
              {suggestion}
            </button>
          ))}
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scrollCarousel('right')}
          className={cn(
            'absolute right-0 top-0 bottom-0 z-10 flex items-center justify-center w-8 bg-gradient-to-l from-background to-transparent',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
            !showRightArrow && 'pointer-events-none'
          )}
          aria-label="Scroll right"
        >
          <ChevronRight className={cn('h-5 w-5 text-muted-foreground transition-opacity', !showRightArrow && 'opacity-0')} />
        </button>
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="flex items-center gap-3 px-4 py-3 border-t">
        {/* Bot icon with conversation indicator */}
        <div className="relative flex-shrink-0">
          <Bot className="h-5 w-5 text-primary" />
          {/* Pulsing dot when there's a conversation but collapsed */}
          {hasConversation && !isExpanded && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
            </span>
          )}
        </div>

        {/* Expand button when collapsed with conversation */}
        {hasConversation && !isExpanded && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(true)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronUp className="h-4 w-4 mr-1" />
            Continue
          </Button>
        )}

        <Input
          ref={inputRef}
          placeholder={hasConversation && !isExpanded ? "Continue conversation..." : "Ask about your tasks..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isLoading}
          className="flex-1"
          onFocus={() => {
            if (hasConversation && !isExpanded) {
              setIsExpanded(true)
            }
          }}
        />
        <Button type="submit" size="icon" disabled={isLoading || !query.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
