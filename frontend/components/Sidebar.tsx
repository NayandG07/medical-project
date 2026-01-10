import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthUser } from '@/lib/supabase'

interface SidebarProps {
  user: AuthUser
  currentPath: string
  collapsed?: boolean
  onToggle?: (collapsed: boolean) => void
}

// Store collapsed state globally to persist across pages
let globalCollapsed = false

export default function Sidebar({ user, currentPath, collapsed: controlledCollapsed, onToggle }: SidebarProps) {
  const router = useRouter()
  const [isCollapsed, setIsCollapsed] = useState(globalCollapsed)

  // Sync with controlled prop if provided
  useEffect(() => {
    if (controlledCollapsed !== undefined) {
      setIsCollapsed(controlledCollapsed)
    }
  }, [controlledCollapsed])

  const handleToggle = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    globalCollapsed = newState
    onToggle?.(newState)
  }

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: '🏠' },
    { name: 'Chat', path: '/chat', icon: '💬' },
    { name: 'Flashcards', path: '/flashcards', icon: '🎴' },
    { name: 'MCQs', path: '/mcqs', icon: '✓' },
    { name: 'High Yield', path: '/highyield', icon: '⭐' },
    { name: 'Explain', path: '/explain', icon: '📚' },
    { name: 'Concept Map', path: '/conceptmap', icon: '🗺️' },
    { name: 'Clinical Reasoning', path: '/clinical-reasoning', icon: '🧠' },
    { name: 'OSCE', path: '/osce', icon: '👨‍⚕️' },
    { name: 'Documents', path: '/documents', icon: '📄' },
    { name: 'Profile', path: '/profile', icon: '👤' },
  ]

  const isActive = (path: string) => currentPath === path
  const sidebarWidth = isCollapsed ? '70px' : '240px'

  return (
    <div style={{
      width: sidebarWidth,
      height: '100vh',
      backgroundColor: '#2c3e50',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      left: 0,
      top: 0,
      overflow: 'hidden', // Hide main scrollbar
      transition: 'width 0.2s ease',
      zIndex: 100
    }} data-lenis-prevent>
      {/* Logo & Toggle */}
      <div style={{
        padding: isCollapsed ? '20px 0' : '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        gap: '10px',
        minHeight: '72px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: 'bold',
            flexShrink: 0
          }}>
            V
          </div>
          {!isCollapsed && (
            <span style={{ fontSize: '20px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Vaidya AI</span>
          )}
        </div>

        {!isCollapsed && (
          <button
            onClick={handleToggle}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 8px',
              cursor: 'pointer',
              color: 'white',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Collapse sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 3v18" />
              <path d="m14 9-3 3 3 3" />
            </svg>
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {isCollapsed && (
        <button
          onClick={handleToggle}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '6px',
            padding: '8px',
            margin: '10px auto',
            cursor: 'pointer',
            color: 'white',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px'
          }}
          title="Expand sidebar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      )}

      {/* Menu Items - Scrollable Middle Section */}
      <nav style={{
        flex: 1,
        padding: '10px 0',
        overflowY: 'auto',
        scrollbarWidth: 'none', // Firefox
        msOverflowStyle: 'none', // IE/Edge
      }}>
        {/* Hide scrollbar for Chrome/Safari */}
        <style jsx>{`
          nav::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {menuItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: isCollapsed ? '12px 0' : '12px 20px',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              color: 'white',
              textDecoration: 'none',
              backgroundColor: isActive(item.path) ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              borderLeft: isActive(item.path) ? '3px solid #667eea' : '3px solid transparent',
              transition: 'all 0.2s ease',
              cursor: 'pointer'
            }}
            title={isCollapsed ? item.name : undefined}
            onMouseEnter={(e) => {
              if (!isActive(item.path)) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive(item.path)) {
                e.currentTarget.style.backgroundColor = 'transparent'
              }
            }}
          >
            <span style={{ fontSize: '20px', flexShrink: 0 }}>{item.icon}</span>
            {!isCollapsed && <span style={{ fontSize: '15px', whiteSpace: 'nowrap' }}>{item.name}</span>}
          </Link>
        ))}
      </nav>

      {/* User Profile - simplified when collapsed */}
      <div style={{
        padding: isCollapsed ? '15px 10px' : '20px',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        {isCollapsed ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#667eea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              {(user.user_metadata?.name || user.email)?.[0].toUpperCase()}
            </div>
          </div>
        ) : (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '15px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#667eea',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 'bold',
                flexShrink: 0
              }}>
                {(user.user_metadata?.name || user.email)?.[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.user_metadata?.name || user.email?.split('@')[0]}
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
                  Tokens: 1,520
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.6)',
              marginBottom: '10px'
            }}>
              <span>Tokens: 1,520</span>
              <span>2,000k Remaining</span>
            </div>

            <div style={{
              height: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '3px',
              overflow: 'hidden',
              marginBottom: '15px'
            }}>
              <div style={{
                height: '100%',
                width: '76%',
                background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '3px'
              }} />
            </div>

            <button
              onClick={() => router.push('/upgrade')}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#5568d3'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#667eea'
              }}
            >
              Upgrade →
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export { globalCollapsed }
