import { Suspense } from 'react';
import { MeDetails } from './me-details';

export default function MePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-6 py-16">
      <h1 className="text-2xl font-semibold">我的登录信息</h1>
      <p className="mt-3 text-sm leading-6 text-[#3d4d5c]">
        第一次登录后，用这里的两个 ID 把你的账号写进租户。不用自己往数据库里插记录。
      </p>
      <div className="mt-8">
        <Suspense fallback={<p>正在读取登录信息…</p>}>
          <MeDetails />
        </Suspense>
      </div>
    </main>
  );
}
