# Touchline Implementation Plan (Efficient)

## Overview

Build a multi-tenant game day operations platform demonstrating enterprise-grade multi-tenancy, feature flags, and RAG-ready architecture.

**Supabase Project ID**: `pkursirhunyfkagmcryr`
**Supabase URL**: `https://pkursirhunyfkagmcryr.supabase.co`

## Current State

- [x] Database schema created (6 tables with RLS)
- [x] Seed data loaded (2 orgs, 7 users, 11 tasks)
- [x] Supabase Auth integration (auth_id column, auth-based RLS)
- [x] Next.js project with shadcn/ui
- [x] Basic layout components created
- [x] Auth UI (login/signup pages, middleware, auth context)
- [x] Task dashboard
- [x] Photo upload
- [ ] RAG system

## Desired End State

A working Next.js 14 application with:
1. **Real Supabase Auth** - Login/signup with proper session handling
2. **Multi-tenant architecture** - Two orgs (LA Galaxy, Portland Thorns) with RLS isolation via `auth.uid()`
3. **Feature A: Department-Based Tasks** - LA Galaxy gets department filtering/grouping
4. **Feature B: Photo Verification** - Portland Thorns requires photo upload for certain tasks
5. **RAG System** - Tenant-isolated semantic search via pgvector + Gemini API
6. **Professional UI** - shadcn/ui components, clean dashboard

### Verification Criteria
- LA Galaxy: department dropdown required, department filters, grouped task view
- Portland Thorns: photo upload UI, audit log, blocked completion without photo
- Login as different users shows different data via RLS
- AI Assistant returns only tenant-scoped results

## What We're NOT Doing

- Production deployment
- Real-time updates
- Mobile responsiveness
- Comprehensive error handling
- Password reset flow (users can sign up fresh)

---

## Phase 1: Database Schema & Seed Data ✅ COMPLETE

### Overview
Set up complete database schema with RLS, extensions, and seed data via Supabase MCP.

### 1.1 Enable Extensions ✅
**Migration**: `enable_extensions`
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
```

### 1.2 Create Tables ✅
**Migration**: `create_tables`
```sql
-- Organizations (tenants)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  feature_config JSONB NOT NULL DEFAULT '{
    "features": {
      "departments": { "enabled": false, "required": false, "list": [] },
      "photoVerification": { "enabled": false, "requiredForTasks": [] }
    }
  }',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (linked to auth.users via auth_id)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,  -- Links to Supabase Auth
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'department_head', 'staff')),
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, email)
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  department TEXT,
  requires_photo BOOLEAN DEFAULT FALSE,
  custom_data JSONB DEFAULT '{}',
  assigned_to UUID REFERENCES users(id),
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Photos
CREATE TABLE task_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Audit Log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Embeddings (RAG)
CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  content_id UUID NOT NULL,
  content_text TEXT NOT NULL,
  embedding vector(768) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, content_type, content_id)
);

-- Indexes
CREATE INDEX idx_users_auth_id ON users(auth_id);
CREATE INDEX idx_tasks_org_id ON tasks(org_id);
CREATE INDEX idx_tasks_department ON tasks(org_id, department);
CREATE INDEX idx_tasks_status ON tasks(org_id, status);
CREATE INDEX idx_task_photos_task_id ON task_photos(task_id);
CREATE INDEX idx_audit_log_entity ON audit_log(org_id, entity_type, entity_id);
CREATE INDEX idx_embeddings_org_content ON embeddings(org_id, content_type);
CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops);
```

### 1.3 Create RLS Policies (Auth-Based) ✅
**Migration**: `update_rls_for_supabase_auth`

RLS policies now use `auth.uid()` to get the authenticated user and look up their org/role from public.users:

```sql
-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- Auth-based helper functions (use auth.uid() from Supabase Auth)
CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS UUID AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_org_id() RETURNS UUID AS $$
  SELECT org_id FROM public.users WHERE auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_department() RETURNS TEXT AS $$
  SELECT department FROM public.users WHERE auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Organization policies
CREATE POLICY "org_select" ON organizations FOR SELECT
  USING (id = public.current_org_id());

-- User policies
CREATE POLICY "user_select" ON users FOR SELECT
  USING (org_id = public.current_org_id());

-- Task policies (with role-based access)
CREATE POLICY "task_select" ON tasks FOR SELECT USING (
  org_id = public.current_org_id()
  AND (
    public.current_user_role() IN ('admin', 'manager')
    OR (public.current_user_role() = 'department_head'
        AND (department = public.current_user_department() OR department IS NULL))
    OR public.current_user_role() = 'staff'
  )
);

