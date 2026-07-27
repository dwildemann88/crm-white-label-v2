import type { CrmGateway } from "./CrmGateway";
import type {
  AppSnapshot,
  Branding,
  CustomFieldDefinition,
  CustomFieldType,
  CustomFieldValue,
  IntegrationConnection,
  Lead,
  LeadHistory,
  LeadInput,
  LeadPriority,
  LeadTemperature,
  Message,
  MessageStatus,
  NotificationItem,
  Organization,
  Pipeline,
  PipelineStage,
  RoleKey,
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
import { supabase } from "./supabase/client";
import { getCrmBootstrap, type BootstrapMembership } from "./supabase/bootstrap";

const notReady = (feature: string): never => {
  throw new Error(`${feature} ainda não foi conectado ao Supabase.`);
};

const WHATSAPP_MEDIA_BUCKET = "crm-whatsapp-media";
const WHATSAPP_MEDIA_URL_TTL_SECONDS = 6 * 60 * 60;


type OutboundWhatsAppMediaType =
  WhatsAppPreparedMediaMessage["messageType"];

interface OutboundWhatsAppMediaDescriptor {
  messageType: OutboundWhatsAppMediaType;
  mimeType: string;
  maxBytes: number;
}

const OUTBOUND_WHATSAPP_MEDIA_LIMITS: Record<
  OutboundWhatsAppMediaType,
  number
> = {
  image: 5 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  document: 20 * 1024 * 1024,
};

const OUTBOUND_WHATSAPP_MIME_TYPES: Record<
  OutboundWhatsAppMediaType,
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

const OUTBOUND_WHATSAPP_MIME_BY_EXTENSION: Record<
  string,
  string
> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  aac: "audio/aac",
  amr: "audio/amr",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  mp4: "video/mp4",
  "3gp": "video/3gpp",
  txt: "text/plain",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function describeOutboundWhatsAppMedia(
  file: File,
): OutboundWhatsAppMediaDescriptor {
  if (!(file instanceof File)) {
    throw new Error(
      "Selecione um arquivo válido.",
    );
  }

  if (file.size <= 0) {
    throw new Error(
      "O arquivo selecionado está vazio.",
    );
  }

  const extension =
    file.name
      .split(".")
      .pop()
      ?.trim()
      .toLowerCase() ?? "";

  const mimeType =
    file.type
      .split(";")[0]
      .trim()
      .toLowerCase() ||
    OUTBOUND_WHATSAPP_MIME_BY_EXTENSION[
      extension
    ] ||
    "";

  const messageType = (
    Object.entries(
      OUTBOUND_WHATSAPP_MIME_TYPES,
    ) as Array<
      [
        OutboundWhatsAppMediaType,
        Set<string>,
      ]
    >
  ).find(([, mimeTypes]) =>
    mimeTypes.has(mimeType),
  )?.[0];

  if (!messageType) {
    throw new Error(
      "Este formato de arquivo não é aceito para envio pelo WhatsApp.",
    );
  }

  const maxBytes =
    OUTBOUND_WHATSAPP_MEDIA_LIMITS[
      messageType
    ];

  if (file.size > maxBytes) {
    const maxMegabytes =
      Math.floor(
        maxBytes /
          (1024 * 1024),
      );

    throw new Error(
      `O arquivo excede o limite inicial de ${maxMegabytes} MB para ${messageType === "image" ? "imagens" : messageType === "audio" ? "áudios" : messageType === "video" ? "vídeos" : "documentos"}.`,
    );
  }

  return {
    messageType,
    mimeType,
    maxBytes,
  };
}


async function readEdgeFunctionError(
  error: unknown,
  fallback: string,
): Promise<string> {
  const candidate =
    error as {
      message?: unknown;
      context?: unknown;
    };

  const context =
    candidate?.context;

  if (
    typeof Response !== "undefined" &&
    context instanceof Response
  ) {
    try {
      const payload =
        await context
          .clone()
          .json();

      if (
        payload &&
        typeof payload === "object" &&
        !Array.isArray(payload)
      ) {
        const record =
          payload as Record<
            string,
            unknown
          >;

        const backendMessage =
          [
            record.error,
            record.message,
            record.details,
            record.hint,
          ].find(
            (value) =>
              typeof value ===
                "string" &&
              value.trim(),
          );

        if (
          typeof backendMessage ===
          "string"
        ) {
          return backendMessage.trim();
        }
      }
    } catch {
      try {
        const responseText =
          await context
            .clone()
            .text();

        if (responseText.trim()) {
          return responseText
            .trim()
            .slice(0, 1200);
        }
      } catch {
        // Mantém o fallback abaixo.
      }
    }
  }

  if (
    typeof candidate?.message ===
      "string" &&
    candidate.message.trim()
  ) {
    return candidate.message.trim();
  }

  return fallback;
}


const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const mapRole = (code: string): RoleKey => {
  if (code === "commercial") return "sales";
  if (code === "manager" || code === "sdr" || code === "super_admin") {
    return code;
  }
  return "sales";
};

const mapPriority = (value: string): LeadPriority => {
  const priorities: Record<string, LeadPriority> = {
    low: "Baixa",
    medium: "Média",
    high: "Alta",
    urgent: "Urgente",
  };
  return priorities[value] ?? "Média";
};

const mapTemperature = (value: string): LeadTemperature => {
  const temperatures: Record<string, LeadTemperature> = {
    cold: "Frio",
    warm: "Morno",
    hot: "Quente",
  };
  return temperatures[value] ?? "Frio";
};
const priorityToDatabase = (
  value: LeadPriority,
): "low" | "medium" | "high" | "urgent" => {
  const priorities: Record<
    LeadPriority,
    "low" | "medium" | "high" | "urgent"
  > = {
    Baixa: "low",
    Média: "medium",
    Alta: "high",
    Urgente: "urgent",
  };

  return priorities[value];
};

const temperatureToDatabase = (
  value: LeadTemperature,
): "cold" | "warm" | "hot" => {
  const temperatures: Record<
    LeadTemperature,
    "cold" | "warm" | "hot"
  > = {
    Frio: "cold",
    Morno: "warm",
    Quente: "hot",
  };

  return temperatures[value];
};
const taskTypeToDatabase = (value: string): string => {
  const taskTypes: Record<string, string> = {
    ligacao: "call",
    whatsapp: "whatsapp",
    visita: "visit",
    reuniao: "meeting",
    proposta: "proposal",
    "follow-up": "follow_up",
    followup: "follow_up",
    "tarefa interna": "internal",
    interna: "internal",
  };

  return (
    taskTypes[normalizeLabel(value)] ??
    "other"
  );
};

function taskDateTimeToIso(
  date: string,
  time: string,
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(
      "Informe uma data válida para a tarefa.",
    );
  }

  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new Error(
      "Informe um horário válido para a tarefa.",
    );
  }

  const parsed = new Date(
    `${date}T${time}:00`,
  );

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      "A data e o horário da tarefa são inválidos.",
    );
  }

  return parsed.toISOString();
}

