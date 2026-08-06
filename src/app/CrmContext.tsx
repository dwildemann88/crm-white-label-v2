import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { ReactNode } from "react";
import { can, canAccessLead, type Permission } from "../core/permissions";
import type {
  AppSnapshot,
  Branding,
  CustomFieldDefinition,
  IntegrationConnection,
  IntegrationSecretResult,
  Lead,
  LeadFieldDefinition,
  LeadInput,
  LeadMoveOptions,
  Message,
  NewWebhookIntegrationInput,
  Organization,
  OrganizationTemplateMode,
  Pipeline,
  PipelineStage,
  Session,
  TagDefinition,
  TaskInput,
  User,
  UserInput,
  WhatsAppMediaPrepareInput,
  WhatsAppTemplateSendInput,
  WhatsAppCloudIntegrationInput,
  WhatsAppCloudTestResult,
  WebhookEvent,
  WebhookTestResult,
} from "../core/types";
import { createGateway } from "../infrastructure/createGateway";
import { supabase } from "../infrastructure/supabase/client";
interface CrmContextValue {
  data: AppSnapshot | null;
  session: Session | null;
  currentUser: User | null;
  loading: boolean;
  busy: boolean;
  error: string;
  toast: string;
  visibleLeads: Lead[];
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  refresh(): Promise<void>;
  clearError(): void;
  setToast(message: string): void;
  can(permission: Permission): boolean;
  saveLead(input: LeadInput): Promise<void>;
  moveLead(
    leadId: string,
    stageId: string,
    options?: LeadMoveOptions,
  ): Promise<void>;
  deleteLead(leadId: string): Promise<void>;
  addLeadNote(leadId: string, note: string): Promise<void>;
  saveTask(input: TaskInput): Promise<void>;
  toggleTask(taskId: string): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
  saveUser(input: UserInput): Promise<void>;
toggleUser(userId: string): Promise<void>;
removeUser(userId: string): Promise<void>;
savePipeline(pipeline: Pipeline): Promise<void>;
  deletePipeline(pipelineId: string): Promise<void>;
  saveStage(stage: PipelineStage): Promise<void>;
  deleteStage(stageId: string): Promise<void>;
  saveLeadField(field: LeadFieldDefinition): Promise<void>;
  saveCustomField(field: CustomFieldDefinition): Promise<void>;
  deleteCustomField(fieldId: string): Promise<void>;
  saveTag(tag: TagDefinition): Promise<void>;
  deleteTag(tagId: string): Promise<void>;
  updateBranding(branding: Branding): Promise<void>;
  saveOrganization(organization: Organization): Promise<void>;
  duplicateOrganization(
    sourceId: string,
    name: string,
    slug: string,
    templateMode: OrganizationTemplateMode,
  ): Promise<void>;
  switchOrganization(organizationId: string): Promise<void>;
  openWhatsAppConversation(leadId: string): Promise<string>;
  sendMessage(conversationId: string, body: string): Promise<void>;
  sendWhatsAppMedia(
    conversationId: string,
    input: WhatsAppMediaPrepareInput,
  ): Promise<void>;
  sendWhatsAppTemplate(
    conversationId: string,
    input: WhatsAppTemplateSendInput,
  ): Promise<void>;
  transferConversation(conversationId: string, userId: string): Promise<void>;
  markConversationRead(conversationId: string): Promise<void>;
  markNotificationRead(notificationId?: string): Promise<void>;
  createWebhookIntegration(
    input: NewWebhookIntegrationInput,
  ): Promise<IntegrationSecretResult>;
  updateIntegration(integration: IntegrationConnection): Promise<void>;
  rotateIntegrationSecret(
    integrationId: string,
  ): Promise<IntegrationSecretResult>;
  deleteIntegration(integrationId: string): Promise<void>;
  listWebhookEvents(
    integrationId?: string,
    limit?: number,
  ): Promise<WebhookEvent[]>;
  testIntegration(
    integrationId: string,
    payload: Record<string, unknown>,
  ): Promise<WebhookTestResult>;
  saveWhatsAppCloudIntegration(
    input: WhatsAppCloudIntegrationInput,
  ): Promise<void>;
  testWhatsAppCloudIntegration(): Promise<WhatsAppCloudTestResult>;
  disconnectWhatsAppCloudIntegration(): Promise<void>;
  resetDemo(): Promise<void>;
}

const CrmContext = createContext<CrmContextValue | null>(null);
const gateway = createGateway();
const provider = import.meta.env.VITE_DATA_PROVIDER || "local";
const autoDemoLogin =
  provider === "local" && import.meta.env.VITE_DEMO_AUTO_LOGIN !== "false";