CREATE POLICY "task_insert" ON tasks FOR INSERT
  WITH CHECK (org_id = public.current_org_id());

CREATE POLICY "task_update" ON tasks FOR UPDATE USING (
  org_id = public.current_org_id()
  AND (
    public.current_user_role() IN ('admin', 'manager')
    OR (public.current_user_role() = 'department_head'
        AND department = public.current_user_department())
  )
);

-- Photo policies
CREATE POLICY "photo_select" ON task_photos FOR SELECT
  USING (org_id = public.current_org_id());

CREATE POLICY "photo_insert" ON task_photos FOR INSERT
  WITH CHECK (org_id = public.current_org_id());

-- Audit log policies
CREATE POLICY "audit_select" ON audit_log FOR SELECT
  USING (org_id = public.current_org_id());

CREATE POLICY "audit_insert" ON audit_log FOR INSERT
  WITH CHECK (org_id = public.current_org_id());

-- Embedding policies (critical for RAG tenant isolation)
CREATE POLICY "embedding_select" ON embeddings FOR SELECT
  USING (org_id = public.current_org_id());

CREATE POLICY "embedding_insert" ON embeddings FOR INSERT
  WITH CHECK (org_id = public.current_org_id());
```

### 1.4 Create Database Functions ✅
**Migration**: `create_functions`
```sql
-- Validate task completion (check photo requirement)
CREATE OR REPLACE FUNCTION validate_task_completion(p_task_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  task_record RECORD;
  photo_count INT;
BEGIN
  SELECT t.*, o.feature_config
  INTO task_record
  FROM tasks t
  JOIN organizations o ON t.org_id = o.id
  WHERE t.id = p_task_id;

  IF NOT (task_record.feature_config->'features'->'photoVerification'->>'enabled')::boolean THEN
    RETURN TRUE;
  END IF;

  IF NOT task_record.requires_photo THEN
    RETURN TRUE;
  END IF;

  SELECT COUNT(*) INTO photo_count FROM task_photos WHERE task_id = p_task_id;
  RETURN photo_count > 0;
END;
$$ LANGUAGE plpgsql;

-- RAG search function (tenant-isolated)
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),
  query_org_id UUID,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content_type TEXT,
  content_id UUID,
  content_text TEXT,
  similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.content_type,
    e.content_id,
    e.content_text,
    1 - (e.embedding <=> query_embedding) as similarity
  FROM embeddings e
  WHERE e.org_id = query_org_id
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### 1.5 Seed Data ✅
Organizations and users are seeded. Auth users will be created via signup flow.

**Test Credentials** (create these accounts via signup):

| Organization | Email | Password | Role | Department |
|-------------|-------|----------|------|------------|
| LA Galaxy | admin@lagalaxy.com | password123 | admin | - |
| LA Galaxy | ops@lagalaxy.com | password123 | department_head | Operations |
| LA Galaxy | security@lagalaxy.com | password123 | department_head | Security |
| LA Galaxy | medical@lagalaxy.com | password123 | department_head | Medical |
| Portland Thorns | admin@thorns.com | password123 | admin | - |
| Portland Thorns | staff1@thorns.com | password123 | staff | - |
| Portland Thorns | staff2@thorns.com | password123 | staff | - |

### Success Criteria ✅

#### Automated Verification (via MCP)
- [x] `mcp__supabase__list_tables` returns 6 tables
- [x] `mcp__supabase__list_extensions` shows uuid-ossp and vector enabled
- [x] `mcp__supabase__execute_sql` with `SELECT COUNT(*) FROM organizations` returns 2
- [x] `mcp__supabase__execute_sql` with `SELECT COUNT(*) FROM tasks` returns 11
- [x] users table has `auth_id` column
- [x] RLS helper functions use `auth.uid()` not request headers

---

## Phase 2: Next.js Project Setup ✅ COMPLETE

### Overview
Create Next.js project with all dependencies and initial configuration.

### 2.1 Create Next.js Project ✅
```bash
cd /Users/arvinhakakian/Code/arkero-takehome-assignment
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

### 2.2 Install Dependencies ✅
```bash
# Supabase
npm install @supabase/supabase-js @supabase/ssr

# UI Components
npm install lucide-react class-variance-authority clsx tailwind-merge
npx shadcn@latest init -d

# shadcn components (batch)
npx shadcn@latest add button card input label select badge dialog dropdown-menu table tabs avatar separator skeleton sonner checkbox textarea

# Form handling
npm install react-hook-form @hookform/resolvers zod

# Date handling
npm install date-fns

