import { SignUp } from '@clerk/nextjs';
import { Suspense } from 'react';

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <Suspense fallback={<p>正在打开注册页…</p>}>
        <SignUp />
      </Suspense>
    </main>
  );
}
