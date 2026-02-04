# Touchline Implementation Plan (Efficient)

## Overview

Build a multi-tenant game day operations platform demonstrating enterprise-grade multi-tenancy, feature flags, and RAG-ready architecture.

**Supabase Project ID**: `pkursirhunyfkagmcryr`
**Supabase URL**: `https://pkursirhunyfkagmcryr.supabase.co`

## Current State

- Empty Supabase project (no tables)
- No application code
- Architecture docs complete

## Desired End State

A working Next.js 14 application with:
1. **Multi-tenant architecture** - Two orgs (LA Galaxy, Portland Thorns) with RLS isolation
2. **Feature A: Department-Based Tasks** - LA Galaxy gets department filtering/grouping
3. **Feature B: Photo Verification** - Portland Thorns requires photo upload for certain tasks
4. **RAG System** - Tenant-isolated semantic search via pgvector + Gemini API
5. **Professional UI** - shadcn/ui components, clean dashboard

### Verification Criteria
- LA Galaxy: department dropdown required, department filters, grouped task view
- Portland Thorns: photo upload UI, audit log, blocked completion without photo
- Org switching toggles features appropriately
- AI Assistant returns only tenant-scoped results

## What We're NOT Doing

- Real authentication (mock auth with org switcher)
- Production deployment
- Real-time updates
- Mobile responsiveness
- Comprehensive error handling

---

## Phase 1: Database Schema & Seed Data

### Overview
Set up complete database schema with RLS, extensions, and seed data via Supabase MCP.

### 1.1 Enable Extensions
Apply migration via MCP: `mcp__supabase__apply_migration`

**Migration name**: `enable_extensions`
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
```

### 1.2 Create Tables
Apply migration via MCP: `mcp__supabase__apply_migration`

**Migration name**: `create_tables`
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

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE INDEX idx_tasks_org_id ON tasks(org_id);
CREATE INDEX idx_tasks_department ON tasks(org_id, department);
CREATE INDEX idx_tasks_status ON tasks(org_id, status);
CREATE INDEX idx_task_photos_task_id ON task_photos(task_id);
CREATE INDEX idx_audit_log_entity ON audit_log(org_id, entity_type, entity_id);
CREATE INDEX idx_embeddings_org_content ON embeddings(org_id, content_type);
CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops);
```

### 1.3 Create RLS Policies
Apply migration via MCP: `mcp__supabase__apply_migration`

**Migration name**: `create_rls_policies`
```sql
-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS context (via request headers)
CREATE OR REPLACE FUNCTION auth.current_org_id() RETURNS UUID AS $$
  SELECT COALESCE(
    (current_setting('request.headers', true)::json->>'x-org-id')::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION auth.current_user_id() RETURNS UUID AS $$
  SELECT COALESCE(
    (current_setting('request.headers', true)::json->>'x-user-id')::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION auth.current_user_role() RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.current_user_id();
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION auth.current_user_department() RETURNS TEXT AS $$
  SELECT department FROM users WHERE id = auth.current_user_id();
$$ LANGUAGE SQL STABLE;

-- Organization policies
CREATE POLICY "org_select" ON organizations FOR SELECT USING (id = auth.current_org_id());

-- User policies
CREATE POLICY "user_select" ON users FOR SELECT USING (org_id = auth.current_org_id());

-- Task policies (with role-based access)
CREATE POLICY "task_select" ON tasks FOR SELECT USING (
  org_id = auth.current_org_id()
  AND (
    auth.current_user_role() IN ('admin', 'manager')
    OR (auth.current_user_role() = 'department_head'
        AND (department = auth.current_user_department() OR department IS NULL))
    OR auth.current_user_role() = 'staff'
  )
);
CREATE POLICY "task_insert" ON tasks FOR INSERT WITH CHECK (org_id = auth.current_org_id());
CREATE POLICY "task_update" ON tasks FOR UPDATE USING (
  org_id = auth.current_org_id()
  AND (
    auth.current_user_role() IN ('admin', 'manager')
    OR (auth.current_user_role() = 'department_head'
        AND department = auth.current_user_department())
  )
);

-- Photo policies
CREATE POLICY "photo_select" ON task_photos FOR SELECT USING (org_id = auth.current_org_id());
CREATE POLICY "photo_insert" ON task_photos FOR INSERT WITH CHECK (org_id = auth.current_org_id());

-- Audit log policies
CREATE POLICY "audit_select" ON audit_log FOR SELECT USING (org_id = auth.current_org_id());
CREATE POLICY "audit_insert" ON audit_log FOR INSERT WITH CHECK (org_id = auth.current_org_id());

-- Embedding policies (critical for RAG tenant isolation)
CREATE POLICY "embedding_select" ON embeddings FOR SELECT USING (org_id = auth.current_org_id());
CREATE POLICY "embedding_insert" ON embeddings FOR INSERT WITH CHECK (org_id = auth.current_org_id());
```

