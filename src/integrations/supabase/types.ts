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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      interview_slots: {
        Row: {
          created_at: string
          id: string
          lead_id: string | null
          notes: string | null
          scheduled_at: string
          updated_at: string
          vendedor_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          scheduled_at: string
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          scheduled_at?: string
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_slots_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_slots_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          alinhamento_financeiro: string | null
          alta_prioridade: boolean
          cidade_estado: string | null
          classificacao_lead: string
          data_cadastro: string
          decisao_entrevista: string | null
          email: string
          empresa: string | null
          etapa_atual: string | null
          id: string
          impacto_ingles: string | null
          motivo_ingles: string | null
          motivo_nao_faz_curso: string | null
          nivel_ingles: string | null
          nome: string
          origem: string
          perdeu_oportunidade: string | null
          profissao: string | null
          respostas_json: Json
          scheduled_at: string | null
          status: string
          ultima_interacao: string
          vendedor_id: string | null
          whatsapp: string
        }
        Insert: {
          alinhamento_financeiro?: string | null
          alta_prioridade?: boolean
          cidade_estado?: string | null
          classificacao_lead?: string
          data_cadastro?: string
          decisao_entrevista?: string | null
          email: string
          empresa?: string | null
          etapa_atual?: string | null
          id?: string
          impacto_ingles?: string | null
          motivo_ingles?: string | null
          motivo_nao_faz_curso?: string | null
          nivel_ingles?: string | null
          nome: string
          origem?: string
          perdeu_oportunidade?: string | null
          profissao?: string | null
          respostas_json?: Json
          scheduled_at?: string | null
          status?: string
          ultima_interacao?: string
          vendedor_id?: string | null
          whatsapp: string
        }
        Update: {
          alinhamento_financeiro?: string | null
          alta_prioridade?: boolean
          cidade_estado?: string | null
          classificacao_lead?: string
          data_cadastro?: string
          decisao_entrevista?: string | null
          email?: string
          empresa?: string | null
          etapa_atual?: string | null
          id?: string
          impacto_ingles?: string | null
          motivo_ingles?: string | null
          motivo_nao_faz_curso?: string | null
          nivel_ingles?: string | null
          nome?: string
          origem?: string
          perdeu_oportunidade?: string | null
          profissao?: string | null
          respostas_json?: Json
          scheduled_at?: string | null
          status?: string
          ultima_interacao?: string
          vendedor_id?: string | null
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendedores: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          must_change_password: boolean
          nome: string
          slug: string
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          id?: string
          must_change_password?: boolean
          nome: string
          slug: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          id?: string
          must_change_password?: boolean
          nome?: string
          slug?: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      book_interview_slot: {
        Args: { p_lead_id: string; p_slot_id: string }
        Returns: string
      }
      claim_admin: { Args: never; Returns: boolean }
      complete_vendedor_password_change: { Args: never; Returns: boolean }
      current_vendedor_id: { Args: never; Returns: string }
      get_available_slots: {
        Args: never
        Returns: {
          id: string
          scheduled_at: string
        }[]
      }
      get_available_slots_by_vendedor: {
        Args: { p_vendedor_id: string }
        Returns: {
          id: string
          scheduled_at: string
        }[]
      }
      get_public_settings: {
        Args: never
        Returns: {
          brand_name: string
          brand_subtitle: string
          logo_url: string
          scheduling_link: string
          whatsapp_number: string
        }[]
      }
      get_vendedor_by_slug: {
        Args: { p_slug: string }
        Returns: {
          ativo: boolean
          id: string
          nome: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      save_lead_progress: {
        Args: { p_data: Json; p_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin"
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
      app_role: ["admin"],
    },
  },
} as const
