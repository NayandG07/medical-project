import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import AdminLayout from '@/components/AdminLayout'

interface PlanLimits {
  document_retention_days: number
  chat_daily_limit: number
  mcq_daily_limit: number
  flashcard_daily_limit: number
  explain_daily_limit: number
  highyield_daily_limit: number
  document_uploads_daily: number
}

interface AllPlanLimits {
  free: PlanLimits
  student: PlanLimits
  pro: PlanLimits
}

export default function RateLimits() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [limits, setLimits] = useState<AllPlanLimits | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/')
      return
    }
    setUser(session.user as AuthUser)
    await fetchLimits()
    setLoading(false)
  }

  const fetchLimits = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/rate-limits`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) throw new Error('Failed to fetch rate limits')
      const data = await response.json()
      setLimits(data)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleSave = async (plan: string) => {
    if (!limits) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/rate-limits`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan,
          limits: limits[plan as keyof AllPlanLimits]
        })
      })

      if (!response.ok) throw new Error('Failed to save rate limits')
      setSuccess(`Rate limits for ${plan} plan updated successfully`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const updateLimit = (plan: keyof AllPlanLimits, field: keyof PlanLimits, value: number) => {
    if (!limits) return
    setLimits({
      ...limits,
      [plan]: {
        ...limits[plan],
        [field]: value
      }
    })
  }

  if (loading || !user || !limits) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  const plans = [
    { id: 'free', name: 'Free Plan', color: '#64748B', icon: '🆓' },
    { id: 'student', name: 'Student Plan', color: '#3B82F6', icon: '🎓' },
    { id: 'pro', name: 'Pro Plan', color: '#8B5CF6', icon: '⭐' },
  ]

  return (
    <>
      <Head>
        <title>Rate Limits - Admin</title>
      </Head>
      <AdminLayout user={user}>
        <div style={{ padding: '30px' }}>
          <div style={{ marginBottom: '30px' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '10px' }}>Rate Limits & Quotas</h1>
            <p style={{ fontSize: '16px', color: '#6c757d' }}>Configure usage limits and document retention per plan</p>
          </div>

          {error && (
            <div style={{
              backgroundColor: '#f8d7da',
              color: '#721c24',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px',
              borderLeft: '4px solid #dc3545',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div style={{
              backgroundColor: '#d4edda',
              color: '#155724',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px',
              borderLeft: '4px solid #28a745',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span>✓</span>
              <span>{success}</span>
            </div>
          )}

          <div style={{ display: 'grid', gap: '30px' }}>
            {plans.map((plan) => (
              <div key={plan.id} style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '25px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                border: '1px solid #dee2e6'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '25px',
                  paddingBottom: '20px',
                  borderBottom: '2px solid #e9ecef'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      backgroundColor: `${plan.color}20`
                    }}>
                      {plan.icon}
                    </div>
                    <div>
                      <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{plan.name}</h2>
                      <p style={{ fontSize: '14px', color: '#6c757d', margin: '5px 0 0 0' }}>
                        Configure limits for {plan.id} tier users
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSave(plan.id)}
                    disabled={saving}
                    style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      border: 'none',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      opacity: saving ? 0.6 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    <span>💾</span>
                    Save {plan.name}
                  </button>
                </div>

                {/* Document Storage */}
                <div style={{
                  marginBottom: '25px',
                  padding: '20px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #dee2e6'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                    <span style={{ fontSize: '18px' }}>🕐</span>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Document Storage</h3>
                  </div>
                  <div style={{ display: 'grid', gap: '20px' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        marginBottom: '8px'
                      }}>
                        Document Retention (days)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={limits[plan.id as keyof AllPlanLimits].document_retention_days}
                        onChange={(e) => updateLimit(plan.id as keyof AllPlanLimits, 'document_retention_days', parseInt(e.target.value) || 0)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #ced4da',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: '600'
                        }}
                      />
                      <p style={{ fontSize: '13px', color: '#6c757d', marginTop: '8px' }}>
                        How long uploaded documents are kept in storage
                      </p>
                    </div>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        marginBottom: '8px'
                      }}>
                        Document Uploads (per day)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={limits[plan.id as keyof AllPlanLimits].document_uploads_daily}
                        onChange={(e) => updateLimit(plan.id as keyof AllPlanLimits, 'document_uploads_daily', parseInt(e.target.value) || 0)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #ced4da',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: '600'
                        }}
                      />
                      <p style={{ fontSize: '13px', color: '#6c757d', marginTop: '8px' }}>
                        Maximum document uploads per user per day
                      </p>
                    </div>
                  </div>
                </div>

                {/* Feature Limits */}
                <div style={{
                  padding: '20px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #dee2e6'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                    <span style={{ fontSize: '18px' }}>⚡</span>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Feature Usage Limits (per day)</h3>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '20px'
                  }}>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        marginBottom: '8px'
                      }}>
                        💬 Chat
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        value={limits[plan.id as keyof AllPlanLimits].chat_daily_limit}
                        onChange={(e) => updateLimit(plan.id as keyof AllPlanLimits, 'chat_daily_limit', parseInt(e.target.value) || 0)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #ced4da',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: '600'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        marginBottom: '8px'
                      }}>
                        ❓ MCQs
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        value={limits[plan.id as keyof AllPlanLimits].mcq_daily_limit}
                        onChange={(e) => updateLimit(plan.id as keyof AllPlanLimits, 'mcq_daily_limit', parseInt(e.target.value) || 0)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #ced4da',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: '600'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        marginBottom: '8px'
                      }}>
                        📚 Flashcards
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        value={limits[plan.id as keyof AllPlanLimits].flashcard_daily_limit}
                        onChange={(e) => updateLimit(plan.id as keyof AllPlanLimits, 'flashcard_daily_limit', parseInt(e.target.value) || 0)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #ced4da',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: '600'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        marginBottom: '8px'
                      }}>
                        💡 Explain
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        value={limits[plan.id as keyof AllPlanLimits].explain_daily_limit}
                        onChange={(e) => updateLimit(plan.id as keyof AllPlanLimits, 'explain_daily_limit', parseInt(e.target.value) || 0)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #ced4da',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: '600'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        marginBottom: '8px'
                      }}>
                        ✨ High Yield
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        value={limits[plan.id as keyof AllPlanLimits].highyield_daily_limit}
                        onChange={(e) => updateLimit(plan.id as keyof AllPlanLimits, 'highyield_daily_limit', parseInt(e.target.value) || 0)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #ced4da',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: '600'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AdminLayout>
    </>
  )
}
