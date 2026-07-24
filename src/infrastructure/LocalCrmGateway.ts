import { can, canAccessLead } from "../core/permissions";
import type {
  AppSnapshot,
  Branding,
  CustomFieldDefinition,
  CrmDatabase,
  IntegrationConnection,
  Lead,
  LeadInput,
  NotificationItem,
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
import { initials, normalizePhone, nowIso, sleep, uid } from "../core/utils";
import { seedDatabase } from "../data/seed";
import type { CrmGateway } from "./CrmGateway";

const DB_KEY = "projem-flow-product-v4";
const SESSION_KEY = "projem-flow-session-v4";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function readDatabase(): CrmDatabase {
  try {
    const raw = localStorage.getItem(DB_KEY);
    return raw ? (JSON.parse(raw) as CrmDatabase) : clone(seedDatabase);
  } catch {
    return clone(seedDatabase);
  }
}

function writeDatabase(database: CrmDatabase) {
  localStorage.setItem(DB_KEY, JSON.stringify(database));
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (new Date(session.expiresAt) <= new Date()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function currentUser(database: CrmDatabase, session: Session) {
  const user = database.users.find(
    (item) => item.id === session.userId && item.active,
  );
  if (!user || user.organizationId !== session.organizationId) {
    throw new Error("Sessão inválida ou usuário inativo.");
  }
  return user;
}

function notify(
  database: CrmDatabase,
  organizationId: string,
  title: string,
  description: string,
  userId: string | null = null,
) {
  const notification: NotificationItem = {
    id: uid("not"),
    organizationId,
    userId,
    title,
    description,
    read: false,
    createdAt: nowIso(),
  };
  database.notifications.unshift(notification);
}

function initialStageIds(database: CrmDatabase, organizationId: string) {
  return database.stages
    .filter(
      (stage) => stage.organizationId === organizationId && stage.order <= 2,
    )
    .map((stage) => stage.id);
}

function validateEmail(email: string) {
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateLeadReferences(
  database: CrmDatabase,
  organizationId: string,
  input: LeadInput,
) {
  const pipeline = database.pipelines.find(
    (item) =>
      item.id === input.pipelineId &&
      item.organizationId === organizationId &&
      item.active,
  );
  if (!pipeline) throw new Error("Funil inválido ou inativo.");

  const stage = database.stages.find(
    (item) =>
      item.id === input.stageId &&
      item.organizationId === organizationId &&
      item.pipelineId === pipeline.id,
  );
  if (!stage)
    throw new Error("A etapa selecionada não pertence ao funil do lead.");

  const owner = database.users.find(
    (item) =>
      item.id === input.ownerId &&
      item.organizationId === organizationId &&
      item.active,
  );
  if (!owner) throw new Error("Responsável inválido ou inativo.");
  if (!["super_admin", "sales", "sdr"].includes(owner.role)) {
    throw new Error("O perfil selecionado não pode ser responsável por leads.");
  }
  if (
    owner.role !== "super_admin" &&
    !owner.pipelineIds.includes(pipeline.id)
  ) {
    throw new Error("O responsável não possui acesso a este funil.");
  }

  return { pipeline, stage, owner };
}

function validateLeadFields(input: LeadInput) {
  if (input.name.trim().length < 2) throw new Error("Informe o nome do lead.");
  const normalizedPhone = normalizePhone(input.phone);
  if (normalizedPhone.length < 10 || normalizedPhone.length > 13) {
    throw new Error("Informe um telefone válido com DDD.");
  }
  if (!validateEmail(input.email.trim()))
    throw new Error("Informe um e-mail válido.");
  if (!Number.isFinite(input.value) || input.value < 0)
    throw new Error("O valor estimado é inválido.");
  if (!Number.isFinite(input.score) || input.score < 0 || input.score > 100) {
    throw new Error("O score deve estar entre 0 e 100.");
  }
}

function validateCustomValues(
  database: CrmDatabase,
  organizationId: string,
  input: LeadInput,
) {
  const values = input.customValues || {};
  const fields = database.customFields.filter(
    (item) => item.organizationId === organizationId && item.active,
  );
  for (const field of fields) {
    const value = values[field.key];
    const empty = value === undefined || value === null || value === "";
    if (field.required && empty)
      throw new Error(`Preencha o campo obrigatório: ${field.name}.`);
    if (empty) continue;
    if (
      field.type === "number" &&
      (typeof value !== "number" || !Number.isFinite(value))
    ) {
      throw new Error(`O campo ${field.name} deve ser numérico.`);
    }
    if (field.type === "boolean" && typeof value !== "boolean") {
      throw new Error(`O campo ${field.name} deve ser do tipo sim/não.`);
    }
    if (field.type === "select" && !field.options.includes(String(value))) {
      throw new Error(`A opção informada em ${field.name} é inválida.`);
    }
  }
}

function syncTaskReminders(database: CrmDatabase, organizationId: string) {
  const now = Date.now();
  let changed = false;
  database.tasks
    .filter(
      (task) =>
        task.organizationId === organizationId &&
        !task.done &&
        task.reminderMinutes > 0 &&
        !task.reminderNotifiedAt,
    )
    .forEach((task) => {
      const dueAt = new Date(`${task.date}T${task.time}:00`).getTime();
      if (!Number.isFinite(dueAt)) return;
      const reminderAt = dueAt - task.reminderMinutes * 60_000;
      if (now >= reminderAt && now <= dueAt + 24 * 60 * 60_000) {
        notify(
          database,
          organizationId,
          "Lembrete de tarefa",
          `${task.title} está programada para ${task.date} às ${task.time}.`,
          task.ownerId,
        );
        task.reminderNotifiedAt = nowIso();
        changed = true;
      }
    });
  return changed;
}

export class LocalCrmGateway implements CrmGateway {
  async restoreSession() {
    await sleep(40);
    return readSession();
  }

  async login(email: string, password: string) {
    await sleep(120);
    const database = readDatabase();
    const user = database.users.find(
      (item) =>
        item.email.toLowerCase() === email.trim().toLowerCase() &&
        item.demoPassword === password &&
        item.active,
    );

    if (!user) throw new Error("E-mail ou senha inválidos.");

    const session: Session = {
      token: uid("local"),
      userId: user.id,
      organizationId: user.organizationId,
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  async logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  async snapshot(session: Session): Promise<AppSnapshot> {
    await sleep(45);
    const database = readDatabase();
    const actor = currentUser(database, session);
    const organizationId = session.organizationId;
    if (syncTaskReminders(database, organizationId)) writeDatabase(database);
    const organizationLeads = database.leads.filter(
      (item) => item.organizationId === organizationId,
    );
    const scopedLeads = organizationLeads.filter((lead) =>
      canAccessLead(actor, lead, initialStageIds(database, organizationId)),
    );
    const scopedLeadIds = new Set(scopedLeads.map((lead) => lead.id));
    const canReadAll = can(actor, "leads.read.all");
    const scopedTasks = database.tasks.filter(
      (item) =>
        item.organizationId === organizationId &&
        (canReadAll || item.ownerId === actor.id),
    );
    const scopedConversations = database.conversations.filter(
      (item) =>
        item.organizationId === organizationId &&
        (canReadAll || scopedLeadIds.has(item.leadId)),
    );
    const scopedConversationIds = new Set(
      scopedConversations.map((item) => item.id),
    );

    return {
      session,
      organizations: can(actor, "developer.manage")
        ? database.organizations
        : database.organizations.filter((item) => item.id === organizationId),
      users: database.users.filter(
        (item) => item.organizationId === organizationId,
      ),
      pipelines: database.pipelines.filter(
        (item) => item.organizationId === organizationId,
      ),
      stages: database.stages.filter(
        (item) => item.organizationId === organizationId,
      ),
      leads: scopedLeads,
      histories: database.histories.filter(
        (item) =>
          item.organizationId === organizationId &&
          scopedLeadIds.has(item.leadId),
      ),
      tasks: scopedTasks,
      customFields: database.customFields.filter(
        (item) => item.organizationId === organizationId,
      ),
      tags: database.tags.filter(
        (item) => item.organizationId === organizationId,
      ),
      conversations: scopedConversations,
      messages: database.messages.filter(
        (item) =>
          item.organizationId === organizationId &&
          scopedConversationIds.has(item.conversationId),
      ),
      integrations: can(actor, "integrations.manage")
        ? database.integrations.filter(
            (item) => item.organizationId === organizationId,
          )
        : [],
      notifications: database.notifications.filter(
        (item) =>
          item.organizationId === organizationId &&
          (item.userId === null || item.userId === actor.id),
      ),
    };
  }

  async saveLead(session: Session, input: LeadInput): Promise<Lead> {
    const database = readDatabase();
    const actor = currentUser(database, session);
    const timestamp = nowIso();
    validateLeadFields(input);
    validateCustomValues(database, session.organizationId, input);

    const normalizedInput: LeadInput = {
      ...input,
      name: input.name.trim(),
      company: input.company.trim(),
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase(),
      city: input.city.trim(),
      origin: input.origin.trim(),
      campaign: input.campaign.trim(),
      tags: Array.from(
        new Set(input.tags.map((tag) => tag.trim()).filter(Boolean)),
      ),
      notes: input.notes.trim(),
      value: Number(input.value),
      score: Number(input.score),
    };

    if (normalizedInput.id) {
      if (!can(actor, "leads.write"))
        throw new Error("Sem permissão para editar leads.");
      const index = database.leads.findIndex(
        (item) =>
          item.id === normalizedInput.id &&
          item.organizationId === session.organizationId,
      );
      if (index < 0) throw new Error("Lead não encontrado.");

      const existing = database.leads[index];
      if (
        !canAccessLead(
          actor,
          existing,
          initialStageIds(database, session.organizationId),
        )
      ) {
        throw new Error("Este lead não está no seu escopo de acesso.");
      }
      if (
        normalizedInput.ownerId !== existing.ownerId &&
        !can(actor, "leads.assign")
      ) {
        throw new Error("Seu perfil não pode alterar o responsável do lead.");
      }

      validateLeadReferences(database, session.organizationId, normalizedInput);
      const normalizedPhone = normalizePhone(normalizedInput.phone);
      if (
        database.leads.some(
          (item) =>
            item.organizationId === session.organizationId &&
            item.id !== existing.id &&
            normalizePhone(item.phone) === normalizedPhone,
        )
      ) {
        throw new Error("Já existe outro lead com este telefone.");
      }

      database.leads[index] = {
        ...existing,
        ...normalizedInput,
        id: existing.id,
        organizationId: session.organizationId,
        createdAt: existing.createdAt,
        lastContact: existing.lastContact,
        updatedAt: timestamp,
      };

      const ownerChanged = normalizedInput.ownerId !== existing.ownerId;
      const stageChanged = normalizedInput.stageId !== existing.stageId;

      if (stageChanged) {
        const nextStage = database.stages.find(
          (stage) => stage.id === normalizedInput.stageId,
        );
        database.histories.unshift({
          id: uid("hist"),
          organizationId: session.organizationId,
          leadId: existing.id,
          actorId: actor.id,
          type: "moved",
          description: `Lead movimentado para ${nextStage?.name || "outra etapa"}`,
          fromStageId: existing.stageId,
          toStageId: normalizedInput.stageId,
          createdAt: timestamp,
        });
      }

      if (ownerChanged) {
        database.histories.unshift({
          id: uid("hist"),
          organizationId: session.organizationId,
          leadId: existing.id,
          actorId: actor.id,
          type: "assigned",
          description: `Responsável alterado para ${database.users.find((user) => user.id === normalizedInput.ownerId)?.name || "outro usuário"}`,
          createdAt: timestamp,
        });
        notify(
          database,
          session.organizationId,
          "Lead atribuído",
          `${existing.name} foi atribuído a você.`,
          normalizedInput.ownerId,
        );
      }

      if (!stageChanged && !ownerChanged) {
        database.histories.unshift({
          id: uid("hist"),
          organizationId: session.organizationId,
          leadId: existing.id,
          actorId: actor.id,
          type: "updated",
          description: "Dados do lead atualizados",
          createdAt: timestamp,
        });
      }

      writeDatabase(database);
      return clone(database.leads[index]);
    }

    if (!can(actor, "leads.create"))
      throw new Error("Sem permissão para criar leads.");

    const normalizedPhone = normalizePhone(normalizedInput.phone);
    if (
      database.leads.some(
        (item) =>
          item.organizationId === session.organizationId &&
          normalizePhone(item.phone) === normalizedPhone,
      )
    ) {
      throw new Error(
        "Já existe um lead com este telefone. Revise antes de criar uma duplicidade.",
      );
    }

    const ownerId = can(actor, "leads.assign")
      ? normalizedInput.ownerId
      : actor.id;
    const leadInput = { ...normalizedInput, ownerId };
    validateLeadReferences(database, session.organizationId, leadInput);

    const lead: Lead = {
      ...leadInput,
      id: uid("lead"),
      organizationId: session.organizationId,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastContact: "Ainda não contatado",
    };

    database.leads.unshift(lead);
    database.histories.unshift({
      id: uid("hist"),
      organizationId: session.organizationId,
      leadId: lead.id,
      actorId: actor.id,
      type: "created",
      description: "Lead criado manualmente",
      createdAt: timestamp,
    });
    notify(
      database,
      session.organizationId,
      "Novo lead cadastrado",
      `${lead.name} entrou no funil.`,
      ownerId,
    );
    writeDatabase(database);
    return clone(lead);
  }

  async moveLead(session: Session, leadId: string, stageId: string) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "pipeline.move"))
      throw new Error("Sem permissão para movimentar leads.");

    const lead = database.leads.find(
      (item) =>
        item.id === leadId && item.organizationId === session.organizationId,
    );
    const stage = database.stages.find(
      (item) =>
        item.id === stageId && item.organizationId === session.organizationId,
    );
    if (!lead || !stage) throw new Error("Lead ou etapa não encontrados.");
    if (stage.pipelineId !== lead.pipelineId) {
      throw new Error("A etapa de destino pertence a outro funil.");
    }
    if (
      !canAccessLead(
        actor,
        lead,
        initialStageIds(database, session.organizationId),
      )
    ) {
      throw new Error("Este lead não está no seu escopo de acesso.");
    }

    const previousStage = lead.stageId;
    if (previousStage === stageId) return;

    lead.stageId = stageId;
    lead.updatedAt = nowIso();
    database.histories.unshift({
      id: uid("hist"),
      organizationId: session.organizationId,
      leadId,
      actorId: actor.id,
      type: "moved",
      description: `Lead movimentado para ${stage.name}`,
      fromStageId: previousStage,
      toStageId: stageId,
      createdAt: nowIso(),
    });
    notify(
      database,
      session.organizationId,
      "Lead movimentado",
      `${lead.name} avançou para ${stage.name}.`,
      lead.ownerId,
    );
    writeDatabase(database);
  }

  async addLeadNote(session: Session, leadId: string, note: string) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "leads.write"))
      throw new Error("Sem permissão para registrar observações.");

    const lead = database.leads.find(
      (item) =>
        item.id === leadId && item.organizationId === session.organizationId,
    );
    if (!lead) throw new Error("Lead não encontrado.");
    if (
      !canAccessLead(
        actor,
        lead,
        initialStageIds(database, session.organizationId),
      )
    ) {
      throw new Error("Este lead não está no seu escopo de acesso.");
    }

    const cleanNote = note.trim();
    if (!cleanNote) throw new Error("A observação está vazia.");

    lead.notes = `${lead.notes}${lead.notes ? "\n\n" : ""}${actor.name}: ${cleanNote}`;
    lead.updatedAt = nowIso();
    database.histories.unshift({
      id: uid("hist"),
      organizationId: session.organizationId,
      leadId,
      actorId: actor.id,
      type: "note",
      description: cleanNote,
      createdAt: nowIso(),
    });
    writeDatabase(database);
  }

  async saveTask(session: Session, input: TaskInput): Promise<Task> {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "tasks.manage"))
      throw new Error("Sem permissão para gerenciar tarefas.");
    if (!input.title.trim()) throw new Error("Informe o título da tarefa.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date))
      throw new Error("Informe uma data válida.");
    if (!/^\d{2}:\d{2}$/.test(input.time))
      throw new Error("Informe um horário válido.");
    if (!Number.isFinite(input.reminderMinutes) || input.reminderMinutes < 0) {
      throw new Error("O lembrete informado é inválido.");
    }

    const owner = database.users.find(
      (item) =>
        item.id === input.ownerId &&
        item.organizationId === session.organizationId &&
        item.active,
    );
    if (!owner) throw new Error("Responsável da tarefa inválido ou inativo.");
    if (
      input.ownerId !== actor.id &&
      !can(actor, "leads.assign") &&
      actor.role !== "super_admin"
    ) {
      throw new Error("Seu perfil só pode criar tarefas para si mesmo.");
    }

    if (input.leadId) {
      const lead = database.leads.find(
        (item) =>
          item.id === input.leadId &&
          item.organizationId === session.organizationId,
      );
      if (
        !lead ||
        !canAccessLead(
          actor,
          lead,
          initialStageIds(database, session.organizationId),
        )
      ) {
        throw new Error(
          "O lead vinculado não está disponível para este usuário.",
        );
      }
    }

    const normalizedInput: TaskInput = {
      ...input,
      title: input.title.trim(),
      description: input.description.trim(),
      type: input.type.trim() || "Tarefa interna",
      reminderMinutes: Number(input.reminderMinutes),
    };

    if (normalizedInput.id) {
      const index = database.tasks.findIndex(
        (item) =>
          item.id === normalizedInput.id &&
          item.organizationId === session.organizationId,
      );
      if (index < 0) throw new Error("Tarefa não encontrada.");
      const existing = database.tasks[index];
      if (
        existing.ownerId !== actor.id &&
        !can(actor, "leads.assign") &&
        actor.role !== "super_admin"
      ) {
        throw new Error("Você não pode editar a tarefa de outro usuário.");
      }
      database.tasks[index] = {
        ...existing,
        ...normalizedInput,
        id: existing.id,
        organizationId: session.organizationId,
        createdAt: existing.createdAt,
        reminderNotifiedAt:
          existing.date !== normalizedInput.date ||
          existing.time !== normalizedInput.time ||
          existing.reminderMinutes !== normalizedInput.reminderMinutes
            ? undefined
            : existing.reminderNotifiedAt,
      };
      writeDatabase(database);
      return clone(database.tasks[index]);
    }

    const task: Task = {
      ...normalizedInput,
      id: uid("task"),
      organizationId: session.organizationId,
      createdAt: nowIso(),
      done: Boolean(normalizedInput.done),
    };
    database.tasks.push(task);
    notify(
      database,
      session.organizationId,
      "Nova tarefa",
      `${task.title} em ${task.date} às ${task.time}.`,
      task.ownerId,
    );
    writeDatabase(database);
    return clone(task);
  }

  async toggleTask(session: Session, taskId: string) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "tasks.manage"))
      throw new Error("Sem permissão para concluir tarefas.");
    const task = database.tasks.find(
      (item) =>
        item.id === taskId && item.organizationId === session.organizationId,
    );
    if (!task) throw new Error("Tarefa não encontrada.");
    if (
      task.ownerId !== actor.id &&
      !can(actor, "leads.assign") &&
      actor.role !== "super_admin"
    ) {
      throw new Error("Você não pode alterar a tarefa de outro usuário.");
    }
    task.done = !task.done;
    writeDatabase(database);
  }

  async deleteTask(session: Session, taskId: string) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "tasks.manage"))
      throw new Error("Sem permissão para excluir tarefas.");
    const task = database.tasks.find(
      (item) =>
        item.id === taskId && item.organizationId === session.organizationId,
    );
    if (!task) throw new Error("Tarefa não encontrada.");
    if (
      task.ownerId !== actor.id &&
      !can(actor, "leads.assign") &&
      actor.role !== "super_admin"
    ) {
      throw new Error("Você não pode excluir a tarefa de outro usuário.");
    }
    database.tasks = database.tasks.filter((item) => item.id !== taskId);
    writeDatabase(database);
  }

  async saveUser(session: Session, input: UserInput): Promise<User> {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "users.manage"))
      throw new Error("Sem permissão para gerenciar usuários.");

    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (name.length < 2) throw new Error("Informe o nome do usuário.");
    if (!validateEmail(email)) throw new Error("Informe um e-mail válido.");
    if (
      ["sales", "sdr"].includes(input.role) &&
      input.pipelineIds.length === 0
    ) {
      throw new Error("Autorize ao menos um funil para este perfil.");
    }
    const invalidPipeline = input.pipelineIds.some(
      (pipelineId) =>
        !database.pipelines.some(
          (item) =>
            item.id === pipelineId &&
            item.organizationId === session.organizationId,
        ),
    );
    if (invalidPipeline)
      throw new Error("Um dos funis selecionados é inválido.");

    const duplicate = database.users.find(
      (item) =>
        item.organizationId === session.organizationId &&
        item.email.toLowerCase() === email &&
        item.id !== input.id,
    );
    if (duplicate) throw new Error("Já existe um usuário com este e-mail.");

    const normalizedInput: UserInput = {
      ...input,
      name,
      email,
      roleLabel: input.roleLabel.trim() || input.role,
      pipelineIds: Array.from(new Set(input.pipelineIds)),
    };

    if (normalizedInput.id) {
      const index = database.users.findIndex(
        (item) =>
          item.id === normalizedInput.id &&
          item.organizationId === session.organizationId,
      );
      if (index < 0) throw new Error("Usuário não encontrado.");
      database.users[index] = {
        ...database.users[index],
        ...normalizedInput,
        id: normalizedInput.id,
        organizationId: session.organizationId,
        initials: initials(name),
      };
      writeDatabase(database);
      return clone(database.users[index]);
    }

    const user: User = {
      ...normalizedInput,
      id: uid("usr"),
      organizationId: session.organizationId,
      initials: initials(name),
      demoPassword: normalizedInput.demoPassword || "projem123",
    };
    database.users.push(user);
    writeDatabase(database);
    return clone(user);
  }

  async toggleUser(session: Session, userId: string) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "users.manage"))
      throw new Error("Sem permissão para gerenciar usuários.");
    const user = database.users.find(
      (item) =>
        item.id === userId && item.organizationId === session.organizationId,
    );
    if (!user) throw new Error("Usuário não encontrado.");
    if (user.id === actor.id)
      throw new Error("Você não pode desativar o próprio usuário.");
    user.active = !user.active;
    writeDatabase(database);
  }

  async savePipeline(session: Session, pipeline: Pipeline) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "pipeline.manage"))
      throw new Error("Sem permissão para gerenciar funis.");
    const name = pipeline.name.trim();
    if (name.length < 2) throw new Error("Informe o nome do funil.");
    const duplicate = database.pipelines.find(
      (item) =>
        item.organizationId === session.organizationId &&
        item.name.toLowerCase() === name.toLowerCase() &&
        item.id !== pipeline.id,
    );
    if (duplicate) throw new Error("Já existe um funil com este nome.");
    const normalized: Pipeline = {
      ...pipeline,
      organizationId: session.organizationId,
      name,
      description: pipeline.description.trim(),
    };
    const index = database.pipelines.findIndex(
      (item) =>
        item.id === pipeline.id &&
        item.organizationId === session.organizationId,
    );
    if (index >= 0) database.pipelines[index] = normalized;
    else database.pipelines.push(normalized);
    writeDatabase(database);
  }

  async deletePipeline(session: Session, pipelineId: string) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "pipeline.manage"))
      throw new Error("Sem permissão para excluir funis.");
    const pipeline = database.pipelines.find(
      (item) =>
        item.id === pipelineId &&
        item.organizationId === session.organizationId,
    );
    if (!pipeline) throw new Error("Funil não encontrado.");
    if (
      database.pipelines.filter(
        (item) => item.organizationId === session.organizationId,
      ).length <= 1
    ) {
      throw new Error("Mantenha ao menos um funil na empresa.");
    }
    if (
      database.leads.some(
        (item) =>
          item.organizationId === session.organizationId &&
          item.pipelineId === pipelineId,
      )
    ) {
      throw new Error("Transfira os leads antes de excluir este funil.");
    }
    if (
      database.integrations.some(
        (item) =>
          item.organizationId === session.organizationId &&
          item.targetPipelineId === pipelineId,
      )
    ) {
      throw new Error(
        "Redirecione as integrações antes de excluir este funil.",
      );
    }
    database.pipelines = database.pipelines.filter(
      (item) => item.id !== pipelineId,
    );
    database.stages = database.stages.filter(
      (item) => item.pipelineId !== pipelineId,
    );
    database.users
      .filter((item) => item.organizationId === session.organizationId)
      .forEach((user) => {
        user.pipelineIds = user.pipelineIds.filter((id) => id !== pipelineId);
      });
    writeDatabase(database);
  }

  async saveStage(session: Session, stage: PipelineStage) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "pipeline.manage"))
      throw new Error("Sem permissão para gerenciar o funil.");
    if (stage.organizationId !== session.organizationId)
      throw new Error("Etapa pertence a outra organização.");
    if (!stage.name.trim()) throw new Error("Informe o nome da etapa.");
    if (!Number.isInteger(stage.order) || stage.order < 1)
      throw new Error("A ordem da etapa é inválida.");

    const pipeline = database.pipelines.find(
      (item) =>
        item.id === stage.pipelineId &&
        item.organizationId === session.organizationId,
    );
    if (!pipeline) throw new Error("Pipeline não encontrado.");
    const duplicate = database.stages.find(
      (item) =>
        item.organizationId === session.organizationId &&
        item.pipelineId === stage.pipelineId &&
        item.id !== stage.id &&
        item.name.trim().toLowerCase() === stage.name.trim().toLowerCase(),
    );
    if (duplicate)
      throw new Error("Já existe uma etapa com este nome no funil.");

    const saved = { ...stage, name: stage.name.trim() };
    const index = database.stages.findIndex((item) => item.id === saved.id);
    if (index >= 0) database.stages[index] = saved;
    else database.stages.push(saved);
    writeDatabase(database);
  }

  async deleteStage(session: Session, stageId: string) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "pipeline.manage"))
      throw new Error("Sem permissão para gerenciar o funil.");
    if (
      database.leads.some(
        (item) =>
          item.stageId === stageId &&
          item.organizationId === session.organizationId,
      )
    ) {
      throw new Error("Mova os leads antes de excluir esta etapa.");
    }
    database.stages = database.stages.filter(
      (item) =>
        !(
          item.id === stageId && item.organizationId === session.organizationId
        ),
    );
    writeDatabase(database);
  }

  async saveCustomField(session: Session, field: CustomFieldDefinition) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "pipeline.manage"))
      throw new Error("Sem permissão para gerenciar campos personalizados.");

    const name = field.name.trim();
    const key = field.key
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
    if (!name || !key)
      throw new Error("Informe nome e identificador do campo.");
    const duplicate = database.customFields.find(
      (item) =>
        item.organizationId === session.organizationId &&
        item.id !== field.id &&
        (item.name.toLowerCase() === name.toLowerCase() || item.key === key),
    );
    if (duplicate)
      throw new Error("Já existe um campo com este nome ou identificador.");

    const saved: CustomFieldDefinition = {
      ...field,
      organizationId: session.organizationId,
      name,
      key,
      options:
        field.type === "select"
          ? Array.from(
              new Set(
                field.options.map((option) => option.trim()).filter(Boolean),
              ),
            )
          : [],
    };
    if (saved.type === "select" && saved.options.length === 0) {
      throw new Error("Adicione ao menos uma opção ao campo de seleção.");
    }

    const index = database.customFields.findIndex(
      (item) => item.id === saved.id,
    );
    if (index >= 0) database.customFields[index] = saved;
    else database.customFields.push(saved);
    writeDatabase(database);
  }

  async deleteCustomField(session: Session, fieldId: string) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "pipeline.manage"))
      throw new Error("Sem permissão para excluir campos personalizados.");
    const field = database.customFields.find(
      (item) =>
        item.id === fieldId && item.organizationId === session.organizationId,
    );
    if (!field) throw new Error("Campo personalizado não encontrado.");

    database.leads
      .filter((lead) => lead.organizationId === session.organizationId)
      .forEach((lead) => {
        if (!lead.customValues) return;
        const values = { ...lead.customValues };
        delete values[field.key];
        lead.customValues = values;
      });
    database.customFields = database.customFields.filter(
      (item) => item.id !== fieldId,
    );
    writeDatabase(database);
  }

  async saveTag(session: Session, tag: TagDefinition) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "tags.manage"))
      throw new Error("Sem permissão para criar etiquetas.");

    const normalizedName = tag.name.trim();
    if (!normalizedName) throw new Error("Informe o nome da etiqueta.");
    const duplicate = database.tags.find(
      (item) =>
        item.organizationId === session.organizationId &&
        item.name.toLowerCase() === normalizedName.toLowerCase() &&
        item.id !== tag.id,
    );
    if (duplicate) throw new Error("Esta etiqueta já existe.");

    const saved = {
      ...tag,
      name: normalizedName,
      organizationId: session.organizationId,
    };
    const index = database.tags.findIndex((item) => item.id === saved.id);
    if (index >= 0) database.tags[index] = saved;
    else database.tags.push(saved);
    writeDatabase(database);
  }

  async deleteTag(session: Session, tagId: string) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "pipeline.manage"))
      throw new Error("Apenas o administrador pode excluir etiquetas globais.");
    const tag = database.tags.find(
      (item) =>
        item.id === tagId && item.organizationId === session.organizationId,
    );
    if (tag) {
      database.leads
        .filter((lead) => lead.organizationId === session.organizationId)
        .forEach((lead) => {
          lead.tags = lead.tags.filter((name) => name !== tag.name);
        });
    }
    database.tags = database.tags.filter((item) => item.id !== tagId);
    writeDatabase(database);
  }

  async updateBranding(session: Session, branding: Branding) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "branding.manage"))
      throw new Error("Sem permissão para alterar a identidade visual.");
    if (!branding.productName.trim() || !branding.companyName.trim())
      throw new Error("Informe o nome do produto e da empresa.");
    for (const color of [
      branding.primaryColor,
      branding.secondaryColor,
      branding.backgroundColor,
    ]) {
      if (!/^#[0-9a-f]{6}$/i.test(color))
        throw new Error("Informe cores válidas no formato hexadecimal.");
    }
    const organization = database.organizations.find(
      (item) => item.id === session.organizationId,
    );
    if (!organization) throw new Error("Empresa não encontrada.");
    organization.branding = branding;
    writeDatabase(database);
  }

  async saveOrganization(session: Session, organization: Organization) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "developer.manage"))
      throw new Error("Sem permissão para gerenciar empresas.");
    const normalizedName = organization.name.trim();
    const normalizedSlug = organization.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (normalizedName.length < 2)
      throw new Error("Informe o nome da empresa.");
    if (normalizedSlug.length < 2)
      throw new Error("Informe um subdomínio válido.");
    if (!organization.branding.productName.trim())
      throw new Error("Informe o nome do produto.");
    const normalizedOrganization: Organization = {
      ...organization,
      name: normalizedName,
      slug: normalizedSlug,
      branding: {
        ...organization.branding,
        productName: organization.branding.productName.trim(),
        companyName: organization.branding.companyName.trim() || normalizedName,
      },
    };
    const duplicateSlug = database.organizations.find(
      (item) => item.slug === normalizedSlug && item.id !== organization.id,
    );
    if (duplicateSlug)
      throw new Error("Este subdomínio já está sendo utilizado.");
    const index = database.organizations.findIndex(
      (item) => item.id === organization.id,
    );
    if (index >= 0) database.organizations[index] = normalizedOrganization;
    else database.organizations.push(normalizedOrganization);
    writeDatabase(database);
  }

  async duplicateOrganization(
    session: Session,
    sourceId: string,
    name: string,
    slug: string,
  ) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "developer.manage"))
      throw new Error("Sem permissão para criar empresas.");

    const normalizedName = name.trim();
    const normalizedSlug = slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (normalizedName.length < 2)
      throw new Error("Informe o nome da empresa.");
    if (normalizedSlug.length < 2)
      throw new Error("Informe um subdomínio válido.");
    if (database.organizations.some((item) => item.slug === normalizedSlug))
      throw new Error("Este subdomínio já existe.");

    const source = database.organizations.find((item) => item.id === sourceId);
    if (!source) throw new Error("Modelo não encontrado.");

    // Alguns cartões podem ser apenas modelos visuais. Nesse caso, a estrutura
    // operacional é herdada da organização ativa do administrador.
    const configurationSourceId = database.pipelines.some(
      (item) => item.organizationId === sourceId,
    )
      ? sourceId
      : session.organizationId;

    const organizationId = uid("org");
    database.organizations.push({
      ...clone(source),
      id: organizationId,
      name: normalizedName,
      slug: normalizedSlug,
      active: false,
      createdAt: nowIso(),
      branding: {
        ...source.branding,
        companyName: normalizedName,
      },
    });

    const pipelineMap = new Map<string, string>();
    database.pipelines
      .filter((item) => item.organizationId === configurationSourceId)
      .forEach((item) => {
        const newId = uid("pipe");
        pipelineMap.set(item.id, newId);
        database.pipelines.push({ ...clone(item), id: newId, organizationId });
      });

    const stageMap = new Map<string, string>();
    database.stages
      .filter((item) => item.organizationId === configurationSourceId)
      .forEach((item) => {
        const newId = uid("stage");
        stageMap.set(item.id, newId);
        database.stages.push({
          ...clone(item),
          id: newId,
          organizationId,
          pipelineId: pipelineMap.get(item.pipelineId) || item.pipelineId,
        });
      });

    database.customFields
      .filter((item) => item.organizationId === configurationSourceId)
      .forEach((item) =>
        database.customFields.push({
          ...clone(item),
          id: uid("field"),
          organizationId,
        }),
      );

    database.tags
      .filter((item) => item.organizationId === configurationSourceId)
      .forEach((item) =>
        database.tags.push({ ...clone(item), id: uid("tag"), organizationId }),
      );

    database.integrations
      .filter((item) => item.organizationId === configurationSourceId)
      .forEach((item) =>
        database.integrations.push({
          ...clone(item),
          id: uid("integration"),
          organizationId,
          status: "disconnected",
          accountLabel: "Aguardando conexão",
          secretMasked: "",
          targetPipelineId:
            pipelineMap.get(item.targetPipelineId) ||
            Array.from(pipelineMap.values())[0] ||
            "",
          targetStageId:
            stageMap.get(item.targetStageId) ||
            Array.from(stageMap.values())[0] ||
            "",
          defaultOwnerId: null,
          lastEventAt: null,
          lastTestAt: null,
          eventsReceived: 0,
          errors: [],
        }),
      );

    writeDatabase(database);
  }

  async switchOrganization(session: Session, organizationId: string) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "developer.manage"))
      throw new Error("Sem permissão para alternar empresas.");
    const organization = database.organizations.find(
      (item) => item.id === organizationId,
    );
    if (!organization) throw new Error("Empresa não encontrada.");

    if (
      !database.pipelines.some((item) => item.organizationId === organizationId)
    ) {
      const sourceId = database.pipelines.some(
        (item) => item.organizationId === session.organizationId,
      )
        ? session.organizationId
        : "org_projem";
      const pipelineMap = new Map<string, string>();
      database.pipelines
        .filter((item) => item.organizationId === sourceId)
        .forEach((item) => {
          const id = uid("pipe");
          pipelineMap.set(item.id, id);
          database.pipelines.push({ ...clone(item), id, organizationId });
        });
      const stageMap = new Map<string, string>();
      database.stages
        .filter((item) => item.organizationId === sourceId)
        .forEach((item) => {
          const id = uid("stage");
          stageMap.set(item.id, id);
          database.stages.push({
            ...clone(item),
            id,
            organizationId,
            pipelineId: pipelineMap.get(item.pipelineId) || item.pipelineId,
          });
        });
      database.customFields
        .filter((item) => item.organizationId === sourceId)
        .forEach((item) =>
          database.customFields.push({
            ...clone(item),
            id: uid("field"),
            organizationId,
          }),
        );
      database.tags
        .filter((item) => item.organizationId === sourceId)
        .forEach((item) =>
          database.tags.push({
            ...clone(item),
            id: uid("tag"),
            organizationId,
          }),
        );
      database.integrations
        .filter((item) => item.organizationId === sourceId)
        .forEach((item) =>
          database.integrations.push({
            ...clone(item),
            id: uid("integration"),
            organizationId,
            status: "disconnected",
            accountLabel: "Aguardando conexão",
            secretMasked: "",
            targetPipelineId:
              pipelineMap.get(item.targetPipelineId) ||
              Array.from(pipelineMap.values())[0] ||
              "",
            targetStageId:
              stageMap.get(item.targetStageId) ||
              Array.from(stageMap.values())[0] ||
              "",
            defaultOwnerId: null,
            lastEventAt: null,
            lastTestAt: null,
            eventsReceived: 0,
            errors: [],
          }),
        );
    }

    let targetAdmin = database.users.find(
      (item) =>
        item.organizationId === organizationId &&
        item.role === "super_admin" &&
        item.active,
    );
    if (!targetAdmin) {
      const pipelineIds = database.pipelines
        .filter((item) => item.organizationId === organizationId)
        .map((item) => item.id);
      targetAdmin = {
        ...clone(actor),
        id: uid("usr"),
        organizationId,
        name: `${actor.name} — ${organization.name}`,
        email: `admin+${organization.slug}@demo.local`,
        initials: initials(actor.name),
        pipelineIds,
        demoPassword: "projem123",
      };
      database.users.push(targetAdmin);
    }

    const nextSession: Session = {
      token: uid("local"),
      userId: targetAdmin.id,
      organizationId,
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    };
    writeDatabase(database);
    localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    return nextSession;
  }
