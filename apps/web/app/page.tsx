import { HEALTH_PATH } from '@rma/shared';
import { ApiStatus } from '@/components/api-status';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const links = [
  {
    title: 'Web 控制台',
    body: '当前页面。后续会在这里放退货单、入库质检和租户设置。',
    href: '/',
  },
  {
    title: 'API 文档',
    body: 'Swagger UI，列出已注册的接口。',
    href: `${apiBase}/docs`,
  },
  {
    title: '健康检查',
    body: '确认 API 进程已启动。',
    href: `${apiBase}${HEALTH_PATH}`,
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-16">
      <header className="max-w-2xl">
        <p className="text-sm font-semibold tracking-[0.14em] text-[#0f6e6b]">3PL · RMA</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">退货管理平台</h1>
        <p className="mt-4 text-lg leading-relaxed text-[#3d4d5c]">
          面向第三方物流的多租户退货系统骨架。Web、API
          和数据库已经可以在本地一起跑起来，具体业务会在下一步再加。
        </p>
      </header>

      <section className="mt-10">
        <ApiStatus apiBase={apiBase} healthPath={HEALTH_PATH} />
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {links.map((link) => (
          <a
            key={link.title}
            href={link.href}
            className="rounded-2xl border border-[#d5dee6] bg-white p-5 shadow-sm transition hover:border-[#0f6e6b]"
          >
            <h2 className="text-base font-semibold">{link.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#3d4d5c]">{link.body}</p>
          </a>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-dashed border-[#c5d0d8] bg-white/70 p-5 text-sm leading-6 text-[#3d4d5c]">
        <p>
          本地依赖：PostgreSQL（Organization 占位表）和 Redis。Redis 已在 Docker Compose
          中启动，业务代码尚未调用它。
        </p>
      </section>
    </main>
  );
}
