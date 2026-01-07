import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import UserApiKeyForm from '../components/UserApiKeyForm'

/**
 * Profile Page
 * User profile management including personal API key
 * Requirements: 27.1, 27.5
 */
export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentKey, setCurrentKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/')
        return
      }

      setUser(user as AuthUser)
      
      // Check if user has a personal API key
      await fetchUserKey(user.id)
    } catch (err) {
      console.error('Error checking user:', err)
      setError('Failed to load user data')
    } finally {
      setLoading(false)
    }
  }

  const fetchUserKey = async (userId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/api-key`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentKey(data.has_key ? 'exists' : null)
      }
    } catch (err) {
      console.error('Error fetching user key:', err)
    }
  }

  const handleSubmitKey = async (key: string) => {
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/api-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ key })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to save API key')
      }

      setCurrentKey('exists')
    } catch (err) {
      throw err
    }
  }

  const handleRemoveKey = async () => {
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/api-key`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to remove API key')
      }

      setCurrentKey(null)
    } catch (err) {
      throw err
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading || !user) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh'
      }}>
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Profile - Vaidya AI</title>
      </Head>
      <DashboardLayout user={user}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto'
        }}>
        <h1 style={{ fontSize: '2.5rem', color: '#2d3748', marginBottom: '0.5rem' }}>Profile ⚙️</h1>
        <p style={{ fontSize: '1.1rem', color: '#718096', marginBottom: '2rem' }}>Manage your account settings</p>

        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            border: '1px solid #f5c6cb'
          }}>
            {error}
          </div>
        )}

        {/* User Info */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#2d3748' }}>Account Information</h2>
          <div style={{ fontSize: '1rem', color: '#4a5568', lineHeight: '2' }}>
            <p><strong>Email:</strong> {user?.email}</p>
            <p style={{ marginBottom: 0 }}><strong>User ID:</strong> {user?.id}</p>
          </div>
        </div>

        {/* API Key Management */}
        <UserApiKeyForm
          currentKey={currentKey}
          onSubmit={handleSubmitKey}
          onRemove={handleRemoveKey}
        />
        </div>
      </DashboardLayout>
    </>
  )
}
