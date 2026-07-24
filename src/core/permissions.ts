import type { Lead, RoleKey, User } from "./types";

export type Permission =
  | "dashboard.read"
  | "leads.read.all"
  | "leads.read.own"
  | "leads.write"
  | "leads.create"
  | "leads.assign"
  | "pipeline.move"
  | "pipeline.manage"
  | "tasks.read"
  | "tasks.manage"
  | "messages.read"
  | "messages.manage"
  | "reports.read"
  | "tags.manage"
  | "users.manage"
  | "integrations.manage"
  | "branding.manage"
  | "developer.manage";

const permissions: Record<RoleKey, Permission[]> = {
  super_admin: [
    "dashboard.read",
    "leads.read.all",
    "leads.write",
    "leads.create",
    "leads.assign",
    "pipeline.move",
    "pipeline.manage",
    "tasks.read",
    "tasks.manage",
    "messages.read",
    "messages.manage",
    "reports.read",
    "tags.manage",
    "users.manage",
    "integrations.manage",
    "branding.manage",
    "developer.manage",
  ],
  manager: [
    "dashboard.read",
    "leads.read.all",
    "leads.write",
    "leads.create",
    "leads.assign",
    "pipeline.move",
    "tasks.read",
    "tasks.manage",
    "messages.read",
    "messages.manage",
    "reports.read",
    "tags.manage",
  ],
  sales: [
    "dashboard.read",
    "leads.read.own",
    "leads.write",
    "leads.create",
    "pipeline.move",
    "tasks.read",
    "tasks.manage",
    "messages.read",
    "messages.manage",
    "reports.read",
    "tags.manage",
  ],
  sdr: [
    "dashboard.read",
    "leads.read.own",
    "leads.write",
    "leads.create",
    "leads.assign",
    "pipeline.move",
    "tasks.read",
    "tasks.manage",
    "messages.read",
    "messages.manage",
    "tags.manage",
  ],
};

const databasePermissionMap: Partial<Record<Permission, string[]>> = {
  "leads.read.all": ["leads.read_all"],
  "leads.read.own": ["leads.read_assigned", "leads.read_unassigned"],
  "leads.write": ["leads.update", "leads.update_all", "leads.update_assigned"],
  "leads.create": ["leads.create"],
  "leads.assign": ["leads.assign"],
  "pipeline.move": ["leads.move", "leads.move_all", "leads.move_assigned"],
  "pipeline.manage": ["pipelines.manage"],
  "tasks.read": ["tasks.read_all", "tasks.read_own"],
  "tasks.manage": [
    "tasks.create",
    "tasks.update_all",
    "tasks.update_own",
    "tasks.delete_all",
    "tasks.delete_own",
  ],
  "messages.read": [
    "conversations.read_all",
    "conversations.read_assigned",
    "conversations.read_unassigned",
  ],
  "messages.manage": [
    "conversations.reply",
    "conversations.create",
    "conversations.assign",
  ],
  "tags.manage": ["tags.manage", "tags.create"],
  "integrations.manage": ["integrations.manage"],
};

export const can = (user: User | null, permission: Permission) => {
  if (!user) return false;

  if (permission === "developer.manage") {
    return user.isPlatformAdmin === true ||
      (user.permissions === undefined && user.role === "super_admin");
  }

  if (permission === "users.manage" || permission === "branding.manage") {
    return user.isPlatformAdmin === true || user.role === "super_admin";
  }

  if (permission === "dashboard.read") return true;

  if (user.permissions !== undefined) {
    const required = databasePermissionMap[permission];
    if (required?.some((code) => user.permissions?.includes(code))) return true;

    // Relatórios usam os mesmos dados já liberados para leitura de leads e tarefas.
    if (permission === "reports.read") {
      return user.permissions.some((code) =>
        ["leads.read_all", "leads.read_assigned", "tasks.read_all"].includes(code),
      );
    }

    return false;
  }

  return permissions[user.role].includes(permission);
};

export function canAccessLead(
  user: User | null,
  lead: Lead,
  initialStageIds: string[],
) {
  if (!user || user.organizationId !== lead.organizationId) return false;
  if (can(user, "leads.read.all")) return true;
  if (!user.pipelineIds.includes(lead.pipelineId)) return false;
  if (lead.ownerId === user.id) return true;
  return user.role === "sdr" && initialStageIds.includes(lead.stageId);
}
