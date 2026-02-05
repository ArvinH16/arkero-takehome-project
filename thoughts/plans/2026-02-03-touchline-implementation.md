# Touchline Implementation Plan

## Overview

Build a multi-tenant game day operations platform demonstrating enterprise-grade multi-tenancy, feature flags, and RAG-ready architecture for Arkero's take-home assessment.

## Current State

- Fresh project directory with PRD/architecture document complete
- No code exists yet
- Supabase project needs to be created

## Desired End State

A working Next.js 14 application with:
1. **Multi-tenant architecture** - Two organizations (LA Galaxy, Portland Thorns) with complete data isolation via RLS
2. **Feature A: Department-Based Tasks** - LA Galaxy can filter/group tasks by department
3. **Feature B: Photo Verification** - Portland Thorns requires photo upload before task completion
4. **RAG System** - Tenant-isolated semantic search using pgvector + Gemini API
5. **Professional UI** - Clean, production-ready interface using shadcn/ui
6. **Demo-ready** - Seeded data, easy org switching, clear feature differentiation

### Verification Criteria:
- LA Galaxy user sees department dropdown (required), department filters, grouped task view
- Portland Thorns user sees photo upload requirement, audit log, cannot complete photo-required tasks without upload
- Switching organizations shows/hides features appropriately
- All data is tenant-isolated (verified via Supabase RLS)

## What We're NOT Doing

- Real authentication (will use mock auth with org switcher for demo)
- Production deployment (local development only)
- Real-time updates (no WebSocket/Supabase realtime)
- Mobile responsiveness (desktop focus)
- Comprehensive error handling (happy path focus)

## Implementation Approach

Build incrementally with working features at each phase:
1. Project setup and database schema (including pgvector)
2. Core task CRUD with multi-tenancy
3. Feature flag system and department feature
4. Photo verification feature
5. RAG system with Gemini API
6. Polish and demo preparation

---

## Phase 1: Project Setup & Database

### Overview
Set up Next.js project, configure Supabase, and create database schema with RLS policies.

### 1.1 Create Next.js Project

```bash
cd /Users/arvinhakakian/Code/arkero-takehome-assignment
npx create-next-app@latest touchline --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd touchline
```

### 1.2 Install Dependencies

```bash
# Supabase
npm install @supabase/supabase-js @supabase/ssr

# UI Components
npm install lucide-react class-variance-authority clsx tailwind-merge
npx shadcn@latest init -d

# shadcn components
npx shadcn@latest add button card input label select badge dialog dropdown-menu table tabs avatar separator skeleton toast

# Form handling
npm install react-hook-form @hookform/resolvers zod

# Date handling
npm install date-fns
```

### 1.3 Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Create new project named "touchline"
3. Save credentials to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key
```

### 1.4 Database Schema

Run this SQL in Supabase SQL Editor:

**File**: `supabase/migrations/001_initial_schema.sql`

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- ORGANIZATIONS (Tenants)
-- ============================================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  feature_config JSONB NOT NULL DEFAULT '{
    "features": {
      "departments": { "enabled": false, "required": false, "list": [] },
      "photoVerification": { "enabled": false, "requiredForTasks": [] }
    },
    "customFields": { "tasks": [] }
  }',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- USERS
-- ============================================================================
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

-- ============================================================================
-- TASKS
-- ============================================================================
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

-- ============================================================================
-- TASK PHOTOS
-- ============================================================================
CREATE TABLE task_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- ============================================================================
-- AUDIT LOG
-- ============================================================================
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

-- ============================================================================
-- EMBEDDINGS (RAG-ready)
-- ============================================================================
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

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_tasks_org_id ON tasks(org_id);
CREATE INDEX idx_tasks_department ON tasks(org_id, department);
CREATE INDEX idx_tasks_status ON tasks(org_id, status);
CREATE INDEX idx_task_photos_task_id ON task_photos(task_id);
CREATE INDEX idx_audit_log_entity ON audit_log(org_id, entity_type, entity_id);
CREATE INDEX idx_embeddings_org_content ON embeddings(org_id, content_type);

-- Note: ivfflat index requires data to train on. Create AFTER seeding embeddings:
-- CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- For small demo data, use hnsw instead (no training required):
CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS HELPER FUNCTIONS
-- ============================================================================

-- Get current org_id from request header (set by application)
CREATE OR REPLACE FUNCTION auth.current_org_id() RETURNS UUID AS $$
  SELECT COALESCE(
    current_setting('app.current_org_id', true)::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$ LANGUAGE SQL STABLE;

-- Get current user_id from request header (set by application)
CREATE OR REPLACE FUNCTION auth.current_user_id() RETURNS UUID AS $$
  SELECT COALESCE(
    current_setting('app.current_user_id', true)::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$ LANGUAGE SQL STABLE;

-- Get current user's role
CREATE OR REPLACE FUNCTION auth.current_user_role() RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.current_user_id();
$$ LANGUAGE SQL STABLE;

-- Get current user's department
CREATE OR REPLACE FUNCTION auth.current_user_department() RETURNS TEXT AS $$
  SELECT department FROM users WHERE id = auth.current_user_id();
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- RLS POLICIES - Tenant Isolation
-- ============================================================================

-- ORGANIZATIONS: Users can only view their own organization
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (id = auth.current_org_id());

-- USERS: Users can only view users in their organization
CREATE POLICY "Users can view users in their organization"
  ON users FOR SELECT
  USING (org_id = auth.current_org_id());

-- TASKS: Tenant isolation + department-level access for LA Galaxy
-- Admins/Managers see all org tasks; Department heads see only their department
CREATE POLICY "Users can view tasks based on role and department"
  ON tasks FOR SELECT
  USING (
    org_id = auth.current_org_id()
    AND (
      -- Admins and managers see all tasks in their org
      auth.current_user_role() IN ('admin', 'manager')
      -- Department heads see tasks in their department OR unassigned tasks
      OR (auth.current_user_role() = 'department_head'
          AND (department = auth.current_user_department() OR department IS NULL))
      -- Staff see all tasks (no department filtering for staff)
      OR auth.current_user_role() = 'staff'
    )
  );

CREATE POLICY "Users can create tasks in their organization"
  ON tasks FOR INSERT
  WITH CHECK (org_id = auth.current_org_id());

CREATE POLICY "Users can update tasks they have access to"
  ON tasks FOR UPDATE
  USING (
    org_id = auth.current_org_id()
    AND (
      auth.current_user_role() IN ('admin', 'manager')
      OR (auth.current_user_role() = 'department_head'
          AND department = auth.current_user_department())
    )
  );

-- TASK_PHOTOS: Tenant isolation
CREATE POLICY "Users can view photos in their organization"
  ON task_photos FOR SELECT
  USING (org_id = auth.current_org_id());

CREATE POLICY "Users can upload photos in their organization"
  ON task_photos FOR INSERT
  WITH CHECK (org_id = auth.current_org_id());

-- AUDIT_LOG: Tenant isolation
CREATE POLICY "Users can view audit logs in their organization"
  ON audit_log FOR SELECT
  USING (org_id = auth.current_org_id());

CREATE POLICY "Users can create audit logs in their organization"
  ON audit_log FOR INSERT
  WITH CHECK (org_id = auth.current_org_id());

-- EMBEDDINGS: Tenant isolation (CRITICAL for RAG security)
-- This ensures LA Galaxy can NEVER search Portland Thorns data and vice versa
CREATE POLICY "Users can only search embeddings in their organization"
  ON embeddings FOR SELECT
  USING (org_id = auth.current_org_id());

CREATE POLICY "Users can create embeddings in their organization"
  ON embeddings FOR INSERT
  WITH CHECK (org_id = auth.current_org_id());

-- ============================================================================
-- SERVICE ROLE BYPASS (for server-side operations)
-- ============================================================================
-- Note: Service role key bypasses RLS automatically in Supabase.
-- The policies above apply when using the anon key with RLS context.

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to validate task completion (checks photo requirement)
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

-- Function to search similar content via RAG (tenant-isolated)
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
LANGUAGE plpgsql
AS $$
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

**File**: `supabase/seed.sql`

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
      "photoVerification": {
        "enabled": false,
        "requiredForTasks": []
      }
    },
    "customFields": { "tasks": [] }
  }'
);

-- Portland Thorns (Photo verification enabled)
INSERT INTO organizations (id, name, slug, feature_config) VALUES (
  '22222222-2222-2222-2222-222222222222',
  'Portland Thorns',
  'portland-thorns',
  '{
    "features": {
      "departments": {
        "enabled": false,
        "required": false,
        "list": []
      },
      "photoVerification": {
        "enabled": true,
        "requiredForTasks": ["security_sweep", "safety_check", "equipment_inspection"]
      }
    },
    "customFields": { "tasks": [] }
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

#### Automated Verification:
- [ ] `cd touchline && npm run dev` starts without errors
- [ ] `npm run build` completes successfully
- [ ] Supabase tables exist and seed data loads

#### Manual Verification:
- [ ] Can access http://localhost:3000
- [ ] Supabase dashboard shows all 6 tables with data
- [ ] RLS policies are created on all tables
- [ ] Verify in SQL Editor: `SELECT * FROM pg_policies;` shows tenant isolation policies

#### RLS Verification Test (run in Supabase SQL Editor):
```sql
-- Test 1: Set context to LA Galaxy
SET app.current_org_id = '11111111-1111-1111-1111-111111111111';
SET app.current_user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Should return ONLY LA Galaxy tasks
SELECT * FROM tasks;