const demoEmail = import.meta.env.VITE_DEMO_EMAIL || "admin@projem.com.br";
const demoPassword = import.meta.env.VITE_DEMO_PASSWORD || "projem123";

export function CrmProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<AppSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToastState] = useState("");

  const load = useCallback(async (nextSession: Session) => {
    const snapshot = await gateway.snapshot(nextSession);
    setData(snapshot);
    setSession(nextSession);
  }, []);

  const establishDemoSession = useCallback(async () => {
    const nextSession = await gateway.login(demoEmail, demoPassword);
    await load(nextSession);
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const restored = await gateway.restoreSession();
        if (restored) {
          await load(restored);
        } else if (autoDemoLogin) {
          await establishDemoSession();
        }
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Falha ao preparar o ambiente.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [establishDemoSession, load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToastState(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);
useEffect(() => {
  if (
    !session ||
    provider !== "supabase"
  ) {
    return;
  }

  let refreshTimer:
    | number
    | null = null;

  const scheduleRefresh = () => {
    if (refreshTimer !== null) {
      window.clearTimeout(
        refreshTimer,
      );
    }

    refreshTimer =
      window.setTimeout(() => {
        refreshTimer = null;

        void load(session).catch(
          (caught) => {
            setError(
              caught instanceof Error
                ? caught.message
                : "Não foi possível sincronizar o chat em tempo real.",
            );
          },
        );
      }, 250);
  };

  const organizationId =
    session.organizationId;

  const userId =
    session.userId;

  const channel = supabase
    .channel(
      `crm-realtime-${organizationId}-${userId}`,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "messages",
        filter:
          `organization_id=eq.${organizationId}`,
      },
      scheduleRefresh,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "conversations",
        filter:
          `organization_id=eq.${organizationId}`,
      },
      scheduleRefresh,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter:
          `user_id=eq.${userId}`,
      },
      scheduleRefresh,
    )
    .subscribe(
      (
        status,
        channelError,
      ) => {
        if (
          status ===
            "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          console.error(
            "Falha no Realtime do CRM:",
            channelError,
          );
        }
      },
    );

  return () => {
    if (refreshTimer !== null) {
      window.clearTimeout(
        refreshTimer,
      );
    }

    void supabase.removeChannel(
      channel,
    );
  };
}, [load, session]);
  useEffect(() => {
    if (!session) return;

    const refreshSnapshot = () => {
      void load(session).catch((caught) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível sincronizar o ambiente.",
        );
      });
    };

    const timer = window.setInterval(refreshSnapshot, 60_000);

    const onStorage = (event: StorageEvent) => {
      if (provider === "local" && event.key?.startsWith("projem-flow-product-")) {
        refreshSnapshot();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshSnapshot();
    };

    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load, session]);

  const execute = useCallback(
    async (action: () => Promise<void>, success?: string) => {
      if (!session) throw new Error("Sessão não encontrada.");
      setBusy(true);
      setError("");

      try {
        await action();
        await load(session);
        if (success) setToastState(success);
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Não foi possível concluir a operação.";

        setError(message);
        throw caught;
      } finally {
        setBusy(false);
      }
    },
    [load, session],
  );

  const executeResult = useCallback(
    async <T,>(action: () => Promise<T>, success?: string): Promise<T> => {
      if (!session) throw new Error("Sessão não encontrada.");
      setBusy(true);
      setError("");

      try {
        const result = await action();
        await load(session);
        if (success) setToastState(success);
        return result;
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Não foi possível concluir a operação.";

        setError(message);
        throw caught;
      } finally {
        setBusy(false);
      }
    },
    [load, session],
  );

  const executeSilent = useCallback(
    async (action: () => Promise<void>) => {
      if (!session) return;

      try {
        await action();
        await load(session);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível atualizar os dados.",
        );
      }
    },
    [load, session],
  );

  const currentUser = useMemo(
    () => data?.users.find((item) => item.id === session?.userId) || null,
    [data, session],
  );

  const initialStages = useMemo(
    () =>
      data?.stages
        .filter((stage) => stage.order <= 2)
        .map((stage) => stage.id) || [],
    [data],
  );

  const visibleLeads = useMemo(
    () =>
      data?.leads.filter((lead) =>
        canAccessLead(currentUser, lead, initialStages),
      ) || [],
    [currentUser, data, initialStages],
  );

  const value: CrmContextValue = {
    data,
    session,
    currentUser,
    loading,
    busy,
    error,
    toast,
    visibleLeads,

    async login(email, password) {
      setBusy(true);
      setError("");

      try {
        const nextSession = await gateway.login(email, password);
        await load(nextSession);
        setToastState("Acesso realizado com sucesso.");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Falha ao entrar.");
        throw caught;
      } finally {
        setBusy(false);
      }
    },

    async logout() {
      await gateway.logout();
      setSession(null);
      setData(null);
      setToastState("");
    },

    async refresh() {
      if (session) await load(session);
    },

    clearError() {
      setError("");
    },

    setToast: setToastState,

    can(permission) {
      return can(currentUser, permission);
    },

    saveLead(input) {
      return execute(
        () => gateway.saveLead(session!, input).then(() => undefined),
        input.id ? "Lead atualizado." : "Lead criado.",
      );
    },

    moveLead(leadId, stageId, options) {
      return execute(
        () => gateway.moveLead(session!, leadId, stageId, options),
        "Lead movimentado no funil.",
      );
    },

    deleteLead(leadId) {
      return execute(
        () => gateway.deleteLead(session!, leadId),
        "Lead excluído.",
      );
    },

    addLeadNote(leadId, note) {
      return execute(
        () => gateway.addLeadNote(session!, leadId, note),
        "Observação registrada.",
      );
    },

    saveTask(input) {
      return execute(
        () => gateway.saveTask(session!, input).then(() => undefined),
        input.id ? "Tarefa atualizada." : "Tarefa adicionada.",
      );
    },

    toggleTask(taskId) {
      return execute(
        () => gateway.toggleTask(session!, taskId),
        "Tarefa atualizada.",
      );
    },

    deleteTask(taskId) {
      return execute(
        () => gateway.deleteTask(session!, taskId),
        "Tarefa excluída.",
      );
    },

    saveUser(input) {
      return execute(
        () => gateway.saveUser(session!, input).then(() => undefined),
        input.id ? "Usuário atualizado." : "Usuário criado.",
      );
    },

    toggleUser(userId) {
      return execute(
        () => gateway.toggleUser(session!, userId),
        "Status do usuário atualizado.",
      );
    },
removeUser(userId) {
  return execute(
    () => gateway.removeUser(session!, userId),
    "Usuário removido da empresa.",
  );
},
    savePipeline(pipeline) {
      return execute(
        () => gateway.savePipeline(session!, pipeline),
        pipeline.id ? "Funil salvo." : "Funil criado.",
      );
    },

    deletePipeline(pipelineId) {
      return execute(
        () => gateway.deletePipeline(session!, pipelineId),
        "Funil removido.",
      );
    },

    saveStage(stage) {
      return execute(() => gateway.saveStage(session!, stage), "Etapa salva.");
    },

    deleteStage(stageId) {
      return execute(
        () => gateway.deleteStage(session!, stageId),
        "Etapa removida.",
      );
    },

    saveLeadField(field) {
      return execute(
        () => gateway.saveLeadField(session!, field),
        "Configuração do campo atualizada.",
      );
    },

    saveCustomField(field) {
      return execute(
        () => gateway.saveCustomField(session!, field),
        "Campo personalizado salvo.",
      );
    },

    deleteCustomField(fieldId) {
      return execute(
        () => gateway.deleteCustomField(session!, fieldId),
        "Campo personalizado removido.",
      );
    },

    saveTag(tag) {
      return execute(() => gateway.saveTag(session!, tag), "Etiqueta salva.");
    },

    deleteTag(tagId) {
      return execute(
        () => gateway.deleteTag(session!, tagId),
        "Etiqueta removida.",
      );
    },

    updateBranding(branding) {
      return execute(
        () => gateway.updateBranding(session!, branding),
        "Identidade visual atualizada.",
      );
    },

    saveOrganization(organization) {
      return execute(
        () => gateway.saveOrganization(session!, organization),
        "Empresa atualizada.",
      );
    },

    duplicateOrganization(sourceId, name, slug, templateMode) {
      return execute(
        () =>
          gateway.duplicateOrganization(
            session!,
            sourceId,
            name,
            slug,
            templateMode,
          ),
        templateMode === "generic"
          ? "CRM genérico criado."
          : "Nova versão de CRM criada.",
      );
    },

    async switchOrganization(organizationId) {
      if (!session) return;
      setBusy(true);
      setError("");

      try {
        const nextSession = await gateway.switchOrganization(
          session,
          organizationId,
        );

        await load(nextSession);
        setToastState("Ambiente da empresa alterado.");
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Não foi possível abrir a empresa.";

        setError(message);
        throw caught;
      } finally {
        setBusy(false);
      }
    },

    async openWhatsAppConversation(leadId) {
      if (!session) {
        throw new Error("Sessão não encontrada.");
      }

      setBusy(true);
      setError("");

      try {
        const conversationId = await gateway.openWhatsAppConversation(
          session,
          leadId,
        );

        await load(session);
        setToastState("Conversa do WhatsApp aberta.");

        return conversationId;
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Não foi possível abrir o WhatsApp.";

        setError(message);
        throw caught;
      } finally {
        setBusy(false);
      }
    },

    sendMessage(conversationId, body) {
  if (!session) {
    return Promise.reject(
      new Error("Sessão não encontrada."),
    );
  }

  const normalizedBody = body.trim();

  if (!normalizedBody) {
    return Promise.reject(
      new Error(
        "Digite uma mensagem antes de enviar.",
      ),
    );
  }

  const optimisticId =
    `optimistic-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

  const optimisticCreatedAt =
    new Date().toISOString();

  const optimisticMessage: Message = {
    id: optimisticId,
    organizationId:
      session.organizationId,
    conversationId,
    senderUserId:
      currentUser?.id ??
      session.userId,
    direction: "outbound",
    body: normalizedBody,
    status: "queued",
    createdAt:
      optimisticCreatedAt,
  };

  setError("");

  setData((currentData) => {
    if (!currentData) {
      return currentData;
    }

    return {
      ...currentData,

      messages: [
        ...currentData.messages,
        optimisticMessage,
      ],

      conversations:
        currentData.conversations.map(
          (conversation) =>
            conversation.id ===
            conversationId
              ? {
                  ...conversation,
                  lastMessageAt:
                    optimisticCreatedAt,
                }
              : conversation,
        ),
    };
  });

  void gateway
    .sendMessage(
      session,
      conversationId,
      normalizedBody,
    )
    .then(async () => {
      await load(session);

      setToastState(
        "Mensagem enviada.",
      );
    })
    .catch(async (caught) => {
      const message =
        caught instanceof Error
          ? caught.message
          : "Não foi possível enviar a mensagem.";

      try {
        await load(session);
      } catch {
        setData((currentData) => {
          if (!currentData) {
            return currentData;
          }

          return {
            ...currentData,

            messages:
              currentData.messages.map(
                (item) =>
                  item.id === optimisticId
                    ? {
                        ...item,
                        status: "failed",
                      }
                    : item,
              ),
          };
        });
      }

      setError(message);
    });

  return Promise.resolve();
},


    async sendWhatsAppMedia(
      conversationId,
      input,
    ) {
      if (!session) {
        throw new Error(
          "Sessão não encontrada.",
        );
      }

      if (!gateway.prepareWhatsAppMedia) {
        throw new Error(
          "O envio de mídias não está disponível neste provedor de dados.",
        );
      }

      setBusy(true);
      setError("");

      try {
        await gateway.prepareWhatsAppMedia(
          session,
          conversationId,
          input,
        );

        await load(session);

        setToastState(
          "Mídia enviada.",
        );
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Não foi possível enviar a mídia.";

        try {
          await load(session);
        } catch {
          // Mantém o erro original quando a atualização do snapshot também falhar.
        }

        setError(message);
        throw caught;
      } finally {
        setBusy(false);
      }
    },


    async sendWhatsAppTemplate(
      conversationId,
      input,
    ) {
      if (!session) {
        throw new Error(
          "Sessão não encontrada.",
        );
      }

      if (
        !gateway.sendWhatsAppTemplate
      ) {
        throw new Error(
          "O envio de templates não está disponível neste provedor de dados.",
        );
      }

      const templateName =
        input.templateName.trim();

      const languageCode =
        input.languageCode.trim();

      const parameters =
        input.parameters.map(
          (value) => value.trim(),
        );

      const bodyPreview =
        input.bodyPreview.trim();

      if (
        !templateName ||
        !languageCode ||
        !bodyPreview ||
        parameters.some(
          (value) => !value,
        )
      ) {
        throw new Error(
          "Os dados do template estão incompletos.",
        );
      }

      const optimisticId =
        `optimistic-template-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;

      const optimisticCreatedAt =
        new Date().toISOString();

      const optimisticMessage: Message = {
        id: optimisticId,
        organizationId:
          session.organizationId,
        conversationId,
        senderUserId:
          currentUser?.id ??
          session.userId,
        direction: "outbound",
        body: bodyPreview,
        status: "queued",
        createdAt:
          optimisticCreatedAt,
      };

      setBusy(true);
      setError("");

      setData((currentData) => {
        if (!currentData) {
          return currentData;
        }

        return {
          ...currentData,

          messages: [
            ...currentData.messages,
            optimisticMessage,
          ],

          conversations:
            currentData.conversations.map(
              (conversation) =>
                conversation.id ===
                conversationId
                  ? {
                      ...conversation,
                      lastMessageAt:
                        optimisticCreatedAt,
                    }
                  : conversation,
            ),
        };
      });

      try {
        await gateway.sendWhatsAppTemplate(
          session,
          conversationId,
          {
            templateName,
            languageCode,
            parameters,
            bodyPreview,
          },
        );

        await load(session);

        setToastState(
          "Template enviado.",
        );
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Não foi possível enviar o template.";

        try {
          await load(session);
        } catch {
          setData((currentData) => {
            if (!currentData) {
              return currentData;
            }

            return {
              ...currentData,

              messages:
                currentData.messages.map(
                  (item) =>
                    item.id ===
                    optimisticId
                      ? {
                          ...item,
                          status:
                            "failed",
                        }
                      : item,
                ),
            };
          });
        }

        setError(message);
        throw caught;
      } finally {
        setBusy(false);
      }
    },

    transferConversation(conversationId, userId) {
      return execute(
        () => gateway.transferConversation(session!, conversationId, userId),
        "Atendimento transferido.",
      );
    },

    markConversationRead(conversationId) {
      return executeSilent(() =>
        gateway.markConversationRead(session!, conversationId),
      );
    },

    markNotificationRead(notificationId) {
      return executeSilent(() =>
        gateway.markNotificationRead(session!, notificationId),
      );
    },

    createWebhookIntegration(input) {
      return executeResult(
        () => gateway.createWebhookIntegration(session!, input),
        "Integração criada. Guarde a credencial exibida.",
      );
    },

    updateIntegration(integration) {
      return execute(
        () => gateway.updateIntegration(session!, integration),
        "Integração atualizada.",
      );
    },

    rotateIntegrationSecret(integrationId) {
      return executeResult(
        () => gateway.rotateIntegrationSecret(session!, integrationId),
        "Nova credencial gerada.",
      );
    },

    deleteIntegration(integrationId) {
      return execute(
        () => gateway.deleteIntegration(session!, integrationId),
        "Integração removida.",
      );
    },

    listWebhookEvents(integrationId, limit) {
      if (!session) {
        return Promise.reject(new Error("Sessão não encontrada."));
      }

      return gateway.listWebhookEvents(session, integrationId, limit);
    },

    testIntegration(integrationId, payload) {
      return executeResult(
        () => gateway.testIntegration(session!, integrationId, payload),
        "Lead de teste processado.",
      );
    },

    saveWhatsAppCloudIntegration(input) {
      if (!gateway.saveWhatsAppCloudIntegration) {
        return Promise.reject(
          new Error("A integração direta com WhatsApp não está disponível neste provedor."),
        );
      }
      return execute(
        () => gateway.saveWhatsAppCloudIntegration!(session!, input),
        "WhatsApp conectado e validado.",
      );
    },

    testWhatsAppCloudIntegration() {
      if (!gateway.testWhatsAppCloudIntegration) {
        return Promise.reject(
          new Error("O teste direto do WhatsApp não está disponível neste provedor."),
        );
      }
      return executeResult(
        () => gateway.testWhatsAppCloudIntegration!(session!),
        "Conexão com o WhatsApp validada.",
      );
    },

    disconnectWhatsAppCloudIntegration() {
      if (!gateway.disconnectWhatsAppCloudIntegration) {
        return Promise.reject(
          new Error("A desconexão do WhatsApp não está disponível neste provedor."),
        );
      }
      return execute(
        () => gateway.disconnectWhatsAppCloudIntegration!(session!),
        "WhatsApp desconectado.",
      );
    },

    async resetDemo() {
      setBusy(true);
      setError("");

      try {
        await gateway.resetDemo();

        if (autoDemoLogin) {
          await establishDemoSession();
        } else {
          setSession(null);
          setData(null);
        }

        setToastState("Ambiente local restaurado.");
      } finally {
        setBusy(false);
      }
    },
  };

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm(): CrmContextValue {
  const context = useContext(CrmContext);

  if (!context) {
    throw new Error("useCrm deve ser usado dentro de CrmProvider.");
  }

  return context;
}