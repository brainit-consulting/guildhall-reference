// Pages anyone can open (welcome, sign-in, sign-up, the enquiry form). The group only adds the footer; URLs don't change.
import { AppFooter } from "@/components/app-footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      {children}
      <AppFooter />
    </div>
  );
}
