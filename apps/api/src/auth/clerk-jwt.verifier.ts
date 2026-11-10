import { verifyToken } from '@clerk/backend';
import { ClerkTokenVerifier, VerifiedClerkToken } from './clerk-token-verifier.js';

export class ClerkJwtVerifier implements ClerkTokenVerifier {
  constructor(private readonly secretKey: string) {}

  async verify(token: string): Promise<VerifiedClerkToken> {
    const payload = await verifyToken(token, { secretKey: this.secretKey });
    const clerkUserId = payload.sub;
    const clerkOrgId = readOrgId(payload);
    if (!clerkUserId || !clerkOrgId) {
      throw new Error('Clerk token is missing the user or organization.');
    }

    return { clerkUserId, clerkOrgId };
  }
}

function readOrgId(payload: { org_id?: unknown; o?: unknown }): string | undefined {
  if (typeof payload.org_id === 'string' && payload.org_id.length > 0) {
    return payload.org_id;
  }

  if (payload.o && typeof payload.o === 'object' && 'id' in payload.o) {
    const id = payload.o.id;
    if (typeof id === 'string' && id.length > 0) {
      return id;
    }
  }

  return undefined;
}
