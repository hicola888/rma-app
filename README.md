# RMA 退货管理平台

多租户 3PL（第三方物流）退货管理 SaaS 的工程骨架。这个仓库目前能在本地把 Web、API 和 PostgreSQL 跑起来，退货单、质检、租户权限等业务会在后续变更里再加。

功能清单和数据库设计见 [docs/design.md](docs/design.md)。
订单补件和配件入库见 [docs/parts-replenishment.md](docs/parts-replenishment.md)。
给写代码的 AI 看的项目约定见 [CLAUDE.md](CLAUDE.md)。

## 技术栈

- pnpm workspaces + Turborepo
- `apps/web`：Next.js（App Router）+ TypeScript + Tailwind CSS，带 PWA manifest
- `apps/api`：NestJS REST，Swagger 在 `/docs`，健康检查为 `GET /health`
- `packages/db`：PostgreSQL + Prisma，占位模型 `Organization`，并带第一条迁移
- `packages/shared`：Web 和 API 共用的类型
- Docker Compose：本地 PostgreSQL 与 Redis

Redis 会随 Compose 启动，当前业务代码还没有调用它。

## 目录

```text
apps/web          Next.js 前端
apps/api          NestJS API
packages/db       Prisma schema、迁移和客户端
packages/shared   共享类型
docker-compose.yml
```

## 环境要求

在 Windows 11 上开发，需要：

- Node.js 22
- pnpm 10（可用 Node 自带的 Corepack 启用）
- Docker Desktop（已启动）
- Git
- PowerShell

## 启用 pnpm

在 PowerShell 中执行：

```powershell
corepack enable
corepack prepare pnpm@10.33.4 --activate
node -v
pnpm -v
```

`node -v` 应显示 v22。`pnpm -v` 应显示 10.x。

## 本地启动

在仓库根目录打开 PowerShell，一行一条执行：

```powershell
Copy-Item .env.example .env
pnpm install
docker compose up -d
pnpm db:migrate
pnpm dev
```

说明：

1. `Copy-Item` 生成根目录 `.env`。里面是本机 Docker 的默认账号，不是生产密钥。如果 `.env` 已经存在，把 `DATABASE_URL` 的端口改成 `15432`。各应用目录下也有 `.env.example`，只有在需要覆盖根目录配置时才复制成该目录的 `.env`。
2. `pnpm install` 会安装依赖，并生成 Prisma Client。
3. `docker compose up -d` 启动 PostgreSQL（宿主机端口 15432，容器内 5432）和 Redis（宿主机端口 6379）。请先打开 Docker Desktop，等引擎就绪后再执行。
4. `pnpm db:migrate` 把已有迁移应用到本地数据库。数据库刚启动时如果连接失败，先看 `docker compose ps`，等到 postgres 为 healthy 后再执行一次。
5. `pnpm dev` 会先编译 `packages/db` 和 `packages/shared`，然后同时启动 Web 和 API。

只想应用已有迁移、不进入 Prisma 的开发交互时，用：

```powershell
pnpm db:migrate:deploy
```

## 验证

保持 `pnpm dev` 运行，在浏览器打开：

- Web：http://localhost:3000
- 健康检查：http://localhost:3001/health
- API 文档：http://localhost:3001/docs

也可以在另一个 PowerShell 窗口执行：

```powershell
Invoke-RestMethod http://localhost:3001/health
```

返回的 `status` 应为 `ok`。首页上的状态会在 API 连通后显示「API 已连通」。

改了 `API_PORT` 时，把 `.env` 里的 `NEXT_PUBLIC_API_URL` 改成同一个地址，然后重新运行 `pnpm dev`。Web 固定使用 3000 端口，避免和 API 抢 `PORT`。

## Windows 保留端口

Windows 的 Hyper-V / WinNAT 会保留一段 TCP 端口。在这台开发机上，保留范围是 5371–5470，里面包含 PostgreSQL 常用的 5432 和 5433。此时 `docker compose up -d` 会失败，提示 `bind: An attempt was made to access a socket in a way forbidden by its access permissions`。5432 上可以没有任何程序在监听，系统仍会拒绝绑定这段保留端口。

本仓库把 PostgreSQL 的宿主机端口设成 15432，容器内仍是 5432。Redis 的宿主机端口保持 6379。

