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
      <div className="bg-white w-full max-w-[420px] p-12 rounded-3xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.03),0_10px_10px_-5px_rgba(0,0,0,0.02),0_0_0_1px_rgba(226,232,240,0.8)] relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1.5 before:bg-gradient-to-r before:from-slate-300 before:to-slate-400 animate-[fadeIn_0.8s_ease-out] text-center">
        <div className="text-center mb-9">
          <div className="flex flex-col items-center text-[28px] font-extrabold text-slate-800 mb-3 tracking-tight">
            <div className="bg-blue-50 rounded-full w-20 h-20 flex items-center justify-center mb-6 border-2 border-dashed border-slate-300">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div>Verify your email</div>
          </div>
          <p className="text-slate-500 text-[15px] leading-relaxed font-normal">
            We've sent a verification link to <br /><strong className="text-slate-800">{email}</strong>
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          <p className="text-sm text-slate-500 leading-normal">
            Click the link in your inbox to finish setting up your account. If you don't see it, check your spam folder.
          </p>

          <button
            onClick={() => setShowConfirmation(false)}
            className="bg-slate-800 text-white px-3.5 py-3.5 border-0 rounded-xl text-base font-bold cursor-pointer transition-all mt-2.5 flex items-center justify-center gap-3 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] hover:bg-slate-900 hover:-translate-y-0.5 hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] active:translate-y-0 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none w-full"
          >
            Back to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white w-full max-w-[420px] px-10 py-12 rounded-3xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.03),0_10px_10px_-5px_rgba(0,0,0,0.02),0_0_0_1px_rgba(226,232,240,0.8)] relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1.5 before:bg-gradient-to-r before:from-slate-300 before:to-slate-400 animate-[fadeIn_0.8s_ease-out]">
      <div className="text-center mb-9">
        <div className="flex flex-col items-center text-[28px] font-extrabold text-slate-800 mb-3 tracking-tight">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mb-4 text-slate-400"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <div className="normal-case">{platformName}</div>
        </div>
        <p className="text-slate-500 text-[15px] leading-relaxed font-normal">
          {mode === 'login'
            ? 'Sign in to access your medical learning assistants.'
            : 'Join thousands of medical students worldwide.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {mode === 'register' && (
          <div className="flex flex-col gap-2.5">
            <label htmlFor="name" className="text-[13px] font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Full Name</label>
            <input
              id="name"
              type="text"
              placeholder="e.g. Dr. John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className="px-4 py-3.5 border-[1.5px] border-slate-100 rounded-xl text-[15px] transition-all outline-none text-slate-900 bg-slate-50 focus:border-slate-400 focus:bg-white focus:shadow-[0_0_0_4px_rgba(148,163,184,0.1)] placeholder:text-slate-400 placeholder:opacity-70"
            />
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <label htmlFor="email" className="text-[13px] font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Email Address</label>
          <input
            id="email"
            type="email"
            placeholder="university@email.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="px-4 py-3.5 border-[1.5px] border-slate-100 rounded-xl text-[15px] transition-all outline-none text-slate-900 bg-slate-50 focus:border-slate-400 focus:bg-white focus:shadow-[0_0_0_4px_rgba(148,163,184,0.1)] placeholder:text-slate-400 placeholder:opacity-70"
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <label htmlFor="password" className="text-[13px] font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Password</label>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="px-4 py-3.5 border-[1.5px] border-slate-100 rounded-xl text-[15px] transition-all outline-none text-slate-900 bg-slate-50 focus:border-slate-400 focus:bg-white focus:shadow-[0_0_0_4px_rgba(148,163,184,0.1)] placeholder:text-slate-400 placeholder:opacity-70"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-3.5 py-3.5 rounded-xl text-sm font-medium animate-[shake_0.4s_cubic-bezier(.36,.07,.19,.97)_both] flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-slate-800 text-white px-3.5 py-3.5 border-0 rounded-xl text-base font-bold cursor-pointer transition-all mt-2.5 flex items-center justify-center gap-3 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] hover:bg-slate-900 hover:-translate-y-0.5 hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] active:translate-y-0 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
        >
          {loading ? (
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-10"></circle>
              <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
            </svg>
          ) : (
            <span>{mode === 'login' ? 'Continue' : 'Create Account'}</span>
          )}
        </button>
      </form>

      <div className="mt-8 text-center text-sm text-slate-500 border-t border-slate-100 pt-6">
        {mode === 'login' ? (
          <>
            New to the platform?
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); }}
              className="bg-transparent border-0 text-slate-600 font-bold cursor-pointer p-0 text-sm ml-2 transition-all border-b-2 border-transparent hover:text-slate-800 hover:border-slate-300"
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
              className="bg-transparent border-0 text-slate-600 font-bold cursor-pointer p-0 text-sm ml-2 transition-all border-b-2 border-transparent hover:text-slate-800 hover:border-slate-300"
            >
              Log in
            </button>
          </>
        )}
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
