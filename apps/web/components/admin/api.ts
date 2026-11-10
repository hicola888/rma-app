'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback, useEffect, useState } from 'react';

export const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type MeInfo = {
  role: string | null;
  tenant: { id: string; name: string } | null;
};

export type Warehouse = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  active: boolean;
};

export type Location = {
  id: string;
  warehouseId: string;
  code: string;
  type: string;
  active: boolean;
};

export type StaffMember = {
  id: string;
  role: string;
  user: { name: string | null; email: string | null; clerkUserId: string };
};

export const locationTypeLabels: Record<string, string> = {
  receiving: '收货区',
  inspection: '待检区',
  quarantine: '隔离区',
  storage: '上架库位',
  floor_stock: 'Floor Stock',
  parts: '配件库位',
};

export const roleLabels: Record<string, string> = {
  tenant_admin: '租户管理员',
  tenant_staff: '仓库员工',
  merchant_user: '商家用户',
};

export function useAdminRequest() {
  const auth = useAuth();
  const { getToken } = auth;

  const request = useCallback(
    async function request<T>(path: string, init?: RequestInit): Promise<T> {
      const token = await getToken();
      if (!token) {
        throw new Error('未登录');
      }
      const response = await fetch(`${apiBase}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(init?.headers ?? {}),
        },
      });
      if (response.status === 403) {
        throw new Error('FORBIDDEN');
      }
      if (!response.ok) {
        const text = await response.text();
        let message = text || '请求失败';
        try {
          const body = JSON.parse(text) as { message?: string | string[] };
          if (Array.isArray(body.message)) {
            message = body.message.join(' ');
          } else if (body.message) {
            message = body.message;
          }
        } catch {
          message = text || '请求失败';
        }
        throw new Error(message);
      }
      if (response.status === 204) {
        return undefined as T;
      }
      return (await response.json()) as T;
    },
    [getToken],
  );

  return { ...auth, request };
}

export type AdminRequest = ReturnType<typeof useAdminRequest>['request'];

export function useAdminLoad(
  load: (request: ReturnType<typeof useAdminRequest>['request']) => Promise<void>,
) {
  const { isLoaded, isSignedIn, request } = useAdminRequest();
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }
    let cancelled = false;

    async function run() {
      try {
        await load(request);
        if (!cancelled) {
          setError('');
        }
      } catch {
        if (!cancelled) {
          setError('API 没有启动或连不上（应该在 http://localhost:3001）');
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, load, request, version]);

  return {
    isLoaded,
    isSignedIn,
    request,
    error,
    setError,
    reload: () => setVersion((current) => current + 1),
  };
}
