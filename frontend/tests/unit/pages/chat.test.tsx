import { render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/router'
import Chat from '@/pages/chat'
import { supabase } from '@/lib/supabase'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}))

// Mock the supabase client
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signOut: jest.fn(),
    },
  },
}))

describe('Chat Page - Protected Route', () => {
  const mockPush = jest.fn()
  const mockRouter = {
    push: mockPush,
    pathname: '/chat',
    query: {},
    asPath: '/chat',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
  })

  it('redirects unauthenticated users to login page', async () => {
    const mockGetSession = supabase.auth.getSession as jest.Mock
    const mockOnAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock
    
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })
    
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    })

    render(<Chat />)
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  it('renders chat interface for authenticated users', async () => {
    const mockGetSession = supabase.auth.getSession as jest.Mock
    const mockOnAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock
    
    const mockUser = {
      id: '123',
      email: 'test@example.com',
      user_metadata: {
        name: 'Test User',
      },
    }
    
    mockGetSession.mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null,
    })
    
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    })

    render(<Chat />)
    
    await waitFor(() => {
      expect(screen.getByText('Medical AI Platform')).toBeInTheDocument()
      expect(screen.getByText('Welcome, Test User')).toBeInTheDocument()
      // Check for chat components instead of placeholder text
      expect(screen.getByText('Chat Sessions')).toBeInTheDocument()
      expect(screen.getByText('No messages yet. Start a conversation!')).toBeInTheDocument()
    })
    
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('displays email when name is not available', async () => {
    const mockGetSession = supabase.auth.getSession as jest.Mock
    const mockOnAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock
    
    const mockUser = {
      id: '123',
      email: 'test@example.com',
      user_metadata: {},
    }
    
    mockGetSession.mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null,
    })
    
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    })

    render(<Chat />)
    
    await waitFor(() => {
      expect(screen.getByText('Welcome, test@example.com')).toBeInTheDocument()
    })
  })

  it('redirects to login when auth state changes to unauthenticated', async () => {
    const mockGetSession = supabase.auth.getSession as jest.Mock
    const mockOnAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock
    
    const mockUser = {
      id: '123',
      email: 'test@example.com',
      user_metadata: { name: 'Test User' },
    }
    
    mockGetSession.mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null,
    })
    
    let authCallback: (event: string, session: any) => void
    mockOnAuthStateChange.mockImplementation((callback) => {
      authCallback = callback
      return {
        data: { subscription: { unsubscribe: jest.fn() } },
      }
    })

    render(<Chat />)
    
    await waitFor(() => {
      expect(screen.getByText('Welcome, Test User')).toBeInTheDocument()
    })
    
    // Simulate auth state change to logged out
    authCallback!('SIGNED_OUT', null)
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  it('shows loading state initially', () => {
    const mockGetSession = supabase.auth.getSession as jest.Mock
    const mockOnAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock
    
    mockGetSession.mockImplementation(() => new Promise(() => {})) // Never resolves
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    })

    render(<Chat />)
    
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('calls signOut and redirects when logout button is clicked', async () => {
    const mockGetSession = supabase.auth.getSession as jest.Mock
    const mockOnAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock
    const mockSignOut = supabase.auth.signOut as jest.Mock
    
    const mockUser = {
      id: '123',
      email: 'test@example.com',
      user_metadata: { name: 'Test User' },
    }
    
    mockGetSession.mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null,
    })
    
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    })
    
    mockSignOut.mockResolvedValue({ error: null })

    render(<Chat />)
    
    await waitFor(() => {
      expect(screen.getByText('Welcome, Test User')).toBeInTheDocument()
    })
    
    const logoutButton = screen.getByRole('button', { name: /logout/i })
    logoutButton.click()
    
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })
})
