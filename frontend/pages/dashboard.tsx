import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/')
        return
      }

      setUser(session.user as AuthUser)
      setLoading(false)
    }

    checkAuth()
  }, [router])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <>
      <Head>
        <title>Dashboard - Vaidya AI</title>
        <meta name="description" content="Your medical study dashboard" />
      </Head>
      
      <DashboardLayout user={user}>
        {/* Welcome Section */}
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '10px' }}>
            Welcome back, {user.email?.split('@')[0]}!
          </h2>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>
            Ready to study? Here's your current progress and today's tasks.
          </p>
        </div>

        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}>
          <StatCard
            icon="✓"
            value="106"
            label="Correct MCQs"
            color="#10b981"
          />
          <StatCard
            icon="📋"
            value="38"
            label="Cases Completed"
            color="#3b82f6"
          />
          <StatCard
            icon="🩺"
            value="35"
            label="OSCE Sessions"
            color="#8b5cf6"
          />
          <StatCard
            icon="📈"
            label="Progress"
            color="#f59e0b"
            isProgress
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
          {/* Left Column */}
          <div>
            {/* Resume Study Section */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '25px',
              marginBottom: '30px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Resume Study</h3>
                <button style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '20px',
                  color: '#6b7280'
                }}>⋯</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                <ResumeCard
                  icon="✓"
                  title="MCQs"
                  subtitle="72% Accuracy"
                  detail="+100 Tokens Earned"
                  color="#10b981"
                />
                <ResumeCard
                  icon="📇"
                  title="Flashcards"
                  subtitle="28 % Young Adults"
                  detail="+20 Tokens Earned"
                  color="#3b82f6"
                />
                <ResumeCard
                  icon="📋"
                  title="Clinical Cases"
                  subtitle="Study Casework COPD"
                  detail="+5 Tokens Earned"
                  color="#f59e0b"
                />
              </div>

              <div style={{
                marginTop: '20px',
                padding: '15px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>
                  🪙 +50 Tokens Earned This Week
                </span>
                <button style={{
                  padding: '8px 20px',
                  backgroundColor: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}>
                  Generate Topics
                </button>
              </div>
            </div>

            {/* High Yield Summaries */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '25px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>
                High Yield Summaries
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                <HighYieldCard
                  title="Myocardial Infarction"
                  description="Covers high yield insights in 6 heart attacks"
                  emoji="❤️"
                  color="#ef4444"
                />
                <HighYieldCard
                  title="Asthma"
                  description="Triggers, Treatments, Key signs"
                  emoji="🫁"
                  color="#3b82f6"
                />
                <HighYieldCard
                  title="Pulmonary Embolism"
                  description="Symptoms, Diagnosis & Becoming-natives"
                  emoji="🫁"
                  color="#8b5cf6"
                />
                <HighYieldCard
                  title="Stroke"
                  description="Rapid assessment and treatment"
                  emoji="🧠"
                  color="#ec4899"
                />
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div>
            {/* Today's Tasks */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '25px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <span style={{ fontSize: '24px' }}>📅</span>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Today's Tasks</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <TaskItem label="Cardiovascular Physiology" checked={false} color="#ef4444" />
                <TaskItem label="ECG Basics" checked={true} color="#3b82f6" />
                <TaskItem label="Casework COPD" checked={false} color="#10b981" />
                <TaskItem label="Pulmonology Flashcards" checked={false} color="#f59e0b" />
              </div>
            </div>

            {/* Progress Tracker */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '25px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>
                Progress Tracker
              </h3>
              
              <div style={{
                height: '150px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '15px'
              }}>
                <span style={{ color: '#9ca3af' }}>📈 Chart Placeholder</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <ProgressItem label="Cardiovascular Physiology" checked />
                <ProgressItem label="ECG Basics" checked />
                <ProgressItem label="Casework COPD" checked />
              </div>
            </div>

            {/* Flashcard Stats */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '25px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>
                Flashcard Stats
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <FlashcardStat label="Asthma" count={4} color="#3b82f6" />
                <FlashcardStat label="Dermatology" count={3} color="#10b981" />
                <FlashcardStat label="Pharmacology" count={5} color="#f59e0b" />
                <FlashcardStat label="Cardiology" count={4} color="#ef4444" />
                <FlashcardStat label="Neurology" count={2} color="#8b5cf6" />
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </>
  )
}

function StatCard({ icon, value, label, color, isProgress }: any) {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          backgroundColor: `${color}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px'
        }}>
          {icon}
        </div>
        {!isProgress && <span style={{ fontSize: '28px', fontWeight: 'bold' }}>{value}</span>}
      </div>
      <div style={{ color: '#6b7280', fontSize: '14px' }}>{label}</div>
    </div>
  )
}

function ResumeCard({ icon, title, subtitle, detail, color }: any) {
  return (
    <div style={{
      padding: '15px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = color
      e.currentTarget.style.boxShadow = `0 4px 12px ${color}30`
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = '#e5e7eb'
      e.currentTarget.style.boxShadow = 'none'
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        backgroundColor: `${color}20`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        marginBottom: '10px'
      }}>
        {icon}
      </div>
      <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '5px' }}>{title}</div>
      <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>{subtitle}</div>
      <div style={{ fontSize: '12px', color: color, fontWeight: '500' }}>{detail}</div>
    </div>
  )
}

function HighYieldCard({ title, description, emoji, color }: any) {
  return (
    <div style={{
      padding: '20px',
      border: '1px solid #e5e7eb',
      borderRadius: '10px',
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = color
      e.currentTarget.style.transform = 'translateY(-2px)'
      e.currentTarget.style.boxShadow = `0 8px 16px ${color}20`
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = '#e5e7eb'
      e.currentTarget.style.transform = 'translateY(0)'
      e.currentTarget.style.boxShadow = 'none'
    }}>
      <div style={{ fontSize: '48px', marginBottom: '15px', textAlign: 'center' }}>{emoji}</div>
      <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>{title}</div>
      <div style={{ fontSize: '13px', color: '#6b7280' }}>{description}</div>
    </div>
  )
}

function TaskItem({ label, checked, color }: any) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px',
      borderRadius: '6px',
      backgroundColor: checked ? '#f0fdf4' : '#f9fafb'
    }}>
      <div style={{
        width: '20px',
        height: '20px',
        borderRadius: '4px',
        border: `2px solid ${checked ? color : '#d1d5db'}`,
        backgroundColor: checked ? color : 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '12px'
      }}>
        {checked && '✓'}
      </div>
      <span style={{
        fontSize: '14px',
        color: checked ? '#6b7280' : '#111827',
        textDecoration: checked ? 'line-through' : 'none'
      }}>
        {label}
      </span>
    </div>
  )
}

function ProgressItem({ label, checked }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{
        width: '16px',
        height: '16px',
        borderRadius: '3px',
        backgroundColor: checked ? '#10b981' : '#e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '10px'
      }}>
        {checked && '✓'}
      </div>
      <span style={{ fontSize: '13px', color: '#6b7280' }}>{label}</span>
    </div>
  )
}

function FlashcardStat({ label, count, color }: any) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 0'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '2px',
          backgroundColor: color
        }} />
        <span style={{ fontSize: '13px', color: '#6b7280' }}>{label}</span>
      </div>
      <span style={{
        fontSize: '13px',
        fontWeight: '600',
        color: '#111827',
        backgroundColor: '#f3f4f6',
        padding: '2px 8px',
        borderRadius: '4px'
      }}>
        {count}
      </span>
    </div>
  )
}
