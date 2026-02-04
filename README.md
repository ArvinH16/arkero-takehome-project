# Touchline

A multi-tenant game day operations platform for professional sports teams, built as a take-home assessment for [Arkero.ai](https://arkero.ai).

## Overview

Touchline demonstrates enterprise-grade multi-tenancy, feature flags, and RAG-ready architecture. The platform enables sports organizations to manage game day operations with customizable features per tenant.

### Demo Organizations

| Organization | Key Feature |
|-------------|-------------|
| **LA Galaxy** | Department-based task management with filtering and grouping |
| **Portland Thorns** | Photo verification requirements with audit logging |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth with RLS |
| Styling | Tailwind CSS + shadcn/ui |
| State | React Query (TanStack) |
| Validation | Zod |
| AI/RAG | Google Gemini API (text-embedding-004, pgvector) |
| Storage | Supabase Storage |

## Features

### Core Multi-Tenancy
- Complete data isolation via Row-Level Security (RLS)
- Single codebase serves multiple organizations with different feature sets
- Organization context via application context and JWT claims

### Feature A: Department-Based Tasks (LA Galaxy)
- Tasks tagged with departments (Operations, Security, Medical, etc.)
- Department field required for this organization
- Dashboard filters and groups by department
- Department heads see only their tasks (RLS-enforced)

### Feature B: Photo Verification (Portland Thorns)
- Tasks can require photo verification before completion
- Photo upload with file validation and metadata extraction
- Photos stored in Supabase Storage with tenant isolation
- Complete audit trail for compliance

### RAG System
- Tenant-isolated semantic search using pgvector
- Embeddings generated via Google Gemini API
- Vector search enforced by RLS policies
- AI Assistant for natural language task queries

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account
- Google Gemini API key (for RAG feature)

### Installation

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd arkero-takehome-assignment
   npm install
   ```

2. **Set up Supabase**
   - Create a new project at [supabase.com](https://supabase.com/dashboard)
   - Enable the Vector extension for pgvector

3. **Configure environment variables**

   Create `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   GEMINI_API_KEY=your-gemini-api-key
   ```

4. **Run database migrations**

   Execute SQL from `supabase/migrations/001_initial_schema.sql` in Supabase SQL Editor.

5. **Seed initial data**
   ```bash
   # Run supabase/seed.sql in Supabase SQL Editor
   ```

6. **Create storage bucket**
   - In Supabase Storage, create bucket named `task-photos`

7. **Generate RAG embeddings** (optional)
   ```bash
   npx tsx scripts/seed-embeddings.ts
   ```

8. **Start development server**
   ```bash
   npm run dev
   ```

9. **Open the application**

   Visit [http://localhost:3000](http://localhost:3000)

## Project Structure

```
touchline/
├── app/
│   ├── (auth)/              # Authentication pages
│   ├── (dashboard)/         # Main application pages
│   │   ├── tasks/           # Task list, detail, creation
│   │   └── audit/           # Audit log viewer
│   └── api/                 # API routes
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── tasks/               # Task-related components
│   ├── features/            # Feature flag components
│   └── layout/              # Layout components
├── lib/
│   ├── supabase/            # Supabase client setup
│   ├── features/            # Feature flag logic
│   ├── rag/                 # RAG/embedding utilities
│   └── validations/         # Zod schemas
├── types/                   # TypeScript type definitions
├── supabase/
│   ├── migrations/          # Database migrations
│   └── seed.sql             # Demo data
└── scripts/                 # Utility scripts
```

## Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm start         # Start production server
npm run lint      # Run ESLint
```

## Demo Instructions

### Testing LA Galaxy (Department Feature)
1. Select "LA Galaxy" from org switcher
2. Create a task - department field is required
3. Use department filter to group tasks
4. Verify department head sees only their department's tasks

### Testing Portland Thorns (Photo Verification)
1. Switch to "Portland Thorns"
2. Find tasks with "Photo required" badge
3. Try completing without photo - should be blocked
4. Upload a photo, then complete the task
5. View audit log to see activity

### Testing Tenant Isolation
1. Create a task in LA Galaxy
2. Switch to Portland Thorns
3. Verify task is not visible (RLS working)

## Architecture

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Single codebase with feature flags** | Scales to 100+ customers without forks |
| **JSONB for extensibility** | No schema migrations per feature |
| **RLS at database level** | Security enforced by default |
| **pgvector for RAG** | Same database, automatic RLS applies |

### Database Schema

- **organizations** - Tenant records with feature_config JSONB
- **users** - Users with org_id, role, optional department
- **tasks** - Work items with tenant isolation
- **task_photos** - Photo verification records
- **audit_log** - Compliance tracking
- **embeddings** - RAG vectors with tenant isolation

## Documentation

| File | Description |
|------|-------------|
| `archtecture.md` | Complete PRD with diagrams and trade-offs |
| `thoughts/plans/` | Phase-by-phase implementation guide |
| `Arkero Take Home Assignment.pdf` | Original assignment brief |

## License

This project is a take-home assessment and not intended for production use.
