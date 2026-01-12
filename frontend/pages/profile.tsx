import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Head from 'next/head'
import { motion } from 'framer-motion'
import { User, Mail, Shield, LogOut, Settings, ExternalLink, ChevronRight, Sparkles, Lock } from 'lucide-react'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import UserApiKeyForm from '../components/UserApiKeyForm'

/**
 * Redesigned Profile Page
 * Provides a premium, clean interface for user settings.
 */
export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentKey, setCurrentKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/')
        return
      }

      setUser(user as AuthUser)
      await fetchUserKey(user.id)
    } catch (err) {
      console.error('Error checking user:', err)
      setError('Failed to load user credentials')
    } finally {
      setLoading(false)
    }
  }

  const fetchUserKey = async (userId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/api-key`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentKey(data.has_key ? 'exists' : null)
      }
    } catch (err) {
      console.error('Error fetching user key:', err)
    }
  }

  const handleSubmitKey = async (key: string) => {
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/api-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ key })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to save API key')
    }

    setCurrentKey('exists')
  }

  const handleRemoveKey = async () => {
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/api-key`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to remove API key')
    }

    setCurrentKey(null)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0]
  const userInitials = userName?.[0]?.toUpperCase() || 'U'

  return (
    <>
      <Head>
        <title>Account Settings - Vaidya AI</title>
      </Head>
      <DashboardLayout user={user} loading={loading} loadingMessage="Preparing your profile...">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="profile-page-wrapper"
        >
          <div className="profile-layout-container">
            {/* Header Title */}
            <header className="page-header-top">
              <h1 className="page-title">Profile Settings</h1>
              <p className="page-subtitle">Manage your account preferences and API credentials.</p>
            </header>

            {error && (
              <div className="error-banner">
                <Shield size={18} className="error-icon" />
                <span>{error}</span>
              </div>
            )}

            <main className="profile-main-grid">
              {/* Left Column: Primary Settings */}
              <div className="grid-left-column">
                <section className="profile-section">
                  <div className="premium-card overview-card">
                    <div className="avatar-section">
                      <div className="user-avatar-circle">
                        {userInitials}
                      </div>
                      <div className="user-details-text">
                        <h2 className="user-name">{userName}</h2>
                        <p className="user-email-text">{user?.email}</p>
                      </div>
                    </div>
                    <div className="plan-badge-container">
                      <span className="premium-plan-pill">
                        <Sparkles size={14} />
                        {user?.user_metadata?.plan || 'Free Plan'}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="profile-section">
                  <UserApiKeyForm
                    currentKey={currentKey}
                    onSubmit={handleSubmitKey}
                    onRemove={handleRemoveKey}
                  />
                </section>
              </div>

              {/* Right Column: Meta & Actions */}
              <aside className="grid-right-column">
                <div className="sticky-sidebar">
                  <section className="sidebar-group">
                    <h3 className="sidebar-group-label">Account Details</h3>
                    <div className="sidebar-meta-stack">
                      <div className="premium-card side-meta-card">
                        <span className="meta-label">Subscription Status</span>
                        <div className="meta-value-row">
                          <span className="meta-value">Active</span>
                          <div className="status-indicator">
                            <span className="status-dot"></span>
                            <span className="status-pulse"></span>
                          </div>
                        </div>
                      </div>
                      <div className="premium-card side-meta-card">
                        <span className="meta-label">Member Since</span>
                        <div className="meta-value-row">
                          <span className="meta-value">
                            {user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '---'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="sidebar-group security-group">
                    <h3 className="sidebar-group-label">Security</h3>
                    <div className="premium-card security-compact-card">
                      <div className="security-badges">
                        <div className="security-badge">
                          <Shield size={13} />
                          <span>AES-256 Encrypted</span>
                        </div>
                        <div className="security-badge">
                          <Lock size={13} />
                          <span>Secure Session</span>
                        </div>
                      </div>
                      <p className="security-note">Securely log out of your active session on this device.</p>
                      <div className="security-action-container">
                        <button
                          onClick={() => setIsLogoutModalOpen(true)}
                          className="premium-logout-btn"
                        >
                          <LogOut size={16} />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              </aside>
            </main>

            {/* Premium Horizontal Footer */}
            <footer className="profile-footer-horizontal">
              <div className="footer-links-row">
                <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="footer-link-item">
                  Privacy Policy <ExternalLink size={12} />
                </Link>
                <div className="footer-divider" />
                <Link href="/terms" target="_blank" rel="noopener noreferrer" className="footer-link-item">
                  Terms of Service <ExternalLink size={12} />
                </Link>
                <div className="footer-divider" />
                <Link href="/contact" className="footer-link-item">
                  Contact Support <ExternalLink size={12} />
                </Link>
              </div>
              <p className="footer-copyright">© 2026 Vaidya AI. All rights reserved.</p>
            </footer>
          </div>
        </motion.div>

        {/* Improved Modal */}
        {isLogoutModalOpen && (
          <div className="modal-backdrop">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="premium-modal"
            >
              <div className="modal-header-icon-container">
                <div className="modal-icon-bg">
                  <LogOut size={24} />
                </div>
              </div>

              <h3 className="modal-title">Sign out of Vaidya AI?</h3>
              <p className="modal-message">You'll need to sign back in to access your dashboard and saved insights.</p>

              <div className="modal-button-group">
                <button onClick={handleSignOut} className="btn-confirm-premium">
                  Sign out
                </button>
                <button onClick={() => setIsLogoutModalOpen(false)} className="btn-cancel-premium">
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}

        <style jsx>{`
          .profile-page-wrapper {
            width: 100%;
            min-height: 100%;
            padding: 40px 32px 80px;
            background-color: #F9FAFB;
          }

          .profile-layout-container {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
          }

          .page-header-top {
            margin-bottom: 36px;
          }

          .page-title {
            font-size: 2.125rem;
            font-weight: 800;
            color: #111827;
            margin: 0;
            letter-spacing: -0.03em;
          }

          .page-subtitle {
            font-size: 1rem;
            color: #6B7280;
            margin-top: 6px;
          }

          .error-banner {
            padding: 14px 20px;
            background-color: #FEF2F2;
            color: #B91C1C;
            border: 1px solid #FEE2E2;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 0.875rem;
            font-weight: 600;
            margin-bottom: 32px;
            box-shadow: 0 2px 4px rgba(185, 28, 28, 0.05);
          }

          .profile-main-grid {
            display: grid;
            grid-template-columns: 1fr 380px;
            gap: 40px;
            align-items: stretch;
          }

          .profile-section {
            margin-bottom: 40px;
          }

          .profile-section:last-child {
            margin-bottom: 0;
          }

          /* Premium Card Base */
          .premium-card {
            background: white;
            border: 1px solid rgba(229, 231, 235, 0.9);
            border-radius: 16px;
            box-shadow: 
              0 1px 3px rgba(0, 0, 0, 0.02),
              0 4px 6px -1px rgba(0, 0, 0, 0.03),
              0 10px 15px -3px rgba(0, 0, 0, 0.03);
          }

          /* Overview Card */
          .overview-card {
            padding: 32px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .avatar-section {
            display: flex;
            align-items: center;
            gap: 24px;
          }

          .user-avatar-circle {
            width: 80px;
            height: 80px;
            border-radius: 24px;
            background: #4F46E5;
            background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 2rem;
            font-weight: 700;
            box-shadow: 0 10px 20px -5px rgba(79, 70, 229, 0.4);
          }

          .user-name {
            font-size: 1.625rem;
            font-weight: 800;
            color: #111827;
            margin: 0;
            letter-spacing: -0.02em;
          }

          .user-email-text {
            font-size: 1.0625rem;
            color: #6B7280;
            margin: 4px 0 0 0;
          }

          .premium-plan-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background-color: #F8FAFC;
            color: #374151;
            border-radius: 9999px;
            font-size: 0.875rem;
            font-weight: 700;
            border: 1px solid #E5E7EB;
          }

          .premium-plan-pill :global(svg) {
            color: #F59E0B;
          }

          /* Sidebar Styling - Adjusted for balance */
          .sticky-sidebar {
            position: sticky;
            top: 100px;
            display: flex;
            flex-direction: column;
            gap: 30px;
            height: 100%;
          }

          .sidebar-group-label {
            font-size: 0.75rem;
            font-weight: 800;
            text-transform: uppercase;
            color: #94A3B8;
            letter-spacing: 0.12em;
            margin: 0 0 12px 4px;
          }

          .sidebar-meta-stack {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .side-meta-card {
            padding: 28px 24px;
          }

          .meta-label {
            display: block;
            font-size: 0.8125rem;
            font-weight: 700;
            color: #94A3B8;
            margin-bottom: 12px;
          }

          .meta-value-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .meta-value {
            font-size: 1.25rem;
            font-weight: 800;
            color: #111827;
            letter-spacing: -0.01em;
          }

          /* Status Indicator */
          .status-indicator {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 12px;
            height: 12px;
          }

          .status-dot {
            width: 10px;
            height: 10px;
            background-color: #10B981;
            border-radius: 50%;
            z-index: 1;
          }

          .status-pulse {
            position: absolute;
            width: 100%;
            height: 100%;
            background-color: #10B981;
            border-radius: 50%;
            animation: pulse 2s infinite;
            opacity: 0.5;
          }

          @keyframes pulse {
            0% { transform: scale(1); opacity: 0.5; }
            70% { transform: scale(3); opacity: 0; }
            100% { transform: scale(1); opacity: 0; }
          }

          .security-group {
            display: block;
          }

          .security-compact-card {
            padding: 28px;
            display: flex;
            flex-direction: column;
          }

          .security-note {
            font-size: 0.9375rem;
            color: #6B7280;
            line-height: 1.6;
            margin: 0 0 28px 0;
          }

          .security-badges {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 20px;
          }

          .security-badge {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 8px 12px;
            background-color: #F0FDFA;
            color: #0F766E;
            border: 1px solid #CCFBF1;
            border-radius: 10px;
            font-size: 0.6875rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            width: 100%;
          }

          .premium-logout-btn {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 14px;
            background-color: #FFF1F2;
            color: #E11D48;
            border: 1px solid #FFE4E6;
            border-radius: 14px;
            font-size: 1rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .premium-logout-btn:hover {
            background-color: #FFE4E6;
            border-color: #FECACA;
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(225, 29, 72, 0.12);
          }

          /* Footer styling */
          .profile-footer-horizontal {
            margin-top: 80px;
            padding-top: 40px;
            border-top: 1px solid #E5E7EB;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
          }

          .footer-links-row {
            display: flex;
            align-items: center;
            gap: 32px;
          }

          .footer-divider {
            width: 4px;
            height: 4px;
            background-color: #D1D5DB;
            border-radius: 50%;
          }

          .footer-link-item {
            color: #9CA3AF;
            text-decoration: none;
            font-size: 0.875rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s;
          }

          .footer-link-item:hover {
            color: #4F46E5;
          }

          .footer-copyright {
            font-size: 0.8125rem;
            color: #9CA3AF;
            margin: 0;
            font-weight: 500;
          }

          /* Premium Modal */
          .premium-modal {
            background: white;
            width: 100%;
            max-width: 420px;
            border-radius: 24px;
            padding: 40px;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(229, 231, 235, 0.5);
          }

          .modal-header-icon-container {
            display: flex;
            justify-content: center;
            margin-bottom: 24px;
          }

          .modal-icon-bg {
            width: 64px;
            height: 64px;
            background-color: #FFF1F2;
            color: #E11D48;
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .modal-title {
            font-size: 1.5rem;
            font-weight: 800;
            color: #111827;
            margin: 0 0 12px 0;
            letter-spacing: -0.02em;
          }

          .modal-message {
            font-size: 1rem;
            color: #6B7280;
            margin: 0 0 32px 0;
            line-height: 1.6;
          }

          .modal-button-group {
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .btn-confirm-premium {
            padding: 14px;
            background-color: #E11D48;
            color: white;
            border: none;
            border-radius: 14px;
            font-size: 1rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(225, 29, 72, 0.2);
          }

          .btn-confirm-premium:hover {
            background-color: #BE123C;
            transform: translateY(-1px);
          }

          .btn-cancel-premium {
            padding: 14px;
            background-color: white;
            color: #4B5563;
            border: 1px solid #E5E7EB;
            border-radius: 14px;
            font-size: 1rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn-cancel-premium:hover {
            background-color: #F9FAFB;
            border-color: #D1D5DB;
          }

          @media (max-width: 1024px) {
            .profile-main-grid {
              grid-template-columns: 1fr;
              gap: 0;
            }

            .sticky-sidebar {
              position: static;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 32px;
            }

            .sidebar-group:last-child {
              grid-column: span 2;
            }

            .sidebar-meta-stack {
              flex-direction: row;
              gap: 20px;
            }

            .side-meta-card {
              flex: 1;
            }
          }

          @media (max-width: 768px) {
            .profile-page-wrapper {
              padding: 32px 20px;
            }

            .page-title {
              font-size: 1.75rem;
            }

            .sticky-sidebar {
              grid-template-columns: 1fr;
            }

            .sidebar-group:last-child {
              grid-column: span 1;
            }

            .sidebar-meta-stack {
              flex-direction: column;
            }

            .footer-links-row {
              flex-direction: column;
              gap: 16px;
            }

            .footer-divider {
              display: none;
            }
          }

          @media (max-width: 640px) {
            .profile-page-wrapper {
              padding: 20px 16px;
            }

            .overview-card {
              flex-direction: column;
              align-items: flex-start;
              padding: 20px;
              gap: 20px;
            }

            .avatar-section {
              width: 100%;
              gap: 16px;
            }

            .user-avatar-circle {
              width: 56px;
              height: 56px;
              font-size: 1.25rem;
              border-radius: 16px;
            }

            .user-name {
              font-size: 1.25rem;
            }

            .user-email-text {
              font-size: 0.875rem;
              word-break: break-all;
            }

            .plan-badge-container {
              width: 100%;
            }

            .premium-plan-pill {
              width: 100%;
              justify-content: center;
              background-color: #F3F4F6;
            }

            .sticky-sidebar {
              gap: 24px;
            }

            .side-meta-card, 
            .security-compact-card {
              padding: 20px;
            }
          }
        `}</style>
      </DashboardLayout>
    </>
  )
}