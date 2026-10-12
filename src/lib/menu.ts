// The signed-in menu. A new page joins it with one line in MENU.
import type { Role } from "@/lib/access";

export type MenuItem = { href: string; label: string; ownerOnly?: boolean };

export const MENU: readonly MenuItem[] = [
  { href: "/home", label: "Home" },
  { href: "/contacts", label: "Contacts" },
  { href: "/companies", label: "Companies" },
  { href: "/deals", label: "Deals" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/tasks", label: "Tasks" },
  { href: "/clients", label: "Clients" },
  { href: "/projects", label: "Projects" },
  { href: "/settings", label: "Settings", ownerOnly: true },
];

export function menuFor(role: Role | string | null | undefined): MenuItem[] {
  const owner = role === "owner";
  return MENU.filter((item) => owner || !item.ownerOnly);
}

// A page below an item (/contacts/123) still marks that item as current.
export function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
