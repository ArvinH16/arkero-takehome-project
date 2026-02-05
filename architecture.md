# Product Requirements Document (PRD)
## Touchline: Multi-Tenant Game Day Operations Platform

**Project:** Arkero Take-Home Assessment  
**Author:** Arvin Hakakian
**Date:** February 2026  
**Status:** Ready for Implementation

---

## Executive Summary

This PRD outlines the architecture and implementation plan for **Touchline**, a multi-tenant game day operations platform for professional sports teams. The solution demonstrates enterprise-grade multi-tenancy, per-customer feature customization, and RAG-ready data architecture—all core competencies required for an AI-native sports operations platform like Arkero.

### Key Differentiators of This Solution
1. **Single codebase with feature flags** - No customer forks, scales to 100+ tenants
2. **Database-level tenant isolation via RLS** - Security by default, not by code
3. **JSONB for extensibility** - No column sprawl, type-safe custom fields
4. **RAG-ready architecture** - Vector embeddings with automatic tenant isolation
5. **Production-quality implementation** - Not a prototype, but deployable code

---

## Part 1: Architecture Design

### 1.1 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   LA Galaxy     │  │ Portland Thorns │  │  Future Teams   │             │
│  │   Dashboard     │  │   Dashboard     │  │   Dashboard     │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│           └────────────────────┼────────────────────┘                       │
│                                ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     NEXT.JS APPLICATION                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │   Feature    │  │   Feature    │  │   Feature    │               │   │
│  │  │   Flags      │◄─┤   Registry   │──►   Renderer   │               │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │   │
│  │           │                                   │                      │   │
│  │           ▼                                   ▼                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │                    SERVER ACTIONS / API ROUTES               │   │   │
│  │  │  • Task CRUD with tenant context                             │   │   │
│  │  │  • Photo upload with validation                              │   │   │
│  │  │  • Department filtering                                      │   │   │
│  │  │  • RAG query endpoint                                        │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                ▼                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE LAYER                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    ROW LEVEL SECURITY (RLS)                          │   │
│  │         ┌─────────────────────────────────────────────┐             │   │
│  │         │  Every query automatically filtered by:     │             │   │
│  │         │  org_id = auth.jwt() -> 'org_id'            │             │   │
│  │         └─────────────────────────────────────────────┘             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │organizations │  │    users     │  │    tasks     │  │ task_photos  │   │
│  │              │  │              │  │              │  │              │   │
│  │ id           │  │ id           │  │ id           │  │ id           │   │
│  │ name         │  │ org_id  ────►│◄─┤ org_id       │◄─┤ task_id      │   │
│  │ slug         │  │ email        │  │ title        │  │ photo_url    │   │
│  │ feature_cfg  │  │ role         │  │ department   │  │ uploaded_by  │   │
│  │ custom_fields│  │ department   │  │ custom_data  │  │ uploaded_at  │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐                                        │
│  │  audit_log   │  │  embeddings  │  ◄── For RAG (pgvector)                │
│  │              │  │              │                                        │
│  │ id           │  │ id           │                                        │
│  │ org_id  ─────┤  │ org_id  ─────┤  ◄── Tenant isolation for AI          │
│  │ action       │  │ content      │                                        │
│  │ metadata     │  │ embedding    │                                        │
│  └──────────────┘  └──────────────┘                                        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       SUPABASE STORAGE                               │   │
│  │  /photos/{org_id}/{task_id}/  ◄── Photos isolated by tenant path    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         GEMINI API                                    │  │
│  │  • text-embedding-004: Generate embeddings for RAG                   │  │
│  │  • gemini-pro: Generate responses from retrieved context             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Customization Strategy: Feature Flags + Config

**Decision: Single codebase with feature configuration (NOT customer forks)**

```typescript
// Organization feature configuration stored in JSONB
interface OrganizationConfig {
  features: {
    departments: {
      enabled: boolean;
      required: boolean;  // LA Galaxy: true
      list: string[];     // ["Operations", "Security", "Medical", "Concessions"]
    };
    photoVerification: {
      enabled: boolean;   // Portland Thorns: true
      requiredForTasks: string[];  // Task types requiring photos
    };
    // Future features added here without schema changes
  };
  customFields: {
    tasks: CustomFieldDefinition[];
  };
}
```

