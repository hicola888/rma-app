import type { ResolvedMembership, TenantTransaction } from '@rma/db';

export type RequestWithAuth = {
  headers: { authorization?: string };
  auth?: ResolvedMembership;
  db?: TenantTransaction;
};
