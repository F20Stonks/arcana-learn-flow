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
    PostgrestVersion: "14.17"
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
      drill_attempts: {
        Row: {
          correct: boolean
          created_at: string
          drill_key: string
          id: string
          latency_ms: number | null
          problem_tag: string
          session_id: string
          user_id: string
        }
        Insert: {
          correct: boolean
          created_at?: string
          drill_key: string
          id?: string
          latency_ms?: number | null
          problem_tag: string
          session_id: string
          user_id: string
        }
        Update: {
          correct?: boolean
          created_at?: string
          drill_key?: string
          id?: string
          latency_ms?: number | null
          problem_tag?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drill_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "drill_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      drill_sessions: {
        Row: {
          config: Json
          created_at: string
          drill_key: string
          duration_s: number
          id: string
          mode: string
          problems_correct: number
          problems_seen: number
          score: number
          user_id: string
          xp_earned: number
        }
        Insert: {
          config?: Json
          created_at?: string
          drill_key: string
          duration_s?: number
          id?: string
          mode?: string
          problems_correct?: number
          problems_seen?: number
          score?: number
          user_id: string
          xp_earned?: number
        }
        Update: {
          config?: Json
          created_at?: string
          drill_key?: string
          duration_s?: number
          id?: string
          mode?: string
          problems_correct?: number
          problems_seen?: number
          score?: number
          user_id?: string
          xp_earned?: number
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
      integral_daily_results: {
        Row: {
          created_at: string
          hints_used: number
          id: string
          problem_id: string
          puzzle_number: number
          score: number
          seconds: number
          solved: boolean
          user_id: string
          wrong_attempts: number
        }
        Insert: {
          created_at?: string
          hints_used?: number
          id?: string
          problem_id: string
          puzzle_number: number
          score?: number
          seconds: number
          solved: boolean
          user_id: string
          wrong_attempts?: number
        }
        Update: {
          created_at?: string
          hints_used?: number
          id?: string
          problem_id?: string
          puzzle_number?: number
          score?: number
          seconds?: number
          solved?: boolean
          user_id?: string
          wrong_attempts?: number
        }
        Relationships: []
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
      reference_topic_aliases: {
        Row: {
          area: string
          kind: string
          raw_tag: string
          strand: string
          topic: string | null
        }
        Insert: {
          area: string
          kind?: string
          raw_tag: string
          strand: string
          topic?: string | null
        }
        Update: {
          area?: string
          kind?: string
          raw_tag?: string
          strand?: string
          topic?: string | null
        }
        Relationships: []
      }
      reference_topic_strands: {
        Row: {
          area: string
          position: number
          strand: string
        }
        Insert: {
          area: string
          position: number
          strand: string
        }
        Update: {
          area?: string
          position?: number
          strand?: string
        }
        Relationships: []
      }
      resource_bookmarks: {
        Row: {
          created_at: string
          id: string
          label: string | null
          note: string | null
          page: number
          quote: string | null
          resource_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          note?: string | null
          page: number
          quote?: string | null
          resource_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          note?: string | null
          page?: number
          quote?: string | null
          resource_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_bookmarks_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_chunks: {
        Row: {
          book: string
          chapter: string | null
          char_len: number
          content: string
          created_at: string
          embedding: string | null
          heading: string | null
          id: string
          license_note: string
          owner_id: string | null
          page: number | null
          resource_id: string | null
          section: string | null
          source: string
          source_url: string | null
          subject: string
        }
        Insert: {
          book: string
          chapter?: string | null
          char_len: number
          content: string
          created_at?: string
          embedding?: string | null
          heading?: string | null
          id?: string
          license_note: string
          owner_id?: string | null
          page?: number | null
          resource_id?: string | null
          section?: string | null
          source: string
          source_url?: string | null
          subject: string
        }
        Update: {
          book?: string
          chapter?: string | null
          char_len?: number
          content?: string
          created_at?: string
          embedding?: string | null
          heading?: string | null
          id?: string
          license_note?: string
          owner_id?: string | null
          page?: number | null
          resource_id?: string | null
          section?: string | null
          source?: string
          source_url?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_chunks_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_progress: {
        Row: {
          furthest_page: number
          last_page: number
          opened_count: number
          resource_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          furthest_page?: number
          last_page?: number
          opened_count?: number
          resource_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          furthest_page?: number
          last_page?: number
          opened_count?: number
          resource_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_progress_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
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
      resources: {
        Row: {
          author: string | null
          byte_size: number | null
          chunk_count: number
          content_type: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          kind: string
          level: string | null
          license_note: string | null
          license_status: string
          owner_id: string | null
          page_count: number | null
          parent_id: string | null
          role: string
          source_id: string | null
          storage_bucket: string
          storage_path: string
          subject: string | null
          text_status: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          author?: string | null
          byte_size?: number | null
          chunk_count?: number
          content_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: string
          level?: string | null
          license_note?: string | null
          license_status?: string
          owner_id?: string | null
          page_count?: number | null
          parent_id?: string | null
          role?: string
          source_id?: string | null
          storage_bucket?: string
          storage_path: string
          subject?: string | null
          text_status?: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          author?: string | null
          byte_size?: number | null
          chunk_count?: number
          content_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: string
          level?: string | null
          license_note?: string | null
          license_status?: string
          owner_id?: string | null
          page_count?: number | null
          parent_id?: string | null
          role?: string
          source_id?: string | null
          storage_bucket?: string
          storage_path?: string
          subject?: string | null
          text_status?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "resource_sources"
            referencedColumns: ["id"]
          },
        ]
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
          page_end: number | null
          page_start: number | null
          prerequisite_subtopic_ids: string[] | null
          resource_id: string | null
          status: string
          title: string
          topic_id: string
        }
        Insert: {
          completed_at?: string | null
          estimated_minutes?: number | null
          id?: string
          order_index?: number
          page_end?: number | null
          page_start?: number | null
          prerequisite_subtopic_ids?: string[] | null
          resource_id?: string | null
          status?: string
          title: string
          topic_id: string
        }
        Update: {
          completed_at?: string | null
          estimated_minutes?: number | null
          id?: string
          order_index?: number
          page_end?: number | null
          page_start?: number | null
          prerequisite_subtopic_ids?: string[] | null
          resource_id?: string | null
          status?: string
          title?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtopics_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
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
      track_resources: {
        Row: {
          added_by: string | null
          created_at: string
          note: string | null
          resource_id: string
          track_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          note?: string | null
          resource_id: string
          track_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          note?: string | null
          resource_id?: string
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_resources_track_id_fkey"
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
      user_roles: {
        Row: {
          granted_at: string
          role: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          role: string
          user_id: string
        }
        Update: {
          granted_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      drill_weak_spots: {
        Row: {
          accuracy: number | null
          attempts: number | null
          avg_latency_ms: number | null
          correct_count: number | null
          drill_key: string | null
          last_seen: string | null
          problem_tag: string | null
          user_id: string | null
        }
        Relationships: []
      }
      integral_daily_leaderboard: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          hints_used: number | null
          puzzle_number: number | null
          rank: number | null
          score: number | null
          seconds: number | null
          user_id: string | null
          wrong_attempts: number | null
        }
        Relationships: []
      }
      integral_daily_turnout: {
        Row: {
          average_score: number | null
          players: number | null
          puzzle_number: number | null
          solvers: number | null
          top_score: number | null
        }
        Relationships: []
      }
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
      book_track_progress: {
        Args: { p_track_id: string; p_user_id: string }
        Returns: {
          completed: boolean
          page_end: number
          page_start: number
          pages_read: boolean
          subtopic_id: string
          title: string
        }[]
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      integral_current_puzzle_number: { Args: never; Returns: number }
      is_admin: { Args: { p_user?: string }; Returns: boolean }
      match_resource_chunks: {
        Args: {
          p_book?: string
          p_match_count?: number
          p_owner_id?: string
          p_query_embedding?: string
          p_query_text?: string
          p_resource_id?: string
          p_subject?: string
        }
        Returns: {
          book: string
          chapter: string
          content: string
          heading: string
          id: string
          license_note: string
          page: number
          resource_id: string
          score: number
          section: string
          source_url: string
          subject: string
        }[]
      }
      match_track_resource_chunks: {
        Args: {
          p_match_count?: number
          p_query_text: string
          p_track_id: string
          p_user_id: string
        }
        Returns: {
          book: string
          chapter: string
          content: string
          heading: string
          license_note: string
          page: number
          score: number
          section: string
        }[]
      }
      reference_question_classified: {
        Args: never
        Returns: {
          area: string
          question_id: string
          strands: string[]
          topics: string[]
        }[]
      }
      reference_question_facets: {
        Args: { p_area?: string; p_competition?: string; p_strand?: string }
        Returns: Json
      }
      reference_question_list: {
        Args: {
          p_area?: string
          p_competition?: string
          p_cursor?: number
          p_limit?: number
          p_search?: string
          p_status?: string
          p_strand?: string
          p_tag?: string
          p_topic?: string
          p_user_id?: string
          p_year?: number
        }
        Returns: {
          area: string
          attempts: number
          difficulty: string
          has_diagram: boolean
          id: string
          index_only: boolean
          question_number: string
          solved: boolean
          source_competition: string
          strands: string[]
          topic_tags: string[]
          topics: string[]
          total_count: number
          year: number
        }[]
      }
      reference_question_papers: {
        Args: { p_user_id?: string }
        Returns: {
          attempted: number
          competition: string
          question_count: number
          solved: number
          with_diagram: number
          with_solutions: number
          year: number
        }[]
      }
      reference_question_progress: {
        Args: { p_user_id: string }
        Returns: Json
      }
      reference_question_set_status: {
        Args: { p_question_id: string; p_status: string; p_user_id: string }
        Returns: Json
      }
      reference_question_sort_key: { Args: { q: string }; Returns: string[] }
      reference_topic_coverage: {
        Args: never
        Returns: {
          occurrences: number
          raw_tag: string
          sample_competition: string
        }[]
      }
      refresh_reference_question_classification: {
        Args: never
        Returns: undefined
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