**Why this approach:**
| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| Customer forks | Full flexibility | Maintenance nightmare, can't scale | ❌ |
| Plugin system | Very extensible | Over-engineered for 2-50 customers | ❌ |
| Feature flags + config | Simple, scalable, maintainable | Some features need code | ✅ |
| Hard-coded per customer | Fast to build | Technical debt, doesn't scale | ❌ |

### 1.3 Data Model

#### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ┌─────────────────┐         ┌─────────────────┐                       │
│  │  organizations  │         │     users       │                       │
│  ├─────────────────┤         ├─────────────────┤                       │
│  │ id (PK)         │◄───┐    │ id (PK)         │                       │
│  │ name            │    │    │ org_id (FK) ────┼───────────────────┐   │
│  │ slug            │    │    │ email           │                   │   │
│  │ feature_config  │    │    │ name            │                   │   │
│  │ created_at      │    │    │ role            │                   │   │
│  └─────────────────┘    │    │ department      │                   │   │
│                         │    │ created_at      │                   │   │
│                         │    └─────────────────┘                   │   │
│                         │              │                           │   │
│                         │              │ created_by                │   │
│                         │              ▼                           │   │
│                         │    ┌─────────────────┐                   │   │
│                         │    │     tasks       │                   │   │
│                         │    ├─────────────────┤                   │   │
│                         ├────┤ id (PK)         │                   │   │
│                         │    │ org_id (FK) ────┼───────────────────┤   │
│                         │    │ title           │                   │   │
│                         │    │ description     │                   │   │
│                         │    │ status          │                   │   │
│                         │    │ department      │◄── NULL for orgs  │   │
│                         │    │ requires_photo  │    without depts  │   │
│                         │    │ assigned_to(FK) │                   │   │
│                         │    │ custom_data     │◄── JSONB          │   │
│                         │    │ due_date        │                   │   │
│                         │    │ completed_at    │                   │   │
│                         │    │ created_at      │                   │   │
│                         │    └─────────────────┘                   │   │
│                         │              │                           │   │
│                         │              │ 1:N                       │   │
│                         │              ▼                           │   │
│                         │    ┌─────────────────┐                   │   │
│                         │    │  task_photos    │                   │   │
│                         │    ├─────────────────┤                   │   │
│                         ├────┤ id (PK)         │                   │   │
│                         │    │ org_id (FK) ────┼───────────────────┤   │
│                         │    │ task_id (FK)    │                   │   │
│                         │    │ photo_url       │                   │   │
│                         │    │ uploaded_by(FK) │                   │   │
│                         │    │ uploaded_at     │                   │   │
│                         │    │ metadata        │◄── JSONB (GPS,    │   │
│                         │    └─────────────────┘    device, etc)   │   │
│                         │                                          │   │
│                         │    ┌─────────────────┐                   │   │
│                         │    │   audit_log     │                   │   │
│                         │    ├─────────────────┤                   │   │
│                         ├────┤ id (PK)         │                   │   │
│                         │    │ org_id (FK) ────┼───────────────────┤   │
│                         │    │ user_id (FK)    │                   │   │
│                         │    │ action          │                   │   │
│                         │    │ entity_type     │                   │   │
│                         │    │ entity_id       │                   │   │
│                         │    │ metadata        │◄── JSONB          │   │
│                         │    │ created_at      │                   │   │
│                         │    └─────────────────┘                   │   │
│                         │                                          │   │
│                         │    ┌─────────────────┐                   │   │
│                         │    │   embeddings    │◄── For RAG        │   │
│                         │    ├─────────────────┤                   │   │
│                         └────┤ id (PK)         │                   │   │
│                              │ org_id (FK) ────┼───────────────────┘   │
│                              │ content_type    │                       │
│                              │ content_id      │                       │
│                              │ content_text    │                       │
│                              │ embedding       │◄── vector(768)        │
│                              │ created_at      │                       │
│                              └─────────────────┘                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### SQL Schema

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";  -- For RAG embeddings

