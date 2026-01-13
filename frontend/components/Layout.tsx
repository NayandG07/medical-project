import { ReactNode, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'

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
    <div className="min-h-screen flex flex-col">
      <nav className="bg-gradient-to-br from-medical-indigo to-medical-purple text-white p-0 shadow-md sticky top-0 z-[100]">
        <div className="max-w-[1400px] mx-auto px-8 py-4 flex items-center justify-between">
          <div className="text-2xl font-bold">
            <Link href="/dashboard">
              <span className="cursor-pointer transition-opacity hover:opacity-80">🏥 VaidyaAI</span>
            </Link>
          </div>

          <button 
            className="hidden md:hidden bg-transparent border-0 text-white text-2xl cursor-pointer max-md:block"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            ☰
          </button>

          <div className={`flex gap-8 items-center max-md:absolute max-md:top-full max-md:left-0 max-md:right-0 max-md:bg-gradient-to-br max-md:from-medical-indigo max-md:to-medical-purple max-md:flex-col max-md:p-4 max-md:gap-2 ${mobileMenuOpen ? 'max-md:flex' : 'max-md:hidden'}`}>
            <Link href="/dashboard" className={`text-white no-underline px-4 py-2 rounded-lg transition-colors font-medium ${isActive('/dashboard') ? 'bg-white/20' : 'hover:bg-white/10'}`}>
              Dashboard
            </Link>
            <Link href="/chat" className={`text-white no-underline px-4 py-2 rounded-lg transition-colors font-medium ${isActive('/chat') ? 'bg-white/20' : 'hover:bg-white/10'}`}>
              AI Chat
            </Link>
            <Link href="/study-tools/flashcards" className={`text-white no-underline px-4 py-2 rounded-lg transition-colors font-medium ${isActive('/study-tools') ? 'bg-white/20' : 'hover:bg-white/10'}`}>
              Study Tools
            </Link>
            <Link href="/documents" className={`text-white no-underline px-4 py-2 rounded-lg transition-colors font-medium ${isActive('/documents') ? 'bg-white/20' : 'hover:bg-white/10'}`}>
              Documents
            </Link>
            <Link href="/clinical" className={`text-white no-underline px-4 py-2 rounded-lg transition-colors font-medium ${isActive('/clinical') ? 'bg-white/20' : 'hover:bg-white/10'}`}>
              Clinical
            </Link>
            <Link href="/planner" className={`text-white no-underline px-4 py-2 rounded-lg transition-colors font-medium ${isActive('/planner') ? 'bg-white/20' : 'hover:bg-white/10'}`}>
              Planner
            </Link>
            {isAdmin && (
              <Link href="/admin" className={`text-white no-underline px-4 py-2 rounded-lg transition-colors font-medium ${isActive('/admin') ? 'bg-white/20' : 'hover:bg-white/10'}`}>
                Admin
              </Link>
            )}
          </div>

          <div className="flex gap-4 items-center max-md:gap-2">
            <Link href="/profile" className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold cursor-pointer transition-colors no-underline text-white hover:bg-white/30">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </Link>
            <button onClick={handleLogout} className="bg-white/20 text-white border-0 px-6 py-2 rounded-lg cursor-pointer font-medium transition-colors hover:bg-white/30 max-md:px-4 max-md:text-sm">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 bg-[#f5f7fa]">
        {children}
      </main>
    </div>
  )
}
