'use client'

import { ReactNode } from 'react'
import { useFeature } from '@/lib/features/hooks'

interface FeatureGateProps {
  /** The feature to check */
  feature: 'departments' | 'photoVerification'
  /** Content to render when feature is enabled */
  children: ReactNode
  /** Optional content to render when feature is disabled */
  fallback?: ReactNode
}

/**
 * Conditionally renders children based on whether a feature is enabled
 * for the current organization.
 *
 * @example
 * <FeatureGate feature="departments">
 *   <DepartmentFilter />
 * </FeatureGate>
 *
 * @example
 * <FeatureGate
 *   feature="photoVerification"
 *   fallback={<span>Feature not available</span>}
 * >
 *   <PhotoUpload />
 * </FeatureGate>
 */
export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  const isEnabled = useFeature(feature)

  if (!isEnabled) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Inverse of FeatureGate - renders children when feature is DISABLED
 */
export function FeatureGateDisabled({ feature, children, fallback = null }: FeatureGateProps) {
  const isEnabled = useFeature(feature)

  if (isEnabled) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
