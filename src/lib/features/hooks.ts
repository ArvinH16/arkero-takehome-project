'use client'

import { useAuth } from '@/lib/context/auth-context'
import type { DepartmentFeatureConfig, PhotoVerificationFeatureConfig } from '@/types/database'

/**
 * Hook to check if a feature is enabled for the current organization
 */
export function useFeature(feature: 'departments' | 'photoVerification'): boolean {
  const { isFeatureEnabled } = useAuth()
  return isFeatureEnabled(feature)
}

/**
 * Hook to get department configuration for the current organization
 * Returns null if departments feature is disabled
 */
export function useDepartments(): DepartmentFeatureConfig | null {
  const { getFeatureConfig } = useAuth()
  const config = getFeatureConfig()

  if (!config) return null

  const deptConfig = config.features.departments
  if (!deptConfig.enabled) return null

  return deptConfig
}

/**
 * Hook to get photo verification configuration for the current organization
 * Returns null if photo verification feature is disabled
 */
export function usePhotoVerification(): PhotoVerificationFeatureConfig | null {
  const { getFeatureConfig } = useAuth()
  const config = getFeatureConfig()

  if (!config) return null

  const photoConfig = config.features.photoVerification
  if (!photoConfig.enabled) return null

  return photoConfig
}

/**
 * Hook to get the list of departments for the current organization
 * Returns empty array if departments feature is disabled
 */
export function useDepartmentList(): string[] {
  const deptConfig = useDepartments()
  return deptConfig?.list || []
}

/**
 * Hook to check if departments are required when creating tasks
 */
export function useDepartmentsRequired(): boolean {
  const deptConfig = useDepartments()
  return deptConfig?.required || false
}

/**
 * Hook to check if a task requires photo verification
 */
export function useTaskRequiresPhoto(taskType?: string): boolean {
  const photoConfig = usePhotoVerification()

  if (!photoConfig) return false
  if (!taskType) return false

  return photoConfig.requiredForTasks.includes(taskType)
}
