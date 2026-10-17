import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdmin } from '@/lib/admin/guard';
import { missingRequiredEnv } from '@/lib/admin/required-env';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  const missingEnv = missingRequiredEnv(process.env);
  return <AdminShell email={admin.email} missingEnv={missingEnv}>{children}</AdminShell>;
}
