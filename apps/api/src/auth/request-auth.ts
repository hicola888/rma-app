import type { ResolvedMembership, TenantTransaction } from '@rma/db';

export type ClerkIdentity = {
  clerkUserId: string;
  clerkOrgId: string;
};

export type RequestWithAuth = {
  headers: { authorization?: string };
  clerk?: ClerkIdentity;
  auth?: ResolvedMembership;
  db?: TenantTransaction;
};
