import { supabase } from "./client";

export interface AuthenticatedAccess {
  userId: string;
  email: string;
  fullName: string;
  isPlatformAdmin: boolean;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  roleId: string;
  roleCode: string;
  roleName: string;
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}

export async function getCurrentAccess(): Promise<AuthenticatedAccess | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, is_platform_admin")
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select(`
      organization_id,
      role_id,
      organizations (
        id,
        name,
        slug
      ),
      roles (
        id,
        name,
        code
      )
    `)
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .single();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const organization = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations;

  const role = Array.isArray(membership.roles)
    ? membership.roles[0]
    : membership.roles;

  if (!organization || !role) {
    throw new Error(
      "O usuário existe, mas não possui empresa ou cargo configurado.",
    );
  }

  return {
    userId: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    isPlatformAdmin: profile.is_platform_admin,
    organizationId: organization.id,
    organizationName: organization.name,
    organizationSlug: organization.slug,
    roleId: role.id,
    roleCode: role.code,
    roleName: role.name,
  };
}