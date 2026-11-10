'use client';

import { SignOutButton, useAuth, useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';

export function SignedInHeader() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  if (!isSignedIn) {
    return null;
  }

  const label = user?.primaryEmailAddress?.emailAddress ?? user?.fullName ?? '已登录';

  return (
    <header className="flex items-center justify-between gap-4 border-b border-[#d5dee6] bg-white px-6 py-3">
      <p className="text-sm text-[#3d4d5c]">
        当前账号 <span className="font-medium text-[#122033]">{label}</span>
      </p>
      <SignOutButton>
        <Button type="button" variant="outline">
          退出登录
        </Button>
      </SignOutButton>
    </header>
  );
}
