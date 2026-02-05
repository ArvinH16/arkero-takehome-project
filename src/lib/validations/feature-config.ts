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
