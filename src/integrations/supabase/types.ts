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
      generated_papers: {
        Row: {
          answers: Json
          completed_at: string | null
          created_at: string
          difficulty: string
          id: string
          questions: Json
          score: number | null
          title: string
          topics: Json
          total_marks: number
          track_id: string
          user_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          difficulty: string
          id?: string
          questions: Json
          score?: number | null
          title: string
          topics?: Json
          total_marks?: number
          track_id: string
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          difficulty?: string
          id?: string
          questions?: Json
          score?: number | null
          title?: string
          topics?: Json
          total_marks?: number
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_papers_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "learning_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      insights: {
        Row: {
          created_at: string
          environment: string
          formulas: Json
          id: string
          mode: string
          params: Json
          payload: Json | null
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
          payload?: Json | null
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
          payload?: Json | null
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
          available_options: string[]
          created_at: string
          emoji: string | null
          exam_board: string | null
          exam_date: string | null
          id: string
          level: string | null
          subject: string
          syllabus_tree_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          available_options?: string[]
          created_at?: string
          emoji?: string | null
          exam_board?: string | null
          exam_date?: string | null
          id?: string
          level?: string | null
          subject: string
          syllabus_tree_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          available_options?: string[]
          created_at?: string
          emoji?: string | null
          exam_board?: string | null
          exam_date?: string | null
          id?: string
          level?: string | null
          subject?: string
          syllabus_tree_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_tracks_syllabus_tree_id_fkey"
            columns: ["syllabus_tree_id"]
            isOneToOne: false
            referencedRelation: "syllabus_trees"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_plans: {
        Row: {
          board: string | null
          created_at: string
          id: string
          level: string | null
          model: string | null
          plan: Json
          plan_version: number
          signature: string
          subject: string | null
          subtopic: string | null
          topic: string | null
        }
        Insert: {
          board?: string | null
          created_at?: string
          id?: string
          level?: string | null
          model?: string | null
          plan: Json
          plan_version?: number
          signature: string
          subject?: string | null
          subtopic?: string | null
          topic?: string | null
        }
        Update: {
          board?: string | null
          created_at?: string
          id?: string
          level?: string | null
          model?: string | null
          plan?: Json
          plan_version?: number
          signature?: string
          subject?: string | null
          subtopic?: string | null
          topic?: string | null
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
      past_papers: {
        Row: {
          board: string
          created_at: string
          id: string
          level: string | null
          paper_label: string | null
          source_url: string
          storage_path: string | null
          subject: string
          title: string
          year: string | null
        }
        Insert: {
          board: string
          created_at?: string
          id?: string
          level?: string | null
          paper_label?: string | null
          source_url: string
          storage_path?: string | null
          subject: string
          title: string
          year?: string | null
        }
        Update: {
          board?: string
          created_at?: string
          id?: string
          level?: string | null
          paper_label?: string | null
          source_url?: string
          storage_path?: string | null
          subject?: string
          title?: string
          year?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          learner_notes: string | null
          learner_style_notes: string | null
          onboarding_complete: boolean
          subscription_tier: string
          total_xp: number
          updated_at: string
          user_id: string
          voice_id: string | null
          waitlist_status: string
          weekly_streak: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          learner_notes?: string | null
          learner_style_notes?: string | null
          onboarding_complete?: boolean
          subscription_tier?: string
          total_xp?: number
          updated_at?: string
          user_id: string
          voice_id?: string | null
          waitlist_status?: string
          weekly_streak?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          learner_notes?: string | null
          learner_style_notes?: string | null
          onboarding_complete?: boolean
          subscription_tier?: string
          total_xp?: number
          updated_at?: string
          user_id?: string
          voice_id?: string | null
          waitlist_status?: string
          weekly_streak?: number
        }
        Relationships: []
      }
      reference_question_concepts: {
        Row: {
          concept_id: string
          id: string
          reference_question_id: string
          role: string
        }
        Insert: {
          concept_id: string
          id?: string
          reference_question_id: string
          role?: string
        }
        Update: {
          concept_id?: string
          id?: string
          reference_question_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_question_concepts_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_question_concepts_reference_question_id_fkey"
            columns: ["reference_question_id"]
            isOneToOne: false
            referencedRelation: "reference_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_question_requests: {
        Row: {
          blocked: boolean
          id: string
          requested_at: string
          user_id: string
          weight: number
        }
        Insert: {
          blocked?: boolean
          id?: string
          requested_at?: string
          user_id: string
          weight?: number
        }
        Update: {
          blocked?: boolean
          id?: string
          requested_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      reference_questions: {
        Row: {
          created_at: string
          difficulty: string | null
          full_pdf_storage_path: string | null
          has_diagram: boolean
          id: string
          language: string | null
          learning_track: string | null
          license_note: string | null
          question_number: string | null
          question_text: string
          resource_type: string | null
          solution_added_at: string | null
          solution_provenance: string | null
          solution_source_url: string | null
          solution_text: string | null
          source_competition: string
          source_country: string | null
          source_url: string
          storage_path: string | null
          subject: string
          topic_tags: string[]
          year: number | null
        }
        Insert: {
          created_at?: string
          difficulty?: string | null
          full_pdf_storage_path?: string | null
          has_diagram?: boolean
          id?: string
          language?: string | null
          learning_track?: string | null
          license_note?: string | null
          question_number?: string | null
          question_text: string
          resource_type?: string | null
          solution_added_at?: string | null
          solution_provenance?: string | null
          solution_source_url?: string | null
          solution_text?: string | null
          source_competition: string
          source_country?: string | null
          source_url: string
          storage_path?: string | null
          subject: string
          topic_tags?: string[]
          year?: number | null
        }
        Update: {
          created_at?: string
          difficulty?: string | null
          full_pdf_storage_path?: string | null
          has_diagram?: boolean
          id?: string
          language?: string | null
          learning_track?: string | null
          license_note?: string | null
          question_number?: string | null
          question_text?: string
          resource_type?: string | null
          solution_added_at?: string | null
          solution_provenance?: string | null
          solution_source_url?: string | null
          solution_text?: string | null
          source_competition?: string
          source_country?: string | null
          source_url?: string
          storage_path?: string | null
          subject?: string
          topic_tags?: string[]
          year?: number | null
        }
        Relationships: []
      }
      resource_sources: {
        Row: {
          attribution: string
          created_at: string
          homepage: string | null
          id: string
          license_code: string
          license_url: string | null
          mirror_allowed: boolean
          name: string
          notes: string | null
          url_patterns: string[]
        }
        Insert: {
          attribution: string
          created_at?: string
          homepage?: string | null
          id?: string
          license_code: string
          license_url?: string | null
          mirror_allowed?: boolean
          name: string
          notes?: string | null
          url_patterns?: string[]
        }
        Update: {
          attribution?: string
          created_at?: string
          homepage?: string | null
          id?: string
          license_code?: string
          license_url?: string | null
          mirror_allowed?: boolean
          name?: string
          notes?: string | null
          url_patterns?: string[]
        }
        Relationships: []
      }
      scene_outcomes: {
        Row: {
          attempts: number | null
          created_at: string
          flags: string[]
          hard_fail: boolean
          id: string
          issue_kinds: string[]
          outcome: string
          prim_count: number | null
          repair_actions: string[]
          request: string
          rung: number
          session_id: string | null
          source: string
          subtopic_id: string | null
          user_id: string
        }
        Insert: {
          attempts?: number | null
          created_at?: string
          flags?: string[]
          hard_fail?: boolean
          id?: string
          issue_kinds?: string[]
          outcome: string
          prim_count?: number | null
          repair_actions?: string[]
          request: string
          rung: number
          session_id?: string | null
          source?: string
          subtopic_id?: string | null
          user_id: string
        }
        Update: {
          attempts?: number | null
          created_at?: string
          flags?: string[]
          hard_fail?: boolean
          id?: string
          issue_kinds?: string[]
          outcome?: string
          prim_count?: number | null
          repair_actions?: string[]
          request?: string
          rung?: number
          session_id?: string | null
          source?: string
          subtopic_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      session_turn_flags: {
        Row: {
          created_at: string
          excerpt: string | null
          id: string
          message_index: number | null
          note: string | null
          role: string | null
          session_id: string | null
          subtopic_id: string | null
          tags: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          excerpt?: string | null
          id?: string
          message_index?: number | null
          note?: string | null
          role?: string | null
          session_id?: string | null
          subtopic_id?: string | null
          tags?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          excerpt?: string | null
          id?: string
          message_index?: number | null
          note?: string | null
          role?: string | null
          session_id?: string | null
          subtopic_id?: string | null
          tags?: string[]
          user_id?: string
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
      spec_checklist_items: {
        Row: {
          code: string | null
          created_at: string
          evidence_requirements: Json
          id: string
          rigor: string
          source_url: string | null
          subtopic_ids: string[]
          text: string
          ticked: boolean
          ticked_at: string | null
          topic_id: string | null
          track_id: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          evidence_requirements?: Json
          id?: string
          rigor?: string
          source_url?: string | null
          subtopic_ids?: string[]
          text: string
          ticked?: boolean
          ticked_at?: string | null
          topic_id?: string | null
          track_id: string
        }
        Update: {
          code?: string | null
          created_at?: string
          evidence_requirements?: Json
          id?: string
          rigor?: string
          source_url?: string | null
          subtopic_ids?: string[]
          text?: string
          ticked?: boolean
          ticked_at?: string | null
          topic_id?: string | null
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spec_checklist_items_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spec_checklist_items_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "learning_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      spec_documents: {
        Row: {
          board: string
          created_at: string
          extracted_text: string
          id: string
          level: string | null
          relevance_score: number | null
          source_url: string
          storage_path: string | null
          subject: string
        }
        Insert: {
          board: string
          created_at?: string
          extracted_text: string
          id?: string
          level?: string | null
          relevance_score?: number | null
          source_url: string
          storage_path?: string | null
          subject: string
        }
        Update: {
          board?: string
          created_at?: string
          extracted_text?: string
          id?: string
          level?: string | null
          relevance_score?: number | null
          source_url?: string
          storage_path?: string | null
          subject?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
          difficulty: number | null
          fsrs_state: number | null
          id: string
          interval_days: number
          lapses: number
          last_completed_at: string | null
          last_review: string | null
          next_review_due_at: string
          reps: number
          stability: number | null
          subtopic_id: string
          user_id: string
        }
        Insert: {
          difficulty?: number | null
          fsrs_state?: number | null
          id?: string
          interval_days?: number
          lapses?: number
          last_completed_at?: string | null
          last_review?: string | null
          next_review_due_at: string
          reps?: number
          stability?: number | null
          subtopic_id: string
          user_id: string
        }
        Update: {
          difficulty?: number | null
          fsrs_state?: number | null
          id?: string
          interval_days?: number
          lapses?: number
          last_completed_at?: string | null
          last_review?: string | null
          next_review_due_at?: string
          reps?: number
          stability?: number | null
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
      syllabus_trees: {
        Row: {
          board: string | null
          coverage: Json | null
          created_at: string
          id: string
          level: string | null
          model: string | null
          option: string
          signature: string
          subject: string | null
          tree: Json
          tree_version: number
        }
        Insert: {
          board?: string | null
          coverage?: Json | null
          created_at?: string
          id?: string
          level?: string | null
          model?: string | null
          option?: string
          signature: string
          subject?: string | null
          tree: Json
          tree_version?: number
        }
        Update: {
          board?: string | null
          coverage?: Json | null
          created_at?: string
          id?: string
          level?: string | null
          model?: string | null
          option?: string
          signature?: string
          subject?: string | null
          tree?: Json
          tree_version?: number
        }
        Relationships: []
      }
      topics: {
        Row: {
          archived_at: string | null
          id: string
          option_group: string | null
          order_index: number
          status: string
          title: string
          track_id: string
        }
        Insert: {
          archived_at?: string | null
          id?: string
          option_group?: string | null
          order_index?: number
          status?: string
          title: string
          track_id: string
        }
        Update: {
          archived_at?: string | null
          id?: string
          option_group?: string | null
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
      user_question_attempts: {
        Row: {
          attempt_end: string | null
          attempt_start: string
          created_at: string
          id: string
          is_completed: boolean
          notes: string | null
          reference_question_id: string
          score: number | null
          time_spent_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_end?: string | null
          attempt_start?: string
          created_at?: string
          id?: string
          is_completed?: boolean
          notes?: string | null
          reference_question_id: string
          score?: number | null
          time_spent_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_end?: string | null
          attempt_start?: string
          created_at?: string
          id?: string
          is_completed?: boolean
          notes?: string | null
          reference_question_id?: string
          score?: number | null
          time_spent_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_question_attempts_reference_question_id_fkey"
            columns: ["reference_question_id"]
            isOneToOne: false
            referencedRelation: "reference_questions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      user_resource_analytics: {
        Row: {
          average_score: number | null
          completed_attempts: number | null
          difficulty: string | null
          learning_track: string | null
          subject: string | null
          total_attempts: number | null
          total_time_spent: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      reference_question_facets: {
        Args: { p_area?: string; p_competition?: string }
        Returns: Json
      }
      reference_question_list: {
        Args: {
          p_area?: string
          p_competition?: string
          p_cursor?: number
          p_limit?: number
          p_search?: string
          p_tag?: string
          p_year?: number
        }
        Returns: {
          has_diagram: boolean
          id: string
          question_number: string
          source_competition: string
          topic_tags: string[]
          total_count: number
          year: number
        }[]
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
