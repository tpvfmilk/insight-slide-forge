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
      api_keys: {
        Row: {
          created_at: string
          id: string
          is_valid: boolean | null
          key_hash: string
          last_verified: string | null
          service: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_valid?: boolean | null
          key_hash: string
          last_verified?: string | null
          service: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_valid?: boolean | null
          key_hash?: string
          last_verified?: string | null
          service?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      folders: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      openai_usage: {
        Row: {
          created_at: string
          estimated_cost: number
          id: string
          input_tokens: number
          model_id: string
          output_tokens: number
          project_id: string
          total_tokens: number
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_cost?: number
          id?: string
          input_tokens?: number
          model_id: string
          output_tokens?: number
          project_id: string
          total_tokens?: number
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_cost?: number
          id?: string
          input_tokens?: number
          model_id?: string
          output_tokens?: number
          project_id?: string
          total_tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "openai_usage_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          context_prompt: string | null
          created_at: string
          description: string | null
          expires_at: string
          extracted_frames: Json | null
          folder_id: string | null
          id: string
          model_id: string | null
          slides: Json | null
          slides_per_minute: number | null
          source_file_path: string | null
          source_type: string
          source_url: string | null
          target_slide_count: number | null
          title: string
          transcript: string | null
          updated_at: string
          user_id: string
          video_metadata: Json | null
        }
        Insert: {
          context_prompt?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string
          extracted_frames?: Json | null
          folder_id?: string | null
          id?: string
          model_id?: string | null
          slides?: Json | null
          slides_per_minute?: number | null
          source_file_path?: string | null
          source_type: string
          source_url?: string | null
          target_slide_count?: number | null
          title: string
          transcript?: string | null
          updated_at?: string
          user_id: string
          video_metadata?: Json | null
        }
        Update: {
          context_prompt?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string
          extracted_frames?: Json | null
          folder_id?: string | null
          id?: string
          model_id?: string | null
          slides?: Json | null
          slides_per_minute?: number | null
          source_file_path?: string | null
          source_type?: string
          source_url?: string | null
          target_slide_count?: number | null
          title?: string
          transcript?: string | null
          updated_at?: string
          user_id?: string
          video_metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_tiers: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          price: number
          storage_limit: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          price: number
          storage_limit: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          price?: number
          storage_limit?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_storage: {
        Row: {
          created_at: string
          id: string
          storage_used: number
          tier_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          storage_used?: number
          tier_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          storage_used?: number
          tier_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_storage_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "storage_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_project_storage_size: {
        Args: { project_id: string }
        Returns: number
      }
      get_current_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_daily_token_usage: {
        Args: { days_to_fetch?: number }
        Returns: {
          usage_date: string
          total_tokens: number
          estimated_cost: number
        }[]
      }
      get_user_storage_info: {
        Args: Record<PropertyKey, never>
        Returns: {
          storage_used: number
          storage_limit: number
          tier_name: string
          percentage_used: number
          tier_price: number
        }[]
      }
      get_user_token_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_tokens: number
          api_requests: number
          estimated_cost: number
          last_used: string
        }[]
      }
      get_user_total_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_tokens: number
          api_requests: number
          estimated_cost: number
          last_used: string
          storage_used: number
          storage_limit: number
          storage_percentage: number
          tier_name: string
        }[]
      }
      reset_user_token_stats: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_storage_usage: {
        Args: { file_size_change: number }
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
