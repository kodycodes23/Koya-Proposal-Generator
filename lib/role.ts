export type Role = "salesperson" | "manager";

export const ROLE_COOKIE = "koya_role";

export function parseRole(value: string | undefined | null): Role | null {
  return value === "manager" || value === "salesperson" ? value : null;
}

export const ROLE_LABELS: Record<Role, string> = {
  salesperson: "Sales Rep",
  manager: "Manager",
};
