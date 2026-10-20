import type { Metadata } from 'next';
import { AdminShell } from '../../components/admin/AdminShell';

export const metadata: Metadata = {
  title: 'Студия · Ульяна Непомилуева',
  robots: { index: false, follow: false, noarchive: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
