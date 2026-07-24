import type { Lead, User } from "./types";

const allPipelinePermissionCodes = new Set([
  "leads.read_all",
  "leads.update_all",
  "leads.move_all",
  "tasks.read_all",
  "conversations.read_all",
]);

const replyPermissionCodes = new Set([
  "conversations.reply",
  "conversations.assign",
  "conversations.create",
]);

export function hasGlobalPipelineAccess(user: User | null | undefined): boolean {
  if (!user || !user.active) return false;
  if (user.isPlatformAdmin || user.role === "super_admin") return true;
  return Boolean(user.permissions?.some((code) => allPipelinePermissionCodes.has(code)));
}

export function canUserAccessPipeline(
  user: User | null | undefined,
  pipelineId: string | null | undefined,
): boolean {
  if (!user || !user.active || !pipelineId) return false;
  return hasGlobalPipelineAccess(user) || user.pipelineIds.includes(pipelineId);
}

export function canUserOwnLead(
  user: User | null | undefined,
  pipelineId: string | null | undefined,
): boolean {
  return canUserAccessPipeline(user, pipelineId);
}

export function canUserHandleConversation(
  user: User | null | undefined,
  pipelineId: string | null | undefined,
): boolean {
  if (!canUserAccessPipeline(user, pipelineId)) return false;
  if (!user?.permissions) return true;
  return user.permissions.some((code) => replyPermissionCodes.has(code));
}

export function eligibleLeadOwners(users: User[], pipelineId: string): User[] {
  return users
    .filter((user) => canUserOwnLead(user, pipelineId))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function eligibleConversationOwners(users: User[], pipelineId: string): User[] {
  return users
    .filter((user) => canUserHandleConversation(user, pipelineId))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function isLeadOwnerConsistent(lead: Lead, users: User[]): boolean {
  const owner = users.find((user) => user.id === lead.ownerId);
  return canUserOwnLead(owner, lead.pipelineId);
}
