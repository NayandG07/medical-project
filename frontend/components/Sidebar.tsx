import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthUser } from '@/lib/supabase'

interface SidebarProps {
  user: AuthUser
  currentPath: string
}

export default function Sidebar({ user, currentPath }: SidebarProps) {
  const router = useRouter()

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

  return (
    <div style={{
      width: '240px',
      height: '100vh',
      backgroundColor: '#2c3e50',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      left: 0,
      top: 0,
      overflowY: 'auto'
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
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
          fontWeight: 'bold'
        }}>
          V
        </div>
        <span style={{ fontSize: '20px', fontWeight: 'bold' }}>Vaidya AI</span>
      </div>

      {/* Menu Items */}
      <nav style={{ flex: 1, padding: '20px 0' }}>
        {menuItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 20px',
              color: 'white',
              textDecoration: 'none',
              backgroundColor: isActive(item.path) ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              borderLeft: isActive(item.path) ? '3px solid #667eea' : '3px solid transparent',
              transition: 'all 0.2s ease',
              cursor: 'pointer'
            }}
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
            <span style={{ fontSize: '20px' }}>{item.icon}</span>
            <span style={{ fontSize: '15px' }}>{item.name}</span>
          </Link>
        ))}
      </nav>

      {/* User Profile */}
      <div style={{
        padding: '20px',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
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
            fontWeight: 'bold'
          }}>
            {user.email?.[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.email?.split('@')[0]}
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
      </div>
    </div>
  )
}
