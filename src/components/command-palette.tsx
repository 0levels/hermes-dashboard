'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, User, PenLine, Radio, FlaskConical, List,
  Gauge, MessageCircle, Mail, BarChart3, ArrowRight,
} from 'lucide-react';

interface SearchResult {
  id: string | number;
  title: string;
  subtitle: string;
  category: 'lead' | 'content' | 'signal' | 'experiment' | 'activity';
  status?: string;
  tier?: string;
}

const NAV_ITEMS = [
  { label: 'Overview', path: '/', icon: Gauge },
  { label: 'Content', path: '/content', icon: PenLine },
  { label: 'Engagement', path: '/engagement', icon: MessageCircle },
  { label: 'Outreach', path: '/outreach', icon: Mail },
  { label: 'Experiments', path: '/experiments', icon: FlaskConical },
  { label: 'Research', path: '/research', icon: Search },
  { label: 'KPIs', path: '/kpis', icon: BarChart3 },
  { label: 'Activity', path: '/activity', icon: List },
];

const CATEGORY_ICONS: Record<string, typeof User> = {
  lead: User,
  content: PenLine,
  signal: Radio,
  experiment: FlaskConical,
  activity: List,
};

const CATEGORY_ROUTES: Record<string, string> = {
  lead: '/outreach',
  content: '/content',
  signal: '/research',
  experiment: '/experiments',
  activity: '/activity',
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Cmd+K / Ctrl+K to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Search debounce
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(data => {
          setResults(data.results || []);
          setActiveIndex(0);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Filter nav items based on query
  const filteredNav = query.length > 0
    ? NAV_ITEMS.filter(n => n.label.toLowerCase().includes(query.toLowerCase()))
    : NAV_ITEMS;

  // Combined items: nav items first, then search results
  const allItems = [
    ...filteredNav.map(n => ({ type: 'nav' as const, ...n })),
    ...results.map(r => ({ type: 'result' as const, ...r })),
  ];

  const navigate = useCallback((index: number) => {
    const item = allItems[index];
    if (!item) return;
    if (item.type === 'nav') {
      router.push(item.path);
    } else {
      router.push(CATEGORY_ROUTES[item.category] || '/');
    }
    setOpen(false);
  }, [allItems, router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      navigate(activeIndex);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg z-50 animate-in">
        <div className="glass-strong rounded-xl border border-border/50 shadow-2xl overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
            <Search size={18} className="text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search leads, content, signals... or navigate"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[50vh] overflow-y-auto">
            {/* Navigation section */}
            {filteredNav.length > 0 && (
              <div className="px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-1 mb-1">
                  Pages
                </div>
                {filteredNav.map((nav, i) => {
                  const Icon = nav.icon;
                  const idx = i; // index in allItems
                  return (
                    <button
                      key={nav.path}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeIndex === idx
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground/80 hover:bg-muted/50'
                      }`}
                      onClick={() => navigate(idx)}
                      onMouseEnter={() => setActiveIndex(idx)}
                    >
                      <Icon size={15} />
                      <span>{nav.label}</span>
                      <ArrowRight size={12} className="ml-auto opacity-40" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Search results section */}
            {results.length > 0 && (
              <div className="px-3 py-2 border-t border-border/20">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-1 mb-1">
                  Results
                </div>
                {results.map((result, i) => {
                  const Icon = CATEGORY_ICONS[result.category] || List;
                  const idx = filteredNav.length + i;
                  return (
                    <button
                      key={`${result.category}-${result.id}`}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeIndex === idx
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground/80 hover:bg-muted/50'
                      }`}
                      onClick={() => navigate(idx)}
                      onMouseEnter={() => setActiveIndex(idx)}
                    >
                      <Icon size={15} className="shrink-0" />
                      <div className="flex-1 min-w-0 text-left">
                        <div className="truncate">{result.title}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {result.subtitle}
                          {result.status && (
                            <span className="ml-2 opacity-60">({result.status})</span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground uppercase shrink-0">
                        {result.category}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Loading */}
            {loading && query.length >= 2 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            )}

            {/* Empty state */}
            {!loading && query.length >= 2 && results.length === 0 && filteredNav.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No results for &ldquo;{query}&rdquo;
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-border/20 text-[10px] text-muted-foreground">
            <span><kbd className="bg-muted px-1 py-0.5 rounded">↑↓</kbd> navigate</span>
            <span><kbd className="bg-muted px-1 py-0.5 rounded">↵</kbd> select</span>
            <span><kbd className="bg-muted px-1 py-0.5 rounded">esc</kbd> close</span>
          </div>
        </div>
      </div>
    </>
  );
}
