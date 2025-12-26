import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'
import AuthForm from '@/components/AuthForm'

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // User is logged in, redirect to chat
        router.push('/chat')
      } else {
        setLoading(false)
      }
    }

    checkUser()
  }, [router])

  const handleAuthSuccess = () => {
    router.push('/chat')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Medical AI Platform - Login</title>
        <meta name="description" content="AI-powered medical education platform" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1>Medical AI Platform</h1>
          <p>AI-powered medical education for students</p>
        </div>
        <AuthForm onSuccess={handleAuthSuccess} />
      </main>
    </>
  )
}
