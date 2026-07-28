import type {
  LeadFieldDefinition,
  LeadFieldKey,
  LeadFieldType,
  LeadInput,
} from "./types";

interface LeadFieldCatalogItem {
  key: LeadFieldKey;
  label: string;
  type: LeadFieldType;
  required: boolean;
  active: boolean;
  showInTable: boolean;
  position: number;
  locked: boolean;
}

export const leadFieldCatalog: readonly LeadFieldCatalogItem[] = [
  {
    key: "name",
    label: "Nome",
    type: "text",
    required: true,
    active: true,
    showInTable: true,
    position: 1,
    locked: true,
  },
  {
    key: "company",
    label: "Empresa",
    type: "text",
    required: false,
    active: true,
    showInTable: true,
    position: 2,
    locked: false,
  },
  {
    key: "phone",
    label: "Telefone",
    type: "phone",
    required: true,
    active: true,
    showInTable: true,
    position: 3,
    locked: false,
  },
  {
    key: "email",
    label: "E-mail",
    type: "email",
    required: false,
    active: true,
    showInTable: true,
    position: 4,
    locked: false,
  },
  {
    key: "city",
    label: "Cidade",
    type: "text",
    required: false,
    active: true,
    showInTable: true,
    position: 5,
    locked: false,
  },
  {
    key: "origin",
    label: "Origem",
    type: "select",
    required: false,
    active: true,
    showInTable: true,
    position: 6,
    locked: false,
  },
  {
    key: "campaign",
    label: "Campanha",
    type: "text",
    required: false,
    active: true,
    showInTable: false,
    position: 7,
    locked: false,
  },
  {
    key: "priority",
    label: "Prioridade",
    type: "select",
    required: false,
    active: true,
    showInTable: true,
    position: 8,
    locked: false,
  },
  {
    key: "temperature",
    label: "Temperatura",
    type: "select",
    required: false,
    active: true,
    showInTable: false,
    position: 9,
    locked: false,
  },
  {
    key: "score",
    label: "Score",
    type: "number",
    required: false,
    active: true,
    showInTable: false,
    position: 10,
    locked: false,
  },
  {
    key: "value",
    label: "Valor estimado",
    type: "number",
    required: false,
    active: true,
    showInTable: true,
    position: 11,
    locked: false,
  },
  {
    key: "notes",
    label: "Observações",
    type: "textarea",
    required: false,
    active: true,
    showInTable: false,
    position: 12,
    locked: false,
  },
];

const leadFieldKeys = new Set<LeadFieldKey>(
  leadFieldCatalog.map((field) => field.key),
);

export function isLeadFieldKey(value: unknown): value is LeadFieldKey {
  return typeof value === "string" && leadFieldKeys.has(value as LeadFieldKey);
}

export function createDefaultLeadFields(
  organizationId: string,
): LeadFieldDefinition[] {
  return leadFieldCatalog.map((field) => ({
    id: `lead-field-${organizationId}-${field.key}`,
    organizationId,
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    active: field.active,
    showInTable: field.showInTable,
    position: field.position,
    locked: field.locked,
  }));
}

export function normalizeLeadField(
  field: LeadFieldDefinition,
): LeadFieldDefinition {
  const catalog = leadFieldCatalog.find((item) => item.key === field.key);
  if (!catalog) return field;

  const active = field.key === "name" ? true : field.active;
  const required = field.key === "name" ? true : active && field.required;
  const showInTable = field.key === "name" ? true : active && field.showInTable;

  return {
    ...field,
    label: field.label.trim() || catalog.label,
    type: catalog.type,
    active,
    required,
    showInTable,
    locked: catalog.locked,
  };
}

export function orderLeadFields(
  fields: readonly LeadFieldDefinition[],
): LeadFieldDefinition[] {
  return [...fields].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return a.label.localeCompare(b.label, "pt-BR");
  });
}

export function resolveLeadFields(
  fields: readonly LeadFieldDefinition[],
  organizationId: string,
): LeadFieldDefinition[] {
  const configured = new Map(fields.map((field) => [field.key, field]));

  return orderLeadFields(
    createDefaultLeadFields(organizationId).map((fallback) =>
      normalizeLeadField(configured.get(fallback.key) || fallback),
    ),
  );
}

export function getLeadField(
  fields: readonly LeadFieldDefinition[],
  key: LeadFieldKey,
  organizationId: string,
): LeadFieldDefinition {
  return (
    resolveLeadFields(fields, organizationId).find((field) => field.key === key) ||
    createDefaultLeadFields(organizationId).find((field) => field.key === key)!
  );
}

export function leadFieldHasValue(
  lead: Pick<LeadInput, LeadFieldKey>,
  key: LeadFieldKey,
): boolean {
  const value = lead[key];

  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);

  return value !== null && value !== undefined;
}

export function leadFieldTypeLabel(type: LeadFieldType): string {
  const labels: Record<LeadFieldType, string> = {
    text: "Texto",
    email: "E-mail",
    phone: "Telefone",
    number: "Número",
    select: "Seleção",
    textarea: "Texto longo",
  };

  return labels[type];
}
