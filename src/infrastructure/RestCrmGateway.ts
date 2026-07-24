import type { CrmGateway } from "./CrmGateway";
import type {
  AppSnapshot,
  Branding,
  CustomFieldDefinition,
  IntegrationConnection,
  Lead,
  LeadInput,
  Organization,
  Pipeline,
  PipelineStage,
  Session,
  TagDefinition,
  Task,
  TaskInput,
  User,
  UserInput,
} from "../core/types";

/**
 * Adaptador para o backend real.
 * Os endpoints esperados estão descritos em docs/API-CONTRACT.md.
 */
export class RestCrmGateway implements CrmGateway {
  private readonly sessionKey = "projem-flow-rest-session";

  constructor(private readonly baseUrl: string) {}

  private async request<T>(
    path: string,
    init: RequestInit = {},
    session?: Session,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
        ...(init.headers || {}),
      },
    });

    if (!response.ok) {
      const payload = await response
        .json()
        .catch(() => ({ message: "Falha na comunicação com o servidor." }));
      throw new Error(
        payload.message || "Falha na comunicação com o servidor.",
      );
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  async restoreSession() {
    const raw = localStorage.getItem(this.sessionKey);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (new Date(session.expiresAt) <= new Date()) {
      localStorage.removeItem(this.sessionKey);
      return null;
    }
    return session;
  }

  async login(email: string, password: string) {
    const session = await this.request<Session>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem(this.sessionKey, JSON.stringify(session));
    return session;
  }

  async logout() {
    localStorage.removeItem(this.sessionKey);
  }

  snapshot(session: Session) {
    return this.request<AppSnapshot>("/bootstrap", {}, session);
  }

  saveLead(session: Session, input: LeadInput) {
    return this.request<Lead>(
      input.id ? `/leads/${input.id}` : "/leads",
      {
        method: input.id ? "PATCH" : "POST",
        body: JSON.stringify(input),
      },
      session,
    );
  }

  moveLead(session: Session, leadId: string, stageId: string) {
    return this.request<void>(
      `/leads/${leadId}/stage`,
      {
        method: "PATCH",
        body: JSON.stringify({ stageId }),
      },
      session,
    );
  }

  addLeadNote(session: Session, leadId: string, note: string) {
    return this.request<void>(
      `/leads/${leadId}/notes`,
      {
        method: "POST",
        body: JSON.stringify({ note }),
      },
      session,
    );
  }

  saveTask(session: Session, input: TaskInput) {
    return this.request<Task>(
      input.id ? `/tasks/${input.id}` : "/tasks",
      {
        method: input.id ? "PATCH" : "POST",
        body: JSON.stringify(input),
      },
      session,
    );
  }

  toggleTask(session: Session, taskId: string) {
    return this.request<void>(
      `/tasks/${taskId}/toggle`,
      { method: "PATCH" },
      session,
    );
  }

  deleteTask(session: Session, taskId: string) {
    return this.request<void>(
      `/tasks/${taskId}`,
      { method: "DELETE" },
      session,
    );
  }

  saveUser(session: Session, input: UserInput) {
    return this.request<User>(
      input.id ? `/users/${input.id}` : "/users",
      {
        method: input.id ? "PATCH" : "POST",
        body: JSON.stringify(input),
      },
      session,
    );
  }

  toggleUser(session: Session, userId: string) {
    return this.request<void>(
      `/users/${userId}/toggle`,
      { method: "PATCH" },
      session,
    );
  }

  savePipeline(session: Session, pipeline: Pipeline) {
    return this.request<void>(
      `/pipelines/${pipeline.id}`,
      {
        method: "PUT",
        body: JSON.stringify(pipeline),
      },
      session,
    );
  }

  deletePipeline(session: Session, pipelineId: string) {
    return this.request<void>(
      `/pipelines/${pipelineId}`,
      { method: "DELETE" },
      session,
    );
  }

  saveStage(session: Session, stage: PipelineStage) {
    return this.request<void>(
      `/stages/${stage.id}`,
      {
        method: "PUT",
        body: JSON.stringify(stage),
      },
      session,
    );
  }

  deleteStage(session: Session, stageId: string) {
    return this.request<void>(
      `/stages/${stageId}`,
      { method: "DELETE" },
      session,
    );
  }

  saveCustomField(session: Session, field: CustomFieldDefinition) {
    return this.request<void>(
      `/custom-fields/${field.id}`,
      {
        method: "PUT",
        body: JSON.stringify(field),
      },
      session,
    );
  }

  deleteCustomField(session: Session, fieldId: string) {
    return this.request<void>(
      `/custom-fields/${fieldId}`,
      { method: "DELETE" },
      session,
    );
  }

  saveTag(session: Session, tag: TagDefinition) {
    return this.request<void>(
      `/tags/${tag.id}`,
      {
        method: "PUT",
        body: JSON.stringify(tag),
      },
      session,
    );
  }

  deleteTag(session: Session, tagId: string) {
    return this.request<void>(`/tags/${tagId}`, { method: "DELETE" }, session);
  }

  updateBranding(session: Session, branding: Branding) {
    return this.request<void>(
      "/organization/branding",
      {
        method: "PUT",
        body: JSON.stringify(branding),
      },
      session,
    );
  }

  saveOrganization(session: Session, organization: Organization) {
    return this.request<void>(
      `/organizations/${organization.id}`,
      {
        method: "PUT",
        body: JSON.stringify(organization),
      },
      session,
    );
  }

  duplicateOrganization(
    session: Session,
    sourceId: string,
    name: string,
    slug: string,
  ) {
    return this.request<void>(
      "/organizations/duplicate",
      {
        method: "POST",
        body: JSON.stringify({ sourceId, name, slug }),
      },
      session,
    );
  }

  switchOrganization(session: Session, organizationId: string) {
    return this.request<Session>(
      `/organizations/${organizationId}/switch`,
      { method: "POST" },
      session,
    ).then((nextSession) => {
      localStorage.setItem(this.sessionKey, JSON.stringify(nextSession));
      return nextSession;
    });
  }
openWhatsAppConversation(
    session: Session,
    leadId: string,
  ) {
    return this.request<{
      conversationId: string;
    }>(
      `/leads/${leadId}/whatsapp-conversation`,
      {
        method: "POST",
      },
      session,
    ).then(
      (result) =>
        result.conversationId,
    );
  }

  sendMessage(session: Session, conversationId: string, body: string) {
    return this.request<void>(
      `/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ body }),
      },
      session,
    );
  }

  transferConversation(
    session: Session,
    conversationId: string,
    userId: string,
  ) {
    return this.request<void>(
      `/conversations/${conversationId}/transfer`,
      {
        method: "PATCH",
        body: JSON.stringify({ userId }),
      },
      session,
    );
  }

  markConversationRead(session: Session, conversationId: string) {
    return this.request<void>(
      `/conversations/${conversationId}/read`,
      { method: "PATCH" },
      session,
    );
  }

  markNotificationRead(session: Session, notificationId?: string) {
    return this.request<void>(
      notificationId
        ? `/notifications/${notificationId}/read`
        : "/notifications/read-all",
      {
        method: "PATCH",
      },
      session,
    );
  }

  updateIntegration(session: Session, integration: IntegrationConnection) {
    return this.request<void>(
      `/integrations/${integration.id}`,
      {
        method: "PUT",
        body: JSON.stringify(integration),
      },
      session,
    );
  }

  testIntegration(session: Session, integrationId: string) {
    return this.request<void>(
      `/integrations/${integrationId}/test`,
      { method: "POST" },
      session,
    );
  }

  async resetDemo() {
    throw new Error("Reset disponível apenas no modo local.");
  }
}
