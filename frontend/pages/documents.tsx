import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import DocumentUpload from '../components/DocumentUpload'
import DocumentList, { Document } from '../components/DocumentList'
import {
  FileText,
  Search,
  Plus,
  CheckCircle,
  Sparkles,
  BookOpen,
  Image as ImageIcon,
  Library,
  FileBox,
  BrainCircuit,
  Settings2,
  Filter,
  ArrowRight,
  ShieldCheck,
  X,
  Scan,
  FileImage,
  Activity,
  Heart,
  Zap,
  Eye,
  Upload,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'


// ConfirmDialog component removed - replaced with Portal implementation


export default function DocumentsPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'pdf' | 'image'>('all')
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; documentId: string | null }>({
    isOpen: false,
    documentId: null
  })
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isClearingVault, setIsClearingVault] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Effect for client-side mounting (needed for Portal)
  useEffect(() => {
    setMounted(true)
  }, [])

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

  const fetchDocuments = async (isPoll = false) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) throw new Error('Failed to fetch documents')
      const data = await response.json()
      setDocuments(data.documents || [])

      if (!isPoll) setLoading(false)
    } catch (err: any) {
      if (!isPoll) {
        setError(err.message || 'Failed to load documents')
        setLoading(false)
      }
    }
  }

  // Polling for processing updates
  useEffect(() => {
    const hasProcessing = documents.some(doc =>
      doc.processing_status === 'processing' || doc.processing_status === 'pending'
    )

    if (hasProcessing) {
      const interval = setInterval(() => {
        fetchDocuments(true)
      }, 4000)
      return () => clearInterval(interval)
    }
  }, [documents])

  const handleUploadSuccess = (newDoc: Document) => {
    if (newDoc) {
      setDocuments(prev => [newDoc, ...prev])
      toast.success('Document added to your intelligence vault', {
        position: 'top-right',
        duration: 3000,
        style: {
          background: '#F0FDFA',
          border: '1px solid #CCFBF1',
          color: '#0F766E',
          fontWeight: '600'
        }
      })
    }
    setIsUploadModalOpen(false)
    // We can still re-fetch to be safe, but we have the data now
    // fetchDocuments() 
  }

  const handleDeleteRequest = (documentId: string) => {
    setDeleteConfirm({ isOpen: true, documentId })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.documentId) return

    try {
      setIsDeleting(true)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents/${deleteConfirm.documentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) throw new Error('Failed to delete document')
      toast.success('Item removed from vault.', {
        duration: 3000,
        style: {
          background: '#F0FDFA',
          border: '1px solid #CCFBF1',
          color: '#0F766E',
          fontWeight: '600'
        }
      })

      // Optimistic delete
      setDocuments(prev => prev.filter(d => d.id !== deleteConfirm.documentId))

    } catch (err: any) {
      setError(err.message || 'Failed to delete document')
    } finally {
      setIsDeleting(false)
      setDeleteConfirm({ isOpen: false, documentId: null })
    }
  }

  const handleDeleteCancel = () => {
    setDeleteConfirm({ isOpen: false, documentId: null })
  }

  const handleDeleteAllConfirm = async () => {
    try {
      setIsClearingVault(true)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('No authentication token')

      // Iterate and delete all locally known documents as there is no bulk delete endpoint yet
      const deletePromises = documents.map(doc =>
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents/${doc.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        })
      )

      await Promise.all(deletePromises)

      await Promise.all(deletePromises)

      toast.success('All documents cleared from vault', {
        duration: 3000,
        style: {
          background: '#F0FDFA',
          border: '1px solid #CCFBF1',
          color: '#0F766E',
          fontWeight: '600'
        }
      })
      setDocuments([])
      // fetchDocuments() // No need to refetch if we cleared all
    } catch (err: any) {
      setError(err.message || 'Failed to clear vault')
    } finally {
      setIsClearingVault(false)
      setShowDeleteAllConfirm(false)
    }
  }

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
    if (activeTab === 'all') return matchesSearch
    return matchesSearch && doc.file_type === activeTab
  })

  const pdfCount = documents.filter(d => d.file_type === 'pdf').length
  const imageCount = documents.filter(d => d.file_type === 'image').length
  const indexedCount = documents.filter(d => d.processing_status === 'completed').length

  return (
    <>
      <Head>
        <title>Medical Intelligence Vault - Vaidya AI</title>
        <meta name="description" content="Upload and analyze medical documents and clinical imaging with AI-powered insights" />
      </Head>
      <DashboardLayout user={user} loading={loading}>
        <div className="vault-wrapper">
          {/* Premium Header Section */}
          <header className="vault-header">
            <div className="header-top">
              <div className="title-area">
                <div className="header-badge">
                  <BrainCircuit size={14} />
                  <span>AI-Powered Analysis</span>
                </div>
                <div className="title-main-row">
                  <h1>Medical Intelligence Vault</h1>
                  <div className="action-area">
                    <button
                      className="upload-trigger-btn"
                      onClick={() => setIsUploadModalOpen(true)}
                    >
                      <Plus size={18} strokeWidth={2.5} />
                      <span>Upload New Data</span>
                    </button>
                  </div>
                </div>
                <p>Advanced RAG system for analyzing clinical documents, medical imaging, and generating actionable insights</p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="header-stats">
              <div className="stat-card">
                <div className="stat-icon-box blue">
                  <FileText size={20} />
                </div>
                <div className="stat-info">
                  <span className="stat-value">{pdfCount}</span>
                  <span className="stat-label">Clinical Documents</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon-box rose">
                  <Scan size={20} />
                </div>
                <div className="stat-info">
                  <span className="stat-value">{imageCount}</span>
                  <span className="stat-label">Medical Imaging</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon-box emerald">
                  <Activity size={20} />
                </div>
                <div className="stat-info">
                  <span className="stat-value">{indexedCount}</span>
                  <span className="stat-label">AI Indexed</span>
                </div>
              </div>
            </div>




          </header>

          <div className="vault-content">
            {/* Controls Bar */}
            <div className="controls-bar">
              <div className="search-wrap">
                <div className="search-box">
                  <Search size={18} />
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                {documents.length > 0 && (
                  <button
                    onClick={() => setShowDeleteAllConfirm(true)}
                    className="delete-all-btn"
                    title="Clear All Documents"
                  >
                    <AlertTriangle size={18} />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              <div className="tabs">
                <button
                  className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveTab('all')}
                >
                  <FileBox size={16} />
                  <span>All Entries</span>
                  <span className="tab-count">{documents.length}</span>
                </button>
                <button
                  className={`tab-btn ${activeTab === 'pdf' ? 'active' : ''}`}
                  onClick={() => setActiveTab('pdf')}
                >
                  <FileText size={16} />
                  <span>Documents</span>
                  <span className="tab-count">{pdfCount}</span>
                </button>
                <button
                  className={`tab-btn ${activeTab === 'image' ? 'active' : ''}`}
                  onClick={() => setActiveTab('image')}
                >
                  <Scan size={16} />
                  <span>Imaging</span>
                  <span className="tab-count">{imageCount}</span>
                </button>
              </div>
            </div>

            {/* Main Grid Area */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid-container"
              >
                <DocumentList
                  documents={filteredDocuments}
                  onDelete={handleDeleteRequest}
                  loading={false}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div >

        {/* Toaster for Notifications */}
        <Toaster position="top-right" />

        {/* Error Alert */}
        <AnimatePresence>
          {
            error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="error-pill"
              >
                <AlertTriangle size={18} />
                <span>{error}</span>
                <button onClick={() => setError(null)}><X size={16} /></button>
              </motion.div>
            )
          }
        </AnimatePresence >

        {/* Modals rendered via Portal */}
        {mounted && createPortal(
          <>
            {/* Delete Single Document Confirmation */}
            <AnimatePresence>
              {deleteConfirm.isOpen && (
                <div style={{
                  position: 'fixed',
                  inset: 0,
                  backgroundColor: 'rgba(15, 23, 42, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 9999,
                  backdropFilter: 'blur(12px)'
                }}
                  onClick={handleDeleteCancel}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '24px',
                      padding: '32px',
                      width: '100%',
                      maxWidth: '420px',
                      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                      border: '1px solid #e2e8f0',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{
                      width: '64px',
                      height: '64px',
                      backgroundColor: '#fee2e2',
                      borderRadius: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 20px auto',
                      color: '#ef4444'
                    }}>
                      <AlertTriangle size={32} />
                    </div>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>
                      Delete Document?
                    </h3>
                    <p style={{ margin: '0 0 32px 0', fontSize: '15px', color: '#64748b', lineHeight: '1.6' }}>
                      Are you sure you want to permanently remove this item from your intelligence vault? This action cannot be undone.
                    </p>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <button
                        onClick={handleDeleteCancel}
                        style={{
                          flex: 1,
                          padding: '14px',
                          borderRadius: '14px',
                          backgroundColor: '#f1f5f9',
                          border: 'none',
                          color: '#475569',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteConfirm}
                        disabled={isDeleting}
                        style={{
                          flex: 1,
                          padding: '14px',
                          borderRadius: '14px',
                          backgroundColor: isDeleting ? '#fca5a5' : '#ef4444',
                          border: 'none',
                          color: 'white',
                          fontWeight: '700',
                          cursor: isDeleting ? 'not-allowed' : 'pointer',
                          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        {isDeleting && <Loader2 size={16} className="spin" />}
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Clear Vault Confirmation */}
            <AnimatePresence>
              {showDeleteAllConfirm && (
                <div style={{
                  position: 'fixed',
                  inset: 0,
                  backgroundColor: 'rgba(15, 23, 42, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 9999,
                  backdropFilter: 'blur(12px)'
                }}
                  onClick={() => setShowDeleteAllConfirm(false)}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '24px',
                      padding: '32px',
                      width: '100%',
                      maxWidth: '420px',
                      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                      border: '1px solid #e2e8f0',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{
                      width: '64px',
                      height: '64px',
                      backgroundColor: '#fee2e2',
                      borderRadius: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 20px auto',
                      color: '#ef4444'
                    }}>
                      <AlertTriangle size={32} />
                    </div>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>
                      Clear Intelligence Vault?
                    </h3>
                    <p style={{ margin: '0 0 32px 0', fontSize: '15px', color: '#64748b', lineHeight: '1.6' }}>
                      This will permanently delete <strong>EVERY</strong> document in your clinic vault. This operation is intensive and irreversible.
                    </p>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <button
                        onClick={() => setShowDeleteAllConfirm(false)}
                        style={{
                          flex: 1,
                          padding: '14px',
                          borderRadius: '14px',
                          backgroundColor: '#f1f5f9',
                          border: 'none',
                          color: '#475569',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        Abort
                      </button>
                      <button
                        onClick={handleDeleteAllConfirm}
                        disabled={isClearingVault}
                        style={{
                          flex: 1,
                          padding: '14px',
                          borderRadius: '14px',
                          backgroundColor: isClearingVault ? '#fca5a5' : '#dc2626',
                          border: 'none',
                          color: 'white',
                          fontWeight: '700',
                          cursor: isClearingVault ? 'not-allowed' : 'pointer',
                          boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        {isClearingVault && <Loader2 size={16} className="spin" />}
                        {isClearingVault ? 'Deleting...' : 'Clear All'}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Upload Modal (Existing) */}
            <AnimatePresence>
              {isUploadModalOpen && (
                <div style={{
                  position: 'fixed',
                  inset: 0,
                  backgroundColor: 'rgba(15, 23, 42, 0.5)',
                  backdropFilter: 'blur(12px)',
                  zIndex: 9999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px'
                }}
                  onClick={() => setIsUploadModalOpen(false)}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 30 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 350 }}
                    onClick={e => e.stopPropagation()}
                    className="upload-modal"
                    style={{
                      backgroundColor: 'white',
                      width: '100%',
                      maxWidth: '600px',
                      borderRadius: '24px',
                      boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.25)',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Modal Header */}
                    <div className="upload-modal-header">
                      <div className="modal-title-row">
                        <Sparkles size={22} color="#F59E0B" />
                        <h2>Process New Intelligence</h2>
                      </div>
                      <button
                        className="modal-close-btn"
                        onClick={() => setIsUploadModalOpen(false)}
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Modal Description */}
                    <p className="modal-description">
                      Upload medical documents or imaging. Our AI will automatically index, summarize, and extract key clinical findings.
                    </p>

                    {/* Upload Zone */}
                    <div className="upload-zone-wrapper">
                      <DocumentUpload
                        onUploadSuccess={handleUploadSuccess}
                        onUploadError={(err) => setError(err)}
                      />
                    </div>

                    {/* Modal Footer */}
                    <div className="upload-modal-footer" style={{ padding: '18px 28px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
                      <div className="rag-badge">
                        <BookOpen size={14} />
                        <span>RAG-COMPATIBLE. AUTOMATIC OCR ENABLED.</span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </>,
          document.body
        )}

        <style jsx>{`
          .vault-wrapper {
            max-width: 1120px;
            margin: 0 auto;
            padding: 32px 24px 80px; /* Reduced side padding from 32px to 24px */
          }

          /* Premium Header */
          .vault-header {
            margin-bottom: 48px;
          }

          .header-top {
            margin-bottom: 40px;
          }

          .title-area {
            width: 100%;
          }

          .title-main-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 24px;
            margin-bottom: 12px;
          }

          @media (max-width: 900px) {
            .title-main-row {
              flex-direction: column;
              align-items: stretch;
              gap: 20px;
            }
          }

          .header-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: #F8FAFC;
            color: #64748B;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 700;
            margin-bottom: 12px;
            border: 1px solid #E2E8F0;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .title-area h1 {
            font-size: 32px;
            font-weight: 700;
            color: #1E293B;
            margin: 0 0 10px 0;
            letter-spacing: -0.02em;
            line-height: 1.2;
          }

          .title-area p {
            font-size: 16px;
            color: #64748B;
            margin: 0;
            max-width: 550px;
            line-height: 1.5;
          }

          :global(.upload-trigger-btn) {
            background: linear-gradient(135deg, #7C3AED 0%, #6366F1 50%, #8B5CF6 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 15px;
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 10px 25px -5px rgba(121, 40, 202, 0.4), 0 8px 10px -6px rgba(121, 40, 202, 0.2);
            position: relative;
            overflow: hidden;
            letter-spacing: 0.01em;
            white-space: nowrap;
          }

          :global(.upload-trigger-btn:hover) {
            transform: translateY(-4px) scale(1.02);
            box-shadow: 0 20px 30px -10px rgba(121, 40, 202, 0.5);
            filter: brightness(1.1);
          }

          :global(.upload-trigger-btn::before) {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(
              120deg,
              transparent,
              rgba(255, 255, 255, 0.3),
              transparent
            );
            transition: all 0.6s;
          }

          :global(.upload-trigger-btn:hover::before) {
            left: 100%;
          }

          :global(.upload-trigger-btn:active) {
            transform: scale(0.98);
          }
          
          /* Stats Cards */
          .header-stats {
             display: grid;
             grid-template-columns: repeat(3, 1fr);
             gap: 24px;
             margin-bottom: 40px;
          }

          @media (max-width: 1024px) {
             .header-stats {
                 grid-template-columns: repeat(2, 1fr);
             }
             .header-stats > *:last-child {
                 grid-column: span 2;
             }
          }

          @media (max-width: 640px) {
             .header-stats {
                 grid-template-columns: repeat(2, 1fr);
                 gap: 10px;
                 margin-bottom: 24px;
             }
             .header-stats > *:last-child {
                 grid-column: span 2;
             }
             .stat-card {
                 flex-direction: column;
                 align-items: flex-start;
                 padding: 14px;
                 gap: 10px;
             }
             .stat-icon-box {
                 width: 38px;
                 height: 38px;
                 border-radius: 8px;
             }
             .stat-icon-box :global(svg) {
                 width: 18px;
                 height: 18px;
             }
             .stat-value {
                 font-size: 20px;
                 margin-bottom: 2px;
             }
             .stat-label {
                 font-size: 11px;
                 line-height: 1.3;
                 color: #64748B;
             }
          }

          .stat-card {
            background: white;
            padding: 20px 24px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 16px;
            border: 1px solid #E2E8F0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            transition: all 0.2s;
          }
          
          .stat-card:hover {
            border-color: #CBD5E1;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          }

          .stat-icon-box {
            width: 48px;
            height: 48px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .stat-icon-box.blue { background: #EEF2FF; color: #4F46E5; }
          .stat-icon-box.rose { background: #FFF1F2; color: #E11D48; }
          .stat-icon-box.emerald { background: #ECFDF5; color: #059669; }

          .stat-value {
            display: block;
            font-size: 24px;
            font-weight: 700;
            color: #0F172A;
            line-height: 1;
            margin-bottom: 4px;
          }
          
          .stat-label {
            font-size: 13px;
            color: #64748B;
            font-weight: 500;
          }

          /* Supported Types */
          .supported-types {
            display: flex;
            align-items: center;
            gap: 16px;
            flex-wrap: wrap;
          }

          .types-label {
            font-size: 13px;
            font-weight: 700;
            color: #94A3B8;
          }

          .type-pills {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }

          .type-pill {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 14px;
            background: white;
            border: 1px solid #E2E8F0;
            border-radius: 100px;
            font-size: 12px;
            font-weight: 700;
            color: #475569;
            box-shadow: 0 2px 6px rgba(0,0,0,0.03);
          }

          /* Controls Bar */
          .controls-bar {
            background: white;
            padding: 12px;
            border-radius: 20px;
            border: 1px solid #E2E8F0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 32px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.04);
            gap: 16px;
          }

          .tabs {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
          }

          @media (max-width: 768px) {
            .controls-bar {
                flex-direction: column;
                align-items: stretch;
            }
            .search-wrap {
                width: 100%;
                max-width: none !important;
            }
          }

          .tab-btn {
            background: transparent !important;
            border: none;
            padding: 14px 20px;
            border-radius: 14px;
            font-weight: 700;
            color: #64748B !important;
            display: flex;
            align-items: center;
            gap: 10px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .tab-btn:hover {
            color: #1E293B !important;
            background: #F8FAFC !important;
          }

          .tab-btn.active {
            background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%) !important;
            color: white !important;
            box-shadow: 0 6px 16px rgba(99, 102, 241, 0.25);
          }

          .tab-count {
            background: rgba(255,255,255,0.1);
            padding: 2px 8px;
            border-radius: 100px;
            font-size: 11px;
            color: inherit;
          }

          .tabs button:not(.active) .tab-count {
            background: #F1F5F9;
            color: #64748B;
          }

          .search-wrap {
            display: flex;
            align-items: center;
            gap: 12px;
            flex: 1;
            max-width: 520px;
            order: 2;
          }

          .tabs {
            order: 1;
          }

          .delete-all-btn {
             padding: 0 16px;
             height: 50px;
             border-radius: 14px;
             border: 1px solid #FECACA;
             background: #FEF2F2;
             color: #DC2626;
             font-weight: 600;
             cursor: pointer;
             display: flex;
             align-items: center;
             gap: 8px;
             transition: all 0.2s;
             white-space: nowrap;
          }

          .delete-all-btn:hover {
            background: #FCA5A5;
            color: #7F1D1D;
          }

          .search-box {
            background: white;
            border-radius: 14px;
            padding: 0 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            transition: all 0.2s;
            border: 1px solid #94A3B8;
            flex: 1;
            height: 50px;
          }

          .search-box:focus-within {
            border-color: #6366F1;
            box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
          }

          .search-box svg {
            color: #94A3B8;
          }

          .search-box input {
            border: none;
            background: transparent;
            height: 100%;
            flex: 1;
            font-weight: 600;
            font-size: 15px;
            outline: none;
            color: #1E293B;
          }

          /* Upload Modal */
          .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.5);
            backdrop-filter: blur(12px);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }

          .upload-modal {
            background: white;
            width: 100%;
            max-width: 600px;
            border-radius: 24px;
            box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.25);
            overflow: hidden;
          }

          .upload-modal-header {
            padding: 24px 28px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .modal-title-row {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .modal-title-row h2 {
            margin: 0;
            font-size: 22px;
            font-weight: 800;
            color: #1E293B;
            letter-spacing: -0.02em;
          }

          .modal-close-btn {
            background: #F1F5F9;
            border: none;
            width: 44px;
            height: 44px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #64748B;
            cursor: pointer;
            transition: all 0.2s;
          }

          .modal-close-btn:hover {
            background: #E2E8F0;
            color: #1E293B;
          }

          .modal-description {
            padding: 0 28px;
            margin: 0 0 24px 0;
            font-size: 15px;
            color: #64748B;
            line-height: 1.6;
          }

          .upload-zone-wrapper {
            padding: 0 28px 28px;
          }

          .upload-modal-footer {
            padding: 18px 28px;
            background: linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%);
            border-top: 1px solid #E2E8F0;
          }

          .rag-badge {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            font-size: 11px;
            font-weight: 800;
            color: #64748B;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .rag-badge :global(svg) {
            color: #94A3B8;
          }

          .success-pill {
            position: fixed;
            top: 24px;
            right: 24px;
            background: linear-gradient(135deg, #10B981 0%, #059669 100%);
            color: white;
            padding: 16px 28px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            font-weight: 700;
            font-size: 15px;
            box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.4);
            z-index: 9999;
          }

          .error-pill {
            position: fixed;
            top: 24px;
            right: 24px;
            background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
            color: white;
            padding: 16px 28px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            font-weight: 700;
            font-size: 15px;
            box-shadow: 0 10px 25px -5px rgba(239, 68, 68, 0.4);
            z-index: 9999;
          }

          .error-pill button {
            background: rgba(255,255,255,0.2);
            border: none;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            cursor: pointer;
            margin-left: 8px;
          }

          /* Mobile Responsiveness */
          @media (max-width: 1024px) {
            .header-top {
              flex-direction: column;
              align-items: stretch;
            }

            .upload-trigger-btn {
              width: 100%;
              justify-content: center;
            }
          }

          @media (max-width: 768px) {
            .vault-wrapper {
              padding: 20px 12px 60px; /* Reduced from 16px to 12px */
            }

            .title-area h1 {
              font-size: 26px;
            }

            .controls-bar {
              flex-direction: column;
              align-items: stretch;
              padding: 16px;
              gap: 20px;
            }

            .tabs {
              width: 100%;
            }

            .tabs button {
              flex: 1;
              justify-content: center;
              padding: 12px 10px;
              font-size: 13px;
            }

            .tabs button span:not(.tab-count) {
              display: none;
            }

            .search-wrap {
              max-width: 100%;
              flex-direction: row; /* Search and Clear on one line */
              align-items: center;
              order: 1; /* Search at top */
              gap: 8px; /* Slightly tighter gap */
            }

            :global(.search-box) {
              flex: 1;
              min-width: 0; /* Allow box to shrink to prevent button overflow */
              padding: 0 12px; /* Tighter internal padding */
            }

            .tabs {
               order: 2; /* Tabs below search */
            }

            :global(.delete-all-btn) {
              width: auto;
              padding: 0 12px;
              justify-content: center;
            }
            
            :global(.delete-all-btn span) {
              display: none; /* Hide 'Vault' to keep compact */
            }

            .supported-types {
              display: none;
            }
          }

          @media (max-width: 480px) {
            .stat-card {
                padding: 16px;
            }
            .stat-icon-box {
                width: 40px;
                height: 40px;
            }
            .stat-value {
                font-size: 20px;
            }
            .upload-modal-header {
              padding: 20px;
            }
             .upload-zone-wrapper {
               padding: 0 20px 20px;
             }
             .modal-description {
               padding: 0 20px;
             }
             .upload-modal-footer {
               padding: 14px 20px;
             }
           }
        `}</style>
      </DashboardLayout >
    </>
  )
}
