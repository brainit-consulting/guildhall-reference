import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";
import { db } from "@/lib/db/client";
import { formatMoney } from "@/lib/money";
import { listProjects } from "@/lib/projects";

export const metadata: Metadata = { title: "Projects" };

const link = "tap-target text-accent underline-offset-4 hover:underline";

export default async function ProjectsPage() {
  await requireSession();
  const projects = await listProjects(db);
  return (
    <main className="max-w-5xl px-6 py-12 md:px-12">
      <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Projects</h1>

      {projects.length === 0 ? (
        <p className="mt-8 border-t border-rule pt-6 text-muted">
          No projects yet. Open a <Link href="/clients" className="text-accent underline-offset-4 hover:underline">client</Link> and
          press Add project.
        </p>
      ) : (
        <>
          {/* Under 768px each project is a stacked block: the name as the link, then "Label: value" lines (DESIGN.md). */}
          <ul aria-label="Projects" className="mt-8 border-t border-rule md:hidden">
            {projects.map((p) => (
              <li key={p.id} className="border-b border-rule py-3">
                <Link href={`/projects/${p.id}`} className={`${link} wrap-anywhere`}>{p.name}</Link>
                <p className="mt-1 text-sm text-ink wrap-anywhere"><span className="text-muted">Client:</span> {p.clientName}</p>
                <p className="mt-1 text-sm text-ink"><span className="text-muted">Status:</span> {p.status}</p>
                <p className="mt-1 text-sm text-ink"><span className="text-muted">Budget:</span> <span className="tabular-nums">{formatMoney(p.budget)}</span></p>
                <p className="mt-1 text-sm text-ink"><span className="text-muted">Dates:</span> {formatDay(p.startOn)} to {formatDay(p.endOn)}</p>
              </li>
            ))}
          </ul>

          <div className="mt-8 hidden overflow-x-auto md:block">
            <table aria-label="Projects" className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-rule bg-panel text-sm text-muted">
                  <th scope="col" className="px-3 py-2 font-medium">Name</th>
                  <th scope="col" className="px-3 py-2 font-medium">Client</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Budget</th>
                  <th scope="col" className="px-3 py-2 font-medium">Start</th>
                  <th scope="col" className="px-3 py-2 font-medium">End</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b border-rule">
                    <td className="px-3 py-2 wrap-anywhere"><Link href={`/projects/${p.id}`} className={link}>{p.name}</Link></td>
                    <td className="px-3 py-2 wrap-anywhere"><Link href={`/clients/${p.clientId}`} className={link}>{p.clientName}</Link></td>
                    <td className={`px-3 py-2 ${p.status === "Done" ? "text-muted" : "text-ink"}`}>{p.status}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">{formatMoney(p.budget)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-ink">{formatDay(p.startOn)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-ink">{formatDay(p.endOn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
