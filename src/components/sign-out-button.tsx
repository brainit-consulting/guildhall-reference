"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    await signOut();
    router.replace("/signin");
    router.refresh();
  }

  return (
    <Button variant="secondary" onClick={onClick} disabled={pending}>
      Sign out
    </Button>
  );
}
