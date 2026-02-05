# Permanent AI Chat Bar Design

## Overview

Transform the floating AI assistant button into a permanent bottom bar that's always visible, with a horizontally scrolling carousel of suggested questions and expandable conversation view.

## Current State

- `FloatingAIAssistant`: Floating button in bottom-right, opens popup on click
- `AIAssistant`: Core chat component with query input, loading states, response display
- Suggested questions shown as static buttons (not scrolling)

## Target State

- Permanent full-width bar fixed at bottom of screen
- Always visible input field with scrolling suggestion carousel
- Expands upward to show conversation when active
- Auto-scrolling suggestions with manual navigation

---

## Design Specifications

### Layout & Positioning

- **Position**: `fixed bottom-0 left-64 right-0` (left offset for sidebar)
- **Collapsed height**: ~60px
- **Expanded max height**: 50vh
- **Z-index**: 40 (below modals, above content)

### Collapsed State (~60px)

```
┌─────────────────────────────────────────────────────────────────┐
│ ← [Chip 1] [Chip 2] [Chip 3] [Chip 4] [Chip 5] [Chip 6] →      │
│ [Bot icon] [Ask about your tasks...                    ] [Send] │
└─────────────────────────────────────────────────────────────────┘
```

- Single row of suggestion chips scrolling horizontally
- Input field with bot icon and send button
- Left/right arrows appear on hover at carousel edges

### Expanded State (up to 50vh)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                    [Minimize ▼] │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ User: What tasks are pending?                               │ │
│ │                                                             │ │
│ │ AI: You have 3 pending tasks:                               │ │
│ │ - Task A (high priority)                                    │ │
│ │ - Task B (medium priority)                                  │ │
│ │ - Task C (low priority)                                     │ │
│ │ [Sources: Task A (95%), Task B (87%), Task C (82%)]         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ← [Follow-up 1] [Follow-up 2] [Follow-up 3] →                   │
│ [Bot icon] [Ask about your tasks...                    ] [Send] │
└─────────────────────────────────────────────────────────────────┘
```

- Messages area with scroll (newest at bottom)
- Minimize button to collapse
- Suggestion carousel updates to show AI follow-up suggestions

### Suggestion Carousel Behavior

1. **Auto-scroll**: Slowly scrolls right, pauses 3s on each suggestion
2. **Hover pause**: Stops auto-scroll when user hovers
3. **Manual navigation**:
   - Arrow buttons at edges (appear on hover)
   - Drag/swipe to scroll
4. **Content (Hybrid)**:
   - Initial: Static suggestions from predefined list
   - After response: `suggestedQuestions` from API, fallback to static

### Conversation Indicator (when collapsed with active conversation)

- Small pulsing dot next to bot icon
- Or text: "Continue conversation..." as placeholder

---

## Implementation Plan

### Phase 1: Create PermanentAIBar Component ✅

**File**: `src/components/rag/permanent-ai-bar.tsx`

**Tasks**:
1. [x] Create new component with collapsed/expanded state
2. [x] Build suggestion carousel with horizontal scroll
3. [x] Implement auto-scroll with pause on hover
4. [x] Add arrow navigation buttons
5. [x] Port input form from existing AIAssistant

**Dependencies**: None

### Phase 2: Build Conversation Display ✅

**File**: `src/components/rag/permanent-ai-bar.tsx`

**Tasks**:
1. [x] Add message history state (user messages + AI responses)
2. [x] Build message list component with proper styling
3. [x] Implement expand/collapse animation (smooth height transition)
4. [x] Add minimize button
5. [x] Handle scroll-to-bottom on new messages

**Dependencies**: Phase 1

### Phase 3: Integrate Hybrid Suggestions ✅

**File**: `src/components/rag/permanent-ai-bar.tsx`

**Tasks**:
1. [x] Track suggestion source (static vs AI-provided)
2. [x] Update carousel content after AI response
3. [x] Reset to static suggestions on conversation clear
4. [x] Add visual distinction for AI-suggested follow-ups (sparkle icon)

**Dependencies**: Phase 2

### Phase 4: Update Layout Integration ✅

**Files**:
- `src/app/(dashboard)/layout.tsx`
- `src/components/rag/floating-ai-assistant.tsx` (delete)

**Tasks**:
1. [x] Replace FloatingAIAssistant with PermanentAIBar in layout
2. [x] Add bottom padding to main content area (`pb-32`)
3. [x] Delete old FloatingAIAssistant component
4. [ ] Test on various screen sizes

**Dependencies**: Phase 3

### Phase 5: Polish & Mobile Responsive ✅

**File**: `src/components/rag/permanent-ai-bar.tsx`

**Tasks**:
1. [x] Add conversation indicator when collapsed with history (pulsing dot + "Continue" button)
2. [x] Smooth animations for all transitions (animate-in classes)
3. [x] Mobile responsive adjustments (full width on mobile, sidebar offset on md+)
4. [x] Keyboard accessibility (arrow keys for carousel)
5. [x] Touch/swipe support for carousel (touch-pan-x, snap-x)

**Dependencies**: Phase 4

---

## Technical Notes

### State Management

```typescript
interface PermanentAIBarState {
  isExpanded: boolean
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
    sources?: Source[]
    confidence?: 'high' | 'medium' | 'low'
  }>
  suggestions: string[]
  suggestionsSource: 'static' | 'ai'
  isLoading: boolean
}
```

### Animation

- Use CSS transitions for height changes
- `max-height` transition from 60px to 50vh
- Consider `framer-motion` if smoother animations needed (check if already in deps)

### Carousel Implementation

- Use CSS `overflow-x: auto` with `scroll-snap-type`
- Or use existing carousel library if available in project
- Auto-scroll via `setInterval` + `scrollLeft` manipulation

---

## Files Changed

| File | Action |
|------|--------|
| `src/components/rag/permanent-ai-bar.tsx` | Create |
| `src/components/rag/floating-ai-assistant.tsx` | Delete |
| `src/app/(dashboard)/layout.tsx` | Modify |

## Testing Checklist

- [ ] Bar visible on all dashboard pages
- [ ] Carousel auto-scrolls and pauses on hover
- [ ] Arrow navigation works
- [ ] Input submits query correctly
- [ ] Conversation expands smoothly
- [ ] Messages display with sources and confidence
- [ ] Suggestions update after AI response
- [ ] Minimize collapses back to bar
- [ ] Collapsed state shows conversation indicator
- [ ] Mobile responsive (no sidebar offset)
- [ ] Keyboard accessible
