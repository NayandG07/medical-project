import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase, AuthUser } from '@/lib/supabase'
import AdminLayout from '@/components/AdminLayout'

/**
 * Admin Dashboard - Main admin panel page
 * Requirements: 2.7, 13.7
 */
export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // Check authentication and admin status
    const checkAdminAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        // Not authenticated, redirect to login
        router.push('/')
        return
      }

      setUser(session.user as AuthUser)

      // Check if user is admin by calling backend
      // For now, we'll use a simple check - in production, verify with backend
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

      try {
        // Try to access admin endpoint to verify admin status
        const response = await fetch(`${API_URL}/api/admin/users?limit=1`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })

        if (response.ok) {
          setIsAdmin(true)
          setLoading(false)
        } else if (response.status === 403) {
          // Not an admin, redirect to chat
          router.push('/chat')
        } else {
          throw new Error('Failed to verify admin status')
        }
      } catch (err) {
        console.error('Admin verification failed:', err)
        router.push('/chat')
      }
    }

    checkAdminAccess()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  if (!user || !isAdmin) {
    return null // Will redirect
  }

  return (
    <>
      <Head>
        <title>Admin Dashboard - Medical AI Platform</title>
        <meta name="description" content="Admin panel for Medical AI Platform" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <AdminLayout user={user}>
        <div style={{ padding: '30px' }}>
          <h1 style={{ marginBottom: '20px' }}>Admin Dashboard</h1>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
            marginTop: '30px'
          }}>
            {/* Dashboard Cards */}
            <div style={{
              padding: '20px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #dee2e6'
            }}>
              <h3 style={{ marginTop: 0 }}>User Management</h3>
              <p style={{ color: '#6c757d' }}>Manage user accounts, plans, and permissions</p>
              <button
                onClick={() => router.push('/admin/users')}
                style={{
                  marginTop: '15px',
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Manage Users
              </button>
            </div>

            <div style={{
              padding: '20px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #dee2e6'
            }}>
              <h3 style={{ marginTop: 0 }}>Audit Logs</h3>
              <p style={{ color: '#6c757d' }}>View admin actions and system events</p>
              <button
                onClick={() => router.push('/admin/audit-logs')}
                style={{
                  marginTop: '15px',
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                View Logs
              </button>
            </div>

            <div style={{
              padding: '20px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #dee2e6'
            }}>
              <h3 style={{ marginTop: 0 }}>System Status</h3>
              <p style={{ color: '#6c757d' }}>Monitor system health and performance</p>
              <button
                disabled
                style={{
                  marginTop: '15px',
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'not-allowed',
                  opacity: 0.6
                }}
              >
                Coming Soon
              </button>
            </div>

            <div style={{
              padding: '20px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #dee2e6'
            }}>
              <h3 style={{ marginTop: 0 }}>General Settings</h3>
              <p style={{ color: '#6c757d' }}>Configure platform name and global settings</p>
              <button
                onClick={() => router.push('/admin/settings')}
                style={{
                  marginTop: '15px',
                  padding: '8px 16px',
                  backgroundColor: '#1e293b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Configure
              </button>
            </div>
          </div>
        </div>
      </AdminLayout>
    </>
  )
}
