import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase, AuthUser } from '@/lib/supabase'
import AdminLayout from '@/components/AdminLayout'
import FeatureToggleList from '@/components/FeatureToggleList'

export interface FeatureStatus {
  [feature: string]: boolean
}

/**
 * Feature Toggle Management Page
 * Allows admins to enable/disable features globally
 * Requirements: 16.1, 16.2
 */
export default function FeaturesPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [features, setFeatures] = useState<FeatureStatus>({})
  const [featuresLoading, setFeaturesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        // Verify admin status and load feature status
        const authToken = session.access_token
        const response = await fetch(`${API_URL}/api/admin/features`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        })
        
        if (response.ok) {
          setIsAdmin(true)
          const data = await response.json()
          setFeatures(data)
          setLoading(false)
        } else if (response.status === 403) {
          router.push('/chat')
        } else {
          throw new Error('Failed to load feature status')
        }
      } catch (err) {
        console.error('Failed to load features:', err)
        setError(err instanceof Error ? err.message : 'Failed to load features')
        setLoading(false)
      }
    }

    checkAdminAccess()
  }, [router])

  const loadFeatures = async () => {
    try {
      setFeaturesLoading(true)
      setError(null)
      
      const authToken = await getAuthToken()
      if (!authToken) {
        throw new Error('No authentication token available')
      }

      const response = await fetch(`${API_URL}/api/admin/features`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load feature status')
      }

      const data = await response.json()
      setFeatures(data)
    } catch (err) {
      console.error('Failed to load features:', err)
      setError(err instanceof Error ? err.message : 'Failed to load features')
    } finally {
      setFeaturesLoading(false)
    }
  }

  const handleToggleFeature = async (feature: string, enabled: boolean) => {
    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        throw new Error('No authentication token available')
      }

      const response = await fetch(`${API_URL}/api/admin/features/${feature}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail?.error?.message || 'Failed to toggle feature')
      }

      const result = await response.json()
      
      // Update local state
      setFeatures(prev => ({
        ...prev,
        [feature]: enabled
      }))
      
      alert(`Feature '${feature}' ${enabled ? 'enabled' : 'disabled'} successfully`)
    } catch (err) {
      console.error('Failed to toggle feature:', err)
      alert(err instanceof Error ? err.message : 'Failed to toggle feature')
      // Reload features to ensure consistency
      loadFeatures()
    }
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
        <title>Feature Toggles - Admin Panel</title>
        <meta name="description" content="Manage feature toggles" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <AdminLayout user={user}>
        <div style={{ padding: '30px' }}>
          <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ marginBottom: '10px' }}>Feature Toggles</h1>
              <p style={{ color: '#6c757d', margin: 0 }}>
                Enable or disable features globally across the platform
              </p>
            </div>
            <button
              onClick={loadFeatures}
              style={{
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
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
              marginBottom: '20px',
              border: '1px solid #f5c6cb'
            }}>
              {error}
            </div>
          )}

          <div style={{
            backgroundColor: '#fff3cd',
            color: '#856404',
            padding: '15px',
            borderRadius: '4px',
            marginBottom: '20px',
            border: '1px solid #ffeaa7'
          }}>
            <strong>⚠️ Warning:</strong> Disabling features will immediately affect all users. 
            Disabled features will return a 403 Forbidden error to users attempting to access them.
          </div>

          <FeatureToggleList
            features={features}
            loading={featuresLoading}
            onToggle={handleToggleFeature}
          />
        </div>
      </AdminLayout>
    </>
  )
}