-- Test 2: Set context to Portland Thorns
SET app.current_org_id = '22222222-2222-2222-2222-222222222222';
SET app.current_user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbba';

-- Should return ONLY Portland Thorns tasks
SELECT * FROM tasks;
```

---

## Phase 2: Core Infrastructure & Layout

### Overview
Set up Supabase client, TypeScript types, layout structure, and org context for multi-tenancy.

### 2.1 Supabase Client Setup

**File**: `src/lib/supabase/client.ts`
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**File**: `src/lib/supabase/server.ts`
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component - ignore
          }
        },
      },
    }
  )
}
```

**File**: `src/lib/supabase/admin.ts`
```typescript
import { createClient } from '@supabase/supabase-js'

// Service role client - bypasses RLS (use for admin operations)
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// RLS-aware client - respects tenant isolation policies
// This demonstrates proper multi-tenant isolation at the database level
export function createRLSClient(orgId: string, userId: string) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          // These headers set the RLS context via Supabase's request.headers
          'x-org-id': orgId,
          'x-user-id': userId,
        }
      }
    }
  )

  return client
}
```

**Note on RLS Implementation**:

For the RLS policies to work with custom headers, we need to update the helper functions to read from request headers instead of settings. Update the schema SQL to use this alternative approach:

**File**: `supabase/migrations/002_rls_header_functions.sql`
```sql
-- Alternative RLS functions that read from request headers
-- This works with Supabase's edge functions and API gateway

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
```

### 2.2 TypeScript Types

**File**: `src/types/database.ts`
```typescript
export interface Organization {
  id: string
  name: string
  slug: string
  feature_config: FeatureConfig
  created_at: string
  updated_at: string
}

export interface FeatureConfig {
  features: {
    departments: {
      enabled: boolean
      required: boolean
      list: string[]
    }
    photoVerification: {
      enabled: boolean
      requiredForTasks: string[]
    }
  }
  customFields: {
    tasks: CustomFieldDefinition[]
  }
}

export interface CustomFieldDefinition {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'date'
  options?: string[]
  required?: boolean
}

export interface User {
  id: string
  org_id: string
  email: string
  name: string
  role: 'admin' | 'manager' | 'department_head' | 'staff'
  department: string | null
  created_at: string
}

export interface Task {
  id: string
  org_id: string
  title: string
  description: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  department: string | null
  requires_photo: boolean
  custom_data: Record<string, unknown>
  assigned_to: string | null
  due_date: string | null
  completed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TaskPhoto {
  id: string
  org_id: string
  task_id: string
  photo_url: string
  uploaded_by: string
  uploaded_at: string
  metadata: Record<string, unknown>
}

export interface AuditLog {
  id: string
  org_id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown>
  created_at: string
}
```

### 2.3 Organization Context (Mock Auth)

**File**: `src/lib/context/org-context.tsx`
```typescript
'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Organization, User } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

interface OrgContextType {
  organization: Organization | null
  user: User | null
  isLoading: boolean
  switchOrg: (slug: string) => Promise<void>
  switchUser: (userId: string) => Promise<void>
}

const OrgContext = createContext<OrgContextType | undefined>(undefined)

export function OrgProvider({ children }: { children: ReactNode }) {
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    // Load from localStorage or default to LA Galaxy
    const savedOrg = localStorage.getItem('touchline_org')
    const savedUser = localStorage.getItem('touchline_user')

    const loadInitial = async () => {
      const slug = savedOrg || 'la-galaxy'
      await switchOrg(slug)
      if (savedUser) {
        await switchUser(savedUser)
      }
      setIsLoading(false)
    }

    loadInitial()
  }, [])

  const switchOrg = async (slug: string) => {
    const { data: org } = await supabase
      .from('organizations')
      .select('*')
      .eq('slug', slug)
      .single()

    if (org) {
      setOrganization(org)
      localStorage.setItem('touchline_org', slug)

      // Get first admin user for this org
      const { data: users } = await supabase
        .from('users')
        .select('*')
        .eq('org_id', org.id)
        .eq('role', 'admin')
        .limit(1)

      if (users && users.length > 0) {
        setUser(users[0])
        localStorage.setItem('touchline_user', users[0].id)
      }
    }
  }

  const switchUser = async (userId: string) => {
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userData) {
      setUser(userData)
      localStorage.setItem('touchline_user', userId)
    }
  }

  return (
    <OrgContext.Provider value={{ organization, user, isLoading, switchOrg, switchUser }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg() {
  const context = useContext(OrgContext)
  if (context === undefined) {
    throw new Error('useOrg must be used within OrgProvider')
  }
  return context
}
```

### 2.4 App Layout with Sidebar

**File**: `src/app/layout.tsx`
```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { OrgProvider } from '@/lib/context/org-context'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Touchline - Game Day Operations',
  description: 'Multi-tenant game day operations platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <OrgProvider>
          {children}
          <Toaster />
        </OrgProvider>
      </body>
    </html>
  )
}
```

**File**: `src/app/(dashboard)/layout.tsx`
```typescript
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

**File**: `src/components/layout/sidebar.tsx`
```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useOrg } from '@/lib/context/org-context'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  CheckSquare,
  ClipboardList,
  Settings
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
]

