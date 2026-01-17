import { ReactNode, useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { AuthUser, supabase } from '@/lib/supabase'
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
    '/clinical-cases': 'Clinical Cases',
    '/osce-simulator': 'OSCE Simulator',
    '/clinical-reasoning': 'Clinical Reasoning',
    '/osce': 'OSCE Station',
    '/study-planner': 'Study Planner',
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
  const [plan, setPlan] = useState<string>(user.user_metadata?.plan || 'free')

  useEffect(() => {
    const fetchUserPlan = async () => {
      try {
        const { data } = await supabase
          .from('users')
          .select('plan')
          .eq('id', user.id)
          .single()

        if (data?.plan) {
          setPlan(data.plan)
        }
      } catch (error) {
        console.error('Error fetching user plan:', error)
      }
    }

    if (user?.id) {
      fetchUserPlan()
    }
  }, [user.id])

  const handleSidebarToggle = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed)
    globalSidebarCollapsed = collapsed
  }

  const handleSignOut = async () => {
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
    <div className="layout-root">
      <Sidebar
        user={user}
        currentPath={router.pathname}
        collapsed={sidebarCollapsed}
        onToggle={handleSidebarToggle}
        plan={plan}
      />

      <div className="main-content-wrapper" style={{ marginLeft: sidebarWidth }}>
        {/* Top Bar */}
        <div className="top-bar">
          <div className="breadcrumb-section">
            <h1 className="page-title">{getPageTitle(router.pathname)}</h1>
          </div>

          <div className="actions-section">
            <button className="icon-action-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>

            <div id="user-profile-menu" className="relative">
              <div
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`profile-trigger ${isDropdownOpen ? 'active' : ''}`}
              >
                <div className="avatar-mini">
                  {user.email?.[0].toUpperCase()}
                </div>
                <div className="user-meta hidden sm:block">
                  <p className="user-full-name">{user.user_metadata?.name || user.email?.split('@')[0]}</p>
                  <p className="user-plan-badge">
                    {plan === 'free' ? 'Standard' : plan === 'pro' ? 'Premium' : plan.charAt(0).toUpperCase() + plan.slice(1)}
                  </p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`arrow-icon ${isDropdownOpen ? 'rotate-180' : ''}`}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>

              {isDropdownOpen && (
                <div className="dropdown-menu">
                  <div className="dropdown-header">
                    <div className="avatar-medium">{user.email?.[0].toUpperCase()}</div>
                    <div className="header-meta">
                      <p className="header-name">{user.user_metadata?.name || user.email?.split('@')[0]}</p>
                      <p className="header-email">{user.email}</p>
                    </div>
                  </div>

                  <div className="dropdown-links">
                    <button onClick={() => { setIsDropdownOpen(false); router.push('/profile'); }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                      Profile Settings
                    </button>
                    <button onClick={() => { setIsDropdownOpen(false); setIsLogoutModalOpen(true); }} className="logout-btn">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <main className={`main-scroll-area ${router.pathname === '/chat' ? 'no-padding' : ''}`}>
          {children}
        </main>
      </div>

      {/* Logout Modal */}
      {isLogoutModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>
            <h2>Sign out?</h2>
            <p>Ready to wrap up your clinical session? We'll save your progress.</p>
            <div className="modal-actions">
              <button onClick={handleSignOut} className="confirm-btn">Log out</button>
              <button onClick={() => setIsLogoutModalOpen(false)} className="cancel-btn">Stay Logged In</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .layout-root {
          display: flex;
          min-height: 100vh;
          background-color: var(--cream-bg);
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        .main-content-wrapper {
          flex: 1;
          transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .top-bar {
          height: 64px;
          background-color: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          box-shadow: 0 2px 15px -3px rgba(0, 0, 0, 0.02);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .page-title {
          font-size: 18px;
          font-weight: 800;
          color: var(--cream-text-main);
          letter-spacing: -0.02em;
          margin: 0;
          background: linear-gradient(135deg, #1F2937 0%, #4B5563 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .actions-section {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .icon-action-btn {
          background: white;
          border: 1px solid rgba(0, 0, 0, 0.1);
          width: 44px;
          height: 44px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--cream-text-muted);
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
        }

        .icon-action-btn:hover {
          background-color: white;
          color: var(--cream-text-main);
          border-color: var(--cream-accent);
          transform: translateY(-1px);
        }

        .profile-trigger {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 6px 14px 6px 6px;
          background: white;
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
        }

        .profile-trigger:hover, .profile-trigger.active {
          border-color: var(--cream-accent);
          background-color: white;
          transform: translateY(-1px);
        }

        .user-meta {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .avatar-mini {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #E8D9C0 0%, #D4C3A9 100%);
          color: var(--cream-text-main);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 14px;
          box-shadow: 0 2px 8px rgba(232, 217, 192, 0.4);
        }

        .user-full-name {
          font-size: 13px;
          font-weight: 700;
          color: var(--cream-text-main);
          margin: 0;
          max-width: 130px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
        }

        .user-badge-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .user-plan-badge {
          font-size: 10px;
          font-weight: 800;
          color: #8B5CF6;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0;
          background: rgba(139, 92, 246, 0.1);
          padding: 3px 8px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }

        .arrow-icon {
          color: var(--cream-text-muted);
          transition: transform 0.2s;
        }

        .arrow-icon.rotate-180 {
          transform: rotate(180deg);
        }

        .dropdown-menu {
          position: absolute;
          top: calc(100% + 12px);
          right: 0;
          width: 280px;
          background-color: white;
          border-radius: 24px;
          box-shadow: 0 20px 40px -8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04);
          border: 1px solid rgba(0, 0, 0, 0.08);
          overflow: hidden;
          animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .dropdown-header {
          padding: 24px 20px;
          background-color: var(--cream-bg);
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        }

        .avatar-medium {
          width: 48px;
          height: 48px;
          min-width: 48px;
          flex-shrink: 0;
          background: linear-gradient(135deg, #E8D9C0 0%, #D4C3A9 100%);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 18px;
        }

        .header-name {
          font-size: 15px;
          font-weight: 800;
          margin: 0;
          color: var(--cream-text-main);
          max-width: 160px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .header-email {
          font-size: 12px;
          color: var(--cream-text-muted);
          margin: 2px 0 0 0;
          font-weight: 600;
          max-width: 160px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dropdown-links {
          padding: 12px;
        }

        .dropdown-links button {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border: none;
          background: transparent;
          color: var(--cream-text-muted);
          font-size: 14px;
          font-weight: 700;
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .dropdown-links button:hover {
          background-color: var(--cream-bg);
          color: var(--cream-text-main);
        }

        .dropdown-links button.logout-btn:hover {
          background-color: #FFF5F5;
          color: #EA4335;
        }

        .main-scroll-area {
          flex: 1;
          padding: 40px;
          overflow-y: auto;
        }

        .main-scroll-area.no-padding {
          padding: 0;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          background-color: rgba(26, 26, 26, 0.4);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: #FFFFFF;
          width: 100%;
          max-width: 420px;
          border-radius: 32px;
          padding: 48px;
          text-align: center;
          box-shadow: 0 48px 96px -24px rgba(0,0,0,0.25);
          border: 1px solid rgba(0, 0, 0, 0.05);
        }

        .modal-icon {
          width: 72px;
          height: 72px;
          background-color: #FFF5F5;
          color: #EA4335;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 28px;
        }

        .modal-content h2 {
          font-size: 26px;
          font-weight: 800;
          margin-bottom: 14px;
          letter-spacing: -0.03em;
          color: var(--cream-text-main);
        }

        .modal-content p {
          color: var(--cream-text-muted);
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 36px;
          font-weight: 500;
        }

        .modal-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .confirm-btn {
          background-color: #333333;
          color: white;
          border: none;
          padding: 16px;
          border-radius: 18px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s;
        }

        .confirm-btn:hover {
          background-color: #1A1A1A;
          transform: translateY(-1px);
        }

        .cancel-btn {
          background-color: var(--cream-bg);
          border: 1px solid rgba(0, 0, 0, 0.05);
          padding: 14px;
          border-radius: 18px;
          font-weight: 700;
          color: var(--cream-text-main);
          cursor: pointer;
          transition: all 0.2s;
        }

        .cancel-btn:hover {
          background-color: white;
          border-color: var(--cream-accent);
        }
      `}</style>
    </div>
  )
}
