import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(
  payload: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeWhatsAppPhone(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  if (digits.length >= 12 && digits.length <= 15) {
    return digits;
  }

  throw new Error(
    "O telefone do contato não possui um formato válido para o WhatsApp.",
  );
}

function asObject(value: unknown): Record<string, unknown> {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string",
    )
    .map((item) => item.trim())
    .filter(Boolean);
}

function findExternalMessageId(
  response: Record<string, unknown>,
): string | null {
  const value =
    response.external_message_id;

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (
    !normalized ||
    !normalized.startsWith("wamid.")
  ) {
    return null;
  }

  return normalized;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: "Método não permitido.",
      },
      405,
    );
  }

  const authorization =
    request.headers.get("Authorization");

  if (!authorization) {
    return jsonResponse(
      {
        ok: false,
        error: "Sessão não informada.",
      },
      401,
    );
  }

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL");

  const supabaseAnonKey =
    Deno.env.get("SUPABASE_ANON_KEY");

  const supabaseServiceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const makeWebhookUrl =
    Deno.env.get(
      "MAKE_WHATSAPP_TEMPLATE_WEBHOOK_URL",
    );

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !supabaseServiceRoleKey
  ) {
    return jsonResponse(
      {
        ok: false,
        error:
          "As credenciais internas do Supabase não estão disponíveis.",
      },
      500,
    );
  }

  if (!makeWebhookUrl) {
    return jsonResponse(
      {
        ok: false,
        error:
          "O segredo MAKE_WHATSAPP_TEMPLATE_WEBHOOK_URL não foi configurado.",
      },
      500,
    );
  }

  const userClient = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  const adminClient = createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse(
      {
        ok: false,
        error: "Sessão inválida ou expirada.",
      },
      401,
    );
  }

  let requestBody: Record<string, unknown>;

  try {
    requestBody = asObject(
      await request.json(),
    );
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: "O corpo da solicitação não é um JSON válido.",
      },
      400,
    );
  }

  const messageId =
    typeof requestBody.message_id === "string"
      ? requestBody.message_id.trim()
      : "";

  if (!messageId) {
    return jsonResponse(
      {
        ok: false,
        error: "O identificador da mensagem é obrigatório.",
      },
      400,
    );
  }

  const {
    data: claimData,
    error: claimError,
  } = await userClient.rpc(
    "claim_crm_outbound_template",
    {
      p_message_id: messageId,
    },
  );

  if (claimError) {
    return jsonResponse(
      {
        ok: false,
        error: claimError.message,
      },
      403,
    );
  }

  const claim = asObject(claimData);

  if (claim.claimed !== true) {
    if (
      claim.reason ===
      "already_dispatched"
    ) {
      return jsonResponse({
        ok: true,
        message_id: messageId,
        already_dispatched: true,
        status: claim.status ?? "sent",
      });
    }

    return jsonResponse(
      {
        ok: false,
        error:
          "Este template já está em processo de envio.",
        reason:
          claim.reason ??
          "dispatch_not_claimed",
      },
      409,
    );
  }

  const dispatchToken =
    typeof claim.dispatch_token === "string"
      ? claim.dispatch_token
      : "";

  const organizationId =
    typeof claim.organization_id === "string"
      ? claim.organization_id
      : "";

  const conversationId =
    typeof claim.conversation_id === "string"
      ? claim.conversation_id
      : "";

  const templateName =
    typeof claim.template_name === "string"
      ? claim.template_name
      : "";

  const languageCode =
    typeof claim.language_code === "string"
      ? claim.language_code
      : "";

  const parameters =
    asStringArray(
      claim.parameters,
    );

  const customerName =
    typeof claim.customer_name === "string"
      ? claim.customer_name.trim()
      : parameters[0] ?? "";

  const bodyPreview =
    typeof claim.body === "string"
      ? claim.body
      : "";

  const senderName =
    typeof claim.sender_name === "string"
      ? claim.sender_name
      : "Usuário";

  const rawPhone =
    typeof claim.to === "string"
      ? claim.to
      : "";

  if (
    !dispatchToken ||
    !templateName ||
    !languageCode ||
    !customerName ||
    parameters.length !== 1
  ) {
    const errorMessage =
      "Os dados reservados para o template estão incompletos.";

    await adminClient.rpc(
      "fail_crm_outbound_message",
      {
        p_message_id:
          messageId,
        p_dispatch_token:
          dispatchToken,
        p_error_message:
          errorMessage,
        p_provider_response: {},
      },
    );

    return jsonResponse(
      {
        ok: false,
        message_id: messageId,
        error: errorMessage,
      },
      500,
    );
  }

  let destination: string;

  try {
    destination =
      normalizeWhatsAppPhone(rawPhone);
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Telefone inválido.";

    await adminClient.rpc(
      "fail_crm_outbound_message",
      {
        p_message_id:
          messageId,
        p_dispatch_token:
          dispatchToken,
        p_error_message:
          errorMessage,
        p_provider_response: {},
      },
    );

    return jsonResponse({
      ok: false,
      message_id: messageId,
      error: errorMessage,
    });
  }

  const makePayload = {
    message_id: messageId,
    organization_id: organizationId,
    conversation_id: conversationId,
    to: destination,
    message_type: "template",
    template_name: templateName,
    language_code: languageCode,
    parameters,
    customer_name: customerName,
    body_preview: bodyPreview,
    sender_name: senderName,
  };

  const abortController =
    new AbortController();

  const timeout = setTimeout(
    () => abortController.abort(),
    30000,
  );

  let providerResponse: Record<string, unknown> =
    {};

  try {
    const response = await fetch(
      makeWebhookUrl,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(
          makePayload,
        ),
        signal:
          abortController.signal,
      },
    );

    const responseText =
      await response.text();

    if (responseText.trim()) {
      try {
        providerResponse =
          asObject(
            JSON.parse(responseText),
          );
      } catch {
        providerResponse = {
          raw_response:
            responseText.slice(0, 2000),
        };
      }
    }

    if (
      !response.ok ||
      providerResponse.ok === false
    ) {
      const providerError =
        typeof providerResponse.error ===
        "string"
          ? providerResponse.error
          : `O Make retornou HTTP ${response.status}.`;

      const { error: failError } =
        await adminClient.rpc(
          "fail_crm_outbound_message",
          {
            p_message_id:
              messageId,
            p_dispatch_token:
              dispatchToken,
            p_error_message:
              providerError,
            p_provider_response:
              providerResponse,
          },
        );

      if (failError) {
        console.error(
          "Falha ao registrar erro de entrega:",
          failError,
        );
      }

      return jsonResponse({
        ok: false,
        message_id: messageId,
        error: providerError,
        provider_response:
          providerResponse,
      });
    }

    const externalMessageId =
      findExternalMessageId(
        providerResponse,
      );

    const {
      data: completionData,
      error: completionError,
    } = await adminClient.rpc(
      "complete_crm_outbound_message",
      {
        p_message_id:
          messageId,
        p_dispatch_token:
          dispatchToken,
        p_external_message_id:
          externalMessageId,
        p_provider_response:
          providerResponse,
      },
    );

    if (completionError) {
      return jsonResponse(
        {
          ok: false,
          message_id: messageId,
          error:
            completionError.message,
        },
        500,
      );
    }

    return jsonResponse({
      ok: true,
      message_id: messageId,
      status: "sent",
      external_message_id:
        externalMessageId,
      warning:
        externalMessageId
          ? null
          : "O Make confirmou o envio, mas não retornou o wamid.",
      completion:
        completionData,
    });
  } catch (error) {
    const errorMessage =
      error instanceof DOMException &&
      error.name === "AbortError"
        ? "O envio excedeu o limite de 30 segundos."
        : error instanceof Error
          ? error.message
          : "Falha inesperada ao chamar o Make.";

    const { error: failError } =
      await adminClient.rpc(
        "fail_crm_outbound_message",
        {
          p_message_id:
            messageId,
          p_dispatch_token:
            dispatchToken,
          p_error_message:
            errorMessage,
          p_provider_response:
            providerResponse,
        },
      );

    if (failError) {
      console.error(
        "Falha ao registrar erro de entrega:",
        failError,
      );
    }

    return jsonResponse({
      ok: false,
      message_id: messageId,
      error: errorMessage,
    });
  } finally {
    clearTimeout(timeout);
  }
});