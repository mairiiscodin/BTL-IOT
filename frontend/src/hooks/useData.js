import { useEffect, useState } from 'react';
import { request } from '../api/client';

/**
 * Hook tải dữ liệu GET từ API.
 * Tự tải lại khi `path` đổi (vd. đổi bộ lọc/trang) hoặc khi `revision` tăng (có sự kiện realtime).
 *
 * Ví dụ: const { result, error, loading } = useData('/devices');
 */
export function useData(path, revision = 0) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // AbortController: huỷ request cũ nếu path đổi trước khi request trả về,
    // tránh dữ liệu cũ ghi đè dữ liệu mới.
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

    return () => abort.abort(); // cleanup: chạy khi path/revision đổi hoặc component unmount
  }, [path, revision]);

  return { result, error, loading };
}