async openWhatsAppConversation(
    session: Session,
    leadId: string,
  ): Promise<string> {
    const database = readDatabase();
    const actor = currentUser(
      database,
      session,
    );

    if (!can(actor, "messages.manage")) {
      throw new Error(
        "Seu perfil não pode iniciar conversas.",
      );
    }

    const lead = database.leads.find(
      (item) =>
        item.id === leadId &&
        item.organizationId ===
          session.organizationId,
    );

    if (!lead) {
      throw new Error(
        "Lead não encontrado.",
      );
    }

    if (
      !canAccessLead(
        actor,
        lead,
        initialStageIds(
          database,
          session.organizationId,
        ),
      )
    ) {
      throw new Error(
        "Este lead não está no seu escopo de acesso.",
      );
    }

    if (!lead.phone.trim()) {
      throw new Error(
        "O lead não possui telefone.",
      );
    }

    const existing =
      database.conversations.find(
        (conversation) =>
          conversation.organizationId ===
            session.organizationId &&
          conversation.leadId === leadId &&
          conversation.channel ===
            "whatsapp",
      );

    if (existing) {
      if (existing.status === "closed") {
        existing.status = "open";
      }

      writeDatabase(database);
      return existing.id;
    }

    const conversationId =
      uid("conv");

    database.conversations.push({
      id: conversationId,
      organizationId:
        session.organizationId,
      leadId,
      channel: "whatsapp",
      ownerId: actor.id,
      status: "open",
      unread: 0,
      lastMessageAt: nowIso(),
      signaturePending: true,
    });

    writeDatabase(database);

    return conversationId;
  }

  async sendMessage(session: Session, conversationId: string, body: string) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "messages.manage"))
      throw new Error("Seu perfil possui acesso somente para leitura.");

    const conversation = database.conversations.find(
      (item) =>
        item.id === conversationId &&
        item.organizationId === session.organizationId,
    );
    if (!conversation) throw new Error("Conversa não encontrada.");
    if (conversation.status === "closed")
      throw new Error("Reabra a conversa antes de responder.");
    if (conversation.ownerId !== actor.id && actor.role !== "super_admin") {
      throw new Error("Transfira a conversa para você antes de responder.");
    }

    const lead = database.leads.find(
      (item) =>
        item.id === conversation.leadId &&
        item.organizationId === session.organizationId,
    );
    if (
      !lead ||
      !canAccessLead(
        actor,
        lead,
        initialStageIds(database, session.organizationId),
      )
    ) {
      throw new Error("Esta conversa não está no seu escopo de acesso.");
    }

    const cleanBody = body.trim();
    if (!cleanBody) throw new Error("A mensagem está vazia.");
    if (cleanBody.length > 4096)
      throw new Error("A mensagem excede o limite permitido.");
    const prefix = conversation.signaturePending
      ? `${actor.name} | ${actor.roleLabel}\n\n`
      : "";
    const timestamp = nowIso();

    database.messages.push({
      id: uid("msg"),
      organizationId: session.organizationId,
      conversationId,
      senderUserId: actor.id,
      direction: "outbound",
      body: `${prefix}${cleanBody}`,
      status: "sent",
      createdAt: timestamp,
    });
    conversation.signaturePending = false;
    conversation.lastMessageAt = timestamp;
    conversation.unread = 0;
    lead.lastContact = "Agora";
    lead.updatedAt = timestamp;
    database.histories.unshift({
      id: uid("hist"),
      organizationId: session.organizationId,
      leadId: lead.id,
      actorId: actor.id,
      type: "message",
      description: "Mensagem enviada pelo atendimento interno",
      createdAt: timestamp,
    });
    writeDatabase(database);
  }

  async transferConversation(
    session: Session,
    conversationId: string,
    userId: string,
  ) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "leads.assign"))
      throw new Error("Seu perfil não pode transferir atendimentos.");

    const conversation = database.conversations.find(
      (item) =>
        item.id === conversationId &&
        item.organizationId === session.organizationId,
    );
    const nextOwner = database.users.find(
      (item) =>
        item.id === userId &&
        item.organizationId === session.organizationId &&
        item.active,
    );
    if (!conversation || !nextOwner)
      throw new Error("Conversa ou responsável não encontrados.");
    if (!["super_admin", "sales", "sdr"].includes(nextOwner.role)) {
      throw new Error("O perfil selecionado não pode assumir atendimentos.");
    }

    const lead = database.leads.find(
      (item) =>
        item.id === conversation.leadId &&
        item.organizationId === session.organizationId,
    );
    if (!lead) throw new Error("Lead vinculado à conversa não encontrado.");
    if (
      nextOwner.role !== "super_admin" &&
      !nextOwner.pipelineIds.includes(lead.pipelineId)
    ) {
      throw new Error(
        "O usuário selecionado não possui acesso ao funil deste lead.",
      );
    }
    if (conversation.ownerId === nextOwner.id) return;

    const previousOwner = database.users.find(
      (item) => item.id === conversation.ownerId,
    );
    conversation.ownerId = nextOwner.id;
    conversation.signaturePending = true;
    conversation.lastMessageAt = nowIso();
    lead.ownerId = nextOwner.id;
    lead.updatedAt = nowIso();

    database.messages.push({
      id: uid("msg"),
      organizationId: session.organizationId,
      conversationId,
      senderUserId: actor.id,
      direction: "internal",
      body: `Atendimento transferido de ${previousOwner?.name || "outro usuário"} para ${nextOwner.name} por ${actor.name}.`,
      status: "sent",
      createdAt: nowIso(),
    });
    database.histories.unshift({
      id: uid("hist"),
      organizationId: session.organizationId,
      leadId: lead.id,
      actorId: actor.id,
      type: "assigned",
      description: `Atendimento e lead transferidos para ${nextOwner.name}`,
      createdAt: nowIso(),
    });
    notify(
      database,
      session.organizationId,
      "Atendimento transferido",
      `${lead.name} foi transferido para você.`,
      nextOwner.id,
    );
    writeDatabase(database);
  }

  async markConversationRead(session: Session, conversationId: string) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "messages.read"))
      throw new Error("Sem permissão para visualizar mensagens.");
    const conversation = database.conversations.find(
      (item) =>
        item.id === conversationId &&
        item.organizationId === session.organizationId,
    );
    if (!conversation) throw new Error("Conversa não encontrada.");
    conversation.unread = 0;
    writeDatabase(database);
  }

  async markNotificationRead(session: Session, notificationId?: string) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    database.notifications
      .filter(
        (item) =>
          item.organizationId === session.organizationId &&
          (item.userId === null || item.userId === actor.id) &&
          (!notificationId || item.id === notificationId),
      )
      .forEach((item) => {
        item.read = true;
      });
    writeDatabase(database);
  }

  async updateIntegration(
    session: Session,
    integration: IntegrationConnection,
  ) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "integrations.manage"))
      throw new Error("Sem permissão para gerenciar integrações.");
    if (!integration.name.trim())
      throw new Error("Informe o nome da integração.");

    const pipeline = database.pipelines.find(
      (item) =>
        item.id === integration.targetPipelineId &&
        item.organizationId === session.organizationId,
    );
    const stage = database.stages.find(
      (item) =>
        item.id === integration.targetStageId &&
        item.organizationId === session.organizationId &&
        item.pipelineId === integration.targetPipelineId,
    );
    if (!pipeline || !stage) throw new Error("Destino da integração inválido.");
    if (integration.defaultOwnerId) {
      const owner = database.users.find(
        (item) =>
          item.id === integration.defaultOwnerId &&
          item.organizationId === session.organizationId &&
          item.active,
      );
      if (!owner) throw new Error("Responsável padrão inválido.");
      if (
        owner.role !== "super_admin" &&
        !owner.pipelineIds.includes(pipeline.id)
      ) {
        throw new Error(
          "O responsável padrão não possui acesso ao funil selecionado.",
        );
      }
    }

    const mappings = integration.fieldMappings
      .map((item) => ({
        source: item.source.trim(),
        target: item.target.trim(),
      }))
      .filter((item) => item.source && item.target);
    const saved = {
      ...integration,
      name: integration.name.trim(),
      accountLabel: integration.accountLabel.trim(),
      fieldMappings: mappings,
      organizationId: session.organizationId,
    };
    const index = database.integrations.findIndex(
      (item) =>
        item.id === saved.id && item.organizationId === session.organizationId,
    );
    if (index >= 0) database.integrations[index] = saved;
    else database.integrations.push(saved);
    writeDatabase(database);
  }

  async testIntegration(session: Session, integrationId: string) {
    const database = readDatabase();
    const actor = currentUser(database, session);
    if (!can(actor, "integrations.manage"))
      throw new Error("Sem permissão para testar integrações.");
    const integration = database.integrations.find(
      (item) =>
        item.id === integrationId &&
        item.organizationId === session.organizationId,
    );
    if (!integration) throw new Error("Integração não encontrada.");
    integration.lastTestAt = nowIso();
    integration.status = "connected";
    integration.errors = [];
    integration.eventsReceived += 1;
    notify(
      database,
      session.organizationId,
      "Integração testada",
      `${integration.name} respondeu corretamente.`,
      actor.id,
    );
    writeDatabase(database);
  }

  async resetDemo() {
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem(SESSION_KEY);
  }
}
