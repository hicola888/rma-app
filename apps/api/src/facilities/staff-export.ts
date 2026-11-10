import type { ExportModule } from '../import-export/types.js';
import { matchesQuery } from './warehouse-import.js';

const roleLabels: Record<string, string> = {
  tenant_admin: '租户管理员',
  tenant_staff: '仓库员工',
  merchant_user: '商家用户',
};

export const staffExport: ExportModule = {
  filename: 'staff',
  columns: [
    { field: 'name', header: '姓名', example: '张三' },
    { field: 'email', header: '邮箱', example: 'zhangsan@example.com' },
    { field: 'role', header: '角色', example: '仓库员工' },
  ],
  async list(db, query) {
    const rows = await db.membership.findMany({
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { name: true, email: true, clerkUserId: true } } },
    });
    return rows
      .map((row) => ({
        name: row.user.name ?? row.user.clerkUserId,
        email: row.user.email ?? '',
        role: roleLabels[row.role] ?? row.role,
      }))
      .filter((row) => matchesQuery(query, Object.values(row)));
  },
};
