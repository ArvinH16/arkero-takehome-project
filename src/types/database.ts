// Auto-generated types from Supabase

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          org_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          org_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      embeddings: {
        Row: {
          content_id: string
          content_text: string
          content_type: string
          created_at: string | null
          embedding: string
          id: string
          org_id: string
        }
        Insert: {
          content_id: string
          content_text: string
          content_type: string
          created_at?: string | null
          embedding: string
          id?: string
          org_id: string
        }
        Update: {
          content_id?: string
          content_text?: string
          content_type?: string
          created_at?: string | null
          embedding?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "embeddings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          feature_config: Json
          id: string
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          feature_config?: Json
          id?: string
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          feature_config?: Json
          id?: string
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      task_photos: {
        Row: {
          id: string
          metadata: Json | null
          org_id: string
          photo_url: string
          task_id: string
          uploaded_at: string | null
          uploaded_by: string
        }
        Insert: {
          id?: string
          metadata?: Json | null
          org_id: string
          photo_url: string
          task_id: string
          uploaded_at?: string | null
          uploaded_by: string
        }
        Update: {
          id?: string
          metadata?: Json | null
          org_id?: string
          photo_url?: string
          task_id?: string
          uploaded_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_photos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_photos_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          custom_data: Json | null
          department: string | null
          description: string | null
          due_date: string | null
          id: string
          org_id: string
          priority: string
          requires_photo: boolean | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_data?: Json | null
          department?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          org_id: string
          priority?: string
          requires_photo?: boolean | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_data?: Json | null
          department?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          org_id?: string
          priority?: string
          requires_photo?: boolean | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_id: string | null
          created_at: string | null
          department: string | null
          email: string
          id: string
          name: string
          org_id: string
          role: string
        }
        Insert: {
          auth_id?: string | null
          created_at?: string | null
          department?: string | null
          email: string
          id?: string
          name: string
          org_id: string
          role: string
        }
        Update: {
          auth_id?: string | null
          created_at?: string | null
          department?: string | null
          email?: string
          id?: string
          name?: string
          org_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_org_id: { Args: Record<string, never>; Returns: string }
      current_user_department: { Args: Record<string, never>; Returns: string }
      current_user_id: { Args: Record<string, never>; Returns: string }
      current_user_role: { Args: Record<string, never>; Returns: string }
      match_documents: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
          query_org_id: string
        }
        Returns: {
          content_id: string
          content_text: string
          content_type: string
          id: string
          similarity: number
        }[]
      }
      validate_task_completion: {
        Args: { p_task_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper type aliases for convenience
export type Organization = Database['public']['Tables']['organizations']['Row']
export type User = Database['public']['Tables']['users']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type TaskPhoto = Database['public']['Tables']['task_photos']['Row']
export type AuditLogEntry = Database['public']['Tables']['audit_log']['Row']
export type Embedding = Database['public']['Tables']['embeddings']['Row']

// Feature configuration types (for parsing feature_config JSONB)
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

// Typed organization with parsed feature config
export interface OrganizationWithConfig extends Omit<Organization, 'feature_config'> {
  feature_config: FeatureConfig
}

// Status and priority types
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type UserRole = 'admin' | 'manager' | 'department_head' | 'staff'

// Helper types for UI
export interface TaskWithRelations extends Task {
  photos?: TaskPhoto[]
  assigned_user?: User
  created_by_user?: User
}

export interface UserWithOrg extends User {
  organization?: Organization
}
