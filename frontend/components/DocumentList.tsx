import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  FileText,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MessageSquare,
  Search,
  Eye,
  FileDown,
  ChevronRight,
  Stethoscope,
  Activity,
  History,
  X,
  Sparkles,
  AlertTriangle,
  ClipboardList,
  Image as ImageIcon
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/router'

export interface Document {
  id: string
  user_id: string
  filename: string
  file_type: string
  file_size: number
  storage_path: string
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
}

interface DocumentListProps {
  documents: Document[]
  onDelete: (documentId: string) => void
  loading?: boolean
}

// Error Toast Component
interface ErrorToastProps {
  message: string
  onClose: () => void
}

function ErrorToast({ message, onClose }: ErrorToastProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className="error-toast"
    >
      <div className="toast-icon">
        <AlertTriangle size={18} />
      </div>
      <span>{message}</span>
      <button onClick={onClose}>
        <X size={16} />
      </button>
      <style jsx>{`
        .error-toast {
          position: fixed;
          bottom: 40px;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          color: #DC2626;
          padding: 14px 20px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 600;
          font-size: 14px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
          border: 1px solid #FEE2E2;
          z-index: 2100;
        }

        .toast-icon {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        button {
          background: #F1F5F9;
          border: none;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748B;
          cursor: pointer;
          margin-left: 8px;
          transition: all 0.2s;
        }

        button:hover {
          background: #E2E8F0;
          color: #1E293B;
        }
      `}</style>
    </motion.div>
  )
}

// Text Parser for Intelligence
const parseIntelligenceText = (text: string) => {
  if (!text) return null
  const lines = text.split('\n')

  return lines.map((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) return <div key={i} className="spacer" />

    // Main Titles / Key Sections (starting with ** or ending with :)
    if (trimmed.startsWith('**') || (trimmed.endsWith(':') && !/^\d+\./.test(trimmed))) {
      const cleanText = trimmed.replace(/\*\*/g, '')
      return <h4 key={i} className="report-header">{cleanText}</h4>
    }

    // Numbered List Items (1. Item)
    if (/^\d+\.\s/.test(trimmed)) {
      const parts = trimmed.split('.')
      const number = parts[0]
      const rest = parts.slice(1).join('.').trim()

      return (
        <div key={i} className="report-list-item numbered">
          <span className="item-num">{number}.</span>
          <span className="item-content">{rest}</span>
        </div>
      )
    }

    // Alphabetic List Items (a. Item)
    if (/^[a-zA-Z]\.\s/.test(trimmed)) {
      const parts = trimmed.split('.')
      const char = parts[0]
      const rest = parts.slice(1).join('.').trim()

      return (
        <div key={i} className="report-list-item alphabetic">
          <span className="item-num">{char}.</span>
          <span className="item-content">{rest}</span>
        </div>
      )
    }

    // Bullet List items
    if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
      return (
        <div key={i} className="report-list-item bulleted">
          <span className="bullet">•</span>
          <span className="item-content">{trimmed.substring(1).trim()}</span>
        </div>
      )
    }

    // Standard text
    return <p key={i} className="report-text">{trimmed}</p>
  })
}