export function Sidebar() {
  const pathname = usePathname()
  const { organization } = useOrg()

  const showAuditLog = organization?.feature_config?.features?.photoVerification?.enabled

  return (
    <div className="flex w-64 flex-col bg-white border-r">
      <div className="flex h-16 items-center px-6 border-b">
        <span className="text-xl font-bold text-gray-900">Touchline</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                isActive
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}

        {showAuditLog && (
          <Link
            href="/audit"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
              pathname === '/audit'
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <ClipboardList className="h-5 w-5" />
            Audit Log
          </Link>
        )}
      </nav>

      <div className="border-t p-4">
        <div className="text-xs text-gray-500 mb-1">Organization</div>
        <div className="font-medium text-gray-900">{organization?.name || 'Loading...'}</div>
      </div>
    </div>
  )
}
```

**File**: `src/components/layout/header.tsx`
```typescript
'use client'

import { useOrg } from '@/lib/context/org-context'
import { OrgSwitcher } from '@/components/org-switcher'
import { UserSwitcher } from '@/components/user-switcher'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export function Header() {
  const { user } = useOrg()

  const initials = user?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || '?'

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div className="flex items-center gap-4">
        <OrgSwitcher />
      </div>
      <div className="flex items-center gap-4">
        <UserSwitcher />
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-blue-100 text-blue-600 text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
```

**File**: `src/components/org-switcher.tsx`
```typescript
'use client'

import { useOrg } from '@/lib/context/org-context'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const organizations = [
  { slug: 'la-galaxy', name: 'LA Galaxy' },
  { slug: 'portland-thorns', name: 'Portland Thorns' },
]

export function OrgSwitcher() {
  const { organization, switchOrg, isLoading } = useOrg()

  if (isLoading) return null

  return (
    <Select value={organization?.slug} onValueChange={switchOrg}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select organization" />
      </SelectTrigger>
      <SelectContent>
        {organizations.map((org) => (
          <SelectItem key={org.slug} value={org.slug}>
            {org.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

**File**: `src/components/user-switcher.tsx`
```typescript
'use client'

import { useEffect, useState } from 'react'
import { useOrg } from '@/lib/context/org-context'
import { createClient } from '@/lib/supabase/client'
import { User } from '@/types/database'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function UserSwitcher() {
  const { organization, user, switchUser } = useOrg()
  const [users, setUsers] = useState<User[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (!organization) return

    const loadUsers = async () => {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('org_id', organization.id)
        .order('name')

      if (data) setUsers(data)
    }

    loadUsers()
  }, [organization?.id])

  if (!user) return null

  return (
    <Select value={user.id} onValueChange={switchUser}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select user" />
      </SelectTrigger>
      <SelectContent>
        {users.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            {u.name} ({u.role})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

### 2.5 Utils

**File**: `src/lib/utils.ts`
```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatRelativeTime(date: string | Date) {
  const now = new Date()
  const target = new Date(date)
  const diff = target.getTime() - now.getTime()
  const hours = Math.round(diff / (1000 * 60 * 60))

  if (hours < 0) return 'Overdue'
  if (hours === 0) return 'Due now'
  if (hours < 24) return `${hours}h remaining`
  const days = Math.round(hours / 24)
  return `${days}d remaining`
}
```

### Success Criteria

#### Automated Verification:
- [ ] `npm run dev` starts without errors
- [ ] `npm run build` completes successfully
- [ ] No TypeScript errors

#### Manual Verification:
- [ ] Sidebar renders with navigation
- [ ] Org switcher works - changes organization context
- [ ] User switcher shows users for current org
- [ ] Audit Log link only appears for Portland Thorns

---

## Phase 3: Task List & Feature Flag System

### Overview
Build the main dashboard with task list, filtering, and the FeatureGate component for conditional rendering.

### 3.1 Feature Gate Component

**File**: `src/components/features/feature-gate.tsx`
```typescript
'use client'

import { useOrg } from '@/lib/context/org-context'
import { ReactNode } from 'react'

type FeatureKey = 'departments' | 'photoVerification'

interface FeatureGateProps {
  feature: FeatureKey
  children: ReactNode
  fallback?: ReactNode
}

export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  const { organization, isLoading } = useOrg()

  if (isLoading) return null

  const isEnabled = organization?.feature_config?.features?.[feature]?.enabled ?? false

  return isEnabled ? <>{children}</> : <>{fallback}</>
}
```

**File**: `src/lib/features/hooks.ts`
```typescript
'use client'

import { useOrg } from '@/lib/context/org-context'

export function useFeature(feature: 'departments' | 'photoVerification') {
  const { organization } = useOrg()
  return organization?.feature_config?.features?.[feature] ?? null
}

export function useDepartments() {
  const { organization } = useOrg()
  const config = organization?.feature_config?.features?.departments

  return {
    enabled: config?.enabled ?? false,
    required: config?.required ?? false,
    list: config?.list ?? [],
  }
}

export function usePhotoVerification() {
  const { organization } = useOrg()
  const config = organization?.feature_config?.features?.photoVerification

  return {
    enabled: config?.enabled ?? false,
    requiredForTasks: config?.requiredForTasks ?? [],
  }
}
```

### 3.2 Task Data Fetching

**File**: `src/lib/data/tasks.ts`
```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { Task, TaskPhoto } from '@/types/database'

export async function getTasks(orgId: string, filters?: {
  department?: string
  status?: string
}): Promise<Task[]> {
  const supabase = createAdminClient()

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('org_id', orgId)
    .order('due_date', { ascending: true, nullsFirst: false })

  if (filters?.department) {
    query = query.eq('department', filters.department)
  }

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

export async function getTask(taskId: string): Promise<Task | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single()

  if (error) return null
  return data
}

export async function getTaskPhotos(taskId: string): Promise<TaskPhoto[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('task_photos')
    .select('*')
    .eq('task_id', taskId)
    .order('uploaded_at', { ascending: false })

  if (error) return []
  return data || []
}

export async function createTask(task: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('tasks')
    .insert(task)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function canCompleteTask(taskId: string): Promise<boolean> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .rpc('validate_task_completion', { p_task_id: taskId })

  if (error) return false
  return data
}
```

### 3.3 Server Actions

**File**: `src/app/actions/tasks.ts`
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { Task } from '@/types/database'

export async function createTaskAction(formData: FormData, orgId: string, userId: string) {
  const supabase = createAdminClient()

  const task = {
    org_id: orgId,
    title: formData.get('title') as string,
    description: formData.get('description') as string || null,
    priority: formData.get('priority') as string || 'medium',
    department: formData.get('department') as string || null,
    requires_photo: formData.get('requires_photo') === 'true',
    due_date: formData.get('due_date') as string || null,
    created_by: userId,
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert(task)
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/tasks')
  revalidatePath('/')

  return data
}

export async function updateTaskStatusAction(taskId: string, status: string) {
  const supabase = createAdminClient()

  // If completing, validate photo requirement
  if (status === 'completed') {
    const { data: canComplete } = await supabase
      .rpc('validate_task_completion', { p_task_id: taskId })

    if (!canComplete) {
      throw new Error('Photo required before completing this task')
    }
  }

  const updates: Partial<Task> = {
    status: status as Task['status'],
    updated_at: new Date().toISOString(),
  }

  if (status === 'completed') {
    updates.completed_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  // Log to audit
  await supabase.from('audit_log').insert({
    org_id: data.org_id,
    action: `task_${status}`,
    entity_type: 'task',
    entity_id: taskId,
    metadata: { previous_status: data.status, new_status: status },
  })

  revalidatePath('/tasks')
  revalidatePath('/')

  return data
}
```

### 3.4 Dashboard Page

**File**: `src/app/(dashboard)/page.tsx`
```typescript
'use client'

import { useEffect, useState } from 'react'
import { useOrg } from '@/lib/context/org-context'
import { createClient } from '@/lib/supabase/client'
import { Task } from '@/types/database'
import { TaskCard } from '@/components/tasks/task-card'
import { DepartmentFilter } from '@/components/tasks/department-filter'
import { FeatureGate } from '@/components/features/feature-gate'
import { useDepartments } from '@/lib/features/hooks'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardPage() {
  const { organization, isLoading: orgLoading } = useOrg()
  const { enabled: deptEnabled, list: departments } = useDepartments()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDept, setSelectedDept] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (!organization) return

    const loadTasks = async () => {
      setLoading(true)
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('org_id', organization.id)
        .order('due_date', { ascending: true, nullsFirst: false })

      if (selectedDept) {
        query = query.eq('department', selectedDept)
      }

      const { data } = await query
      setTasks(data || [])
      setLoading(false)
    }

    loadTasks()
  }, [organization?.id, selectedDept])

  if (orgLoading) {
    return <DashboardSkeleton />
  }

  // Group tasks by department if feature is enabled
  const groupedTasks = deptEnabled
    ? departments.reduce((acc, dept) => {
        acc[dept] = tasks.filter(t => t.department === dept)
        return acc
      }, {} as Record<string, Task[]>)
    : { 'All Tasks': tasks }

  // Stats
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Game Day Dashboard</h1>
        <p className="text-gray-600">{organization?.name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Tasks" value={stats.total} />
        <StatCard label="Pending" value={stats.pending} color="yellow" />
        <StatCard label="In Progress" value={stats.inProgress} color="blue" />
        <StatCard label="Completed" value={stats.completed} color="green" />
      </div>

      {/* Department Filter (LA Galaxy only) */}
      <FeatureGate feature="departments">
        <DepartmentFilter
          departments={departments}
          selected={selectedDept}
          onSelect={setSelectedDept}
        />
      </FeatureGate>

      {/* Task Groups */}
      {loading ? (
        <TaskListSkeleton />
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTasks).map(([group, groupTasks]) => (
            <div key={group}>
              {deptEnabled && (
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-lg font-semibold text-gray-900">{group}</h2>
                  <Badge variant="secondary">{groupTasks.length}</Badge>
                </div>
              )}
              {groupTasks.length === 0 ? (
                <p className="text-gray-500 text-sm">No tasks</p>
              ) : (
                <div className="grid gap-3">
                  {groupTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  const colorClasses = {
    yellow: 'bg-yellow-50 text-yellow-700',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
  }

  return (
    <div className={`rounded-lg p-4 ${color ? colorClasses[color as keyof typeof colorClasses] : 'bg-gray-50 text-gray-700'}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm">{label}</div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <TaskListSkeleton />
    </div>
  )
}

function TaskListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  )
}
```

### 3.5 Task Card Component

**File**: `src/components/tasks/task-card.tsx`
```typescript
'use client'

import Link from 'next/link'
import { Task } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { FeatureGate } from '@/components/features/feature-gate'
import { formatRelativeTime } from '@/lib/utils'
import { Clock, Camera, AlertCircle } from 'lucide-react'

interface TaskCardProps {
  task: Task
}

const priorityColors = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  blocked: 'bg-red-100 text-red-700',
}

export function TaskCard({ task }: TaskCardProps) {
  return (
    <Link href={`/tasks/${task.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="font-medium text-gray-900">{task.title}</h3>
              {task.description && (
                <p className="text-sm text-gray-600 line-clamp-1">{task.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge className={statusColors[task.status]}>
                {task.status.replace('_', ' ')}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
            <Badge variant="outline" className={priorityColors[task.priority]}>
              {task.priority}
            </Badge>

            <FeatureGate feature="departments">
              {task.department && (
                <Badge variant="outline">{task.department}</Badge>
              )}
            </FeatureGate>

            {task.due_date && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatRelativeTime(task.due_date)}
              </span>
            )}

            <FeatureGate feature="photoVerification">
              {task.requires_photo && (
                <span className="flex items-center gap-1 text-purple-600">
                  <Camera className="h-4 w-4" />
                  Photo required
                </span>
              )}
            </FeatureGate>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
```

### 3.6 Department Filter

**File**: `src/components/tasks/department-filter.tsx`
```typescript
'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface DepartmentFilterProps {
  departments: string[]
  selected: string | null
  onSelect: (dept: string | null) => void
}

export function DepartmentFilter({ departments, selected, onSelect }: DepartmentFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge
        variant="outline"
        className={cn(
          'cursor-pointer',
          !selected && 'bg-gray-900 text-white'
        )}
        onClick={() => onSelect(null)}
      >
        All Departments
      </Badge>
      {departments.map((dept) => (
        <Badge
          key={dept}
          variant="outline"
          className={cn(
            'cursor-pointer',
            selected === dept && 'bg-gray-900 text-white'
          )}
          onClick={() => onSelect(dept)}
        >
          {dept}
        </Badge>
      ))}
    </div>
  )
}
```

### Success Criteria

#### Automated Verification:
- [ ] `npm run dev` starts without errors
- [ ] `npm run build` completes successfully

#### Manual Verification:
- [ ] Dashboard loads and shows tasks
- [ ] Stats cards show correct counts
- [ ] LA Galaxy: Department filter appears and works
- [ ] LA Galaxy: Tasks grouped by department
- [ ] Portland Thorns: No department filter
- [ ] Portland Thorns: "Photo required" badge visible on relevant tasks
- [ ] Clicking task card navigates to detail page (404 expected until Phase 4)

---

## Phase 4: Task Detail & Photo Verification

### Overview
Build task detail page with status updates and photo upload for Portland Thorns.

### 4.1 Task Detail Page

**File**: `src/app/(dashboard)/tasks/[id]/page.tsx`
```typescript
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useOrg } from '@/lib/context/org-context'
import { createClient } from '@/lib/supabase/client'
import { Task, TaskPhoto, User } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FeatureGate } from '@/components/features/feature-gate'
import { PhotoUpload } from '@/components/tasks/photo-upload'
import { PhotoGallery } from '@/components/tasks/photo-gallery'
import { TaskStatusSelect } from '@/components/tasks/task-status-select'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Clock, Camera, User as UserIcon } from 'lucide-react'
import Link from 'next/link'

export default function TaskDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { organization, user } = useOrg()
  const { toast } = useToast()
  const [task, setTask] = useState<Task | null>(null)
  const [photos, setPhotos] = useState<TaskPhoto[]>([])
  const [assignedUser, setAssignedUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()
  const taskId = params.id as string

  const loadTask = async () => {
    const { data: taskData } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (taskData) {
      setTask(taskData)

      // Load photos
      const { data: photoData } = await supabase
        .from('task_photos')
        .select('*')
        .eq('task_id', taskId)
        .order('uploaded_at', { ascending: false })

      setPhotos(photoData || [])

      // Load assigned user
      if (taskData.assigned_to) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', taskData.assigned_to)
          .single()

        setAssignedUser(userData)
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    loadTask()
  }, [taskId])

  const handleStatusChange = async (newStatus: string) => {
    if (!task) return

    // Check photo requirement before completing
    if (newStatus === 'completed' && task.requires_photo && photos.length === 0) {
      toast({
        title: 'Photo Required',
        description: 'Please upload a verification photo before completing this task.',
        variant: 'destructive',
      })
      return
    }

    const { error } = await supabase
      .from('tasks')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
      })
      .eq('id', taskId)

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update task status',
        variant: 'destructive',
      })
      return
    }

    // Log to audit
    await supabase.from('audit_log').insert({
      org_id: task.org_id,
      user_id: user?.id,
      action: `task_status_${newStatus}`,
      entity_type: 'task',
      entity_id: taskId,
      metadata: { previous_status: task.status, new_status: newStatus },
    })

    toast({
      title: 'Status Updated',
      description: `Task marked as ${newStatus.replace('_', ' ')}`,
    })

    loadTask()
  }

  const handlePhotoUploaded = () => {
    loadTask()
    toast({
      title: 'Photo Uploaded',
      description: 'Verification photo has been added to this task.',
    })
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (!task) {
    return <div className="p-6">Task not found</div>
  }

  const canComplete = !task.requires_photo || photos.length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl">{task.title}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={statusColors[task.status]}>
                      {task.status.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline" className={priorityColors[task.priority]}>
                      {task.priority}
                    </Badge>
                    <FeatureGate feature="departments">
                      {task.department && (
                        <Badge variant="outline">{task.department}</Badge>
                      )}
                    </FeatureGate>
                  </div>
                </div>
                <TaskStatusSelect
                  value={task.status}
                  onChange={handleStatusChange}
                  disabled={task.status === 'completed'}
                  canComplete={canComplete}
                />
              </div>
            </CardHeader>
            <CardContent>
              {task.description && (
                <p className="text-gray-600 whitespace-pre-wrap">{task.description}</p>
              )}

              <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
                {task.due_date && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>Due: {formatDate(task.due_date)} ({formatRelativeTime(task.due_date)})</span>
                  </div>
                )}
                {assignedUser && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <UserIcon className="h-4 w-4" />
                    <span>Assigned to: {assignedUser.name}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Photo Section (Portland Thorns) */}
          <FeatureGate feature="photoVerification">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Verification Photos
                  {task.requires_photo && photos.length === 0 && (
                    <Badge variant="destructive">Required</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {task.status !== 'completed' && (
                  <PhotoUpload
                    taskId={task.id}
                    orgId={task.org_id}
                    userId={user?.id || ''}
                    onUploaded={handlePhotoUploaded}
                  />
                )}
                <PhotoGallery photos={photos} />
              </CardContent>
            </Card>
          </FeatureGate>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Task Details</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <div>
                <span className="text-gray-500">Created:</span>
                <span className="ml-2">{formatDate(task.created_at)}</span>
              </div>
              {task.completed_at && (
                <div>
                  <span className="text-gray-500">Completed:</span>
                  <span className="ml-2">{formatDate(task.completed_at)}</span>
                </div>
              )}
              <FeatureGate feature="photoVerification">
                <div>
                  <span className="text-gray-500">Photo Required:</span>
                  <span className="ml-2">{task.requires_photo ? 'Yes' : 'No'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Photos Uploaded:</span>
                  <span className="ml-2">{photos.length}</span>
                </div>
              </FeatureGate>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

const priorityColors = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  blocked: 'bg-red-100 text-red-700',
}
```

### 4.2 Task Status Select

**File**: `src/components/tasks/task-status-select.tsx`
```typescript
'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface TaskStatusSelectProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  canComplete?: boolean
}

const statuses = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'blocked', label: 'Blocked' },
]

export function TaskStatusSelect({ value, onChange, disabled, canComplete = true }: TaskStatusSelectProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {statuses.map((status) => (
          <SelectItem
            key={status.value}
            value={status.value}
            disabled={status.value === 'completed' && !canComplete}
          >
            {status.label}
            {status.value === 'completed' && !canComplete && ' (Photo required)'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

### 4.3 Photo Upload Component

**File**: `src/components/tasks/photo-upload.tsx`
```typescript
'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Upload, Loader2 } from 'lucide-react'

interface PhotoUploadProps {
  taskId: string
  orgId: string
  userId: string
  onUploaded: () => void
}

export function PhotoUpload({ taskId, orgId, userId, onUploaded }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const supabase = createClient()

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    setUploading(true)

    try {
      // Upload to Supabase Storage
      const fileName = `${Date.now()}-${file.name}`
      const filePath = `${orgId}/${taskId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('task-photos')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('task-photos')
        .getPublicUrl(filePath)

      // Create photo record
      const { error: dbError } = await supabase.from('task_photos').insert({
        org_id: orgId,
        task_id: taskId,
        photo_url: publicUrl,
        uploaded_by: userId,
        metadata: {
          original_name: file.name,
          size: file.size,
          type: file.type,
        },
      })

      if (dbError) throw dbError

      // Log to audit
      await supabase.from('audit_log').insert({
        org_id: orgId,
        user_id: userId,
        action: 'photo_uploaded',
        entity_type: 'task_photo',
        entity_id: taskId,
        metadata: { file_name: file.name },
      })

      onUploaded()
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload photo')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)

    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragActive(false)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center mb-4 transition-colors ${
        dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {uploading ? (
        <div className="flex items-center justify-center gap-2 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Uploading...
        </div>
      ) : (
        <>
          <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600 mb-2">
            Drag and drop a photo here, or
          </p>
          <label>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button variant="outline" size="sm" asChild>
              <span>Select File</span>
            </Button>
          </label>
        </>
      )}
    </div>
  )
}
```

### 4.4 Photo Gallery Component

**File**: `src/components/tasks/photo-gallery.tsx`
```typescript
'use client'

import { TaskPhoto } from '@/types/database'
import { formatDate } from '@/lib/utils'

interface PhotoGalleryProps {
  photos: TaskPhoto[]
}

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  if (photos.length === 0) {
    return (
      <p className="text-sm text-gray-500">No photos uploaded yet.</p>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {photos.map((photo) => (
        <div key={photo.id} className="space-y-2">
          <a
            href={photo.photo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <img
              src={photo.photo_url}
              alt="Verification photo"
              className="w-full h-32 object-cover rounded-lg hover:opacity-90 transition-opacity"
            />
          </a>
          <p className="text-xs text-gray-500">
            Uploaded {formatDate(photo.uploaded_at)}
          </p>
        </div>
      ))}
    </div>
  )
}
```

### 4.5 Create Supabase Storage Bucket

In Supabase dashboard:
1. Go to Storage
2. Create new bucket: `task-photos`
3. Make it public (for demo purposes)
4. Add policy: Allow all operations for authenticated users

### Success Criteria

#### Automated Verification:
- [ ] `npm run dev` starts without errors
- [ ] `npm run build` completes successfully

#### Manual Verification:
- [ ] Task detail page loads
- [ ] Status can be changed via dropdown
- [ ] LA Galaxy: Can complete any task
- [ ] Portland Thorns: Photo upload UI appears
- [ ] Portland Thorns: Cannot complete photo-required task without photo
- [ ] Portland Thorns: Can upload photo and it appears in gallery
- [ ] Portland Thorns: Can complete task after photo upload

---

## Phase 5: Audit Log & Task Creation

### Overview
Build the audit log viewer for Portland Thorns and task creation form with conditional department field.

### 5.1 Audit Log Page

**File**: `src/app/(dashboard)/audit/page.tsx`
```typescript
'use client'

import { useEffect, useState } from 'react'
import { useOrg } from '@/lib/context/org-context'
import { createClient } from '@/lib/supabase/client'
import { AuditLog, User } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/lib/utils'
import { ClipboardList } from 'lucide-react'

interface AuditLogWithUser extends AuditLog {
  user?: User
}

export default function AuditPage() {
  const { organization, isLoading: orgLoading } = useOrg()
  const [logs, setLogs] = useState<AuditLogWithUser[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    if (!organization) return

    const loadLogs = async () => {
      const { data } = await supabase
        .from('audit_log')
        .select(`
          *,
          user:users(id, name, email)
        `)
        .eq('org_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(100)

      setLogs(data || [])
      setLoading(false)
    }

    loadLogs()
  }, [organization?.id])

  // Redirect if photo verification not enabled
  if (!orgLoading && !organization?.feature_config?.features?.photoVerification?.enabled) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Audit log is not available for this organization.</p>
      </div>
    )
  }

  const actionLabels: Record<string, string> = {
    photo_uploaded: 'Photo Uploaded',
    task_status_pending: 'Status → Pending',
    task_status_in_progress: 'Status → In Progress',
    task_status_completed: 'Status → Completed',
    task_status_blocked: 'Status → Blocked',
    task_created: 'Task Created',
  }

  const actionColors: Record<string, string> = {
    photo_uploaded: 'bg-purple-100 text-purple-700',
    task_status_completed: 'bg-green-100 text-green-700',
    task_status_in_progress: 'bg-blue-100 text-blue-700',
    task_status_pending: 'bg-yellow-100 text-yellow-700',
    task_status_blocked: 'bg-red-100 text-red-700',
    task_created: 'bg-gray-100 text-gray-700',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="h-6 w-6" />
          Audit Log
        </h1>
        <p className="text-gray-600">Track all task activities and photo verifications</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No audit entries yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </TableCell>
                    <TableCell>
                      {log.user?.name || 'System'}
                    </TableCell>
                    <TableCell>
                      <Badge className={actionColors[log.action] || 'bg-gray-100 text-gray-700'}>
                        {actionLabels[log.action] || log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">
                      {log.entity_type}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {log.metadata && Object.keys(log.metadata).length > 0 ? (
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {JSON.stringify(log.metadata)}
                        </code>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

### 5.2 Task Creation Page

**File**: `src/app/(dashboard)/tasks/new/page.tsx`
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOrg } from '@/lib/context/org-context'
import { useDepartments, usePhotoVerification } from '@/lib/features/hooks'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { FeatureGate } from '@/components/features/feature-gate'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function NewTaskPage() {
  const router = useRouter()
  const { organization, user } = useOrg()
  const { enabled: deptEnabled, required: deptRequired, list: departments } = useDepartments()
  const { enabled: photoEnabled } = usePhotoVerification()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!organization || !user) return

    setLoading(true)
    const formData = new FormData(e.currentTarget)

    const task = {
      org_id: organization.id,
      title: formData.get('title') as string,
      description: formData.get('description') as string || null,
      priority: formData.get('priority') as string,
      department: formData.get('department') as string || null,
      requires_photo: formData.get('requires_photo') === 'on',
      due_date: formData.get('due_date') ? new Date(formData.get('due_date') as string).toISOString() : null,
      created_by: user.id,
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert(task)
      .select()
      .single()

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to create task',
        variant: 'destructive',
      })
      setLoading(false)
      return
    }

    // Log to audit
    await supabase.from('audit_log').insert({
      org_id: organization.id,
      user_id: user.id,
      action: 'task_created',
      entity_type: 'task',
      entity_id: data.id,
      metadata: { title: task.title },
    })

    toast({
      title: 'Task Created',
      description: 'Your task has been created successfully.',
    })

    router.push(`/tasks/${data.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Task</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                name="title"
                required
                placeholder="Enter task title"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Enter task description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select name="priority" defaultValue="medium">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  name="due_date"
                  type="datetime-local"
                />
              </div>
            </div>

            {/* Department Field (LA Galaxy) */}
            <FeatureGate feature="departments">
              <div>
                <Label htmlFor="department">
                  Department {deptRequired && '*'}
                </Label>
                <Select name="department" required={deptRequired}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FeatureGate>

            {/* Photo Requirement (Portland Thorns) */}
            <FeatureGate feature="photoVerification">
              <div className="flex items-center gap-2">
                <Checkbox id="requires_photo" name="requires_photo" />
                <Label htmlFor="requires_photo" className="font-normal">
                  Require photo verification for completion
                </Label>
              </div>
            </FeatureGate>

            <div className="flex justify-end gap-4 pt-4">
              <Link href="/">
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Task
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

### 5.3 Add Checkbox and Textarea Components

```bash
npx shadcn@latest add checkbox textarea
```

### 5.4 Add Create Task Button to Dashboard

Update `src/app/(dashboard)/page.tsx` - add button after the h1:

```typescript
import Link from 'next/link'
import { Plus } from 'lucide-react'

// In the return, after the h1/p:
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-bold text-gray-900">Game Day Dashboard</h1>
    <p className="text-gray-600">{organization?.name}</p>
  </div>
  <Link href="/tasks/new">
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      New Task
    </Button>
  </Link>
</div>
```

### 5.5 Tasks List Page

**File**: `src/app/(dashboard)/tasks/page.tsx`
```typescript
'use client'

import { useEffect, useState } from 'react'
import { useOrg } from '@/lib/context/org-context'
import { createClient } from '@/lib/supabase/client'
import { Task } from '@/types/database'
import { TaskCard } from '@/components/tasks/task-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Search } from 'lucide-react'
import Link from 'next/link'

export default function TasksPage() {
  const { organization } = useOrg()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const supabase = createClient()

  useEffect(() => {
    if (!organization) return

    const loadTasks = async () => {
      setLoading(true)
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('org_id', organization.id)
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data } = await query
      setTasks(data || [])
      setLoading(false)
    }

    loadTasks()
  }, [organization?.id, statusFilter])

  const filteredTasks = tasks.filter(task =>
    task.title.toLowerCase().includes(search.toLowerCase()) ||
    task.description?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">All Tasks</h1>
        <Link href="/tasks/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </Link>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No tasks found</div>
      ) : (
        <div className="grid gap-3">
          {filteredTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}
```

### Success Criteria

#### Automated Verification:
- [ ] `npm run dev` starts without errors
- [ ] `npm run build` completes successfully

#### Manual Verification:
- [ ] Can create new task from dashboard
- [ ] LA Galaxy: Department field required on creation form
- [ ] Portland Thorns: Photo requirement checkbox available
- [ ] Portland Thorns: Audit log shows all activities
- [ ] Portland Thorns: Photo uploads appear in audit log
- [ ] Tasks list page works with search and filters

---

## Phase 6: RAG System with Gemini API

### Overview
Implement tenant-isolated semantic search using Supabase pgvector for storage and Gemini API for embeddings and response generation.

### 6.1 Install Gemini SDK

```bash
npm install @google/generative-ai
```

### 6.2 Embedding Generation Service

**File**: `src/lib/rag/embeddings.ts`
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })
  const result = await model.embedContent(text)
  return result.embedding.values
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })
  const results = await Promise.all(
    texts.map(text => model.embedContent(text))
  )
  return results.map(r => r.embedding.values)
}
```

### 6.3 Vector Search Service

**File**: `src/lib/rag/search.ts`
```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { generateEmbedding } from './embeddings'

export interface SearchResult {
  id: string
  content_type: string
  content_id: string
  content_text: string
  similarity: number
}

export async function searchSimilarContent(
  orgId: string,
  query: string,
  options: { threshold?: number; limit?: number } = {}
): Promise<SearchResult[]> {
  const { threshold = 0.7, limit = 5 } = options

  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(query)

  // Search via Supabase RPC (tenant-isolated via org_id parameter)
  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    query_org_id: orgId,
    match_threshold: threshold,
    match_count: limit,
  })

  if (error) {
    console.error('Search error:', error)
    return []
  }

  return data || []
}
```

### 6.4 RAG Query Service

**File**: `src/lib/rag/query.ts`
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'
import { searchSimilarContent, SearchResult } from './search'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export interface RAGResponse {
  answer: string
  sources: SearchResult[]
  confidence: 'high' | 'medium' | 'low'
}

export async function queryRAG(
  orgId: string,
  question: string
): Promise<RAGResponse> {
  // 1. Search for relevant content (tenant-isolated)
  const relevantDocs = await searchSimilarContent(orgId, question, {
    threshold: 0.6,
    limit: 5,
  })

  if (relevantDocs.length === 0) {
    return {
      answer: "I couldn't find any relevant information in your tasks to answer this question.",
      sources: [],
      confidence: 'low',
    }
  }

  // 2. Build context from relevant documents
  const context = relevantDocs
    .map((doc, i) => `[${i + 1}] ${doc.content_text}`)
    .join('\n\n')

  // 3. Generate response with Gemini Pro
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

  const prompt = `You are an AI assistant for a game day operations platform. Based on the following task information from the system, answer the user's question.

