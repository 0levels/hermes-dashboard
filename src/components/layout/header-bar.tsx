'use client';

import { Activity, Search, Sun, Moon, Radio, PenLine, Mail, Users, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '@/store';
import { useSmartPoll } from '@/hooks/use-smart-poll';

interface HeaderStats {
  posts_today: number;
  emails_sent: number;
  pipeline_count: number;
}

export function HeaderBar() {
  const { feedOpen, toggleFeed } = useDashboard();

  // Lightweight poll for header stats
  const { data: stats } = useSmartPoll<HeaderStats>(
    () => fetch('/api/overview').then(r => r.json()).then(d => d.stats),
    { interval: 60_000 },
  );

  return (
    <header className="fixed top-0 left-0 right-0 h-[var(--header-height)] glass-strong flex items-center justify-between px-4 sm:px-6 z-50">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <span className="text-primary font-bold text-sm">H</span>
        </div>
        <span className="font-semibold text-sm tracking-tight">Hermes</span>

        {/* Quick stats — hidden on small screens */}
        {stats && (
          <div className="hidden md:flex items-center gap-3 ml-3 pl-3 border-l border-border/30">
            <QuickStat icon={PenLine} value={stats.posts_today} label="posts" />
            <QuickStat icon={Mail} value={stats.emails_sent} label="sent" />
            <QuickStat icon={Users} value={stats.pipeline_count} label="pipeline" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <SearchTrigger />
        <ThemeToggle />
        <FeedToggle open={feedOpen} onToggle={toggleFeed} />
        <SyncStatus />
        <LogoutButton />
      </div>
    </header>
  );
}

function QuickStat({ icon: Icon, value, label }: { icon: typeof PenLine; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon size={12} />
      <span className="font-mono font-medium text-foreground">{value}</span>
      <span>{label}</span>
    </div>
  );
}

function SearchTrigger() {
  return (
    <button
      className="flex items-center gap-2 bg-muted/50 hover:bg-muted border border-border/30 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors"
      onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
    >
      <Search size={13} />
      <span className="hidden sm:inline">Search</span>
      <kbd className="hidden sm:inline text-[10px] bg-muted px-1 py-0.5 rounded ml-1">⌘K</kbd>
    </button>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-8 h-8" />;

  return (
    <button
      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function FeedToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
        open
          ? 'bg-primary/15 text-primary'
          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
      }`}
      onClick={onToggle}
      title="Toggle live feed"
    >
      <Radio size={16} />
    </button>
  );
}

function SyncStatus() {
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <div className="w-2 h-2 rounded-full bg-success pulse-dot" />
      <Activity size={14} />
      <span className="hidden sm:inline font-mono">{lastSync}</span>
    </div>
  );
}

function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
      onClick={handleLogout}
      disabled={loading}
      title="Sign out"
    >
      <LogOut size={15} />
    </button>
  );
}
