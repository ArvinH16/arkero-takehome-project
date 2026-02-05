# Requirements Gaps Fixes Implementation Plan

## Overview

This plan addresses two gaps identified in the Arkero take-home assessment requirements analysis:

1. **Server-side photo validation** - The `updateTask` action does not enforce photo requirement before allowing task completion
2. **Zod runtime validation** - The architecture mentions Zod validation for JSONB parsing but it's not implemented

Additionally includes a minor fix:
3. **Filename typo** - Rename `archtecture.md` → `architecture.md`

## Current State Analysis

### Gap 1: Photo Completion Enforcement

**Current behavior** (`src/lib/actions/tasks.ts:240-245`):
```typescript
if (input.status !== undefined) {
  updateData.status = input.status
  if (input.status === 'completed') {
    updateData.completed_at = new Date().toISOString()
  }
}
// No check for requires_photo + photos.length
```

**Problem**: A user could bypass the UI and call the API directly to complete a task without uploading the required photo. This violates Portland Thorns' compliance requirements.

**The fix exists in architecture doc** (`archtecture.md:482-509`): A `validate_task_completion` database function is defined and exists in the database types (`src/types/database.ts:320-322`) but is never called.

### Gap 2: Zod Runtime Validation

**Architecture doc mentions** (`archtecture.md:541-547`):
```typescript
// Zod schema for runtime validation
const taskCustomDataSchema = z.object({
  gameNumber: z.number().optional(),
  section: z.string().optional(),
  // ...
}).passthrough();
```

**Current state**: Zod is installed (`package.json:28`) but no schemas exist. JSONB fields are cast with `as unknown as FeatureConfig` without validation.

### Key Discoveries:
- `validate_task_completion` function exists in DB types at `src/types/database.ts:320-322`
- Zod v4.3.6 is already installed
- Feature config parsing happens in multiple places with unsafe casts
- The `getTaskWithPhotos` function already exists at `src/lib/actions/tasks.ts:133-166`

## Desired End State

1. **Server-side photo validation**: When a task with `requires_photo: true` is marked as `completed`, the server action validates that at least one photo exists in `task_photos` before allowing the update
2. **Zod validation**: Feature config JSONB is validated at runtime when loaded, providing proper error handling for malformed data
3. **Filename fixed**: Architecture document renamed correctly

### Verification:
- [ ] Attempting to complete a photo-required task via direct API call without photos returns an error
- [ ] Malformed feature_config JSONB is caught and defaults gracefully
- [ ] All existing functionality continues to work
- [ ] TypeScript types remain intact

## What We're NOT Doing

- Not adding database triggers (using application-level validation for simplicity)
- Not calling the `validate_task_completion` RPC function (simpler to do validation in the server action directly)
- Not adding Zod validation for all JSONB fields (only feature_config, which is the most critical)
- Not changing the client-side validation (it stays as a UX enhancement)

## Implementation Approach

We'll make minimal, focused changes:
1. Add photo count check to `updateTask` server action when completing photo-required tasks
2. Create Zod schema for `FeatureConfig` and use it in the auth context
3. Rename the architecture file

---

## Phase 1: Server-Side Photo Validation

### Overview
Add validation to the `updateTask` function to check for photos before allowing completion of photo-required tasks.

### Changes Required:

#### 1. Update `updateTask` function
**File**: `src/lib/actions/tasks.ts`
**Changes**: Add photo validation when status changes to 'completed'

```typescript
// After line 239 (if (input.assigned_to !== undefined)...), before the status check:

if (input.status !== undefined) {
  updateData.status = input.status

  // If completing a task, check photo requirements
  if (input.status === 'completed') {
    // First, get the current task to check if it requires a photo
    const { data: currentTask, error: taskFetchError } = await supabase
      .from('tasks')
      .select('requires_photo, org_id')
      .eq('id', id)
      .single()

    if (taskFetchError) {
      return { task: null, error: 'Failed to fetch task details' }
    }

    // If task requires photo, check that at least one exists
    if (currentTask.requires_photo) {
      // Get org's feature config to check if photoVerification is enabled
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('feature_config')
        .eq('id', currentTask.org_id)
        .single()

      if (orgError) {
        return { task: null, error: 'Failed to fetch organization settings' }
      }

      const featureConfig = org.feature_config as FeatureConfig | null
      const photoVerificationEnabled = featureConfig?.features?.photoVerification?.enabled

      if (photoVerificationEnabled) {
        // Check if photos exist for this task
        const { data: photos, error: photosError } = await supabase
          .from('task_photos')
          .select('id')
          .eq('task_id', id)
          .limit(1)

        if (photosError) {
          return { task: null, error: 'Failed to verify photo requirements' }
        }

        if (!photos || photos.length === 0) {
          return { task: null, error: 'Photo required before completing this task' }
        }
      }
    }

    updateData.completed_at = new Date().toISOString()
  }
}
```

#### 2. Add FeatureConfig import to tasks.ts
**File**: `src/lib/actions/tasks.ts`
**Changes**: Import the type at the top of the file

```typescript
import type { Task, TaskStatus, TaskPriority, FeatureConfig } from '@/types/database'
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build`
- [ ] Lint passes: `npm run lint`
- [ ] Application starts: `npm run dev`