export default function DocumentList({ documents, onDelete, loading }: DocumentListProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [intelDoc, setIntelDoc] = useState<any | null>(null)
  const [loadingIntel, setLoadingIntel] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [platformName, setPlatformName] = useState('Vaidya AI')

  useEffect(() => {
    setMounted(true)
    fetchSystemSettings()
  }, [])

  const fetchSystemSettings = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/system/settings`)
      if (response.ok) {
        const data = await response.json()
        if (data.platform_name) setPlatformName(data.platform_name)
      }
    } catch (err) {
      console.error('Failed to fetch system settings:', err)
    }
  }

  const handleStartChat = (doc: Document) => {
    // Navigate to chat with document context
    router.push({
      pathname: '/chat',
      query: {
        docId: doc.id,
        filename: doc.filename
      }
    })
  }

  const fetchIntelligence = async (docId: string) => {
    setLoadingIntel(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents/${docId}/intelligence`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) throw new Error('Failed to fetch intelligence')
      const data = await response.json()
      setIntelDoc(data)
    } catch (err) {
      setErrorMessage('Failed to retrieve AI intelligence for this item.')
      setTimeout(() => setErrorMessage(null), 5000)
    } finally {
      setLoadingIntel(false)
    }
  }

  const handleExport = () => {
    if (!intelDoc) return

    // Use the first letter of platformName for the logo as in sidebar
    const logoLetter = platformName.charAt(0).toUpperCase()
    const appVersion = "2.1 • PRE-ALFA" // Matching MobileMenu
    const currentYear = new Date().getFullYear()

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${platformName} Summary - ${intelDoc.filename}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          body { 
            background: #FDFBF7; 
            color: #1E293B; 
            font-family: 'Inter', -apple-system, sans-serif; 
            padding: 40px; 
            line-height: 1.6;
            max-width: 900px;
            margin: 0 auto;
            word-wrap: break-word;
          }
          .main-card {
            background: #FFFFFF;
            border: 1px solid #E2E8F0;
            border-radius: 24px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.04);
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .header {
            background: #F1F5F9;
            padding: 24px 32px;
            border-bottom: 1px solid #E2E8F0;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .brand {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .logo {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 800;
            font-size: 18px;
          }
          .app-name {
            font-size: 20px;
            font-weight: 800;
            color: #0F172A;
            letter-spacing: -0.02em;
          }
          .verified-badge {
            display: flex;
            align-items: center;
            gap: 6px;
            background: #F0FDFA;
            color: #059669;
            padding: 6px 12px;
            border-radius: 100px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border: 1px solid #CCFBF1;
          }
          .content-area {
            padding: 40px 32px;
            background: #FCFBF4;
          }
          .content-area > div { /* This targets the direct children of content-area, which will be doc-meta and summary-body */
            background: #FFFFFF;
            border: 1px solid #E2E8F0;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.02);
            background-image: linear-gradient(to bottom right, #FFFFFF, #F8FAFC);
          }
          .doc-meta {
             margin-bottom: 30px;
             padding-bottom: 20px;
             border-bottom: 1px dashed #E2E8F0;
          }
          .doc-meta h1 { font-size: 22px; font-weight: 800; color: #0F172A; margin: 0 0 8px 0; }
          .doc-meta p { font-size: 14px; color: #64748B; margin: 0; word-break: break-all; }
          
          h4 { 
            color: #1E293B; 
            font-size: 16px; 
            font-weight: 700; 
            margin: 32px 0 16px 0;
            padding-left: 14px;
            border-left: 4px solid #6366F1;
          }
          h4:first-of-type { margin-top: 0; }
          p { margin: 0 0 20px 0; font-size: 14px; color: #475569; font-weight: 400; line-height: 1.7; }
          
          .list-item { display: flex; gap: 12px; margin-bottom: 20px; line-height: 1.6; }
          .item-id { color: #6366F1; font-weight: 700; min-width: 24px; font-size: 14px; }
          .bullet { color: #CBD5E1; font-weight: 800; }
          .item-text { color: #334155; font-size: 14px; font-weight: 400; }
          
          .footer {
            padding: 20px 32px;
            background: #F1F5F9;
            border-top: 1px solid #E2E8F0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            color: #94A3B8;
            font-weight: 600;
          }
          .copyright { text-transform: uppercase; letter-spacing: 0.05em; }
          .version-tag { background: #E2E8F0; padding: 4px 8px; border-radius: 4px; }
          
          @media (max-width: 600px) {
            body { padding: 20px 15px; }
            .header { padding: 16px 20px; flex-direction: row; justify-content: space-between; align-items: center; }
            .content-area { padding: 15px; }
            .content-area > div { padding: 25px 20px; border-radius: 16px; }
            .doc-meta h1 { font-size: 18px; }
            h4 { font-size: 15px; margin: 24px 0 12px 0; }
            p, .item-text { font-size: 15px; }
            .footer { flex-direction: column; gap: 12px; padding: 20px; align-items: center; text-align: center; }
          }

          @media print {
            body { padding: 0; background: white; }
            .main-card { box-shadow: none; border: none; }
          }
        </style>
      </head>
      <body>
        <div class="main-card">
          <div class="header">
            <div class="brand">
              <div class="logo">${logoLetter}</div>
              <div class="app-name">${platformName}</div>
            </div>
            <div class="verified-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              VERIFIED
            </div>
          </div>
          
          <div class="content-area">
              <div class="doc-meta">
                <h1>AI Medical Intelligence Summary</h1>
                <p>Filename: ${intelDoc.filename} • Generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              </div>
              
              <div class="summary-body">
                ${intelDoc.intelligence.split('\n').map((line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return '<div style="height: 24px"></div>';

      // Headers
      if (trimmed.startsWith('**') || (trimmed.endsWith(':') && !/^\d+\./.test(trimmed))) {
        return `<h4>${trimmed.replace(/\*\*/g, '')}</h4>`;
      }

      // Numbered
      if (/^\d+\.\s/.test(trimmed)) {
        const parts = trimmed.split('.');
        return `<div class="list-item"><span class="item-id">${parts[0]}.</span><span class="item-text">${parts.slice(1).join('.').trim()}</span></div>`;
      }

      // Alphabetic
      if (/^[a-zA-Z]\.\s/.test(trimmed)) {
        const parts = trimmed.split('.');
        return `<div class="list-item"><span class="item-id">${parts[0]}.</span><span class="item-text">${parts.slice(1).join('.').trim()}</span></div>`;
      }

      // Bullets
      if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
        return `<div class="list-item"><span class="bullet">•</span><span class="item-text">${trimmed.substring(1).trim()}</span></div>`;
      }

      return `<p>${trimmed}</p>`;
    }).join('')}
              </div>
          </div>
          
          <div class="footer">
            <div class="copyright">© ${currentYear} ${platformName} Intelligence Services</div>
            <div class="version-tag">VERSION ${appVersion}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${platformName}_Summary_${intelDoc.id?.slice(0, 8) || 'report'}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const handleDelete = (e: React.MouseEvent, documentId: string) => {
    e.stopPropagation()
    onDelete(documentId)
  }

  if (loading) {
    return (
      <div className="skeleton-grid">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton-card" />
        ))}
        <style jsx>{`
                    .skeleton-grid {
                        display: flex;
                        flex-direction: column;
                        gap: 16px;
                    }
                    .skeleton-card {
                        background: linear-gradient(110deg, #F1F5F9 0%, #E2E8F0 50%, #F1F5F9 100%);
                        background-size: 200% 100%;
                        animation: shimmer 1.5s infinite;
                        border-radius: 16px;
                        height: 88px;
                        width: 100%;
                    }
                    @keyframes shimmer {
                        0% { background-position: 200% 0; }
                        100% { background-position: -200% 0; }
                    }
                `}</style>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <History size={40} color="#CBD5E1" />
        </div>
        <h3>Intelligence Vault is Empty</h3>
        <p>No medical data has been processed for this account yet.</p>
        <style jsx>{`
          .empty-state {
            padding: 120px 40px;
            text-align: center;
            background: white;
            border: 1px solid #E2E8F0;
            border-radius: 24px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.04);
          }
          .empty-icon {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%);
            border-radius: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
          }
          h3 { font-size: 20px; font-weight: 700; color: #1E293B; margin: 0 0 10px 0; }
          p { color: #64748B; font-weight: 500; margin: 0; }
        `}</style>
      </div>
    )
  }

  return (
    <div className="vault-list">
      <AnimatePresence>
        {documents.map((doc, index) => (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: index * 0.04 }}
            className={`entry-row ${doc.processing_status}`}
            onMouseEnter={() => setHoveredId(doc.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {/* Left: Info */}
            <div className="row-main">
              <div className={`file-icon ${doc.file_type === 'pdf' ? 'pdf' : 'image'}`}>
                {doc.file_type === 'pdf' ? <FileText size={20} /> : <ImageIcon size={20} />}
              </div>
              <div className="file-info-stack">
                <h4 title={doc.filename}>{doc.filename}</h4>
                <div className="meta-line">
                  <span className="file-tag">{doc.file_type === 'pdf' ? 'Clinical Record' : 'Imaging'}</span>
                  <span className="dot">•</span>
                  <span className="file-size">{formatFileSize(doc.file_size)}</span>
                </div>
              </div>
            </div>

            {/* Middle: Status & Date */}
            <div className="row-status">
              <div className="status-badge-wrap">
                {doc.processing_status === 'processing' && (
                  <div className="status-pill processing">
                    <Loader2 size={12} className="spin" /> <span>Analyzing</span>
                  </div>
                )}
                {doc.processing_status === 'completed' && (
                  <div className="status-pill completed">
                    <CheckCircle2 size={12} /> <span>Indexed</span>
                  </div>
                )}
                {(doc.processing_status === 'failed' || (doc.processing_status !== 'processing' && doc.processing_status !== 'pending' && doc.processing_status !== 'completed')) && (
                  <div className="status-pill failed">
                    <AlertCircle size={12} /> <span>ERROR</span>
                  </div>
                )}
              </div>
              <span className="date-text">{formatDate(doc.created_at)}</span>
            </div>

            {/* Actions: Start Chat / Summary */}
            <div className="row-actions">
              {doc.processing_status === 'completed' ? (
                <div className="action-group">
                  <button
                    className="action-btn-main rag-btn"
                    title="Engage AI Tutor"
                    onClick={() => handleStartChat(doc)}
                  >
                    <MessageSquare size={16} />
                    <span>Start Chat</span>
                  </button>
                  <button
                    className="action-btn-main summary-btn"
                    title="View Summary"
                    onClick={() => fetchIntelligence(doc.id)}
                    disabled={loadingIntel}
                  >
                    {loadingIntel ? <Loader2 size={16} className="spin" /> : <Eye size={16} />}
                    <span>Summary</span>
                  </button>
                </div>
              ) : (doc.processing_status === 'failed') ? (
                <span className="failed-status-text">Analysis Failed</span>
              ) : (doc.processing_status === 'processing' || doc.processing_status === 'pending') ? (
                <div className="processing-loader-wrap">
                  <Loader2 size={16} className="spin" />
                  <span className="processing-text">AI is indexing your data...</span>
                </div>
              ) : (
                <span className="failed-status-text">Analysis Failed</span>
              )}

              {/* Desktop Delete Section - Re-added */}
              <div className="desktop-only-delete">
                <div className="divider-vert"></div>
                <button
                  className="icon-delete-btn"
                  onClick={(e) => handleDelete(e, doc.id)}
                  disabled={deletingId === doc.id}
                  title="Remove from vault"
                >
                  {deletingId === doc.id ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                </button>
              </div>
            </div>

            {/* Absolute Delete Button - For Mobile only */}
            <button
              className="absolute-delete-btn mobile-only"
              onClick={(e) => handleDelete(e, doc.id)}
              disabled={deletingId === doc.id}
              title="Remove from vault"
            >
              {deletingId === doc.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Error Toast */}
      <AnimatePresence>
        {errorMessage && (
          <ErrorToast
            message={errorMessage}
            onClose={() => setErrorMessage(null)}
          />
        )}
      </AnimatePresence>

      {/* Intelligence Modal - Rendered via Portal */}
      {mounted && createPortal(
        <AnimatePresence>
          {intelDoc && (
            <div className="intel-overlay" onClick={() => setIntelDoc(null)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="intel-card"
                onClick={e => e.stopPropagation()}
              >
                <div className="intel-header">
                  <div className="intel-title">
                    <div className="icon-box">
                      <Sparkles size={20} className="icon" />
                    </div>
                    <div className="title-stack">
                      <h2>AI Case Summary</h2>
                      <span className="subtitle">{intelDoc.filename}</span>
                    </div>
                  </div>
                  <button className="close-btn" onClick={() => setIntelDoc(null)}>
                    <X size={20} />
                  </button>
                </div>

                <div className="intel-body custom-scrollbar" data-lenis-prevent>
                  <div className="report-badge">
                    CLINICAL SUMMARY • CONFIDENTIAL
                  </div>
                  <div className="intel-content-wrapper mobile-flat-content">
                    {parseIntelligenceText(intelDoc.intelligence)}
                  </div>
                </div>

                <div className="intel-footer">
                  <button className="copy-btn" onClick={handleExport}>
                    <FileDown size={14} />
                    <span>Export Report</span>
                  </button>
                  <div className="ai-meta">
                    <span className="secure-tag"><ClipboardList size={10} /> Verified</span>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <style jsx>{`
        .vault-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        :global(.entry-row) {
          background: #FFFFFF !important;
          border-radius: 20px;
          padding: 24px;
          border: 1.5px solid #CBD5E1 !important;
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr; 
          align-items: center;
          gap: 24px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
          position: relative;
          z-index: 1;
          width: 100%;
          box-sizing: border-box;
          overflow: hidden;
        }

        :global(.entry-row:hover) {
          border-color: #94A3B8 !important;
          box-shadow: 0 12px 20px rgba(0, 0, 0, 0.12) !important;
          transform: translateY(-2px);
        }

        /* Left: Main */
        .row-main {
            display: flex;
            align-items: center;
            gap: 20px;
        }

        .file-icon {
            width: 44px;
            height: 44px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .file-icon.pdf { background: #EEF2FF; color: #4F46E5; }
        .file-icon.image { background: #F0F9FF; color: #0EA5E9; }

        .file-info-stack {
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-width: 0; /* Critical for text truncation */
            flex: 1;
        }

        .file-info-stack h4 {
            margin: 0;
            font-size: 15px;
            font-weight: 700;
            color: #1E293B;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.4;
            max-width: 320px;
        }

        .meta-line {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: #64748B;
            padding-left: 4px;
        }
        .file-tag { font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.02em; }
        .dot { color: #CBD5E1; }

        /* Middle: Status */
        .row-status {
            display: flex;
            align-items: center;
            gap: 24px;
        }
        
        .status-pill {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
        .status-pill.completed { background: #F0FDFA; color: #059669; }
        .status-pill.processing { background: #FFFBEB; color: #D97706; }
        .status-pill.failed { background: #FEF2F2; color: #DC2626; }

        .date-text {
            font-size: 13px;
            color: #94A3B8;
            font-weight: 500;
        }

        /* Right: Actions */
        .row-actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            width: 100%;
        }

        .action-group {
            display: flex;
            align-items: center;
            gap: 12px;
            width: 100%;
        }

        .action-btn-main {
            flex: 1;
            height: 48px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid #E2E8F0;
        }

        .rag-btn {
            background: #EEF2FF;
            color: #4F46E5;
            border-color: #C7D2FE !important;
        }

        .rag-btn:hover {
            background: #E0E7FF;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.1);
        }

        .summary-btn {
            background: #F8FAFC;
            color: #475569;
        }

        .summary-btn:hover {
            background: #F1F5F9;
            border-color: #CBD5E1;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .desktop-only-delete {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .divider-vert {
            width: 1px;
            height: 24px;
            background: #E2E8F0;
        }

        .icon-delete-btn {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            border: 1px solid transparent;
            background: transparent;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #94A3B8;
            cursor: pointer;
            transition: all 0.2s;
        }

        .icon-delete-btn:hover {
            background: #FEF2F2;
            color: #DC2626;
            border-color: #FECACA;
        }

        .absolute-delete-btn {
            position: absolute;
            top: 14px;
            right: 14px;
            width: 34px;
            height: 34px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #FEF2F2;
            color: #EF4444; /* Permanent Red for mobile visibility */
            border: 1px solid #FECACA;
            cursor: pointer;
            transition: all 0.2s;
            z-index: 10;
        }

        .absolute-delete-btn:hover {
            background: #FEE2E2;
            transform: scale(1.05);
        }

        .mobile-only { display: none; }

        .failed-status-text {
            color: #DC2626;
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .processing-loader-wrap {
            display: flex;
            align-items: center;
            gap: 10px;
            color: #64748B;
            font-size: 13px;
            font-weight: 600;
        }
        
        .failed-text {
            font-size: 12px;
            color: #EF4444;
            font-weight: 600;
        }

        .processing-text {
            font-size: 12px;
            color: #94A3B8;
            font-style: italic;
        }

        @media (max-width: 1100px) {
            :global(.entry-row) {
                grid-template-columns: 1fr 1fr;
                gap: 20px;
            }
            .row-actions {
                grid-column: span 2;
                justify-content: flex-start;
                border-top: 1px solid #F1F5F9;
                padding-top: 16px;
                margin-top: 4px;
                width: 100%;
            }
        }

        @media (max-width: 640px) {
            :global(.entry-row) {
                display: flex !important;
                flex-direction: column !important;
                align-items: stretch !important;
                padding: 24px 20px 20px;
                gap: 16px;
                width: 100% !important;
                position: relative;
            }
            .file-info-stack {
                max-width: 100% !important; 
                padding-right: 48px; /* Safe space for top-right delete button */
            }
            .file-info-stack h4 {
                max-width: 100% !important;
                font-size: 14px;
            }
            .row-main, .row-status, .row-actions {
                width: 100% !important;
                display: flex !important;
            }
            .row-status {
                justify-content: space-between;
                margin: 0;
            }
            .row-actions {
                flex-direction: row;
                gap: 12px;
                padding-top: 16px;
                border-top: 1px solid #F1F5F9;
                margin-top: 4px;
            }
            .action-group {
                display: flex;
                gap: 10px;
                width: 100%;
            }
            .action-btn-main {
                flex: 1;
                font-size: 12.5px;
                height: 44px;
            }
            .desktop-only-delete { display: none; }
            .mobile-only { display: flex; }
            .divider-vert { display: none; }
        }

        @media (max-width: 480px) {
            :global(.entry-row) {
                padding: 16px;
            }
        }

        .spin {
          animation: spin 2s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Intelligence Modal Styles using Portal */
        :global(.intel-overlay) {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(12px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        :global(.intel-card) {
          background: #FCFBF4; /* Cream base */
          width: 95%;
          max-width: 500px;
          max-height: 80vh;
          border-radius: 24px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 40px 100px -20px rgba(0, 0, 0, 0.3);
          border: 1px solid #E2E8F0;
        }

        :global(.intel-header) {
          padding: 16px 24px;
          background: #F1F5F9; /* Silvery/Light grey */
          border-bottom: 1px solid #E2E8F0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        :global(.intel-title) {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        :global(.icon-box) {
           width: 32px;
           height: 32px;
           background: #EEF2FF;
           color: #6366F1;
           border-radius: 10px;
           display: flex;
           align-items: center;
           justify-content: center;
           border: 1px solid #E0E7FF;
        }

        :global(.title-stack) {
          min-width: 0;
          flex: 1;
        }

        :global(.title-stack h2) {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
          color: #0F172A;
          line-height: 1.2;
        }
        
        :global(.subtitle) {
          font-size: 11px;
          font-weight: 500;
          color: #64748B;
          display: block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 320px; /* Default desktop max-width */
        }

        :global(.intel-body) {
          padding: 24px 32px;
          overflow-y: auto;
          flex: 1;
          background: #FCFBF4; /* Warm cream */
          -webkit-overflow-scrolling: touch;
        }

        :global(.intel-content-wrapper) {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          padding: 32px;
          border-radius: 20px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.02);
          background-image: linear-gradient(to bottom right, #FFFFFF, #F8FAFC);
        }
        
        :global(.report-badge) {
          display: inline-block;
          font-size: 8px;
          font-weight: 800;
          color: #94A3B8;
          letter-spacing: 0.12em;
          padding: 4px 8px;
          border-radius: 6px;
          background: #F1F5F9;
          margin-bottom: 20px;
        }

        @media (max-width: 640px) {
            :global(.intel-card) {
                max-height: 85vh;
                width: 92%;
                overflow-x: hidden; /* Prevent horizontal scroll on card */
            }
            :global(.intel-header) {
                padding: 12px 16px;
            }
            :global(.intel-body) {
                padding: 16px;
            }
            :global(.mobile-flat-content) {
                background: transparent !important;
                border: none !important;
                padding: 0 !important;
                box-shadow: none !important;
            }
            :global(.intel-footer) {
                padding: 12px 16px;
            }
            :global(.subtitle) {
                max-width: 140px !important; /* Extremely strict to ensure no overflow */
            }
        }

        /* Generated Content Styles */
        :global(.spacer) {
          height: 24px;
        }
        
        :global(.report-header) {
          font-size: 16px;
          font-weight: 700;
          color: #1E293B;
          margin: 32px 0 16px 0;
          padding-left: 14px;
          border-left: 4px solid #6366F1;
          line-height: 1.5;
          letter-spacing: -0.01em;
          word-break: break-word;
          overflow-wrap: anywhere;
        }
        
        :global(.report-header:first-of-type) {
          margin-top: 0;
        }

        :global(.report-list-item) {
          display: flex;
          gap: 12px;
          margin-bottom: 20px; /* Increased gap between points */
          line-height: 1.6;
          align-items: flex-start;
        }
        
        :global(.bullet) {
          color: #CBD5E1;
          font-weight: 800;
        }

        :global(.item-content) {
          color: #334155;
          font-size: 14px;
          font-weight: 400; /* Regular weight for content */
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        :global(.report-text) {
          font-size: 14px;
          line-height: 1.7;
          color: #475569;
          margin-bottom: 16px;
          font-weight: 400; /* Regular weight for text */
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        :global(.intel-footer) {
          padding: 16px 24px;
          background: #F1F5F9; /* Silvery footer */
          border-top: 1px solid #E2E8F0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        :global(.copy-btn) {
          background: white;
          color: #334155;
          border: 1px solid #E2E8F0;
          padding: 8px 16px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .copy-btn:hover {
          background: #F8FAFC;
          border-color: #CBD5E1;
          transform: translateY(-1px);
        }

        :global(.ai-meta) {
           display: flex;
           align-items: center;
           gap: 10px;
        }
        
        .model-tag {
           font-size: 11px;
           font-weight: 600;
           color: #64748B;
        }
        
        .secure-tag {
           display: flex;
           align-items: center;
           gap: 4px;
           font-size: 9px;
           font-weight: 700;
           color: #10B981;
           background: #ECFDF5;
           padding: 3px 6px;
           border-radius: 100px;
           text-transform: uppercase;
        }

        .close-btn {
          background: transparent;
          border: 1px solid transparent;
          color: #94A3B8;
          cursor: pointer;
          padding: 6px;
          border-radius: 8px;
          display: flex;
          transition: all 0.2s;
        }
        .close-btn:hover { background: #fee2e2; color: #ef4444; border-color: #fca5a5; }
        
        /* Custom Scrollbar */
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #FAFAFA;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #CBD5E1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94A3B8;
        }
      `}</style>
    </div>
  )
}
