import { createClient } from "npm:@supabase/supabase-js@2";
import {
  asObject,
  asString,
  decryptCredential,
  graphUrl,
  unixTimestampToIso,
} from "../_shared/whatsappCloud.ts";

const MEDIA_BUCKET = "crm-whatsapp-media";

function json(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifySignature(
  rawBody: string,
  signatureHeader: string,
  appSecret: string,
): Promise<boolean> {
  if (!signatureHeader.startsWith("sha256=")) return false;
  const expected = signatureHeader.slice("sha256=".length).toLowerCase();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  const actual = toHex(signature);
  if (actual.length !== expected.length) return false;

  let mismatch = 0;
  for (let index = 0; index < actual.length; index += 1) {
    mismatch |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return mismatch === 0;
}

function messageBody(message: Record<string, unknown>): string | null {
  const type = asString(message.type);
  if (type === "text") return asString(asObject(message.text).body) || null;
  if (["image", "video", "document"].includes(type)) {
    const media = asObject(message[type]);
    const explicit = asString(media.caption) || asString(media.filename);
    if (explicit) return explicit;
    if (type === "image") return "Imagem recebida";
    if (type === "video") return "Vídeo recebido";
    return "Documento recebido";
  }
  if (type === "audio") return "Áudio recebido";
  if (type === "button") return asString(asObject(message.button).text) || "Botão selecionado";
  if (type === "interactive") {
    const interactive = asObject(message.interactive);
    const buttonReply = asObject(interactive.button_reply);
    const listReply = asObject(interactive.list_reply);
    return asString(buttonReply.title) || asString(listReply.title) || "Resposta interativa recebida";
  }
  if (type === "location") {
    const location = asObject(message.location);
    return asString(location.name) || asString(location.address) ||
      [location.latitude, location.longitude].filter((value) => value !== undefined).join(", ") ||
      "Localização recebida";
  }
  if (type === "contacts") {
    const contacts = Array.isArray(message.contacts) ? message.contacts : [];
    const first = asObject(contacts[0]);
    return asString(asObject(first.name).formatted_name) || "Contato recebido";
  }
  return `Mensagem ${type || "desconhecida"} recebida`;
}

function normalizedMessageType(message: Record<string, unknown>): string {
  const type = asString(message.type).toLowerCase();
  if (type === "button") return "interactive";
  if (type === "contacts") return "contact";
  if (["text", "image", "audio", "video", "document", "location", "contact", "interactive"].includes(type)) {
    return type;
  }
  return "text";
}

function extensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "video/mp4": "mp4",
    "video/3gpp": "3gp",
    "application/pdf": "pdf",
  };
  return map[mimeType.toLowerCase()] || "bin";
}

function safeFileName(value: string, mimeType: string, messageType: string): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .slice(0, 120);
  if (cleaned && /\.[A-Za-z0-9]{1,10}$/.test(cleaned)) return cleaned;
  return `${cleaned || `${messageType}-${Date.now()}`}.${extensionFromMimeType(mimeType)}`;
}

