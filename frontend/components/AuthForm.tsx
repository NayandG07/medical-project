import { useState, FormEvent, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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
      <div className="bg-[var(--cream-card)] w-full max-w-[440px] p-10 rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.02)] relative overflow-hidden animate-[fadeIn_0.8s_ease-out] text-center border border-[var(--cream-accent-soft)]">
        <div className="text-center mb-9">
          <div className="flex flex-col items-center text-[28px] font-extrabold text-[var(--cream-text-main)] mb-3 tracking-tight">
            <div className="bg-[var(--cream-accent-soft)] rounded-3xl w-24 h-24 flex items-center justify-center mb-6 border border-[var(--cream-accent)]">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--cream-text-muted)]">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div className="font-bold">Verify your email</div>
          </div>
          <p className="text-[var(--cream-text-muted)] text-[16px] leading-relaxed font-medium">
            We've sent a verification link to <br /><strong className="text-[var(--cream-text-main)]">{email}</strong>
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          <p className="text-sm text-[var(--cream-text-muted)] leading-relaxed">
            Click the link in your inbox to finish setting up your account. If you don't see it, check your spam folder.
          </p>

          <button
            onClick={() => setShowConfirmation(false)}
            className="bg-[var(--cream-text-main)] text-white px-6 py-4 rounded-2xl text-[15px] font-bold cursor-pointer transition-all mt-4 flex items-center justify-center gap-3 shadow-lg hover:bg-black hover:-translate-y-0.5 active:translate-y-0 w-full"
          >
            Back to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[var(--cream-card)] w-full max-w-[440px] px-10 py-12 rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.02)] relative overflow-hidden animate-[fadeIn_0.8s_ease-out] border border-[var(--cream-accent-soft)]">
      <div className="text-center mb-10">
        <div className="flex flex-col items-center text-[26px] font-bold text-[var(--cream-text-main)] mb-3 tracking-tight">
          <div className="mb-4 w-12 h-12 bg-[var(--cream-accent-soft)] rounded-2xl flex items-center justify-center text-[var(--cream-text-main)]">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div className="font-extrabold">{mode === 'login' ? 'Welcome Back' : 'Get Started'}</div>
        </div>
        <p className="text-[var(--cream-text-muted)] text-[15px] leading-relaxed font-medium">
          {mode === 'login'
            ? 'Sign in to your medical AI companion.'
            : 'Join the future of medical education.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {mode === 'register' && (
          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="text-[13px] font-bold text-[var(--cream-text-muted)] uppercase tracking-widest ml-1">Full Name</label>
            <input
              id="name"
              type="text"
              placeholder="Dr. John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className="px-5 py-4 border-2 border-[var(--cream-accent-soft)] rounded-2xl text-[15px] font-medium transition-all outline-none text-[var(--cream-text-main)] bg-[var(--cream-bg)] focus:border-[var(--cream-accent)] focus:bg-white placeholder:text-gray-300"
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-[13px] font-bold text-[var(--cream-text-muted)] uppercase tracking-widest ml-1">Email Address</label>
          <input
            id="email"
            type="email"
            placeholder="name@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="px-5 py-4 border-2 border-[var(--cream-accent-soft)] rounded-2xl text-[15px] font-medium transition-all outline-none text-[var(--cream-text-main)] bg-[var(--cream-bg)] focus:border-[var(--cream-accent)] focus:bg-white placeholder:text-gray-300"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center ml-1">
            <label htmlFor="password" className="text-[13px] font-bold text-[var(--cream-text-muted)] uppercase tracking-widest">Password</label>
            {mode === 'login' && (
              <button type="button" className="text-[11px] font-bold text-[var(--cream-text-muted)] hover:text-black uppercase tracking-wider">Forgot?</button>
            )}
          </div>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="px-5 py-4 border-2 border-[var(--cream-accent-soft)] rounded-2xl text-[15px] font-medium transition-all outline-none text-[var(--cream-text-main)] bg-[var(--cream-bg)] focus:border-[var(--cream-accent)] focus:bg-white placeholder:text-gray-300"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-4 rounded-2xl text-[13px] font-bold animate-[shake_0.4s_cubic-bezier(.36,.07,.19,.97)_both] flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-[var(--cream-text-main)] text-white px-6 py-4 rounded-2xl text-[16px] font-bold cursor-pointer transition-all mt-3 flex items-center justify-center gap-3 shadow-xl hover:bg-black hover:-translate-y-0.5 active:translate-y-0 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
        >
          {loading ? (
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-10"></circle>
              <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
            </svg>
          ) : (
            <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
          )}
        </button>
      </form>

      <div className="mt-10 text-center">
        <p className="text-[14px] font-medium text-[var(--cream-text-muted)]">
          {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
            className="ml-2 font-bold text-[var(--cream-text-main)] hover:underline border-none bg-transparent cursor-pointer"
          >
            {mode === 'login' ? 'Sign up for free' : 'Log in here'}
          </button>
        </p>
      </div>

      <style jsx>{`
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </div>
  )
}
