import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClient } from 'services/apiClient';
import type { Client } from 'services/generated/generatedClient';

type UseApiOptions = {
  /** Auto-run on mount (default true) */
  immediate?: boolean;
  /** Optional onSuccess side-effect */
  onSuccess?: <T>(data: T) => void;
  /** Optional onError side-effect */
  onError?: (error: unknown) => void;
};

export function useApi<T>(
  operation: (client: Client, signal?: AbortSignal) => Promise<T>,
  deps: any[] = [],
  options: UseApiOptions = {}
) {
  const { immediate = true, onSuccess, onError } = options;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(immediate);
  const [error, setError] = useState<unknown>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    // Abort any in-flight request
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      setIsLoading(true);
      const result = await ApiClient.call((client) => operation(client, controller.signal));
      setData(result);
      setError(null);
      onSuccess?.(result as any);
      return result;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Swallow aborts
        return;
      }
      setError(err);
      onError?.(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!immediate) return;
    run();
    return () => {
      controllerRef.current?.abort();
    };
  }, [run, immediate]);

  return { data, isLoading, error, refetch: run } as const;
}
