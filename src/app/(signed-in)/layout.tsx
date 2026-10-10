// Every signed-in page sits in this group so they share the menu. Pages still call requireSession() themselves:
// a layout isn't re-run on every navigation, so it can't be the only guard.
import { AppMenu } from "@/components/app-menu";
import { requireSession } from "@/lib/auth/session";
import { menuFor } from "@/lib/menu";

export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession();
  return (
    <div className="md:flex">
      <AppMenu items={menuFor(user.role)} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
