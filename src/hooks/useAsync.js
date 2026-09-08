import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs a service call and tracks loading / error / data.
 *
 * Gives every screen the same three states without repeating the
 * plumbing, and exposes `retry` so error states can recover.
 *
 *   const { data, loading, error, retry } = useAsync(
 *     () => studentService.getStudents(filters), [filters]
 *   );
 */
export function useAsync(fn, deps = [], options = {}) {
  const { immediate = true, initialData = null } = options;
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const fnRef = useRef(fn);
  fnRef.current = fn;

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const [nonce, setNonce] = useState(0);
  const run = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!immediate && nonce === 0) return undefined;

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.resolve()
      .then(() => fnRef.current())
      .then((result) => {
        if (!cancelled && mounted.current) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled && mounted.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, immediate]);

  return { data, loading, error, retry: run, refresh: run, setData };
}

/**
 * Wraps a mutating service call with its own pending flag, so
 * buttons can show a spinner and stay disabled while it runs.
 */
export function useAction(handler, { onSuccess, onError } = {}) {
  const [pending, setPending] = useState(false);

  const execute = useCallback(
    async (...args) => {
      setPending(true);
      try {
        const result = await handler(...args);
        onSuccess?.(result, ...args);
        return result;
      } catch (err) {
        onError?.(err);
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [handler, onSuccess, onError],
  );

  return [execute, pending];
}

export default useAsync;