-- ============================================================================
-- ORGANIZATIONS (Tenants)
-- ============================================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,  -- e.g., "la-galaxy", "portland-thorns"
  
  -- Feature configuration - JSONB avoids column sprawl
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
  department TEXT,  -- NULL if org doesn't use departments
  
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
  
  -- Department feature (LA Galaxy)
  department TEXT,  -- Required only if org.feature_config.features.departments.required = true
  
  -- Photo verification feature (Portland Thorns)
  requires_photo BOOLEAN DEFAULT FALSE,
  
  -- Flexible custom data - avoids column sprawl for future features
  custom_data JSONB DEFAULT '{}',
  
  assigned_to UUID REFERENCES users(id),
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TASK PHOTOS (Portland Thorns feature)
-- ============================================================================
CREATE TABLE task_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  
  photo_url TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata for compliance (GPS coords, device info, etc.)
  metadata JSONB DEFAULT '{}'
);

-- ============================================================================
-- AUDIT LOG (Portland Thorns compliance requirement)
-- ============================================================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  
  action TEXT NOT NULL,  -- 'task_created', 'task_completed', 'photo_uploaded', etc.
  entity_type TEXT NOT NULL,  -- 'task', 'photo', etc.
  entity_id UUID NOT NULL,
  
  metadata JSONB DEFAULT '{}',  -- Before/after state, additional context
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- EMBEDDINGS (RAG-ready, tenant-isolated)
-- ============================================================================
CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  content_type TEXT NOT NULL,  -- 'task', 'document', 'playbook', etc.
  content_id UUID NOT NULL,
  content_text TEXT NOT NULL,
  
  embedding vector(768) NOT NULL,  -- Gemini text-embedding-004 dimensions
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(org_id, content_type, content_id)
);

-- Create index for fast vector similarity search
CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - Critical for tenant isolation
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- Helper function to get org_id from JWT
CREATE OR REPLACE FUNCTION auth.org_id() RETURNS UUID AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$ LANGUAGE SQL STABLE;

-- Helper function to get user's department from JWT
CREATE OR REPLACE FUNCTION auth.user_department() RETURNS TEXT AS $$
  SELECT current_setting('request.jwt.claims', true)::json->>'department';
$$ LANGUAGE SQL STABLE;

-- Helper function to get user's role from JWT
CREATE OR REPLACE FUNCTION auth.user_role() RETURNS TEXT AS $$
  SELECT current_setting('request.jwt.claims', true)::json->>'role';
$$ LANGUAGE SQL STABLE;

-- ORGANIZATION POLICIES
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (id = auth.org_id());

-- USER POLICIES  
CREATE POLICY "Users can view users in their organization"
  ON users FOR SELECT
  USING (org_id = auth.org_id());

-- TASK POLICIES
-- Admins/Managers see all tasks; Department heads see only their department
CREATE POLICY "Users can view tasks based on role"
  ON tasks FOR SELECT
  USING (
    org_id = auth.org_id() 
    AND (
      auth.user_role() IN ('admin', 'manager')
      OR department = auth.user_department()
      OR department IS NULL
    )
  );

CREATE POLICY "Users can create tasks in their organization"
  ON tasks FOR INSERT
  WITH CHECK (org_id = auth.org_id());

CREATE POLICY "Users can update tasks they have access to"
  ON tasks FOR UPDATE
  USING (
    org_id = auth.org_id() 
    AND (
      auth.user_role() IN ('admin', 'manager')
      OR department = auth.user_department()
    )
  );

-- TASK PHOTO POLICIES
CREATE POLICY "Users can view photos in their organization"
  ON task_photos FOR SELECT
  USING (org_id = auth.org_id());

CREATE POLICY "Users can upload photos to their organization"
  ON task_photos FOR INSERT
  WITH CHECK (org_id = auth.org_id());

-- AUDIT LOG POLICIES
CREATE POLICY "Users can view audit logs in their organization"
  ON audit_log FOR SELECT
  USING (org_id = auth.org_id());

