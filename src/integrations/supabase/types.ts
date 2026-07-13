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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      billing_customers: {
        Row: {
          created_at: string
          id: string
          stripe_customer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          stripe_customer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          stripe_customer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      concepts: {
        Row: {
          aliases: string[] | null
          created_at: string
          definition: string | null
          id: string
          name: string
          type: string
        }
        Insert: {
          aliases?: string[] | null
          created_at?: string
          definition?: string | null
          id?: string
          name: string
          type: string
        }
        Update: {
          aliases?: string[] | null
          created_at?: string
          definition?: string | null
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      daily_challenges: {
        Row: {
          date: string
          difficulty: string
          id: string
          question: string
          subject: string
        }
        Insert: {
          date?: string
          difficulty?: string
          id?: string
          question: string
          subject: string
        }
        Update: {
          date?: string
          difficulty?: string
          id?: string
          question?: string
          subject?: string
        }
        Relationships: []
      }
      insights: {
        Row: {
          created_at: string
          environment: string
          formulas: Json
          id: string
          mode: string
          params: Json
          subtopic_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          environment: string
          formulas?: Json
          id?: string
          mode?: string
          params?: Json
          subtopic_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          environment?: string
          formulas?: Json
          id?: string
          mode?: string
          params?: Json
          subtopic_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_tracks: {
        Row: {
          archived_at: string | null
          created_at: string
          emoji: string | null
          exam_board: string | null
          exam_date: string | null
          id: string
          level: string | null
          subject: string
          title: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          emoji?: string | null
          exam_board?: string | null
          exam_date?: string | null
          id?: string
          level?: string | null
          subject: string
          title: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          emoji?: string | null
          exam_board?: string | null
          exam_date?: string | null
          id?: string
          level?: string | null
          subject?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: string
          created_at: string
          id: string
          linked_concept_ids: string[] | null
          subtopic_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          linked_concept_ids?: string[] | null
          subtopic_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          linked_concept_ids?: string[] | null
          subtopic_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          onboarding_complete: boolean
          subscription_tier: string
          total_xp: number
          updated_at: string
          user_id: string
          voice_id: string | null
          weekly_streak: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_complete?: boolean
          subscription_tier?: string
          total_xp?: number
          updated_at?: string
          user_id: string
          voice_id?: string | null
          weekly_streak?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_complete?: boolean
          subscription_tier?: string
          total_xp?: number
          updated_at?: string
          user_id?: string
          voice_id?: string | null
          weekly_streak?: number
        }
        Relationships: []
      }
      sessions: {
        Row: {
          completed_at: string | null
          id: string
          session_type: string
          started_at: string
          subtopic_id: string
          user_id: string
          xp_earned: number | null
        }
        Insert: {
          completed_at?: string | null
          id?: string
          session_type?: string
          started_at?: string
          subtopic_id: string
          user_id: string
          xp_earned?: number | null
        }
        Update: {
          completed_at?: string | null
          id?: string
          session_type?: string
          started_at?: string
          subtopic_id?: string
          user_id?: string
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
        ]
      }
      subtopic_concepts: {
        Row: {
          concept_id: string
          id: string
          role: string
          subtopic_id: string
        }
        Insert: {
          concept_id: string
          id?: string
          role: string
          subtopic_id: string
        }
        Update: {
          concept_id?: string
          id?: string
          role?: string
          subtopic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtopic_concepts_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtopic_concepts_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
        ]
      }
      subtopic_reviews: {
        Row: {
          id: string
          interval_days: number
          last_completed_at: string | null
          next_review_due_at: string
          subtopic_id: string
          user_id: string
        }
        Insert: {
          id?: string
          interval_days?: number
          last_completed_at?: string | null
          next_review_due_at: string
          subtopic_id: string
          user_id: string
        }
        Update: {
          id?: string
          interval_days?: number
          last_completed_at?: string | null
          next_review_due_at?: string
          subtopic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtopic_reviews_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
        ]
      }
      subtopics: {
        Row: {
          completed_at: string | null
          estimated_minutes: number | null
          id: string
          order_index: number
          prerequisite_subtopic_ids: string[] | null
          status: string
          title: string
          topic_id: string
        }
        Insert: {
          completed_at?: string | null
          estimated_minutes?: number | null
          id?: string
          order_index?: number
          prerequisite_subtopic_ids?: string[] | null
          status?: string
          title: string
          topic_id: string
        }
        Update: {
          completed_at?: string | null
          estimated_minutes?: number | null
          id?: string
          order_index?: number
          prerequisite_subtopic_ids?: string[] | null
          status?: string
          title?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtopics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          id: string
          order_index: number
          status: string
          title: string
          track_id: string
        }
        Insert: {
          id?: string
          order_index?: number
          status?: string
          title: string
          track_id: string
        }
        Update: {
          id?: string
          order_index?: number
          status?: string
          title?: string
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "learning_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_concept_knowledge: {
        Row: {
          concept_id: string
          id: string
          known_at: string
          source_subtopic_id: string | null
          user_id: string
        }
        Insert: {
          concept_id: string
          id?: string
          known_at?: string
          source_subtopic_id?: string | null
          user_id: string
        }
        Update: {
          concept_id?: string
          id?: string
          known_at?: string
          source_subtopic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_concept_knowledge_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_concept_knowledge_source_subtopic_id_fkey"
            columns: ["source_subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