CONTEXT (Tasks from the system):
${context}

USER QUESTION: ${question}

INSTRUCTIONS:
- Only use information from the provided context
- Reference specific tasks when relevant (e.g., "Task [1] mentions...")
- If the context doesn't contain enough information to fully answer, say so
- Keep responses concise and actionable
- Focus on operational insights

ANSWER:`

  const result = await model.generateContent(prompt)
  const answer = result.response.text()

  // Determine confidence based on similarity scores
  const avgSimilarity = relevantDocs.reduce((sum, d) => sum + d.similarity, 0) / relevantDocs.length
  const confidence = avgSimilarity > 0.8 ? 'high' : avgSimilarity > 0.7 ? 'medium' : 'low'

  return {
    answer,
    sources: relevantDocs,
    confidence,
  }
}
```

### 6.5 Auto-Embed Tasks on Create/Update

**File**: `src/lib/rag/sync.ts`
```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { generateEmbedding } from './embeddings'
import { Task } from '@/types/database'

export async function syncTaskEmbedding(task: Task): Promise<void> {
  const supabase = createAdminClient()

  // Create text representation of task
  const contentText = [
    task.title,
    task.description || '',
    task.department ? `Department: ${task.department}` : '',
    `Status: ${task.status}`,
    `Priority: ${task.priority}`,
  ].filter(Boolean).join('. ')

  // Generate embedding
  const embedding = await generateEmbedding(contentText)

  // Upsert embedding record
  const { error } = await supabase
    .from('embeddings')
    .upsert({
      org_id: task.org_id,
      content_type: 'task',
      content_id: task.id,
      content_text: contentText,
      embedding: embedding,
    }, {
      onConflict: 'org_id,content_type,content_id',
    })

  if (error) {
    console.error('Failed to sync embedding:', error)
  }
}

export async function deleteTaskEmbedding(taskId: string, orgId: string): Promise<void> {
  const supabase = createAdminClient()

  await supabase
    .from('embeddings')
    .delete()
    .eq('content_type', 'task')
    .eq('content_id', taskId)
    .eq('org_id', orgId)
}
```

