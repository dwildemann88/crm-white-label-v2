export type RoleKey = "super_admin" | "manager" | "sales" | "sdr";
export type LeadPriority = "Baixa" | "Média" | "Alta" | "Urgente";
export type LeadTemperature = "Frio" | "Morno" | "Quente";
export type IntegrationProvider =
  | "meta"
  | "google"
  | "whatsapp"
  | "webhook"
  | "website";
export type IntegrationStatus = "connected" | "attention" | "disconnected";
export type MessageDirection = "inbound" | "outbound" | "internal";
export type MessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "location"
  | "contact"
  | "interactive";

export type MessageStatus =
  | "received"
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed";
export type CustomFieldType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "date"
  | "datetime"
  | "select"
  | "boolean"
  | "phone"
  | "email"
  | "url";
export type CustomFieldValue = string | number | boolean;

export type LeadFieldKey =
  | "name"
  | "company"
  | "phone"
  | "email"
  | "city"
  | "origin"
  | "campaign"
  | "priority"
  | "temperature"
  | "score"
  | "value"
  | "notes";

export type LeadFieldType =
  | "text"
  | "email"
  | "phone"
  | "number"
  | "select"
  | "textarea";

export interface Branding {
  productName: string;
  companyName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  backgroundColor: string;
  loginHeadline: string;
}

export interface Organization {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  branding: Branding;
  enabledModules: string[];
  createdAt: string;
}

export interface User {
  id: string;
  organizationId: string;
  name: string;
  initials: string;
  email: string;
  role: RoleKey;
  roleLabel: string;
  active: boolean;
  color: string;
  pipelineIds: string[];
  permissions?: string[];
  isPlatformAdmin?: boolean;
  demoPassword?: string;
}

export interface Session {
  token: string;
  userId: string;
  organizationId: string;
  expiresAt: string;
}

export interface Pipeline {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  active: boolean;
}

export interface PipelineStage {
  id: string;
  organizationId: string;
  pipelineId: string;
  name: string;
  color: string;
  order: number;
  kind: "open" | "won" | "lost";
}

export interface Lead {
  id: string;
  organizationId: string;
  pipelineId: string;
  stageId: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  city: string;
  origin: string;
  campaign: string;
  priority: LeadPriority;
  temperature: LeadTemperature;
  score: number;
  ownerId: string;
  tags: string[];
  value: number;
  createdAt: string;
  updatedAt: string;
  lastContact: string;
  notes: string;
  customValues?: Record<string, CustomFieldValue>;
  rawPayload?: Record<string, unknown>;
}

export interface LeadHistory {
  id: string;
  organizationId: string;
  leadId: string;
  actorId: string;
  type: "created" | "updated" | "moved" | "assigned" | "note" | "message";
  description: string;
  fromStageId?: string;
  toStageId?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  date: string;
  time: string;
  type: string;
  ownerId: string;
  leadId: string | null;
  priority: LeadPriority;
  done: boolean;
  reminderMinutes: number;
  createdAt: string;
  reminderNotifiedAt?: string;
}

export interface LeadFieldDefinition {
  id: string;
  organizationId: string;
  key: LeadFieldKey;
  label: string;
  type: LeadFieldType;
  required: boolean;
  active: boolean;
  showInTable: boolean;
  position: number;
  locked: boolean;
}

export interface CustomFieldDefinition {
  id: string;
  organizationId: string;
  name: string;
  key: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
  active: boolean;
  showInTable: boolean;
  position: number;
  pipelineId: string | null;
}

export interface TagDefinition {
  id: string;
  organizationId: string;
  name: string;
  color: string;
}

export interface WhatsAppWindow {
  isOpen: boolean;
  requiresTemplate: boolean;
  lastInboundAt: string | null;
  expiresAt: string | null;
}

export interface Conversation {
  id: string;
  organizationId: string;
  leadId: string;
  channel: "whatsapp";
  ownerId: string;
  status: "open" | "waiting" | "closed";
  unread: number;
  lastMessageAt: string;
  signaturePending: boolean;
  whatsappWindow?: WhatsAppWindow;
}

export interface MessageMedia {
  externalId?: string;
  storagePath?: string;
  url?: string;
  mimeType?: string;
  fileName?: string;
  pending: boolean;
}

export interface Message {
  id: string;
  organizationId: string;
  conversationId: string;
  senderUserId: string | null;
  direction: MessageDirection;
  body: string;
  status: MessageStatus;
  createdAt: string;
  messageType?: MessageType;
  media?: MessageMedia;
}


export interface WhatsAppMediaPrepareInput {
  file: File;
  caption?: string;
}

export interface WhatsAppPreparedMediaMessage {
  messageId: string;
  conversationId: string;
  messageType: Extract<
    MessageType,
    "image" | "audio" | "video" | "document"
  >;
  bucket: string;
  storagePath: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  status: "queued";
}

export interface WhatsAppTemplateSendInput {
  templateName: string;
  languageCode: string;
  parameters: string[];
  bodyPreview: string;
}

export interface IntegrationFieldMap {
  source: string;
  target: string;
}

export interface IntegrationConnection {
  id: string;
  organizationId: string;
  provider: IntegrationProvider;
  name: string;
  description: string;
  status: IntegrationStatus;
  accountLabel: string;
  endpoint: string;
  secretMasked: string;
  targetPipelineId: string;
  targetStageId: string;
  defaultOwnerId: string | null;
  fieldMappings: IntegrationFieldMap[];
  lastEventAt: string | null;
  lastTestAt: string | null;
  eventsReceived: number;
  errors: string[];
}

export interface NotificationItem {
  id: string;
  organizationId: string;
  userId: string | null;
  title: string;
  description: string;
  read: boolean;
  createdAt: string;
}

export interface CrmDatabase {
  organizations: Organization[];
  users: User[];
  pipelines: Pipeline[];
  stages: PipelineStage[];
  leads: Lead[];
  histories: LeadHistory[];
  tasks: Task[];
  leadFields: LeadFieldDefinition[];
  customFields: CustomFieldDefinition[];
  tags: TagDefinition[];
  conversations: Conversation[];
  messages: Message[];
  integrations: IntegrationConnection[];
  notifications: NotificationItem[];
}

export interface AppSnapshot extends CrmDatabase {
  session: Session | null;
}

export interface LeadFilters {
  search?: string;
  origin?: string;
  stageId?: string;
  ownerId?: string;
  priority?: string;
  tag?: string;
}

export type LeadInput = Omit<
  Lead,
  "id" | "organizationId" | "createdAt" | "updatedAt" | "lastContact"
> & {
  id?: string;
};
export type TaskInput = Omit<
  Task,
  "id" | "organizationId" | "createdAt" | "done"
> & { id?: string; done?: boolean };
export type UserInput = Omit<User, "id" | "organizationId" | "initials"> & {
  id?: string;
};