import { createClient } from "npm:@supabase/supabase-js@2";

const MEDIA_BUCKET =
  "crm-whatsapp-media";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

type MediaType =
  | "image"
  | "audio"
  | "video"
  | "document";

interface MediaDescriptor {
  messageType: MediaType;
  mimeType: string;
  maxBytes: number;
}

const limits: Record<
  MediaType,
  number
> = {
  image: 5 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  document: 20 * 1024 * 1024,
};

const mimeTypes: Record<
  MediaType,
  Set<string>
> = {
  image: new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]),
  audio: new Set([
    "audio/aac",
    "audio/amr",
    "audio/mpeg",
    "audio/mp4",
    "audio/ogg",
  ]),
  video: new Set([
    "video/mp4",
    "video/3gpp",
  ]),
  document: new Set([
    "text/plain",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ]),
};

function jsonResponse(
  payload: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(payload),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json",
      },
    },
  );
}

function asObject(
  value: unknown,
): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<
      string,
      unknown
    >;
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

function integerField(
  source: Record<string, unknown>,
  key: string,
): number {
  const value = source[key];

  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value)
  ) {
    return 0;
  }

  return value;
}

function describeMedia(
  mimeType: string,
  sizeBytes: number,
): MediaDescriptor {
  const normalizedMimeType =
    mimeType
      .split(";")[0]
      .trim()
      .toLowerCase();

  const messageType = (
    Object.entries(
      mimeTypes,
    ) as Array<
      [MediaType, Set<string>]
    >
  ).find(([, accepted]) =>
    accepted.has(
      normalizedMimeType,
    ),
  )?.[0];

  if (!messageType) {
    throw new Error(
      "Este formato de arquivo não é aceito para envio pelo WhatsApp.",
    );
  }

  const maxBytes =
    limits[messageType];

  if (
    sizeBytes <= 0 ||
    sizeBytes > maxBytes
  ) {
    const maxMegabytes =
      Math.floor(
        maxBytes /
          (1024 * 1024),
      );

    throw new Error(
      `O arquivo excede o limite inicial de ${maxMegabytes} MB para este tipo de mídia.`,
    );
  }

  return {
    messageType,
    mimeType:
      normalizedMimeType,
    maxBytes,
  };
}

function sanitizeFileName(
  value: string,
): string {
  const trimmed =
    value.trim();

  const baseName =
    trimmed
      .replace(/\\/g, "/")
      .split("/")
      .pop() ||
    "arquivo";

  const sanitized =
    baseName
      .normalize("NFKD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .replace(
        /[^A-Za-z0-9._-]+/g,
        "-",
      )
      .replace(
        /-+/g,
        "-",
      )
      .replace(
        /^[-.]+|[-.]+$/g,
        "",
      )
      .slice(0, 160);

  return sanitized ||
    "arquivo";
}

