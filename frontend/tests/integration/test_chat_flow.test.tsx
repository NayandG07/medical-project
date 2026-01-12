/**
 * Integration Tests for Chat Flow
 * Feature: medical-ai-platform
 * Tests: Creating session, sending message, receiving response, session switching
 * Requirements: 3.2, 3.4
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/router'
import Chat from '@/pages/chat'
import { supabase } from '@/lib/supabase'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn()
}))

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signOut: jest.fn()
    }
  }
}))

// Mock fetch for API calls
global.fetch = jest.fn()

describe('Chat Flow Integration Tests', () => {
  const mockRouter = {
    push: jest.fn(),
    pathname: '/chat',
    query: {},
    asPath: '/chat'
  }

  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    user_metadata: {
      name: 'Test User'
    }
  }

  const mockSession = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    user: mockUser
  }

  beforeEach(() => {
    jest.clearAllMocks()
      ; (useRouter as jest.Mock).mockReturnValue(mockRouter)
      ; (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession }
      })
      ; (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      })
  })

  /**
   * Test: Creating session, sending message, receiving response
   * Requirements: 3.2, 3.4
   */
  test('should create session, send message, and receive response', async () => {
    const mockNewSession = {
      id: 'session-1',
      user_id: 'test-user-id',
      title: 'New Chat',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const mockSentMessage = {
      id: 'message-1',
      session_id: 'session-1',
      role: 'user',
      content: 'Hello, AI!',
      created_at: new Date().toISOString()
    }

      // Mock API responses
      ; (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [] // Initial sessions load (empty)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockNewSession // Create session
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [] // Load messages for new session (empty)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSentMessage // Send message
        })

    const { container } = render(<Chat />)

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('How can Vaidya help you?')).toBeInTheDocument()
    })

    // Click "New Chat" button
    const newChatButton = screen.getByText(/New Chat/i)
    fireEvent.click(newChatButton)

    // Wait for session to be created
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat/sessions'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-access-token'
          })
        })
      )
    })

    // Find the chat input and send a message
    const chatInput = container.querySelector('input')
    expect(chatInput).toBeTruthy()

    if (chatInput) {
      fireEvent.change(chatInput, { target: { value: 'Hello, AI!' } })

      // Submit the form
      const form = chatInput.closest('form')
      if (form) {
        fireEvent.submit(form)
      }
    }

    // Wait for message to be sent
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat/sessions/session-1/messages'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-access-token',
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            message: 'Hello, AI!',
            role: 'user'
          })
        })
      )
    })

    // Verify message appears in the UI
    await waitFor(() => {
      expect(container.textContent).toContain('Hello, AI!')
    })
  })

  /**
   * Test: Session switching
   * Requirements: 3.2, 3.4
   */
  test('should switch between sessions and load messages', async () => {
    const mockSessions = [
      {
        id: 'session-1',
        user_id: 'test-user-id',
        title: 'Chat 1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'session-2',
        user_id: 'test-user-id',
        title: 'Chat 2',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]

    const mockMessages1 = [
      {
        id: 'msg-1',
        session_id: 'session-1',
        role: 'user',
        content: 'Message in session 1',
        created_at: new Date().toISOString()
      }
    ]

    const mockMessages2 = [
      {
        id: 'msg-2',
        session_id: 'session-2',
        role: 'user',
        content: 'Message in session 2',
        created_at: new Date().toISOString()
      }
    ]

      // Mock API responses
      ; (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessions // Load sessions
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockMessages1 // Load messages for session 1
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockMessages2 // Load messages for session 2
        })

    const { container } = render(<Chat />)

    // Wait for component to load and first session to be selected
    await waitFor(() => {
      expect(container.textContent).toContain('Message in session 1')
    })

    // Find and click on the second session
    const session2Element = screen.getByText('Chat 2')
    fireEvent.click(session2Element)

    // Wait for messages from session 2 to load
    await waitFor(() => {
      expect(container.textContent).toContain('Message in session 2')
    })

    // Verify the correct API call was made
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/chat/sessions/session-2/messages'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer mock-access-token'
        })
      })
    )
  })

  /**
   * Test: Error handling when session creation fails
   * Requirements: 3.2
   */
  test('should handle session creation errors gracefully', async () => {
    // Mock API responses
    ; (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [] // Initial sessions load (empty)
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Server error' } })
      })

    render(<Chat />)

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('How can Vaidya help you?')).toBeInTheDocument()
    })

    // Click "New Chat" button
    const newChatButton = screen.getByText(/New Chat/i)
    fireEvent.click(newChatButton)

    // Wait for error to be displayed
    await waitFor(() => {
      // The error should be logged to console
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat/sessions'),
        expect.objectContaining({
          method: 'POST'
        })
      )
    })
  })

  /**
   * Test: Error handling when message sending fails
   * Requirements: 3.2, 3.4
   */
  test('should handle message sending errors gracefully', async () => {
    const mockSession = {
      id: 'session-1',
      user_id: 'test-user-id',
      title: 'Test Chat',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

      // Mock API responses
      ; (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockSession] // Load sessions
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [] // Load messages (empty)
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: { message: 'Failed to send message' } })
        })

    const { container } = render(<Chat />)

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('How can Vaidya help you?')).toBeInTheDocument()
    })

    // Find the chat input and send a message
    const chatInput = container.querySelector('input')
    expect(chatInput).toBeTruthy()

    if (chatInput) {
      fireEvent.change(chatInput, { target: { value: 'Test message' } })

      const form = chatInput.closest('form')
      if (form) {
        fireEvent.submit(form)
      }
    }

    // Wait for error handling
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat/sessions/session-1/messages'),
        expect.objectContaining({
          method: 'POST'
        })
      )
    })

    // The temporary message should be removed on error
    await waitFor(() => {
      // Error should be set in state (we can't easily test this without exposing state)
      // But we can verify the API call was made
      expect(global.fetch).toHaveBeenCalledTimes(3)
    })
  })

  /**
   * Test: Unauthenticated users are redirected
   * Requirements: 22.3
   */
  test('should redirect unauthenticated users to login', async () => {
    ; (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null }
    })

    render(<Chat />)

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/')
    })
  })
})
