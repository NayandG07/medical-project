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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)

  const handleSidebarToggle = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed)
    globalSidebarCollapsed = collapsed
  }

  const handleSignOut = async () => {
    const { supabase } = await import('@/lib/supabase')
    await supabase.auth.signOut()
    router.push('/')
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('#user-profile-menu')) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('click', handleClickOutside)
    }

    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [isDropdownOpen])

  const sidebarWidth = sidebarCollapsed ? '70px' : '240px'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#fdfbf7' }}>
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
          <h1 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#1e293b', letterSpacing: '-0.025em' }}>
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

            <div id="user-profile-menu" style={{ position: 'relative' }}>
              <div
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '8px',
                  transition: 'background-color 0.2s',
                  backgroundColor: isDropdownOpen ? '#f1f5f9' : 'transparent'
                }}
              >
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 'bold'
                }}>
                  {user.email?.[0].toUpperCase()}
                </div>
                <div className="user-info-desktop">
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                    {user.user_metadata?.name || user.email?.split('@')[0]}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '500' }}>
                    {user.user_metadata?.plan || 'Free Plan'}
                  </div>
                </div>
              </div>

              {isDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '115%',
                  right: 0,
                  width: '185px',
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(15, 23, 42, 0.08)',
                  padding: '5px',
                  zIndex: 100,
                  animation: 'fadeIn 0.2s ease-out',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid #f1f5f9',
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px 12px 4px 4px'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#475569',
                      fontSize: '12px',
                      fontWeight: '800',
                      border: '1px solid #e2e8f0'
                    }}>
                      {(user.user_metadata?.name || user.email)?.[0].toUpperCase()}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user.user_metadata?.name || user.email?.split('@')[0]}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user.email}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsDropdownOpen(false)
                      router.push('/profile')
                    }}
                    id="profile-button"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      borderRadius: '10px',
                      color: '#475569',
                      fontSize: '13px',
                      fontWeight: '600',
                      transition: 'all 0.2s'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Profile
                  </button>

                  <button
                    onClick={() => {
                      setIsDropdownOpen(false)
                      setIsLogoutModalOpen(true)
                    }}
                    id="signout-button"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      borderRadius: '10px',
                      color: '#475569',
                      fontSize: '13px',
                      fontWeight: '600',
                      transition: 'all 0.2s'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content - Reduced padding */}
        <main style={{ padding: router.pathname === '/chat' ? 0 : '24px' }}>
          {children}
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            backgroundColor: 'white',
            width: '90%',
            maxWidth: '360px',
            borderRadius: '20px',
            padding: '32px',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              backgroundColor: '#fef2f2',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              color: '#ef4444'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>

            <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>
              Sign out?
            </h3>
            <p style={{ fontSize: '15px', color: '#64748b', marginBottom: '28px', lineHeight: '1.5' }}>
              Are you sure you want to sign out of your account?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={handleSignOut}
                id="modal-signout-button"
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                Sign out
              </button>
              <button
                onClick={() => setIsLogoutModalOpen(false)}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: 'white',
                  color: '#475569',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        #signout-button:hover {
          background-color: #fef2f2 !important;
          color: #ef4444 !important;
        }
        #profile-button:hover {
          background-color: #f8fafc !important;
          color: #1e293b !important;
        }
        #modal-signout-button:hover {
          background-color: #dc2626 !important;
        }
        .user-info-desktop {
          display: none;
        }
        @media (min-width: 640px) {
          .user-info-desktop {
            display: block;
          }
        }
      `}</style>
    </div>
  )
}