#### Manual Verification:
- [ ] Login as Portland Thorns user
- [ ] Create a task with "Requires Photo" checked
- [ ] Try to mark the task as completed without uploading a photo
- [ ] Verify you receive the error "Photo required before completing this task"
- [ ] Upload a photo to the task
- [ ] Mark the task as completed
- [ ] Verify completion succeeds
- [ ] Login as LA Galaxy user and verify tasks can be completed without photos (since photoVerification is disabled)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Zod Runtime Validation for Feature Config

### Overview
Add Zod schemas for validating `FeatureConfig` JSONB to catch malformed data at runtime.

### Changes Required:

#### 1. Create Zod validation schemas
**File**: `src/lib/validations/feature-config.ts` (new file)
**Changes**: Create Zod schemas matching the TypeScript interfaces

```typescript
import { z } from 'zod'

// Schema for department feature configuration
export const departmentFeatureConfigSchema = z.object({
  enabled: z.boolean().default(false),
  required: z.boolean().default(false),
  list: z.array(z.string()).default([]),
})

// Schema for photo verification feature configuration
export const photoVerificationFeatureConfigSchema = z.object({
  enabled: z.boolean().default(false),
  requiredForTasks: z.array(z.string()).default([]),
})

// Schema for the complete feature config
export const featureConfigSchema = z.object({
  features: z.object({
    departments: departmentFeatureConfigSchema.default({
      enabled: false,
      required: false,
      list: [],
    }),
    photoVerification: photoVerificationFeatureConfigSchema.default({
      enabled: false,
      requiredForTasks: [],
    }),
  }).default({
    departments: { enabled: false, required: false, list: [] },
    photoVerification: { enabled: false, requiredForTasks: [] },
  }),
})

// Type inference from schema (should match FeatureConfig interface)
export type ValidatedFeatureConfig = z.infer<typeof featureConfigSchema>

// Safe parsing function with defaults
export function parseFeatureConfig(data: unknown): ValidatedFeatureConfig {
  const result = featureConfigSchema.safeParse(data)

  if (result.success) {
    return result.data
  }

  // Log the error for debugging but return safe defaults
  console.warn('Invalid feature config, using defaults:', result.error.format())

  return featureConfigSchema.parse({}) // Returns defaults
}
```

#### 2. Update auth context to use validated parsing
**File**: `src/lib/context/auth-context.tsx`
**Changes**: Use the safe parsing function instead of unsafe cast

```typescript
// Add import at top
import { parseFeatureConfig, type ValidatedFeatureConfig } from '@/lib/validations/feature-config'

// Update getFeatureConfig function (around line 101-103):
const getFeatureConfig = useCallback((): ValidatedFeatureConfig | null => {
  if (!organization?.feature_config) return null
  return parseFeatureConfig(organization.feature_config)
}, [organization])
```

#### 3. Create validations directory index
**File**: `src/lib/validations/index.ts` (new file)
**Changes**: Export validations for easy importing

```typescript
export * from './feature-config'
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build`
- [ ] Lint passes: `npm run lint`
- [ ] Application starts: `npm run dev`

#### Manual Verification:
- [ ] Login as LA Galaxy user - verify department features work correctly
- [ ] Login as Portland Thorns user - verify photo verification features work correctly
- [ ] All existing functionality continues to work as expected
- [ ] No console errors related to feature config parsing

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Filename Typo Fix

### Overview
Rename the architecture document to fix the typo.

### Changes Required:

#### 1. Rename file
**Command**:
```bash
git mv archtecture.md architecture.md
```

#### 2. Update any references
**File**: `README.md` (if it references the architecture doc)
**Changes**: Update any links to the architecture document

### Success Criteria:

#### Automated Verification:
- [ ] File exists at new location: `ls architecture.md`
- [ ] Old file no longer exists: `! ls archtecture.md`
- [ ] Git status shows rename: `git status`

#### Manual Verification:
- [ ] Verify any documentation links still work

---

## Testing Strategy

### Unit Tests (if test framework exists):
- Test `parseFeatureConfig` with valid config
- Test `parseFeatureConfig` with malformed config (should return defaults)
- Test `parseFeatureConfig` with null/undefined (should return defaults)

### Integration Tests:
- Complete a photo-required task with a photo - should succeed
- Complete a photo-required task without a photo - should fail with specific error

### Manual Testing Steps:
1. **Photo validation test**:
   - Create task with `requires_photo: true` in Portland Thorns org
   - Attempt completion without photo → Expect error
   - Upload photo → Attempt completion → Expect success

2. **Feature config validation test**:
   - Temporarily corrupt a feature_config in DB
   - Reload app → Should use defaults instead of crashing
   - Restore config → Features should work normally

## Performance Considerations

- The photo validation adds 2 additional database queries when completing a task:
  1. Fetch current task's `requires_photo` and `org_id`
  2. Fetch org's `feature_config`
  3. Count photos for the task (if needed)

  This is acceptable since task completion is not a high-frequency operation.

- Zod validation is very fast and adds negligible overhead to page loads.

## Migration Notes

No database migrations required. All changes are in application code.

## References

- Architecture document: `architecture.md` (after rename)
- Original gap analysis: This conversation
- Database function (not used but documented): `validate_task_completion` at `archtecture.md:482-509`
- Current task actions: `src/lib/actions/tasks.ts`
- Auth context: `src/lib/context/auth-context.tsx`