# Gemini for RAG
npm install @google/generative-ai
```

### 2.3 Create `.env.local` ✅
```env
NEXT_PUBLIC_SUPABASE_URL=https://pkursirhunyfkagmcryr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<get from mcp__supabase__get_publishable_keys>
SUPABASE_SERVICE_ROLE_KEY=<get from Supabase dashboard>
GEMINI_API_KEY=<user provides>
```

### 2.4 Files Created ✅

| Path | Purpose |
|------|---------|
| `src/lib/supabase/client.ts` | Browser Supabase client |
| `src/lib/supabase/server.ts` | Server-side Supabase client with cookies |
| `src/lib/supabase/admin.ts` | Service role client (bypasses RLS) |
| `src/lib/utils.ts` | cn() helper, formatDate, formatRelativeTime |
| `src/types/database.ts` | TypeScript interfaces for all tables |

### Success Criteria ✅

#### Automated Verification
- [x] `npm run dev` starts without errors
- [x] `npm run build` completes successfully
- [x] No TypeScript errors

---

## Phase 3: Auth & Layout System ✅ COMPLETE

### Overview
Build authentication flow, app shell (sidebar, header), and FeatureGate component.

### 3.1 Auth Files to Create

| Path | Purpose |
|------|---------|
| `src/middleware.ts` | Supabase auth session refresh middleware |
| `src/app/(auth)/login/page.tsx` | Login page |
| `src/app/(auth)/signup/page.tsx` | Signup page with org selection |
| `src/app/(auth)/layout.tsx` | Auth pages layout (centered card) |
| `src/lib/actions/auth.ts` | Server actions for login/signup/logout |

### 3.2 Layout Files to Create

| Path | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout with Toaster |
| `src/app/(dashboard)/layout.tsx` | Dashboard layout with Sidebar + Header |
| `src/components/layout/sidebar.tsx` | Nav links, conditional Audit Log link |
| `src/components/layout/header.tsx` | User info + Logout button |
| `src/components/features/feature-gate.tsx` | Conditional rendering based on feature flags |
| `src/lib/features/hooks.ts` | useFeature, useDepartments, usePhotoVerification hooks |
| `src/lib/context/auth-context.tsx` | Auth state provider (user, org, loading) |

### 3.3 Key Implementation Details

**Middleware** (`src/middleware.ts`):
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect to login if not authenticated and trying to access dashboard
  if (!user && !request.nextUrl.pathname.startsWith('/login') && !request.nextUrl.pathname.startsWith('/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect to dashboard if authenticated and on auth pages
  if (user && (request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**Signup Flow** (Claim Account):
1. User selects organization (LA Galaxy or Portland Thorns)
2. User selects their pre-seeded user profile from dropdown (shows users without auth_id)
3. User creates a password (min 6 characters)
4. On signup:
   - Create auth.users entry via `supabase.auth.signUp()` with selected user's email
   - Update public.users.auth_id with the new auth user's ID
5. Redirect to dashboard

**Auth Context**:
```typescript
// Provides: user (auth.users), profile (public.users), organization, loading, signOut
// Fetches profile and org after auth state changes
```

**FeatureGate Component**:
```tsx
// Reads from organization.feature_config.features[feature].enabled
// Renders children if enabled, fallback otherwise
```

**Sidebar**:
- Dashboard, Tasks links always visible
- Audit Log link only visible when `photoVerification.enabled`
- Logout button at bottom

### Success Criteria

#### Automated Verification
- [x] `npm run dev` starts without errors
- [x] `npm run build` completes

#### Manual Verification
- [ ] Can sign up as LA Galaxy admin (admin@lagalaxy.com)
- [ ] Can sign up as Portland Thorns admin (admin@thorns.com)
- [ ] After signup, auth_id is linked in public.users
- [ ] Can login with created accounts
- [ ] Sidebar renders with navigation
- [ ] Logout works and redirects to login
- [ ] Audit Log link only appears for Portland Thorns users

---

## Phase 4: Task Dashboard & CRUD

### Overview
Build main dashboard with task list, filtering, task detail page, and CRUD operations.

### 4.1 Files to Create

| Path | Purpose |
|------|---------|
| `src/app/(dashboard)/page.tsx` | Dashboard with stats, tasks, AI Assistant |
| `src/app/(dashboard)/tasks/page.tsx` | All tasks list with search/filter |
| `src/app/(dashboard)/tasks/[id]/page.tsx` | Task detail view |
| `src/app/(dashboard)/tasks/new/page.tsx` | Create task form |
| `src/components/tasks/task-card.tsx` | Task card with status, priority, badges |
| `src/components/tasks/department-filter.tsx` | Department filter chips (LA Galaxy) |
| `src/components/tasks/task-status-select.tsx` | Status dropdown |
| `src/lib/actions/tasks.ts` | Server actions for task CRUD |

### 4.2 Key Implementation Details

**Dashboard**:
- Stats cards: Total, Pending, In Progress, Completed
- FeatureGate wraps DepartmentFilter
- Tasks grouped by department if `departments.enabled`
- New Task button

**Task Card**:
- Shows title, description, status badge, priority badge
- FeatureGate shows department badge (LA Galaxy)
- FeatureGate shows "Photo required" badge (Portland Thorns)
- Due date with relative time

**Task Detail**:
- Full task info with status update dropdown
- FeatureGate shows photo section (Portland Thorns)
- Photo upload blocks completion if required

**Task Creation**:
- Title, description, priority, due date fields
- FeatureGate shows department dropdown (LA Galaxy, required)
- FeatureGate shows photo requirement checkbox (Portland Thorns)

**Data Fetching** (uses RLS automatically):
```typescript
// Server component - uses server client which has auth session
const supabase = await createClient()
const { data: tasks } = await supabase.from('tasks').select('*')
// RLS automatically filters to current user's org!
```

### Success Criteria

#### Automated Verification
- [x] `npm run dev` starts without errors
- [x] `npm run build` completes

#### Manual Verification
- [ ] Login as LA Galaxy admin → see only LA Galaxy tasks
- [ ] Login as Portland Thorns admin → see only Portland Thorns tasks
- [ ] Stats cards show correct counts for logged-in user's org
- [ ] LA Galaxy: Department filter visible, tasks grouped
- [ ] Portland Thorns: No department filter, "Photo required" badges visible
- [ ] Can create tasks with org-specific fields
- [ ] Task detail page loads
- [ ] RLS properly isolates data (can't see other org's tasks)

---

## Phase 5: Photo Verification & Audit Log

### Overview
Implement photo upload for Portland Thorns and audit log viewer.

### 5.1 Setup Supabase Storage ✅

In Supabase Dashboard:
1. Go to Storage → Create bucket `task-photos`
2. Keep as **private** bucket (for secure storage per requirements)
3. Apply RLS policies for tenant-isolated access:

```sql
-- Only authenticated users from the same org can view photos
CREATE POLICY "Users can view their org photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-photos'
  AND (storage.foldername(name))[1] = (SELECT org_id::text FROM public.users WHERE auth_id = auth.uid())
);

