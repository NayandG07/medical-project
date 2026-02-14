import { useState, useRef } from 'react'
import {
  Upload, X, FileText, CheckCircle, AlertCircle,
  Loader2, MessageSquare, FileQuestion, BookOpen,
  Lightbulb, Sparkles, ShieldCheck, Zap
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface DocumentUploadProps {
  onUploadSuccess: () => void
  onUploadError: (error: string) => void
  onClose?: () => void
}

type Feature = 'chat' | 'mcq' | 'flashcard' | 'explain' | 'highyield'

export default function DocumentUpload({ onUploadSuccess, onUploadError, onClose }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedFeature, setSelectedFeature] = useState<Feature>('chat')
  const [isDragging, setIsDragging] = useState(false)
  const [showFeatureSelect, setShowFeatureSelect] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const features = [
    { id: 'chat' as Feature, name: 'Clinical Chat (RAG)', icon: MessageSquare, color: '#4F46E5', desc: 'Interact with medical records using AI' },
    { id: 'mcq' as Feature, name: 'Medical MCQs', icon: FileQuestion, color: '#10B981', desc: 'Generate board-style questions' },
    { id: 'flashcard' as Feature, name: 'Active Recall', icon: BookOpen, color: '#F59E0B', desc: 'Auto-generate study flashcards' },
    { id: 'explain' as Feature, name: 'Expert Explain', icon: Lightbulb, color: '#EF4444', desc: 'Simplify complex clinical concepts' },
    { id: 'highyield' as Feature, name: 'High Yield', icon: Sparkles, color: '#8B5CF6', desc: 'Extract high-yield medical facts' },
  ]

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    validateAndSetFile(file)
  }

  const validateAndSetFile = (file: File | undefined) => {
    if (file) {
      const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp']
      if (!validTypes.includes(file.type)) {
        onUploadError('Invalid file type. Please upload a PDF or image file.')
        return
      }

      const maxSize = 50 * 1024 * 1024 // Increased to 50MB
      if (file.size > maxSize) {
        onUploadError('File too large. Maximum size is 50MB.')
        return
      }

      setSelectedFile(file)
      setShowFeatureSelect(true)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    setProgress(0)

    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('feature', selectedFeature)

      const xhr = new XMLHttpRequest()
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
      })

      xhr.addEventListener('load', () => {
        if (xhr.status === 201) {
          const response = JSON.parse(xhr.responseText)
          sessionStorage.setItem('activeDocument', JSON.stringify({
            id: response.id,
            filename: selectedFile.name,
            feature: selectedFeature,
            timestamp: Date.now()
          }))

          const getRedirectPath = (feat: Feature) => {
            if (feat === 'chat') return '/chat'
            if (feat === 'explain') return '/explain'
            if (feat === 'highyield') return '/highyield'
            return `/${feat}s`
          }

          if (onClose) {
            onUploadSuccess()
            onClose()
            // Optional: delay redirect to show success state
            setTimeout(() => {
              window.location.href = `${getRedirectPath(selectedFeature)}?document=${response.id}`
            }, 500)
          } else {
            window.location.href = `${getRedirectPath(selectedFeature)}?document=${response.id}`
          }
        } else {
          let errorMessage = 'Vault synchronization failed'
          try {
            const response = JSON.parse(xhr.responseText)
            if (response.detail) {
              errorMessage = response.detail
            }
          } catch (e) {
            // Use default error message if parsing fails
          }
          onUploadError(errorMessage)
        }
        setUploading(false)
      })

      xhr.open('POST', `${process.env.NEXT_PUBLIC_API_URL}/api/documents`)
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.send(formData)
    } catch (error: any) {
      onUploadError(error.message)
      setUploading(false)
    }
  }

  return (
    <div className="vault-upload-modal">
      <header className="modal-header">
        <div className="header-icon"><ShieldCheck size={20} color="#4F46E5" /></div>
        <div className="header-text">
          <h3>New Archive Synchronization</h3>
          <p>Upload medical files for secure AI indexing</p>
        </div>
        {onClose && (
          <button className="close-trigger" onClick={onClose} disabled={uploading}>
            <X size={20} />
          </button>
        )}
      </header>

      <div className="modal-body" data-lenis-prevent>
        {!selectedFile ? (
          <div
            className={`upload-hero ${isDragging ? 'dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); validateAndSetFile(e.dataTransfer.files?.[0]); }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" hidden onChange={handleFileSelect} />
            <div className="upload-icon-ring"><Upload size={28} /></div>
            <h4>Drop clinical records here</h4>
            <p>PDF or medical imagery supported (Up to 50MB)</p>
          </div>
        ) : (
          <div className="sync-config-area">
            <div className="file-strip">
              <FileText size={24} color="#4F46E5" />
              <div className="file-details">
                <span className="name">{selectedFile.name}</span>
                <span className="size">{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB ready for indexing</span>
              </div>
              {!uploading && (
                <button className="reset-btn" onClick={() => setSelectedFile(null)}>
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="feature-selection">
              <label>Intelligence Selection</label>
              <div className="feature-list-vertical">
                {features.map(f => (
                  <button
                    key={f.id}
                    className={`feature-row ${selectedFeature === f.id ? 'active' : ''}`}
                    onClick={() => setSelectedFeature(f.id)}
                    disabled={uploading}
                  >
                    <div className="f-icon" style={{ background: `${f.color}15`, color: f.color }}>
                      <f.icon size={18} />
                    </div>
                    <div className="f-text">
                      <span className="f-name">{f.name}</span>
                      <span className="f-desc">{f.desc}</span>
                    </div>
                    <div className="active-dot" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="modal-footer">
        <button className="cancel-pill" onClick={onClose} disabled={uploading}>Cancel</button>
        <button
          className="sync-action-btn"
          disabled={!selectedFile || uploading}
          onClick={handleUpload}
        >
          {uploading ? (
            <>
              <Loader2 className="spin" size={18} />
              <span>Processing... {progress}%</span>
            </>
          ) : (
            <>
              <Zap size={18} />
              <span>Initialize Synchronization</span>
            </>
          )}
        </button>
      </footer>

      <style jsx>{`
            .vault-upload-modal {
                background: white;
                width: 100%;
                max-width: 520px;
                border-radius: 32px;
                box-shadow: 0 30px 60px -12px rgba(15, 23, 42, 0.25);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                border: 1px solid rgba(0,0,0,0.05);
            }

            .modal-header {
                padding: 24px 32px;
                display: flex;
                align-items: center;
                gap: 16px;
                border-bottom: 1px solid #F1F5F9;
            }

            .header-icon {
                width: 44px; height: 44px; background: #F5F7FF; border-radius: 14px;
                display: flex; align-items: center; justify-content: center;
            }

            .header-text h3 { margin: 0; font-size: 18px; font-weight: 850; color: #0F172A; letter-spacing: -0.02em; }
            .header-text p { margin: 4px 0 0; font-size: 13px; color: #64748B; font-weight: 600; }

            .close-trigger {
                margin-left: auto; background: none; border: none; color: #94A3B8; cursor: pointer;
                width: 36px; height: 36px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
                transition: all 0.2s;
            }
            .close-trigger:hover { background: #F1F5F9; color: #0F172A; }

            .modal-body { 
                padding: 32px; 
                overflow-y: auto; 
                max-height: 60vh;
                scrollbar-width: none;
            }
            .modal-body::-webkit-scrollbar { display: none; }

            .upload-hero {
                padding: 48px 32px; border: 2px dashed #E2E8F0; border-radius: 24px; text-align: center;
                cursor: pointer; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            .upload-hero:hover { border-color: #4F46E5; background: #F8FAFF; transform: scale(1.01); }
            .upload-hero.dragging { border-color: #4F46E5; background: #EEF2FF; }

            .upload-icon-ring {
                width: 60px; height: 60px; background: #EEF2FF; color: #4F46E5; border-radius: 50%;
                display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;
                box-shadow: 0 0 0 8px #F5F7FF;
            }

            .upload-hero h4 { font-size: 16px; fontWeight: 800; color: #0F172A; margin: 0 0 8px; }
            .upload-hero p { font-size: 13px; color: #64748B; font-weight: 600; margin: 0; }

            .sync-config-area { display: flex; flex-direction: column; gap: 24px; }

            .file-strip {
                background: #F8FAFC; padding: 16px 20px; border-radius: 16px; display: flex; align-items: center; gap: 16px;
                border: 1px solid #E2E8F0;
            }
            .file-details { display: flex; flex-direction: column; flex: 1; min-width: 0; }
            .file-details .name { font-size: 14px; font-weight: 800; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .file-details .size { font-size: 12px; font-weight: 600; color: #64748B; }

            .reset-btn {
                background: white; border: 1px solid #E2E8F0; width: 28px; height: 28px; border-radius: 50%;
                display: flex; align-items: center; justify-content: center; color: #94A3B8; cursor: pointer;
            }

            .feature-selection label { font-size: 11px; font-weight: 850; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 12px; }

            .feature-list-vertical { display: flex; flex-direction: column; gap: 10px; }

            .feature-row {
                width: 100%; display: flex; align-items: center; gap: 16px; padding: 14px; border: 1px solid #F1F5F9;
                background: white; border-radius: 16px; cursor: pointer; transition: all 0.2s; text-align: left;
                position: relative;
            }
            .feature-row:hover:not(:disabled) { border-color: #4F46E5; background: #F8FAFF; }
            .feature-row.active { border-color: #4F46E5; background: #EEF2FF; }

            .f-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
            .f-text { display: flex; flex-direction: column; flex: 1; }
            .f-name { font-size: 14px; font-weight: 800; color: #0F172A; }
            .f-desc { font-size: 11px; font-weight: 600; color: #64748B; margin-top: 2px; }

            .active-dot {
                width: 10px; height: 10px; border: 2px solid #E2E8F0; border-radius: 50%; margin-left: auto;
                transition: all 0.2s;
            }
            .feature-row.active .active-dot { background: #4F46E5; border-color: #4F46E5; transform: scale(1.2); }

            .modal-footer {
                padding: 24px 32px; background: #F8FAFC; border-top: 1px solid #F1F5F9;
                display: flex; align-items: center; justify-content: flex-end; gap: 16px;
            }

            .cancel-pill {
                background: none; border: none; font-size: 14px; font-weight: 800; color: #64748B; cursor: pointer;
                transition: all 0.2s;
            }
            .cancel-pill:hover { color: #0F172A; }

            .sync-action-btn {
                background: #0F172A; color: white; border: none; height: 52px; padding: 0 24px; border-radius: 16px;
                font-size: 14px; font-weight: 800; display: flex; align-items: center; gap: 12px; cursor: pointer;
                transition: all 0.3s;
            }
            .sync-action-btn:hover:not(:disabled) { background: #000; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
            .sync-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

            .spin { animation: spin 1s linear infinite; }
            @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
    </div>
  )
}
