import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase, AuthUser } from '@/lib/supabase'
import AdminLayout from '@/components/AdminLayout'
import ApiKeyList from '@/components/ApiKeyList'
import AddApiKeyForm from '@/components/AddApiKeyForm'

export interface ApiKey {
  id: string
  provider: string
  feature: string
  key_value: string  // Encrypted/masked
  priority: number
  status: string
  failure_count: number
  last_used_at: string | null
  created_at: string
  updated_at: string
}

/**
 * API Key Management Page
 * Allows admins to manage API keys for different providers
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6
 */
export default function ApiKeysPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [keysLoading, setKeysLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [providerFilter, setProviderFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

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
        // Verify admin status and load API keys
        const response = await fetch(`${API_URL}/api/admin/api-keys`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
        
        if (response.ok) {
          setIsAdmin(true)
          const data = await response.json()
          setApiKeys(data.keys || data) // Handle both {keys: [...]} and [...] formats
          setLoading(false)
        } else if (response.status === 403) {
          router.push('/chat')
        } else {
          throw new Error('Failed to load API keys')
        }
      } catch (err) {
        console.error('Failed to load API keys:', err)
        setError(err instanceof Error ? err.message : 'Failed to load API keys')
        setLoading(false)
      }
    }

    checkAdminAccess()
  }, [router])

  const loadApiKeys = async () => {
    try {
      setKeysLoading(true)
      setError(null)
      
      const authToken = await getAuthToken()
      if (!authToken) {
        throw new Error('No authentication token available')
      }

      const response = await fetch(`${API_URL}/api/admin/api-keys`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load API keys')
      }

      const data = await response.json()
      setApiKeys(data.keys || data) // Handle both {keys: [...]} and [...] formats
    } catch (err) {
      console.error('Failed to load API keys:', err)
      setError(err instanceof Error ? err.message : 'Failed to load API keys')
    } finally {
      setKeysLoading(false)
    }
  }

  const handleAddKey = async (provider: string, feature: string, key: string, priority: number, status: string) => {
    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        throw new Error('No authentication token available')
      }

      const response = await fetch(`${API_URL}/api/admin/api-keys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ provider, feature, key, priority, status })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail?.error?.message || 'Failed to add API key')
      }

      const newKey = await response.json()
      setApiKeys(prev => [...prev, newKey])
      setShowAddForm(false)
      alert('API key added successfully')
    } catch (err) {
      console.error('Failed to add API key:', err)
      throw err  // Re-throw to let form handle it
    }
  }

  const handleStatusToggle = async (keyId: string, newStatus: string) => {
    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        throw new Error('No authentication token available')
      }

      const response = await fetch(`${API_URL}/api/admin/api-keys/${keyId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) {
        throw new Error('Failed to update key status')
      }

      const updatedKey = await response.json()
      setApiKeys(prev => prev.map(k => k.id === keyId ? updatedKey : k))
      alert('Key status updated successfully')
    } catch (err) {
      console.error('Failed to update key status:', err)
      alert(err instanceof Error ? err.message : 'Failed to update key status')
    }
  }

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return
    }

    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        throw new Error('No authentication token available')
      }

      const response = await fetch(`${API_URL}/api/admin/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to delete API key')
      }

      setApiKeys(prev => prev.filter(k => k.id !== keyId))
      alert('API key deleted successfully')
    } catch (err) {
      console.error('Failed to delete API key:', err)
      alert(err instanceof Error ? err.message : 'Failed to delete API key')
    }
  }

  const handlePriorityChange = async (keyId: string, newPriority: number) => {
    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        throw new Error('No authentication token available')
      }

      // Note: The backend doesn't have a dedicated priority update endpoint yet
      // For now, we'll update via status endpoint with the same status
      const key = apiKeys.find(k => k.id === keyId)
      if (!key) return

      const response = await fetch(`${API_URL}/api/admin/api-keys/${keyId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: key.status, priority: newPriority })
      })

      if (!response.ok) {
        throw new Error('Failed to update key priority')
      }

      const updatedKey = await response.json()
      setApiKeys(prev => prev.map(k => k.id === keyId ? updatedKey : k))
    } catch (err) {
      console.error('Failed to update key priority:', err)
      alert(err instanceof Error ? err.message : 'Failed to update key priority')
    }
  }

  const filteredKeys = Array.isArray(apiKeys) ? apiKeys.filter(key => {
    if (providerFilter && key.provider !== providerFilter) return false
    if (statusFilter && key.status !== statusFilter) return false
    return true
  }) : []

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
        <title>API Key Management - Admin Panel</title>
        <meta name="description" content="Manage API keys for AI providers" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <AdminLayout user={user}>
        <div style={{ padding: '30px' }}>
          <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ marginBottom: '10px' }}>API Key Management</h1>
              <p style={{ color: '#6c757d', margin: 0 }}>
                Manage API keys for different providers and features
              </p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              + Add API Key
            </button>
          </div>

          {/* Filters */}
          <div style={{
            marginBottom: '20px',
            padding: '15px',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #dee2e6',
            display: 'flex',
            gap: '20px',
            alignItems: 'center'
          }}>
            <div>
              <label style={{ marginRight: '10px', fontWeight: 'bold' }}>
                Provider:
              </label>
              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #ced4da',
                  fontSize: '14px'
                }}
              >
                <option value="">All Providers</option>
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="openrouter">OpenRouter</option>
                <option value="ollama">Ollama</option>
              </select>
            </div>
            <div>
              <label style={{ marginRight: '10px', fontWeight: 'bold' }}>
                Status:
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #ced4da',
                  fontSize: '14px'
                }}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="degraded">Degraded</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <button
              onClick={loadApiKeys}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                marginLeft: 'auto'
              }}
            >
              Refresh
            </button>
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

          <ApiKeyList
            apiKeys={filteredKeys}
            loading={keysLoading}
            onStatusToggle={handleStatusToggle}
            onDeleteKey={handleDeleteKey}
            onPriorityChange={handlePriorityChange}
          />

          {/* Add API Key Modal */}
          {showAddForm && (
            <AddApiKeyForm
              onClose={() => setShowAddForm(false)}
              onSubmit={handleAddKey}
            />
          )}
        </div>
      </AdminLayout>
    </>
  )
}
