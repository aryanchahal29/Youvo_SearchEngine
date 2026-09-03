import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "YouVo — Find the Best AI Tool for What You Need",
    template: "%s | YouVo",
  },
  description:
    "YouVo is an AI-powered tool recommendation engine. Tell us what you want to accomplish — we find the best tools for your specific situation, backed by evidence.",
  keywords: [
    "AI tools", "best AI tool", "AI tool finder", "AI tool comparison",
    "free AI tools", "AI video generator", "vibe coding", "AI avatar",
    "AI image generator", "AI research tool", "AI trading tool",
  ],
  openGraph: {
    title: "YouVo — Find the Best AI Tool for What You Need",
    description:
      "Tell us what you want to accomplish. We find the best tools for your specific situation.",
    type: "website",
    siteName: "YouVo",
  },
  twitter: {
    card: "summary_large_image",
    title: "YouVo — AI Tool Intelligence Engine",
    description: "Evidence-based AI tool recommendations.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} dark antialiased`}>
      <body className="min-h-screen bg-background text-foreground font-sans">
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
