/**
 * Admin Provider Health Dashboard Page
 * Requirements: 15.1, 15.2, 15.3, 15.4
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase, AuthUser } from '@/lib/supabase';
import AdminLayout from '../../components/AdminLayout';
import ProviderHealthTable from '../../components/ProviderHealthTable';

export default function ProviderHealthPage() {
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
        <h1 className="text-3xl font-bold mb-6">Provider Health Dashboard</h1>
        <ProviderHealthTable />
      </div>
    </AdminLayout>
  );
}