-- Only authenticated users can upload to their org folder
CREATE POLICY "Users can upload to their org folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-photos'
  AND (storage.foldername(name))[1] = (SELECT org_id::text FROM public.users WHERE auth_id = auth.uid())
);

-- Users can delete photos in their org folder
CREATE POLICY "Users can delete their org photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-photos'
  AND (storage.foldername(name))[1] = (SELECT org_id::text FROM public.users WHERE auth_id = auth.uid())
);
```

File path structure: `{org_id}/{task_id}/{timestamp}-{filename}` ensures tenant isolation.

### 5.2 Files to Create

| Path | Purpose |
|------|---------|
| `src/components/tasks/photo-upload.tsx` | Drag-drop photo upload |
| `src/components/tasks/photo-gallery.tsx` | Display uploaded photos |
| `src/app/(dashboard)/audit/page.tsx` | Audit log table |
| `src/lib/actions/photos.ts` | Server actions for photo upload |

### 5.3 Key Implementation Details

**Photo Upload**:
- Drag/drop or file select
- Upload to Supabase Storage: `{orgId}/{taskId}/{timestamp}-{filename}`
- Create task_photos record
- Log to audit_log

**Task Completion Validation**:
- If `requires_photo && photos.length === 0`, show toast and block
- After successful upload, re-enable completion

**Audit Log**:
- Fetch audit_log joined with users (RLS filters to current org automatically)
- Display time, user, action, entity, metadata
- Action badges with colors
- Only accessible when photoVerification enabled (redirect otherwise)

### Success Criteria

#### Automated Verification
- [x] `npm run dev` starts without errors
- [x] `npm run build` completes

#### Manual Verification
- [ ] Portland Thorns: Photo upload UI appears on photo-required tasks
- [ ] Portland Thorns: Cannot complete photo-required task without photo
- [ ] Portland Thorns: Can upload photo (appears in gallery)
- [ ] Portland Thorns: Can complete task after photo upload
- [ ] Portland Thorns: Audit log shows all activities
- [ ] LA Galaxy: No photo UI, can complete any task

---

## Phase 6: RAG System with Gemini

### Overview
Implement tenant-isolated semantic search using pgvector embeddings and Gemini API.

### 6.1 Files to Create

| Path | Purpose |
|------|---------|
| `src/lib/rag/embeddings.ts` | Generate embeddings via Gemini gemini-embedding-001 |
| `src/lib/rag/search.ts` | Search similar content via pgvector |
| `src/lib/rag/query.ts` | RAG query: embed → search → generate response |
| `src/lib/rag/sync.ts` | Sync task embeddings on create/update |
| `src/app/api/rag/query/route.ts` | POST endpoint for RAG queries |
| `src/components/rag/ai-assistant.tsx` | AI chat component |
| `src/scripts/seed-embeddings.ts` | Seed embeddings for existing tasks |

### 6.2 Key Implementation Details

**Embedding Generation**:
```ts
// Use gemini-embedding-001 model (text-embedding-004 deprecated Jan 2026)
// Returns 768-dimension vector (configurable: 768, 1536, or 3072)
```

**Vector Search** (via match_documents function):
```ts
// Pass current user's org_id to ensure tenant isolation
// Returns matching documents with similarity scores
```

**RAG Query Flow**:
1. Generate embedding for user question
2. Search embeddings (tenant-isolated via org_id from current auth user)
3. Build context from top results
4. Generate response with Gemini Pro
5. Return answer + sources + confidence

**AI Assistant Component**:
- Input for natural language questions
- Loading state
- Response with confidence badge
- Source links to task detail pages
- Example questions when empty

**Auto-Embed on Create**:
- After task creation, call syncTaskEmbedding (non-blocking)

### 6.3 Seed Embeddings
Run after Phase 6 complete:
```bash
npx tsx src/scripts/seed-embeddings.ts
```

### Success Criteria

#### Automated Verification
- [ ] `npm run dev` starts without errors
- [ ] `npm run build` completes
- [ ] `mcp__supabase__execute_sql` with `SELECT COUNT(*) FROM embeddings` shows records

#### Manual Verification
- [ ] AI Assistant appears on dashboard
- [ ] Can ask "What security tasks are pending?" and get relevant response
- [ ] Sources link to correct tasks
- [ ] LA Galaxy queries return ONLY LA Galaxy tasks
- [ ] Portland Thorns queries return ONLY Portland Thorns tasks
- [ ] Confidence levels display correctly

---

## Phase 7: Polish & Demo Prep

### Overview
Final touches, bug fixes, and verification.

### 7.1 Tasks

1. Add loading states and skeletons
2. Add empty states (no tasks)
3. Error boundaries for failed queries
4. Run `npm run lint` and fix issues
5. Run `npm run build` and fix any errors
6. Test complete demo flow

### 7.2 Demo Flow Verification

**LA Galaxy Flow** (login as admin@lagalaxy.com):
1. See department filter on dashboard
2. Filter by a department
3. Create new task (department required)
4. View task detail
5. Complete task (no photo needed)
6. Use AI Assistant: "What tasks are urgent?"

**Portland Thorns Flow** (login as admin@thorns.com):
1. Note: no department filter, "Photo required" badges visible
2. Click photo-required task
3. Try to complete → blocked with toast message
4. Upload photo
5. Complete task
6. View Audit Log (shows photo upload + completion)
7. Use AI Assistant: "Summarize pending tasks"

**RLS Verification**:
1. Login as LA Galaxy → can only see LA Galaxy data
2. Login as Portland Thorns → can only see Portland Thorns data
3. Attempt direct API calls → RLS blocks cross-org access

### Success Criteria

#### Automated Verification
- [ ] `npm run build` passes
- [ ] `npm run lint` passes

#### Manual Verification
- [ ] Complete LA Galaxy demo flow
- [ ] Complete Portland Thorns demo flow
- [ ] RLS properly isolates all data
- [ ] UI is clean and professional

---

## Summary

| Phase | Focus | Key Deliverables |
|-------|-------|------------------|
| 1 ✅ | Database | Schema, auth-based RLS, functions, seed data |
| 2 ✅ | Project Setup | Next.js, dependencies, config |
| 3 ✅ | Auth & Layout | Login/signup, middleware, sidebar, FeatureGate |
| 4 | Task Dashboard | CRUD, filtering, task cards |
| 5 | Photo & Audit | Upload, validation, audit log |
| 6 | RAG System | Embeddings, search, AI Assistant |
| 7 | Polish | Bug fixes, demo prep |

**Architecture Highlights for Arkero**:
- **Real Supabase Auth** with proper session handling
- **Multi-tenancy with RLS** using `auth.uid()` (not WHERE clauses or headers)
- Feature flags via JSONB config
- RAG with tenant-isolated embeddings
- Clean React patterns (server components, server actions)
