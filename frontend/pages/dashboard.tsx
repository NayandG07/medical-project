import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'
import styles from '@/styles/Dashboard.module.css'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [usage, setUsage] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/')
      return
    }
    setUser(session.user)
    await fetchUsage(session.access_token)
    setLoading(false)
  }

  const fetchUsage = async (token: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/usage`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setUsage(data)
      }
    } catch (error) {
      console.error('Failed to fetch usage:', error)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className={styles.loading}>Loading...</div>
      </Layout>
    )
  }

  const features = [
    {
      title: 'AI Chat',
      description: 'Chat with your AI medical tutor for instant help',
      icon: '💬',
      link: '/chat',
      color: '#667eea'
    },
    {
      title: 'Flashcards',
      description: 'Generate flashcards for any medical topic',
      icon: '🎴',
      link: '/study-tools/flashcards',
      color: '#f093fb'
    },
    {
      title: 'MCQ Practice',
      description: 'Practice with AI-generated multiple choice questions',
      icon: '📝',
      link: '/mcqs',
      color: '#4facfe'
    },
    {
      title: 'High-Yield Notes',
      description: 'Get concise high-yield summary points',
      icon: '⭐',
      link: '/study-tools?tool=highyield',
      color: '#43e97b'
    },
    {
      title: 'Concept Maps',
      description: 'Visualize relationships between medical concepts',
      icon: '🗺️',
      link: '/study-tools/conceptmap',
      color: '#fa709a'
    },
    {
      title: 'Explanations',
      description: 'Get detailed explanations of complex topics',
      icon: '📚',
      link: '/study-tools?tool=explain',
      color: '#fee140'
    },
    {
      title: 'Clinical Reasoning',
      description: 'Practice clinical case scenarios',
      icon: '🏥',
      link: '/clinical?mode=reasoning',
      color: '#30cfd0'
    },
    {
      title: 'OSCE Simulator',
      description: 'Simulate OSCE examinations',
      icon: '👨‍⚕️',
      link: '/clinical?mode=osce',
      color: '#a8edea'
    },
    {
      title: 'Documents',
      description: 'Upload PDFs and chat with your documents',
      icon: '📄',
      link: '/documents',
      color: '#ff9a9e'
    },
    {
      title: 'Study Planner',
      description: 'Plan and track your study sessions',
      icon: '📅',
      link: '/planner',
      color: '#fbc2eb'
    }
  ]

  return (
    <Layout>
      <Head>
        <title>Dashboard - VaidyaAI</title>
      </Head>

      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Welcome back, {user?.user_metadata?.name || user?.email?.split('@')[0]}! 👋</h1>
          <p>Your AI-powered medical education companion</p>
        </div>

        {usage && (
          <div className={styles.usageCard}>
            <h3>Today's Usage</h3>
            <div className={styles.usageStats}>
              <div className={styles.stat}>
                <span className={styles.statValue}>{usage.requests_count || 0}</span>
                <span className={styles.statLabel}>Requests</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{usage.tokens_used || 0}</span>
                <span className={styles.statLabel}>Tokens</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{usage.mcqs_generated || 0}</span>
                <span className={styles.statLabel}>MCQs</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{usage.flashcards_generated || 0}</span>
                <span className={styles.statLabel}>Flashcards</span>
              </div>
            </div>
          </div>
        )}

        <div className={styles.featuresGrid}>
          {features.map((feature, index) => (
            <Link href={feature.link} key={index}>
              <div 
                className={styles.featureCard}
                style={{ borderTop: `4px solid ${feature.color}` }}
              >
                <div className={styles.featureIcon}>{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className={styles.quickTips}>
          <h3>💡 Quick Tips</h3>
          <ul>
            <li>Use study tools to generate flashcards, MCQs, and concept maps</li>
            <li>Upload your lecture PDFs to get personalized answers</li>
            <li>Practice clinical cases to improve diagnostic thinking</li>
            <li>Plan your study sessions for better time management</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}