async function downloadAndStoreMedia(
  adminClient: ReturnType<typeof createClient>,
  integration: Record<string, unknown>,
  accessToken: string,
  message: Record<string, unknown>,
  ingestion: Record<string, unknown>,
): Promise<void> {
  const type = asString(message.type);
  if (!["image", "audio", "video", "document"].includes(type)) return;
  const media = asObject(message[type]);
  const mediaId = asString(media.id);
  if (!mediaId) return;

  const version = asString(integration.graph_api_version) || "v25.0";
  const metadataResponse = await fetch(graphUrl(version, mediaId), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const metadata = asObject(await metadataResponse.json().catch(() => ({})));
  if (!metadataResponse.ok || !asString(metadata.url)) {
    throw new Error(asString(asObject(metadata.error).message) || "A Meta não retornou a URL da mídia.");
  }

  const fileResponse = await fetch(asString(metadata.url), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!fileResponse.ok) throw new Error(`Falha ao baixar mídia: HTTP ${fileResponse.status}.`);

  const bytes = await fileResponse.arrayBuffer();
  const mimeType = asString(metadata.mime_type) || fileResponse.headers.get("content-type") || "application/octet-stream";
  const fileName = safeFileName(
    asString(media.filename),
    mimeType,
    type,
  );
  const organizationId = asString(integration.organization_id);
  const conversationId = asString(ingestion.conversation_id);
  const messageId = asString(ingestion.message_id);
  if (!organizationId || !conversationId || !messageId) return;

  const storagePath = `${organizationId}/${conversationId}/${messageId}/${fileName}`;
  const { error: uploadError } = await adminClient.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, bytes, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: true,
    });
  if (uploadError) throw new Error(uploadError.message);

  const { data: currentMessage } = await adminClient
    .from("messages")
    .select("metadata")
    .eq("organization_id", organizationId)
    .eq("id", messageId)
    .maybeSingle();
  const currentMetadata = asObject(currentMessage?.metadata);

  const { error: updateError } = await adminClient
    .from("messages")
    .update({
      external_media_id: mediaId,
      media_storage_path: storagePath,
      mime_type: mimeType,
      file_name: fileName,
      metadata: {
        ...currentMetadata,
        media: {
          id: mediaId,
          mime_type: mimeType,
          file_name: fileName,
          storage_bucket: MEDIA_BUCKET,
          storage_path: storagePath,
          size_bytes: bytes.byteLength,
          download_status: "stored",
          stored_at: new Date().toISOString(),
        },
      },
    })
    .eq("organization_id", organizationId)
    .eq("id", messageId);
  if (updateError) throw new Error(updateError.message);
}

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