CREATE POLICY "System can insert audit logs"
  ON audit_log FOR INSERT
  WITH CHECK (org_id = auth.org_id());

-- EMBEDDING POLICIES (Critical for RAG isolation)
CREATE POLICY "Users can only search embeddings in their organization"
  ON embeddings FOR SELECT
  USING (org_id = auth.org_id());

CREATE POLICY "System can insert embeddings"
  ON embeddings FOR INSERT
  WITH CHECK (org_id = auth.org_id());

-- ============================================================================
-- INDEXES for performance
-- ============================================================================
CREATE INDEX idx_tasks_org_id ON tasks(org_id);
CREATE INDEX idx_tasks_department ON tasks(org_id, department);
CREATE INDEX idx_tasks_status ON tasks(org_id, status);
CREATE INDEX idx_task_photos_task_id ON task_photos(task_id);
CREATE INDEX idx_audit_log_entity ON audit_log(org_id, entity_type, entity_id);
CREATE INDEX idx_embeddings_org_content ON embeddings(org_id, content_type);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to search similar content via RAG (respects RLS automatically)
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),
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
  WHERE 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to validate task completion (checks photo requirement)
CREATE OR REPLACE FUNCTION validate_task_completion(task_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  task_record RECORD;
  photo_count INT;
BEGIN
  SELECT t.*, o.feature_config
  INTO task_record
  FROM tasks t
  JOIN organizations o ON t.org_id = o.id
  WHERE t.id = task_id;
  
  -- If photo verification is not enabled, allow completion
  IF NOT (task_record.feature_config->'features'->'photoVerification'->>'enabled')::boolean THEN
    RETURN TRUE;
  END IF;
  
  -- If task doesn't require photo, allow completion
  IF NOT task_record.requires_photo THEN
    RETURN TRUE;
  END IF;
  
  -- Check if photo exists
  SELECT COUNT(*) INTO photo_count FROM task_photos WHERE task_photos.task_id = validate_task_completion.task_id;
  
  RETURN photo_count > 0;
END;
$$ LANGUAGE plpgsql;
```

### 1.4 How This Avoids Common Problems

#### Problem 1: Column Sprawl
```
❌ BAD: Adding columns for every feature
   tasks: dept_la_galaxy, photo_portland, custom1, custom2, custom3...

✅ SOLUTION: JSONB for extensibility
   - feature_config on organizations (feature flags)
   - custom_data on tasks (per-task custom fields)
   - metadata on photos/audit (flexible context)
```

#### Problem 2: Type Safety with JSONB
```typescript
// TypeScript interfaces enforce structure
interface TaskCustomData {
  // LA Galaxy specific
  gameNumber?: number;
  section?: string;
  
  // Portland Thorns specific
  complianceCategory?: string;
  verifiedBy?: string;
  
  // Validated at runtime with Zod
  [key: string]: unknown;
}

// Zod schema for runtime validation
const taskCustomDataSchema = z.object({
  gameNumber: z.number().optional(),
  section: z.string().optional(),
  complianceCategory: z.string().optional(),
  verifiedBy: z.string().optional(),
}).passthrough();
```

#### Problem 3: RAG Data Leakage Between Tenants
```
❌ BAD: Filter in application code
   const docs = await searchEmbeddings(query);
   return docs.filter(d => d.org_id === currentOrg); // Bug-prone!

✅ SOLUTION: RLS enforces at database level
   - Policy: USING (org_id = auth.org_id())
   - Even if code has bugs, database blocks cross-tenant access
   - match_documents() function inherits RLS automatically
```

### 1.5 Trade-offs Analysis

| Decision | Benefit | Cost | Why Worth It |
|----------|---------|------|--------------|
| Single codebase | Easy maintenance, shared improvements | Features need conditional logic | Scale to 100+ customers without forks |
| JSONB for config | No schema migrations per feature | Slightly harder queries | Flexibility > query convenience |
| RLS for isolation | Security by default | Small perf overhead (~5%) | Data breach = company-ending |
| Separate photos table | Clean audit trail, S3-ready | Extra join | Compliance requirement |
| pgvector for RAG | Same DB, automatic RLS | Not as fast as Pinecone | Simplicity + security > raw speed |

### 1.6 Scaling Analysis

#### At 50 Customers
- ✅ Works fine
- Watch: JSONB index performance on feature_config
- Watch: Vector index rebuild time

#### At 100 Customers  
- ✅ Still works
- Consider: Read replicas for dashboard queries
- Consider: Partitioning tasks table by org_id

#### What Breaks First?
1. **Embedding search latency** - Mitigate with IVFFlat index tuning
2. **Feature flag complexity** - Mitigate with feature categorization
3. **Audit log size** - Mitigate with archival strategy

#### With More Time, I Would Add:
1. **Schema registry** for custom fields (validate at insert)
2. **Feature versioning** (A/B test features per org)
3. **Async embedding generation** (queue system)
4. **Caching layer** for feature configs (Redis)

---

## Part 2: Implementation Specification

### 2.1 Technology Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| **Framework** | Next.js 14 (App Router) | Server components, server actions, fast iteration |
| **Database** | Supabase (PostgreSQL) | RLS, pgvector, storage, auth - all-in-one |
| **Styling** | Tailwind CSS + shadcn/ui | Professional UI components, fast to build |
| **State** | React Query (TanStack) | Cache management, optimistic updates |
| **Validation** | Zod | Runtime type safety for JSONB |
| **AI/Embeddings** | Google Gemini API | text-embedding-004 + gemini-pro |
| **File Storage** | Supabase Storage | Same RLS policies, integrated |

### 2.2 Project Structure

```
touchline/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Sidebar, org context
│   │   ├── page.tsx                # Main dashboard
│   │   ├── tasks/
│   │   │   ├── page.tsx            # Task list with filters
│   │   │   ├── [id]/page.tsx       # Task detail
│   │   │   └── new/page.tsx        # Create task
│   │   └── audit/
│   │       └── page.tsx            # Audit log viewer (Portland)
│   └── api/
│       ├── tasks/route.ts
│       ├── photos/upload/route.ts
│       └── rag/query/route.ts
├── components/
│   ├── ui/                         # shadcn components
│   ├── tasks/
│   │   ├── task-card.tsx
│   │   ├── task-form.tsx
│   │   ├── department-filter.tsx   # LA Galaxy feature
│   │   └── photo-upload.tsx        # Portland feature
│   ├── features/
│   │   ├── feature-gate.tsx        # Conditional rendering
│   │   └── feature-provider.tsx    # Context for feature flags
│   └── layout/
│       ├── sidebar.tsx
│       └── header.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser client
│   │   ├── server.ts               # Server client
│   │   └── admin.ts                # Service role client
│   ├── features/
│   │   ├── registry.ts             # Feature definitions
│   │   └── hooks.ts                # useFeature, useOrgConfig
│   ├── rag/
│   │   ├── embeddings.ts           # Generate embeddings
│   │   └── search.ts               # Semantic search
│   └── validations/
│       ├── task.ts                 # Task schemas
│       └── organization.ts         # Config schemas
├── types/
│   ├── database.ts                 # Generated from Supabase
│   ├── features.ts                 # Feature config types
│   └── index.ts
└── supabase/
    ├── migrations/
    │   └── 001_initial_schema.sql
    └── seed.sql                    # Demo data for both orgs
```

### 2.3 Feature Implementation Details

#### Feature A: Department-Based Tasks (LA Galaxy)

**Requirements Implemented:**
- [x] Tasks tagged with department
- [x] Dashboard grouped/filtered by department  
- [x] Department field REQUIRED for LA Galaxy only
- [x] Department heads see only their tasks

**Key Components:**

```typescript
// lib/features/registry.ts
export const FEATURES = {
  DEPARTMENTS: 'departments',
  PHOTO_VERIFICATION: 'photoVerification',
} as const;

// components/features/feature-gate.tsx
export function FeatureGate({ 
  feature, 
  children, 
  fallback = null 
}: {
  feature: keyof typeof FEATURES;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { config } = useOrgConfig();
  const isEnabled = config?.features?.[feature]?.enabled ?? false;
  
  return isEnabled ? children : fallback;
}

// Usage in task form
<FeatureGate feature="departments">
  <DepartmentSelect 
    required={config.features.departments.required}
    options={config.features.departments.list}
  />
</FeatureGate>
```

**Dashboard with Department Filtering:**

```typescript
// app/(dashboard)/page.tsx
export default async function Dashboard() {
  const { org, user } = await getSession();
  const config = org.feature_config as OrgConfig;
  
  // Get tasks (RLS handles department filtering for dept heads)
  const tasks = await getTasks();
  
  // Group by department if feature enabled
  const groupedTasks = config.features.departments.enabled
    ? groupBy(tasks, 'department')
    : { 'All Tasks': tasks };
    
  return (
    <div>
      <FeatureGate feature="departments">
        <DepartmentFilter 
          departments={config.features.departments.list}
          userDepartment={user.department}
          userRole={user.role}
        />
      </FeatureGate>
      
      <TaskBoard groups={groupedTasks} />
    </div>
  );
}
```

#### Feature B: Photo Verification (Portland Thorns)

**Requirements Implemented:**
- [x] Mark specific tasks as "photo required"
- [x] Cannot complete task without uploading photo
- [x] Photos stored securely, viewable in audit log
- [x] Only Portland Thorns sees this feature

**Key Components:**

```typescript
// components/tasks/photo-upload.tsx
export function PhotoUpload({ taskId, onUpload }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  
  async function handleUpload(file: File) {
    setUploading(true);
    
    // Get GPS metadata if available
    const metadata = await extractPhotoMetadata(file);
    
    // Upload to Supabase Storage (path includes org_id for isolation)
    const { data, error } = await supabase.storage
      .from('task-photos')
      .upload(`${org.id}/${taskId}/${file.name}`, file);
    
    if (data) {
      // Create photo record (triggers audit log)
      await createTaskPhoto({
        task_id: taskId,
        photo_url: data.path,
        metadata,
      });
      
      onUpload();
    }
    
    setUploading(false);
  }
  
  return (
    <Dropzone onDrop={handleUpload} accept="image/*">
      {/* Upload UI */}
    </Dropzone>
  );
}

// Task completion validation
export async function completeTask(taskId: string) {
  const supabase = createServerClient();
  
  // Database function validates photo requirement
  const { data: canComplete } = await supabase
    .rpc('validate_task_completion', { task_id: taskId });
  
  if (!canComplete) {
    throw new Error('Photo required before completing this task');
  }
  
  // Complete the task
  const { error } = await supabase
    .from('tasks')
    .update({ 
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', taskId);
  
  // Audit log created via database trigger
  
  return { success: !error };
}
```

**Audit Log Viewer:**

```typescript
// app/(dashboard)/audit/page.tsx
export default async function AuditPage() {
  const supabase = createServerClient();
  
  const { data: logs } = await supabase
    .from('audit_log')
    .select(`
      *,
      user:users(name, email),
      photos:task_photos(photo_url, metadata)
    `)
    .order('created_at', { ascending: false });
  
  return (
    <FeatureGate feature="photoVerification" fallback={<NotFound />}>
      <AuditLogTable logs={logs} />
    </FeatureGate>
  );
}
```

### 2.4 RAG Implementation

```typescript
// lib/rag/embeddings.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// lib/rag/search.ts
export async function searchSimilarContent(
  query: string,
  options: { threshold?: number; limit?: number } = {}
) {
  const { threshold = 0.7, limit = 5 } = options;
  
  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(query);
  
  // Search via Supabase (RLS enforces tenant isolation!)
  const supabase = createServerClient();
  const { data } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
  });
  
  return data;
}

// app/api/rag/query/route.ts
export async function POST(request: Request) {
  const { question } = await request.json();
  
  // 1. Search for relevant content (tenant-isolated via RLS)
  const relevantDocs = await searchSimilarContent(question);
  
  // 2. Generate response with context
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  
  const prompt = `
    Based on the following tasks and information from the system:
    ${JSON.stringify(relevantDocs, null, 2)}
    
    Please answer this question: ${question}
    
    Only use information from the provided context. If the answer isn't in the context, say so.
  `;
  
  const result = await model.generateContent(prompt);
  
  return Response.json({ 
    answer: result.response.text(),
    sources: relevantDocs 
  });
}
```

### 2.5 Seed Data for Demo

```sql
-- seed.sql

-- LA Galaxy (Department feature enabled)
INSERT INTO organizations (id, name, slug, feature_config) VALUES (
  'org-la-galaxy',
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
    "customFields": {
      "tasks": []
    }
  }'
);

-- Portland Thorns (Photo verification enabled)
INSERT INTO organizations (id, name, slug, feature_config) VALUES (
  'org-portland-thorns',
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
    "customFields": {
      "tasks": []
    }
  }'
);

