// What a list page shows, kept in its address so a copied link opens the same view: `q` (search), `sort` (a column
// key) and `dir` (asc or desc). Plain functions with no React, shared by every list and usable on the client.

export type SortDir = "asc" | "desc";
export type ListView<K extends string = string> = { q: string; sort: K | null; dir: SortDir };
export type SearchParams = Record<string, string | string[] | undefined>;

export const MAX_SEARCH = 100;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

// The search as it is used: trimmed, cut at MAX_SEARCH characters; blank means no search.
export function cleanSearch(q: string): string {
  return q.trim().slice(0, MAX_SEARCH).trim();
}

// Anything unknown or malformed is ignored, so a tampered address shows the default list rather than an error.
export function readListView<K extends string>(params: SearchParams, sortKeys: readonly K[]): ListView<K> {
  const sortParam = first(params.sort);
  const sort = (sortKeys as readonly string[]).includes(sortParam) ? (sortParam as K) : null;
  return { q: cleanSearch(first(params.q)), sort, dir: sort && first(params.dir) === "desc" ? "desc" : "asc" };
}

// The list's address with some parameters changed and every other one kept (Deals adds `stage` and `open`).
// null or "" removes a parameter.
export function listHref(path: string, params: SearchParams, changes: Record<string, string | null>): string {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key in changes || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) out.append(key, v);
  }
  for (const [key, value] of Object.entries(changes)) if (value) out.set(key, value);
  const query = out.toString();
  return query ? `${path}?${query}` : path;
}

// The changes that sort by a column; `dir` is left out for A to Z because a missing `dir` means asc.
export function sortChanges(sort: string | null, dir: SortDir): Record<string, string | null> {
  return { sort, dir: sort && dir === "desc" ? "desc" : null };
}

// A heading's click: A to Z first, then Z to A if that column is already sorted A to Z.
export function nextDir(view: ListView, key: string): SortDir {
  return view.sort === key && view.dir === "asc" ? "desc" : "asc";
}

// A search as an ILIKE pattern that matches it anywhere. `%`, `_` and `\` are escaped (backslash is ILIKE's default
// escape) so they match themselves rather than everything.
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, "\\$&")}%`;
}
