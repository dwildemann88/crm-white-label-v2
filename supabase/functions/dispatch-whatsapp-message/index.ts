import { createClient } from "npm:@supabase/supabase-js@2";

const MEDIA_BUCKET = "crm-whatsapp-media";
const MEDIA_URL_TTL_SECONDS = 15 * 60;
const MAKE_TIMEOUT_MS = 90_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type OutboundMessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document";

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

function stringField(
  source: Record<string, unknown>,
  key: string,
): string {
  const value = source[key];

  return typeof value === "string"
    ? value.trim()
    : "";
}

function nullableStringField(
  source: Record<string, unknown>,
  key: string,
): string | null {
  const value = stringField(source, key);
  return value || null;
}

function parseMessageType(
  value: unknown,
): OutboundMessageType {
  if (
    value === "text" ||
    value === "image" ||
    value === "audio" ||
    value === "video" ||
    value === "document"
  ) {
    return value;
  }

  throw new Error(
    "O tipo da mensagem não é aceito pelo fluxo de despacho.",
  );
}

function findExternalMessageId(
  response: Record<string, unknown>,
): string | null {
  const value = response.external_message_id;

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized.startsWith("wamid.")) {
    return null;
  }

  return normalized;
}

async function registerFailure(
  adminClient: ReturnType<typeof createClient>,
  messageId: string,
  dispatchToken: string,
  errorMessage: string,
  providerResponse: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await adminClient.rpc(
    "fail_crm_outbound_message",
    {
      p_message_id: messageId,
      p_dispatch_token: dispatchToken,
      p_error_message: errorMessage,
      p_provider_response: providerResponse,
    },
  );

  if (error) {
    console.error(
      "Falha ao registrar erro de entrega:",
      error,
    );
  }
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
    Deno.env.get("MAKE_WHATSAPP_WEBHOOK_URL");

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
          "O segredo MAKE_WHATSAPP_WEBHOOK_URL não foi configurado.",
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
    stringField(requestBody, "message_id");

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
    "claim_crm_outbound_message",
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
    if (claim.reason === "already_dispatched") {
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
          "Esta mensagem já está em processo de envio.",
        reason:
          claim.reason ?? "dispatch_not_claimed",
      },
      409,
    );
  }

  const dispatchToken =
    stringField(claim, "dispatch_token");
  const organizationId =
    stringField(claim, "organization_id");
  const conversationId =
    stringField(claim, "conversation_id");
  const body = stringField(claim, "body");
  const caption = nullableStringField(
    claim,
    "caption",
  );
  const senderName =
    stringField(claim, "sender_name") || "Usuário";
  const rawPhone = stringField(claim, "to");

  let messageType: OutboundMessageType;

  try {
    messageType = parseMessageType(
      claim.message_type,
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Tipo de mensagem inválido.";

    await registerFailure(
      adminClient,
      messageId,
      dispatchToken,
      errorMessage,
    );

    return jsonResponse({
      ok: false,
      message_id: messageId,
      error: errorMessage,
    });
  }

  let destination: string;

  try {
    destination = normalizeWhatsAppPhone(
      rawPhone,
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Telefone inválido.";

    await registerFailure(
      adminClient,
      messageId,
      dispatchToken,
      errorMessage,
    );

    return jsonResponse({
      ok: false,
      message_id: messageId,
      error: errorMessage,
    });
  }

  let mediaUrl: string | null = null;
  let mimeType: string | null = null;
  let fileName: string | null = null;

  if (messageType !== "text") {
    const mediaBucket =
      stringField(claim, "media_bucket");
    const mediaStoragePath =
      stringField(
        claim,
        "media_storage_path",
      );

    mimeType = nullableStringField(
      claim,
      "mime_type",
    );
    fileName = nullableStringField(
      claim,
      "file_name",
    );

    if (
      mediaBucket !== MEDIA_BUCKET ||
      !mediaStoragePath ||
      !mimeType ||
      !fileName
    ) {
      const errorMessage =
        "Os dados da mídia estão incompletos para o despacho.";

      await registerFailure(
        adminClient,
        messageId,
        dispatchToken,
        errorMessage,
      );

      return jsonResponse({
        ok: false,
        message_id: messageId,
        error: errorMessage,
      });
    }

    const {
      data: signedData,
      error: signedError,
    } = await adminClient.storage
      .from(mediaBucket)
      .createSignedUrl(
        mediaStoragePath,
        MEDIA_URL_TTL_SECONDS,
      );

    if (
      signedError ||
      !signedData?.signedUrl
    ) {
      const errorMessage =
        "Não foi possível liberar temporariamente o arquivo para envio: " +
        (signedError?.message ?? "URL assinada ausente.");

      await registerFailure(
        adminClient,
        messageId,
        dispatchToken,
        errorMessage,
      );

      return jsonResponse({
        ok: false,
        message_id: messageId,
        error: errorMessage,
      });
    }

    mediaUrl = signedData.signedUrl;
  }

  const makePayload = {
    message_id: messageId,
    organization_id: organizationId,
    conversation_id: conversationId,
    to: destination,
    body,
    caption,
    message_type: messageType,
    sender_name: senderName,
    media_url: mediaUrl,
    mime_type: mimeType,
    file_name: fileName,
  };

  const abortController =
    new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    MAKE_TIMEOUT_MS,
  );

  let providerResponse: Record<string, unknown> = {};

  try {
    const response = await fetch(
      makeWebhookUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(makePayload),
        signal: abortController.signal,
      },
    );

    const responseText = await response.text();

    if (responseText.trim()) {
      try {
        providerResponse = asObject(
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
        typeof providerResponse.error === "string"
          ? providerResponse.error
          : `O Make retornou HTTP ${response.status}.`;

      await registerFailure(
        adminClient,
        messageId,
        dispatchToken,
        providerError,
        providerResponse,
      );

      return jsonResponse({
        ok: false,
        message_id: messageId,
        error: providerError,
        provider_response: providerResponse,
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
        p_message_id: messageId,
        p_dispatch_token: dispatchToken,
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
          error: completionError.message,
        },
        500,
      );
    }

    return jsonResponse({
      ok: true,
      message_id: messageId,
      message_type: messageType,
      status: "sent",
      external_message_id:
        externalMessageId,
      warning:
        externalMessageId
          ? null
          : "O Make confirmou o envio, mas não retornou o ID externo da mensagem.",
      completion: completionData,
    });
  } catch (error) {
    const errorMessage =
      error instanceof DOMException &&
      error.name === "AbortError"
        ? "O envio excedeu o limite de 90 segundos."
        : error instanceof Error
          ? error.message
          : "Falha inesperada ao chamar o Make.";

    await registerFailure(
      adminClient,
      messageId,
      dispatchToken,
      errorMessage,
      providerResponse,
    );

    return jsonResponse({
      ok: false,
      message_id: messageId,
      error: errorMessage,
    });
  } finally {
    clearTimeout(timeout);
  }
});