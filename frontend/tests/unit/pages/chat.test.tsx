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

// Mock global fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([]),
  })
) as jest.Mock

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
      ; (useRouter as jest.Mock).mockReturnValue(mockRouter)
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
      expect(screen.getByText('How can Vaidya help you?')).toBeInTheDocument()
      expect(screen.getByText('CHATS')).toBeInTheDocument()
      expect(screen.getByText('No chats yet')).toBeInTheDocument()
    })

    expect(mockPush).not.toHaveBeenCalled()
  })

  it('displays chat interface correctly', async () => {
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
      expect(screen.getByPlaceholderText('Ask anything medical...')).toBeInTheDocument()
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
      expect(screen.getByText('CHATS')).toBeInTheDocument()
    })

    // Simulate auth state change to logged out
    authCallback!('SIGNED_OUT', null)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  it('does not show loading state when loaded', async () => {
    const mockGetSession = supabase.auth.getSession as jest.Mock
    const mockOnAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock

    const mockUser = { id: '123', email: 'test@example.com' }
    mockGetSession.mockResolvedValue({ data: { session: { user: mockUser } } })
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } })

    render(<Chat />)
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })
  })
})
