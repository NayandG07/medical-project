import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'
import AuthForm from '@/components/AuthForm'
import styles from '@/styles/Auth.module.css'

export default function Home() {
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
      <div className={styles.container}>
        <div className={styles.spinner} style={{ color: '#94a3b8' }}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.1"></circle>
            <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
          </svg>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{platformName} - Login</title>
        <meta name="description" content="Advanced Medical AI Platform" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className={styles.container}>
        <AuthForm onSuccess={handleAuthSuccess} />
      </main>
    </>
  )
}
