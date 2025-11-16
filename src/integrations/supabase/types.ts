export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_bpmn_diagrams: {
        Row: {
          bpmn_xml: string
          complexity_score: number | null
          event_count: number
          generated_at: string
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          bpmn_xml: string
          complexity_score?: number | null
          event_count: number
          generated_at?: string
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          bpmn_xml?: string
          complexity_score?: number | null
          event_count?: number
          generated_at?: string
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_bpmn_diagrams_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "activity_tracking_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_events: {
        Row: {
          element_class: string | null
          element_id: string | null
          element_text: string | null
          element_type: string | null
          event_type: string
          id: string
          metadata: Json | null
          sequence_number: number
          session_id: string
          timestamp: string
          url: string | null
        }
        Insert: {
          element_class?: string | null
          element_id?: string | null
          element_text?: string | null
          element_type?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          sequence_number: number
          session_id: string
          timestamp?: string
          url?: string | null
        }
        Update: {
          element_class?: string | null
          element_id?: string | null
          element_text?: string | null
          element_type?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          sequence_number?: number
          session_id?: string
          timestamp?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "activity_tracking_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_tracking_sessions: {
        Row: {
          created_at: string
          description: string | null
          ended_at: string | null
          id: string
          session_name: string
          started_at: string
          status: string
          total_events: number
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          id?: string
          session_name: string
          started_at?: string
          status?: string
          total_events?: number
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          id?: string
          session_name?: string
          started_at?: string
          status?: string
          total_events?: number
          user_id?: string
        }
        Relationships: []
      }
      bpmn_diagram_permissions: {
        Row: {
          diagram_id: string
          granted_at: string
          granted_by: string
          id: string
          role: Database["public"]["Enums"]["bpmn_role"]
          user_id: string
        }
        Insert: {
          diagram_id: string
          granted_at?: string
          granted_by: string
          id?: string
          role?: Database["public"]["Enums"]["bpmn_role"]
          user_id: string
        }
        Update: {
          diagram_id?: string
          granted_at?: string
          granted_by?: string
          id?: string
          role?: Database["public"]["Enums"]["bpmn_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bpmn_diagram_permissions_diagram_id_fkey"
            columns: ["diagram_id"]
            isOneToOne: false
            referencedRelation: "bpmn_diagrams"
            referencedColumns: ["id"]
          },
        ]
      }
      bpmn_diagrams: {
        Row: {
          bpmn_xml: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          updated_at: string
          version: number
        }
        Insert: {
          bpmn_xml: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          updated_at?: string
          version?: number
        }
        Update: {
          bpmn_xml?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      bpmn_generations: {
        Row: {
          alternative_models: Json | null
          created_at: string | null
          generated_bpmn_xml: string
          id: string
          image_analysis: string | null
          input_description: string | null
          input_type: string
          rating: number | null
          updated_at: string | null
          user_feedback: string | null
          user_id: string
          was_helpful: boolean | null
        }
        Insert: {
          alternative_models?: Json | null
          created_at?: string | null
          generated_bpmn_xml: string
          id?: string
          image_analysis?: string | null
          input_description?: string | null
          input_type: string
          rating?: number | null
          updated_at?: string | null
          user_feedback?: string | null
          user_id: string
          was_helpful?: boolean | null
        }
        Update: {
          alternative_models?: Json | null
          created_at?: string | null
          generated_bpmn_xml?: string
          id?: string
          image_analysis?: string | null
          input_description?: string | null
          input_type?: string
          rating?: number | null
          updated_at?: string | null
          user_feedback?: string | null
          user_id?: string
          was_helpful?: boolean | null
        }
        Relationships: []
      }
      bpmn_prompt_cache: {
        Row: {
          bpmn_xml: string
          created_at: string | null
          diagram_type: string
          hit_count: number | null
          id: string
          last_accessed_at: string | null
          prompt_embedding: string | null
          prompt_hash: string
          prompt_text: string
        }
        Insert: {
          bpmn_xml: string
          created_at?: string | null
          diagram_type: string
          hit_count?: number | null
          id?: string
          last_accessed_at?: string | null
          prompt_embedding?: string | null
          prompt_hash: string
          prompt_text: string
        }
        Update: {
          bpmn_xml?: string
          created_at?: string | null
          diagram_type?: string
          hit_count?: number | null
          id?: string
          last_accessed_at?: string | null
          prompt_embedding?: string | null
          prompt_hash?: string
          prompt_text?: string
        }
        Relationships: []
      }
      performance_metrics: {
        Row: {
          cache_hit: boolean | null
          cache_type: string | null
          complexity_score: number | null
          created_at: string | null
          error_message: string | null
          error_occurred: boolean | null
          function_name: string
          id: string
          model_used: string | null
          prompt_length: number | null
          response_time_ms: number | null
          similarity_score: number | null
          token_usage: number | null
        }
        Insert: {
          cache_hit?: boolean | null
          cache_type?: string | null
          complexity_score?: number | null
          created_at?: string | null
          error_message?: string | null
          error_occurred?: boolean | null
          function_name: string
          id?: string
          model_used?: string | null
          prompt_length?: number | null
          response_time_ms?: number | null
          similarity_score?: number | null
          token_usage?: number | null
        }
        Update: {
          cache_hit?: boolean | null
          cache_type?: string | null
          complexity_score?: number | null
          created_at?: string | null
          error_message?: string | null
          error_occurred?: boolean | null
          function_name?: string
          id?: string
          model_used?: string | null
          prompt_length?: number | null
          response_time_ms?: number | null
          similarity_score?: number | null
          token_usage?: number | null
        }
        Relationships: []
      }
      screen_recording_jobs: {
        Row: {
          bpmn_xml: string | null
          completed_at: string | null
          complexity_score: number | null
          created_at: string
          error_message: string | null
          extracted_frames: Json | null
          id: string
          model_used: string | null
          recording_metadata: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bpmn_xml?: string | null
          completed_at?: string | null
          complexity_score?: number | null
          created_at?: string
          error_message?: string | null
          extracted_frames?: Json | null
          id?: string
          model_used?: string | null
          recording_metadata?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bpmn_xml?: string | null
          completed_at?: string | null
          complexity_score?: number | null
          created_at?: string
          error_message?: string | null
          extracted_frames?: Json | null
          id?: string
          model_used?: string | null
          recording_metadata?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          last_login: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          last_login?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          last_login?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vision_analysis_cache: {
        Row: {
          bpmn_xml: string | null
          created_at: string | null
          diagram_type: string
          hit_count: number | null
          id: string
          image_embedding: string | null
          image_hash: string
          last_accessed_at: string | null
          process_description: string
        }
        Insert: {
          bpmn_xml?: string | null
          created_at?: string | null
          diagram_type: string
          hit_count?: number | null
          id?: string
          image_embedding?: string | null
          image_hash: string
          last_accessed_at?: string | null
          process_description: string
        }
        Update: {
          bpmn_xml?: string | null
          created_at?: string | null
          diagram_type?: string
          hit_count?: number | null
          id?: string
          image_embedding?: string | null
          image_hash?: string
          last_accessed_at?: string | null
          process_description?: string
        }
        Relationships: []
      }
      vision_bpmn_jobs: {
        Row: {
          bpmn_xml: string | null
          completed_at: string | null
          complexity_score: number | null
          created_at: string
          error_message: string | null
          id: string
          image_data: string
          model_used: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bpmn_xml?: string | null
          completed_at?: string | null
          complexity_score?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          image_data: string
          model_used?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bpmn_xml?: string | null
          completed_at?: string | null
          complexity_score?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          image_data?: string
          model_used?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clean_old_cache_entries: {
        Args: { days_old?: number; min_hit_count?: number }
        Returns: {
          deleted_prompt_cache_count: number
          deleted_vision_cache_count: number
        }[]
      }
      get_cache_hit_rate_stats: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          avg_response_time_ms: number
          cache_misses: number
          exact_hash_hits: number
          exact_hit_rate: number
          function_name: string
          semantic_hit_rate: number
          semantic_hits: number
          total_hit_rate: number
          total_requests: number
        }[]
      }
      get_cache_statistics: {
        Args: never
        Returns: {
          avg_prompt_cache_hits: number
          avg_vision_cache_hits: number
          total_prompt_cache_entries: number
          total_prompt_cache_hits: number
          total_vision_cache_entries: number
          total_vision_cache_hits: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      match_similar_images: {
        Args: {
          diagram_type_filter?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          bpmn_xml: string
          diagram_type: string
          hit_count: number
          id: string
          image_hash: string
          process_description: string
          similarity: number
        }[]
      }
      match_similar_prompts: {
        Args: {
          diagram_type_filter?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          bpmn_xml: string
          diagram_type: string
          hit_count: number
          id: string
          prompt_text: string
          similarity: number
        }[]
      }
      update_cache_access: { Args: { cache_id: string }; Returns: undefined }
      update_vision_cache_access: {
        Args: { cache_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      bpmn_role: "admin" | "agent" | "developer" | "tester" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      bpmn_role: ["admin", "agent", "developer", "tester", "viewer"],
    },
  },
} as const
