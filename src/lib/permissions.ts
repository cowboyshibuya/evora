import type { Role } from "./types";

export function canEditRecords(role: Role | undefined): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

export function canManageCompany(role: Role | undefined): boolean {
  return role === "owner" || role === "admin";
}
