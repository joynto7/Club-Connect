export const ROLE_CAPABILITIES = {
  viewDashboardStats: ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"],
  approveClubs:       ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"],
  approveEvents:      ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"],
  viewContentReports: ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"],
  viewAnalytics:      ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"],
  viewReports:        ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"],
  manageUsers:        ["SYSTEM_ADMIN"],
  viewSettings:       ["SYSTEM_ADMIN"],
  viewAuditLog:       ["SYSTEM_ADMIN"],
  viewSystemMonitor:  ["SYSTEM_ADMIN"],
} as const;

export type Capability = keyof typeof ROLE_CAPABILITIES;

export function hasCapability(role: string, capability: Capability): boolean {
  return (ROLE_CAPABILITIES[capability] as readonly string[]).includes(role);
}