-- Sample users for LA Galaxy
INSERT INTO users (org_id, email, name, role, department) VALUES
  ('org-la-galaxy', 'admin@lagalaxy.com', 'Admin User', 'admin', NULL),
  ('org-la-galaxy', 'ops.head@lagalaxy.com', 'Operations Head', 'department_head', 'Operations'),
  ('org-la-galaxy', 'security.head@lagalaxy.com', 'Security Head', 'department_head', 'Security'),
  ('org-la-galaxy', 'medical.head@lagalaxy.com', 'Medical Head', 'department_head', 'Medical');

-- Sample users for Portland Thorns
INSERT INTO users (org_id, email, name, role, department) VALUES
  ('org-portland-thorns', 'admin@thorns.com', 'Admin User', 'admin', NULL),
  ('org-portland-thorns', 'staff1@thorns.com', 'Staff Member 1', 'staff', NULL),
  ('org-portland-thorns', 'staff2@thorns.com', 'Staff Member 2', 'staff', NULL);

-- Sample tasks for LA Galaxy (with departments)
INSERT INTO tasks (org_id, title, description, status, department, due_date) VALUES
  ('org-la-galaxy', 'Set up VIP parking signs', 'Place directional signs for VIP lot', 'pending', 'Parking', NOW() + INTERVAL '2 hours'),
  ('org-la-galaxy', 'Stock first aid stations', 'Ensure all stations have supplies', 'pending', 'Medical', NOW() + INTERVAL '3 hours'),
  ('org-la-galaxy', 'Sweep Section 100-110', 'Pre-game security sweep', 'in_progress', 'Security', NOW() + INTERVAL '1 hour'),
  ('org-la-galaxy', 'Test PA system', 'Sound check all speakers', 'pending', 'Operations', NOW() + INTERVAL '4 hours');

