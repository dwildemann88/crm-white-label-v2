import { CalendarDays, Check, LockKeyhole, Plus, Save, ShieldCheck, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCrm } from "../app/CrmContext";
import { eligibleLeadOwners } from "../core/crmConsistency";
import {
  createDefaultLeadFields,
  leadFieldHasValue,
  orderLeadFields,
} from "../core/leadFields";
import type {
  Lead,
  LeadFieldDefinition,
  LeadFieldKey,
  LeadInput,
  Task,
  TaskInput,
  UserInput,
} from "../core/types";
import { localDateKey } from "../core/utils";
import { ModalShell, TagSelector } from "./Common";

const defaultOrigins = [
  "Meta Ads",
  "Google Ads",
  "Landing Page",
  "Indicação",
  "Evento",
  "Entrada manual",
];

function StandardLeadField({
  field,
  form,
  originOptions,
  autoFocus,
  onChange,
}: {
  field: LeadFieldDefinition;
  form: LeadInput;
  originOptions: string[];
  autoFocus: boolean;
  onChange(key: LeadFieldKey, value: string | number): void;
}) {
  const label = `${field.label}${field.required ? " *" : ""}`;
  const className = field.key === "notes" ? "full-field" : undefined;

  if (field.key === "origin") {
    return (
      <label className={className}>
        {label}
        <select
          value={form.origin}
          required={field.required}
          autoFocus={autoFocus}
          onChange={(event) => onChange(field.key, event.target.value)}
        >
          {!form.origin && <option value="">Selecione</option>}
          {originOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.key === "priority") {
    return (
      <label className={className}>
        {label}
        <select
          value={form.priority}
          required={field.required}
          autoFocus={autoFocus}
          onChange={(event) => onChange(field.key, event.target.value)}
        >
          <option>Baixa</option>
          <option>Média</option>
          <option>Alta</option>
          <option>Urgente</option>
        </select>
      </label>
    );
  }

  if (field.key === "temperature") {
    return (
      <label className={className}>
        {label}
        <select
          value={form.temperature}
          required={field.required}
          autoFocus={autoFocus}
          onChange={(event) => onChange(field.key, event.target.value)}
        >
          <option>Frio</option>
          <option>Morno</option>
          <option>Quente</option>
        </select>
      </label>
    );
  }

  if (field.key === "score" || field.key === "value") {
    const isScore = field.key === "score";
    return (
      <label className={className}>
        {label}
        <input
          type="number"
          min="0"
          max={isScore ? "100" : undefined}
          value={form[field.key]}
          required={field.required}
          autoFocus={autoFocus}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            const value = isScore
              ? Math.min(100, Math.max(0, parsed))
              : Math.max(0, parsed);
            onChange(field.key, value);
          }}
        />
      </label>
    );
  }

  if (field.key === "notes") {
    return (
      <label className={className}>
        {label}
        <textarea
          value={form.notes}
          required={field.required}
          autoFocus={autoFocus}
          onChange={(event) => onChange(field.key, event.target.value)}
          placeholder="Registre informações relevantes para a equipe"
        />
      </label>
    );
  }

  const inputType =
    field.key === "email"
      ? "email"
      : field.key === "phone"
        ? "tel"
        : "text";

  return (
    <label className={className}>
      {label}
      <input
        type={inputType}
        value={String(form[field.key] ?? "")}
        required={field.required}
        autoFocus={autoFocus}
        placeholder={field.key === "phone" ? "Digite o telefone" : undefined}
        onChange={(event) => onChange(field.key, event.target.value)}
      />
    </label>
  );
}

