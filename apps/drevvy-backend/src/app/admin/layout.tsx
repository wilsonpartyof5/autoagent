import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdmin } from '@/lib/admin/guard';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  return <AdminShell email={admin.email}>{children}</AdminShell>;
}
