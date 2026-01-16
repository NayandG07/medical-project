import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'
import AuthForm from '@/components/AuthForm'
import { motion } from 'framer-motion'
import Link from 'next/link'

export default function Login() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [platformName, setPlatformName] = useState('Vaidya AI')

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // User is logged in, redirect to dashboard
        router.push('/dashboard')
      } else {
        setLoading(false)
      }
    }

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

    checkUser()
    fetchSettings()
  }, [router])

  const handleAuthSuccess = () => {
    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--cream-bg)]">
        <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{platformName} - Sign In</title>
        <meta name="description" content="Access your advanced medical AI workspace" />
      </Head>

      <main className="min-h-screen flex relative overflow-hidden bg-[var(--cream-bg)]">
        {/* Background Decorative Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px] opacity-40 pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-100 rounded-full blur-[120px] opacity-40 pointer-events-none"></div>

        <div className="w-full flex flex-col items-center justify-center p-6 z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="w-full max-w-md"
          >
            {/* Logo removed as requested */}
            <div className="mb-4"></div>

            <AuthForm onSuccess={handleAuthSuccess} />

            <p className="mt-8 text-center text-sm text-[var(--cream-text-muted)]">
              By continuing, you agree to our <Link href="/terms" className="underline hover:text-black">Terms of Service</Link> and <Link href="/privacy" className="underline hover:text-black">Privacy Policy</Link>.
            </p>
          </motion.div>
        </div>
      </main>
    </>
  )
}
