import { createClient } from "npm:@supabase/supabase-js@2";
import {
  asObject,
  asString,
  decryptCredential,
  encryptCredential,
  fetchPhoneNumberDetails,
  fetchWabaPhoneNumbers,
  normalizeGraphVersion,
  subscribeWaba,
} from "../_shared/whatsappCloud.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, error: "Método não permitido." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ ok: false, error: "Sessão não informada." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const credentialsKey = Deno.env.get("WHATSAPP_CREDENTIALS_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !credentialsKey) {
    return json({ ok: false, error: "Secrets internos da integração não configurados." }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ ok: false, error: "Sessão inválida ou expirada." }, 401);

  let body: Record<string, unknown>;
  try {
    body = asObject(await request.json());
  } catch {
    return json({ ok: false, error: "O corpo deve ser um JSON válido." }, 400);
  }

  const action = asString(body.action).toLowerCase();
  const organizationId = asString(body.organization_id);
  if (!organizationId) return json({ ok: false, error: "organization_id é obrigatório." }, 400);

  // Esta RPC não expõe credenciais e também funciona como verificação de permissão.
  const { error: permissionError } = await userClient.rpc(
    "list_crm_whatsapp_integrations",
    { p_organization_id: organizationId },
  );
  if (permissionError) return json({ ok: false, error: permissionError.message }, 403);

  const { data: existing, error: existingError } = await adminClient
    .from("crm_whatsapp_integrations")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (existingError) return json({ ok: false, error: existingError.message }, 500);

  if (action === "disconnect") {
    const { data, error } = await userClient.rpc(
      "disconnect_crm_whatsapp_integration",
      { p_organization_id: organizationId },
    );
    if (error) return json({ ok: false, error: error.message }, 400);
    return json({ ok: true, result: data });
  }

  if (action !== "save" && action !== "test") {
    return json({ ok: false, error: "Ação inválida." }, 400);
  }

  const wabaId = action === "save" ? asString(body.waba_id) : asString(existing?.waba_id);
  const phoneNumberId = action === "save"
    ? asString(body.phone_number_id)
    : asString(existing?.phone_number_id);
  const requestedToken = asString(body.access_token);
  const graphVersion = normalizeGraphVersion(
    action === "save" ? body.graph_api_version : existing?.graph_api_version,
  );

  if (!wabaId || !/^\d+$/.test(wabaId)) {
    return json({ ok: false, error: "Informe um WABA ID numérico válido." }, 422);
  }
  if (!phoneNumberId || !/^\d+$/.test(phoneNumberId)) {
    return json({ ok: false, error: "Informe um Phone Number ID numérico válido." }, 422);
  }

  let accessToken = requestedToken;
  if (!accessToken && existing?.access_token_ciphertext) {
    try {
      accessToken = await decryptCredential(
        String(existing.access_token_ciphertext),
        credentialsKey,
      );
    } catch (error) {
      return json({
        ok: false,
        error: error instanceof Error ? error.message : "Não foi possível abrir a credencial armazenada.",
      }, 500);
    }
  }
  if (!accessToken) {
    return json({ ok: false, error: "Informe o token de acesso da WhatsApp Cloud API." }, 422);
  }

  let details: Record<string, unknown>;
  try {
    const phoneNumbers = await fetchWabaPhoneNumbers(wabaId, accessToken, graphVersion);
    const matchingPhone = phoneNumbers.find((item) => asString(item.id) === phoneNumberId);
    if (!matchingPhone) {
      throw new Error("O Phone Number ID não pertence à WABA informada.");
    }

    // A consulta individual confirma que o token também possui acesso operacional ao número.
    details = await fetchPhoneNumberDetails(phoneNumberId, accessToken, graphVersion);

    if (action === "save") {
      // Uma inscrição por WABA cobre todos os números associados a ela.
      await subscribeWaba(wabaId, accessToken, graphVersion);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "A Meta recusou a credencial informada.";
    if (existing?.id) {
      await adminClient
        .from("crm_whatsapp_integrations")
        .update({ status: "attention", last_error: message, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    }
    return json({ ok: false, error: message }, 422);
  }

  const displayPhoneNumber = asString(details.display_phone_number) || asString(body.display_phone_number);
  const verifiedName = asString(details.verified_name);
  const qualityRating = asString(details.quality_rating);

  if (action === "save") {
    const encryptedToken = requestedToken
      ? await encryptCredential(accessToken, credentialsKey)
      : null;
    const tokenLastFour = accessToken.slice(-4);

    const { data, error } = await userClient.rpc(
      "upsert_crm_whatsapp_integration",
      {
        p_organization_id: organizationId,
        p_waba_id: wabaId,
        p_phone_number_id: phoneNumberId,
        p_display_phone_number: displayPhoneNumber,
        p_verified_name: verifiedName,
        p_quality_rating: qualityRating,
        p_graph_api_version: graphVersion,
        p_access_token_ciphertext: encryptedToken,
        p_token_last_four: tokenLastFour,
      },
    );
    if (error) return json({ ok: false, error: error.message }, 400);
    return json({ ok: true, result: data, phone: details });
  }

  const { data, error } = await userClient.rpc(
    "mark_crm_whatsapp_integration_test",
    {
      p_organization_id: organizationId,
      p_display_phone_number: displayPhoneNumber,
      p_verified_name: verifiedName,
      p_quality_rating: qualityRating,
    },
  );
  if (error) return json({ ok: false, error: error.message }, 400);

  return json({ ok: true, result: data, phone: details });
});
