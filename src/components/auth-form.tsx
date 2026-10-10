"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/lib/auth/client";
import { authErrorMessage, checkAuthForm, MIN_PASSWORD } from "@/lib/auth/messages";

type Mode = "signup" | "signin";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const form = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
    };
    const mistake = checkAuthForm(form, mode);
    if (mistake) return setError(mistake);

    setPending(true);
    setError(null);
    try {
      const result = mode === "signup"
        ? await signUp.email({ name: form.name.trim(), email: form.email, password: form.password })
        : await signIn.email({ email: form.email, password: form.password });
      if (result.error) {
        setError(authErrorMessage(result.error.code));
        setPending(false);
        return;
      }
      router.replace("/home");
      router.refresh();
    } catch {
      setError(authErrorMessage(null));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-5 border-t border-rule pt-6">
      {mode === "signup" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" autoComplete="name" required />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          aria-describedby={mode === "signup" ? "password-hint" : undefined}
          required
        />
        {mode === "signup" && (
          <p id="password-hint" className="text-sm text-muted">At least {MIN_PASSWORD} characters.</p>
        )}
      </div>

      {error && (
        <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col items-start gap-4">
        <Button type="submit" disabled={pending}>
          {mode === "signup" ? "Create account" : "Sign in"}
        </Button>
        <p className="text-sm text-muted">
          {mode === "signup" ? (
            <>Already have an account? <Link href="/signin" className="text-accent underline-offset-4 hover:underline">Sign in</Link></>
          ) : (
            <>New here? <Link href="/signup" className="text-accent underline-offset-4 hover:underline">Create account</Link></>
          )}
        </p>
      </div>
    </form>
  );
}