export function LeadModal({
  lead,
  onClose,
}: {
  lead?: Lead | null;
  onClose(): void;
}) {
  const { data, currentUser, saveLead, can } = useCrm();
  const pipelines = (data?.pipelines || []).filter((item) => item.active);
  const allStages = [...(data?.stages || [])].sort((a, b) => a.order - b.order);
  const users = (data?.users || []).filter((user) => user.active);
  const customFields = (data?.customFields || []).filter(
    (field) => field.active,
  );
  const tags = (data?.tags || []).map((tag) => tag.name);
  const tagColors = Object.fromEntries(
    (data?.tags || []).map((tag) => [tag.name, tag.color]),
  );
  const organizationId = data?.session?.organizationId || "current";
  const configuredLeadFields = data?.leadFields || [];
  const leadFields = useMemo(
    () =>
      orderLeadFields(
        (configuredLeadFields.length
          ? configuredLeadFields
          : createDefaultLeadFields(organizationId)
        ).filter((field) => field.active),
      ),
    [configuredLeadFields, organizationId],
  );

  const [form, setForm] = useState<LeadInput>(() =>
    lead
      ? { ...lead }
      : {
          pipelineId: pipelines[0]?.id || "",
          stageId:
            allStages.find((stage) => stage.pipelineId === pipelines[0]?.id)
              ?.id || "",
          name: "",
          company: "",
          phone: "",
          email: "",
          city: "",
          origin: "Entrada manual",
          campaign: "",
          priority: "Média",
          temperature: "Morno",
          score: 60,
          ownerId: currentUser?.id || users[0]?.id || "",
          tags: [],
          value: 0,
          notes: "",
          customValues: {},
        },
  );

  const stages = allStages.filter(
    (stage) => stage.pipelineId === form.pipelineId,
  );

  useEffect(() => {
    const stageIsValid = stages.some((stage) => stage.id === form.stageId);
    if (!stageIsValid && stages[0]) {
      setForm((old) => ({ ...old, stageId: stages[0].id }));
    }
  }, [form.stageId, stages]);

  const change = <K extends keyof LeadInput>(key: K, value: LeadInput[K]) =>
    setForm((old) => ({ ...old, [key]: value }));
  const changeLeadField = (key: LeadFieldKey, value: string | number) =>
    setForm((old) => ({ ...old, [key]: value }) as LeadInput);

  const eligibleUsers = eligibleLeadOwners(users, form.pipelineId);
  useEffect(() => {
    if (eligibleUsers.some((user) => user.id === form.ownerId)) return;
    setForm((old) => ({ ...old, ownerId: eligibleUsers[0]?.id || "" }));
  }, [eligibleUsers, form.ownerId]);

  const originOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...defaultOrigins,
          ...(data?.leads || []).map((item) => item.origin).filter(Boolean),
          form.origin,
        ]),
      ).filter(Boolean),
    [data?.leads, form.origin],
  );

  const requiredLeadFieldsFilled = leadFields
    .filter((field) => field.required)
    .every((field) => leadFieldHasValue(form, field.key));
  const requiredCustomFieldsFilled = customFields
    .filter((field) => field.required)
    .every((field) => {
      const value = form.customValues?.[field.key];
      return value !== undefined && value !== null && value !== "";
    });
  const valid = Boolean(
    form.ownerId &&
      form.stageId &&
      requiredLeadFieldsFilled &&
      requiredCustomFieldsFilled,
  );
  const changeCustomValue = (key: string, value: string | number | boolean) =>
    setForm((old) => ({
      ...old,
      customValues: { ...(old.customValues || {}), [key]: value },
    }));

  return (
    <ModalShell
      title={lead ? "Editar lead" : "Cadastrar lead"}
      subtitle="Os campos visíveis e obrigatórios seguem a configuração desta empresa."
      onClose={onClose}
      wide
    >
      <form
        className="modal-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!valid) return;
          await saveLead(form);
          onClose();
        }}
      >
        <div className="form-grid">
          {leadFields.map((field, index) => (
            <StandardLeadField
              key={field.id}
              field={field}
              form={form}
              originOptions={originOptions}
              autoFocus={index === 0}
              onChange={changeLeadField}
            />
          ))}
        </div>

        <div className="custom-values-section">
          <strong>Organização no funil</strong>
          <div className="form-grid">
            <label>
              Funil *
              <select
                value={form.pipelineId}
                required
                onChange={(event) => {
                  const pipelineId = event.target.value;
                  const firstStage = allStages.find(
                    (stage) => stage.pipelineId === pipelineId,
                  );
                  const eligible = eligibleLeadOwners(users, pipelineId);
                  setForm((old) => ({
                    ...old,
                    pipelineId,
                    stageId: firstStage?.id || "",
                    ownerId: eligible.some((user) => user.id === old.ownerId)
                      ? old.ownerId
                      : eligible[0]?.id || "",
                  }));
                }}
              >
                {pipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Etapa *
              <select
                value={form.stageId}
                required
                onChange={(event) => change("stageId", event.target.value)}
              >
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Responsável *
              <select
                value={form.ownerId}
                required
                disabled={!can("leads.assign")}
                onChange={(event) => change("ownerId", event.target.value)}
              >
                {eligibleUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} — {user.roleLabel}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {customFields.length > 0 && (
          <div className="custom-values-section">
            <strong>Campos personalizados</strong>
            <div className="form-grid">
              {customFields.map((field) => {
                const value = form.customValues?.[field.key];
                if (field.type === "select") {
                  return (
                    <label key={field.id}>
                      {field.name}
                      {field.required ? " *" : ""}
                      <select
                        value={String(value ?? "")}
                        required={field.required}
                        onChange={(event) =>
                          changeCustomValue(field.key, event.target.value)
                        }
                      >
                        <option value="">Selecione</option>
                        {field.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }
                if (field.type === "boolean") {
                  return (
                    <label key={field.id}>
                      {field.name}
                      {field.required ? " *" : ""}
                      <select
                        value={
                          value === true
                            ? "true"
                            : value === false
                              ? "false"
                              : ""
                        }
                        required={field.required}
                        onChange={(event) =>
                          changeCustomValue(
                            field.key,
                            event.target.value === ""
                              ? ""
                              : event.target.value === "true",
                          )
                        }
                      >
                        <option value="">Selecione</option>
                        <option value="true">Sim</option>
                        <option value="false">Não</option>
                      </select>
                    </label>
                  );
                }
                return (
                  <label key={field.id}>
                    {field.name}
                    {field.required ? " *" : ""}
                    <input
                      type={
                        field.type === "number"
                          ? "number"
                          : field.type === "date"
                            ? "date"
                            : "text"
                      }
                      value={value === undefined ? "" : String(value)}
                      required={field.required}
                      onChange={(event) =>
                        changeCustomValue(
                          field.key,
                          field.type === "number"
                            ? event.target.value === ""
                              ? ""
                              : Number(event.target.value)
                            : event.target.value,
                        )
                      }
                    />
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <label className="full-field">
          Etiquetas
          <TagSelector
            available={tags}
            value={form.tags}
            onChange={(value) => change("tags", value)}
            colors={tagColors}
          />
        </label>

        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" disabled={!valid}>
            <Save size={17} /> Salvar lead
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function TaskModal({
  task,
  initialDate,
  initialLeadId,
  onClose,
}: {
  task?: Task;
  initialDate?: string;
  initialLeadId?: string;
  onClose(): void;
}) {
  const { data, currentUser, saveTask, deleteTask, can } = useCrm();
  const allUsers = (data?.users || []).filter((item) => item.active);
  const leads = data?.leads || [];
  const [form, setForm] = useState<TaskInput>(() =>
    task
      ? { ...task }
      : {
          title: "",
          description: "",
          date: initialDate || localDateKey(),
          time: "09:00",
          type: "Ligação",
          ownerId: currentUser?.id || allUsers[0]?.id || "",
          leadId: initialLeadId || null,
          priority: "Média",
          reminderMinutes: 15,
        },
  );

  const selectedLead = leads.find((leadItem) => leadItem.id === form.leadId);
  const users = selectedLead
    ? eligibleLeadOwners(allUsers, selectedLead.pipelineId)
    : [...allUsers].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  useEffect(() => {
    if (users.some((user) => user.id === form.ownerId)) return;
    setForm((old) => ({ ...old, ownerId: users[0]?.id || "" }));
  }, [form.ownerId, users]);

  const change = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) =>
    setForm((old) => ({ ...old, [key]: value }));

  return (
    <ModalShell
      title={task ? "Editar tarefa" : "Adicionar tarefa"}
      subtitle="Vincule um compromisso a um responsável e, opcionalmente, a um lead."
      onClose={onClose}
    >
      <form
        className="modal-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!form.title.trim()) return;
          await saveTask(form);
          onClose();
        }}
      >
        <label className="full-field">
          Título *
          <input
            value={form.title}
            onChange={(event) => change("title", event.target.value)}
            autoFocus
          />
        </label>
        <label className="full-field">
          Descrição
          <textarea
            value={form.description}
            onChange={(event) => change("description", event.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Data
            <input
              type="date"
              value={form.date}
              onChange={(event) => change("date", event.target.value)}
            />
          </label>
          <label>
            Horário
            <input
              type="time"
              value={form.time}
              onChange={(event) => change("time", event.target.value)}
            />
          </label>
          <label>
            Tipo
            <select
              value={form.type}
              onChange={(event) => change("type", event.target.value)}
            >
              <option>Ligação</option>
              <option>WhatsApp</option>
              <option>Visita</option>
              <option>Reunião</option>
              <option>Follow-up</option>
              <option>Tarefa interna</option>
            </select>
          </label>
          <label>
            Prioridade
            <select
              value={form.priority}
              onChange={(event) =>
                change("priority", event.target.value as TaskInput["priority"])
              }
            >
              <option>Baixa</option>
              <option>Média</option>
              <option>Alta</option>
              <option>Urgente</option>
            </select>
          </label>
          <label>
            Responsável
            <select
              value={form.ownerId}
              disabled={!can("leads.assign")}
              onChange={(event) => change("ownerId", event.target.value)}
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Lembrete
            <select
              value={form.reminderMinutes}
              onChange={(event) =>
                change("reminderMinutes", Number(event.target.value))
              }
            >
              <option value="0">Sem lembrete</option>
              <option value="5">5 minutos antes</option>
              <option value="15">15 minutos antes</option>
              <option value="30">30 minutos antes</option>
              <option value="60">1 hora antes</option>
              <option value="1440">1 dia antes</option>
            </select>
          </label>
        </div>

        <label className="full-field">
          Vincular a um lead
          <select
            value={form.leadId || ""}
            onChange={(event) => {
              const leadId = event.target.value || null;
              const nextLead = leads.find((leadItem) => leadItem.id === leadId);
              const eligible = nextLead
                ? eligibleLeadOwners(allUsers, nextLead.pipelineId)
                : [...allUsers].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
              setForm((old) => ({
                ...old,
                leadId,
                ownerId: eligible.some((user) => user.id === old.ownerId)
                  ? old.ownerId
                  : eligible[0]?.id || "",
              }));
            }}
          >
            <option value="">Sem vínculo</option>
            {leads.map((leadItem) => (
              <option key={leadItem.id} value={leadItem.id}>
                {leadItem.name} — {leadItem.company}
              </option>
            ))}
          </select>
        </label>

        <div className="modal-footer modal-footer-split">
          {task ? (
            <button
              type="button"
              className="danger-button"
              onClick={async () => {
                if (!window.confirm("Excluir esta tarefa?")) return;
                await deleteTask(task.id);
                onClose();
              }}
            >
              <Trash2 size={16} /> Excluir
            </button>
          ) : (
            <span />
          )}
          <div>
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button className="primary-button" disabled={!form.title.trim()}>
              <CalendarDays size={17} />{" "}
              {task ? "Salvar tarefa" : "Adicionar tarefa"}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

export function UserModal({
  userId,
  onClose,
}: {
  userId?: string;
  onClose(): void;
}) {
  const { data, saveUser } = useCrm();
  const isLocalProvider =
    (import.meta.env.VITE_DATA_PROVIDER || "local") === "local";
  const existing = data?.users.find((item) => item.id === userId);
  const pipelines = (data?.pipelines || []).filter((pipeline) => pipeline.active);
  const [form, setForm] = useState<UserInput>(() =>
    existing
      ? { ...existing }
      : {
          name: "",
          email: "",
          role: "sales",
          roleLabel: "Comercial",
          active: true,
          color: "#2563eb",
          pipelineIds: pipelines.map((item) => item.id),
          demoPassword: isLocalProvider ? "acesso-local" : undefined,
        },
  );

  const change = <K extends keyof UserInput>(key: K, value: UserInput[K]) =>
    setForm((old) => ({ ...old, [key]: value }));

  const roleOptions: Array<{
    value: UserInput["role"];
    label: string;
    description: string;
  }> = [
    {
      value: "super_admin",
      label: "Administrador",
      description: "Configura usuários, funis, campos, integrações e a organização.",
    },
    {
      value: "manager",
      label: "Gerente",
      description: "Coordena a equipe e acompanha a operação dos funis autorizados.",
    },
    {
      value: "sales",
      label: "Comercial",
      description: "Conduz oportunidades, tarefas e conversas da própria carteira.",
    },
    {
      value: "sdr",
      label: "SDR",
      description: "Recebe, qualifica e distribui oportunidades na entrada do processo.",
    },
  ];

  const selectedRole = roleOptions.find((role) => role.value === form.role)!;
  const allPipelinesSelected =
    pipelines.length > 0 && pipelines.every((pipeline) => form.pipelineIds.includes(pipeline.id));
  const valid = Boolean(
    form.name.trim() &&
      form.email.trim() &&
      (form.role === "super_admin" || form.pipelineIds.length > 0),
  );

  return (
    <ModalShell
      title={
        existing
          ? "Editar acesso do usuário"
          : isLocalProvider
            ? "Criar usuário local"
            : "Convidar usuário"
      }
      subtitle={
        isLocalProvider
          ? "Configure um perfil para validar a experiência e as permissões no ambiente local."
          : "O convite será enviado com acesso restrito à função e aos funis definidos abaixo."
      }
      onClose={onClose}
      wide
    >
      <form
        className="modal-form user-access-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!valid) return;
          await saveUser({
            ...form,
            name: form.name.trim(),
            email: form.email.trim(),
            roleLabel: selectedRole.label,
          });
          onClose();
        }}
      >
        <section className="modal-section-card">
          <div className="modal-section-title">
            <Users size={18} />
            <div>
              <strong>Identificação</strong>
              <span>Dados usados no convite, na atribuição de leads e na auditoria.</span>
            </div>
          </div>
          <div className="form-grid">
            <label>
              <span>Nome completo *</span>
              <input
                value={form.name}
                onChange={(event) => change("name", event.target.value)}
                autoFocus
                placeholder="Nome da pessoa"
              />
            </label>
            <label>
              <span>E-mail de acesso *</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => change("email", event.target.value)}
                placeholder="pessoa@empresa.com.br"
              />
            </label>
            <label>
              <span>Status do acesso</span>
              <select
                value={form.active ? "active" : "inactive"}
                onChange={(event) =>
                  change("active", event.target.value === "active")
                }
              >
                <option value="active">Ativo</option>
                <option value="inactive">Suspenso</option>
              </select>
            </label>
            {isLocalProvider ? (
              <label>
                <span>Senha do ambiente local</span>
                <input
                  value={form.demoPassword || ""}
                  onChange={(event) => change("demoPassword", event.target.value)}
                />
              </label>
            ) : (
              <div className="access-invite-note">
                <LockKeyhole size={17} />
                <div>
                  <strong>Convite seguro</strong>
                  <span>A senha será definida pelo próprio usuário no fluxo de autenticação.</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="modal-section-card">
          <div className="modal-section-title">
            <ShieldCheck size={18} />
            <div>
              <strong>Função e responsabilidades</strong>
              <span>Escolha a função que melhor representa o trabalho real da pessoa.</span>
            </div>
          </div>
          <div className="role-option-grid">
            {roleOptions.map((role) => (
              <button
                type="button"
                key={role.value}
                className={form.role === role.value ? "active" : ""}
                onClick={() => change("role", role.value)}
              >
                <span className="role-option-check">
                  {form.role === role.value && <Check size={14} />}
                </span>
                <div>
                  <strong>{role.label}</strong>
                  <small>{role.description}</small>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="modal-section-card">
          <div className="modal-section-title pipeline-access-title">
            <div>
              <strong>Funis autorizados</strong>
              <span>
                A pessoa somente poderá assumir leads e atuar nos funis selecionados.
              </span>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                change(
                  "pipelineIds",
                  allPipelinesSelected ? [] : pipelines.map((pipeline) => pipeline.id),
                )
              }
              disabled={form.role === "super_admin" || !pipelines.length}
            >
              {allPipelinesSelected ? "Limpar seleção" : "Selecionar todos"}
            </button>
          </div>

          {form.role === "super_admin" ? (
            <div className="access-admin-note">
              <ShieldCheck size={18} />
              <div>
                <strong>Acesso administrativo da organização</strong>
                <span>Administradores podem visualizar e configurar todos os funis desta empresa.</span>
              </div>
            </div>
          ) : (
            <div className="pipeline-access-grid">
              {pipelines.map((pipeline) => {
                const active = form.pipelineIds.includes(pipeline.id);
                return (
                  <button
                    type="button"
                    key={pipeline.id}
                    className={active ? "active" : ""}
                    onClick={() =>
                      change(
                        "pipelineIds",
                        active
                          ? form.pipelineIds.filter((id) => id !== pipeline.id)
                          : [...form.pipelineIds, pipeline.id],
                      )
                    }
                  >
                    <span>{active && <Check size={14} />}</span>
                    <div>
                      <strong>{pipeline.name}</strong>
                      <small>{pipeline.description || "Funil comercial"}</small>
                    </div>
                  </button>
                );
              })}
              {!pipelines.length && (
                <p className="muted padded">Nenhum funil ativo está disponível.</p>
              )}
            </div>
          )}
          {form.role !== "super_admin" && !form.pipelineIds.length && (
            <div className="form-warning">Selecione ao menos um funil para liberar o acesso operacional.</div>
          )}
        </section>

        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="primary-button" disabled={!valid}>
            <Plus size={17} />
            {existing
              ? "Salvar acesso"
              : isLocalProvider
                ? "Criar usuário"
                : "Enviar convite"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
