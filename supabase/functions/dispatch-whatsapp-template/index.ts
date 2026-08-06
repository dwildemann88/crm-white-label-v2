import { createClient } from "npm:@supabase/supabase-js@2";
import {
  asObject,
  asString,
  decryptCredential,
  graphUrl,
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

function normalizeWhatsAppPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length >= 12 && digits.length <= 15) return digits;
  throw new Error("O telefone do contato não possui um formato válido para o WhatsApp.");
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim())
    : [];
}

function externalMessageId(payload: Record<string, unknown>): string | null {
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const id = asString(asObject(messages[0]).id);
  return id.startsWith("wamid.") ? id : null;
}

async function fail(
  adminClient: ReturnType<typeof createClient>,
  messageId: string,
  dispatchToken: string,
  organizationId: string,
  message: string,
  providerResponse: Record<string, unknown> = {},
): Promise<void> {
  await adminClient.rpc("fail_crm_outbound_message", {
    p_message_id: messageId,
    p_dispatch_token: dispatchToken,
    p_error_message: message,
    p_provider_response: providerResponse,
  });
  await adminClient.rpc("mark_crm_whatsapp_direct_transport", {
    p_organization_id: organizationId,
    p_message_id: messageId,
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, error: "Método não permitido." }, 405);

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const credentialsKey = Deno.env.get("WHATSAPP_CREDENTIALS_KEY");
  if (!authorization) return json({ ok: false, error: "Sessão não informada." }, 401);
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

  let requestBody: Record<string, unknown>;
  try {
    requestBody = asObject(await request.json());
  } catch {
    return json({ ok: false, error: "O corpo deve ser um JSON válido." }, 400);
  }

  const messageId = asString(requestBody.message_id);
  if (!messageId) return json({ ok: false, error: "O identificador da mensagem é obrigatório." }, 400);

  const { data: claimData, error: claimError } = await userClient.rpc(
    "claim_crm_outbound_template",
    { p_message_id: messageId },
  );
  if (claimError) return json({ ok: false, error: claimError.message }, 403);

  const claim = asObject(claimData);
  if (claim.claimed !== true) {
    if (claim.reason === "already_dispatched") {
      return json({ ok: true, message_id: messageId, already_dispatched: true, status: claim.status ?? "sent" });
    }
    return json({ ok: false, error: "Este template já está em processo de envio." }, 409);
  }

  const dispatchToken = asString(claim.dispatch_token);
  const organizationId = asString(claim.organization_id);
  const templateName = asString(claim.template_name);
  const languageCode = asString(claim.language_code);
  const parameters = stringArray(claim.parameters);
  let destination: string;
  try {
    destination = normalizeWhatsAppPhone(asString(claim.to));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telefone inválido.";
    await fail(adminClient, messageId, dispatchToken, organizationId, message);
    return json({ ok: false, message_id: messageId, error: message }, 422);
  }

  const { data: integration, error: integrationError } = await adminClient
    .from("crm_whatsapp_integrations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .maybeSingle();
  if (integrationError || !integration) {
    const message = integrationError?.message || "A empresa não possui um WhatsApp Cloud API ativo.";
    await fail(adminClient, messageId, dispatchToken, organizationId, message);
    return json({ ok: false, message_id: messageId, error: message }, 422);
  }

  let accessToken: string;
  try {
    accessToken = await decryptCredential(String(integration.access_token_ciphertext), credentialsKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao abrir a credencial do WhatsApp.";
    await fail(adminClient, messageId, dispatchToken, organizationId, message);
    return json({ ok: false, message_id: messageId, error: message }, 500);
  }

  const components = parameters.length > 0
    ? [{
        type: "body",
        parameters: parameters.map((text) => ({ type: "text", text })),
      }]
    : undefined;

  const graphPayload = {
    messaging_product: "whatsapp",
    to: destination,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components ? { components } : {}),
    },
  };

  let providerResponse: Record<string, unknown> = {};
  try {
    const response = await fetch(
      graphUrl(integration.graph_api_version || "v25.0", `${integration.phone_number_id}/messages`),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(graphPayload),
      },
    );
    providerResponse = asObject(await response.json().catch(() => ({})));
    if (!response.ok) {
      const errorObject = asObject(providerResponse.error);
      const message = asString(errorObject.message) || `A Meta retornou HTTP ${response.status}.`;
      await fail(adminClient, messageId, dispatchToken, organizationId, message, providerResponse);
      return json({ ok: false, message_id: messageId, error: message, provider_response: providerResponse }, 422);
    }

    const wamid = externalMessageId(providerResponse);
    const { data: completion, error: completionError } = await adminClient.rpc(
      "complete_crm_outbound_message",
      {
        p_message_id: messageId,
        p_dispatch_token: dispatchToken,
        p_external_message_id: wamid,
        p_provider_response: providerResponse,
      },
    );
    if (completionError) return json({ ok: false, message_id: messageId, error: completionError.message }, 500);

    await adminClient.rpc("mark_crm_whatsapp_direct_transport", {
      p_organization_id: organizationId,
      p_message_id: messageId,
    });

    await adminClient.from("crm_whatsapp_integrations").update({
      status: "connected",
      last_message_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", integration.id);

    return json({ ok: true, message_id: messageId, status: "sent", external_message_id: wamid, completion });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha inesperada ao chamar a Meta.";
    await fail(adminClient, messageId, dispatchToken, organizationId, message, providerResponse);
    return json({ ok: false, message_id: messageId, error: message }, 500);
  }
});
