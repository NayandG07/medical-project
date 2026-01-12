import { useState, useRef } from 'react'
import {
  Upload,
  X,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  FileIcon,
  Image as ImageIcon,
  ShieldCheck
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'

interface DocumentUploadProps {
  onUploadSuccess: (document: any) => void
  onUploadError: (error: string) => void
}

export default function DocumentUpload({ onUploadSuccess, onUploadError }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      validateAndSetFile(file)
    }
  }

  const validateAndSetFile = (file: File) => {
    // Check file type
    const isPDF = file.type === 'application/pdf'
    const isImage = file.type.startsWith('image/')

    if (!isPDF && !isImage) {
      onUploadError('Only medical PDFs and clinical images are accepted.')
      return
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      onUploadError('File exceeds 10MB clinical processing limit.')
      return
    }

    setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    setProgress(0)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) throw new Error('Not authenticated')

      const formData = new FormData()
      formData.append('file', selectedFile)

      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${process.env.NEXT_PUBLIC_API_URL}/api/documents`, true)
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          // Cap at 98% to allow for "Finalizing" state
          const percent = Math.min(Math.round((event.loaded / event.total) * 100), 98)
          setProgress(percent)
        }
      }

      xhr.onload = () => {
        if (xhr.status === 201 || xhr.status === 200) {
          setProgress(100)
          try {
            const newDoc = JSON.parse(xhr.responseText)
            // Small delay to show 100%
            setTimeout(() => {
              onUploadSuccess(newDoc)
              setSelectedFile(null)
              setProgress(0)
              setUploading(false)
            }, 600)
          } catch (e) {
            onUploadSuccess(null)
            setUploading(false)
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText)
            onUploadError(err.detail || 'Processing failed')
          } catch {
            onUploadError('Intelligence ingestion failed')
          }
          setUploading(false)
        }
      }

      xhr.onerror = () => {
        onUploadError('Network sync error')
        setUploading(false)
      }

      xhr.send(formData)
    } catch (err: any) {
      onUploadError(err.message || 'Processing failed')
      setUploading(false)
    }
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = () => {
    setIsDragging(false)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0])
    }
  }

  return (
    <div className="upload-container">
      {!selectedFile ? (
        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="pulse-circle">
            <Upload size={32} />
          </div>
          <h3>Secure Data Ingestion</h3>
          <p>Drag clinical records or drag & drop high-res imaging here</p>
          <div className="format-badges">
            <span className="format">PDF</span>
            <span className="format">DICOM</span>
            <span className="format">JPEG</span>
            <span className="format">PNG</span>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".pdf,image/*"
            hidden
          />
        </div>
      ) : (
        <div className="preview-zone">
          <div className="file-info-box">
            <div className="file-meta">
              <div className="file-icon-wrap">
                {selectedFile.type === 'application/pdf' ? <FileText size={24} /> : <ImageIcon size={24} />}
              </div>
              <div className="file-details">
                <span className="file-name">{selectedFile.name}</span>
                <span className="file-size">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Detected: {selectedFile.type.split('/')[1].toUpperCase()}</span>
              </div>
            </div>
            <button className="remove-btn" onClick={() => setSelectedFile(null)} disabled={uploading}>
              <X size={18} />
            </button>
          </div>

          <div className="security-note">
            <ShieldCheck size={14} color="#10B981" />
            <span>Secure AES-256 encrypted transit for HIPAA compliance</span>
          </div>

          {!uploading ? (
            <button className="start-btn pulse-anim" onClick={handleUpload}>
              <Sparkles size={18} />
              <span>Upload & Analyze</span>
            </button>
          ) : (
            <div className="processing-state">
              <div className="progress-track">
                <motion.div
                  className="progress-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
              <div className="progress-labels">
                <span className="status">
                  <Loader2 size={14} className="spin" />
                  {progress < 100 ? 'Uploading...' : 'Finalizing Analysis...'}
                </span>
                <span className="percent">{progress}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .upload-container {
          width: 100%;
        }

        .drop-zone {
          border: 2px dashed #E2E8F0;
          background: #F8FAFC;
          border-radius: 24px;
          padding: 48px 32px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .drop-zone:hover, .drop-zone.dragging {
          border-color: #6366F1;
          background: #F5F7FF;
          transform: scale(0.99);
        }

        .pulse-circle {
          width: 72px;
          height: 72px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6366F1;
          box-shadow: 0 10px 20px -5px rgba(99, 102, 241, 0.15);
          margin-bottom: 8px;
        }

        .drop-zone h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
          color: #1E293B;
        }

        .drop-zone p {
          margin: 0;
          color: #64748B;
          font-size: 14px;
          font-weight: 600;
        }

        .format-badges {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }

        .format {
          font-size: 10px;
          font-weight: 800;
          background: white;
          color: #94A3B8;
          padding: 4px 8px;
          border-radius: 6px;
          border: 1px solid #E2E8F0;
        }

        .preview-zone {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .file-info-box {
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 20px;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .file-meta {
          display: flex;
          gap: 14px;
          align-items: center;
        }

        .file-icon-wrap {
          width: 48px;
          height: 48px;
          background: white;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6366F1;
          box-shadow: 0 4px 10px rgba(0,0,0,0.03);
        }

        .file-details {
          display: flex;
          flex-direction: column;
        }

        .file-name {
          font-size: 15px;
          font-weight: 700;
          color: #1E293B;
          max-width: 250px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-size {
          font-size: 12px;
          font-weight: 600;
          color: #94A3B8;
        }

        .remove-btn {
          background: transparent;
          border: none;
          color: #94A3B8;
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
        }

        .remove-btn:hover {
          background: #FEF2F2;
          color: #EF4444;
        }

        .security-note {
           display: flex;
           align-items: center;
           gap: 6px;
           justify-content: center;
           font-size: 11px;
           font-weight: 700;
           color: #64748B;
           letter-spacing: 0.02em;
        }

        .start-btn {
          background: #6366F1;
          color: white;
          border: none;
          padding: 18px;
          border-radius: 20px;
          font-weight: 800;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          cursor: pointer;
          box-shadow: 0 10px 20px -5px rgba(99, 102, 241, 0.3);
          transition: all 0.2s;
        }

        .start-btn:hover {
          background: #4F46E5;
          transform: translateY(-2px);
          box-shadow: 0 15px 30px -8px rgba(99, 102, 241, 0.4);
        }

        .processing-state {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .progress-track {
          height: 12px;
          background: #EEF2FF;
          border-radius: 100px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #6366F1 0%, #0EA5E9 100%);
          border-radius: 100px;
        }

        .progress-labels {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
          color: #475569;
        }

        .percent {
          font-size: 13px;
          font-weight: 800;
          color: #6366F1;
        }

        .spin {
          animation: spin 2s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .pulse-anim {
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(99, 102, 241, 0); }
          100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
        }
      `}</style>
    </div>
  )
}
