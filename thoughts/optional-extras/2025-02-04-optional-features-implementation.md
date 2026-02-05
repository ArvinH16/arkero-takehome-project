# Optional Features Implementation Plan

## Overview

Implementation plan for two optional features to enhance the task management dashboard: an AI Task Generator and a Game Day Context Banner. These should only be implemented after the core application is complete.

## Prerequisites

- Core application phases 1-7 must be complete and working
- GEMINI_API_KEY must be configured in environment
- All existing tests passing

## What We're NOT Doing

- News-based task suggestions (too complex, mention in README only)
- Authentication for the generate API (already handled by Supabase client-side)
- Server-side embedding sync for generated tasks (handled by existing task triggers)

---

## Phase 1: AI Task Generator

### Overview

Add a button to the dashboard that uses Gemini to generate realistic game day tasks, pre-populated with organization-specific context.

### Changes Required

#### 1. API Route

**File:** `src/app/api/tasks/generate/route.ts` (new file)

Create POST endpoint that:
- Accepts org context (name, departments, photo verification settings)
- Calls Gemini `gemini-2.5-flash` model with structured prompt
- Returns JSON array of generated tasks

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { orgId, orgName, departments, photoVerificationEnabled } = await request.json()

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `Generate 5 realistic game day operations tasks for ${orgName} (professional soccer team).
${departments?.length ? `Assign to these departments: ${departments.join(', ')}` : ''}
${photoVerificationEnabled ? 'Some tasks should require photo verification for compliance.' : ''}

Return ONLY a JSON array with this exact format:
[{
  "title": "Task title",
  "description": "Brief description",
  "priority": "high" | "medium" | "low" | "urgent",
  "department": "Department name or null",
  "requires_photo": true | false
}]`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const tasks = JSON.parse(text.replace(/```json?|```/g, '').trim())

  return NextResponse.json({ tasks })
}
```

#### 2. UI Component

**File:** `src/components/tasks/ai-task-generator.tsx` (new file)

Create button component that:
- Uses `useAuth()` to get organization and profile
- Uses `useDepartments()` and `usePhotoVerification()` hooks for context
- Calls API endpoint and inserts generated tasks via Supabase client
- Shows loading state and toast notifications

#### 3. Dashboard Integration

**File:** `src/app/(dashboard)/dashboard-client.tsx`

Update header section (around line 65-70) to include the generator button:
- Add `useRouter` import for refresh capability
- Import `AITaskGenerator` component
- Wrap buttons in flex container with gap

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build`
- [ ] Lint passes: `npm run lint`

#### Manual Verification:
- [ ] Button appears on dashboard next to "New Task"
- [ ] Clicking button shows loading state
- [ ] Generated tasks appear in task list after generation
- [ ] LA Galaxy generates tasks with departments
- [ ] Portland Thorns generates tasks with photo requirements
- [ ] Toast notification shows on success/error

---

## Phase 2: Game Day Context Banner

### Overview

Add a banner at the top of the dashboard showing upcoming game information for demo purposes.

### Changes Required

#### 1. Banner Component

**File:** `src/components/game-day-banner.tsx` (new file)

Create component that:
- Uses `useAuth()` to get organization slug
- Looks up hardcoded game info by org slug
- Returns null if no matching game info
- Renders gradient banner with game details and icons

#### 2. Dashboard Integration

**File:** `src/app/(dashboard)/dashboard-client.tsx`

- Import `GameDayBanner` component
- Add `<GameDayBanner />` at the top of the return, inside the outer div

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build`
- [ ] Lint passes: `npm run lint`

#### Manual Verification:
- [ ] Banner appears at top of dashboard
- [ ] LA Galaxy shows "vs Seattle Sounders FC" game info
- [ ] Portland Thorns shows "vs OL Reign" game info
- [ ] Banner styling matches design (gradient, rounded, proper spacing)
- [ ] Icons display correctly (Calendar, Users, MapPin)

---

## Testing Strategy

### Manual Testing Steps

1. **AI Task Generator:**
   - Log in as LA Galaxy user
   - Click "Generate Game Day Tasks"
   - Verify 5 tasks created with department assignments
   - Log in as Portland Thorns user
   - Click "Generate Game Day Tasks"
   - Verify some tasks have `requires_photo: true`

2. **Game Day Banner:**
   - Log in as LA Galaxy user
   - Verify banner shows Seattle Sounders match
   - Log in as Portland Thorns user
   - Verify banner shows OL Reign match

### Edge Cases

- [ ] No GEMINI_API_KEY configured → graceful error
- [ ] API returns malformed JSON → graceful error
- [ ] Unknown organization slug → banner doesn't render

---

## References

- Feature hooks: `src/lib/features/hooks.ts`
- Auth context: `src/lib/context/auth-context.tsx`
- Existing RAG API: `src/app/api/rag/query/route.ts`
- Dashboard client: `src/app/(dashboard)/dashboard-client.tsx`