Deno.serve(async (request) => {
  if (
    request.method === "OPTIONS"
  ) {
    return new Response(
      "ok",
      {
        headers:
          corsHeaders,
      },
    );
  }

  if (
    request.method !== "POST"
  ) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Método não permitido.",
      },
      405,
    );
  }

  const authorization =
    request.headers.get(
      "Authorization",
    );

  if (!authorization) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Sessão não informada.",
      },
      401,
    );
  }

  const supabaseUrl =
    Deno.env.get(
      "SUPABASE_URL",
    );

  const supabaseAnonKey =
    Deno.env.get(
      "SUPABASE_ANON_KEY",
    );

  const serviceRoleKey =
    Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !serviceRoleKey
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

  const userClient =
    createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization:
              authorization,
          },
        },
        auth: {
          persistSession:
            false,
          autoRefreshToken:
            false,
          detectSessionInUrl:
            false,
        },
      },
    );

  const adminClient =
    createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession:
            false,
          autoRefreshToken:
            false,
          detectSessionInUrl:
            false,
        },
      },
    );

  const {
    data: {
      user,
    },
    error: userError,
  } =
    await userClient.auth
      .getUser();

  if (
    userError ||
    !user
  ) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Sessão inválida ou expirada.",
      },
      401,
    );
  }

  let body: Record<
    string,
    unknown
  >;

  try {
    body = asObject(
      await request.json(),
    );
  } catch {
    return jsonResponse(
      {
        ok: false,
        error:
          "O corpo da solicitação não é um JSON válido.",
      },
      400,
    );
  }

  const organizationId =
    stringField(
      body,
      "organization_id",
    );

  const conversationId =
    stringField(
      body,
      "conversation_id",
    );

  const originalFileName =
    stringField(
      body,
      "file_name",
    );

  const requestedMimeType =
    stringField(
      body,
      "mime_type",
    );

  const sizeBytes =
    integerField(
      body,
      "size_bytes",
    );

  const caption =
    stringField(
      body,
      "caption",
    );

  if (
    !organizationId ||
    !conversationId ||
    !originalFileName ||
    !requestedMimeType
  ) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Os dados do arquivo estão incompletos.",
      },
      400,
    );
  }

  if (
    caption.length > 1024
  ) {
    return jsonResponse(
      {
        ok: false,
        error:
          "A legenda deve possuir no máximo 1024 caracteres.",
      },
      400,
    );
  }

  let descriptor:
    MediaDescriptor;

  try {
    descriptor =
      describeMedia(
        requestedMimeType,
        sizeBytes,
      );
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Arquivo inválido.",
      },
      400,
    );
  }

  if (
    descriptor.messageType ===
      "audio" &&
    caption
  ) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Áudios não aceitam legenda nesta etapa.",
      },
      400,
    );
  }

  const messageId =
    crypto.randomUUID();

  const fileName =
    sanitizeFileName(
      originalFileName,
    );

  const storagePath = [
    organizationId,
    conversationId,
    messageId,
    fileName,
  ].join("/");

  const {
    data: queueData,
    error: queueError,
  } = await userClient.rpc(
    "queue_crm_whatsapp_media",
    {
      p_organization_id:
        organizationId,
      p_conversation_id:
        conversationId,
      p_message_id:
        messageId,
      p_message_type:
        descriptor.messageType,
      p_body:
        caption || null,
      p_mime_type:
        descriptor.mimeType,
      p_file_name:
        fileName,
      p_size_bytes:
        sizeBytes,
      p_storage_path:
        storagePath,
    },
  );

  if (queueError) {
    return jsonResponse(
      {
        ok: false,
        error:
          queueError.message,
      },
      403,
    );
  }

  const queue =
    asObject(
      queueData,
    );

  if (
    queue.queued !== true ||
    queue.message_id !==
      messageId ||
    queue.storage_path !==
      storagePath
  ) {
    return jsonResponse(
      {
        ok: false,
        error:
          "O banco não confirmou a preparação da mídia.",
      },
      500,
    );
  }

  const {
    data: signedUpload,
    error:
      signedUploadError,
  } =
    await adminClient.storage
      .from(MEDIA_BUCKET)
      .createSignedUploadUrl(
        storagePath,
        {
          upsert: false,
        },
      );

  if (
    signedUploadError ||
    !signedUpload?.token
  ) {
    await userClient.rpc(
      "fail_crm_whatsapp_media_upload",
      {
        p_organization_id:
          organizationId,
        p_message_id:
          messageId,
        p_error_message:
          signedUploadError
            ?.message ||
          "Não foi possível criar a autorização temporária de upload.",
      },
    );

    return jsonResponse(
      {
        ok: false,
        message_id:
          messageId,
        error:
          signedUploadError
            ?.message ||
          "Não foi possível criar a autorização temporária de upload.",
      },
      500,
    );
  }

  return jsonResponse({
    ok: true,
    message_id:
      messageId,
    conversation_id:
      conversationId,
    message_type:
      descriptor.messageType,
    bucket:
      MEDIA_BUCKET,
    storage_path:
      storagePath,
    upload_token:
      signedUpload.token,
    mime_type:
      descriptor.mimeType,
    file_name:
      fileName,
    size_bytes:
      sizeBytes,
    status:
      "queued",
  });
});