### 1.4 Create Database Functions
Apply migration via MCP: `mcp__supabase__apply_migration`

**Migration name**: `create_functions`
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

### 1.5 Seed Data
Execute via MCP: `mcp__supabase__execute_sql`

```sql
-- LA Galaxy (Department feature enabled)
INSERT INTO organizations (id, name, slug, feature_config) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'LA Galaxy',
  'la-galaxy',
  '{
    "features": {
      "departments": {
        "enabled": true,
        "required": true,
        "list": ["Operations", "Security", "Medical", "Concessions", "Facilities", "Guest Services", "Parking", "Media"]
      },
      "photoVerification": { "enabled": false, "requiredForTasks": [] }
    }
  }'
);

-- Portland Thorns (Photo verification enabled)
INSERT INTO organizations (id, name, slug, feature_config) VALUES (
  '22222222-2222-2222-2222-222222222222',
  'Portland Thorns',
  'portland-thorns',
  '{
    "features": {
      "departments": { "enabled": false, "required": false, "list": [] },
      "photoVerification": {
        "enabled": true,
        "requiredForTasks": ["security_sweep", "safety_check", "equipment_inspection"]
      }
    }
  }'
);

-- LA Galaxy Users
INSERT INTO users (id, org_id, email, name, role, department) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin@lagalaxy.com', 'Sarah Chen', 'admin', NULL),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', '11111111-1111-1111-1111-111111111111', 'ops@lagalaxy.com', 'Mike Rodriguez', 'department_head', 'Operations'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac', '11111111-1111-1111-1111-111111111111', 'security@lagalaxy.com', 'James Wilson', 'department_head', 'Security'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaad', '11111111-1111-1111-1111-111111111111', 'medical@lagalaxy.com', 'Dr. Emily Park', 'department_head', 'Medical');

-- Portland Thorns Users
INSERT INTO users (id, org_id, email, name, role, department) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbba', '22222222-2222-2222-2222-222222222222', 'admin@thorns.com', 'Alex Thompson', 'admin', NULL),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '22222222-2222-2222-2222-222222222222', 'staff1@thorns.com', 'Jordan Lee', 'staff', NULL),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', '22222222-2222-2222-2222-222222222222', 'staff2@thorns.com', 'Casey Morgan', 'staff', NULL);

-- LA Galaxy Tasks (with departments)
INSERT INTO tasks (org_id, title, description, status, priority, department, due_date, created_by) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Set up VIP parking signs', 'Place directional signs for VIP lot A and B', 'pending', 'high', 'Parking', NOW() + INTERVAL '2 hours', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('11111111-1111-1111-1111-111111111111', 'Stock first aid stations', 'Ensure all 6 stations have full supplies', 'pending', 'urgent', 'Medical', NOW() + INTERVAL '3 hours', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('11111111-1111-1111-1111-111111111111', 'Sweep Section 100-110', 'Pre-game security sweep of lower bowl', 'in_progress', 'high', 'Security', NOW() + INTERVAL '1 hour', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('11111111-1111-1111-1111-111111111111', 'Test PA system', 'Sound check all speakers in main concourse', 'pending', 'medium', 'Operations', NOW() + INTERVAL '4 hours', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('11111111-1111-1111-1111-111111111111', 'Prep concession stands', 'Stock inventory and verify POS systems', 'pending', 'high', 'Concessions', NOW() + INTERVAL '5 hours', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('11111111-1111-1111-1111-111111111111', 'Guest services briefing', 'Team briefing at Gate A', 'completed', 'medium', 'Guest Services', NOW() - INTERVAL '1 hour', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Portland Thorns Tasks (with photo requirements)
INSERT INTO tasks (org_id, title, description, status, priority, requires_photo, due_date, created_by) VALUES
  ('22222222-2222-2222-2222-222222222222', 'North entrance security sweep', 'Complete sweep and document with photo', 'pending', 'high', true, NOW() + INTERVAL '2 hours', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbba'),
  ('22222222-2222-2222-2222-222222222222', 'Fire extinguisher check - Level 1', 'Inspect all 12 extinguishers on Level 1', 'pending', 'urgent', true, NOW() + INTERVAL '3 hours', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbba'),
  ('22222222-2222-2222-2222-222222222222', 'Barrier inspection - Field level', 'Check all barriers are secure', 'in_progress', 'high', true, NOW() + INTERVAL '1 hour', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbba'),
  ('22222222-2222-2222-2222-222222222222', 'Staff meeting prep', 'Set up meeting room for pre-game briefing', 'pending', 'medium', false, NOW() + INTERVAL '4 hours', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbba'),
  ('22222222-2222-2222-2222-222222222222', 'Equipment inventory', 'Count and log all safety equipment', 'pending', 'medium', true, NOW() + INTERVAL '5 hours', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbba');
```

