import { createClient } from "npm:@supabase/supabase-js@2";

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

function jsonResponse(
  payload: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(payload),
    {
      status,
      headers: JSON_HEADERS,
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

function optionalString(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized || null;
}

function normalizeTimestamp(
  value: unknown,
): string {
  if (typeof value === "number") {
    // A Meta normalmente usa timestamp Unix em segundos.
    const milliseconds =
      value < 10_000_000_000
        ? value * 1000
        : value;

    const parsed = new Date(milliseconds);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  if (typeof value === "string") {
    const normalized = value.trim();

    if (/^\d+$/.test(normalized)) {
      const numeric = Number(normalized);
      const milliseconds =
        numeric < 10_000_000_000
          ? numeric * 1000
          : numeric;

      const parsedNumeric =
        new Date(milliseconds);

      if (
        !Number.isNaN(
          parsedNumeric.getTime(),
        )
      ) {
        return parsedNumeric.toISOString();
      }
    }

    const parsedText = new Date(normalized);

    if (!Number.isNaN(parsedText.getTime())) {
      return parsedText.toISOString();
    }
  }

  return new Date().toISOString();
}

function sleep(
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(
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
    return jsonResponse(
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
    return jsonResponse(
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
    return jsonResponse(
      {
        ok: false,
        error:
          "O corpo da solicitação não é um JSON válido.",
      },
      400,
    );
  }

  const externalMessageId =
    optionalString(
      payload.external_message_id,
    );

  const status =
    optionalString(
      payload.status,
    )?.toLowerCase() ?? null;

  if (
    !externalMessageId ||
    !externalMessageId.startsWith(
      "wamid.",
    )
  ) {
    return jsonResponse(
      {
        ok: false,
        error:
          "external_message_id deve conter o wamid retornado pela Meta.",
      },
      400,
    );
  }

  if (
    !status ||
    ![
      "sent",
      "delivered",
      "read",
      "failed",
    ].includes(status)
  ) {
    return jsonResponse(
      {
        ok: false,
        error:
          "O status deve ser sent, delivered, read ou failed.",
      },
      400,
    );
  }

  const metadata =
    asObject(payload.metadata);

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

  const rpcArguments = {
    p_organization_id:
      organizationId,

    p_external_message_id:
      externalMessageId,

    p_status:
      status,

    p_occurred_at:
      normalizeTimestamp(
        payload.occurred_at,
      ),

    p_recipient_id:
      optionalString(
        payload.recipient_id,
      ),

    p_error_code:
      optionalString(
        payload.error_code,
      ),

    p_error_title:
      optionalString(
        payload.error_title,
      ),

    p_error_message:
      optionalString(
        payload.error_message,
      ),

    p_metadata:
      metadata,
  };

  let result:
    | Record<string, unknown>
    | null = null;

  // O evento "sent" pode chegar antes de a função de envio
  // terminar de gravar o wamid. Fazemos algumas tentativas
  // curtas para resolver essa corrida.
  for (
    let attempt = 1;
    attempt <= 4;
    attempt += 1
  ) {
    const {
      data,
      error,
    } = await supabaseAdmin.rpc(
      "update_crm_whatsapp_message_status",
      rpcArguments,
    );

    if (error) {
      console.error(
        "Falha ao atualizar status do WhatsApp:",
        error,
      );

      return jsonResponse(
        {
          ok: false,
          error: error.message,
        },
        400,
      );
    }

    result = asObject(data);

    if (result.matched === true) {
      return jsonResponse({
        ok: true,
        result,
        attempt,
      });
    }

    if (attempt < 4) {
      await sleep(attempt * 500);
    }
  }

  // Retorna 200 para que o Make não interrompa o cenário.
  // O resultado deixa explícito que não houve associação.
  return jsonResponse({
    ok: true,
    result:
      result ?? {
        matched: false,
        updated: false,
      },
    pending_match: true,
  });
});