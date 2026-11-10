import { SignIn } from '@clerk/nextjs';
import { Suspense } from 'react';

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <Suspense fallback={<p>正在打开登录页…</p>}>
        <SignIn />
      </Suspense>
    </main>
  );
}
