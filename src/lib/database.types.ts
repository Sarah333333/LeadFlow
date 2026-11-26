
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "agreements": {
                  Row: {
                    "accepted_at": string,"business_id": string | null,"document": string,"id": string,"ip_hash": string | null,"user_agent": string | null,"user_id": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string,"business_id"?: string | null,"document": string,"id"?: string,"ip_hash"?: string | null,"user_agent"?: string | null,"user_id": string,"version": string
                  }
                  Update: {
                    "accepted_at"?: string,"business_id"?: string | null,"document"?: string,"id"?: string,"ip_hash"?: string | null,"user_agent"?: string | null,"user_id"?: string,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agreements_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_type": string,"actor_user_id": string | null,"business_id": string | null,"created_at": string,"details": NonNullable<Json>,"id": string,"target_id": string | null,"target_type": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_type": string,"actor_user_id"?: string | null,"business_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: string,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_type"?: string,"actor_user_id"?: string | null,"business_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: string,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"business_members": {
                  Row: {
                    "business_id": string,"created_at": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"role"?: string,"user_id": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_members_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"businesses": {
                  Row: {
                    "ai_enabled_by_default": boolean,"ai_mode": string,"ai_mode_acknowledged_at": string | null,"ai_mode_acknowledged_by": string | null,"average_job_value": number,"booking_link": string | null,"contact_email": string | null,"contact_phone": string | null,"created_at": string,"currency": string,"current_period_end": string | null,"custom_instructions": string,"description": string,"faqs": NonNullable<Json>,"follow_up_delays_hours": (number)[],"id": string,"industry": string,"intake_key": string,"max_ai_messages_per_lead_per_day": number,"name": string,"notify_email": string | null,"notify_on_attention": boolean,"notify_on_hot": boolean,"notify_phone": string | null,"onboarding_completed": boolean,"opening_hours": NonNullable<Json>,"plan": string,"quiet_hours_end": number,"quiet_hours_start": number,"retention_days": number | null,"service_areas": (string)[],"services": NonNullable<Json>,"sms_number": string | null,"stripe_customer_id": string | null,"stripe_event_at": string | null,"stripe_subscription_id": string | null,"subscription_status": string,"timezone": string,"tone": string,"trial_ends_at": string,"updated_at": string,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_enabled_by_default"?: boolean,"ai_mode"?: string,"ai_mode_acknowledged_at"?: string | null,"ai_mode_acknowledged_by"?: string | null,"average_job_value"?: number,"booking_link"?: string | null,"contact_email"?: string | null,"contact_phone"?: string | null,"created_at"?: string,"currency"?: string,"current_period_end"?: string | null,"custom_instructions"?: string,"description"?: string,"faqs"?: NonNullable<Json>,"follow_up_delays_hours"?: (number)[],"id"?: string,"industry"?: string,"intake_key"?: string,"max_ai_messages_per_lead_per_day"?: number,"name": string,"notify_email"?: string | null,"notify_on_attention"?: boolean,"notify_on_hot"?: boolean,"notify_phone"?: string | null,"onboarding_completed"?: boolean,"opening_hours"?: NonNullable<Json>,"plan"?: string,"quiet_hours_end"?: number,"quiet_hours_start"?: number,"retention_days"?: number | null,"service_areas"?: (string)[],"services"?: NonNullable<Json>,"sms_number"?: string | null,"stripe_customer_id"?: string | null,"stripe_event_at"?: string | null,"stripe_subscription_id"?: string | null,"subscription_status"?: string,"timezone"?: string,"tone"?: string,"trial_ends_at"?: string,"updated_at"?: string,"website"?: string | null
                  }
                  Update: {
                    "ai_enabled_by_default"?: boolean,"ai_mode"?: string,"ai_mode_acknowledged_at"?: string | null,"ai_mode_acknowledged_by"?: string | null,"average_job_value"?: number,"booking_link"?: string | null,"contact_email"?: string | null,"contact_phone"?: string | null,"created_at"?: string,"currency"?: string,"current_period_end"?: string | null,"custom_instructions"?: string,"description"?: string,"faqs"?: NonNullable<Json>,"follow_up_delays_hours"?: (number)[],"id"?: string,"industry"?: string,"intake_key"?: string,"max_ai_messages_per_lead_per_day"?: number,"name"?: string,"notify_email"?: string | null,"notify_on_attention"?: boolean,"notify_on_hot"?: boolean,"notify_phone"?: string | null,"onboarding_completed"?: boolean,"opening_hours"?: NonNullable<Json>,"plan"?: string,"quiet_hours_end"?: number,"quiet_hours_start"?: number,"retention_days"?: number | null,"service_areas"?: (string)[],"services"?: NonNullable<Json>,"sms_number"?: string | null,"stripe_customer_id"?: string | null,"stripe_event_at"?: string | null,"stripe_subscription_id"?: string | null,"subscription_status"?: string,"timezone"?: string,"tone"?: string,"trial_ends_at"?: string,"updated_at"?: string,"website"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"consent_events": {
                  Row: {
                    "action": string,"basis": string,"business_id": string,"channel": string,"created_at": string,"evidence": NonNullable<Json>,"id": string,"lead_id": string | null,"phone_hash": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"basis": string,"business_id": string,"channel": string,"created_at"?: string,"evidence"?: NonNullable<Json>,"id"?: string,"lead_id"?: string | null,"phone_hash"?: string | null
                  }
                  Update: {
                    "action"?: string,"basis"?: string,"business_id"?: string,"channel"?: string,"created_at"?: string,"evidence"?: NonNullable<Json>,"id"?: string,"lead_id"?: string | null,"phone_hash"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "consent_events_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consent_events_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                },"follow_ups": {
                  Row: {
                    "attempts": number,"business_id": string,"claimed_at": string | null,"created_at": string,"id": string,"lead_id": string,"message_id": string | null,"note": string | null,"processed_at": string | null,"scheduled_for": string,"status": string,"step": number
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"business_id": string,"claimed_at"?: string | null,"created_at"?: string,"id"?: string,"lead_id": string,"message_id"?: string | null,"note"?: string | null,"processed_at"?: string | null,"scheduled_for": string,"status"?: string,"step": number
                  }
                  Update: {
                    "attempts"?: number,"business_id"?: string,"claimed_at"?: string | null,"created_at"?: string,"id"?: string,"lead_id"?: string,"message_id"?: string | null,"note"?: string | null,"processed_at"?: string | null,"scheduled_for"?: string,"status"?: string,"step"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "follow_ups_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follow_ups_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follow_ups_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    }
                  ]
                },"lead_events": {
                  Row: {
                    "business_id": string,"created_at": string,"data": NonNullable<Json>,"id": string,"lead_id": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"lead_id": string,"type": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"lead_id"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lead_events_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lead_events_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                },"leads": {
                  Row: {
                    "ai_lock_until": string | null,"ai_paused": boolean,"ai_rerun": boolean,"ai_retry_count": number,"ai_summary": string | null,"attention_reason": string | null,"business_id": string,"channel": string,"closed_at": string | null,"created_at": string,"details": NonNullable<Json>,"do_not_contact": boolean,"email": string | null,"estimated_value": number | null,"first_response_at": string | null,"follow_up_step": number,"id": string,"initial_message": string | null,"last_inbound_at": string | null,"last_message_at": string | null,"last_message_preview": string | null,"last_outbound_at": string | null,"location": string | null,"name": string,"needs_attention": boolean,"next_follow_up_at": string | null,"phone": string | null,"score": number,"service_requested": string | null,"sms_consent": string,"sms_consent_at": string | null,"sms_consent_source": string | null,"source": string,"status": string,"temperature": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_lock_until"?: string | null,"ai_paused"?: boolean,"ai_rerun"?: boolean,"ai_retry_count"?: number,"ai_summary"?: string | null,"attention_reason"?: string | null,"business_id": string,"channel"?: string,"closed_at"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"do_not_contact"?: boolean,"email"?: string | null,"estimated_value"?: number | null,"first_response_at"?: string | null,"follow_up_step"?: number,"id"?: string,"initial_message"?: string | null,"last_inbound_at"?: string | null,"last_message_at"?: string | null,"last_message_preview"?: string | null,"last_outbound_at"?: string | null,"location"?: string | null,"name": string,"needs_attention"?: boolean,"next_follow_up_at"?: string | null,"phone"?: string | null,"score"?: number,"service_requested"?: string | null,"sms_consent"?: string,"sms_consent_at"?: string | null,"sms_consent_source"?: string | null,"source"?: string,"status"?: string,"temperature"?: string,"updated_at"?: string
                  }
                  Update: {
                    "ai_lock_until"?: string | null,"ai_paused"?: boolean,"ai_rerun"?: boolean,"ai_retry_count"?: number,"ai_summary"?: string | null,"attention_reason"?: string | null,"business_id"?: string,"channel"?: string,"closed_at"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"do_not_contact"?: boolean,"email"?: string | null,"estimated_value"?: number | null,"first_response_at"?: string | null,"follow_up_step"?: number,"id"?: string,"initial_message"?: string | null,"last_inbound_at"?: string | null,"last_message_at"?: string | null,"last_message_preview"?: string | null,"last_outbound_at"?: string | null,"location"?: string | null,"name"?: string,"needs_attention"?: boolean,"next_follow_up_at"?: string | null,"phone"?: string | null,"score"?: number,"service_requested"?: string | null,"sms_consent"?: string,"sms_consent_at"?: string | null,"sms_consent_source"?: string | null,"source"?: string,"status"?: string,"temperature"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "leads_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "approved_at": string | null,"approved_by": string | null,"body": string,"business_id": string,"channel": string,"created_at": string,"direction": string,"error": string | null,"id": string,"is_follow_up": boolean,"lead_id": string,"original_body": string | null,"provider_message_id": string | null,"sender": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"body": string,"business_id": string,"channel"?: string,"created_at"?: string,"direction": string,"error"?: string | null,"id"?: string,"is_follow_up"?: boolean,"lead_id": string,"original_body"?: string | null,"provider_message_id"?: string | null,"sender": string,"status"?: string
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"body"?: string,"business_id"?: string,"channel"?: string,"created_at"?: string,"direction"?: string,"error"?: string | null,"id"?: string,"is_follow_up"?: boolean,"lead_id"?: string,"original_body"?: string | null,"provider_message_id"?: string | null,"sender"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string,"business_id": string,"created_at": string,"id": string,"lead_id": string | null,"read_at": string | null,"title": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string,"business_id": string,"created_at"?: string,"id"?: string,"lead_id"?: string | null,"read_at"?: string | null,"title": string,"type": string
                  }
                  Update: {
                    "body"?: string,"business_id"?: string,"created_at"?: string,"id"?: string,"lead_id"?: string | null,"read_at"?: string | null,"title"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limits": {
                  Row: {
                    "count": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"key": string,"window_start": string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"suppression_list": {
                  Row: {
                    "business_id": string,"channel": string,"created_at": string,"phone_hash": string,"reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"channel"?: string,"created_at"?: string,"phone_hash": string,"reason": string
                  }
                  Update: {
                    "business_id"?: string,"channel"?: string,"created_at"?: string,"phone_hash"?: string,"reason"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "suppression_list_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"webhook_events": {
                  Row: {
                    "event_id": string,"provider": string,"received_at": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"provider": string,"received_at"?: string,"status"?: string
                  }
                  Update: {
                    "event_id"?: string,"provider"?: string,"received_at"?: string,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "claim_lead_turn":
{ Args: { "p_lead": string,"p_seconds"?: number }; Returns: boolean
                           },
"create_business":
{ Args: { "p_name": string }; Returns: string
                           },
"is_member":
{ Args: { "bid": string }; Returns: boolean
                           },
"is_valid_timezone":
{ Args: { "tz": string }; Returns: boolean
                           },
"leads_needing_ai":
{ Args: { "p_limit"?: number }; Returns: {
              "ai_retry_count": number,"id": string,"needs_first_reply": boolean
            }[]
                           },
"purge_expired_data":
{ Args: Record<PropertyKey, never>; Returns: {
              "business_id": string,"leads_deleted": number
            }[]
                           },
"rate_limit_hit":
{ Args: { "p_key": string,"p_limit": number,"p_window_seconds": number }; Returns: boolean
                           },
"release_lead_turn":
{ Args: { "p_lead": string }; Returns: boolean
                           },
"security_posture":
{ Args: Record<PropertyKey, never>; Returns: {
              "auto_mode_without_ack": number,"last_retention_purge": string,"legacy_consent_leads": number,"tables_total": number,"tables_without_rls": (string)[]
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
