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
      contacts: {
        Row: {
          city: string | null
          company_name: string | null
          created_at: string
          created_by: string | null
          email: string | null
          email_normalized: string | null
          full_name: string
          id: string
          notes: string | null
          organization_id: string
          phone: string | null
          phone_normalized: string | null
          postal_code: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          email_normalized?: string | null
          full_name: string
          id?: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          phone_normalized?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          email_normalized?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          phone_normalized?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_assignment_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          conversation_id: string
          id: string
          new_user_id: string | null
          organization_id: string
          previous_user_id: string | null
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          conversation_id: string
          id?: string
          new_user_id?: string | null
          organization_id: string
          previous_user_id?: string | null
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          conversation_id?: string
          id?: string
          new_user_id?: string | null
          organization_id?: string
          previous_user_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_assignment_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_assignment_history_conversation_fk"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "conversation_assignment_history_new_user_id_fkey"
            columns: ["new_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_assignment_history_previous_user_id_fkey"
            columns: ["previous_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_user_state: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_pinned: boolean
          last_read_at: string | null
          muted_until: string | null
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          last_read_at?: string | null
          muted_until?: string | null
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          last_read_at?: string | null
          muted_until?: string | null
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_user_state_conversation_fk"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "conversation_user_state_member_fk"
            columns: ["organization_id", "user_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_to: string | null
          channel: string
          contact_id: string
          created_at: string
          created_by: string | null
          external_account_id: string | null
          external_contact_id: string | null
          id: string
          last_message_at: string | null
          last_message_direction: string | null
          last_message_preview: string | null
          lead_id: string | null
          organization_id: string
          priority: string
          status: string
          subject: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          channel?: string
          contact_id: string
          created_at?: string
          created_by?: string | null
          external_account_id?: string | null
          external_contact_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_direction?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          organization_id: string
          priority?: string
          status?: string
          subject?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          channel?: string
          contact_id?: string
          created_at?: string
          created_by?: string | null
          external_account_id?: string | null
          external_contact_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_direction?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          organization_id?: string
          priority?: string
          status?: string
          subject?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_member"
            columns: ["organization_id", "assigned_to"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
          {
            foreignKeyName: "conversations_contact_same_organization"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_lead_same_organization"
            columns: ["organization_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "conversations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_options: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          field_id: string
          id: string
          is_active: boolean
          label: string
          organization_id: string
          position: number
          updated_at: string
          value: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          field_id: string
          id?: string
          is_active?: boolean
          label: string
          organization_id: string
          position?: number
          updated_at?: string
          value: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          field_id?: string
          id?: string
          is_active?: boolean
          label?: string
          organization_id?: string
          position?: number
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_options_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_options_field_same_organization"
            columns: ["organization_id", "field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          code: string
          config: Json
          created_at: string
          created_by: string | null
          description: string | null
          field_type: string
          help_text: string | null
          id: string
          is_active: boolean
          is_filterable: boolean
          is_required: boolean
          name: string
          organization_id: string
          pipeline_id: string | null
          placeholder: string | null
          position: number
          show_in_kanban: boolean
          show_in_table: boolean
          updated_at: string
        }
        Insert: {
          code: string
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          field_type: string
          help_text?: string | null
          id?: string
          is_active?: boolean
          is_filterable?: boolean
          is_required?: boolean
          name: string
          organization_id: string
          pipeline_id?: string | null
          placeholder?: string | null
          position?: number
          show_in_kanban?: boolean
          show_in_table?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          field_type?: string
          help_text?: string | null
          id?: string
          is_active?: boolean
          is_filterable?: boolean
          is_required?: boolean
          name?: string
          organization_id?: string
          pipeline_id?: string | null
          placeholder?: string | null
          position?: number
          show_in_kanban?: boolean
          show_in_table?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_fields_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_fields_pipeline_same_organization"
            columns: ["organization_id", "pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      lead_assignment_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          lead_id: string
          new_user_id: string | null
          organization_id: string
          previous_user_id: string | null
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          lead_id: string
          new_user_id?: string | null
          organization_id: string
          previous_user_id?: string | null
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          lead_id?: string
          new_user_id?: string | null
          organization_id?: string
          previous_user_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignment_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_history_lead_fk"
            columns: ["organization_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "lead_assignment_history_new_user_id_fkey"
            columns: ["new_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_history_previous_user_id_fkey"
            columns: ["previous_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_custom_values: {
        Row: {
          created_at: string
          created_by: string | null
          field_id: string
          id: string
          lead_id: string
          organization_id: string
          updated_at: string
          updated_by: string | null
          value_boolean: boolean | null
          value_date: string | null
          value_json: Json | null
          value_number: number | null
          value_text: string | null
          value_timestamp: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          field_id: string
          id?: string
          lead_id: string
          organization_id: string
          updated_at?: string
          updated_by?: string | null
          value_boolean?: boolean | null
          value_date?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
          value_timestamp?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          field_id?: string
          id?: string
          lead_id?: string
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
          value_boolean?: boolean | null
          value_date?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
          value_timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_custom_values_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_custom_values_field_same_organization"
            columns: ["organization_id", "field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "lead_custom_values_lead_same_organization"
            columns: ["organization_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "lead_custom_values_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          lead_id: string
          organization_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          lead_id: string
          organization_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          lead_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_shares: {
        Row: {
          access_level: string
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_level?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_level?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_shares_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_shares_lead_fk"
            columns: ["organization_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "lead_shares_member_fk"
            columns: ["organization_id", "user_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          platform: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          platform: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          platform?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_stage_history: {
        Row: {
          created_at: string
          duration_seconds: number | null
          entered_at: string
          entered_by: string | null
          exited_at: string | null
          id: string
          lead_id: string
          organization_id: string
          pipeline_id: string
          stage_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          entered_at?: string
          entered_by?: string | null
          exited_at?: string | null
          id?: string
          lead_id: string
          organization_id: string
          pipeline_id: string
          stage_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          entered_at?: string
          entered_by?: string | null
          exited_at?: string | null
          id?: string
          lead_id?: string
          organization_id?: string
          pipeline_id?: string
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_stage_history_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_stage_history_lead_fk"
            columns: ["organization_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "lead_stage_history_pipeline_fk"
            columns: ["organization_id", "pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "lead_stage_history_stage_fk"
            columns: ["organization_id", "pipeline_id", "stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["organization_id", "pipeline_id", "id"]
          },
        ]
      }
      lead_tags: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          lead_id: string
          organization_id: string
          tag_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          lead_id: string
          organization_id: string
          tag_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          lead_id?: string
          organization_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tags_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tags_lead_same_organization"
            columns: ["organization_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "lead_tags_tag_same_organization"
            columns: ["organization_id", "tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          contact_id: string
          created_at: string
          created_by: string | null
          estimated_value: number | null
          expected_close_date: string | null
          external_ad_id: string | null
          external_adset_id: string | null
          external_campaign_id: string | null
          external_form_id: string | null
          external_lead_id: string | null
          fbclid: string | null
          first_contact_at: string | null
          gclid: string | null
          id: string
          last_activity_at: string
          lost_reason: string | null
          monthly_bill: number | null
          organization_id: string
          pipeline_id: string
          priority: string
          qualified_at: string | null
          raw_payload: Json
          received_at: string
          score: number
          source_id: string
          source_metadata: Json
          stage_id: string
          status: string
          temperature: string
          title: string | null
          updated_at: string
          updated_by: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          contact_id: string
          created_at?: string
          created_by?: string | null
          estimated_value?: number | null
          expected_close_date?: string | null
          external_ad_id?: string | null
          external_adset_id?: string | null
          external_campaign_id?: string | null
          external_form_id?: string | null
          external_lead_id?: string | null
          fbclid?: string | null
          first_contact_at?: string | null
          gclid?: string | null
          id?: string
          last_activity_at?: string
          lost_reason?: string | null
          monthly_bill?: number | null
          organization_id: string
          pipeline_id: string
          priority?: string
          qualified_at?: string | null
          raw_payload?: Json
          received_at?: string
          score?: number
          source_id: string
          source_metadata?: Json
          stage_id: string
          status?: string
          temperature?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string | null
          estimated_value?: number | null
          expected_close_date?: string | null
          external_ad_id?: string | null
          external_adset_id?: string | null
          external_campaign_id?: string | null
          external_form_id?: string | null
          external_lead_id?: string | null
          fbclid?: string | null
          first_contact_at?: string | null
          gclid?: string | null
          id?: string
          last_activity_at?: string
          lost_reason?: string | null
          monthly_bill?: number | null
          organization_id?: string
          pipeline_id?: string
          priority?: string
          qualified_at?: string | null
          raw_payload?: Json
          received_at?: string
          score?: number
          source_id?: string
          source_metadata?: Json
          stage_id?: string
          status?: string
          temperature?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_member_fk"
            columns: ["organization_id", "assigned_to"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_contact_fk"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "leads_organization_pipeline_fk"
            columns: ["organization_id", "pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "leads_organization_pipeline_stage_fk"
            columns: ["organization_id", "pipeline_id", "stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["organization_id", "pipeline_id", "id"]
          },
          {
            foreignKeyName: "leads_organization_source_fk"
            columns: ["organization_id", "source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "leads_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          delivered_at: string | null
          direction: string
          error_message: string | null
          external_media_id: string | null
          external_message_id: string | null
          failed_at: string | null
          file_name: string | null
          id: string
          media_storage_path: string | null
          message_type: string
          metadata: Json
          mime_type: string | null
          organization_id: string
          read_at: string | null
          reply_to_message_id: string | null
          sender_name_snapshot: string | null
          sender_role_snapshot: string | null
          sender_user_id: string | null
          sent_at: string
          status: string
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          direction: string
          error_message?: string | null
          external_media_id?: string | null
          external_message_id?: string | null
          failed_at?: string | null
          file_name?: string | null
          id?: string
          media_storage_path?: string | null
          message_type?: string
          metadata?: Json
          mime_type?: string | null
          organization_id: string
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_name_snapshot?: string | null
          sender_role_snapshot?: string | null
          sender_user_id?: string | null
          sent_at?: string
          status?: string
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          direction?: string
          error_message?: string | null
          external_media_id?: string | null
          external_message_id?: string | null
          failed_at?: string | null
          file_name?: string | null
          id?: string
          media_storage_path?: string | null
          message_type?: string
          metadata?: Json
          mime_type?: string | null
          organization_id?: string
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_name_snapshot?: string | null
          sender_role_snapshot?: string | null
          sender_user_id?: string | null
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_same_organization"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "messages_reply_same_organization"
            columns: ["organization_id", "reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "messages_sender_member"
            columns: ["organization_id", "sender_user_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string | null
          organization_id: string
          payload: Json
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          organization_id: string
          payload?: Json
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          organization_id?: string
          payload?: Json
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_member_same_organization"
            columns: ["organization_id", "user_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
        ]
      }
      organization_branding: {
        Row: {
          accent_color: string
          background_color: string
          created_at: string
          crm_name: string
          favicon_url: string | null
          font_family: string
          login_background_url: string | null
          logo_url: string | null
          organization_id: string
          primary_color: string
          secondary_color: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          background_color?: string
          created_at?: string
          crm_name?: string
          favicon_url?: string | null
          font_family?: string
          login_background_url?: string | null
          logo_url?: string | null
          organization_id: string
          primary_color?: string
          secondary_color?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          background_color?: string
          created_at?: string
          crm_name?: string
          favicon_url?: string | null
          font_family?: string
          login_background_url?: string | null
          logo_url?: string | null
          organization_id?: string
          primary_color?: string
          secondary_color?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_branding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_role_same_organization"
            columns: ["organization_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          category: string
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      pipeline_stage_user_access: {
        Row: {
          access_level: string
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          pipeline_id: string
          stage_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_level?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          pipeline_id: string
          stage_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_level?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          pipeline_id?: string
          stage_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stage_user_access_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_user_access_member_same_organization"
            columns: ["organization_id", "user_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
          {
            foreignKeyName: "stage_user_access_pipeline_same_organization"
            columns: ["organization_id", "pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "stage_user_access_stage_same_organization"
            columns: ["organization_id", "stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          category: string
          code: string
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          pipeline_id: string
          position: number
          probability: number
          requires_loss_reason: boolean
          requires_value: boolean
          updated_at: string
        }
        Insert: {
          category?: string
          code: string
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          pipeline_id: string
          position: number
          probability?: number
          requires_loss_reason?: boolean
          requires_value?: boolean
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          pipeline_id?: string
          position?: number
          probability?: number
          requires_loss_reason?: boolean
          requires_value?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_pipeline_same_organization"
            columns: ["organization_id", "pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      pipeline_user_access: {
        Row: {
          access_level: string
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          pipeline_id: string
          stage_scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_level?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          pipeline_id: string
          stage_scope?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_level?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          pipeline_id?: string
          stage_scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_user_access_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_user_access_member_same_organization"
            columns: ["organization_id", "user_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
          {
            foreignKeyName: "pipeline_user_access_pipeline_same_organization"
            columns: ["organization_id", "pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean
          name: string
          organization_id: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          organization_id: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipelines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_platform_admin: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_platform_admin?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_platform_admin?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          code: string
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          code: string
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_activity_history: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_assigned_to: string | null
          new_due_at: string | null
          new_starts_at: string | null
          new_status: string | null
          organization_id: string
          previous_assigned_to: string | null
          previous_due_at: string | null
          previous_starts_at: string | null
          previous_status: string | null
          task_id: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_assigned_to?: string | null
          new_due_at?: string | null
          new_starts_at?: string | null
          new_status?: string | null
          organization_id: string
          previous_assigned_to?: string | null
          previous_due_at?: string | null
          previous_starts_at?: string | null
          previous_status?: string | null
          task_id: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_assigned_to?: string | null
          new_due_at?: string | null
          new_starts_at?: string | null
          new_status?: string | null
          organization_id?: string
          previous_assigned_to?: string | null
          previous_due_at?: string | null
          previous_starts_at?: string | null
          previous_status?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_history_new_assigned_to_fkey"
            columns: ["new_assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_history_previous_assigned_to_fkey"
            columns: ["previous_assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_history_task_fk"
            columns: ["organization_id", "task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      task_reminders: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          organization_id: string
          remind_at: string
          sent_at: string | null
          status: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          organization_id: string
          remind_at: string
          sent_at?: string | null
          status?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          organization_id?: string
          remind_at?: string
          sent_at?: string | null
          status?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_reminders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_reminders_member_same_organization"
            columns: ["organization_id", "user_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
          {
            foreignKeyName: "task_reminders_task_same_organization"
            columns: ["organization_id", "task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string
          id: string
          lead_id: string | null
          metadata: Json
          organization_id: string
          priority: string
          recurrence_rule: string | null
          starts_at: string
          status: string
          task_type: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_to: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at: string
          id?: string
          lead_id?: string | null
          metadata?: Json
          organization_id: string
          priority?: string
          recurrence_rule?: string | null
          starts_at: string
          status?: string
          task_type?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string
          id?: string
          lead_id?: string | null
          metadata?: Json
          organization_id?: string
          priority?: string
          recurrence_rule?: string | null
          starts_at?: string
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_member"
            columns: ["organization_id", "assigned_to"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_same_organization"
            columns: ["organization_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "tasks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_crm_lead_note: {
        Args: { p_lead_id: string; p_note: string; p_organization_id: string }
        Returns: Json
      }
      claim_crm_outbound_message: {
        Args: { p_message_id: string }
        Returns: Json
      }
      claim_crm_outbound_template: {
        Args: { p_message_id: string }
        Returns: Json
      }
      complete_crm_outbound_message: {
        Args: {
          p_dispatch_token: string
          p_external_message_id?: string
          p_message_id: string
          p_provider_response?: Json
        }
        Returns: Json
      }
      create_crm_lead: {
        Args: {
          p_assigned_to?: string
          p_city?: string
          p_email?: string
          p_estimated_value?: number
          p_external_lead_id?: string
          p_full_name: string
          p_monthly_bill?: number
          p_organization_id: string
          p_phone?: string
          p_pipeline_id: string
          p_priority?: string
          p_raw_payload?: Json
          p_score?: number
          p_source_id: string
          p_stage_id: string
          p_state?: string
          p_temperature?: string
          p_title?: string
        }
        Returns: Json
      }
      create_crm_lead_full: {
        Args: {
          p_assigned_to?: string
          p_city?: string
          p_company_name?: string
          p_custom_values?: Json
          p_email?: string
          p_estimated_value?: number
          p_external_lead_id?: string
          p_full_name: string
          p_monthly_bill?: number
          p_notes?: string
          p_organization_id: string
          p_phone?: string
          p_pipeline_id: string
          p_priority?: string
          p_raw_payload?: Json
          p_score?: number
          p_source_id: string
          p_stage_id: string
          p_state?: string
          p_tag_names?: string[]
          p_temperature?: string
          p_title?: string
          p_utm_campaign?: string
        }
        Returns: Json
      }
      create_crm_task: {
        Args: {
          p_assigned_to: string
          p_description: string
          p_due_at: string
          p_lead_id: string
          p_organization_id: string
          p_priority: string
          p_reminder_minutes?: number
          p_starts_at: string
          p_task_type: string
          p_title: string
        }
        Returns: Json
      }
      crm_phone_aliases: { Args: { p_phone: string }; Returns: string[] }
      delete_crm_task: {
        Args: { p_organization_id: string; p_task_id: string }
        Returns: Json
      }
      fail_crm_outbound_message: {
        Args: {
          p_dispatch_token: string
          p_error_message: string
          p_message_id: string
          p_provider_response?: Json
        }
        Returns: Json
      }
      fail_crm_whatsapp_media_upload: {
        Args: {
          p_error_message: string
          p_message_id: string
          p_organization_id: string
        }
        Returns: Json
      }
      finalize_crm_whatsapp_media_upload: {
        Args: { p_message_id: string; p_organization_id: string }
        Returns: Json
      }
      get_crm_whatsapp_window: {
        Args: { p_conversation_id: string; p_organization_id: string }
        Returns: Json
      }
      get_my_crm_context: { Args: never; Returns: Json }
      ingest_crm_whatsapp_message: {
        Args: {
          p_body?: string
          p_contact_name?: string
          p_external_account_id: string
          p_external_contact_id: string
          p_external_message_id: string
          p_message_type?: string
          p_metadata?: Json
          p_organization_id: string
          p_sent_at?: string
        }
        Returns: Json
      }
      mark_crm_conversation_read: {
        Args: { p_conversation_id: string; p_organization_id: string }
        Returns: Json
      }
      mark_crm_notifications_read: {
        Args: { p_notification_id?: string; p_organization_id: string }
        Returns: Json
      }
      move_crm_lead: {
        Args: {
          p_lead_id: string
          p_organization_id: string
          p_stage_id: string
        }
        Returns: Json
      }
      normalize_email: { Args: { input_value: string }; Returns: string }
      normalize_phone: { Args: { input_value: string }; Returns: string }
      open_crm_whatsapp_conversation: {
        Args: { p_lead_id: string; p_organization_id: string }
        Returns: Json
      }
      queue_crm_whatsapp_media: {
        Args: {
          p_body?: string
          p_conversation_id: string
          p_file_name?: string
          p_message_id: string
          p_message_type: string
          p_mime_type?: string
          p_organization_id: string
          p_size_bytes?: number
          p_storage_path?: string
        }
        Returns: Json
      }
      send_crm_message_local: {
        Args: {
          p_body: string
          p_conversation_id: string
          p_organization_id: string
        }
        Returns: Json
      }
      send_crm_whatsapp_template: {
        Args: {
          p_conversation_id: string
          p_language_code: string
          p_organization_id: string
          p_parameters?: Json
          p_template_name: string
        }
        Returns: Json
      }
      toggle_crm_task: {
        Args: { p_organization_id: string; p_task_id: string }
        Returns: Json
      }
      transfer_crm_conversation: {
        Args: {
          p_conversation_id: string
          p_organization_id: string
          p_user_id: string
        }
        Returns: Json
      }
      update_crm_lead_full: {
        Args: {
          p_assigned_to?: string
          p_city?: string
          p_company_name?: string
          p_custom_values?: Json
          p_email?: string
          p_estimated_value?: number
          p_full_name: string
          p_lead_id: string
          p_notes?: string
          p_organization_id: string
          p_phone?: string
          p_pipeline_id: string
          p_priority?: string
          p_score?: number
          p_source_id: string
          p_stage_id: string
          p_state?: string
          p_tag_names?: string[]
          p_temperature?: string
          p_title?: string
          p_utm_campaign?: string
        }
        Returns: Json
      }
      update_crm_task: {
        Args: {
          p_assigned_to: string
          p_description: string
          p_due_at: string
          p_lead_id: string
          p_organization_id: string
          p_priority: string
          p_reminder_minutes?: number
          p_starts_at: string
          p_task_id: string
          p_task_type: string
          p_title: string
        }
        Returns: Json
      }
      update_crm_whatsapp_message_status: {
        Args: {
          p_error_code?: string
          p_error_message?: string
          p_error_title?: string
          p_external_message_id: string
          p_metadata?: Json
          p_occurred_at?: string
          p_organization_id: string
          p_recipient_id?: string
          p_status: string
        }
        Returns: Json
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
