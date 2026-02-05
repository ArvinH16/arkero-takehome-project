# Floating AI Assistant Implementation Plan

## Overview

Transform the AI Assistant from an inline component at the bottom of the dashboard to a floating widget that stays fixed at the bottom-right of the viewport. Users can access it from any page without scrolling.

## Current State Analysis

- `AIAssistant` component is rendered inline at the bottom of `DashboardClient` (dashboard-client.tsx:233)
- It uses a Card component with no fixed positioning, scrolling with page content
- Only visible on the dashboard page, requires scrolling to reach
- Layout uses fixed sidebar (z-40), sticky header (z-30), dialogs at z-50

### Key Files:
- `src/components/rag/ai-assistant.tsx:32` - Main AIAssistant component
- `src/app/(dashboard)/dashboard-client.tsx:233` - Where it's currently rendered
- `src/app/(dashboard)/layout.tsx:4` - Dashboard layout (where we'll move it)

## Desired End State

- AI Assistant floats at bottom-right corner of the viewport
- Collapsed by default, showing just a toggle button
- Expands to show the full chat interface when clicked
- Available on all dashboard pages (Dashboard, Tasks, Audit, etc.)
- Smooth expand/collapse animations
- Does not overlap with sidebar or interfere with content

### Verification:
- AI Assistant button visible on all dashboard pages without scrolling
- Clicking expands the chat panel with animation
- Can submit queries and receive responses while panel is open
- Clicking collapse button or outside area closes the panel
- Works correctly on mobile viewports

## What We're NOT Doing

- Not adding conversation history/persistence
- Not changing the RAG functionality or API
- Not adding mobile-specific drawer behavior
- Not adding keyboard shortcuts

## Implementation Approach

Create a floating wrapper component that handles positioning and expand/collapse state, while keeping the existing AIAssistant component logic intact. Move rendering from DashboardClient to the layout so it's available on all pages.

---

## Phase 1: Create Floating AI Assistant Wrapper

### Overview
Create a new wrapper component that provides the floating container, toggle button, and expand/collapse behavior.

### Changes Required:

#### 1. Create FloatingAIAssistant Component
**File**: `src/components/rag/floating-ai-assistant.tsx`
**Changes**: Create new file with floating wrapper component

```tsx
'use client'

import { useState } from 'react'
import { Bot, X, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AIAssistant } from './ai-assistant'

export function FloatingAIAssistant() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {/* Expanded Panel */}
      <div
        className={cn(
          'w-[400px] max-h-[500px] overflow-hidden rounded-xl border bg-background shadow-lg transition-all duration-300 ease-in-out',
          isOpen
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-4 scale-95 pointer-events-none h-0'
        )}
      >
        {/* Close button header */}
        <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/50">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">AI Assistant</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* AI Assistant content */}
        <div className="max-h-[450px] overflow-y-auto">
          <AIAssistant />
        </div>
      </div>

      {/* Toggle Button */}
      <Button
        size="lg"
        className={cn(
          'h-14 w-14 rounded-full shadow-lg transition-transform hover:scale-105',
          isOpen && 'bg-muted text-muted-foreground hover:bg-muted'
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </Button>
    </div>
  )
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run build`
- [x] Linting passes: `npm run lint`

#### Manual Verification:
- [ ] Component file exists and exports correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 2: Update AIAssistant for Floating Context

### Overview
Modify the existing AIAssistant component to work better in the floating container by removing redundant header elements.

### Changes Required:

#### 1. Simplify AIAssistant Card Structure
**File**: `src/components/rag/ai-assistant.tsx`
**Changes**: Remove Card wrapper and header since floating wrapper provides these

Update the component to optionally hide the header when used in floating context:

```tsx
// Add optional prop to hide header
interface AIAssistantProps {
  hideHeader?: boolean
}

export function AIAssistant({ hideHeader = false }: AIAssistantProps) {
  // ... existing state and handlers ...

  return (
    <Card className="w-full border-0 shadow-none">
      {!hideHeader && (
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">AI Assistant</CardTitle>
          </div>
          <CardDescription>
            Ask questions about your tasks using natural language
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        {/* ... rest of content unchanged ... */}
      </CardContent>
    </Card>
  )
}
```

Then update FloatingAIAssistant to pass `hideHeader`:

```tsx
<AIAssistant hideHeader />
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run build`
- [x] Linting passes: `npm run lint`

#### Manual Verification:
- [ ] AIAssistant still works when rendered directly (with header)
- [ ] AIAssistant works in floating wrapper (without header)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 3: Integrate into Dashboard Layout

### Overview
Move the floating AI Assistant from DashboardClient to the layout, making it available on all dashboard pages.

### Changes Required:

#### 1. Add FloatingAIAssistant to Layout
**File**: `src/app/(dashboard)/layout.tsx`
**Changes**: Import and render FloatingAIAssistant

```tsx
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { FloatingAIAssistant } from '@/components/rag/floating-ai-assistant'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-64">
        <Header />
        <main className="p-6">{children}</main>
      </div>
      <FloatingAIAssistant />
    </div>
  )
}
```

#### 2. Remove AIAssistant from DashboardClient
**File**: `src/app/(dashboard)/dashboard-client.tsx`
**Changes**: Remove the AIAssistant import and rendering

Remove import at line 12:
```tsx
// Remove this line
import { AIAssistant } from '@/components/rag/ai-assistant'
```

Remove rendering at line 233:
```tsx
// Remove this line
<AIAssistant />
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run build`
- [x] Linting passes: `npm run lint`
- [x] Dev server runs without errors: `npm run dev`

#### Manual Verification:
- [ ] Floating AI Assistant appears on Dashboard page
- [ ] Floating AI Assistant appears on Tasks page
- [ ] Floating AI Assistant appears on Task detail pages
- [ ] No duplicate AI Assistant on Dashboard
- [ ] Toggle button opens/closes the panel

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 4: Polish Animations and Responsive Behavior

### Overview
Add smooth animations and ensure the floating assistant works well on different screen sizes.

### Changes Required:

#### 1. Enhance FloatingAIAssistant Styling
**File**: `src/components/rag/floating-ai-assistant.tsx`
**Changes**: Add responsive width, better animations, and click-outside-to-close

```tsx
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
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `npm run build`
- [x] Linting passes: `npm run lint`

#### Manual Verification:
- [ ] Click outside the panel closes it
- [ ] Panel has smooth open/close animations
- [ ] Panel is responsive on mobile viewports (90vw width)
- [ ] Button has hover and active states
- [ ] Panel does not extend below viewport on small screens

**Implementation Note**: After completing this phase, the feature is complete.

---

## Testing Strategy

### Manual Testing Steps:
1. Navigate to Dashboard - verify floating button visible
2. Click button - verify panel opens with animation
3. Submit a query - verify response appears correctly
4. Click outside panel - verify it closes
5. Navigate to Tasks page - verify button still visible
6. Open panel on Tasks page - verify it works
7. Test on mobile viewport (resize browser) - verify responsive behavior
8. Verify panel doesn't overlap with sidebar

## Performance Considerations

- The AIAssistant component is already client-side with lazy loading
- No additional API calls unless user opens and submits a query
- Click-outside listener is only active when panel is open

## References

- Current AIAssistant: `src/components/rag/ai-assistant.tsx:32`
- Layout structure: `src/app/(dashboard)/layout.tsx:4`
- Sidebar positioning pattern: `src/components/layout/sidebar.tsx:24`
- Dialog animation patterns: `src/components/ui/dialog.tsx:50-82`
