import { ReactNode, useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { AuthUser } from '@/lib/supabase'
import Sidebar from './Sidebar'

interface DashboardLayoutProps {
  user: AuthUser
  children: ReactNode
}

// Get page title from path
const getPageTitle = (pathname: string): string => {
  const titles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/chat': 'Chat',
    '/flashcards': 'Flashcards',
    '/mcqs': 'MCQs',
    '/highyield': 'High Yield',
    '/explain': 'Explain',
    '/conceptmap': 'Concept Map',
    '/clinical-reasoning': 'Clinical Reasoning',
    '/osce': 'OSCE',
    '/documents': 'Documents',
    '/profile': 'Profile',
  }
  return titles[pathname] || pathname.slice(1).charAt(0).toUpperCase() + pathname.slice(2)
}

// Store sidebar state globally
let globalSidebarCollapsed = false

export default function DashboardLayout({ user, children }: DashboardLayoutProps) {
  const router = useRouter()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(globalSidebarCollapsed)

  const handleSidebarToggle = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed)
    globalSidebarCollapsed = collapsed
  }

  const sidebarWidth = sidebarCollapsed ? '70px' : '240px'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <Sidebar 
        user={user} 
        currentPath={router.pathname} 
        collapsed={sidebarCollapsed}
        onToggle={handleSidebarToggle}
      />
      
      <div style={{ 
        marginLeft: sidebarWidth, 
        flex: 1,
        transition: 'margin-left 0.2s ease',
        minWidth: 0
      }}>
        {/* Top Bar - Compact */}
        <div style={{
          height: '56px',
          backgroundColor: 'white',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 50
        }}>
          <h1 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#1e293b' }}>
            {getPageTitle(router.pathname)}
          </h1>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              color: '#6b7280',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              🔔
            </button>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer'
            }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: '#667eea',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '13px',
                fontWeight: 'bold'
              }}>
                {user.email?.[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>
                  {user.email?.split('@')[0]}
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>
                  {user.user_metadata?.plan || 'Free'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Reduced padding */}
        <main style={{ padding: '20px 24px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
