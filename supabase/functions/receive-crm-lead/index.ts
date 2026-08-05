import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-crm-integration-key, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const maxPayloadBytes = 256 * 1024;

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

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function valueAtPath(
  payload: Record<string, unknown>,
  path: string,
): unknown {
  if (Object.prototype.hasOwnProperty.call(payload, path)) {
    return payload[path];
  }

  const segments = path.split(".").filter(Boolean);
  let current: unknown = payload;

  for (const segment of segments) {
    const record = asObject(current);
    if (!record || !Object.prototype.hasOwnProperty.call(record, segment)) {
      return undefined;
    }
    current = record[segment];
  }

  return current;
}

function bearerSecret(request: Request): string {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function requestIdentifier(request: Request): string {
  const explicit = trimmed(request.headers.get("x-request-id"));
  if (explicit) return explicit.slice(0, 180);
  return crypto.randomUUID();
}

function publicErrorStatus(code: string | undefined): number {
  if (
    code === "22023" ||
    code === "22P02" ||
    code === "23514" ||
    code === "23503" ||
    code === "P0001"
  ) {
    return 422;
  }

  if (code === "23505") return 409;
  if (code === "P0002") return 404;
  return 500;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Método não permitido." }, 405);
  }

  const publicKey = trimmed(
    request.headers.get("x-crm-integration-key"),
  );
  const secret = bearerSecret(request);

  if (!publicKey || !secret) {
    return jsonResponse(
      {
        ok: false,
        error: "A solicitação não possui credenciais válidas.",
      },
      401,
    );
  }

  if (publicKey.length > 80 || secret.length > 160) {
    return jsonResponse(
      {
        ok: false,
        error: "A solicitação não possui credenciais válidas.",
      },
      401,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      {
        ok: false,
        error: "O receptor não possui configuração administrativa completa.",
      },
      500,
    );
  }

  const rawBody = await request.text();

  if (new TextEncoder().encode(rawBody).byteLength > maxPayloadBytes) {
    return jsonResponse(
      {
        ok: false,
        error: "O payload excede o limite de 256 KB.",
      },
      413,
    );
  }

  let payload: Record<string, unknown>;

  try {
    const parsed = JSON.parse(rawBody);
    const objectPayload = asObject(parsed);

    if (!objectPayload) {
      return jsonResponse(
        {
          ok: false,
          error: "O corpo da solicitação deve ser um objeto JSON.",
        },
        400,
      );
    }

    payload = objectPayload;
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: "O corpo da solicitação não é um JSON válido.",
      },
      400,
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: integrationData, error: integrationError } =
    await adminClient.rpc("resolve_crm_webhook_integration", {
      p_public_key: publicKey,
      p_secret: secret,
    });

  if (integrationError) {
    console.error("[receive-crm-lead] resolve", integrationError);
    return jsonResponse(
      {
        ok: false,
        error: "Não foi possível validar a integração.",
      },
      500,
    );
  }

  const integration = asObject(integrationData);
  const integrationId = trimmed(integration?.integration_id);
  const mappings = Array.isArray(integration?.field_mappings)
    ? integration.field_mappings
    : [];

  if (!integration || !integrationId) {
    return jsonResponse(
      {
        ok: false,
        error: "A solicitação não possui credenciais válidas.",
      },
      401,
    );
  }

  const mappedValues: Record<string, unknown> = {};

  for (const rawMapping of mappings) {
    const mapping = asObject(rawMapping);
    const source = trimmed(mapping?.source);
    const target = trimmed(mapping?.target);

    if (!source || !target) continue;

    const value = valueAtPath(payload, source);
    if (value !== undefined) mappedValues[target] = value;
  }

  const requestId = requestIdentifier(request);

  const { data: resultData, error: ingestError } = await adminClient.rpc(
    "ingest_crm_webhook_lead",
    {
      p_integration_id: integrationId,
      p_request_id: requestId,
      p_payload: payload,
      p_mapped_values: mappedValues,
    },
  );

  if (ingestError) {
    console.error("[receive-crm-lead] ingest", {
      code: ingestError.code,
      message: ingestError.message,
      integrationId,
      requestId,
    });

    await adminClient.rpc("record_crm_webhook_failure", {
      p_integration_id: integrationId,
      p_request_id: requestId,
      p_payload: payload,
      p_error_message: ingestError.message,
    });

    const status = publicErrorStatus(ingestError.code);

    return jsonResponse(
      {
        ok: false,
        request_id: requestId,
        error:
          status === 500
            ? "Não foi possível processar o lead."
            : ingestError.message,
      },
      status,
    );
  }

  const result = asObject(resultData) ?? {};
  const created = result.created === true;

  return jsonResponse(
    {
      ok: true,
      outcome: created ? "created" : "duplicate",
      created,
      duplicate: result.duplicate === true,
      idempotent: result.idempotent === true,
      duplicate_by: result.duplicate_by ?? null,
      lead_id: result.lead_id ?? null,
      contact_id: result.contact_id ?? null,
      request_id: result.request_id ?? requestId,
    },
    created ? 201 : 200,
  );
});
