import type { Metadata } from "next";
import { IBM_Plex_Sans, Young_Serif } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { BUSINESS_NAME } from "@/lib/brand";

const youngSerif = Young_Serif({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-young-serif",
});

const plex = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plex",
});

// Pages give only their own part of the title. The template skips src/app/page.tsx (same segment), so the welcome
// tab shows the default, the bare name.
export const metadata: Metadata = {
  title: { default: BUSINESS_NAME, template: `%s · ${BUSINESS_NAME}` },
  description: `Customers, deals and tasks for ${BUSINESS_NAME}.`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${youngSerif.variable} ${plex.variable}`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
