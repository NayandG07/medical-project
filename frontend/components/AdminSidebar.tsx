import { useRouter } from 'next/router'

/**
 * Admin Sidebar Component
 * Navigation menu for admin panel
 * Requirements: 2.7, 13.7
 */
export default function AdminSidebar() {
  const router = useRouter()
  const currentPath = router.pathname

  const menuItems = [
    {
      label: 'Dashboard',
      path: '/admin',
      icon: '📊'
    },
    {
      label: 'User Management',
      path: '/admin/users',
      icon: '👥'
    },
    {
      label: 'API Keys',
      path: '/admin/api-keys',
      icon: '🔑'
    },
    {
      label: 'Model Usage',
      path: '/admin/model-usage',
      icon: '📈'
    },
    {
      label: 'Audit Logs',
      path: '/admin/audit-logs',
      icon: '📋'
    },
    {
      label: 'Feature Toggles',
      path: '/admin/features',
      icon: '🎛️'
    },
    {
      label: 'System Health',
      path: '/admin/health',
      icon: '💚',
      disabled: true
    },
    {
      label: 'Settings',
      path: '/admin/settings',
      icon: '⚙️'
    }
  ]

  const handleNavigation = (path: string, disabled?: boolean) => {
    if (!disabled) {
      router.push(path)
    }
  }

  return (
    <aside style={{
      width: '250px',
      backgroundColor: '#343a40',
      color: 'white',
      padding: '20px 0',
      overflow: 'auto'
    }}>
      <nav>
        <ul style={{
          listStyle: 'none',
          padding: 0,
          margin: 0
        }}>
          {menuItems.map((item) => {
            const isActive = currentPath === item.path
            const isDisabled = item.disabled

            return (
              <li key={item.path}>
                <button
                  onClick={() => handleNavigation(item.path, isDisabled)}
                  disabled={isDisabled}
                  style={{
                    width: '100%',
                    padding: '12px 20px',
                    backgroundColor: isActive ? '#495057' : 'transparent',
                    color: isDisabled ? '#6c757d' : 'white',
                    border: 'none',
                    borderLeft: isActive ? '4px solid #007bff' : '4px solid transparent',
                    textAlign: 'left',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '15px',
                    transition: 'background-color 0.2s',
                    opacity: isDisabled ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isDisabled && !isActive) {
                      e.currentTarget.style.backgroundColor = '#495057'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{item.icon}</span>
                  <span>{item.label}</span>
                  {isDisabled && (
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: '11px',
                      backgroundColor: '#6c757d',
                      padding: '2px 6px',
                      borderRadius: '3px'
                    }}>
                      Soon
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