### 6.6 API Route for RAG Queries

**File**: `src/app/api/rag/query/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { queryRAG } from '@/lib/rag/query'

export async function POST(request: NextRequest) {
  try {
    const { question, orgId } = await request.json()

    if (!question || !orgId) {
      return NextResponse.json(
        { error: 'Missing question or orgId' },
        { status: 400 }
      )
    }

    const result = await queryRAG(orgId, question)

    return NextResponse.json(result)
  } catch (error) {
    console.error('RAG query error:', error)
    return NextResponse.json(
      { error: 'Failed to process query' },
      { status: 500 }
    )
  }
}
```

### 6.7 RAG Chat Component

**File**: `src/components/rag/ai-assistant.tsx`
```typescript
'use client'

import { useState } from 'react'
import { useOrg } from '@/lib/context/org-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Send, Sparkles, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface Source {
  content_id: string
  content_text: string
  similarity: number
}

interface RAGResponse {
  answer: string
  sources: Source[]
  confidence: 'high' | 'medium' | 'low'
}

export function AIAssistant() {
  const { organization } = useOrg()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<RAGResponse | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || !organization) return

    setLoading(true)
    setResponse(null)

    try {
      const res = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: query,
          orgId: organization.id,
        }),
      })

      const data = await res.json()
      setResponse(data)
    } catch (error) {
      console.error('Query failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const confidenceColors = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-red-100 text-red-700',
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          AI Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about your tasks... (e.g., 'What security tasks are pending?')"
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !query.trim()}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>

        {response && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className={confidenceColors[response.confidence]}>
                {response.confidence} confidence
              </Badge>
              <span className="text-xs text-gray-500">
                {response.sources.length} sources found
              </span>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-800 whitespace-pre-wrap">{response.answer}</p>
            </div>

            {response.sources.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Sources:</p>
                {response.sources.map((source, i) => (
                  <Link
                    key={source.content_id}
                    href={`/tasks/${source.content_id}`}
                    className="block p-2 bg-white border rounded hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 truncate flex-1">
                        [{i + 1}] {source.content_text}
                      </span>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-xs text-gray-400">
                          {Math.round(source.similarity * 100)}% match
                        </span>
                        <ExternalLink className="h-3 w-3 text-gray-400" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {!response && !loading && (
          <div className="text-center py-4 text-gray-500 text-sm">
            <p>Ask questions about your tasks:</p>
            <ul className="mt-2 space-y-1">
              <li>"What urgent tasks need attention?"</li>
              <li>"Summarize pending security tasks"</li>
              <li>"Which tasks are overdue?"</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

### 6.8 Update Task Creation to Sync Embeddings

Update task creation in `src/app/(dashboard)/tasks/new/page.tsx`:

```typescript
// At the top, add import:
import { syncTaskEmbedding } from '@/lib/rag/sync'

