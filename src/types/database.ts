
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor_user_id": string | null,"created_at": string,"id": number,"organization_id": string | null,"target_id": string | null,"target_table": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_user_id"?: string | null,"created_at"?: string,"id"?: never,"organization_id"?: string | null,"target_id"?: string | null,"target_table"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_user_id"?: string | null,"created_at"?: string,"id"?: never,"organization_id"?: string | null,"target_id"?: string | null,"target_table"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"client_links": {
                  Row: {
                    "accepted_at": string | null,"client_id": string,"created_at": string,"id": string,"last_seen_at": string | null,"organization_id": string,"status": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"client_id": string,"created_at"?: string,"id"?: string,"last_seen_at"?: string | null,"organization_id": string,"status"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"client_id"?: string,"created_at"?: string,"id"?: string,"last_seen_at"?: string | null,"organization_id"?: string,"status"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_links_client_id_organization_id_fkey"
      columns: ["client_id","organization_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"clients": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"email": string,"id": string,"name": string,"organization_id": string,"phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"email": string,"id"?: string,"name": string,"organization_id": string,"phone"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"email"?: string,"id"?: string,"name"?: string,"organization_id"?: string,"phone"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_members": {
                  Row: {
                    "created_at": string,"display_name": string,"organization_id": string,"role": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"organization_id": string,"role": string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"organization_id"?: string,"role"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_members_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"created_by": string | null,"display_name": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"display_name": string,"id"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"display_name"?: string,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"properties": {
                  Row: {
                    "archived_at": string | null,"area_m2": number | null,"created_at": string,"created_by": string | null,"id": string,"location_text": string | null,"monthly_charges_eur": number | null,"organization_id": string,"price_eur": number | null,"title": string,"typology": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"area_m2"?: number | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"location_text"?: string | null,"monthly_charges_eur"?: number | null,"organization_id": string,"price_eur"?: number | null,"title": string,"typology"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"area_m2"?: number | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"location_text"?: string | null,"monthly_charges_eur"?: number | null,"organization_id"?: string,"price_eur"?: number | null,"title"?: string,"typology"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "properties_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"property_images": {
                  Row: {
                    "created_at": string,"id": string,"organization_id": string,"property_id": string,"slot": number,"status": string,"storage_path": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"organization_id": string,"property_id": string,"slot": number,"status"?: string,"storage_path"?: never
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"organization_id"?: string,"property_id"?: string,"slot"?: number,"status"?: string,"storage_path"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "property_images_property_id_organization_id_fkey"
      columns: ["property_id","organization_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"user_profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string | null,"locale": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string | null,"locale"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string | null,"locale"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_create_consultant":
{ Args: { "p_display_name": string,"p_email": string,"p_org_display_name"?: string,"p_user_id": string }; Returns: string
                           },
"admin_expire_pending_images":
{ Args: { "p_older_than"?: string }; Returns: {
              "storage_path": string
            }[]
                           },
"admin_orphan_property_objects":
{ Args: { "p_older_than"?: string }; Returns: {
              "name": string
            }[]
                           },
"reserve_property_image":
{ Args: { "p_property_id": string }; Returns: {
              "created_at": string,
"id": string,
"organization_id": string,
"property_id": string,
"slot": number,
"status": string,
"storage_path": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "property_images"
        isOneToOne: true
        isSetofReturn: false
      } }
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
  "public": {
          Enums: {
            
          }
        }
} as const
