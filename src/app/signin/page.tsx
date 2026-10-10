import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in · Guildhall" };

export default async function SignInPage() {
  if (await getSession()) redirect("/home");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Sign in</h1>
      <p className="mt-3 text-muted">Welcome back to Guildhall.</p>
      <AuthForm mode="signin" />
    </main>
  );
}
