'use client';

import { useEffect } from 'react';
import { useDashboard } from '@/store';
import { LiveFeed } from '@/components/live-feed';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { feedOpen, toggleFeed } = useDashboard();

  // Cmd+. to toggle feed
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault();
        toggleFeed();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleFeed]);

  return (
    <>
      <main className={`main-content flex-1 ml-[var(--nav-width)] mt-[var(--header-height)] p-6 overflow-auto transition-[margin] duration-300 ${
        feedOpen ? 'mr-80' : ''
      }`}>
        {children}
      </main>
      <LiveFeed open={feedOpen} onClose={toggleFeed} />
    </>
  );
}
