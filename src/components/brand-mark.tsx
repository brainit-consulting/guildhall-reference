import { BRAND_LOGO, BUSINESS_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

// The business's logo and name, from src/lib/brand.ts. A plain <img>: the logo is an SVG, sharp at any scale, so the
// image optimiser has nothing to do.
export function BrandLogo({ size, alt, className }: { size: number; alt: string; className?: string }) {
  if (BRAND_LOGO === null) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={BRAND_LOGO} alt={alt} width={size} height={size} className={cn("shrink-0", className)} />;
}

// For the menu: the logo with the name beside it. The image carries the name for screen readers, so the visible name is
// hidden from them; with no logo, the name alone is read.
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-3", className)}>
      <BrandLogo size={40} alt={BUSINESS_NAME} />
      <span
        aria-hidden={BRAND_LOGO === null ? undefined : true}
        className="min-w-0 truncate font-display text-xl leading-tight text-ink md:whitespace-normal md:break-words"
      >
        {BUSINESS_NAME}
      </span>
    </span>
  );
}