const normalizeLabel = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const toSlug = (value: string): string =>
  normalizeLabel(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";

const toCode = (value: string): string =>
  normalizeLabel(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "item";

const roleCodeToDatabase = (role: RoleKey): string => {
  if (role === "sales") return "commercial";
  return role;
};

async function uniqueOrganizationValue(
  table: "pipelines" | "tags" | "custom_fields",
  organizationId: string,
  column: "slug" | "code",
  preferred: string,
): Promise<string> {
  const base = column === "slug" ? toSlug(preferred) : toCode(preferred);
  const existing = await requireData<Array<Record<string, string>>>(
    supabase
      .from(table)
      .select(column)
      .eq("organization_id", organizationId)
      .like(column, `${base}%`),
  );
  const values = new Set(existing.map((item) => item[column]));
  if (!values.has(base)) return base;

  let suffix = 2;
  while (values.has(`${base}_${suffix}`) || values.has(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return column === "slug" ? `${base}-${suffix}` : `${base}_${suffix}`;
}

const sourceCodeByLabel: Record<string, string> = {
  "entrada manual": "manual",
  "cadastro manual": "manual",
  "meta ads": "meta_lead_ads",
  "meta lead ads": "meta_lead_ads",
  "google ads": "google_lead_form",
  "google lead form": "google_lead_form",
  "landing page": "landing_page",
  "simulador projem": "simulador_projem",
  whatsapp: "whatsapp",
  indicacao: "indicacao",
  evento: "outra_origem",
  "outra origem": "outra_origem",
};

function splitCityAndState(value: string): {
  city: string | null;
  state: string | null;
} {
  const cleaned = value.trim();

  const match = cleaned.match(
    /^(.+?)(?:\s*[-/]\s*)([A-Za-z]{2})$/,
  );

  if (!match) {
    return {
      city: cleaned || null,
      state: null,
    };
  }

  return {
    city: match[1].trim() || null,
    state: match[2].toUpperCase(),
  };
}

const mapFieldType = (value: string): CustomFieldType => {
  if (value === "number" || value === "currency") return "number";
  if (value === "date" || value === "datetime") return "date";
  if (value === "select" || value === "multiselect") return "select";
  if (value === "boolean") return "boolean";
  return "text";
};

const mapMessageStatus = (value: string): MessageStatus => {
  if (
    value === "received" ||
    value === "queued" ||
    value === "sent" ||
    value === "delivered" ||
    value === "read" ||
    value === "failed"
  ) {
    return value;
  }
  return "sent";
};

const mapMessageType = (
  value: string,
): NonNullable<Message["messageType"]> => {
  if (
    value === "image" ||
    value === "audio" ||
    value === "video" ||
    value === "document" ||
    value === "location" ||
    value === "contact" ||
    value === "interactive"
  ) {
    return value;
  }

  return "text";
};

const datePart = (value: string) => value.slice(0, 10);
const timePart = (value: string) => value.slice(11, 16);

async function requireData<T>(
  request: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T> {
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("O Supabase não retornou os dados esperados.");
  return data;
}

export class SupabaseCrmGateway implements CrmGateway {
  private async buildSession(organizationId?: string): Promise<Session> {
    const [{ data: authData, error: authError }, bootstrap] = await Promise.all([
      supabase.auth.getSession(),
      getCrmBootstrap(),
    ]);

    if (authError) throw new Error(authError.message);
    if (!authData.session) throw new Error("Sessão do Supabase não encontrada.");

    const membership = organizationId
      ? bootstrap.memberships.find(
          (item) => item.organization.id === organizationId,
        )
      : bootstrap.memberships[0];

    if (!membership) {
      throw new Error("A empresa selecionada não está disponível para o usuário.");
    }

    return {
      token: authData.session.access_token,
      userId: bootstrap.user.id,
      organizationId: membership.organization.id,
      expiresAt: new Date(
        (authData.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600) *
          1000,
      ).toISOString(),
    };
  }

  async restoreSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    if (!data.session) return null;
    return this.buildSession();
  }

  async login(email: string, password: string): Promise<Session> {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(error.message);
    return this.buildSession();
  }

  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }

  async snapshot(session: Session): Promise<AppSnapshot> {
    const bootstrap = await getCrmBootstrap();
    const membership = bootstrap.memberships.find(
      (item) => item.organization.id === session.organizationId,
    );
    if (!membership) throw new Error("Empresa da sessão não encontrada.");

    const organizationId = membership.organization.id;

    const [
      members,
  pipelineAccess,
  pipelinesData,
  stagesData,
  contactsData,
  sourcesData,
  leadsData,
  tagsData,
  leadTagsData,
  fieldsData,
  fieldOptionsData,
  customValuesData,
  stageHistoryData,
  assignmentHistoryData,
  leadNotesData,
  tasksData,
  remindersData,
  conversationsData,
  messagesData,
  conversationStatesData,
  notificationsData,
    ] = await Promise.all([
      requireData<any[]>(
        supabase
          .from("organization_members")
          .select(
            "organization_id,user_id,status,profiles(id,email,full_name,avatar_url),roles(id,name,code)",
          )
          .eq("organization_id", organizationId),
      ),
      requireData<any[]>(
        supabase
          .from("pipeline_user_access")
          .select("pipeline_id,user_id,access_level,stage_scope")
          .eq("organization_id", organizationId),
      ),
      requireData<any[]>(
        supabase
          .from("pipelines")
          .select("id,organization_id,name,description,status")
          .eq("organization_id", organizationId)
          .order("name"),
      ),
      requireData<any[]>(
        supabase
          .from("pipeline_stages")
          .select("id,organization_id,pipeline_id,name,color,position,category")
          .eq("organization_id", organizationId)
          .order("position"),
      ),
      requireData<any[]>(
        supabase
          .from("contacts")
          .select("id,full_name,phone,email,company_name,city,state,notes",)
          .eq("organization_id", organizationId),
      ),
      requireData<any[]>(
        supabase
          .from("lead_sources")
          .select("id,name")
          .eq("organization_id", organizationId),
      ),
      requireData<any[]>(
        supabase
          .from("leads")
          .select(
            "id,organization_id,contact_id,pipeline_id,stage_id,source_id,title,assigned_to,priority,temperature,score,estimated_value,utm_campaign,raw_payload,created_at,updated_at,last_activity_at,first_contact_at,lost_reason",
          )
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false }),
      ),
      requireData<any[]>(
        supabase
          .from("tags")
          .select("id,organization_id,name,color")
          .eq("organization_id", organizationId),
      ),
      requireData<any[]>(
        supabase
          .from("lead_tags")
          .select("lead_id,tag_id")
          .eq("organization_id", organizationId),
      ),
      requireData<any[]>(
        supabase
          .from("custom_fields")
          .select(
            "id,organization_id,name,code,field_type,is_required,is_active,show_in_table,position",
          )
          .eq("organization_id", organizationId)
          .order("position"),
      ),
      requireData<any[]>(
        supabase
          .from("custom_field_options")
          .select("field_id,label,position")
          .eq("organization_id", organizationId)
          .order("position"),
      ),
      requireData<any[]>(
        supabase
          .from("lead_custom_values")
          .select(
            "lead_id,field_id,value_text,value_number,value_boolean,value_date,value_timestamp,value_json",
          )
          .eq("organization_id", organizationId),
      ),
      requireData<any[]>(
        supabase
          .from("lead_stage_history")
          .select(
            "id,lead_id,stage_id,entered_at,entered_by,exited_at,duration_seconds",
          )
          .eq("organization_id", organizationId),
      ),
      requireData<any[]>(
        supabase
          .from("lead_assignment_history")
          .select(
            "id,lead_id,previous_user_id,new_user_id,changed_by,reason,changed_at",
          )
          .eq("organization_id", organizationId),
      ),
       requireData<any[]>(
        supabase
          .from("lead_notes")
          .select(
            "id,organization_id,lead_id,author_id,body,created_at",
          )
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false }),
      ),
      requireData<any[]>(
        supabase
          .from("tasks")
          .select(
            "id,organization_id,lead_id,title,description,task_type,status,priority,assigned_to,starts_at,due_at,created_at",
          )
          .eq("organization_id", organizationId)
          .order("starts_at"),
      ),
      requireData<any[]>(
  supabase
    .from("task_reminders")
    .select(
      "task_id,remind_at,status,sent_at,created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", {
      ascending: false,
    }),
),
      requireData<any[]>(
        supabase
          .from("conversations")
          .select(
            "id,organization_id,lead_id,assigned_to,status,last_message_at,created_at",
          )
          .eq("organization_id", organizationId)
          .eq("channel", "whatsapp")
          .order("last_message_at", { ascending: false, nullsFirst: false }),
      ),
      requireData<any[]>(
        supabase
          .from("messages")
          .select(
            "id,organization_id,conversation_id,sender_user_id,direction,body,status,sent_at,created_at,external_media_id,media_storage_path,mime_type,file_name,message_type,metadata",
          )
          .eq("organization_id", organizationId)
          .order("sent_at"),
      ),
      requireData<any[]>(
        supabase
          .from("conversation_user_state")
          .select("conversation_id,user_id,last_read_at")
          .eq("organization_id", organizationId)
          .eq("user_id", session.userId),
      ),
      requireData<any[]>(
        supabase
          .from("notifications")
          .select("id,organization_id,user_id,title,message,read_at,created_at")
          .eq("organization_id", organizationId)
          .eq("user_id", session.userId)
          .order("created_at", { ascending: false }),
      ),
    ]);

    const mediaPaths = Array.from(
      new Set(
        messagesData
          .map((item) =>
            typeof item.media_storage_path === "string"
              ? item.media_storage_path.trim()
              : "",
          )
          .filter(Boolean),
      ),
    );

    const signedMediaUrlByPath =
      new Map<string, string>();

    if (mediaPaths.length > 0) {
      const {
        data: signedMediaData,
        error: signedMediaError,
      } = await supabase.storage
        .from(WHATSAPP_MEDIA_BUCKET)
        .createSignedUrls(
          mediaPaths,
          WHATSAPP_MEDIA_URL_TTL_SECONDS,
        );

      if (signedMediaError) {
        console.warn(
          "Não foi possível assinar as mídias do WhatsApp:",
          signedMediaError,
        );
      } else {
        for (const item of signedMediaData ?? []) {
          if (
            typeof item.path === "string" &&
            typeof item.signedUrl === "string"
          ) {
            signedMediaUrlByPath.set(
              item.path,
              item.signedUrl,
            );
          }
        }
      }
    }

    const pipelineIds = pipelinesData.map((item) => item.id as string);
    const accessByUser = new Map<string, string[]>();
    for (const item of pipelineAccess) {
      const current = accessByUser.get(item.user_id) ?? [];
      current.push(item.pipeline_id);
      accessByUser.set(item.user_id, current);
    }

    const users: User[] = members.map((item) => {
      const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
      const role = Array.isArray(item.roles) ? item.roles[0] : item.roles;
      const roleKey = mapRole(role?.code ?? "commercial");
      const name = profile?.full_name || profile?.email || "Usuário";
      return {
        id: item.user_id,
        organizationId,
        name,
        initials: initials(name),
        email: profile?.email ?? "",
        role: roleKey,
        roleLabel: role?.name ?? "Usuário",
        active: item.status === "active",
        color: roleKey === "super_admin" ? "#F5C400" : "#64748B",
        pipelineIds:
          roleKey === "super_admin" || roleKey === "manager"
            ? pipelineIds
            : accessByUser.get(item.user_id) ?? [],
        permissions:
          item.user_id === bootstrap.user.id ? membership.permissions : undefined,
        isPlatformAdmin:
          item.user_id === bootstrap.user.id
            ? bootstrap.user.is_platform_admin === true
            : false,
      };
    });

    const organizations: Organization[] = bootstrap.memberships.map((item) =>
      this.mapOrganization(item),
    );

    const pipelines: Pipeline[] = pipelinesData.map((item) => ({
      id: item.id,
      organizationId: item.organization_id,
      name: item.name,
      description: item.description ?? "",
      active: item.status === "active",
    }));

    const stages: PipelineStage[] = stagesData.map((item) => ({
      id: item.id,
      organizationId: item.organization_id,
      pipelineId: item.pipeline_id,
      name: item.name,
      color: item.color,
      order: item.position,
      kind: item.category,
    }));

    const contactsById = new Map(contactsData.map((item) => [item.id, item]));
    const sourcesById = new Map(sourcesData.map((item) => [item.id, item.name]));
    const fieldById = new Map(fieldsData.map((item) => [item.id, item]));
    const tagNameById = new Map(
  tagsData.map((item) => [item.id, item.name]),
);

const tagsByLead = new Map<string, string[]>();

for (const item of leadTagsData) {
  const tagName = tagNameById.get(item.tag_id);

  if (!tagName) continue;

  const current =
    tagsByLead.get(item.lead_id) ?? [];

  current.push(tagName);

  tagsByLead.set(item.lead_id, current);
}

    const customValuesByLead = new Map<string, Record<string, CustomFieldValue>>();
    for (const item of customValuesData) {
      const field = fieldById.get(item.field_id);
      if (!field) continue;
      const current = customValuesByLead.get(item.lead_id) ?? {};
      let value: CustomFieldValue | undefined;
      if (item.value_text !== null) value = item.value_text;
      else if (item.value_number !== null) value = Number(item.value_number);
      else if (item.value_boolean !== null) value = item.value_boolean;
      else if (item.value_date !== null) value = item.value_date;
      else if (item.value_timestamp !== null) value = item.value_timestamp;
      else if (Array.isArray(item.value_json)) value = item.value_json.join(", ");
      if (value !== undefined) current[field.code] = value;
      customValuesByLead.set(item.lead_id, current);
    }

    const leads: Lead[] = leadsData.map((item) => {
      const contact = contactsById.get(item.contact_id);
      return {
        id: item.id,
        organizationId: item.organization_id,
        pipelineId: item.pipeline_id,
        stageId: item.stage_id,
        name: contact?.full_name ?? item.title ?? "Lead",
        company: contact?.company_name ?? "",
        phone: contact?.phone ?? "",
        email: contact?.email ?? "",
        city: [
  contact?.city,
  contact?.state,
]
  .filter(Boolean)
  .join("/"),
        origin: sourcesById.get(item.source_id) ?? "Não informada",
        campaign: item.utm_campaign ?? "",
        priority: mapPriority(item.priority),
        temperature: mapTemperature(item.temperature),
        score: item.score ?? 0,
        ownerId: item.assigned_to ?? "",
        tags: tagsByLead.get(item.id) ?? [],
        value: Number(item.estimated_value ?? 0),
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        lastContact:
          item.first_contact_at ?? item.last_activity_at ?? item.updated_at,
        notes:
  contact?.notes ||
  item.raw_payload?.notes ||
  item.lost_reason ||
  "",
        customValues: customValuesByLead.get(item.id) ?? {},
        rawPayload: item.raw_payload ?? {},
      };
    });

    const histories: LeadHistory[] = [
      ...leadNotesData.map((item) => ({
        id: item.id,
        organizationId: item.organization_id,
        leadId: item.lead_id,
        actorId: item.author_id ?? "",
        type: "note" as const,
        description: item.body,
        createdAt: item.created_at,
      })),

      ...stageHistoryData.map((item) => ({
        id: item.id,
        organizationId,
        leadId: item.lead_id,
        actorId: item.entered_by ?? "",
        type: "moved" as const,
        description: "Lead entrou em uma nova etapa.",
        toStageId: item.stage_id,
        createdAt: item.entered_at,
      })),

      ...assignmentHistoryData.map((item) => ({
        id: item.id,
        organizationId,
        leadId: item.lead_id,
        actorId: item.changed_by ?? "",
        type: "assigned" as const,
        description: item.reason || "Responsável pelo lead alterado.",
        createdAt: item.changed_at,
      })),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    );


   const reminderByTask = new Map<string, any>();

for (const reminder of remindersData) {
  if (reminder.status === "cancelled") {
    continue;
  }

  if (!reminderByTask.has(reminder.task_id)) {
    reminderByTask.set(
      reminder.task_id,
      reminder,
    );
  }
}

    const tasks: Task[] = tasksData.map((item) => {
      const reminder = reminderByTask.get(item.id);
      const startsAt = new Date(item.starts_at).getTime();
      const remindAt = reminder ? new Date(reminder.remind_at).getTime() : startsAt;
      return {
        id: item.id,
        organizationId: item.organization_id,
        title: item.title,
        description: item.description ?? "",
        date: datePart(item.starts_at),
        time: timePart(item.starts_at),
        type: item.task_type,
        ownerId: item.assigned_to,
        leadId: item.lead_id,
        priority: mapPriority(item.priority),
        done: item.status === "completed",
        reminderMinutes: Math.max(0, Math.round((startsAt - remindAt) / 60_000)),
        createdAt: item.created_at,
        reminderNotifiedAt: reminder?.sent_at ?? undefined,
      };
    });

    const customFields: CustomFieldDefinition[] = fieldsData.map((item) => ({
      id: item.id,
      organizationId: item.organization_id,
      name: item.name,
      key: item.code,
      type: mapFieldType(item.field_type),
      options: fieldOptionsData
        .filter((option) => option.field_id === item.id)
        .map((option) => option.label),
      required: item.is_required,
      active: item.is_active,
      showInTable: item.show_in_table,
    }));

    const tags: TagDefinition[] = tagsData.map((item) => ({
      id: item.id,
      organizationId: item.organization_id,
      name: item.name,
      color: item.color,
    }));

    const stateByConversation = new Map(
      conversationStatesData.map((item) => [item.conversation_id, item]),
    );

    const lastInboundByConversation = new Map<string, string>();

    for (const message of messagesData) {
      if (message.direction !== "inbound") {
        continue;
      }

      const timestamp =
        message.sent_at ??
        message.created_at;

      if (!timestamp) {
        continue;
      }

      const current =
        lastInboundByConversation.get(
          message.conversation_id,
        );

      if (
        !current ||
        new Date(timestamp).getTime() >
          new Date(current).getTime()
      ) {
        lastInboundByConversation.set(
          message.conversation_id,
          timestamp,
        );
      }
    }

    const conversations = conversationsData.map((item) => {
      const state = stateByConversation.get(item.id);
      const lastRead = state?.last_read_at
        ? new Date(state.last_read_at).getTime()
        : 0;
      const unread = messagesData.filter(
        (message) =>
          message.conversation_id === item.id &&
          message.direction === "inbound" &&
          new Date(
            message.sent_at ??
              message.created_at,
          ).getTime() > lastRead,
      ).length;

      const lastInboundAt =
        lastInboundByConversation.get(
          item.id,
        ) ?? null;

      const windowExpiresAt =
        lastInboundAt
          ? new Date(
              new Date(
                lastInboundAt,
              ).getTime() +
                24 * 60 * 60 * 1000,
            ).toISOString()
          : null;

      const windowIsOpen =
        windowExpiresAt !== null &&
        Date.now() <
          new Date(
            windowExpiresAt,
          ).getTime();

      return {
        id: item.id,
        organizationId: item.organization_id,
        leadId: item.lead_id ?? "",
        channel: "whatsapp" as const,
        ownerId: item.assigned_to ?? "",
        status:
          item.status === "pending"
            ? ("waiting" as const)
            : item.status === "resolved" || item.status === "archived"
              ? ("closed" as const)
              : ("open" as const),
        unread,
        lastMessageAt:
          item.last_message_at ??
          item.created_at,
        signaturePending: false,
        whatsappWindow: {
          isOpen: windowIsOpen,
          requiresTemplate:
            !windowIsOpen,
          lastInboundAt,
          expiresAt:
            windowExpiresAt,
        },
      };
    });

    const messages: Message[] = messagesData.map((item) => {
      const messageType =
        mapMessageType(
          item.message_type ?? "text",
        );

      const storagePath =
        typeof item.media_storage_path === "string"
          ? item.media_storage_path.trim()
          : "";

      const externalMediaId =
        typeof item.external_media_id === "string"
          ? item.external_media_id.trim()
          : "";

      const signedUrl =
        storagePath
          ? signedMediaUrlByPath.get(
              storagePath,
            ) ?? ""
          : "";

      const hasMedia =
        Boolean(
          storagePath ||
          externalMediaId,
        );

      return {
        id: item.id,
        organizationId:
          item.organization_id,
        conversationId:
          item.conversation_id,
        senderUserId:
          item.sender_user_id,
        direction:
          item.direction,
        body:
          item.body ??
          item.file_name ??
          (messageType === "image"
            ? "Imagem recebida"
            : messageType === "audio"
              ? "Áudio recebido"
              : messageType === "video"
                ? "Vídeo recebido"
                : messageType === "document"
                  ? "Documento recebido"
                  : "Mensagem"),
        status:
          mapMessageStatus(
            item.status,
          ),
        createdAt:
          item.sent_at ??
          item.created_at,
        messageType,
        media: hasMedia
          ? {
              externalId:
                externalMediaId ||
                undefined,
              storagePath:
                storagePath ||
                undefined,
              url:
                signedUrl ||
                undefined,
              mimeType:
                item.mime_type ??
                undefined,
              fileName:
                item.file_name ??
                undefined,
              pending:
                !storagePath ||
                !signedUrl,
            }
          : undefined,
      };
    });

    const notifications: NotificationItem[] = notificationsData.map((item) => ({
      id: item.id,
      organizationId: item.organization_id,
      userId: item.user_id,
      title: item.title,
      description: item.message ?? "",
      read: item.read_at !== null,
      createdAt: item.created_at,
    }));

    return {
      session,
      organizations,
      users,
      pipelines,
      stages,
      leads,
      histories,
      tasks,
      customFields,
      tags,
      conversations,
      messages,
      integrations: [],
      notifications,
    };
  }

  private mapOrganization(membership: BootstrapMembership): Organization {
    return {
      id: membership.organization.id,
      slug: membership.organization.slug,
      name: membership.organization.name,
      active: membership.organization.status === "active",
      branding: {
        productName: membership.branding.crm_name,
        companyName: membership.organization.name,
        logoUrl: membership.branding.logo_url ?? "",
        primaryColor: membership.branding.primary_color,
        secondaryColor: membership.branding.secondary_color,
        accentColor: membership.branding.accent_color,
        backgroundColor: membership.branding.background_color,
        loginHeadline: "Gestão comercial centralizada e segura.",
      },
      enabledModules: [
        "dashboard",
        "kanban",
        "leads",
        "calendar",
        "inbox",
        "analytics",
        "integrations",
        "admin",
        "developer",
      ],
      createdAt: membership.organization.created_at,
    };
  }

  async saveLead(
  session: Session,
  input: LeadInput,
): Promise<Lead> {
  

  const sourceRows = await requireData<
    Array<{
      id: string;
      name: string;
      code: string;
    }>
  >(
    supabase
      .from("lead_sources")
      .select("id,name,code")
      .eq("organization_id", session.organizationId)
      .eq("is_active", true),
  );

  const normalizedOrigin = normalizeLabel(input.origin);
  const expectedCode =
    sourceCodeByLabel[normalizedOrigin];

  const source =
    sourceRows.find(
      (item) => item.code === expectedCode,
    ) ??
    sourceRows.find(
      (item) =>
        normalizeLabel(item.name) === normalizedOrigin,
    ) ??
    sourceRows.find((item) => item.code === "manual");

  if (!source) {
    throw new Error(
      "Nenhuma origem válida foi encontrada para o lead.",
    );
  }

  const location = splitCityAndState(input.city);
if (input.id) {
  const { data, error } = await supabase.rpc(
    "update_crm_lead_full",
    {
      p_organization_id:
        session.organizationId,

      p_lead_id:
        input.id,

      p_pipeline_id:
        input.pipelineId,

      p_stage_id:
        input.stageId,

      p_source_id:
        source.id,

      p_full_name:
        input.name.trim(),

      p_phone:
        input.phone.trim() || null,

      p_email:
        input.email.trim() || null,

      p_city:
        location.city,

      p_state:
        location.state,

      p_title:
        input.name.trim(),

      p_assigned_to:
        input.ownerId || null,

      p_priority:
        priorityToDatabase(
          input.priority,
        ),

      p_temperature:
        temperatureToDatabase(
          input.temperature,
        ),

      p_score:
        Number(input.score),

      p_estimated_value:
        Number(input.value) > 0
          ? Number(input.value)
          : null,

      p_company_name:
        input.company.trim() || null,

      p_notes:
        input.notes.trim() || null,

      p_utm_campaign:
        input.campaign.trim() || null,

      p_tag_names:
        input.tags,

      p_custom_values:
        input.customValues ?? {},
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  const result = data as {
    lead_id?: string;
    updated?: boolean;
  };

  if (
    !result.updated ||
    result.lead_id !== input.id
  ) {
    throw new Error(
      "O banco não confirmou a atualização do lead.",
    );
  }

  const updatedSnapshot =
    await this.snapshot(session);

  const updatedLead =
    updatedSnapshot.leads.find(
      (lead) => lead.id === input.id,
    );

  if (!updatedLead) {
    throw new Error(
      "O lead foi atualizado, mas não pôde ser recarregado.",
    );
  }

  return updatedLead;
}
  const { data, error } = await supabase.rpc(
    "create_crm_lead_full",
    {
      p_organization_id: session.organizationId,
      p_pipeline_id: input.pipelineId,
      p_stage_id: input.stageId,
      p_source_id: source.id,

      p_full_name: input.name.trim(),
      p_phone: input.phone.trim() || null,
      p_email: input.email.trim() || null,
      p_city: location.city,
      p_state: location.state,

      p_title: input.name.trim(),
      p_assigned_to: input.ownerId || null,

      p_priority: priorityToDatabase(
        input.priority,
      ),

      p_temperature: temperatureToDatabase(
        input.temperature,
      ),

      p_score: Number(input.score),

      p_monthly_bill: null,

      p_estimated_value:
        Number(input.value) > 0
          ? Number(input.value)
          : null,

      p_external_lead_id: null,

      p_raw_payload:
        input.rawPayload ?? {},

      p_company_name:
        input.company.trim() || null,

      p_notes:
        input.notes.trim() || null,

      p_utm_campaign:
        input.campaign.trim() || null,

      p_tag_names: input.tags,

      p_custom_values:
        input.customValues ?? {},
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  const result = data as {
    lead_id?: string;
    contact_id?: string;
    created?: boolean;
    enriched?: boolean;
    duplicate_external_id?: boolean;
  };

  if (result.duplicate_external_id) {
    throw new Error(
      "Esse lead já foi recebido anteriormente.",
    );
  }

  if (!result.created || !result.lead_id) {
    throw new Error(
      "O banco não confirmou a criação do lead.",
    );
  }

  const updatedSnapshot = await this.snapshot(session);

  const createdLead = updatedSnapshot.leads.find(
    (lead) => lead.id === result.lead_id,
  );

  if (!createdLead) {
    throw new Error(
      "O lead foi criado, mas não pôde ser recarregado.",
    );
  }

  return createdLead;
}
 async moveLead(
  session: Session,
  leadId: string,
  stageId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc(
    "move_crm_lead",
    {
      p_organization_id:
        session.organizationId,

      p_lead_id:
        leadId,

      p_stage_id:
        stageId,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  const result = data as {
    lead_id?: string;
    stage_id?: string;
    moved?: boolean;
    reason?: string;
  };

  if (
    result.moved !== true &&
    result.reason !== "same_stage"
  ) {
    throw new Error(
      "O banco não confirmou a movimentação do lead.",
    );
  }
}
  async addLeadNote(
    session: Session,
    leadId: string,
    note: string,
  ): Promise<void> {
    const cleanNote = note.trim();

    if (!cleanNote) {
      throw new Error("A observação está vazia.");
    }

    const { data, error } = await supabase.rpc(
      "add_crm_lead_note",
      {
        p_organization_id:
          session.organizationId,

        p_lead_id:
          leadId,

        p_note:
          cleanNote,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    const result = data as {
      note_id?: string;
      lead_id?: string;
      created?: boolean;
    };

    if (
      result.created !== true ||
      result.lead_id !== leadId ||
      !result.note_id
    ) {
      throw new Error(
        "O banco não confirmou o registro da observação.",
      );
    }
  }
  async saveTask(
  session: Session,
  input: TaskInput,
): Promise<Task> {
  const startsAt = taskDateTimeToIso(
    input.date,
    input.time,
  );

  // A interface atual não possui duração.
  // O banco aceita período zero: due_at = starts_at.
  const dueAt = startsAt;

  const commonParameters = {
    p_organization_id:
      session.organizationId,

    p_title:
      input.title.trim(),

    p_description:
      input.description.trim() || null,

    p_task_type:
      taskTypeToDatabase(input.type),

    p_priority:
      priorityToDatabase(input.priority),

    p_assigned_to:
      input.ownerId,

    p_lead_id:
      input.leadId || null,

    p_starts_at:
      startsAt,

    p_due_at:
      dueAt,

    p_reminder_minutes:
      Number(input.reminderMinutes),
  };

  const response = input.id
    ? await supabase.rpc(
        "update_crm_task",
        {
          ...commonParameters,
          p_task_id: input.id,
        },
      )
    : await supabase.rpc(
        "create_crm_task",
        commonParameters,
      );

  if (response.error) {
    throw new Error(response.error.message);
  }

  const result = response.data as {
    task_id?: string;
    created?: boolean;
    updated?: boolean;
  };

  const taskId =
    result.task_id ?? input.id;

  if (!taskId) {
    throw new Error(
      "O banco não retornou a tarefa salva.",
    );
  }

  if (
    input.id &&
    result.updated !== true
  ) {
    throw new Error(
      "O banco não confirmou a atualização da tarefa.",
    );
  }

  if (
    !input.id &&
    result.created !== true
  ) {
    throw new Error(
      "O banco não confirmou a criação da tarefa.",
    );
  }

  const updatedSnapshot =
    await this.snapshot(session);

  const savedTask =
    updatedSnapshot.tasks.find(
      (task) => task.id === taskId,
    );

  if (!savedTask) {
    throw new Error(
      "A tarefa foi salva, mas não pôde ser recarregada.",
    );
  }

  return savedTask;
}

  async toggleTask(
  session: Session,
  taskId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc(
    "toggle_crm_task",
    {
      p_organization_id:
        session.organizationId,

      p_task_id:
        taskId,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  const result = data as {
    task_id?: string;
    updated?: boolean;
  };

  if (
    result.updated !== true ||
    result.task_id !== taskId
  ) {
    throw new Error(
      "O banco não confirmou a atualização da tarefa.",
    );
  }
}

  async deleteTask(
  session: Session,
  taskId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc(
    "delete_crm_task",
    {
      p_organization_id:
        session.organizationId,

      p_task_id:
        taskId,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  const result = data as {
    task_id?: string;
    deleted?: boolean;
  };

  if (
    result.deleted !== true ||
    result.task_id !== taskId
  ) {
    throw new Error(
      "O banco não confirmou a exclusão da tarefa.",
    );
  }
}
  async saveUser(session: Session, input: UserInput): Promise<User> {
    const { data, error } = await supabase.functions.invoke(
      "admin-manage-crm-user",
      {
        body: {
          organization_id: session.organizationId,
          user_id: input.id ?? null,
          full_name: input.name.trim(),
          email: input.email.trim().toLowerCase(),
          role_code: roleCodeToDatabase(input.role),
          status: input.active ? "active" : "disabled",
          pipeline_ids: input.pipelineIds,
        },
      },
    );

    if (error) {
      throw new Error(
        await readEdgeFunctionError(
          error,
          "Não foi possível salvar o usuário.",
        ),
      );
    }

    const result = data as { user_id?: string; invited?: boolean };
    if (!result?.user_id) {
      throw new Error("O servidor não confirmou o usuário salvo.");
    }

    return {
      id: result.user_id,
      organizationId: session.organizationId,
      name: input.name.trim(),
      initials: initials(input.name),
      email: input.email.trim().toLowerCase(),
      role: input.role,
      roleLabel: input.roleLabel,
      active: input.active,
      color: input.color,
      pipelineIds: input.pipelineIds,
    };
  }

  async toggleUser(session: Session, userId: string): Promise<void> {
    const memberRows = await requireData<Array<{ status: string }>>(
      supabase
        .from("organization_members")
        .select("status")
        .eq("organization_id", session.organizationId)
        .eq("user_id", userId)
        .limit(1),
    );

    const currentStatus = memberRows[0]?.status;
    if (!currentStatus) throw new Error("Vínculo do usuário não encontrado.");

    const { error } = await supabase
      .from("organization_members")
      .update({ status: currentStatus === "active" ? "disabled" : "active" })
      .eq("organization_id", session.organizationId)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
  }
  async removeUser(
    session: Session,
    userId: string,
  ): Promise<void> {
    const { data, error } =
      await supabase.functions.invoke(
        "admin-manage-crm-user",
        {
          body: {
            action: "remove",
            organization_id:
              session.organizationId,
            user_id: userId,
          },
        },
      );

    if (error) {
      throw new Error(
        await readEdgeFunctionError(
          error,
          "Não foi possível remover o usuário.",
        ),
      );
    }

    const result = data as {
      ok?: boolean;
      removed?: boolean;
      user_id?: string;
    };

    if (
      result?.ok !== true ||
      result.removed !== true ||
      result.user_id !== userId
    ) {
      throw new Error(
        "O servidor não confirmou a remoção do usuário.",
      );
    }
  }
  async savePipeline(session: Session, pipeline: Pipeline): Promise<void> {
    if (pipeline.organizationId !== session.organizationId) {
      throw new Error("O funil não pertence à organização ativa.");
    }

    const payload = {
      name: pipeline.name.trim(),
      description: pipeline.description.trim() || null,
      status: pipeline.active ? "active" : "inactive",
    };

    if (isUuid(pipeline.id)) {
      const { data, error } = await supabase
        .from("pipelines")
        .update(payload)
        .eq("organization_id", session.organizationId)
        .eq("id", pipeline.id)
        .select("id");

      if (error) throw new Error(error.message);
      if (data?.length) return;
    }

    const slug = await uniqueOrganizationValue(
      "pipelines",
      session.organizationId,
      "slug",
      pipeline.name,
    );
    const { error } = await supabase.from("pipelines").insert({
      id: isUuid(pipeline.id) ? pipeline.id : undefined,
      organization_id: session.organizationId,
      name: payload.name,
      description: payload.description,
      slug,
      status: payload.status,
      is_default: false,
    });
    if (error) throw new Error(error.message);
  }

  async deletePipeline(session: Session, pipelineId: string): Promise<void> {
    const { error } = await supabase
      .from("pipelines")
      .delete()
      .eq("organization_id", session.organizationId)
      .eq("id", pipelineId);
    if (error) throw new Error(error.message);
  }

  async saveStage(session: Session, stage: PipelineStage): Promise<void> {
    if (stage.organizationId !== session.organizationId) {
      throw new Error("A etapa não pertence à organização ativa.");
    }

    const payload = {
      name: stage.name.trim(),
      color: stage.color,
      position: Math.max(1, stage.order),
      category: stage.kind,
      is_active: true,
    };

    if (isUuid(stage.id)) {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .update(payload)
        .eq("organization_id", session.organizationId)
        .eq("id", stage.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (data?.length) return;
    }

    const existingCodes = await requireData<Array<{ code: string }>>(
      supabase
        .from("pipeline_stages")
        .select("code")
        .eq("pipeline_id", stage.pipelineId),
    );
    const baseCode = toCode(stage.name);
    const codes = new Set(existingCodes.map((item) => item.code));
    let code = baseCode;
    let suffix = 2;
    while (codes.has(code)) code = `${baseCode}_${suffix++}`;

    const { error } = await supabase.from("pipeline_stages").insert({
      id: isUuid(stage.id) ? stage.id : undefined,
      organization_id: session.organizationId,
      pipeline_id: stage.pipelineId,
      name: payload.name,
      code,
      color: payload.color,
      position: payload.position,
      category: payload.category,
      probability: stage.kind === "won" ? 100 : stage.kind === "lost" ? 0 : 20,
      is_active: true,
      requires_loss_reason: stage.kind === "lost",
      requires_value: stage.kind === "won",
    });
    if (error) throw new Error(error.message);
  }

  async deleteStage(session: Session, stageId: string): Promise<void> {
    const { error } = await supabase
      .from("pipeline_stages")
      .delete()
      .eq("organization_id", session.organizationId)
      .eq("id", stageId);
    if (error) throw new Error(error.message);
  }

  async saveCustomField(
    session: Session,
    field: CustomFieldDefinition,
  ): Promise<void> {
    if (field.organizationId !== session.organizationId) {
      throw new Error("O campo não pertence à organização ativa.");
    }

    let fieldId = field.id;
    const code = toCode(field.key || field.name);
    const existing = isUuid(field.id)
      ? await requireData<Array<{ id: string; position: number }>>(
          supabase
            .from("custom_fields")
            .select("id,position")
            .eq("organization_id", session.organizationId)
            .eq("id", field.id),
        )
      : [];

    if (existing.length) {
      const { error } = await supabase
        .from("custom_fields")
        .update({
          name: field.name.trim(),
          code,
          field_type: field.type,
          is_required: field.required,
          is_active: field.active,
          show_in_table: field.showInTable,
          is_filterable: true,
        })
        .eq("organization_id", session.organizationId)
        .eq("id", field.id);
      if (error) throw new Error(error.message);
    } else {
      fieldId = isUuid(field.id) ? field.id : crypto.randomUUID();
      const countRows = await requireData<Array<{ position: number }>>(
        supabase
          .from("custom_fields")
          .select("position")
          .eq("organization_id", session.organizationId)
          .order("position", { ascending: false })
          .limit(1),
      );
      const uniqueCode = await uniqueOrganizationValue(
        "custom_fields",
        session.organizationId,
        "code",
        code,
      );
      const { error } = await supabase.from("custom_fields").insert({
        id: fieldId,
        organization_id: session.organizationId,
        pipeline_id: null,
        name: field.name.trim(),
        code: uniqueCode,
        field_type: field.type,
        config: {},
        position: (countRows[0]?.position ?? 0) + 1,
        is_required: field.required,
        is_active: field.active,
        is_filterable: true,
        show_in_table: field.showInTable,
        show_in_kanban: false,
      });
      if (error) throw new Error(error.message);
    }

    const { error: deleteOptionsError } = await supabase
      .from("custom_field_options")
      .delete()
      .eq("organization_id", session.organizationId)
      .eq("field_id", fieldId);
    if (deleteOptionsError) throw new Error(deleteOptionsError.message);

    if (field.type === "select" && field.options.length) {
      const { error } = await supabase.from("custom_field_options").insert(
        field.options
          .map((option) => option.trim())
          .filter(Boolean)
          .map((option, index) => ({
            organization_id: session.organizationId,
            field_id: fieldId,
            label: option,
            value: toCode(option),
            position: index + 1,
            is_active: true,
          })),
      );
      if (error) throw new Error(error.message);
    }
  }

  async deleteCustomField(session: Session, fieldId: string): Promise<void> {
    const { error } = await supabase
      .from("custom_fields")
      .delete()
      .eq("organization_id", session.organizationId)
      .eq("id", fieldId);
    if (error) throw new Error(error.message);
  }

  async saveTag(session: Session, tag: TagDefinition): Promise<void> {
    if (tag.organizationId !== session.organizationId) {
      throw new Error("A etiqueta não pertence à organização ativa.");
    }

    if (isUuid(tag.id)) {
      const { data, error } = await supabase
        .from("tags")
        .update({ name: tag.name.trim(), color: tag.color, is_active: true })
        .eq("organization_id", session.organizationId)
        .eq("id", tag.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (data?.length) return;
    }

    const code = await uniqueOrganizationValue(
      "tags",
      session.organizationId,
      "code",
      tag.name,
    );
    const { error } = await supabase.from("tags").insert({
      id: isUuid(tag.id) ? tag.id : undefined,
      organization_id: session.organizationId,
      name: tag.name.trim(),
      code,
      color: tag.color,
      is_active: true,
    });
    if (error) throw new Error(error.message);
  }

  async deleteTag(session: Session, tagId: string): Promise<void> {
    const { error } = await supabase
      .from("tags")
      .delete()
      .eq("organization_id", session.organizationId)
      .eq("id", tagId);
    if (error) throw new Error(error.message);
  }

  async updateBranding(session: Session, branding: Branding): Promise<void> {
    const { error: organizationError } = await supabase
      .from("organizations")
      .update({ name: branding.companyName.trim() })
      .eq("id", session.organizationId);
    if (organizationError) throw new Error(organizationError.message);

    const { error } = await supabase.from("organization_branding").upsert({
      organization_id: session.organizationId,
      crm_name: branding.productName.trim(),
      logo_url: branding.logoUrl.trim() || null,
      primary_color: branding.primaryColor,
      secondary_color: branding.secondaryColor,
      accent_color: branding.accentColor || branding.primaryColor,
      background_color: branding.backgroundColor,
      font_family: "Inter",
    });
    if (error) throw new Error(error.message);
  }

  async saveOrganization(
    session: Session,
    organization: Organization,
  ): Promise<void> {
    if (!isUuid(organization.id)) {
      throw new Error(
        "Novas organizações devem ser criadas pelo provisionador da área de desenvolvedor.",
      );
    }

    if (organization.id === session.organizationId && !organization.active) {
      throw new Error(
        "Abra outra organização antes de desativar o ambiente atualmente em uso.",
      );
    }

    const { error } = await supabase
      .from("organizations")
      .update({
        name: organization.name.trim(),
        slug: toSlug(organization.slug),
        status: organization.active ? "active" : "inactive",
      })
      .eq("id", organization.id);
    if (error) throw new Error(error.message);

    const activeSession = { ...session, organizationId: organization.id };
    await this.updateBranding(activeSession, {
      ...organization.branding,
      companyName: organization.name.trim(),
    });
  }

  async duplicateOrganization(
    session: Session,
    sourceId: string,
    name: string,
    slug: string,
  ): Promise<void> {
    const { data, error } = await supabase.rpc("provision_crm_organization", {
      p_source_organization_id: sourceId,
      p_name: name.trim(),
      p_slug: toSlug(slug),
    });
    if (error) {
      throw new Error(
        error.message.includes("Could not find the function")
          ? "O provisionador de organizações ainda precisa ser aplicado no Supabase."
          : error.message,
      );
    }
    const result = data as { organization_id?: string };
    if (!result?.organization_id) {
      throw new Error("O banco não confirmou a nova organização.");
    }
  }
  async switchOrganization(
    session: Session,
    organizationId: string,
  ): Promise<Session> {
    return this.buildSession(organizationId || session.organizationId);
  }
  async openWhatsAppConversation(
    session: Session,
    leadId: string,
  ): Promise<string> {
    const { data, error } = await supabase.rpc(
      "open_crm_whatsapp_conversation",
      {
        p_organization_id:
          session.organizationId,

        p_lead_id:
          leadId,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    const result = data as {
      conversation_id?: string;
      lead_id?: string;
      created?: boolean;
      reopened?: boolean;
    };

    if (
      !result.conversation_id ||
      result.lead_id !== leadId
    ) {
      throw new Error(
        "O banco não confirmou a abertura da conversa.",
      );
    }

    return result.conversation_id;
  }

  async sendMessage(
  session: Session,
  conversationId: string,
  body: string,
): Promise<void> {
  const normalizedBody = body.trim();

  if (!normalizedBody) {
    throw new Error(
      "Digite uma mensagem antes de enviar.",
    );
  }

  const { data, error } = await supabase.rpc(
    "send_crm_message_local",
    {
      p_organization_id:
        session.organizationId,

      p_conversation_id:
        conversationId,

      p_body:
        normalizedBody,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  const result = data as {
    message_id?: string;
    conversation_id?: string;
    queued?: boolean;
    status?: string;
    sent_at?: string;
  };

  if (
    result.queued !== true ||
    !result.message_id ||
    result.conversation_id !==
      conversationId
  ) {
    throw new Error(
      "O banco não confirmou o registro da mensagem.",
    );
  }

  const {
    data: dispatchData,
    error: dispatchError,
  } = await supabase.functions.invoke(
    "dispatch-whatsapp-message",
    {
      body: {
        message_id:
          result.message_id,
      },
    },
  );

  if (dispatchError) {
    throw new Error(
      "A mensagem foi registrada no CRM, mas a função de envio falhou: " +
        dispatchError.message,
    );
  }

  const dispatchResult =
    dispatchData as {
      ok?: boolean;
      message_id?: string;
      status?: string;
      error?: string;
      warning?: string | null;
      already_dispatched?: boolean;
    };

  if (
    dispatchResult.ok !== true ||
    dispatchResult.message_id !==
      result.message_id
  ) {
    throw new Error(
      dispatchResult.error ??
        "A mensagem foi registrada, mas não foi entregue ao WhatsApp.",
    );
  }

  if (dispatchResult.warning) {
    console.warn(
      "[CRM WhatsApp]",
      dispatchResult.warning,
    );
  }
}


  async prepareWhatsAppMedia(
    session: Session,
    conversationId: string,
    input: WhatsAppMediaPrepareInput,
  ): Promise<WhatsAppPreparedMediaMessage> {
    const file = input.file;
    const caption =
      input.caption?.trim() ?? "";

    if (!conversationId.trim()) {
      throw new Error(
        "A conversa não foi informada.",
      );
    }

    if (caption.length > 1024) {
      throw new Error(
        "A legenda deve possuir no máximo 1024 caracteres.",
      );
    }

    const descriptor =
      describeOutboundWhatsAppMedia(
        file,
      );

    if (
      descriptor.messageType === "audio" &&
      caption
    ) {
      throw new Error(
        "Áudios não aceitam legenda nesta etapa. Envie o texto separadamente.",
      );
    }

    const {
      data: preparationData,
      error: preparationError,
    } = await supabase.functions.invoke(
      "prepare-whatsapp-media-upload",
      {
        body: {
          organization_id:
            session.organizationId,
          conversation_id:
            conversationId,
          file_name:
            file.name,
          mime_type:
            descriptor.mimeType,
          size_bytes:
            file.size,
          caption:
            caption || null,
        },
      },
    );

    if (preparationError) {
      const backendMessage =
        await readEdgeFunctionError(
          preparationError,
          "A Edge Function recusou a preparação do arquivo.",
        );

      console.error(
        "[prepare-whatsapp-media-upload]",
        preparationError,
        backendMessage,
      );

      throw new Error(
        "Não foi possível preparar o arquivo para envio: " +
          backendMessage,
      );
    }

    const preparation =
      preparationData as {
        ok?: boolean;
        message_id?: string;
        conversation_id?: string;
        message_type?: OutboundWhatsAppMediaType;
        bucket?: string;
        storage_path?: string;
        upload_token?: string;
        mime_type?: string;
        file_name?: string;
        size_bytes?: number;
        error?: string;
      };

    if (
      preparation.ok !== true ||
      !preparation.message_id ||
      preparation.conversation_id !==
        conversationId ||
      preparation.message_type !==
        descriptor.messageType ||
      !preparation.bucket ||
      !preparation.storage_path ||
      !preparation.upload_token
    ) {
      throw new Error(
        preparation.error ??
          "O backend não retornou os dados necessários para o upload.",
      );
    }

    const {
      error: uploadError,
    } = await supabase.storage
      .from(preparation.bucket)
      .uploadToSignedUrl(
        preparation.storage_path,
        preparation.upload_token,
        file,
        {
          contentType:
            descriptor.mimeType,
          cacheControl: "3600",
        },
      );

    if (uploadError) {
      await supabase.rpc(
        "fail_crm_whatsapp_media_upload",
        {
          p_organization_id:
            session.organizationId,
          p_message_id:
            preparation.message_id,
          p_error_message:
            uploadError.message,
        },
      );

      throw new Error(
        "Não foi possível enviar o arquivo ao armazenamento: " +
          uploadError.message,
      );
    }

    const {
      data: finalizationData,
      error: finalizationError,
    } = await supabase.rpc(
      "finalize_crm_whatsapp_media_upload",
      {
        p_organization_id:
          session.organizationId,
        p_message_id:
          preparation.message_id,
      },
    );

    if (finalizationError) {
      throw new Error(
        "O arquivo foi armazenado, mas o CRM não conseguiu concluir a preparação: " +
          finalizationError.message,
      );
    }

    const finalization =
      finalizationData as {
        finalized?: boolean;
        message_id?: string;
        storage_path?: string;
        status?: string;
      };

    if (
      finalization.finalized !== true ||
      finalization.message_id !==
        preparation.message_id ||
      finalization.storage_path !==
        preparation.storage_path
    ) {
      throw new Error(
        "O banco não confirmou a conclusão do upload.",
      );
    }

    const {
      data: dispatchData,
      error: dispatchError,
    } = await supabase.functions.invoke(
      "dispatch-whatsapp-message",
      {
        body: {
          message_id:
            preparation.message_id,
        },
      },
    );

    if (dispatchError) {
      const backendMessage =
        await readEdgeFunctionError(
          dispatchError,
          "A Edge Function recusou o despacho da mídia.",
        );

      console.error(
        "[dispatch-whatsapp-message mídia]",
        dispatchError,
        backendMessage,
      );

      throw new Error(
        "O arquivo foi preparado, mas a função de envio falhou: " +
          backendMessage,
      );
    }

    const dispatchResult =
      dispatchData as {
        ok?: boolean;
        message_id?: string;
        status?: string;
        error?: string;
        warning?: string | null;
        already_dispatched?: boolean;
      };

    if (
      dispatchResult.ok !== true ||
      dispatchResult.message_id !==
        preparation.message_id
    ) {
      throw new Error(
        dispatchResult.error ??
          "A mídia foi armazenada, mas não foi entregue ao WhatsApp.",
      );
    }

    if (dispatchResult.warning) {
      console.warn(
        "[CRM WhatsApp mídia]",
        dispatchResult.warning,
      );
    }

    return {
      messageId:
        preparation.message_id,
      conversationId,
      messageType:
        descriptor.messageType,
      bucket:
        preparation.bucket,
      storagePath:
        preparation.storage_path,
      mimeType:
        descriptor.mimeType,
      fileName:
        preparation.file_name ||
        file.name,
      sizeBytes:
        file.size,
      status:
        "queued",
    };
  }

  async sendWhatsAppTemplate(
    session: Session,
    conversationId: string,
    input: WhatsAppTemplateSendInput,
  ): Promise<void> {
    const templateName =
      input.templateName.trim();

    const languageCode =
      input.languageCode.trim();

    const bodyPreview =
      input.bodyPreview.trim();

    const parameters =
      input.parameters.map((value) =>
        value.trim(),
      );

    if (!templateName) {
      throw new Error(
        "O nome do template é obrigatório.",
      );
    }

    if (!languageCode) {
      throw new Error(
        "O idioma do template é obrigatório.",
      );
    }

    if (
      !bodyPreview ||
      parameters.some(
        (value) => !value,
      )
    ) {
      throw new Error(
        "Os dados do template estão incompletos.",
      );
    }

    const { data, error } =
      await supabase.rpc(
        "send_crm_whatsapp_template",
        {
          p_organization_id:
            session.organizationId,

          p_conversation_id:
            conversationId,

          p_template_name:
            templateName,

          p_language_code:
            languageCode,

          p_parameters:
            parameters,
        },
      );

    if (error) {
      throw new Error(error.message);
    }

    const result = data as {
      message_id?: string;
      conversation_id?: string;
      queued?: boolean;
      status?: string;
    };

    if (
      result.queued !== true ||
      !result.message_id ||
      result.conversation_id !==
        conversationId
    ) {
      throw new Error(
        "O banco não confirmou o registro do template.",
      );
    }

    const {
      data: dispatchData,
      error: dispatchError,
    } = await supabase.functions.invoke(
      "dispatch-whatsapp-template",
      {
        body: {
          message_id:
            result.message_id,
        },
      },
    );

    if (dispatchError) {
      throw new Error(
        "O template foi registrado no CRM, mas a função de envio falhou: " +
          dispatchError.message,
      );
    }

    const dispatchResult =
      dispatchData as {
        ok?: boolean;
        message_id?: string;
        status?: string;
        error?: string;
        warning?: string | null;
        already_dispatched?: boolean;
      };

    if (
      dispatchResult.ok !== true ||
      dispatchResult.message_id !==
        result.message_id
    ) {
      throw new Error(
        dispatchResult.error ??
          "O template foi registrado, mas não foi entregue ao WhatsApp.",
      );
    }

    if (dispatchResult.warning) {
      console.warn(
        "[CRM WhatsApp Template]",
        dispatchResult.warning,
      );
    }
  }

  async transferConversation(
  session: Session,
  conversationId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc(
    "transfer_crm_conversation",
    {
      p_organization_id:
        session.organizationId,

      p_conversation_id:
        conversationId,

      p_user_id:
        userId,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  const result = data as {
    conversation_id?: string;
    assigned_to?: string;
    transferred?: boolean;
    reason?: string;
  };

  if (
    result.conversation_id !== conversationId ||
    result.assigned_to !== userId
  ) {
    throw new Error(
      "O banco não confirmou a transferência da conversa.",
    );
  }

  if (
    result.transferred !== true &&
    result.reason !== "same_user"
  ) {
    throw new Error(
      "A conversa não pôde ser transferida.",
    );
  }
}


  async markConversationRead(
  session: Session,
  conversationId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc(
    "mark_crm_conversation_read",
    {
      p_organization_id:
        session.organizationId,

      p_conversation_id:
        conversationId,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  const result = data as {
    conversation_id?: string;
    read?: boolean;
    last_read_at?: string;
  };

  if (
    result.read !== true ||
    result.conversation_id !== conversationId
  ) {
    throw new Error(
      "O banco não confirmou a leitura da conversa.",
    );
  }
}
  async markNotificationRead(
  session: Session,
  notificationId?: string,
): Promise<void> {
  const { data, error } = await supabase.rpc(
    "mark_crm_notifications_read",
    {
      p_organization_id:
        session.organizationId,

      p_notification_id:
        notificationId ?? null,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  const result = data as {
    updated?: boolean;
    notifications_updated?: number;
    notification_id?: string | null;
  };

  if (result.updated !== true) {
    throw new Error(
      "O banco não confirmou a leitura das notificações.",
    );
  }
}
  updateIntegration(
    _session: Session,
    _integration: IntegrationConnection,
  ): Promise<void> {
    return Promise.reject(notReady("Configuração de integrações"));
  }
  testIntegration(_session: Session, _integrationId: string): Promise<void> {
    return Promise.reject(notReady("Teste de integrações"));
  }
  resetDemo(): Promise<void> {
    return Promise.resolve();
  }
}