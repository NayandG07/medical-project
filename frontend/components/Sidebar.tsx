import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthUser } from '@/lib/supabase'
import { ChevronLeft, Menu } from 'lucide-react'

interface SidebarProps {
  user: AuthUser | null
  currentPath: string
  collapsed?: boolean
  onToggle?: (collapsed: boolean) => void
  plan?: string
}

// Store collapsed state globally to persist across pages
let globalCollapsed = false

const getPlanLabel = (plan: string = 'free') => {
  const plans: Record<string, string> = {
    free: 'Standard Plan',
    student: 'Student Plan',
    pro: 'Premium Plan',
    premium: 'Premium Plan',
    admin: 'Admin'
  }
  return plans[plan.toLowerCase()] || 'Standard Plan'
}

export default function Sidebar({ user, currentPath, collapsed: controlledCollapsed, onToggle, plan = 'free' }: SidebarProps) {
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
    { name: 'Clinical Cases', path: '/clinical-cases', icon: '🏥' },
    { name: 'OSCE Simulator', path: '/osce', icon: '👨‍⚕️' },
    { name: 'Study Planner', path: '/study-planner', icon: '📅' },
    { name: 'Documents', path: '/documents', icon: '📄' },
    { name: 'Profile', path: '/profile', icon: '👤' },
  ]

  const isActive = (path: string) => currentPath === path
  const sidebarWidth = isCollapsed ? '70px' : '240px'

  return (
    <div className="sidebar-container" data-lenis-prevent>
      {/* Logo & Toggle */}
      <div className="sidebar-header">
        <div className="logo-section">
          <div className="logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          {!isCollapsed && <span className="logo-text">Vaidya AI</span>}
        </div>

        {!isCollapsed && (
          <button onClick={handleToggle} className="toggle-btn" title="Collapse sidebar">
            <ChevronLeft size={18} />
          </button>
        )}
      </div>

      {isCollapsed && (
        <button onClick={handleToggle} className="toggle-btn-collapsed" title="Expand sidebar">
          <Menu size={18} />
        </button>
      )}

      {/* Menu Items */}
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            passHref
            className="link-wrapper"
          >
            <div className={`nav-item ${isActive(item.path) ? 'active' : ''}`} title={isCollapsed ? item.name : undefined}>
              <span className="nav-icon">{item.icon}</span>
              {!isCollapsed && <span className="nav-label">{item.name}</span>}
            </div>
          </Link>
        ))}
      </nav>

      {/* User Area */}
      <div className="sidebar-footer">
        {isCollapsed ? (
          <div className="user-avatar-small">
            {user ? (user.user_metadata?.name || user.email)?.[0].toUpperCase() : '?'}
          </div>
        ) : (
          <div className="user-full-card">
            <div className="user-info-row">
              <div className="user-avatar">
                {user ? (user.user_metadata?.name || user.email)?.[0].toUpperCase() : '?'}
              </div>
              <div className="user-text">
                <p className="user-name">{user ? (user.user_metadata?.name || user.email?.split('@')[0]) : 'Loading...'}</p>
                <p className="user-subtext">{getPlanLabel(plan)}</p>
              </div>
            </div>

            {/* Token Meter Removed */}

            {/* Only show upgrade button for free users */}
            {plan.toLowerCase() === 'free' && (
              <button onClick={() => router.push('/upgrade')} className="upgrade-button">
                Upgrade Plan
              </button>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .sidebar-container {
          width: ${sidebarWidth};
          height: 100vh;
          background-color: #2C3238;
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          position: fixed;
          left: 0;
          top: 0;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 100;
          color: #E9ECEF;
        }

        .sidebar-header {
          padding: ${isCollapsed ? '20px 0' : '16px 20px'};
          display: flex;
          align-items: center;
          justify-content: ${isCollapsed ? 'center' : 'space-between'};
          min-height: 70px;
        }

        .logo-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        .logo-text {
          font-size: 18px;
          font-weight: 800;
          color: white;
          letter-spacing: -0.03em;
        }

        .toggle-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #ADB5BD;
          transition: all 0.2s;
        }

        .toggle-btn:hover {
          background-color: rgba(255, 255, 255, 0.1);
          color: white;
        }

        .toggle-btn-collapsed {
          margin: 10px auto;
          background: transparent;
          border: none;
          color: #ADB5BD;
          cursor: pointer;
          padding: 8px;
        }

        .sidebar-nav {
          flex: 1;
          padding: 8px 12px;
          overflow-y: auto;
          scrollbar-width: none;
        }

        .sidebar-nav::-webkit-scrollbar {
          display: none;
        }

        /* Ensure link wrapper doesn't break flex layout */
        :global(.link-wrapper) {
          text-decoration: none;
          display: block;
          width: 100%;
          margin-bottom: 2px;
        }

        .nav-item {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important; 
          gap: 12px;
          padding: ${isCollapsed ? '10px 0' : '10px 12px'};
          justify-content: ${isCollapsed ? 'center' : 'flex-start'};
          color: #ADB5BD;
          border-radius: 10px;
          transition: background-color 0.2s, color 0.2s;
          font-weight: 600;
          font-size: 13px;
          width: 100%;
          white-space: nowrap;
        }

        .nav-item:hover {
          background-color: rgba(255, 255, 255, 0.08);
          color: white;
        }

        .nav-item.active {
          background-color: rgba(255, 255, 255, 0.15);
          color: white;
        }

        .nav-icon {
          font-size: 16px;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .nav-label {
           white-space: nowrap;
        }

        .sidebar-footer {
          padding: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .user-avatar-small {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-color: #334155;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          margin: 0 auto;
        }

        .user-full-card {
           display: flex;
           flex-direction: column;
           gap: 10px;
        }

        .user-info-row {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 10px;
        }

        .user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #E9ECEF 0%, #ADB5BD 100%);
          color: #212529;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          flex-shrink: 0;
          font-size: 12px;
        }

        .user-text {
          display: flex;
          flex-direction: column;
        }

        .user-name {
          font-size: 13px;
          font-weight: 700;
          color: white;
          margin: 0;
          line-height: 1.2;
        }

        .user-subtext {
          font-size: 10px;
          color: #ADB5BD;
          margin: 0;
          font-weight: 600;
        }

/* Token Styles Removed */

        .upgrade-button {
          width: 100%;
          padding: 8px;
          background: linear-gradient(to right, #6366f1, #8b5cf6);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        .upgrade-button:hover {
          filter: brightness(1.1);
          box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
        }
      `}</style>
    </div>
  )
}

export { globalCollapsed }
