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
  WhatsAppMediaPrepareInput,
  WhatsAppPreparedMediaMessage,
  WhatsAppTemplateSendInput,
} from "../core/types";

export interface CrmGateway {
  restoreSession(): Promise<Session | null>;
  login(email: string, password: string): Promise<Session>;
  logout(): Promise<void>;
  snapshot(session: Session): Promise<AppSnapshot>;

  saveLead(session: Session, input: LeadInput): Promise<Lead>;
  moveLead(session: Session, leadId: string, stageId: string): Promise<void>;
  addLeadNote(session: Session, leadId: string, note: string): Promise<void>;

  saveTask(session: Session, input: TaskInput): Promise<Task>;
  toggleTask(session: Session, taskId: string): Promise<void>;
  deleteTask(session: Session, taskId: string): Promise<void>;

  saveUser(session: Session, input: UserInput): Promise<User>;
  toggleUser(session: Session, userId: string): Promise<void>;

  savePipeline(session: Session, pipeline: Pipeline): Promise<void>;
  deletePipeline(session: Session, pipelineId: string): Promise<void>;
  saveStage(session: Session, stage: PipelineStage): Promise<void>;
  deleteStage(session: Session, stageId: string): Promise<void>;
  saveCustomField(
    session: Session,
    field: CustomFieldDefinition,
  ): Promise<void>;
  deleteCustomField(session: Session, fieldId: string): Promise<void>;
  saveTag(session: Session, tag: TagDefinition): Promise<void>;
  deleteTag(session: Session, tagId: string): Promise<void>;

  updateBranding(session: Session, branding: Branding): Promise<void>;
  saveOrganization(session: Session, organization: Organization): Promise<void>;
  duplicateOrganization(
    session: Session,
    sourceId: string,
    name: string,
    slug: string,
  ): Promise<void>;
  switchOrganization(
    session: Session,
    organizationId: string,
  ): Promise<Session>;
openWhatsAppConversation(
    session: Session,
    leadId: string,
  ): Promise<string>;

  sendMessage(
    session: Session,
    conversationId: string,
    body: string,
  ): Promise<void>;

  prepareWhatsAppMedia?(
    session: Session,
    conversationId: string,
    input: WhatsAppMediaPrepareInput,
  ): Promise<WhatsAppPreparedMediaMessage>;
  sendWhatsAppTemplate?(
    session: Session,
    conversationId: string,
    input: WhatsAppTemplateSendInput,
  ): Promise<void>;
  transferConversation(
    session: Session,
    conversationId: string,
    userId: string,
  ): Promise<void>;
  markConversationRead(session: Session, conversationId: string): Promise<void>;

  markNotificationRead(
    session: Session,
    notificationId?: string,
  ): Promise<void>;

  updateIntegration(
    session: Session,
    integration: IntegrationConnection,
  ): Promise<void>;
  testIntegration(session: Session, integrationId: string): Promise<void>;

  resetDemo(): Promise<void>;
}
