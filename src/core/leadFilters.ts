import type { LeadTemperature } from "./types";

export type LeadSpecialFilter =
  | "without_next_task"
  | "invalid_owner"
  | "unread_conversation"
  | "overdue_task"
  | "open_lead"
  | "won_lead";

export interface LeadListPreset {
  id: number;
  pipelineId?: string;
  stageId?: string;
  ownerId?: string;
  origin?: string;
  temperature?: LeadTemperature;
  dateFrom?: string;
  dateTo?: string;
  special?: LeadSpecialFilter;
  label?: string;
}