-- Sample tasks for Portland Thorns (with photo requirements)
INSERT INTO tasks (org_id, title, description, status, requires_photo, due_date) VALUES
  ('org-portland-thorns', 'North entrance security sweep', 'Complete sweep and document', 'pending', true, NOW() + INTERVAL '2 hours'),
  ('org-portland-thorns', 'Fire extinguisher check - Level 1', 'Inspect all extinguishers', 'pending', true, NOW() + INTERVAL '3 hours'),
  ('org-portland-thorns', 'Barrier inspection - Field level', 'Check all barriers are secure', 'in_progress', true, NOW() + INTERVAL '1 hour'),
  ('org-portland-thorns', 'Staff meeting prep', 'Set up meeting room', 'pending', false, NOW() + INTERVAL '4 hours');
```

---

## Part 3: Implementation Guide for Claude Code

### 3.1 Step-by-Step Instructions

Copy this entire section and paste it into Claude Code as your prompt:

---

**CLAUDE CODE PROMPT:**

```
I'm building "Touchline" - a multi-tenant game day operations platform for sports teams as a take-home assessment for Arkero.ai (an AI-native sports operations company).

## What I Need Built

A Next.js 14 app with Supabase that demonstrates:
1. Multi-tenant architecture with feature flags
2. Two customer-specific features fully working
3. Production-quality code that's easy to extend

