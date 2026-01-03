import { ReactNode, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'
import styles from '@/styles/Layout.module.css'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      setUser(session.user)
      // Check if admin
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/me`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
        if (response.ok) {
          const userData = await response.json()
          setIsAdmin(userData.role === 'super_admin' || userData.role === 'admin')
        }
      } catch (error) {
        console.error('Failed to check admin status:', error)
      }
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const isActive = (path: string) => router.pathname === path

  return (
    <div className={styles.container}>
      <nav className={styles.navbar}>
        <div className={styles.navContent}>
          <div className={styles.navBrand}>
            <Link href="/dashboard">
              <span className={styles.logo}>🏥 VaidyaAI</span>
            </Link>
          </div>

          <button 
            className={styles.mobileMenuBtn}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            ☰
          </button>

          <div className={`${styles.navLinks} ${mobileMenuOpen ? styles.navLinksOpen : ''}`}>
            <Link href="/dashboard" className={isActive('/dashboard') ? styles.active : ''}>
              Dashboard
            </Link>
            <Link href="/chat" className={isActive('/chat') ? styles.active : ''}>
              AI Chat
            </Link>
            <Link href="/study-tools/flashcards" className={isActive('/study-tools') ? styles.active : ''}>
              Study Tools
            </Link>
            <Link href="/documents" className={isActive('/documents') ? styles.active : ''}>
              Documents
            </Link>
            <Link href="/clinical" className={isActive('/clinical') ? styles.active : ''}>
              Clinical
            </Link>
            <Link href="/planner" className={isActive('/planner') ? styles.active : ''}>
              Planner
            </Link>
            {isAdmin && (
              <Link href="/admin" className={isActive('/admin') ? styles.active : ''}>
                Admin
              </Link>
            )}
          </div>

          <div className={styles.navRight}>
            <Link href="/profile" className={styles.profileBtn}>
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </Link>
            <button onClick={handleLogout} className={styles.logoutBtn}>
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
