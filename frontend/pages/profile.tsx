import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Head from 'next/head'
import { motion } from 'framer-motion'
import { User, Mail, Shield, LogOut, Settings, ExternalLink, ChevronRight, Sparkles } from 'lucide-react'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import UserApiKeyForm from '../components/UserApiKeyForm'

/**
 * Redesigned Profile Page
 * Provides a premium, clean interface for user settings.
 */
export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentKey, setCurrentKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)

  const [plan, setPlan] = useState<string>('free')

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

      // Fetch user plan
      const { data: userData } = await supabase
        .from('users')
        .select('plan')
        .eq('id', user.id)
        .single()

      if (userData?.plan) {
        setPlan(userData.plan)
      }

      await fetchUserKey(user.id)
    } catch (err) {
      console.error('Error checking user:', err)
      setError('Failed to load user credentials')
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
  }

  const handleRemoveKey = async () => {
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
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0]
  const userInitials = userName?.[0]?.toUpperCase() || 'U'

  const getPlanLabel = (plan: string) => {
    const plans: Record<string, string> = {
      free: 'Free Plan',
      student: 'Student Plan',
      pro: 'Premium Plan',
      admin: 'Admin Plan'
    }
    return plans[plan.toLowerCase()] || 'Free Plan'
  }

  return (
    <>
      <Head>
        <title>Account Settings - Vaidya AI</title>
      </Head>
      <DashboardLayout user={user}>
        {loading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '60vh',
            gap: '20px'
          }}>
            <div className="loader" style={{
              width: '40px',
              height: '40px',
              border: '3px solid #e2e8f0',
              borderTopColor: '#6366f1',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <style jsx>{`
              @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
            <span style={{ color: '#64748b', fontWeight: '500' }}>Loading profile settings...</span>
          </div>
        ) : !user ? null : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              style={{
                maxWidth: '900px',
                margin: '0 auto',
                padding: '1px 20px'
              }}
            >
              {/* Header */}
              <div style={{ marginBottom: '40px' }}>
                <h1 style={{
                  fontSize: '2.5rem',
                  fontWeight: '800',
                  color: '#0f172a',
                  marginBottom: '10px',
                  letterSpacing: '-0.025em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  Personal Profile
                </h1>
                <p style={{ fontSize: '1.125rem', color: '#64748b' }}>
                  Manage your identity and processing preferences.
                </p>
              </div>

              {error && (
                <div style={{
                  padding: '16px 20px',
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  borderRadius: '16px',
                  marginBottom: '32px',
                  border: '1px solid #fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontWeight: '500'
                }}>
                  <Shield size={20} />
                  {error}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '32px' }}>

                {/* User Overview Card */}
                <motion.div
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '24px',
                    padding: '32px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '24px',
                      backgroundColor: '#6366f1',
                      backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '2rem',
                      fontWeight: '700',
                      boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3)'
                    }}>
                      {userInitials}
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
                        {userName}
                      </h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '1rem', marginTop: '4px' }}>
                        <Mail size={16} />
                        {user?.email}
                      </div>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                      <span style={{
                        padding: '6px 14px',
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        borderRadius: '50px',
                        fontSize: '0.875rem',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <Sparkles size={14} style={{ color: '#eab308' }} />
                        {getPlanLabel(plan)}
                      </span>
                    </div>
                  </div>

                  <div style={{
                    height: '1px',
                    backgroundColor: '#f1f5f9',
                    width: '100%'
                  }} />

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                    <div style={{
                      padding: '20px',
                      borderRadius: '16px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0'
                    }}>
                      <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                        Subscription Status
                      </div>
                      <div style={{ fontWeight: '600', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        Active
                        <ChevronRight size={16} color="#cbd5e1" />
                      </div>
                    </div>
                    <div style={{
                      padding: '20px',
                      borderRadius: '16px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0'
                    }}>
                      <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                        Member Since
                      </div>
                      <div style={{ fontWeight: '600', color: '#334155' }}>
                        {user?.created_at && new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* API Key Management */}
                <UserApiKeyForm
                  currentKey={currentKey}
                  onSubmit={handleSubmitKey}
                  onRemove={handleRemoveKey}
                />

                {/* Sign Out Section */}
                <motion.div
                  whileHover={{ y: -2 }}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '24px',
                    padding: '32px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1e293b' }}>Security & Privacy</h3>
                    <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: '0.95rem' }}>
                      Manage your session and account security.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsLogoutModalOpen(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px 24px',
                      backgroundColor: '#fef2f2',
                      color: '#ef4444',
                      border: 'none',
                      borderRadius: '14px',
                      fontSize: '1rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 4px rgba(239, 68, 68, 0.1)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#fee2e2'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#fef2f2'
                    }}
                  >
                    <LogOut size={20} />
                    Sign Out
                  </button>
                </motion.div>

                {/* Support Links */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '32px',
                  marginTop: '16px'
                }}>
                  <Link href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Privacy Policy <ExternalLink size={14} />
                  </Link>
                  <Link href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Terms of Service <ExternalLink size={14} />
                  </Link>
                  <Link href="/contact" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Contact Support <ExternalLink size={14} />
                  </Link>
                </div>

              </div>
            </motion.div>

            {/* Logout Confirmation Modal */}
            {isLogoutModalOpen && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
              }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{
                    backgroundColor: 'white',
                    width: '90%',
                    maxWidth: '360px',
                    borderRadius: '24px',
                    padding: '32px',
                    textAlign: 'center',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <div style={{
                    width: '64px',
                    height: '64px',
                    backgroundColor: '#fef2f2',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px',
                    color: '#ef4444'
                  }}>
                    <LogOut size={32} />
                  </div>

                  <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>
                    Sign out?
                  </h3>
                  <p style={{ fontSize: '15px', color: '#64748b', marginBottom: '28px', lineHeight: '1.5' }}>
                    Are you sure you want to sign out of your account?
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                      onClick={handleSignOut}
                      style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '15px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      Sign out
                    </button>
                    <button
                      onClick={() => setIsLogoutModalOpen(false)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: 'white',
                        color: '#475569',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: '12px',
                        fontSize: '15px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </>
        )}
      </DashboardLayout>
    </>
  )
}

