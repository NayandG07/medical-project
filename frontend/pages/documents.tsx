import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import DocumentUpload from '../components/DocumentUpload'
import DocumentList, { Document } from '../components/DocumentList'

/**
 * Documents Page
 * Document management interface with upload and list
 * Requirements: 7.1
 */
export default function DocumentsPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
      await fetchDocuments()
    } catch (err) {
      console.error('Error checking user:', err)
      setError('Failed to load user data')
    } finally {
      setLoading(false)
    }
  }

  const fetchDocuments = async () => {
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token

      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch documents')
      }

      const data = await response.json()
      setDocuments(data.documents || [])
    } catch (err: any) {
      console.error('Error fetching documents:', err)
      setError(err.message || 'Failed to load documents')
    }
  }

  const handleUploadSuccess = () => {
    setSuccess('Document uploaded successfully!')
    setError(null)
    
    // Clear success message after 3 seconds
    setTimeout(() => setSuccess(null), 3000)
    
    // Refresh document list
    fetchDocuments()
  }

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage)
    setSuccess(null)
  }

  const handleDelete = async (documentId: string) => {
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token

      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/documents/${documentId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail?.error?.message || 'Failed to delete document')
      }

      setSuccess('Document deleted successfully!')
      setError(null)
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
      
      // Refresh document list
      await fetchDocuments()
    } catch (err: any) {
      setError(err.message || 'Failed to delete document')
      throw err
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading || !user) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh'
      }}>
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Documents - Vaidya AI</title>
      </Head>
      <DashboardLayout user={user}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <h1 style={{ fontSize: '2.5rem', color: '#2d3748', marginBottom: '0.5rem' }}>My Documents 📄</h1>
          <p style={{ fontSize: '1.1rem', color: '#718096', marginBottom: '2rem' }}>Upload PDFs to chat with your documents</p>

        {/* Success Message */}
        {success && (
          <div
            data-testid="success-message"
            style={{
              padding: '1rem',
              backgroundColor: '#d4edda',
              color: '#155724',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              border: '1px solid #c3e6cb'
            }}
          >
            {success}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div
            data-testid="error-message"
            style={{
              padding: '1rem',
              backgroundColor: '#f8d7da',
              color: '#721c24',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              border: '1px solid #f5c6cb'
            }}
          >
            {error}
          </div>
        )}

        {/* Upload Section */}
        <div style={{ marginBottom: '2rem' }}>
          <DocumentUpload
            onUploadSuccess={handleUploadSuccess}
            onUploadError={handleUploadError}
          />
        </div>

        {/* Document List Section */}
        <DocumentList
          documents={documents}
          onDelete={handleDelete}
          loading={false}
        />

        {/* Info Section */}
        <div style={{
          marginTop: '2rem',
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: '12px'
        }}>
          <strong>💡 Tip:</strong> PDF documents will be automatically processed for semantic search.
          You can use uploaded documents in your chat conversations for more accurate, context-aware responses.
        </div>
        </div>
      </DashboardLayout>
    </>
  )
}
