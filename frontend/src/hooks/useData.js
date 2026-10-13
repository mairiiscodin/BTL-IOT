import { useEffect, useState } from 'react';
import { request } from '../api/client';
export function useData(path, revision = 0) {
  const [result, setResult] = useState(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError('');
    request(path, { signal: abort.signal })
      .then(setResult)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [path, revision]);
  return { result, error, loading };
}
