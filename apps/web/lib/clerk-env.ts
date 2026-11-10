const missingKeyMessage =
  '缺少 Clerk 密钥。请在 apps/web/.env.local 写入 NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY 和 CLERK_SECRET_KEY，可参考 apps/web/.env.example，然后重新运行 pnpm dev。';

export function assertClerkWebKeys(): void {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    throw new Error(missingKeyMessage);
  }
}
