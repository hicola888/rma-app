-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('tenant_admin', 'tenant_staff', 'merchant_user');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clerkOrgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "merchantId" TEXT,
    "role" "MembershipRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_clerkOrgId_key" ON "Tenant"("clerkOrgId");

-- CreateIndex
CREATE INDEX "Merchant_tenantId_idx" ON "Merchant"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_tenantId_code_key" ON "Merchant"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

-- CreateIndex
CREATE INDEX "Membership_tenantId_idx" ON "Membership"("tenantId");

-- CreateIndex
CREATE INDEX "Membership_merchantId_idx" ON "Membership"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_tenantId_key" ON "Membership"("userId", "tenantId");

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_merchant_user_requires_merchant" CHECK (
    "role" <> 'merchant_user' OR "merchantId" IS NOT NULL
);

-- Local app role. The Docker superuser (rma) bypasses RLS, so the API must not use it.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rma_app') THEN
        CREATE ROLE rma_app LOGIN PASSWORD 'rma_app' NOSUPERUSER NOBYPASSRLS;
    END IF;
END
$$;

DO $$
BEGIN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO rma_app', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO rma_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rma_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rma_app;

CREATE OR REPLACE FUNCTION app_current_setting(p_name text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting(p_name, true), '');
$$;

CREATE OR REPLACE FUNCTION app_find_membership(p_clerk_user_id text, p_clerk_org_id text)
RETURNS TABLE (
    user_id text,
    tenant_id text,
    merchant_id text,
    role "MembershipRole"
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id, m."tenantId", m."merchantId", m.role
    FROM "User" u
    JOIN "Membership" m ON m."userId" = u.id
    JOIN "Tenant" t ON t.id = m."tenantId"
    WHERE u."clerkUserId" = p_clerk_user_id
      AND t."clerkOrgId" = p_clerk_org_id;
$$;

REVOKE ALL ON FUNCTION app_find_membership(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_find_membership(text, text) TO rma_app;
GRANT EXECUTE ON FUNCTION app_current_setting(text) TO rma_app;

ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Merchant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Merchant" FORCE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Tenant"
    FOR ALL
    USING (id = app_current_setting('app.tenant_id'))
    WITH CHECK (id = app_current_setting('app.tenant_id'));

CREATE POLICY merchant_isolation ON "Merchant"
    FOR ALL
    USING (
        "tenantId" = app_current_setting('app.tenant_id')
        AND (
            app_current_setting('app.merchant_id') IS NULL
            OR id = app_current_setting('app.merchant_id')
        )
    )
    WITH CHECK (
        "tenantId" = app_current_setting('app.tenant_id')
        AND (
            app_current_setting('app.merchant_id') IS NULL
            OR id = app_current_setting('app.merchant_id')
        )
    );

CREATE POLICY user_isolation ON "User"
    FOR ALL
    USING (id = app_current_setting('app.user_id'))
    WITH CHECK (id = app_current_setting('app.user_id'));

CREATE POLICY membership_isolation ON "Membership"
    FOR ALL
    USING (
        "tenantId" = app_current_setting('app.tenant_id')
        AND (
            app_current_setting('app.merchant_id') IS NULL
            OR "merchantId" = app_current_setting('app.merchant_id')
            OR "userId" = app_current_setting('app.user_id')
        )
    )
    WITH CHECK (
        "tenantId" = app_current_setting('app.tenant_id')
        AND (
            app_current_setting('app.merchant_id') IS NULL
            OR "merchantId" = app_current_setting('app.merchant_id')
        )
    );
