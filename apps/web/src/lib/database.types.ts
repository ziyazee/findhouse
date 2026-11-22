export type Database = {
  public: {
    Tables: {
      brokers: {
        Row: {
          id: string
          phone: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          phone: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          phone?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_submissions: {
        Row: {
          id: string
          broker_id: string | null
          sender_phone: string
          status: string
          property_id: string | null
          failure_reason: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          broker_id?: string | null
          sender_phone: string
          status?: string
          property_id?: string | null
          failure_reason?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          broker_id?: string | null
          sender_phone?: string
          status?: string
          property_id?: string | null
          failure_reason?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_submissions_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_submission_messages: {
        Row: {
          id: string
          submission_id: string
          whatsapp_message_id: string
          message_type: string
          text_body: string | null
          caption: string | null
          media_id: string | null
          media_type: string | null
          mime_type: string | null
          media_storage_path: string | null
          whatsapp_timestamp: string | null
          created_at: string
        }
        Insert: {
          id?: string
          submission_id: string
          whatsapp_message_id: string
          message_type: string
          text_body?: string | null
          caption?: string | null
          media_id?: string | null
          media_type?: string | null
          mime_type?: string | null
          media_storage_path?: string | null
          whatsapp_timestamp?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          submission_id?: string
          whatsapp_message_id?: string
          message_type?: string
          text_body?: string | null
          caption?: string | null
          media_id?: string | null
          media_type?: string | null
          mime_type?: string | null
          media_storage_path?: string | null
          whatsapp_timestamp?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_submission_messages_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          id: string
          broker_id: string | null
          session_id: string | null
          slug: string
          short_id: string
          title: string
          property_type: string
          listing_type: string
          status: string
          price: number | null
          deposit: number | null
          location: string | null
          locality: string | null
          bedrooms: number | null
          bathrooms: number | null
          balconies: number | null
          built_up_area: number | null
          carpet_area: number | null
          furnishing: string | null
          floor: string | null
          total_floors: number | null
          parking: string | null
          move_in_date: string | null
          amenities: string[] | null
          description: string | null
          other: Record<string, unknown> | null
          raw_data: Record<string, unknown> | null
          cover_image_id: string | null
          image_classification_status: string | null
          image_classification_metadata: Record<string, unknown> | null
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          broker_id?: string | null
          session_id?: string | null
          slug: string
          short_id?: string
          title: string
          property_type?: string
          listing_type?: string
          status?: string
          price?: number | null
          deposit?: number | null
          location?: string | null
          locality?: string | null
          bedrooms?: number | null
          bathrooms?: number | null
          balconies?: number | null
          built_up_area?: number | null
          carpet_area?: number | null
          furnishing?: string | null
          floor?: string | null
          total_floors?: number | null
          parking?: string | null
          move_in_date?: string | null
          amenities?: string[] | null
          description?: string | null
          other?: Record<string, unknown> | null
          raw_data?: Record<string, unknown> | null
          cover_image_id?: string | null
          image_classification_status?: string | null
          image_classification_metadata?: Record<string, unknown> | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          broker_id?: string | null
          session_id?: string | null
          slug?: string
          short_id?: string
          title?: string
          property_type?: string
          listing_type?: string
          status?: string
          price?: number | null
          deposit?: number | null
          location?: string | null
          locality?: string | null
          bedrooms?: number | null
          bathrooms?: number | null
          balconies?: number | null
          built_up_area?: number | null
          carpet_area?: number | null
          furnishing?: string | null
          floor?: string | null
          total_floors?: number | null
          parking?: string | null
          move_in_date?: string | null
          amenities?: string[] | null
          description?: string | null
          other?: Record<string, unknown> | null
          raw_data?: Record<string, unknown> | null
          cover_image_id?: string | null
          image_classification_status?: string | null
          image_classification_metadata?: Record<string, unknown> | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_cover_image_id_fkey"
            columns: ["cover_image_id"]
            isOneToOne: false
            referencedRelation: "property_media"
            referencedColumns: ["id"]
          },
        ]
      }
      property_media: {
        Row: {
          id: string
          property_id: string
          media_type: string
          storage_path: string
          category: string | null
          ai_description: string | null
          ai_confidence: number | null
          display_order: number
          is_cover: boolean
          created_at: string
        }
        Insert: {
          id?: string
          property_id: string
          media_type: string
          storage_path: string
          category?: string | null
          ai_description?: string | null
          ai_confidence?: number | null
          display_order?: number
          is_cover?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          media_type?: string
          storage_path?: string
          category?: string | null
          ai_description?: string | null
          ai_confidence?: number | null
          display_order?: number
          is_cover?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_media_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      broker_register_check: {
        Args: { check_phone: string }
        Returns: string
      }
      broker_me: {
        Args: Record<string, never>
        Returns: { id: string; phone: string; name: string | null; status: string; subdomain: string | null }[]
      }
      owns_property: {
        Args: { pid: string }
        Returns: boolean
      }
      get_listing_contact: {
        Args: { listing_id: string }
        Returns: string | null
      }
      get_listing_agent_name: {
        Args: { listing_id: string }
        Returns: string | null
      }
      get_broker_page: {
        Args: { page_broker_id?: string; page_subdomain?: string }
        Returns: { id: string; name: string | null; phone: string; subdomain: string | null }[]
      }
      set_my_subdomain: {
        Args: { new_subdomain: string }
        Returns: string
      }
    }
    Enums: Record<string, never>
  }
}
