import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AuthUser, supabase } from '@/lib/supabase'
import {
  X,
  Home,
  MessageSquare,
  Layers,
  CheckSquare,
  Star,
  BookOpen,
  Map,
  Brain,
  Stethoscope,
  FileText,
  User,
  LogOut,
  Crown,
  Menu,
  ChevronRight
} from 'lucide-react'

// Portal Helper Component
const Portal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!mounted) return null

  return createPortal(children, document.body)
}

interface MobileMenuProps {
  user: AuthUser | null
  currentPath: string
}

const menuItems = [
  { name: 'Dashboard', path: '/dashboard', icon: Home },
  { name: 'Chat', path: '/chat', icon: MessageSquare },
  { name: 'Flashcards', path: '/flashcards', icon: Layers },
  { name: 'MCQs', path: '/mcqs', icon: CheckSquare },
  { name: 'High Yield', path: '/highyield', icon: Star },
  { name: 'Explain', path: '/explain', icon: BookOpen },
  { name: 'Concept Map', path: '/conceptmap', icon: Map },
  { name: 'Clinical Reasoning', path: '/clinical-reasoning', icon: Brain },
  { name: 'OSCE', path: '/osce', icon: Stethoscope },
  { name: 'Documents', path: '/documents', icon: FileText },
  { name: 'Profile', path: '/profile', icon: User },
]

