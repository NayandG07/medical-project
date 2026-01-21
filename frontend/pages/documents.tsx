import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import DocumentUpload from '../components/DocumentUpload'
import DocumentList, { Document } from '../components/DocumentList'
import { FileText, Search, Filter, Plus, Info, CheckCircle, AlertCircle, Sparkles, BookOpen, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import styles from '@/styles/Documents.module.css'

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



  return (
    <>
      <Head>
        <title>Library - Pramana Med</title>
      </Head>
      <DashboardLayout user={user}>
        {loading ? (
          <div className={styles.innerLoader}>
            <div className={styles.spinner}></div>
            <p>Loading your medical library...</p>
          </div>
        ) : (
          <div className={styles.documentsContainer}>
            {/* Main Content Area */}
            <div className={styles.contentSide}>
              <header className={styles.pageHeader}>
                <div className={styles.headerText}>
                  <h1>Medical Library</h1>
                  <p>Manage your clinical records, research papers, and study notes.</p>
                </div>
                <div className={styles.headerStats}>
                  <div className={styles.headerStatItem}>
                    <span className={styles.statVal}>{documents.length}</span>
                    <span className={styles.statLabel}>Total</span>
                  </div>
                  <div className={styles.headerStatDivider}></div>
                  <div className={styles.headerStatItem}>
                    <span className={styles.statVal}>{documents.filter(d => d.processing_status === 'completed').length}</span>
                    <span className={styles.statLabel}>Processed</span>
                  </div>
                </div>
              </header>

              <AnimatePresence>
                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`${styles.alert} ${styles.alertSuccess}`}
                  >
                    <CheckCircle size={18} />
                    <span>{success}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Library Controls */}
              <div className={styles.libraryControls}>
                <div className={styles.searchBar}>
                  <Search size={18} color="#94A3B8" />
                  <input
                    type="text"
                    placeholder="Filter library by filename..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button className={styles.filterBtn}>
                  <Filter size={18} />
                  <span>Sort: Newest</span>
                </button>
              </div>

              {/* Document List Section */}
              <section className={styles.librarySection}>
                <DocumentList
                  documents={filteredDocuments}
                  onDelete={handleDelete}
                  loading={false}
                />
              </section>
            </div>

            {/* Right Sidebar - Focused on Upload and Info */}
            <aside className={styles.uploadSide}>
              <div className={styles.sidebarStickyWrap}>
                <div className={styles.uploadCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <Plus size={20} color="#6366F1" />
                    </div>
                    <h3>Add to Library</h3>
                  </div>
                  <DocumentUpload
                    onUploadSuccess={handleUploadSuccess}
                    onUploadError={handleUploadError}
                  />
                </div>

                <div className={styles.infoCard}>
                  <div className={styles.sparkleHeader}>
                    <Sparkles size={18} color="#F59E0B" />
                    <h4>Smart Library</h4>
                  </div>
                  <p>Uploaded documents are automatically indexed for <strong>semantic search</strong>. You can cite them directly in your chats for evidence-based responses.</p>
                  <div className={styles.featureList}>
                    <div className={styles.featureItem}>
                      <BookOpen size={14} color="#6366F1" />
                      <span>Cross-document analysis</span>
                    </div>
                    <div className={styles.featureItem}>
                      <Clock size={14} color="#6366F1" />
                      <span>Real-time OCR processing</span>
                    </div>
                  </div>
                  <div className={styles.tokenProgress}>
                    <div className={styles.progressLabel}>
                      <span>Library Storage</span>
                      <span>12.5 MB / 100 MB</span>
                    </div>
                    <div className={styles.progressTrack}>
                      <div className={styles.progressFill} style={{ width: '12.5%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </DashboardLayout>
    </>
  )
}
