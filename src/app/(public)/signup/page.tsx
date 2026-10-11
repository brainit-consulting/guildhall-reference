import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/auth/session";
import { BUSINESS_NAME } from "@/lib/brand";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage() {
  if (await getSession()) redirect("/home");
  return (
    <main className="mx-auto flex w-full flex-1 max-w-md flex-col justify-center px-6 py-12">
      <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Create account</h1>
      <p className="mt-3 text-muted">Create your account for {BUSINESS_NAME}.</p>
      <AuthForm mode="signup" />
    </main>
  );
}
