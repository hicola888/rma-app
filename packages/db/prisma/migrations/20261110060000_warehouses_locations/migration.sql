-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('receiving', 'inspection', 'quarantine', 'storage', 'floor_stock', 'parts');

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "LocationType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Warehouse_tenantId_idx" ON "Warehouse"("tenantId");
CREATE UNIQUE INDEX "Warehouse_tenantId_code_key" ON "Warehouse"("tenantId", "code");
CREATE INDEX "Location_tenantId_idx" ON "Location"("tenantId");
CREATE UNIQUE INDEX "Location_warehouseId_code_key" ON "Location"("warehouseId", "code");

ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Location" ADD CONSTRAINT "Location_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Warehouse", "Location" TO rma_app;

ALTER TABLE "Warehouse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Warehouse" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Location" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Location" FORCE ROW LEVEL SECURITY;

CREATE POLICY warehouse_isolation ON "Warehouse"
    FOR ALL
    USING ("tenantId" = app_current_setting('app.tenant_id'))
    WITH CHECK ("tenantId" = app_current_setting('app.tenant_id'));

CREATE POLICY location_isolation ON "Location"
    FOR ALL
    USING ("tenantId" = app_current_setting('app.tenant_id'))
    WITH CHECK ("tenantId" = app_current_setting('app.tenant_id'));

-- Tenant staff and admins can read coworker names. merchant_user still only sees themselves.
DROP POLICY user_isolation ON "User";

CREATE POLICY user_select ON "User"
    FOR SELECT
    USING (
        id = app_current_setting('app.user_id')
        OR (
            app_current_setting('app.merchant_id') IS NULL
            AND EXISTS (
                SELECT 1
                FROM "Membership" AS member_row
                WHERE member_row."userId" = "User".id
                  AND member_row."tenantId" = app_current_setting('app.tenant_id')
            )
        )
    );

CREATE POLICY user_write ON "User"
    FOR INSERT
    WITH CHECK (id = app_current_setting('app.user_id'));

CREATE POLICY user_update ON "User"
    FOR UPDATE
    USING (id = app_current_setting('app.user_id'))
    WITH CHECK (id = app_current_setting('app.user_id'));

CREATE POLICY user_delete ON "User"
    FOR DELETE
    USING (id = app_current_setting('app.user_id'));
