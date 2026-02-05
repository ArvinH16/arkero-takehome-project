'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Bot, Send, Sparkles, ExternalLink, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface Source {
  taskId: string
  title: string
  similarity: number
}

interface RAGResponse {
  answer: string
  sources: Source[]
  confidence: 'high' | 'medium' | 'low'
  suggestedQuestions?: string[]
  error?: string
}

const suggestedQuestions = [
  'What tasks are pending?',
  'Which tasks are urgent?',
  'Summarize tasks by status',
]

export function AIAssistant() {
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<RAGResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || isLoading) return

    await executeQuery(query)
  }

  const executeQuery = async (queryText: string) => {
    setIsLoading(true)
    setError(null)
    setResponse(null)

    try {
      const res = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to get response')
        return
      }

      setResponse(data)
    } catch (err) {
      setError('Failed to connect to AI Assistant')
      console.error('AI Assistant error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuggestedQuestion = (question: string) => {
    setQuery(question)
    executeQuery(question)
  }

  const confidenceColors = {
    high: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-red-100 text-red-800',
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">AI Assistant</CardTitle>
        </div>
        <CardDescription>
          Ask questions about your tasks using natural language
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Query input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Ask about your tasks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !query.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>

        {/* Suggested questions (when no response) */}
        {!response && !isLoading && !error && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Try asking:
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((question) => (
                <Button
                  key={question}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestedQuestion(question)}
                  className="text-xs"
                >
                  {question}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-800 font-medium">Error</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* Response */}
        {response && (
          <div className="space-y-4">
            {/* Answer */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Answer</span>
                <Badge className={confidenceColors[response.confidence]}>
                  {response.confidence} confidence
                </Badge>
              </div>
              <div className="p-3 rounded-md bg-muted/50 text-sm whitespace-pre-wrap">
                {response.answer}
              </div>
            </div>

            {/* Sources */}
            {response.sources.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-medium">
                  Sources ({response.sources.length})
                </span>
                <div className="space-y-1">
                  {response.sources.slice(0, 3).map((source) => (
                    <Link
                      key={source.taskId}
                      href={`/tasks/${source.taskId}`}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors text-sm group"
                    >
                      <span className="truncate flex-1">{source.title}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {Math.round(source.similarity * 100)}%
                        </Badge>
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Ask another question */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery('')
                setResponse(null)
              }}
              className="text-xs"
            >
              Ask another question
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
