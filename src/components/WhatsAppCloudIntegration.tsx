import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  KeyRound,
  MessageCircle,
  Phone,
  Settings2,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCrm } from "../app/CrmContext";
import type { WhatsAppCloudIntegrationInput } from "../core/types";
import { formatDateTime } from "../core/utils";
import { ModalShell } from "./Common";

function webhookEndpoint(): string {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  return supabaseUrl
    ? `${supabaseUrl}/functions/v1/whatsapp-cloud-webhook`
    : "/functions/v1/whatsapp-cloud-webhook";
}

const emptyDraft: WhatsAppCloudIntegrationInput = {
  wabaId: "",
  phoneNumberId: "",
  displayPhoneNumber: "",
  graphApiVersion: "v25.0",
  accessToken: "",
};

export function WhatsAppCloudIntegration() {
  const {
    data,
    can,
    saveWhatsAppCloudIntegration,
    testWhatsAppCloudIntegration,
    disconnectWhatsAppCloudIntegration,
  } = useCrm();

  const integration = useMemo(
    () => data?.integrations.find((item) => item.provider === "whatsapp") ?? null,
    [data?.integrations],
  );

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<WhatsAppCloudIntegrationInput>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState("");
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft({
      wabaId: integration?.wabaId ?? "",
      phoneNumberId: integration?.phoneNumberId ?? "",
      displayPhoneNumber:
        integration?.displayPhoneNumber ?? integration?.accountLabel ?? "",
      graphApiVersion: integration?.graphApiVersion ?? "v25.0",
      accessToken: "",
    });
    setError("");
  }, [integration, open]);

  const canManage = can("integrations.manage");
  const connected = integration?.active && integration.status === "connected";
  const statusLabel = connected
    ? "Conectado"
    : integration?.status === "disconnected" || integration?.active === false
      ? "Desconectado"
      : integration
        ? "Requer atenção"
        : "Não conectado";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!integration && !draft.accessToken.trim()) {
        throw new Error("Informe o token de acesso na primeira conexão.");
      }
      await saveWhatsAppCloudIntegration(draft);
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível conectar o WhatsApp.");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setError("");
    setTestMessage("");
    try {
      const result = await testWhatsAppCloudIntegration();
      setTestMessage(
        `Conexão validada${result.displayPhoneNumber ? ` para ${result.displayPhoneNumber}` : ""}.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível validar a conexão.");
    } finally {
      setTesting(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm("Desconectar este número do CRM? O cadastro será preservado para reconexão.")) {
      return;
    }
    setDisconnecting(true);
    setError("");
    try {
      await disconnectWhatsAppCloudIntegration();
      setTestMessage("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível desconectar o WhatsApp.");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <>
      <section className="panel whatsapp-cloud-panel">
        <div className="whatsapp-cloud-heading">
          <span className="integration-logo whatsapp-cloud-logo">
            <MessageCircle size={23} />
          </span>
          <div>
            <span className="section-kicker">Canal de atendimento</span>
            <h2>WhatsApp Cloud API</h2>
            <p>
              Envio e recebimento direto pela Meta, sem Make no transporte das mensagens.
            </p>
          </div>
          <span
            className={`integration-status-pill status-${
              integration?.status ?? "disconnected"
            }`}
          >
            <i /> {statusLabel}
          </span>
        </div>

        <div className="whatsapp-cloud-grid">
          <article>
            <Phone size={17} />
            <small>Número vinculado</small>
            <strong>
              {integration?.displayPhoneNumber || integration?.accountLabel || "Nenhum número"}
            </strong>
            <span>{integration?.verifiedName || "Empresa ainda não validada"}</span>
          </article>
          <article>
            <ShieldCheck size={17} />
            <small>Qualidade</small>
            <strong>{integration?.qualityRating || "Não consultada"}</strong>
            <span>
              {integration?.lastVerifiedAt
                ? `Validado em ${formatDateTime(integration.lastVerifiedAt)}`
                : "Faça o primeiro teste da conexão"}
            </span>
          </article>
          <article>
            <KeyRound size={17} />
            <small>Identificação técnica</small>
            <strong>{integration?.phoneNumberId || "Phone Number ID pendente"}</strong>
            <span>{integration?.graphApiVersion || "v25.0"}</span>
          </article>
        </div>

        <div className="whatsapp-cloud-webhook">
          <code>{webhookEndpoint()}</code>
          <span>Use esta URL como callback do webhook no aplicativo da Meta.</span>
        </div>

        {integration?.lastError && (
          <div className="integration-message error">
            <AlertTriangle size={16} />
            <span>{integration.lastError}</span>
          </div>
        )}

        {testMessage && (
          <div className="integration-message success">
            <CheckCircle2 size={16} />
            <span>{testMessage}</span>
          </div>
        )}

        <div className="whatsapp-cloud-actions">
          <button
            type="button"
            className="primary-button"
            disabled={!canManage}
            onClick={() => setOpen(true)}
          >
            <Settings2 size={16} /> {integration ? "Configurar conexão" : "Conectar WhatsApp"}
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!canManage || !integration?.active || testing}
            onClick={() => void testConnection()}
          >
            <FlaskConical size={16} /> {testing ? "Validando..." : "Testar conexão"}
          </button>
          {integration && (
            <button
              type="button"
              className="danger-button"
              disabled={!canManage || !integration.active || disconnecting}
              onClick={() => void disconnect()}
            >
              <Unplug size={16} /> {disconnecting ? "Desconectando..." : "Desconectar"}
            </button>
          )}
        </div>
      </section>

      {open && (
        <ModalShell title="Conectar WhatsApp Cloud API" onClose={() => setOpen(false)}>
          <form className="whatsapp-cloud-form" onSubmit={submit}>
            <div className="integration-message attention">
              <ShieldCheck size={16} />
              <span>
                O token é enviado apenas à Edge Function e armazenado criptografado. Ele precisa das permissões whatsapp_business_management e whatsapp_business_messaging.
              </span>
            </div>

            <div className="whatsapp-cloud-form-grid">
              <label>
                WABA ID
                <input
                  value={draft.wabaId}
                  inputMode="numeric"
                  placeholder="Ex.: 123456789012345"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, wabaId: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Phone Number ID
                <input
                  value={draft.phoneNumberId}
                  inputMode="numeric"
                  placeholder="Ex.: 123456789012345"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, phoneNumberId: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Número exibido
                <input
                  value={draft.displayPhoneNumber}
                  placeholder="Ex.: +55 55 99999-9999"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, displayPhoneNumber: event.target.value }))
                  }
                />
              </label>
              <label>
                Versão da Graph API
                <input
                  value={draft.graphApiVersion}
                  placeholder="v25.0"
                  pattern="v[0-9]+\.[0-9]+"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, graphApiVersion: event.target.value }))
                  }
                  required
                />
              </label>
            </div>

            <label>
              Token de acesso
              <textarea
                rows={4}
                value={draft.accessToken}
                placeholder={
                  integration
                    ? "Deixe vazio para manter o token atual"
                    : "Cole o token permanente ou de sistema gerado na Meta"
                }
                onChange={(event) =>
                  setDraft((current) => ({ ...current, accessToken: event.target.value }))
                }
              />
            </label>

            {error && (
              <div className="integration-message error">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button type="submit" className="primary-button" disabled={saving}>
                <MessageCircle size={16} /> {saving ? "Validando com a Meta..." : "Salvar e validar"}
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </>
  );
}
