import { supabase } from "./client";

export interface BootstrapUser {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  is_platform_admin: boolean;
}

export interface BootstrapOrganization {
  id: string;
  name: string;
  slug: string;
  status: "active" | "inactive" | "suspended";
  created_at: string;
}

export interface BootstrapBranding {
  crm_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  login_background_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  font_family: string;
}

export interface BootstrapRole {
  id: string;
  name: string;
  code: string;
  description: string | null;
}

export interface BootstrapMembership {
  organization: BootstrapOrganization;
  branding: BootstrapBranding;
  role: BootstrapRole;
  permissions: string[];
}

export interface CrmBootstrap {
  user: BootstrapUser;
  memberships: BootstrapMembership[];
}

export async function getCrmBootstrap(): Promise<CrmBootstrap> {
  const { data, error } = await supabase.rpc(
    "get_my_crm_context",
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!data || typeof data !== "object") {
    throw new Error(
      "O Supabase não retornou o contexto do CRM.",
    );
  }

  const bootstrap = data as unknown as CrmBootstrap;

  if (!bootstrap.user) {
    throw new Error(
      "O perfil do usuário autenticado não foi encontrado.",
    );
  }

  if (
    !Array.isArray(bootstrap.memberships) ||
    bootstrap.memberships.length === 0
  ) {
    throw new Error(
      "O usuário não possui uma empresa ativa vinculada.",
    );
  }

  return bootstrap;
}