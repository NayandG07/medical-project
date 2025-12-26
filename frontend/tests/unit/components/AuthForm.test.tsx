import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AuthForm from '@/components/AuthForm'
import { supabase } from '@/lib/supabase'

// Mock the supabase client
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
    },
  },
}))

describe('AuthForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders login form by default', () => {
    render(<AuthForm />)
    
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
  })

  it('switches to register mode when toggle button is clicked', () => {
    render(<AuthForm />)
    
    const toggleButton = screen.getByText("Don't have an account? Register")
    fireEvent.click(toggleButton)
    
    expect(screen.getByRole('heading', { name: 'Register' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument()
  })

  it('switches back to login mode from register mode', () => {
    render(<AuthForm />)
    
    // Switch to register
    fireEvent.click(screen.getByText("Don't have an account? Register"))
    expect(screen.getByRole('heading', { name: 'Register' })).toBeInTheDocument()
    
    // Switch back to login
    fireEvent.click(screen.getByText('Already have an account? Login'))
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
  })

  it('calls signInWithPassword on login form submission', async () => {
    const mockSignIn = supabase.auth.signInWithPassword as jest.Mock
    mockSignIn.mockResolvedValue({
      data: { user: { id: '123', email: 'test@example.com' } },
      error: null,
    })

    const onSuccess = jest.fn()
    render(<AuthForm onSuccess={onSuccess} />)
    
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    })
    
    fireEvent.click(screen.getByRole('button', { name: /login/i }))
    
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('calls signUp on register form submission', async () => {
    const mockSignUp = supabase.auth.signUp as jest.Mock
    mockSignUp.mockResolvedValue({
      data: { user: { id: '123', email: 'test@example.com' } },
      error: null,
    })

    const onSuccess = jest.fn()
    render(<AuthForm onSuccess={onSuccess} />)
    
    // Switch to register mode
    fireEvent.click(screen.getByText("Don't have an account? Register"))
    
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Test User' },
    })
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    })
    
    fireEvent.click(screen.getByRole('button', { name: /register/i }))
    
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          data: {
            name: 'Test User',
          },
        },
      })
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('displays error message on login failure', async () => {
    const mockSignIn = supabase.auth.signInWithPassword as jest.Mock
    mockSignIn.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid credentials' },
    })

    render(<AuthForm />)
    
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrongpassword' },
    })
    
    fireEvent.click(screen.getByRole('button', { name: /login/i }))
    
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('displays error message on registration failure', async () => {
    const mockSignUp = supabase.auth.signUp as jest.Mock
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: { message: 'Email already registered' },
    })

    render(<AuthForm />)
    
    // Switch to register mode
    fireEvent.click(screen.getByText("Don't have an account? Register"))
    
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Test User' },
    })
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'existing@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    })
    
    fireEvent.click(screen.getByRole('button', { name: /register/i }))
    
    await waitFor(() => {
      expect(screen.getByText('Email already registered')).toBeInTheDocument()
    })
  })

  it('disables submit button while loading', async () => {
    const mockSignIn = supabase.auth.signInWithPassword as jest.Mock
    mockSignIn.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

    render(<AuthForm />)
    
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    })
    
    const submitButton = screen.getByRole('button', { name: /login/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
    })
  })
})
