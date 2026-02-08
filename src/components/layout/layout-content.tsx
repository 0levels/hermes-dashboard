'use client';

import { usePathname } from 'next/navigation';
import { NavRail } from './nav-rail';
import { HeaderBar } from './header-bar';
import { MobileNav } from './mobile-nav';
import { AppShell } from './app-shell';
import { CommandPalette } from '../command-palette';

const AUTH_PATHS = ['/login'];

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) {
    return <>{children}</>;
  }

  return (
    <>
      <HeaderBar />
      <div className="flex min-h-[calc(100vh-var(--header-height))]">
        <NavRail />
        <AppShell>{children}</AppShell>
      </div>
      <MobileNav />
      <CommandPalette />
    </>
  );
}
