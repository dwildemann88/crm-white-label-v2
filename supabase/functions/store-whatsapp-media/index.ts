import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET_NAME =
  "crm-whatsapp-media";

const MAX_FILE_SIZE_BYTES =
  100 * 1024 * 1024;

const jsonHeaders = {
  "Content-Type": "application/json",
};

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
    return value as Record<
      string,
      unknown
    >;
  }

  return {};
}

function asTrimmedString(
  value: FormDataEntryValue | null,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function extensionFromMimeType(
  mimeType: string,
): string {
  const extensionByMimeType:
    Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "audio/ogg": "ogg",
      "audio/mpeg": "mp3",
      "audio/mp4": "m4a",
      "audio/aac": "aac",
      "video/mp4": "mp4",
      "video/3gpp": "3gp",
      "application/pdf": "pdf",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",
      "application/vnd.ms-excel":
        "xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        "xlsx",
    };

  return extensionByMimeType[
    mimeType.toLowerCase()
  ] ?? "bin";
}

function sanitizeFileName(
  value: string,
  mimeType: string,
  messageType: string,
): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^a-zA-Z0-9._-]+/g,
      "-",
    )
    .replace(
      /^[-_.]+|[-_.]+$/g,
      "",
    )
    .slice(0, 120);

  const fallback =
    `${messageType || "arquivo"}-${
      Date.now()
    }`;

  const baseName =
    cleaned || fallback;

  if (
    /\.[a-zA-Z0-9]{1,10}$/.test(
      baseName,
    )
  ) {
    return baseName;
  }

  return `${baseName}.${
    extensionFromMimeType(
      mimeType,
    )
  }`;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return response(
      {
        ok: false,
        error:
          "Método não permitido.",
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
    receivedSecret !==
      configuredSecret
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
    Deno.env.get(
      "SUPABASE_URL",
    );

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

  let formData: FormData;

  try {
    formData =
      await request.formData();
  } catch {
    return response(
      {
        ok: false,
        error:
          "O corpo deve ser multipart/form-data.",
      },
      400,
    );
  }

  const externalMessageId =
    asTrimmedString(
      formData.get(
        "external_message_id",
      ),
    );

  const requestedMimeType =
    asTrimmedString(
      formData.get(
        "mime_type",
      ),
    );

  const requestedFileName =
    asTrimmedString(
      formData.get(
        "file_name",
      ),
    );

  const filePart =
    formData.get("file");

  if (!externalMessageId) {
    return response(
      {
        ok: false,
        error:
          "external_message_id é obrigatório.",
      },
      400,
    );
  }

  if (!(filePart instanceof File)) {
    return response(
      {
        ok: false,
        error:
          "O campo file não contém um arquivo válido.",
      },
      400,
    );
  }

  if (
    filePart.size <= 0 ||
    filePart.size >
      MAX_FILE_SIZE_BYTES
  ) {
    return response(
      {
        ok: false,
        error:
          "O arquivo está vazio ou ultrapassa o limite de 100 MB.",
      },
      400,
    );
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
    data: message,
    error: messageError,
  } = await supabaseAdmin
    .from("messages")
    .select(
      [
        "id",
        "organization_id",
        "conversation_id",
        "direction",
        "message_type",
        "external_media_id",
        "media_storage_path",
        "mime_type",
        "file_name",
        "metadata",
      ].join(","),
    )
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "external_message_id",
      externalMessageId,
    )
    .maybeSingle();

  if (messageError) {
    console.error(
      "Falha ao localizar mensagem:",
      messageError,
    );

    return response(
      {
        ok: false,
        error:
          messageError.message,
      },
      500,
    );
  }

  if (!message) {
    return response(
      {
        ok: false,
        error:
          "Mensagem de mídia não encontrada.",
      },
      404,
    );
  }

  if (
    message.direction !== "inbound" ||
    ![
      "image",
      "audio",
      "video",
      "document",
    ].includes(
      message.message_type,
    )
  ) {
    return response(
      {
        ok: false,
        error:
          "A mensagem localizada não é uma mídia recebida.",
      },
      400,
    );
  }

  const mimeType =
    filePart.type ||
    requestedMimeType ||
    message.mime_type ||
    "application/octet-stream";

  const fileName =
    sanitizeFileName(
      requestedFileName ||
        filePart.name ||
        message.file_name ||
        "",
      mimeType,
      message.message_type,
    );

  const storagePath = [
    organizationId,
    message.conversation_id,
    message.id,
    fileName,
  ].join("/");

  let fileBuffer: ArrayBuffer;

  try {
    fileBuffer =
      await filePart.arrayBuffer();
  } catch {
    return response(
      {
        ok: false,
        error:
          "Não foi possível ler o arquivo recebido.",
      },
      400,
    );
  }

  const {
    error: uploadError,
  } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(
      storagePath,
      fileBuffer,
      {
        contentType:
          mimeType,
        cacheControl:
          "3600",
        upsert:
          true,
      },
    );

  if (uploadError) {
    console.error(
      "Falha ao armazenar mídia:",
      uploadError,
    );

    return response(
      {
        ok: false,
        error:
          uploadError.message,
      },
      500,
    );
  }

  const currentMetadata =
    asObject(
      message.metadata,
    );

  const currentMediaMetadata =
    asObject(
      currentMetadata.media,
    );

  const storedAt =
    new Date().toISOString();

  const nextMetadata = {
    ...currentMetadata,
    media: {
      ...currentMediaMetadata,
      id:
        message.external_media_id ??
        currentMediaMetadata.id,
      mime_type:
        mimeType,
      file_name:
        fileName,
      download_status:
        "stored",
      storage_bucket:
        BUCKET_NAME,
      storage_path:
        storagePath,
      size_bytes:
        filePart.size,
      stored_at:
        storedAt,
    },
  };

  const {
    error: updateError,
  } = await supabaseAdmin
    .from("messages")
    .update({
      media_storage_path:
        storagePath,
      mime_type:
        mimeType,
      file_name:
        fileName,
      metadata:
        nextMetadata,
    })
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "id",
      message.id,
    );

  if (updateError) {
    console.error(
      "Falha ao vincular mídia à mensagem:",
      updateError,
    );

    await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([
        storagePath,
      ]);

    return response(
      {
        ok: false,
        error:
          updateError.message,
      },
      500,
    );
  }

  return response({
    ok: true,
    result: {
      message_id:
        message.id,
      external_message_id:
        externalMessageId,
      bucket:
        BUCKET_NAME,
      storage_path:
        storagePath,
      mime_type:
        mimeType,
      file_name:
        fileName,
      size_bytes:
        filePart.size,
      stored_at:
        storedAt,
    },
  });
});