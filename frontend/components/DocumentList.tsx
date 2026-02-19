import { useState } from 'react'
import {
  FileText, Trash2, Clock, CheckCircle2, AlertCircle, AlertTriangle,
  Loader2, MoreVertical, ExternalLink, MessageSquare,
  FileQuestion, BookOpen, Lightbulb, Sparkles, Zap,
  Search, Eye, HardDrive, Download, ChevronRight, Share
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/router'

export interface Document {
  id: string
  user_id: string
  filename: string
  file_type: string
  file_size: number
  storage_path: string
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message?: string
  feature: 'chat' | 'mcq' | 'flashcard' | 'explain' | 'highyield'
  created_at: string
}

interface DocumentListProps {
  documents: Document[]
  onDelete: (documentId: string) => Promise<void>
  loading?: boolean
}

export default function DocumentList({ documents, onDelete, loading }: DocumentListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showFeatureMenu, setShowFeatureMenu] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // New States for Processing Feedback
  const [navigatingFeature, setNavigatingFeature] = useState<string | null>(null)
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const features = [
    { id: 'chat', name: 'Clinical Analysis', icon: MessageSquare, color: '#4F46E5' },
    { id: 'mcq', name: 'Practice MCQ', icon: FileQuestion, color: '#10B981' },
    { id: 'flashcard', name: 'Recall Study', icon: BookOpen, color: '#F59E0B' },
  ]

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleDelete = (documentId: string) => {
    setDeleteConfirmationId(documentId)
  }

  if (documents.length === 0) {
    return (
      <div className="empty-scene">
        <div className="scene-icon"><HardDrive size={32} /></div>
        <h3>No Medical Archives</h3>
        <p>Your vault is clear. Drag medical records here to begin AI-powered indexing.</p>
        <style jsx>{`
          .empty-scene { 
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px; 
            text-align: center; 
          }
          .scene-icon { width: 64px; height: 64px; background: #F8FAFC; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; color: #94A3B8; }
          h3 { font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 8px 0; }
          p { color: #64748B; font-weight: 600; margin: 0; font-size: 14px; }
        `}</style>
      </div>
    )
  }

  return (
    <div className="modern-grid">
      <AnimatePresence>
        {documents.map((doc, idx) => (
          <motion.div
            key={doc.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onMouseEnter={() => setHoveredId(doc.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{ width: '100%' }}
          >
            <div className="modern-card">
              {/* Card Content */}
              <div className="card-top">
                <div className="file-avatar">
                  <FileText size={22} color={doc.processing_status === 'completed' ? '#4F46E5' : '#94A3B8'} />
                </div>
                <div className="status-pill" data-status={doc.processing_status}>
                  {doc.processing_status.toUpperCase()}
                </div>
                <div className="top-actions">
                  <button className="h-action" onClick={() => handleDelete(doc.id)} title="Purge Archive">
                    {deletingId === doc.id ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                  </button>
                </div>
              </div>

              <div className="card-mid">
                <h4 title={doc.filename}>{doc.filename}</h4>
                <div className="file-meta">
                  <div className="meta-item">
                    <HardDrive size={12} />
                    <span>{formatFileSize(doc.file_size)}</span>
                  </div>
                  <span className="dot">•</span>
                  <div className="meta-item">
                    <Clock size={12} />
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="card-bottom">
                <button
                  className={`primary-intel-btn ${showFeatureMenu === doc.id ? 'active' : ''}`}
                  onClick={() => setShowFeatureMenu(showFeatureMenu === doc.id ? null : doc.id)}
                >
                  <Sparkles size={16} />
                  <span>AI Intelligence</span>
                  <ChevronRight size={16} className={`arrow ${showFeatureMenu === doc.id ? 'rot' : ''}`} />
                </button>

                <button className="secondary-icon-btn" title="Download Source"><Download size={18} /></button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* AI Intelligence Selection Hub - Moved to Root to fix Stacking Context */}
      <AnimatePresence>
        {showFeatureMenu && (
          <div className="intel-overlay-context" onClick={() => setShowFeatureMenu(null)}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="intel-backdrop"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{ width: '100%', maxWidth: '400px', zIndex: 1001, position: 'relative' }}
            >
              <div
                className="ai-intel-hub-card"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="hub-header">
                  <div className="hub-title-wrap">
                    <Zap size={18} color="#4F46E5" />
                    <div>
                      <h6>Intelligence Hub</h6>
                      <p>Select specialized AI analysis module</p>
                    </div>
                  </div>
                  <button className="close-hub" onClick={() => setShowFeatureMenu(null)}>&times;</button>
                </div>

                <div className="hub-options">
                  {features.map(f => (
                    <button
                      key={f.id}
                      className="hub-option-card"
                      onClick={() => {
                        setNavigatingFeature(f.id)
                        const path = f.id === 'chat' ? '/chat' :
                          f.id === 'explain' ? '/explain' :
                            f.id === 'highyield' ? '/highyield' :
                              `/${f.id}s`
                        router.push(`${path}?document=${showFeatureMenu}`)
                      }}
                      disabled={!!navigatingFeature}
                      style={{ '--brand-color': f.color } as any}
                    >
                      <div className="option-icon-box">
                        {navigatingFeature === f.id ? <Loader2 size={20} className="spin" /> : <f.icon size={20} />}
                      </div>
                      <div className="option-info">
                        <span className="option-name">
                          {navigatingFeature === f.id ? <span className="processing-text">Processing...</span> : f.name}
                        </span>
                        <span className="option-desc">Launch specialized indexing</span>
                      </div>
                      <ChevronRight size={14} className="option-arrow" />
                    </button>
                  ))}
                </div>

                <div className="hub-footer">
                  <div className="secure-tag">
                    <CheckCircle2 size={12} />
                    <span>Encrypted Clinical Processing</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .modern-grid { 
            display: flex;
            flex-direction: column;
            gap: 16px;
            padding: 4px;
        }
        
        .modern-card {
            background: white;
            border: 1px solid #CBD5E1 !important;
            border-radius: 20px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 2px;
            box-shadow: 
                0 4px 6px -1px rgba(15, 23, 42, 0.08), 
                0 10px 15px -3px rgba(15, 23, 42, 0.04) !important;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            position: relative;
        }

        .modern-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 24px -8px rgba(15, 23, 42, 0.08);
            border-color: #818CF8;
        }

        .card-top { 
            display: flex; 
            align-items: center; 
            justify-content: space-between; 
            position: relative;
            margin-bottom: 0px;
        }
        
        .file-avatar { 
            width: 38px; height: 38px; background: #EEF2FF; border-radius: 12px; 
            display: flex; align-items: center; justify-content: center;
            color: #4F46E5;
        }

        .status-pill {
            font-size: 9px; font-weight: 800; letter-spacing: 0.05em; padding: 4px 10px; border-radius: 8px;
            text-transform: uppercase;
        }
        .status-pill[data-status="completed"] { background: #ECFDF5; color: #059669; }
        .status-pill[data-status="processing"] { background: #FFFBEB; color: #D97706; }
        .status-pill[data-status="failed"] { background: #FEF2F2; color: #DC2626; }

        .top-actions { margin-left: auto; }
        .h-action { 
            background: transparent; border: none; color: #94A3B8; cursor: pointer; padding: 6px; border-radius: 8px;
            transition: all 0.2s;
            display: flex; align-items: center; justify-content: center;
        }
        .h-action:hover { color: #EF4444; background: #FEF2F2; }

        .card-mid { 
            display: flex; 
            flex-direction: column; 
            gap: 6px;
            margin-top: 2px;
        }
        .card-mid h4 { 
            font-size: 15px; font-weight: 700; color: #0F172A; margin: 0; 
            letter-spacing: -0.01em; line-height: 1.4;
        }
        .file-meta { 
            display: flex; align-items: center; gap: 8px; 
            font-size: 12px; color: #64748B; font-weight: 500; 
        }
        .meta-item { display: flex; align-items: center; gap: 4px; }
        .dot { opacity: 0.3; }

        .card-bottom { 
            display: flex; 
            gap: 12px; 
            align-items: center; 
            margin-top: 6px;
            flex-wrap: wrap; 
        }
        
        .primary-intel-btn {
            flex: 1; background: #0F172A; color: white; border: none; border-radius: 12px;
            height: 40px; font-weight: 700; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 8px;
            cursor: pointer; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.1);
        }
        .primary-intel-btn:hover { 
            background: #000; 
            transform: translateY(-1px); 
            box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.2);
        }
        .primary-intel-btn.active { background: #4F46E5; }

        .arrow { transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .arrow.rot { transform: rotate(90deg); }

        .secondary-icon-btn {
            width: 40px; height: 40px; background: white; border: 1px solid #E2E8F0; border-radius: 12px;
            color: #64748B; display: flex; align-items: center; justify-content: center; cursor: pointer;
            transition: all 0.2s;
        }
        .secondary-icon-btn:hover { background: #F8FAFC; color: #0F172A; border-color: #CBD5E1; transform: translateY(-1px); }

        /* REFACTORED AI INTEL HUB */
        .intel-overlay-context {
            position: fixed;
            inset: 0;
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }

        .intel-backdrop {
            position: absolute;
            inset: 0;
            background: rgba(15, 23, 42, 0.4);
            backdrop-filter: blur(4px);
        }

        .ai-intel-hub-card {
            position: relative;
            background: white; /* SOLID WHITE */
            border-radius: 24px;
            padding: 24px;
            box-shadow: 
                0 0 0 1px rgba(0,0,0,0.05),
                0 25px 50px -12px rgba(0, 0, 0, 0.25);
            border: 1px solid #CBD5E1;
        }

        .hub-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px solid #F1F5F9;
        }

        .hub-title-wrap { display: flex; gap: 12px; }
        .hub-title-wrap h6 { font-size: 16px; font-weight: 700; color: #0F172A; margin: 0; letter-spacing: -0.01em; }
        .hub-title-wrap p { font-size: 12px; color: #64748B; font-weight: 500; margin: 2px 0 0 0; }

        .close-hub {
            background: #F8FAFC; border: none; width: 28px; height: 28px; border-radius: 8px;
            color: #64748B; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;
            transition: all 0.2s;
        }
        .close-hub:hover { background: #E2E8F0; color: #0F172A; }

        .hub-options { display: flex; flex-direction: column; gap: 10px; }

        .hub-option-card {
            display: flex; align-items: center; gap: 14px; padding: 16px; background: #F8FAFC;
            border: 1px solid rgba(15, 23, 42, 0.04); border-radius: 16px; cursor: pointer; text-align: left;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .hub-option-card:hover {
            background: white;
            border-color: var(--brand-color);
            transform: scale(1.01) translateY(-1px);
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);
        }

        .option-icon-box {
            width: 40px; height: 40px; background: white; border-radius: 12px; color: var(--brand-color);
            display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.03);
            transition: all 0.3s;
        }
        .hub-option-card:hover .option-icon-box {
            background: var(--brand-color);
            color: white;
        }

        .option-info { flex: 1; display: flex; flex-direction: column; }
        .option-name { font-size: 14px; font-weight: 700; color: #0F172A; }
        .option-desc { font-size: 11px; color: #64748B; font-weight: 500; margin-top: 1px; }

        .option-arrow { color: #CBD5E1; transition: transform 0.3s; }
        .hub-option-card:hover .option-arrow { transform: translateX(3px); color: var(--brand-color); }

        .hub-footer { margin-top: 20px; display: flex; justify-content: center; }
        .secure-tag {
            display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700;
            color: #10B981; text-transform: uppercase; letter-spacing: 0.05em;
            background: #ECFDF5; padding: 4px 10px; border-radius: 100px;
        }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        .processing-text { color: var(--brand-color); font-weight: 800; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }

        .modal-overlay {
            position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(4px);
            z-index: 2000; display: flex; align-items: center; justify-content: center;
            animation: fadeIn 0.2s ease-out;
        }
        .delete-modal {
            background: white; width: 320px; padding: 24px; border-radius: 24px; text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .warning-icon {
            width: 64px; height: 64px; background: #FEF2F2; color: #EF4444; border-radius: 20px;
            display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
        }
        
        /* Note: h3 and p are global in scoped style, better scope them or use specific classes if needed. 
           But since this is scoped jsx, h3 inside this component will be affected. 
           The existing h4/h6 are used in cards. Let's make sure we don't break them.
           Actually, the modal uses h3, cards use h4/h6. So targeting h3 is safe here or give it a class.
           Let's give the modal title a class to be safe? 
           The original code targeted 'h3', let's stick to it but maybe add .delete-modal > h3 to be safe if desired, 
           but simple h3 is fine as per original code.
        */
        h3 { font-size: 18px; font-weight: 800; color: #0F172A; margin: 0 0 8px; }
        p { font-size: 14px; color: #64748B; margin: 0 0 24px; line-height: 1.4; }
        
        .modal-actions { display: flex; gap: 12px; }
        .cancel-btn {
            flex: 1; padding: 12px; border-radius: 14px; border: 1px solid #E2E8F0; background: white;
            font-weight: 700; color: #64748B; cursor: pointer; transition: all 0.2s;
        }
        .cancel-btn:hover:not(:disabled) { background: #F8FAFC; color: #0F172A; }
        
        .confirm-delete-btn {
            flex: 1; padding: 12px; border-radius: 14px; border: none; background: #EF4444;
            font-weight: 700; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
            transition: all 0.2s;
        }
        .confirm-delete-btn:hover:not(:disabled) { background: #DC2626; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25); }
        .confirm-delete-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* Delete Confirmation Modal */}
      {deleteConfirmationId && (
        <div className="modal-overlay" onClick={() => !isDeleting && setDeleteConfirmationId(null)}>
          <div className="delete-modal" onClick={e => e.stopPropagation()}>
            <div className="warning-icon">
              <Trash2 size={32} />
            </div>
            <h3>Permanently Delete?</h3>
            <p>This archive and all its AI indexes will be removed forever.</p>
            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setDeleteConfirmationId(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className="confirm-delete-btn"
                onClick={async () => {
                  setIsDeleting(true)
                  try {
                    await onDelete(deleteConfirmationId)
                  } finally {
                    setIsDeleting(false)
                    setDeleteConfirmationId(null)
                  }
                }}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  'Delete Archive'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
