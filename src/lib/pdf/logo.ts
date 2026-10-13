// The logo for invoice PDFs, from BRAND_LOGO. react-pdf draws PNG and JPEG files as they are but can't load an SVG
// file, so a simple SVG is read into react-pdf's own shapes. Anything it can't draw faithfully gives null: no logo
// beats a wrong one.
import { readFileSync } from "node:fs";
import { extname, join } from "node:path";

export type SvgShape = { tag: (typeof SHAPES)[number]; attrs: Record<string, string> };
export type Logo =
  | { kind: "image"; data: Buffer; format: "png" | "jpg" }
  | { kind: "svg"; viewBox: string; aspect: number; shapes: SvgShape[] };

const SHAPES = ["rect", "circle", "ellipse", "line", "polygon", "polyline", "path"] as const;
// Geometry and paint; others (class, id, aria-*) don't change the drawing. style, transform and url(#...) paints do,
// and aren't drawn, so they refuse the logo.
const KEPT = new Set(["x", "y", "width", "height", "rx", "ry", "cx", "cy", "r", "x1", "y1", "x2", "y2", "points", "d",
  "fill", "stroke", "stroke-width", "opacity", "fill-opacity", "stroke-opacity", "fill-rule"]);
const PAINT = new Set(["fill", "stroke", "stroke-width", "opacity", "fill-opacity", "stroke-opacity", "fill-rule"]);

function attributes(text: string): Record<string, string> | null {
  const found: Record<string, string> = {};
  for (const m of text.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    const [name, value] = [m[1], m[2] ?? m[3]];
    if (name === "style" || name === "transform" || value.includes("url(")) return null;
    found[name] = value;
  }
  return found;
}

// The SVG's viewBox and its shapes, with paint set on a <g> passed down to the shapes inside it.
export function parseSvgLogo(svg: string): Extract<Logo, { kind: "svg" }> | null {
  const body = svg
    .replace(/<\?xml[\s\S]*?\?>|<!DOCTYPE[\s\S]*?>|<!--[\s\S]*?-->/gi, "")
    .replace(/<(title|desc)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  const groups: Record<string, string>[] = [];
  const shapes: SvgShape[] = [];
  let viewBox: string | null = null;
  for (const m of body.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g)) {
    const [, closing, tag, rest, selfClosing] = m;
    if (closing) {
      if (tag === "g") groups.pop();
      continue;
    }
    const attrs = attributes(rest);
    if (!attrs) return null;
    if (tag === "svg") {
      viewBox = attrs.viewBox ?? (attrs.width && attrs.height ? `0 0 ${parseFloat(attrs.width)} ${parseFloat(attrs.height)}` : null);
    } else if (tag === "g") {
      const paint = Object.fromEntries(Object.entries(attrs).filter(([k]) => PAINT.has(k)));
      if (!selfClosing) groups.push({ ...groups.at(-1), ...paint });
    } else if ((SHAPES as readonly string[]).includes(tag)) {
      const own = Object.fromEntries(Object.entries(attrs).filter(([k]) => KEPT.has(k)));
      shapes.push({ tag: tag as SvgShape["tag"], attrs: { ...groups.at(-1), ...own } });
    } else {
      return null; // text, image, gradients, use, ...
    }
  }
  const box = viewBox?.trim().split(/[\s,]+/).map(Number);
  if (!box || box.length !== 4 || box.some((n) => !Number.isFinite(n)) || box[2] <= 0 || box[3] <= 0 || shapes.length === 0) {
    return null;
  }
  return { kind: "svg", viewBox: box.join(" "), aspect: box[2] / box[3], shapes };
}

// `logo` is BRAND_LOGO: a path under public/, or null for no logo. A missing file or an unknown kind is no logo.
export function readLogo(logo: string | null, root = process.cwd()): Logo | null {
  if (!logo) return null;
  let data: Buffer;
  try {
    data = readFileSync(join(root, "public", logo));
  } catch {
    return null;
  }
  const ext = extname(logo).toLowerCase();
  if (ext === ".png") return { kind: "image", data, format: "png" };
  if (ext === ".jpg" || ext === ".jpeg") return { kind: "image", data, format: "jpg" };
  if (ext === ".svg") return parseSvgLogo(data.toString("utf8"));
  return null;
}
