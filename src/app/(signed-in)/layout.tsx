// Every signed-in page sits in this group so they share the menu. Pages still call requireSession() themselves:
// a layout isn't re-run on every navigation, so it can't be the only guard.
import { AppFooter } from "@/components/app-footer";
import { AppMenu } from "@/components/app-menu";
import { requireSession } from "@/lib/auth/session";
import { menuFor } from "@/lib/menu";

export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession();
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <AppMenu items={menuFor(user.role)} />
      {/* the footer sits in the content column, beside the menu, so a short page still ends at the screen's foot */}
      <div className="flex min-w-0 flex-1 flex-col">
        {children}
        <AppFooter settings={user.role === "owner"} />
      </div>
    </div>
  );
}
