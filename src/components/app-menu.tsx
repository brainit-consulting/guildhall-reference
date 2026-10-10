"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { isCurrent, type MenuItem } from "@/lib/menu";
import { cn } from "@/lib/utils";

// Down the left from 768px; below that a top bar whose Menu button opens and closes the list.
export function AppMenu({ items }: { items: MenuItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-rule bg-panel md:sticky md:top-0 md:flex md:h-screen md:w-56 md:shrink-0 md:flex-col md:border-r md:border-b-0">
      <div className="flex h-14 items-center justify-between px-4 md:h-auto md:px-6 md:pt-10 md:pb-6">
        <span className="font-display text-xl text-ink">Guildhall</span>
        <Button
          variant="secondary"
          size="sm"
          className="md:hidden"
          aria-expanded={open}
          aria-controls="app-menu"
          onClick={() => setOpen((o) => !o)}
        >
          Menu
        </Button>
      </div>

      <div id="app-menu" className={cn(open ? "flex" : "hidden", "flex-1 flex-col border-t border-rule pb-4 md:flex md:pb-8")}>
        <nav aria-label="Main">
          <ul>
            {items.map((item) => {
              const current = isCurrent(pathname, item.href);
              return (
                <li key={item.href} className="border-b border-rule">
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "block border-l-2 py-2.5 pr-4 pl-[14px] md:pl-[22px]",
                      current ? "border-accent font-medium text-accent" : "border-transparent text-ink hover:text-accent",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-6 px-4 md:mt-auto md:px-6">
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
