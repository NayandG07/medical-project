import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import DocumentUpload from '../components/DocumentUpload'
import DocumentList, { Document } from '../components/DocumentList'
import { FileText, Search, Filter, Plus, Info, CheckCircle, AlertCircle, Sparkles, BookOpen, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function DocumentsPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

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
      setError('Failed to load user data')
    } finally {
      setLoading(false)
    }
  }

  const fetchDocuments = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) throw new Error('Failed to fetch documents')
      const data = await response.json()
      setDocuments(data.documents || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load documents')
    }
  }

  const handleUploadSuccess = () => {
    setSuccess('Document uploaded successfully!')
    setError(null)
    setTimeout(() => setSuccess(null), 4000)
    fetchDocuments()
  }

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage)
    setSuccess(null)
    setTimeout(() => setError(null), 5000)
  }

  const handleDelete = async (documentId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) throw new Error('Failed to delete document')
      setSuccess('Document removed from library.')
      setTimeout(() => setSuccess(null), 3000)
      await fetchDocuments()
    } catch (err: any) {
      setError(err.message || 'Failed to delete document')
      throw err
    }
  }

  const filteredDocuments = documents.filter(doc =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading || !user) {
    return (
      <div className="full-loader">
        <div className="spinner"></div>
        <p>Initializing your secure vault...</p>
        <style jsx>{`
          .full-loader {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #F8FAFD;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #E2E8F0;
            border-top: 4px solid #6366F1;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
          }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Library - Pramana Med</title>
      </Head>
      <DashboardLayout user={user}>
        <div className="documents-container">
          {/* Main Content Area */}
          <div className="content-side">
            <header className="page-header">
              <div className="header-text">
                <h1>Medical Library</h1>
                <p>Manage your clinical records, research papers, and study notes.</p>
              </div>
              <div className="header-stats">
                <div className="header-stat-item">
                  <span className="stat-val">{documents.length}</span>
                  <span className="stat-label">Total</span>
                </div>
                <div className="header-stat-divider"></div>
                <div className="header-stat-item">
                  <span className="stat-val">{documents.filter(d => d.processing_status === 'completed').length}</span>
                  <span className="stat-label">Processed</span>
                </div>
              </div>
            </header>

            <AnimatePresence>
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="alert success"
                >
                  <CheckCircle size={18} />
                  <span>{success}</span>
                </motion.div>
              )}
              {/* 
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="alert error"
                >
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </motion.div>
              )}
              */}
            </AnimatePresence>

            {/* Library Controls */}
            <div className="library-controls">
              <div className="search-bar">
                <Search size={18} color="#94A3B8" />
                <input
                  type="text"
                  placeholder="Filter library by filename..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="filter-btn">
                <Filter size={18} />
                <span>Sort: Newest</span>
              </button>
            </div>

            {/* Document List Section */}
            <section className="library-section">
              <DocumentList
                documents={filteredDocuments}
                onDelete={handleDelete}
                loading={false}
              />
            </section>
          </div>

          {/* Right Sidebar - Focused on Upload and Info */}
          <aside className="upload-side">
            <div className="sidebar-sticky-wrap">
              <div className="upload-card">
                <div className="card-header">
                  <div className="card-icon">
                    <Plus size={20} color="#6366F1" />
                  </div>
                  <h3>Add to Library</h3>
                </div>
                <DocumentUpload
                  onUploadSuccess={handleUploadSuccess}
                  onUploadError={handleUploadError}
                />
              </div>

              <div className="info-card">
                <div className="sparkle-header">
                  <Sparkles size={18} color="#F59E0B" />
                  <h4>Smart Library</h4>
                </div>
                <p>Uploaded documents are automatically indexed for <strong>semantic search</strong>. You can cite them directly in your chats for evidence-based responses.</p>
                <div className="feature-list">
                  <div className="feature-item">
                    <BookOpen size={14} color="#6366F1" />
                    <span>Cross-document analysis</span>
                  </div>
                  <div className="feature-item">
                    <Clock size={14} color="#6366F1" />
                    <span>Real-time OCR processing</span>
                  </div>
                </div>
                <div className="token-progress">
                  <div className="progress-label">
                    <span>Library Storage</span>
                    <span>12.5 MB / 100 MB</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: '12.5%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <style jsx>{`
          .documents-container {
            display: grid;
            grid-template-columns: 1fr 380px;
            gap: 40px;
            max-width: 1440px;
            margin: 0 auto;
          }

          @media (max-width: 1200px) {
            .documents-container {
              grid-template-columns: 1fr;
            }
            .upload-side { display: none; }
          }

          .page-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-bottom: 40px;
          }

          .header-text h1 {
            font-size: 36px;
            font-weight: 800;
            color: #1E293B;
            margin: 0 0 8px 0;
            letter-spacing: -0.02em;
          }

          .header-text p {
            font-size: 16px;
            color: #64748B;
            margin: 0;
          }

          .header-stats {
            display: flex;
            align-items: center;
            background: white;
            padding: 12px 24px;
            border-radius: 20px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
            border: 1px solid #E2E8F0;
          }

          .header-stat-item {
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          .stat-val {
            font-size: 18px;
            font-weight: 800;
            color: #1E293B;
          }

          .stat-label {
            font-size: 11px;
            font-weight: 700;
            color: #94A3B8;
            text-transform: uppercase;
          }

          .header-stat-divider {
            width: 1px;
            height: 30px;
            background: #CBD5E1;
            margin: 0 24px;
          }

          .alert {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px 24px;
            border-radius: 16px;
            margin-bottom: 32px;
            font-weight: 600;
            font-size: 14px;
          }

          .alert.success { background: #F0FDFA; color: #10B981; border: 1px solid #CCFBF1; }
          .alert.error { background: #FEF2F2; color: #EF4444; border: 1px solid #FEE2E2; }

          .library-controls {
            display: flex;
            gap: 16px;
            margin-bottom: 32px;
          }

          .search-bar {
            flex: 1;
            background: white;
            border: 1px solid #E2E8F0;
            border-radius: 16px;
            padding: 0 20px;
            display: flex;
            align-items: center;
            gap: 12px;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
          }

          .search-bar:focus-within {
            border-color: #6366F1;
            box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.05);
          }

          .search-bar input {
            border: none;
            background: none;
            flex: 1;
            height: 52px;
            font-size: 15px;
            font-weight: 500;
            outline: none;
            color: #1E293B;
          }

          .filter-btn {
            background: white;
            border: 1px solid #E2E8F0;
            border-radius: 16px;
            padding: 0 20px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 700;
            color: #475569;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
          }

          .filter-btn:hover {
            background: #F8FAFC;
            border-color: #CBD5E1;
          }

          /* Sidebar Cards */
          .sidebar-sticky-wrap {
            position: sticky;
            top: 32px;
            display: flex;
            flex-direction: column;
            gap: 24px;
          }

          .upload-card {
            background: white;
            border-radius: 32px;
            padding: 32px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02);
            border: 1px solid #E2E8F0;
          }

          .card-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 24px;
          }

          .card-icon {
            width: 40px;
            height: 40px;
            background: #F5F7FF;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .card-header h3 {
            font-size: 18px;
            font-weight: 800;
            color: #1E293B;
            margin: 0;
          }

          .info-card {
            background: #1E293B;
            border-radius: 32px;
            padding: 32px;
            color: white;
            position: relative;
            overflow: hidden;
          }

          .sparkle-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 16px;
          }

          .sparkle-header h4 {
            margin: 0;
            font-size: 16px;
            font-weight: 700;
            color: white;
          }

          .info-card p {
            font-size: 14px;
            line-height: 1.6;
            color: #94A3B8;
            margin: 0 0 20px 0;
          }

          .info-card strong { color: #E2E8F0; }

          .feature-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 24px;
          }

          .feature-item {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 13px;
            font-weight: 600;
            color: #CBD5E1;
          }

          .token-progress {
            background: rgba(255,255,255,0.05);
            padding: 16px;
            border-radius: 16px;
          }

          .progress-label {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: #64748B;
            margin-bottom: 8px;
          }

          .progress-track {
            height: 6px;
            background: rgba(255,255,255,0.1);
            border-radius: 3px;
            overflow: hidden;
          }

          .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #6366F1 0%, #A855F7 100%);
            border-radius: 3px;
          }
        `}</style>
      </DashboardLayout>
    </>
  )
}
