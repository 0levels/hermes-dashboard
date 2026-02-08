import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { NavRail } from "@/components/layout/nav-rail";
import { HeaderBar } from "@/components/layout/header-bar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AppShell } from "@/components/layout/app-shell";
import { CommandPalette } from "@/components/command-palette";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hermes Dashboard",
  description: "Builderz Marketing Engine Control Center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrains.variable} antialiased`}>
        <ThemeProvider>
          <HeaderBar />
          <div className="flex min-h-[calc(100vh-var(--header-height))]">
            <NavRail />
            <AppShell>{children}</AppShell>
          </div>
          <MobileNav />
          <CommandPalette />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
