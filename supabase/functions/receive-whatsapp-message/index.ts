import { createClient } from "npm:@supabase/supabase-js@2";

const jsonHeaders = {
  "Content-Type": "application/json",
};

const acceptedMessageTypes = new Set([
  "text",
  "image",
  "audio",
  "video",
  "document",
  "location",
  "contact",
  "interactive",
]);

const mediaMessageTypes = new Set([
  "image",
  "audio",
  "video",
  "document",
]);

function response(
  payload: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(payload),
    {
      status,
      headers: jsonHeaders,
    },
  );
}

function asObject(
  value: unknown,
): Record<string, unknown> {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asTrimmedString(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function compactObject(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => {
      if (item === null || item === undefined || item === "") {
        return false;
      }

      return true;
    }),
  );
}

function normalizeMessageType(
  value: unknown,
): string {
  const rawType = asTrimmedString(value).toLowerCase();

  // Respostas rápidas de templates podem chegar como "button".
  // O banco já trata esse conteúdo como mensagem interativa.
  if (rawType === "button") {
    return "interactive";
  }

  return acceptedMessageTypes.has(rawType)
    ? rawType
    : "text";
}

function fallbackBody(
  messageType: string,
  explicitBody: string,
  media: Record<string, unknown>,
): string | null {
  if (explicitBody) {
    return explicitBody;
  }

  const caption = asTrimmedString(media.caption);
  const fileName = asTrimmedString(media.file_name);

  if (caption) {
    return caption;
  }

  switch (messageType) {
    case "image":
      return "Imagem recebida";
    case "audio":
      return "Áudio recebido";
    case "video":
      return "Vídeo recebido";
    case "document":
      return fileName || "Documento recebido";
    case "interactive":
      return "Resposta interativa recebida";
    case "location":
      return "Localização recebida";
    case "contact":
      return "Contato recebido";
    default:
      return null;
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return response(
      {
        ok: false,
        error: "Método não permitido.",
      },
      405,
    );
  }

  const configuredSecret =
    Deno.env.get(
      "WHATSAPP_INBOUND_SECRET",
    );

  const receivedSecret =
    request.headers.get(
      "x-webhook-secret",
    );

  if (
    !configuredSecret ||
    !receivedSecret ||
    receivedSecret !== configuredSecret
  ) {
    return response(
      {
        ok: false,
        error:
          "A solicitação não possui autorização válida.",
      },
      401,
    );
  }

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL");

  const serviceRoleKey =
    Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

  const organizationId =
    Deno.env.get(
      "PROJEM_ORGANIZATION_ID",
    );

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    !organizationId
  ) {
    return response(
      {
        ok: false,
        error:
          "A função não possui todos os secrets necessários.",
      },
      500,
    );
  }

  let payload: Record<string, unknown>;

  try {
    payload = asObject(
      await request.json(),
    );
  } catch {
    return response(
      {
        ok: false,
        error:
          "O corpo da solicitação não é um JSON válido.",
      },
      400,
    );
  }

  const externalMessageId =
    asTrimmedString(
      payload.external_message_id,
    );

  const externalContactId =
    asTrimmedString(
      payload.external_contact_id,
    );

  if (
    !externalMessageId ||
    !externalContactId
  ) {
    return response(
      {
        ok: false,
        error:
          "external_message_id e external_contact_id são obrigatórios.",
      },
      400,
    );
  }

  const rawMessageType =
    asTrimmedString(
      payload.message_type,
    ).toLowerCase();

  const messageType =
    normalizeMessageType(
      payload.message_type,
    );

  const rawMedia =
    asObject(payload.media);

  const media = compactObject({
    id: asTrimmedString(rawMedia.id),
    mime_type: asTrimmedString(
      rawMedia.mime_type,
    ),
    sha256: asTrimmedString(
      rawMedia.sha256,
    ),
    file_name: asTrimmedString(
      rawMedia.file_name,
    ),
    caption: asTrimmedString(
      rawMedia.caption,
    ),
    voice:
      typeof rawMedia.voice === "boolean"
        ? rawMedia.voice
        : asTrimmedString(rawMedia.voice) === "true"
          ? true
          : asTrimmedString(rawMedia.voice) === "false"
            ? false
            : undefined,
  });

  if (
    mediaMessageTypes.has(messageType) &&
    !asTrimmedString(media.id)
  ) {
    return response(
      {
        ok: false,
        error:
          `A mensagem ${messageType} não possui media.id.`,
      },
      400,
    );
  }

  const explicitBody =
    asTrimmedString(payload.body);

  const body = fallbackBody(
    messageType,
    explicitBody,
    media,
  );

  const sentAtValue =
    typeof payload.sent_at === "string"
      ? payload.sent_at
      : null;

  const sentAt =
    sentAtValue &&
    !Number.isNaN(
      new Date(sentAtValue).getTime(),
    )
      ? new Date(
          sentAtValue,
        ).toISOString()
      : new Date().toISOString();

  const incomingMetadata =
    asObject(payload.metadata);

  const enrichedMetadata: Record<string, unknown> = {
    ...incomingMetadata,
    original_message_type:
      rawMessageType || "text",
  };

  if (Object.keys(media).length > 0) {
    enrichedMetadata.media = {
      ...media,
      download_status: "pending",
    };
  }

  const supabaseAdmin =
    createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );

  const {
    data,
    error,
  } = await supabaseAdmin.rpc(
    "ingest_crm_whatsapp_message",
    {
      p_organization_id:
        organizationId,

      p_external_account_id:
        typeof payload
          .external_account_id ===
          "string"
          ? payload.external_account_id
          : null,

      p_external_contact_id:
        externalContactId,

      p_external_message_id:
        externalMessageId,

      p_contact_name:
        typeof payload
          .contact_name === "string"
          ? payload.contact_name
          : null,

      p_message_type:
        messageType,

      p_body:
        body,

      p_sent_at:
        sentAt,

      p_metadata:
        enrichedMetadata,
    },
  );

  if (error) {
    console.error(
      "Falha ao registrar mensagem recebida:",
      error,
    );

    return response(
      {
        ok: false,
        error: error.message,
      },
      400,
    );
  }

  return response({
    ok: true,
    result: data,
    inbound: {
      message_type: messageType,
      has_media:
        Object.keys(media).length > 0,
      media_download_status:
        Object.keys(media).length > 0
          ? "pending"
          : null,
    },
  });
});