// After successful task creation (after the toast), add:
// Sync embedding for RAG (non-blocking)
syncTaskEmbedding(data).catch(console.error)
```

### 6.9 Add AI Assistant to Dashboard

Add to `src/app/(dashboard)/page.tsx`:

```typescript
import { AIAssistant } from '@/components/rag/ai-assistant'

// In the return, after stats cards and before department filter:
<AIAssistant />
```

### 6.10 Seed Embeddings Script

**File**: `src/scripts/seed-embeddings.ts`
```typescript
import { createAdminClient } from '../lib/supabase/admin'
import { syncTaskEmbedding } from '../lib/rag/sync'

async function seedEmbeddings() {
  const supabase = createAdminClient()

  // Get all tasks
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')

  if (error || !tasks) {
    console.error('Failed to fetch tasks:', error)
    return
  }

  console.log(`Seeding embeddings for ${tasks.length} tasks...`)

  for (const task of tasks) {
    try {
      await syncTaskEmbedding(task)
      console.log(`✓ Embedded: ${task.title}`)
    } catch (err) {
      console.error(`✗ Failed: ${task.title}`, err)
    }
  }

  console.log('Done!')
}

seedEmbeddings()
```

Run with: `npx tsx src/scripts/seed-embeddings.ts`

### Success Criteria

#### Automated Verification:
- [ ] `npm run dev` starts without errors
- [ ] `npm run build` completes successfully
- [ ] Gemini API key is configured

#### Manual Verification:
- [ ] AI Assistant component appears on dashboard
- [ ] Can ask questions about tasks
- [ ] Responses reference actual task data
- [ ] Sources link to correct task detail pages
- [ ] LA Galaxy queries only return LA Galaxy tasks (tenant isolation)
- [ ] Portland Thorns queries only return Portland Thorns tasks (tenant isolation)
- [ ] Confidence levels display correctly

---

## Phase 7: Polish & Demo Preparation

### Overview
Final touches, bug fixes, and demo preparation.

### 7.1 Update Toast Hook

**File**: `src/hooks/use-toast.ts`
```typescript
'use client'

