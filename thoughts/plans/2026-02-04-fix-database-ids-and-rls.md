# Fix Database IDs, RLS Policies & Task Assignments

## Overview

Prepare the Touchline database for demo by:
1. Fixing inconsistent seed data UUIDs
2. Adding missing RLS policies with role-appropriate permissions
3. Assigning tasks to users so the demo is immediately functional

This is a database-only migration with no code changes required.

## Context: Arkero's Business Model

Arkero is an AI-native platform for sports game day operations. Key aspects relevant to this fix:
- **Accountability model**: Department heads are accountable for their tasks
- **Compliance**: Portland Thorns needs photo verification for league/insurance compliance
- **Multi-tenant**: Each team has isolated data with different feature configurations

## Current State Analysis

### ID Inconsistencies

| Entity | Current ID Pattern | Issue |
|--------|-------------------|-------|
| Organizations | `11111111-...`, `22222222-...` | Acceptable for demo (easy to identify) |
| LA Galaxy Users | `aaaaaaaa-...-aaaaaaaaaaaa` through `...-aaaaaaaaaaad` | Consistent |
| Portland Thorns Users | `bbbbbbbb-...-bbbbbbbbbbba`, `...-bbbbbbbbbbb2`, `...-bbbbbbbbbbb3` | **Mixed letters/numbers** |

The Portland Thorns user IDs inconsistently mix hex letters (`bbba`) with decimal numbers (`bbb2`, `bbb3`).

**Decision**: Keep predictable IDs for demo purposes (easy debugging during presentation). The pattern will be consistent: `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01/02/03`.

### Missing RLS Policies

| Table | Missing Policy | Impact |
|-------|---------------|--------|
| `tasks` | DELETE | Cannot delete tasks |
| `tasks` | UPDATE WITH CHECK | Could theoretically update org_id to escape tenant |
| `task_photos` | DELETE | Cannot delete photos |
| `tasks` | Staff UPDATE restriction | Staff can't complete tasks assigned to them |

### Key Discovery

**No hardcoded IDs exist in the source code** (`src/` directory). All IDs are retrieved dynamically:
- `auth.getUser()` → `users.auth_id` → `users.org_id`
- RLS functions (`current_org_id()`, etc.) derive values from `auth.uid()`

Therefore, changing seed data IDs will not break any application functionality.

## Desired End State

1. **Consistent User IDs**: All user IDs use consistent hex-only patterns (`bb01`, `bb02`, `bb03`)
2. **Complete RLS Policies**: All tables have SELECT, INSERT, UPDATE, DELETE policies as appropriate
3. **Role-appropriate task updates**:
   - **Staff**: Can update tasks assigned to them (complete their own work)
   - **Department heads**: Can update tasks in their department (LA Galaxy accountability model)
   - **Admin/Manager**: Can update any task
4. **Admin-only delete**: Only admin can delete tasks (protects compliance audit trail)
5. **Protected updates**: UPDATE policies include WITH CHECK to prevent org_id mutation
6. **All tasks assigned**: Every task has an `assigned_to` user for demo functionality
   - LA Galaxy: Dept heads get their department's tasks
   - Portland Thorns: Staff get photo-required compliance tasks

### Verification Criteria

After migration:
- `SELECT * FROM users WHERE id LIKE '%bbb2%'` returns 0 rows (old IDs gone)
- Staff user can update task status for tasks assigned to them
- Staff user CANNOT update tasks not assigned to them
- Only admin can delete tasks
- All 6 tables have appropriate RLS policies
- `npm run dev` still works
- Existing signed-up users can still log in

## What We're NOT Doing