### Success Criteria

#### Automated Verification (via MCP)
- [x] `mcp__supabase__list_tables` returns 6 tables
- [x] `mcp__supabase__list_extensions` shows uuid-ossp and vector enabled
- [x] `mcp__supabase__execute_sql` with `SELECT COUNT(*) FROM organizations` returns 2
- [x] `mcp__supabase__execute_sql` with `SELECT COUNT(*) FROM tasks` returns 11

---

## Phase 2: Next.js Project Setup

### Overview
Create Next.js project with all dependencies and initial configuration.

### 2.1 Create Next.js Project
Run in terminal:
```bash
cd /Users/arvinhakakian/Code/arkero-takehome-assignment
npx create-next-app@latest touchline --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd touchline
```

### 2.2 Install Dependencies
```bash
# Supabase
npm install @supabase/supabase-js @supabase/ssr

# UI Components
npm install lucide-react class-variance-authority clsx tailwind-merge
npx shadcn@latest init -d

# shadcn components (batch)
npx shadcn@latest add button card input label select badge dialog dropdown-menu table tabs avatar separator skeleton toast checkbox textarea

# Form handling
npm install react-hook-form @hookform/resolvers zod

# Date handling
npm install date-fns

# Gemini for RAG
npm install @google/generative-ai
```

