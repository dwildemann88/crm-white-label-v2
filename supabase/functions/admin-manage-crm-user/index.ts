import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === "string" ? value.trim() : "";
}

function stringArrayField(
  source: Record<string, unknown>,
  key: string,
): string[] {
  const value = source[key];
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()))];
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Método não permitido." }, 405);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return jsonResponse({ ok: false, error: "Sessão não informada." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse(
      { ok: false, error: "Configuração administrativa incompleta no servidor." },
      500,
    );
  }

  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = asObject(await request.json());
    const organizationId = stringField(body, "organization_id");
    const requestedUserId = stringField(body, "user_id");
    const fullName = stringField(body, "full_name");
    const email = stringField(body, "email").toLowerCase();
    const roleCode = stringField(body, "role_code");
    const status = stringField(body, "status") || "active";
    const pipelineIds = stringArrayField(body, "pipeline_ids");

    if (!organizationId || !fullName || !email || !roleCode) {
      return jsonResponse(
        { ok: false, error: "Empresa, nome, e-mail e perfil são obrigatórios." },
        400,
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ ok: false, error: "E-mail inválido." }, 400);
    }
    if (!["active", "disabled", "invited"].includes(status)) {
      return jsonResponse({ ok: false, error: "Status de usuário inválido." }, 400);
    }

    const { data: contextData, error: contextError } = await callerClient.rpc(
      "get_my_crm_context",
    );
    if (contextError) throw contextError;

    const context = asObject(contextData);
    const currentUser = asObject(context.user);
    const memberships = Array.isArray(context.memberships)
      ? context.memberships.map(asObject)
      : [];
    const targetMembership = memberships.find((item) => {
      const organization = asObject(item.organization);
      return organization.id === organizationId;
    });
    const permissions = targetMembership && Array.isArray(targetMembership.permissions)
      ? targetMembership.permissions.filter((item): item is string => typeof item === "string")
      : [];
    const targetRole = targetMembership ? asObject(targetMembership.role) : {};
    const canManage =
      currentUser.is_platform_admin === true ||
      targetRole.code === "super_admin" ||
      permissions.includes("users.manage");

    if (!canManage) {
      return jsonResponse(
        { ok: false, error: "Você não possui permissão para administrar usuários desta empresa." },
        403,
      );
    }

    const { data: role, error: roleError } = await adminClient
      .from("roles")
      .select("id,code")
      .eq("organization_id", organizationId)
      .eq("code", roleCode)
      .maybeSingle();
    if (roleError) throw roleError;
    if (!role) {
      return jsonResponse(
        { ok: false, error: "O perfil selecionado não existe nesta empresa." },
        400,
      );
    }

    let userId = requestedUserId;
    let invited = false;

    if (userId) {
      const { data: existingMembership, error: membershipLookupError } =
        await adminClient
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", organizationId)
          .eq("user_id", userId)
          .maybeSingle();
      if (membershipLookupError) throw membershipLookupError;
      if (!existingMembership) {
        return jsonResponse(
          { ok: false, error: "O usuário informado não pertence a esta empresa." },
          404,
        );
      }
    }

    if (!userId) {
      const { data: existingProfile, error: profileLookupError } = await adminClient
        .from("profiles")
        .select("id,is_platform_admin")
        .eq("email", email)
        .maybeSingle();
      if (profileLookupError) throw profileLookupError;

      if (existingProfile?.is_platform_admin === true && currentUser.is_platform_admin !== true) {
        return jsonResponse(
          { ok: false, error: "Este usuário somente pode ser gerenciado por um administrador da plataforma." },
          403,
        );
      }

      if (existingProfile?.id) {
        userId = existingProfile.id;
      } else {
        const redirectTo = Deno.env.get("CRM_INVITE_REDIRECT_URL") || undefined;
        const { data: inviteData, error: inviteError } =
          await adminClient.auth.admin.inviteUserByEmail(email, {
            data: { full_name: fullName },
            redirectTo,
          });
        if (inviteError) throw inviteError;
        userId = inviteData.user?.id || "";
        invited = true;
      }
    } else {
      const { data: targetProfile, error: targetProfileError } = await adminClient
        .from("profiles")
        .select("is_platform_admin")
        .eq("id", userId)
        .maybeSingle();
      if (targetProfileError) throw targetProfileError;
      if (targetProfile?.is_platform_admin === true && currentUser.is_platform_admin !== true) {
        return jsonResponse(
          { ok: false, error: "Este usuário somente pode ser gerenciado por um administrador da plataforma." },
          403,
        );
      }

      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
        userId,
        { email, user_metadata: { full_name: fullName } },
      );
      if (authUpdateError) throw authUpdateError;
    }

    if (!userId) {
      throw new Error("O Supabase Auth não confirmou o usuário.");
    }

    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: userId,
      email,
      full_name: fullName,
    });
    if (profileError) throw profileError;

    const { error: membershipError } = await adminClient
      .from("organization_members")
      .upsert(
        {
          organization_id: organizationId,
          user_id: userId,
          role_id: role.id,
          status,
        },
        { onConflict: "organization_id,user_id" },
      );
    if (membershipError) throw membershipError;

    const { error: clearAccessError } = await adminClient
      .from("pipeline_user_access")
      .delete()
      .eq("organization_id", organizationId)
      .eq("user_id", userId);
    if (clearAccessError) throw clearAccessError;

    if (pipelineIds.length) {
      const { data: validPipelines, error: pipelineError } = await adminClient
        .from("pipelines")
        .select("id")
        .eq("organization_id", organizationId)
        .in("id", pipelineIds);
      if (pipelineError) throw pipelineError;

      const rows = (validPipelines || []).map((pipeline) => ({
        organization_id: organizationId,
        user_id: userId,
        pipeline_id: pipeline.id,
        access_level: "operate",
        stage_scope: "all",
        created_by: typeof currentUser.id === "string" ? currentUser.id : null,
      }));
      if (rows.length) {
        const { error: accessError } = await adminClient
          .from("pipeline_user_access")
          .insert(rows);
        if (accessError) throw accessError;
      }
    }

    return jsonResponse({
      ok: true,
      user_id: userId,
      invited,
      membership_status: status,
    });
  } catch (error) {
    console.error("[admin-manage-crm-user]", error);
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Falha ao administrar usuário.",
      },
      500,
    );
  }
});