import * as React from 'react'

import type {
  ToastActionElement,
  ToastProps,
} from '@/components/ui/toast'

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType['ADD_TOAST']
      toast: ToasterToast
    }
  | {
      type: ActionType['UPDATE_TOAST']
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType['DISMISS_TOAST']
      toastId?: ToasterToast['id']
    }
  | {
      type: ActionType['REMOVE_TOAST']
      toastId?: ToasterToast['id']
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: 'REMOVE_TOAST',
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case 'DISMISS_TOAST': {
      const { toastId } = action

      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case 'REMOVE_TOAST':
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, 'id'>

function toast({ ...props }: Toast) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: 'UPDATE_TOAST',
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id })

  dispatch({
    type: 'ADD_TOAST',
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }),
  }
}

export { useToast, toast }
```

### 7.2 Empty State for Dashboard

Add to dashboard when no tasks exist:

```typescript
{tasks.length === 0 && !loading && (
  <Card className="p-12 text-center">
    <div className="text-gray-400 mb-4">
      <CheckSquare className="h-12 w-12 mx-auto" />
    </div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks yet</h3>
    <p className="text-gray-600 mb-4">Get started by creating your first task.</p>
    <Link href="/tasks/new">
      <Button>
        <Plus className="h-4 w-4 mr-2" />
        Create Task
      </Button>
    </Link>
  </Card>
)}
```

### 7.3 README

**File**: `touchline/README.md`
```markdown
# Touchline - Multi-Tenant Game Day Operations Platform