export default function MobileMenu({ user, currentPath }: MobileMenuProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await supabase.auth.signOut()
      router.push('/')
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setIsSigningOut(false)
      setIsOpen(false)
    }
  }

  const handleNavigation = (path: string) => {
    setIsOpen(false)
    router.push(path)
  }

  return (
    <>
      {/* Hamburger Button - Only visible on mobile */}
      <button
        className="hamburger-btn"
        onClick={() => setIsOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={24} />
      </button>

      {/* Mobile Menu Overlay - Rendered in Portal */}
      <Portal>
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="menu-backdrop"
                onClick={() => setIsOpen(false)}
              />

              {/* Menu Panel - Slides down from top */}
              <motion.div
                initial={{ y: '-100%' }}
                animate={{ y: 0 }}
                exit={{ y: '-100%' }}
                transition={{
                  type: 'spring',
                  damping: 30,
                  stiffness: 300,
                  mass: 0.8
                }}
                className="mobile-menu-panel"
              >
                {/* Fixed Header Section */}
                <div className="menu-header">
                  <div className="user-profile-section">
                    <div className="avatar">
                      <span>{(user?.user_metadata?.name || user?.email)?.[0]?.toUpperCase() || '?'}</span>
                    </div>
                    <div className="user-info">
                      <span className="user-name">
                        {user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'}
                      </span>
                      <span className="user-email">{user?.email || ''}</span>
                      {user?.user_metadata?.plan === 'Pro' ? (
                        <div className="user-badge pro">
                          <Crown size={12} fill="#B45309" stroke="#B45309" />
                          <span>PRO PLAN</span>
                        </div>
                      ) : user?.user_metadata?.plan === 'Student' ? (
                        <div className="user-badge student">STUDENT PLAN</div>
                      ) : (
                        <div className="user-badge free">FREE PLAN</div>
                      )}
                    </div>
                  </div>
                  <button
                    className="close-btn"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close menu"
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* Scrollable Navigation Section */}
                <nav className="menu-nav">
                  {menuItems.map((item) => {
                    const Icon = item.icon
                    const isActive = currentPath === item.path
                    return (
                      <button
                        key={item.path}
                        className={`nav-item ${isActive ? 'active' : ''}`}
                        onClick={() => handleNavigation(item.path)}
                      >
                        <div className={`icon-wrapper ${isActive ? 'active' : ''}`}>
                          <Icon size={20} />
                        </div>
                        <span className="item-name">{item.name}</span>
                        <div className="arrow-wrapper">
                          <ChevronRight size={18} opacity={isActive ? 1 : 0.3} />
                        </div>
                      </button>
                    )
                  })}
                </nav>

                {/* Fixed Footer Section */}
                <div className="menu-footer">
                  <button
                    className="upgrade-btn"
                    onClick={() => handleNavigation('/upgrade')}
                  >
                    <Crown size={20} />
                    <span>Upgrade to Pro</span>
                  </button>
                  <button
                    className="signout-btn"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                  >
                    <LogOut size={20} />
                    <span>{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
                  </button>

                  <div className="brand-footer">
                    <div className="brand-logo">V</div>
                    <div className="brand-text">
                      <p>VAIDYA AI SERVICES</p>
                      <span>VERSION 2.1 • PRE-ALFA</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </Portal>

      <style jsx>{`
        .hamburger-btn {
          display: none;
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          padding: 10px;
          cursor: pointer;
          color: #1E293B;
          border-radius: 12px;
          transition: all 0.2s;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .hamburger-btn:hover {
          background: #F1F5F9;
          transform: translateY(-1px);
        }

        @media (max-width: 768px) {
          .hamburger-btn {
            display: flex;
            align-items: center;
            justify-content: center;
          }
        }

        :global(.menu-backdrop) {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(8px);
          z-index: 99998;
        }

        :global(.mobile-menu-panel) {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          height: 100vh;
          height: 100dvh;
          background-color: #FDFBF7; /* Cream Background */
          background-image: 
            radial-gradient(at 0% 0%, rgba(255, 255, 255, 0.5) 0%, transparent 50%),
            radial-gradient(at 100% 100%, rgba(240, 242, 245, 0.5) 0%, transparent 50%);
          z-index: 99999;
          display: flex;
          flex-direction: column;
          box-shadow: none;
          overflow: hidden;
        }

        .menu-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 32px 24px;
          padding-top: max(32px, env(safe-area-inset-top));
          background: transparent;
          border-bottom: 1px solid rgba(0, 0, 0, 0.05);
          flex-shrink: 0;
        }

        .user-profile-section {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .avatar {
          width: 56px;
          height: 56px;
          border-radius: 18px;
          background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 22px;
          font-weight: 800;
          box-shadow: 0 8px 16px rgba(99, 102, 241, 0.25);
          border: 2px solid white;
        }

        .user-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .user-name {
          font-size: 18px;
          font-weight: 800;
          color: #0F172A;
          letter-spacing: -0.02em;
        }

        .user-email {
          font-size: 13px;
          color: #64748B;
          font-weight: 500;
        }

        .user-badge {
          align-self: flex-start;
          margin-top: 6px;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .user-badge.free {
          background: rgba(148, 163, 184, 0.15);
          color: #64748B;
        }

        .user-badge.student {
          background: rgba(99, 102, 241, 0.1);
          color: #6366F1;
        }

        .user-badge.pro {
          background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%);
          color: #B45309;
          border: 1px solid #FCD34D;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          box-shadow: 0 2px 4px rgba(251, 191, 36, 0.1);
        }

        .close-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          border: 1px solid rgba(0, 0, 0, 0.05);
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748B;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }

        .close-btn:hover {
          background: #F1F5F9;
          color: #0F172A;
          transform: rotate(90deg);
        }

        .menu-nav {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 14px 16px;
          border: none;
          background: transparent;
          border-radius: 16px;
          color: #475569;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
          width: 100%;
          position: relative;
        }

        .nav-item:active {
          transform: scale(0.98);
        }

        .icon-wrapper {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #F1F5F9;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748B;
          transition: all 0.2s;
        }

        .icon-wrapper.active {
          background: rgba(99, 102, 241, 0.1);
          color: #6366F1;
          box-shadow: 0 2px 4px rgba(99, 102, 241, 0.1);
        }

        .item-name {
          flex: 1;
        }

        .nav-item.active {
          background: white;
          color: #6366F1;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
          font-weight: 700;
        }

        .arrow-wrapper {
          color: #94A3B8;
        }

        .menu-footer {
          padding: 24px;
          padding-bottom: max(24px, env(safe-area-inset-bottom));
          background: white;
          border-top: 1px solid rgba(0, 0, 0, 0.05);
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: 0 -10px 25px rgba(0, 0, 0, 0.02);
          flex-shrink: 0;
        }

        .upgrade-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 16px;
          background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
          color: white;
          border: none;
          border-radius: 16px;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 10px 20px rgba(99, 102, 241, 0.25);
          transition: all 0.3s;
        }

        .upgrade-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 30px rgba(99, 102, 241, 0.35);
        }

        .signout-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 16px;
          background: #FFF1F2;
          color: #E11D48;
          border: 1px solid rgba(225, 29, 72, 0.1);
          border-radius: 16px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .signout-btn:hover {
          background: #FFE4E6;
          color: #BE123C;
        }

        .signout-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .brand-footer {
            margin-top: 6px;
            display: flex;
            align-items: center;
            justify-content: center; /* Center horizontally */
            gap: 10px;
            padding: 0 4px;
        }

        .brand-logo {
            width: 28px;
            height: 28px;
            background: #0F172A;
            color: white;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 12px;
        }

        .brand-text {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
        }

        .brand-text p {
            font-size: 11px;
            font-weight: 900;
            color: #0F172A;
            margin: 0;
            letter-spacing: 0.05em;
        }

        .brand-text span {
            font-size: 9px;
            color: #94A3B8;
            font-weight: 700;
            letter-spacing: 0.02em;
        }
      `}</style>
    </>
  )
}
