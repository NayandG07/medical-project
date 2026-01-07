import { ReactNode } from 'react'
import { useRouter } from 'next/router'
import { AuthUser } from '@/lib/supabase'
import Sidebar from './Sidebar'

interface DashboardLayoutProps {
  user: AuthUser
  children: ReactNode
}

export default function DashboardLayout({ user, children }: DashboardLayoutProps) {
  const router = useRouter()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <Sidebar user={user} currentPath={router.pathname} />
      
      <div style={{ marginLeft: '240px', flex: 1 }}>
        {/* Top Bar */}
        <div style={{
          height: '60px',
          backgroundColor: 'white',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 30px',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
            {router.pathname === '/dashboard' ? 'Dashboard' : 
             router.pathname.slice(1).charAt(0).toUpperCase() + router.pathname.slice(2)}
          </h1>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '20px',
              color: '#6b7280'
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
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#667eea',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '14px',
                fontWeight: 'bold'
              }}>
                {user.email?.[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>
                  {user.email?.split('@')[0]}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {user.user_metadata?.plan || 'Free'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main style={{ padding: '30px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
