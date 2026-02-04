// Feature configuration types
export interface DepartmentFeatureConfig {
  enabled: boolean
  required: boolean
  list: string[]
}

export interface PhotoVerificationFeatureConfig {
  enabled: boolean
  requiredForTasks: string[]
}

export interface FeatureConfig {
  features: {
    departments: DepartmentFeatureConfig
    photoVerification: PhotoVerificationFeatureConfig
  }
}

// Database table types
export interface Organization {
  id: string
  name: string
  slug: string
  feature_config: FeatureConfig
  created_at: string
  updated_at: string
}

export type UserRole = 'admin' | 'manager' | 'department_head' | 'staff'

export interface User {
  id: string
  org_id: string
  email: string
  name: string
  role: UserRole
  department: string | null
  created_at: string
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Task {
  id: string
  org_id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
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

export interface AuditLogEntry {
  id: string
  org_id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface Embedding {
  id: string
  org_id: string
  content_type: string
  content_id: string
  content_text: string
  embedding: number[]
  created_at: string
}

// Supabase Database type for client
export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Organization
        Insert: Omit<Organization, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Organization, 'id'>>
      }
      users: {
        Row: User
        Insert: Omit<User, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<User, 'id'>>
      }
      tasks: {
        Row: Task
        Insert: Omit<Task, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Task, 'id'>>
      }
      task_photos: {
        Row: TaskPhoto
        Insert: Omit<TaskPhoto, 'id' | 'uploaded_at'> & {
          id?: string
          uploaded_at?: string
        }
        Update: Partial<Omit<TaskPhoto, 'id'>>
      }
      audit_log: {
        Row: AuditLogEntry
        Insert: Omit<AuditLogEntry, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<AuditLogEntry, 'id'>>
      }
      embeddings: {
        Row: Embedding
        Insert: Omit<Embedding, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<Embedding, 'id'>>
      }
    }
    Functions: {
      match_documents: {
        Args: {
          query_embedding: number[]
          query_org_id: string
          match_threshold?: number
          match_count?: number
        }
        Returns: {
          id: string
          content_type: string
          content_id: string
          content_text: string
          similarity: number
        }[]
      }
      validate_task_completion: {
        Args: {
          p_task_id: string
        }
        Returns: boolean
      }
    }
  }
}

// Helper types for UI
export interface TaskWithRelations extends Task {
  photos?: TaskPhoto[]
  assigned_user?: User
  created_by_user?: User
}

export interface UserWithOrg extends User {
  organization?: Organization
}
