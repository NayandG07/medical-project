import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase, AuthUser } from '@/lib/supabase'
import AdminLayout from '@/components/AdminLayout'
import UserList from '@/components/UserList'

export interface User {
  id: string
  email: string
  name: string
  plan: string
  role: string | null
  disabled: boolean
  created_at: string
}

/**
 * User Management Page
 * Allows admins to view and manage user accounts
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */
export default function UsersPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [planFilter, setPlanFilter] = useState<string>('')

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  useEffect(() => {
    const checkAdminAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/')
        return
      }

      setUser(session.user as AuthUser)
      
      try {
        // Verify admin status and load users
        const response = await fetch(`${API_URL}/api/admin/users?limit=100`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
        
        if (response.ok) {
          setIsAdmin(true)
          const data = await response.json()
          setUsers(data.users || [])  // Extract users array from response
          setLoading(false)
        } else if (response.status === 403) {
          router.push('/chat')
        } else {
          throw new Error('Failed to load users')
        }
      } catch (err) {
        console.error('Failed to load users:', err)
        setError(err instanceof Error ? err.message : 'Failed to load users')
        setLoading(false)
      }
    }

    checkAdminAccess()
  }, [router])

  const loadUsers = async (filter?: string) => {
    try {
      setUsersLoading(true)
      setError(null)
      
      const authToken = await getAuthToken()
      if (!authToken) {
        throw new Error('No authentication token available')
      }

      const url = filter 
        ? `${API_URL}/api/admin/users?plan=${filter}&limit=100`
        : `${API_URL}/api/admin/users?limit=100`

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load users')
      }

      const data = await response.json()
      setUsers(data.users || [])  // Extract users array from response
    } catch (err) {
      console.error('Failed to load users:', err)
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setUsersLoading(false)
    }
  }

  const handlePlanChange = async (userId: string, newPlan: string) => {
    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        throw new Error('No authentication token available')
      }

      const response = await fetch(`${API_URL}/api/admin/users/${userId}/plan`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ plan: newPlan })
      })

      if (!response.ok) {
        throw new Error('Failed to update user plan')
      }

      const updatedUser = await response.json()
      
      // Update user in list
      setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u))
      
      alert('User plan updated successfully')
    } catch (err) {
      console.error('Failed to update plan:', err)
      alert(err instanceof Error ? err.message : 'Failed to update plan')
    }
  }

  const handleResetUsage = async (userId: string) => {
    if (!confirm('Are you sure you want to reset this user\'s usage counters?')) {
      return
    }

    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        throw new Error('No authentication token available')
      }

      const response = await fetch(`${API_URL}/api/admin/users/${userId}/usage/reset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to reset user usage')
      }

      alert('User usage reset successfully')
    } catch (err) {
      console.error('Failed to reset usage:', err)
      alert(err instanceof Error ? err.message : 'Failed to reset usage')
    }
  }

  const handleDisableUser = async (userId: string, disabled: boolean) => {
    const action = disabled ? 'disable' : 'enable'
    if (!confirm(`Are you sure you want to ${action} this user?`)) {
      return
    }

    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        throw new Error('No authentication token available')
      }

      const response = await fetch(`${API_URL}/api/admin/users/${userId}/disable?disabled=${disabled}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to ${action} user`)
      }

      const updatedUser = await response.json()
      
      // Update user in list
      setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u))
      
      alert(`User ${action}d successfully`)
    } catch (err) {
      console.error(`Failed to ${action} user:`, err)
      alert(err instanceof Error ? err.message : `Failed to ${action} user`)
    }
  }

  const handleFilterChange = (filter: string) => {
    setPlanFilter(filter)
    loadUsers(filter || undefined)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  if (!user || !isAdmin) {
    return null
  }

  return (
    <>
      <Head>
        <title>User Management - Admin Panel</title>
        <meta name="description" content="Manage user accounts" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <AdminLayout user={user}>
        <div style={{ padding: '30px' }}>
          <div style={{ marginBottom: '30px' }}>
            <h1 style={{ marginBottom: '10px' }}>User Management</h1>
            <p style={{ color: '#6c757d', margin: 0 }}>
              Manage user accounts, plans, and permissions
            </p>
          </div>

          {/* Filters */}
          <div style={{
            marginBottom: '20px',
            padding: '15px',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <label style={{ marginRight: '10px', fontWeight: 'bold' }}>
              Filter by Plan:
            </label>
            <select
              value={planFilter}
              onChange={(e) => handleFilterChange(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #ced4da',
                fontSize: '14px'
              }}
            >
              <option value="">All Plans</option>
              <option value="free">Free</option>
              <option value="student">Student</option>
              <option value="pro">Pro</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && (
            <div style={{
              padding: '15px',
              backgroundColor: '#f8d7da',
              color: '#721c24',
              borderRadius: '4px',
              marginBottom: '20px'
            }}>
              {error}
            </div>
          )}

          <UserList
            users={users}
            loading={usersLoading}
            onPlanChange={handlePlanChange}
            onResetUsage={handleResetUsage}
            onDisableUser={handleDisableUser}
          />
        </div>
      </AdminLayout>
    </>
  )
}
