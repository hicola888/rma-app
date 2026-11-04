# RMA 退货管理平台

多租户 3PL（第三方物流）退货管理 SaaS 的工程骨架。这个仓库目前能在本地把 Web、API 和 PostgreSQL 跑起来，退货单、质检、租户权限等业务会在后续变更里再加。

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

1. `Copy-Item` 生成根目录 `.env`。里面是本机 Docker 的默认账号，不是生产密钥。如果 `.env` 已经存在，不必再复制。各应用目录下也有 `.env.example`，只有在需要覆盖根目录配置时才复制成该目录的 `.env`。
2. `pnpm install` 会安装依赖，并生成 Prisma Client。
3. `docker compose up -d` 启动 PostgreSQL（端口 5432）和 Redis（端口 6379）。请先打开 Docker Desktop，等引擎就绪后再执行。
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

这些脚本可以在 PowerShell 里直接运行，不依赖 Bash。

## 当前范围

这一步包含可运行的工程骨架：首页、PWA manifest、健康检查、Swagger、Organization 占位模型和第一条迁移。登录、租户隔离、退货单和完整数据库设计留到下一步，所以 Prisma schema 保持最小。
