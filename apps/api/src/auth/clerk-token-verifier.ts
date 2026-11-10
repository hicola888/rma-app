export type VerifiedClerkToken = {
  clerkUserId: string;
  clerkOrgId: string;
};

export interface ClerkTokenVerifier {
  verify(token: string): Promise<VerifiedClerkToken>;
}

export const CLERK_TOKEN_VERIFIER = Symbol('CLERK_TOKEN_VERIFIER');
