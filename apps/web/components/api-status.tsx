'use client';

import { useEffect, useState } from 'react';

type Status = 'loading' | 'ok' | 'down';

const labels: Record<Status, string> = {
  loading: '正在检查 API…',
  ok: 'API 已连通',
  down: 'API 未连通',
};

export function ApiStatus({ apiBase, healthPath }: { apiBase: string; healthPath: string }) {
  const [status, setStatus] = useState<Status>('loading');
  const healthUrl = `${apiBase}${healthPath}`;

  useEffect(() => {
    const controller = new AbortController();

    fetch(healthUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        setStatus('ok');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setStatus('down');
      });

    return () => controller.abort();
  }, [healthUrl]);

  const tone =
    status === 'ok'
      ? 'border-[#b7ddd4] bg-[#f3faf7] text-[#0f6e6b]'
      : status === 'down'
        ? 'border-[#f0d0c8] bg-[#fff6f3] text-[#9a3b2f]'
        : 'border-[#d5dee6] bg-white text-[#3d4d5c]';

  return (
    <div className={`inline-flex items-center gap-3 rounded-full border px-4 py-2 text-sm ${tone}`}>
      <span className="font-medium">{labels[status]}</span>
      <a className="underline decoration-current/40 underline-offset-2" href={healthUrl}>
        {healthUrl}
      </a>
    </div>
  );
}