## Tech Stack (Use These Exactly)
- Next.js 14 with App Router
- Supabase (PostgreSQL with RLS, Storage, Auth)
- Tailwind CSS + shadcn/ui components
- TypeScript with Zod validation
- Google Gemini API for embeddings (optional RAG demo)

## The Two Features to Implement

### Feature A: LA Galaxy - Department-Based Tasks
- Tasks MUST have a department field (Operations, Security, Medical, Concessions, etc.)
- Dashboard filters/groups tasks by department
- Department heads can ONLY see their department's tasks
- Admins see all

### Feature B: Portland Thorns - Photo Verification
- Some tasks require a photo before completion
- Cannot mark task "complete" without uploading photo
- Photos stored in Supabase Storage
- Audit log shows all photos for compliance

## Database Schema

Create these tables with RLS (I'll provide the SQL):

1. organizations - with feature_config JSONB
2. users - with org_id, role, department
3. tasks - with department, requires_photo, custom_data JSONB
4. task_photos - for uploaded verification photos
5. audit_log - for compliance tracking
6. embeddings - for RAG (optional but impressive)

## Key Implementation Details

### Feature Flags Pattern
```typescript
// Use this pattern throughout
<FeatureGate feature="departments">
  <DepartmentSelect required={config.features.departments.required} />
</FeatureGate>
```

### RLS Policies
- All tables filtered by org_id automatically
- Tasks additionally filtered by department for department_heads

### File Structure
```
app/
  (auth)/login/
  (dashboard)/
    page.tsx - main dashboard
    tasks/[id]/ - task detail with photo upload
    audit/ - photo audit log (Portland only)
lib/
  supabase/ - client setup
  features/ - feature registry and hooks
components/
  features/feature-gate.tsx
  tasks/department-filter.tsx
  tasks/photo-upload.tsx
```

## Build Order

1. Set up Supabase project and run migration SQL
2. Create basic Next.js app with Supabase auth
3. Build the feature flag system (FeatureGate component)
4. Implement task CRUD with department support
5. Implement photo upload and validation
6. Add audit log viewer
7. Seed demo data for both organizations
8. Test switching between orgs to show different features

## Success Criteria
- LA Galaxy user sees department filter, required department field
- Portland Thorns user sees photo upload, cannot complete without photo
- Clean, professional UI
- Type-safe code with proper validation
- Easy to add new features (show this in the architecture)

Start by setting up the project structure and database schema. Ask me if anything is unclear.
```

---

### 3.2 Environment Variables Needed

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-key  # Optional, for RAG demo
```

### 3.3 Commands to Run

```bash
# 1. Create Next.js project
npx create-next-app@latest touchline --typescript --tailwind --eslint --app

# 2. Install dependencies
cd touchline
npm install @supabase/supabase-js @supabase/ssr
npm install @tanstack/react-query
npm install zod
npm install lucide-react
npx shadcn-ui@latest init

# 3. Add shadcn components
npx shadcn-ui@latest add button card input label select table badge dialog dropdown-menu

# 4. Optional: Gemini for RAG
npm install @google/generative-ai
```

---

## Deliverables Checklist

### Part 1: Architecture Document
- [x] System architecture diagram
- [x] Data model with ERD and SQL
- [x] Tenant isolation strategy (RLS)
- [x] RAG isolation approach
- [x] Trade-offs analysis
- [x] Scaling considerations

### Part 2: Implementation
- [ ] Working Next.js application
- [ ] LA Galaxy features (departments)
- [ ] Portland Thorns features (photos)
- [ ] Demo data seeded
- [ ] README with setup instructions

### Part 3: Submission
- [ ] Share AI conversation history (as requested)
- [ ] Record short demo video (optional but recommended)
- [ ] Deploy to Vercel (optional but impressive)

---

## Timeline Recommendation

| Day | Focus | Hours |
|-----|-------|-------|
| Day 1 | Architecture doc, DB schema, project setup | 4-6 |
| Day 2 | Core features (tasks, departments) | 4-6 |
| Day 3 | Photo upload, audit log, polish | 4-6 |
| Day 4 | Testing, documentation, demo video | 2-4 |

**Total: 14-22 hours**