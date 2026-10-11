import Link from "next/link";
import { connection } from "next/server";
import { BUSINESS_NAME } from "@/lib/brand";
import { APP_VERSION } from "@/lib/version";

// The last line of every page, so the owner can tell at a glance which version is running. A sibling of the page's
// content in a flex column with min-h-dvh above it, never fixed, so it can't cover anything.
export async function AppFooter({ settings = false }: { settings?: boolean }) {
  // The year is read per request; otherwise a page prerendered in December would show last year all January.
  await connection();
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-rule px-6 py-4 text-sm text-muted md:px-12">
      {/* each dot travels with the item after it, so a narrow screen never leaves one hanging at a line's end */}
      <p className="flex flex-wrap gap-x-3 gap-y-1">
        <span className="break-words">{BUSINESS_NAME}</span>
        <span className="whitespace-nowrap">
          <Dot />
          {year}
        </span>
        <span className="whitespace-nowrap">
          <Dot />
          Version {APP_VERSION}
        </span>
        {settings && (
          <span className="whitespace-nowrap">
            <Dot />
            <Link href="/settings" className="underline underline-offset-4 hover:text-accent">
              Settings
            </Link>
          </span>
        )}
      </p>
    </footer>
  );
}

function Dot() {
  return (
    <span aria-hidden="true" className="mr-3">
      ·
    </span>
  );
}
