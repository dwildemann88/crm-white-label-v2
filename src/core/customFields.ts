import type {
  CustomFieldDefinition,
  CustomFieldType,
} from "./types";

export const customFieldTypeOptions: Array<{
  value: CustomFieldType;
  label: string;
}> = [
  { value: "text", label: "Texto curto" },
  { value: "textarea", label: "Texto longo" },
  { value: "number", label: "Número" },
  { value: "currency", label: "Moeda" },
  { value: "date", label: "Data" },
  { value: "datetime", label: "Data e hora" },
  { value: "select", label: "Seleção" },
  { value: "boolean", label: "Sim/Não" },
  { value: "phone", label: "Telefone" },
  { value: "email", label: "E-mail" },
  { value: "url", label: "Link" },
];

export function customFieldTypeLabel(type: CustomFieldType): string {
  return (
    customFieldTypeOptions.find((item) => item.value === type)?.label ?? type
  );
}

export function customFieldSupportsOptions(type: CustomFieldType): boolean {
  return type === "select";
}

export function orderCustomFields(
  fields: CustomFieldDefinition[],
): CustomFieldDefinition[] {
  return [...fields].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name, "pt-BR"),
  );
}

export function customFieldAppliesToPipeline(
  field: CustomFieldDefinition,
  pipelineId: string,
): boolean {
  return field.pipelineId === null || field.pipelineId === pipelineId;
}
