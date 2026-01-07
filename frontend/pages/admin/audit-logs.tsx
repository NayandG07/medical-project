import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase, AuthUser } from '@/lib/supabase'
import AdminLayout from '@/components/AdminLayout'
import AuditLogTable from '@/components/AuditLogTable'

export interface AuditLog {
  id: string
  admin_id: string
  action_type: string
  target_type: string
  target_id: string
  details: Record<string, any> | null
  timestamp: string
}

/**
 * Audit Logs Page
 * Allows admins to view and filter audit logs
 * Requirements: 19.6
 */
export default function AuditLogsPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Filters
  const [adminFilter, setAdminFilter] = useState<string>('')
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('')
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')

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
        // Verify admin status and load logs
        await loadLogs(session.access_token)
        setIsAdmin(true)
        setLoading(false)
      } catch (err) {
        console.error('Failed to load audit logs:', err)
        if (err instanceof Error && err.message.includes('403')) {
          router.push('/chat')
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load audit logs')
          setLoading(false)
        }
      }
    }

    checkAdminAccess()
  }, [router])

  const loadLogs = async (token?: string, filters?: {
    admin_id?: string
    action_type?: string
    target_type?: string
  }) => {
    try {
      setLogsLoading(true)
      setError(null)
      
      const authToken = token || await getAuthToken()
      if (!authToken) {
        throw new Error('No authentication token available')
      }

      // Build query parameters
      const params = new URLSearchParams()
      params.append('limit', '100')
      
      if (filters?.admin_id) {
        params.append('admin_id', filters.admin_id)
      }
      if (filters?.action_type) {
        params.append('action_type', filters.action_type)
      }
      if (filters?.target_type) {
        params.append('target_type', filters.target_type)
      }

      const response = await fetch(`${API_URL}/api/admin/audit-logs?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (response.status === 403) {
        throw new Error('403: Access denied')
      }

      if (!response.ok) {
        throw new Error('Failed to load audit logs')
      }

      const data = await response.json()
      setLogs(data.logs || data) // Handle both {logs: [...]} and [...] formats
    } catch (err) {
      console.error('Failed to load audit logs:', err)
      setError(err instanceof Error ? err.message : 'Failed to load audit logs')
      throw err
    } finally {
      setLogsLoading(false)
    }
  }

  const handleFilterChange = () => {
    loadLogs(undefined, {
      admin_id: adminFilter || undefined,
      action_type: actionTypeFilter || undefined,
      target_type: targetTypeFilter || undefined
    })
  }

  const handleClearFilters = () => {
    setAdminFilter('')
    setActionTypeFilter('')
    setTargetTypeFilter('')
    setSearchQuery('')
    loadLogs()
  }

  // Filter logs by search query (client-side)
  const filteredLogs = searchQuery
    ? logs.filter(log => 
        log.admin_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.action_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.target_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.target_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        JSON.stringify(log.details).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : logs

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
        <title>Audit Logs - Admin Panel</title>
        <meta name="description" content="View admin action audit logs" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <AdminLayout user={user}>
        <div style={{ padding: '30px' }}>
          <div style={{ marginBottom: '30px' }}>
            <h1 style={{ marginBottom: '10px' }}>Audit Logs</h1>
            <p style={{ color: '#6c757d', margin: 0 }}>
              View and filter admin actions and system events
            </p>
          </div>

          {/* Filters */}
          <div style={{
            marginBottom: '20px',
            padding: '20px',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Filters</h3>
            
            {/* Search */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Search:
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search in all fields..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #ced4da',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px',
              marginBottom: '15px'
            }}>
              {/* Admin ID Filter */}
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Admin ID:
                </label>
                <input
                  type="text"
                  value={adminFilter}
                  onChange={(e) => setAdminFilter(e.target.value)}
                  placeholder="Filter by admin ID"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #ced4da',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Action Type Filter */}
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Action Type:
                </label>
                <select
                  value={actionTypeFilter}
                  onChange={(e) => setActionTypeFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #ced4da',
                    fontSize: '14px'
                  }}
                >
                  <option value="">All Actions</option>
                  <option value="update_plan">Update Plan</option>
                  <option value="reset_usage">Reset Usage</option>
                  <option value="disable_user">Disable User</option>
                  <option value="enable_user">Enable User</option>
                  <option value="add_api_key">Add API Key</option>
                  <option value="delete_api_key">Delete API Key</option>
                </select>
              </div>

              {/* Target Type Filter */}
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Target Type:
                </label>
                <select
                  value={targetTypeFilter}
                  onChange={(e) => setTargetTypeFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #ced4da',
                    fontSize: '14px'
                  }}
                >
                  <option value="">All Types</option>
                  <option value="user">User</option>
                  <option value="api_key">API Key</option>
                  <option value="system_flag">System Flag</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleFilterChange}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Apply Filters
              </button>
              <button
                onClick={handleClearFilters}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Clear Filters
              </button>
            </div>
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

          <AuditLogTable
            logs={filteredLogs}
            loading={logsLoading}
          />
        </div>
      </AdminLayout>
    </>
  )
}
