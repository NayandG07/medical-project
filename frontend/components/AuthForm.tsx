import { useState, FormEvent, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import styles from '@/styles/Auth.module.css'

type AuthMode = 'login' | 'register'

interface AuthFormProps {
  onSuccess?: () => void
}

export default function AuthForm({ onSuccess }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [platformName, setPlatformName] = useState('Vaidya AI')
  const [showConfirmation, setShowConfirmation] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const res = await fetch(`${API_URL}/api/system/settings`)
        if (res.ok) {
          const data = await res.json()
          setPlatformName(data.platform_name)
        }
      } catch (err) {
        console.error('Failed to fetch platform settings:', err)
      }
    }
    fetchSettings()
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
            },
          },
        })

        if (error) throw error

        if (data.user) {
          // Check if email confirmation is required (session will be null)
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) {
            setShowConfirmation(true)
          } else if (onSuccess) {
            onSuccess()
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        if (data.user) {
          if (onSuccess) onSuccess()
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      if (error || mode === 'register') setLoading(false)
      else setTimeout(() => setLoading(false), 500)
    }
  }

  if (showConfirmation) {
    return (
      <div className={`${styles.card} ${styles.fadeContainer}`} style={{ textAlign: 'center' }}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <div style={{
              backgroundColor: '#f0f9ff',
              borderRadius: '50%',
              width: '80px',
              height: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '24px',
              border: '2px dashed #cbd5e1'
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div>Verify your email</div>
          </div>
          <p className={styles.subtitle}>
            We've sent a verification link to <br /><strong style={{ color: '#1e293b' }}>{email}</strong>
          </p>
        </div>

        <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.5' }}>
            Click the link in your inbox to finish setting up your account. If you don't see it, check your spam folder.
          </p>

          <button
            onClick={() => setShowConfirmation(false)}
            className={styles.button}
            style={{ width: '100%' }}
          >
            Back to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.card} ${styles.fadeContainer}`}>
      <div className={styles.header}>
        <div className={styles.logo}>
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginBottom: '16px', color: '#94a3b8' }}
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <div style={{ textTransform: 'none' }}>{platformName}</div>
        </div>
        <p className={styles.subtitle}>
          {mode === 'login'
            ? 'Sign in to access your medical learning assistants.'
            : 'Join thousands of medical students worldwide.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {mode === 'register' && (
          <div className={styles.inputGroup}>
            <label htmlFor="name" className={styles.label}>Full Name</label>
            <input
              id="name"
              type="text"
              placeholder="e.g. Dr. John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className={styles.input}
            />
          </div>
        )}

        <div className={styles.inputGroup}>
          <label htmlFor="email" className={styles.label}>Email Address</label>
          <input
            id="email"
            type="email"
            placeholder="university@email.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className={styles.input}
          />
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="password" className={styles.label}>Password</label>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className={styles.input}
          />
        </div>

        {error && (
          <div className={styles.error}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={styles.button}
        >
          {loading ? (
            <svg className={styles.spinner} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.1"></circle>
              <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
            </svg>
          ) : (
            <span>{mode === 'login' ? 'Continue' : 'Create Account'}</span>
          )}
        </button>
      </form>

      <div className={styles.footer}>
        {mode === 'login' ? (
          <>
            New to the platform?
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); }}
              className={styles.linkButton}
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              className={styles.linkButton}
            >
              Log in
            </button>
          </>
        )}
      </div>
    </div>
  )
}