- Changing organization IDs (they're fine and easy to identify)
- Changing LA Galaxy user IDs (they're consistent)
- Using random UUIDs (predictable IDs help with demo debugging)
- Modifying any application code
- Adding new features

---

## Phase 1: Fix User IDs, RLS Policies & Task Assignments

### Overview

Single migration to:
1. Fix Portland Thorns user ID inconsistencies
2. Add missing DELETE policies (admin-only)
3. Add WITH CHECK to UPDATE policies
4. Role-appropriate update permissions (staff updates assigned tasks only)
5. Assign all tasks to appropriate users for demo

### Migration: `fix_ids_rls_and_assignments`

```sql
-- =====================================================
-- PART 1: Fix Portland Thorns User IDs
-- =====================================================

-- Step 1: Update embeddings that reference old user-created tasks
-- (The embeddings table has content_id which may reference tasks)
-- Embeddings don't directly reference user IDs, so no change needed there

-- Step 2: Update tasks created_by and assigned_to for affected users
-- Before changing user IDs, update tasks that reference them

-- Update tasks referencing staff1@thorns.com (old: bbbbbbbbbbb2, new: bbbbbbbbbb02)
UPDATE tasks
SET created_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02'
WHERE created_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';

UPDATE tasks
SET assigned_to = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02'
WHERE assigned_to = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';

-- Update tasks referencing staff2@thorns.com (old: bbbbbbbbbbb3, new: bbbbbbbbbb03)
UPDATE tasks
SET created_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03'
WHERE created_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3';

UPDATE tasks
SET assigned_to = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03'
WHERE assigned_to = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3';

-- Update admin user ID too for consistency (old: bbbbbbbbbbba, new: bbbbbbbbbb01)
UPDATE tasks
SET created_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01'
WHERE created_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbba';

UPDATE tasks
SET assigned_to = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01'
WHERE assigned_to = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbba';

-- Step 3: Update audit_log references (if any exist)
UPDATE audit_log
SET user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01'
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbba';

UPDATE audit_log
SET user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02'
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';

UPDATE audit_log
SET user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03'
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3';

-- Step 4: Update task_photos references (if any exist)
UPDATE task_photos
SET uploaded_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01'
WHERE uploaded_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbba';

UPDATE task_photos
SET uploaded_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02'
WHERE uploaded_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';

UPDATE task_photos
SET uploaded_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03'
WHERE uploaded_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3';

-- Step 5: Now update the user IDs themselves
UPDATE users
SET id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01'
WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbba';

UPDATE users
SET id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02'
WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';

UPDATE users
SET id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03'
WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3';

-- =====================================================
-- PART 2: Fix RLS Policies
-- =====================================================

-- 2a: Add DELETE policy for tasks (admin only - protects compliance audit trail)
CREATE POLICY "task_delete" ON tasks FOR DELETE USING (
  org_id = current_org_id()
  AND current_user_role() = 'admin'
);

-- 2b: Add DELETE policy for task_photos (admin only)
CREATE POLICY "photo_delete" ON task_photos FOR DELETE USING (
  org_id = current_org_id()
  AND current_user_role() = 'admin'
);

-- 2c: Drop and recreate task_update with role-appropriate restrictions
-- - Admin/Manager: Can update any task in their org
-- - Department Head: Can update tasks in their department (LA Galaxy accountability)
-- - Staff: Can update tasks assigned to them (complete their own work)
DROP POLICY IF EXISTS "task_update" ON tasks;

CREATE POLICY "task_update" ON tasks FOR UPDATE
USING (
  org_id = current_org_id()
  AND (
    current_user_role() IN ('admin', 'manager')
    OR (current_user_role() = 'department_head' AND department = current_user_department())
    OR (current_user_role() = 'staff' AND assigned_to = current_user_id())
  )
)
WITH CHECK (
  org_id = current_org_id()  -- Prevent changing org_id to escape tenant
);

-- 2d: Add missing index for RLS performance on task_photos
CREATE INDEX IF NOT EXISTS idx_task_photos_org_id ON task_photos(org_id);

-- =====================================================
-- PART 3: Assign Tasks for Demo Functionality
-- =====================================================

-- LA Galaxy: Assign tasks to department heads (matches their department)
-- ops@lagalaxy.com (Mike Rodriguez) - Operations dept head
UPDATE tasks SET assigned_to = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab'
WHERE org_id = '11111111-1111-1111-1111-111111111111' AND department = 'Operations';

-- security@lagalaxy.com (James Wilson) - Security dept head
UPDATE tasks SET assigned_to = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac'
WHERE org_id = '11111111-1111-1111-1111-111111111111' AND department = 'Security';

-- medical@lagalaxy.com (Dr. Emily Park) - Medical dept head
UPDATE tasks SET assigned_to = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaad'
WHERE org_id = '11111111-1111-1111-1111-111111111111' AND department = 'Medical';

-- admin@lagalaxy.com (Sarah Chen) - gets remaining departments (no dept head seeded)
UPDATE tasks SET assigned_to = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
WHERE org_id = '11111111-1111-1111-1111-111111111111'
AND department IN ('Concessions', 'Guest Services', 'Parking')
AND assigned_to IS NULL;

-- Portland Thorns: Assign photo-required tasks to staff for compliance demo
-- staff1@thorns.com (Jordan Lee) - gets security/safety tasks
UPDATE tasks SET assigned_to = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02'
WHERE org_id = '22222222-2222-2222-2222-222222222222'
AND title IN ('North entrance security sweep', 'Fire extinguisher check - Level 1');

-- staff2@thorns.com (Casey Morgan) - gets inspection tasks
UPDATE tasks SET assigned_to = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03'
WHERE org_id = '22222222-2222-2222-2222-222222222222'
AND title IN ('Barrier inspection - Field level', 'Equipment inventory');

-- admin@thorns.com (Alex Thompson) - gets non-photo task
UPDATE tasks SET assigned_to = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01'
WHERE org_id = '22222222-2222-2222-2222-222222222222'
AND title = 'Staff meeting prep';
```

### Success Criteria

#### Automated Verification (via Supabase MCP):

```sql
-- Verify user IDs are fixed
SELECT id, email FROM users WHERE org_id = '22222222-2222-2222-2222-222222222222' ORDER BY email;
-- Expected:
-- bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01 | admin@thorns.com
-- bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02 | staff1@thorns.com
-- bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03 | staff2@thorns.com

-- Verify old IDs don't exist
SELECT COUNT(*) FROM users WHERE id IN (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbba',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'
);
-- Expected: 0

-- Verify RLS policies exist
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public'
AND policyname IN ('task_delete', 'photo_delete')
ORDER BY tablename;
-- Expected: 2 rows (task_delete, photo_delete)

-- Verify task_update policy has role-appropriate restrictions
SELECT qual FROM pg_policies
WHERE tablename = 'tasks' AND policyname = 'task_update';
-- Expected: contains 'staff' AND 'assigned_to = current_user_id()'

-- Verify delete is admin-only
SELECT qual FROM pg_policies
WHERE tablename = 'tasks' AND policyname = 'task_delete';
-- Expected: contains "current_user_role() = 'admin'"

-- Verify index exists
SELECT indexname FROM pg_indexes
WHERE tablename = 'task_photos' AND indexname = 'idx_task_photos_org_id';
-- Expected: 1 row

-- Verify all tasks are now assigned
SELECT COUNT(*) FROM tasks WHERE assigned_to IS NULL;
-- Expected: 0

-- Verify Portland Thorns staff have photo-required tasks assigned
SELECT t.title, t.requires_photo, u.email, u.role
FROM tasks t
JOIN users u ON t.assigned_to = u.id
WHERE t.org_id = '22222222-2222-2222-2222-222222222222'
ORDER BY u.email;
-- Expected: 5 rows with staff1/staff2 having requires_photo=true tasks
```

#### Manual Verification:

- [ ] `npm run dev` starts without errors
- [ ] Existing signed-up users (if any have auth_id set) can still log in

**LA Galaxy Demo Flow:**
- [ ] Sign up as ops@lagalaxy.com (Mike Rodriguez, Operations dept head)
- [ ] See "Test PA system" task assigned to you
- [ ] Can update the task status to "in_progress" or "completed"
- [ ] Sign up as admin@lagalaxy.com, verify can see/update all tasks

**Portland Thorns Demo Flow:**
- [ ] Sign up as staff1@thorns.com (Jordan Lee, staff)
- [ ] See 2 tasks assigned: "North entrance security sweep", "Fire extinguisher check - Level 1"
- [ ] Both tasks show "Photo required" badge
- [ ] Can update task status for assigned tasks
- [ ] CANNOT update "Staff meeting prep" (assigned to admin, not this user)
- [ ] Sign up as admin@thorns.com, verify can update/delete any task

---

## Summary

| Change | Purpose |
|--------|---------|
| Fix Portland Thorns user IDs | Consistent `bbbbbbbbbb01/02/03` pattern |
| Add `task_delete` policy | Admin-only deletion (protects compliance audit trail) |
| Add `photo_delete` policy | Admin-only photo deletion |
| Update `task_update` policy | Role-appropriate: staff updates assigned tasks, dept heads update dept tasks, admin updates all |
| Add `idx_task_photos_org_id` | Performance optimization for RLS |
| Assign LA Galaxy tasks | Dept heads get their department's tasks, admin gets remaining |
| Assign Portland Thorns tasks | Staff get photo-required compliance tasks, admin gets meeting prep |

### Permission Matrix After Migration

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| Admin | All org tasks | Yes | All org tasks | Yes |
| Manager | All org tasks | Yes | All org tasks | No |
| Dept Head | Dept tasks + unassigned | Yes | Dept tasks | No |
| Staff | All org tasks | Yes | Assigned to them only | No |

**Risk Level**: Low - database-only changes, no code modifications needed.

**Rollback**: Re-run seed data with original IDs, drop new policies.