A demonstration of enterprise-grade multi-tenancy, feature flags, and RAG-ready architecture for the Arkero take-home assessment.

## Features

### Multi-Tenant Architecture
- Row-Level Security (RLS) for data isolation
- Organization-specific feature configuration
- User roles and permissions

### LA Galaxy - Department-Based Tasks
- Tasks organized by department (Operations, Security, Medical, etc.)
- Department filtering on dashboard
- Required department field for task creation

### Portland Thorns - Photo Verification
- Photo upload for task verification
- Cannot complete photo-required tasks without upload
- Full audit log for compliance

### AI-Powered RAG System
- Semantic search across tasks using Gemini embeddings
- Natural language queries ("What security tasks are pending?")
- Tenant-isolated - each org only searches their own data
- Confidence scoring and source attribution

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL with RLS + pgvector)
- **AI/RAG**: Google Gemini API (gemini-embedding-001 + gemini-pro)
- **UI**: Tailwind CSS + shadcn/ui
- **Language**: TypeScript

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a Supabase project at https://supabase.com

4. Copy `.env.example` to `.env.local` and add your credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   GEMINI_API_KEY=your-gemini-api-key
   ```

5. Run the database migration in Supabase SQL Editor (see `supabase/migrations/001_initial_schema.sql`)

6. Run the seed data (see `supabase/seed.sql`)

7. Create a storage bucket named `task-photos` (public access for demo)

8. Seed embeddings for RAG:
   ```bash
   npx tsx src/scripts/seed-embeddings.ts
   ```

9. Start the development server:
   ```bash
   npm run dev
   ```

10. Open http://localhost:3000

## Demo Instructions

1. **LA Galaxy (Department Feature)**
   - Select "LA Galaxy" from the org switcher
   - Notice department filter on dashboard
   - Create a task - department field is required
   - Tasks are grouped by department

2. **Portland Thorns (Photo Verification)**
   - Switch to "Portland Thorns"
   - Notice "Photo required" badges on some tasks
   - Try to complete a photo-required task - blocked
   - Upload a photo and complete the task
   - View audit log to see all activity

3. **AI Assistant (RAG Demo)**
   - Use the AI Assistant on the dashboard
   - Ask: "What security tasks are pending?"
   - Ask: "Summarize urgent tasks"
   - Notice responses are scoped to current organization
   - Click source links to navigate to referenced tasks

## Architecture Highlights

- **Feature Flags**: `FeatureGate` component for conditional UI
- **Data Isolation**: RLS policies enforce tenant boundaries
- **Extensibility**: JSONB columns for custom fields
- **RAG System**: pgvector for embeddings + Gemini API for generation
- **Tenant-Isolated AI**: Each org's queries only search their own data

## What's Not Implemented (Out of Scope)

- Real authentication (using mock auth with switcher)
- Real-time updates
- Mobile responsiveness
- Comprehensive error handling
```

### 7.4 Final Checklist

Before demo:

1. [ ] Clear localStorage and test fresh load
2. [ ] Test org switching multiple times
3. [ ] Verify LA Galaxy features work
4. [ ] Verify Portland Thorns features work
5. [ ] Upload test photos and verify gallery
6. [ ] Check audit log entries
7. [ ] Create tasks in both orgs
8. [ ] Verify RLS by checking Supabase data

### Success Criteria

#### Automated Verification:
- [ ] `npm run build` completes without errors
- [ ] `npm run lint` passes

#### Manual Verification:
- [ ] Complete demo flow for LA Galaxy
- [ ] Complete demo flow for Portland Thorns
- [ ] Switching orgs clearly shows different features
- [ ] UI is professional and polished
- [ ] README is accurate and complete

---

## Summary

This implementation plan provides a complete, phase-by-phase guide to building Touchline. Each phase builds on the previous one, with clear success criteria to verify completion.

**Total Files to Create**: ~30 files
**Estimated Phases**: 7
**Key Demonstrations**:
1. Multi-tenancy with RLS
2. Feature flags with conditional UI
3. Department-based task management (LA Galaxy)
4. Photo verification workflow (Portland Thorns)
5. Audit logging for compliance
6. **RAG system with tenant-isolated semantic search**

**Architecture Highlights for Arkero**:
- AI-native with working RAG implementation (Gemini + pgvector)
- Production-quality patterns (not prototype code)
- Scalable to 100+ tenants without code changes
- RAG-ready with tenant-isolated embeddings
- Clean separation of concerns
