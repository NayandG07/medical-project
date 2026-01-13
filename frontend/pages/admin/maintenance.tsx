/**
 * Admin Maintenance Control Page
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase, AuthUser } from '@/lib/supabase';
import AdminLayout from '../../components/AdminLayout';
import MaintenanceControl from '../../components/MaintenanceControl';

export default function MaintenancePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }
      setUser(session.user as AuthUser);
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  if (loading || !user) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  return (
    <AdminLayout user={user}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Maintenance Control</h1>
        <MaintenanceControl />
      </div>
    </AdminLayout>
  );
}
