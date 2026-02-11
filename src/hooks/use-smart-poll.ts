'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface UseSmartPollOptions {
  /** Polling interval in ms (default 30000) */
  interval?: number;
  /** Whether polling is enabled (default true) */
  enabled?: boolean;
  /** Fetch immediately on mount (default true) */
  immediate?: boolean;
  /** When this value changes, immediately re-fetch (e.g. pass realOnly toggle) */
  key?: unknown;
}

/**
 * Visibility-aware polling hook. Pauses when the tab is hidden,
 * resumes and immediately refetches when the tab becomes visible again.
 *
 * Returns { data, loading, error, refetch }.
 */
export function useSmartPoll<T>(
  fetcher: () => Promise<T>,
  options: UseSmartPollOptions = {},
) {
  const { interval = 30_000, enabled = true, immediate = true, key } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);
  const prevKeyRef = useRef(key);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const doFetch = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      if (mountedRef.current) {
        setData(result);
        setError(null);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    }
  }, []);

  const startPolling = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(doFetch, interval);
  }, [doFetch, interval]);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Visibility change — pause when hidden, resume + refetch when visible
  useEffect(() => {
    if (!enabled) return;

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        doFetch(); // immediate refetch on return
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [enabled, doFetch, startPolling, stopPolling]);

  // Main lifecycle
  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      stopPolling();
      return;
    }

    if (immediate) doFetch();
    startPolling();

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [enabled, immediate, doFetch, startPolling, stopPolling]);

  // Re-fetch immediately when key changes (e.g. realOnly toggle)
  useEffect(() => {
    if (prevKeyRef.current !== key) {
      prevKeyRef.current = key;
      doFetch();
    }
  }, [key, doFetch]);

  return { data, loading, error, refetch: doFetch };
}