### 2.3 Create `.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=https://pkursirhunyfkagmcryr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<get from mcp__supabase__get_publishable_keys>
SUPABASE_SERVICE_ROLE_KEY=<get from Supabase dashboard>
GEMINI_API_KEY=<user provides>
```

### 2.4 Files to Create

Create the following files in `touchline/src`:

| Path | Purpose |
|------|---------|
| `lib/supabase/client.ts` | Browser Supabase client |
| `lib/supabase/server.ts` | Server-side Supabase client |
| `lib/supabase/admin.ts` | Service role client (bypasses RLS) + RLS-aware client |
| `lib/utils.ts` | cn() helper, formatDate, formatRelativeTime |
| `types/database.ts` | TypeScript interfaces for all tables |
| `lib/context/org-context.tsx` | Organization context provider (mock auth) |

### Success Criteria

#### Automated Verification
- [x] `npm run dev` starts without errors
- [x] `npm run build` completes successfully
- [x] No TypeScript errors

---

## Phase 3: Layout & Feature System

### Overview
Build app shell (sidebar, header), org/user switchers, and FeatureGate component.

### 3.1 Files to Create

| Path | Purpose |
|------|---------|
| `app/layout.tsx` | Root layout with OrgProvider |
| `app/(dashboard)/layout.tsx` | Dashboard layout with Sidebar + Header |
| `components/layout/sidebar.tsx` | Nav links, conditional Audit Log link |
| `components/layout/header.tsx` | OrgSwitcher + UserSwitcher |
| `components/org-switcher.tsx` | Dropdown to switch organizations |
| `components/user-switcher.tsx` | Dropdown to switch users within org |
| `components/features/feature-gate.tsx` | Conditional rendering based on feature flags |
| `lib/features/hooks.ts` | useFeature, useDepartments, usePhotoVerification hooks |

### 3.2 Key Implementation Details

**FeatureGate Component**:
```tsx
// Reads from org.feature_config.features[feature].enabled
// Renders children if enabled, fallback otherwise
```

**Sidebar**:
- Dashboard, Tasks links always visible
- Audit Log link only visible when `photoVerification.enabled`

**Org Context**:
- Stores current org + user in localStorage
- switchOrg() loads org data, auto-selects first admin user
- switchUser() allows role-based testing

### Success Criteria

#### Automated Verification
- [ ] `npm run dev` starts without errors
- [ ] `npm run build` completes

#### Manual Verification
- [ ] Sidebar renders with navigation
- [ ] Org switcher changes organization
- [ ] User switcher shows users for current org
- [ ] Audit Log link only appears for Portland Thorns

---

## Phase 4: Task Dashboard & CRUD

### Overview
Build main dashboard with task list, filtering, task detail page, and CRUD operations.

### 4.1 Files to Create

| Path | Purpose |
|------|---------|
| `app/(dashboard)/page.tsx` | Dashboard with stats, tasks, AI Assistant |
| `app/(dashboard)/tasks/page.tsx` | All tasks list with search/filter |
| `app/(dashboard)/tasks/[id]/page.tsx` | Task detail view |
| `app/(dashboard)/tasks/new/page.tsx` | Create task form |
| `components/tasks/task-card.tsx` | Task card with status, priority, badges |
| `components/tasks/department-filter.tsx` | Department filter chips (LA Galaxy) |
| `components/tasks/task-status-select.tsx` | Status dropdown |
| `lib/data/tasks.ts` | Task data fetching functions |

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

### Success Criteria

#### Automated Verification
- [ ] `npm run dev` starts without errors
- [ ] `npm run build` completes

#### Manual Verification
- [ ] Dashboard loads with tasks from database
- [ ] Stats cards show correct counts
- [ ] LA Galaxy: Department filter visible, tasks grouped
- [ ] Portland Thorns: No department filter, "Photo required" badges visible
- [ ] Can create tasks with org-specific fields
- [ ] Task detail page loads

---

## Phase 5: Photo Verification & Audit Log

### Overview
Implement photo upload for Portland Thorns and audit log viewer.

### 5.1 Setup Supabase Storage

In Supabase Dashboard:
1. Go to Storage → Create bucket `task-photos`
2. Make public (for demo)
3. Add policy allowing inserts

### 5.2 Files to Create

| Path | Purpose |
|------|---------|
| `components/tasks/photo-upload.tsx` | Drag-drop photo upload |
| `components/tasks/photo-gallery.tsx` | Display uploaded photos |
| `app/(dashboard)/audit/page.tsx` | Audit log table |

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
- Fetch audit_log joined with users
- Display time, user, action, entity, metadata
- Action badges with colors
- Only accessible when photoVerification enabled (redirect otherwise)

### Success Criteria

#### Automated Verification
- [ ] `npm run dev` starts without errors
- [ ] `npm run build` completes

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
| `lib/rag/embeddings.ts` | Generate embeddings via Gemini text-embedding-004 |
| `lib/rag/search.ts` | Search similar content via pgvector |
| `lib/rag/query.ts` | RAG query: embed → search → generate response |
| `lib/rag/sync.ts` | Sync task embeddings on create/update |
| `app/api/rag/query/route.ts` | POST endpoint for RAG queries |
| `components/rag/ai-assistant.tsx` | AI chat component |
| `scripts/seed-embeddings.ts` | Seed embeddings for existing tasks |

### 6.2 Key Implementation Details

**Embedding Generation**:
```ts
// Use text-embedding-004 model
// Returns 768-dimension vector
```

**Vector Search** (via match_documents function):
```ts
// Pass query_org_id to ensure tenant isolation
// Returns matching documents with similarity scores
```

**RAG Query Flow**:
1. Generate embedding for user question
2. Search embeddings (tenant-isolated via org_id)
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

1. Add use-toast hook (if not auto-generated by shadcn)
2. Add empty state for dashboard (no tasks)
3. Add loading skeletons
4. Run `npm run lint` and fix issues
5. Run `npm run build` and fix any errors
6. Test complete demo flow

### 7.2 Demo Flow Verification

**LA Galaxy Flow**:
1. Start with LA Galaxy selected
2. Show department filter on dashboard
3. Filter by a department
4. Create new task (department required)
5. View task detail
6. Complete task (no photo needed)
7. Use AI Assistant: "What tasks are urgent?"

**Portland Thorns Flow**:
1. Switch to Portland Thorns
2. Note: no department filter, "Photo required" badges visible
3. Click photo-required task
4. Try to complete → blocked
5. Upload photo
6. Complete task
7. View Audit Log
8. Use AI Assistant: "Summarize pending tasks"

### Success Criteria

#### Automated Verification
- [ ] `npm run build` passes
- [ ] `npm run lint` passes

#### Manual Verification
- [ ] Complete LA Galaxy demo flow
- [ ] Complete Portland Thorns demo flow
- [ ] Org switching clearly toggles features
- [ ] UI is clean and professional

---

## Summary

| Phase | Focus | Key Deliverables |
|-------|-------|------------------|
| 1 | Database | Schema, RLS, functions, seed data |
| 2 | Project Setup | Next.js, dependencies, config |
| 3 | Layout & Features | Shell, switchers, FeatureGate |
| 4 | Task Dashboard | CRUD, filtering, task cards |
| 5 | Photo & Audit | Upload, validation, audit log |
| 6 | RAG System | Embeddings, search, AI Assistant |
| 7 | Polish | Bug fixes, demo prep |

**Architecture Highlights for Arkero**:
- Multi-tenancy with RLS (not WHERE clauses)
- Feature flags via JSONB config
- RAG with tenant-isolated embeddings
- Clean React patterns (context, hooks, composition)