查看本机保留范围：

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```

如果 15432 也落在保留范围内，把 `docker-compose.yml` 里 PostgreSQL 的宿主机端口和 `.env` 里两个连接串的端口改成同一个未被保留的端口。

## 配置 Clerk

登录用 Clerk。密钥只放在本机，不要写进 Git。

1. 在 [Clerk](https://dashboard.clerk.com) 创建一个应用，并打开 Organizations（一个 Organization 对应一个 3PL 租户）。
2. 复制 Publishable key 和 Secret key。
3. 新建 `apps/web/.env.local`，写入：

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_这里换成你的值
CLERK_SECRET_KEY=sk_test_这里换成你的值
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

4. 新建 `apps/api/.env`，写入同一把 Secret key，以及应用数据库账号：

```text
CLERK_SECRET_KEY=sk_test_这里换成你的值
DATABASE_URL=postgresql://rma_app:rma_app@localhost:15432/rma?schema=public
DIRECT_URL=postgresql://rma:rma@localhost:15432/rma?schema=public
```

缺密钥时，Web 或 API 启动会直接报「缺少 Clerk 密钥」，并告诉你该写到哪个文件。

数据库迁移仍用超级用户 `rma`（`DIRECT_URL`）。日常请求用 `rma_app`，这样 Postgres 的行级权限才会生效。`pnpm db:migrate` 会创建 `rma_app`。

跑隔离测试（需要本机 Docker 的 Postgres 已在 15432，并且迁移已经执行）：

```powershell
pnpm test
```

测试不使用真实 Clerk 密钥，登录校验是模拟的。

第一次登录后打开 http://localhost:3000/me ，复制 Clerk User ID 和 Organization ID。然后在仓库根目录执行（把两个 ID 换成你复制的值）：

```powershell
pnpm db:bootstrap -- --user-id user_xxx --org-id org_xxx
```

不带参数时会逐项提问。租户名称直接回车，默认是「Epping 仓库」。角色默认是 `tenant_admin`。如果角色选 `merchant_user`，必须再填货主名称。

这个命令用 `DIRECT_URL`（建库账号）写入，不受行级权限挡住。再执行一次不会产生重复数据。

也可以先只看提示：

```powershell
pnpm db:bootstrap -- --help
```

## 停止

在运行 `pnpm dev` 的窗口按 `Ctrl+C`。

停止数据库容器：

```powershell
docker compose down
```

数据卷会保留。连数据一起删掉时再执行 `docker compose down -v`。

## 脚本

| 命令                     | 作用                                 |
| ------------------------ | ------------------------------------ |
| `pnpm dev`               | 启动 Web（3000）和 API（3001）       |
| `pnpm build`             | 编译全部包                           |
| `pnpm lint`              | ESLint 与 Prettier 检查              |
| `pnpm format`            | 按 Prettier 写回格式                 |
| `pnpm db:migrate`        | 本地开发迁移（`prisma migrate dev`） |
| `pnpm db:migrate:deploy` | 只应用已有迁移                       |
| `pnpm db:generate`       | 重新生成 Prisma Client               |
| `pnpm db:migrate:cloud`  | 把已有迁移应用到 Supabase            |
| `pnpm dev:cloud`         | 用 `.env.supabase` 启动 Web 和 API   |
| `pnpm test`              | 跑租户隔离测试（需要本机 Postgres）  |
| `pnpm db:bootstrap`      | 把 Clerk 账号写入第一个租户          |

这些脚本可以在 PowerShell 里直接运行，不依赖 Bash。

## 当前范围

工程骨架之外，已经接上 Clerk 登录和租户隔离。退货单等业务还没做。数据库设计见 `docs/design.md`。

## 连接 Supabase

本地 Docker 继续用根目录 `.env`。云端数据库用根目录 `.env.supabase`，两条命令分开，不用互相覆盖。

在 Supabase 打开项目，进入 **Connect → ORMs → Prisma**，复制两段连接串：

- `DATABASE_URL`：连接池，端口 **6543**，查询参数里保留 `pgbouncer=true`。应用运行时用它。
- `DIRECT_URL`：直连，端口 **5432**，不要加 `pgbouncer=true`。Prisma 迁移用它。

在仓库根目录执行：

```powershell
Copy-Item .env.supabase.example .env.supabase
```

用编辑器打开 `.env.supabase`，把两段占位符换成面板上的连接串。Sydney 区域的主机名里一般带 `ap-southeast-2`。面板上如果还有 `sslmode=require`，保留它。

密码里如果有 `@`、`#`、`%`、`&`、`+`、`/`、`?` 这类字符，放进连接串之前要做 URL 编码，例如 `@` 写成 `%40`。从 Prisma 面板复制的整段字符串通常已经编码过，不要再改密码那一段。

本地 Docker 的两个连接串不一样。应用用 `rma_app`，迁移用 `rma`：

```text
DATABASE_URL=postgresql://rma_app:rma_app@localhost:15432/rma?schema=public
DIRECT_URL=postgresql://rma:rma@localhost:15432/rma?schema=public
```

把迁移应用到 Supabase（使用 `prisma migrate deploy`，不会进入 `migrate dev` 的交互）：

```powershell
pnpm db:migrate:cloud
```

成功后打开 Supabase 的 **Table Editor**，应能看到表 `Organization`。

用云端数据库启动本机 Web 和 API：

```powershell
pnpm dev:cloud
```

仍用本地 Docker 时，继续执行 `pnpm db:migrate` 和 `pnpm dev`。
