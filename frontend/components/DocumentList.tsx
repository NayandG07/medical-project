import { useState } from 'react'
import { FileText, Trash2, Clock, CheckCircle2, AlertCircle, Loader2, MoreVertical, ExternalLink, MessageSquare } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
  onDelete: (documentId: string) => Promise<void>
  loading?: boolean
}

export default function DocumentList({ documents, onDelete, loading }: DocumentListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  const handleDelete = async (documentId: string) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      setDeletingId(documentId)
      try {
        await onDelete(documentId)
      } finally {
        setDeletingId(null)
      }
    }
  }

  if (loading) {
    return (
      <div className="loading-state">
        <Loader2 className="animate-spin" size={32} color="#6366F1" />
        <p>Loading your medical library...</p>
        <style jsx>{`
          .loading-state {
            padding: 60px;
            text-align: center;
            background: white;
            border-radius: 24px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.02);
          }
          .loading-state p {
            margin-top: 16px;
            color: #64748B;
            font-weight: 600;
          }
        `}</style>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="empty-state">
        <div className="icon-wrap">
          <FileText size={32} color="#94A3B8" />
        </div>
        <h3>No documents found</h3>
        <p>Upload your clinical notes or research papers to begin.</p>
        <style jsx>{`
          .empty-state {
            padding: 205px 40px;
            text-align: center;
            background: white;
            border-radius: 32px;
            border: 1px solid #E2E8F0;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02);
          }
          .icon-wrap {
            width: 64px;
            height: 64px;
            background: #F8FAFC;
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
          }
          h3 { font-size: 20px; font-weight: 800; color: #1E293B; margin: 0 0 8px 0; }
          p { color: #64748B; margin: 0; }
        `}</style>
      </div>
    )
  }

  return (
    <div className="doc-list-grid">
      <AnimatePresence>
        {documents.map((doc, index) => (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: index * 0.05 }}
            className="doc-card"
          >
            <div className="doc-header">
              <div className="doc-icon-wrap">
                <FileText size={20} color="#6366F1" />
              </div>
              <div className="status-badge" data-status={doc.processing_status}>
                {doc.processing_status === 'processing' && <Loader2 size={12} className="animate-spin" />}
                {doc.processing_status === 'completed' && <CheckCircle2 size={12} />}
                {doc.processing_status === 'failed' && <AlertCircle size={12} />}
                <span>{doc.processing_status}</span>
              </div>
              <button className="more-btn" onClick={() => handleDelete(doc.id)} disabled={deletingId === doc.id}>
                {deletingId === doc.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </button>
            </div>

            <div className="doc-body">
              <h4 title={doc.filename}>{doc.filename}</h4>
              <div className="doc-meta">
                <span>{doc.file_type.split('/')[1]?.toUpperCase() || doc.file_type.toUpperCase()}</span>
                <span className="dot"></span>
                <span>{formatFileSize(doc.file_size)}</span>
              </div>
            </div>

            <div className="doc-footer">
              <span className="date">{formatDate(doc.created_at)}</span>
              <div className="actions">
                <button className="action-icon-btn" title="Chat with document"><MessageSquare size={16} /></button>
                <button className="action-icon-btn" title="View document"><ExternalLink size={16} /></button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <style jsx>{`
        .doc-list-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }

        .doc-card {
          background: white;
          border-radius: 24px;
          padding: 20px;
          border: 1px solid #E2E8F0;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .doc-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.05);
          border-color: #EEF2FF;
        }

        .doc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .doc-icon-wrap {
          width: 36px;
          height: 36px;
          background: #F5F7FF;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .status-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .status-badge[data-status="completed"] { background: #F0FDFA; color: #10B981; }
        .status-badge[data-status="processing"] { background: #FFFBEB; color: #D97706; }
        .status-badge[data-status="failed"] { background: #FEF2F2; color: #EF4444; }
        .status-badge[data-status="pending"] { background: #F8FAFC; color: #64748B; }

        .more-btn {
          background: none;
          border: none;
          color: #94A3B8;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
        }

        .more-btn:hover {
          color: #EF4444;
          background: #FEF2F2;
        }

        .doc-body h4 {
          margin: 0 0 6px 0;
          font-size: 15px;
          font-weight: 700;
          color: #1E293B;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .doc-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #94A3B8;
          font-weight: 600;
        }

        .dot {
          width: 3px;
          height: 3px;
          background: #CBD5E1;
          border-radius: 50%;
        }

        .doc-footer {
          margin-top: auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 16px;
          border-top: 1px solid #F8FAFC;
        }

        .date {
          font-size: 12px;
          color: #94A3B8;
          font-weight: 500;
        }

        .actions {
          display: flex;
          gap: 8px;
        }

        .action-icon-btn {
          background: #F8FAFC;
          border: none;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748B;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-icon-btn:hover {
          background: #6366F1;
          color: white;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  )
}