Deno.serve(async (request) => {
  const verifyToken = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN") || "";

  if (request.method === "GET") {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode") || "";
    const token = url.searchParams.get("hub.verify_token") || "";
    const challenge = url.searchParams.get("hub.challenge") || "";
    if (mode === "subscribe" && token && token === verifyToken) {
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (request.method !== "POST") return json({ ok: false, error: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const credentialsKey = Deno.env.get("WHATSAPP_CREDENTIALS_KEY");
  const appSecret = Deno.env.get("META_APP_SECRET");
  if (!supabaseUrl || !serviceRoleKey || !credentialsKey || !appSecret || !verifyToken) {
    return json({ ok: false, error: "Secrets do webhook não configurados." }, 500);
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256") || "";
  if (!(await verifySignature(rawBody, signature, appSecret))) {
    return json({ ok: false, error: "Assinatura do webhook inválida." }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = asObject(JSON.parse(rawBody));
  } catch {
    return json({ ok: false, error: "Payload inválido." }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  let messagesProcessed = 0;
  let statusesProcessed = 0;
  let ignored = 0;
  const errors: string[] = [];

  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entryValue of entries) {
    const entry = asObject(entryValue);
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const changeValue of changes) {
      const change = asObject(changeValue);
      const value = asObject(change.value);
      const metadata = asObject(value.metadata);
      const phoneNumberId = asString(metadata.phone_number_id);
      if (!phoneNumberId) {
        ignored += 1;
        continue;
      }

      const { data: integration, error: integrationError } = await adminClient
        .from("crm_whatsapp_integrations")
        .select("*")
        .eq("phone_number_id", phoneNumberId)
        .eq("active", true)
        .maybeSingle();
      if (integrationError || !integration) {
        ignored += 1;
        continue;
      }

      const errorsBeforeIntegration = errors.length;
      let integrationHadMessage = false;

      let accessToken: string;
      try {
        accessToken = await decryptCredential(
          String(integration.access_token_ciphertext),
          credentialsKey,
        );
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Falha ao abrir credencial.");
        continue;
      }

      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const contactByWaId = new Map<string, string>();
      for (const contactValue of contacts) {
        const contact = asObject(contactValue);
        contactByWaId.set(
          asString(contact.wa_id),
          asString(asObject(contact.profile).name),
        );
      }

      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const messageValue of messages) {
        const message = asObject(messageValue);
        const externalMessageId = asString(message.id);
        const from = asString(message.from);
        if (!externalMessageId || !from) continue;

        const type = normalizedMessageType(message);
        const rawType = asString(message.type);
        const media = ["image", "audio", "video", "document"].includes(rawType)
          ? asObject(message[rawType])
          : {};

        const { data: ingestionData, error: ingestionError } = await adminClient.rpc(
          "ingest_crm_whatsapp_message",
          {
            p_organization_id: integration.organization_id,
            p_external_account_id: phoneNumberId,
            p_external_contact_id: from,
            p_external_message_id: externalMessageId,
            p_contact_name: contactByWaId.get(from) || null,
            p_message_type: type,
            p_body: messageBody(message),
            p_sent_at: unixTimestampToIso(message.timestamp),
            p_metadata: {
              source: "meta_direct_webhook",
              phone_number_id: phoneNumberId,
              display_phone_number: asString(metadata.display_phone_number),
              original_message_type: rawType,
              context: asObject(message.context),
              media: Object.keys(media).length > 0
                ? {
                    id: asString(media.id),
                    mime_type: asString(media.mime_type),
                    sha256: asString(media.sha256),
                    file_name: asString(media.filename),
                    caption: asString(media.caption),
                    download_status: "pending",
                  }
                : undefined,
            },
          },
        );

        if (ingestionError) {
          errors.push(ingestionError.message);
          continue;
        }

        messagesProcessed += 1;
        integrationHadMessage = true;
        const ingestion = asObject(ingestionData);
        if (!ingestion.duplicate && Object.keys(media).length > 0) {
          try {
            await downloadAndStoreMedia(adminClient, integration, accessToken, message, ingestion);
          } catch (error) {
            errors.push(error instanceof Error ? error.message : "Falha ao armazenar mídia recebida.");
          }
        }
      }

      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const statusValue of statuses) {
        const status = asObject(statusValue);
        const externalMessageId = asString(status.id);
        const statusName = asString(status.status).toLowerCase();

        // O modelo atual do CRM acompanha somente a progressão operacional.
        // Eventos como "deleted" são legítimos na Meta, mas não mudam o funil de entrega.
        if (!externalMessageId.startsWith("wamid.") || !["sent", "delivered", "read", "failed"].includes(statusName)) {
          ignored += 1;
          continue;
        }

        const errorItem = asObject(Array.isArray(status.errors) ? status.errors[0] : null);
        const errorData = asObject(errorItem.error_data);
        const rpcArguments = {
          p_organization_id: integration.organization_id,
          p_external_message_id: externalMessageId,
          p_status: statusName,
          p_occurred_at: unixTimestampToIso(status.timestamp),
          p_recipient_id: asString(status.recipient_id) || null,
          p_error_code: errorItem.code !== undefined ? String(errorItem.code) : null,
          p_error_title: asString(errorItem.title) || null,
          p_error_message: asString(errorData.details) || asString(errorItem.message) || null,
          p_metadata: {
            source: "meta_direct_webhook",
            conversation: asObject(status.conversation),
            pricing: asObject(status.pricing),
          },
        };

        let matched = false;
        for (let attempt = 1; attempt <= 4; attempt += 1) {
          const { data: statusData, error: statusError } = await adminClient.rpc(
            "update_crm_whatsapp_message_status",
            rpcArguments,
          );
          if (statusError) {
            errors.push(statusError.message);
            break;
          }

          const result = asObject(statusData);
          if (result.matched === true) {
            matched = true;
            statusesProcessed += 1;
            break;
          }

          // "sent" pode chegar antes de o despacho persistir o wamid.
          if (attempt < 4) await sleep(attempt * 500);
        }

        if (!matched) ignored += 1;
      }

      const integrationHasErrors = errors.length > errorsBeforeIntegration;
      await adminClient
        .from("crm_whatsapp_integrations")
        .update({
          status: integrationHasErrors ? "attention" : "connected",
          last_message_at: integrationHadMessage
            ? new Date().toISOString()
            : integration.last_message_at,
          last_error: integrationHasErrors ? errors[errors.length - 1] : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", integration.id);
    }
  }

  // A Meta precisa de HTTP 200 para não repetir indefinidamente eventos já processados.
  return json({
    ok: true,
    messages_processed: messagesProcessed,
    statuses_processed: statusesProcessed,
    ignored,
    errors: errors.slice(0, 10),
  });
});
