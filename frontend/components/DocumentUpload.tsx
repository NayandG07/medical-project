import { useState, useRef } from 'react'
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface DocumentUploadProps {
  onUploadSuccess: () => void
  onUploadError: (error: string) => void
}

export default function DocumentUpload({ onUploadSuccess, onUploadError }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        onUploadError('File too large. Maximum size is 10MB.')
        return
      }

      setSelectedFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    validateAndSetFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      onUploadError('Please select a file first')
      return
    }

    setUploading(true)
    setProgress(0)

    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      const supabase = createClient(supabaseUrl, supabaseAnonKey)

      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token

      if (!token) throw new Error('Not authenticated')

      const formData = new FormData()
      formData.append('file', selectedFile)

      const xhr = new XMLHttpRequest()
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100
          setProgress(Math.round(percentComplete))
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status === 201) {
          setSelectedFile(null)
          if (fileInputRef.current) fileInputRef.current.value = ''
          onUploadSuccess()
        } else {
          try {
            const response = JSON.parse(xhr.responseText)
            onUploadError(response.detail?.error?.message || 'Upload failed')
          } catch {
            onUploadError('Upload failed')
          }
        }
        setUploading(false)
        setProgress(0)
      })

      xhr.addEventListener('error', () => {
        onUploadError('Network error during upload')
        setUploading(false)
        setProgress(0)
      })

      xhr.open('POST', `${process.env.NEXT_PUBLIC_API_URL}/api/documents`)
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.send(formData)
    } catch (error: any) {
      onUploadError(error.message || 'Upload failed')
      setUploading(false)
      setProgress(0)
    }
  }

  return (
    <div className="upload-section">
      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <AnimatePresence mode="wait">
          {!selectedFile ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="zone-content"
            >
              <div className="icon-circle">
                <Upload size={24} color="#6366F1" />
              </div>
              <h3>Click or drag file to upload</h3>
              <p>Supported: PDF, JPG, PNG, GIF, BMP (Max 10MB)</p>
            </motion.div>
          ) : (
            <motion.div
              key="file"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="selected-file-preview"
            >
              <FileText size={40} color="#6366F1" />
              <div className="file-info">
                <h4>{selectedFile.name}</h4>
                <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              {!uploading && (
                <button className="remove-btn" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}>
                  <X size={18} />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {uploading && (
          <div className="upload-overlay">
            <div className="progress-container">
              <div className="progress-header">
                <Loader2 size={16} className="animate-spin" />
                <span>Uploading... {progress}%</span>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedFile && !uploading && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="start-upload-btn"
            onClick={handleUpload}
          >
            Confirm & Upload
          </motion.button>
        )}
      </AnimatePresence>

      <style jsx>{`
        .upload-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .drop-zone {
          background: white;
          border: 2px dashed #E2E8F0;
          border-radius: 24px;
          padding: 40px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
          min-height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .drop-zone:hover {
          border-color: #6366F1;
          background: #F8FAFF;
        }

        .drop-zone.dragging {
          border-color: #6366F1;
          background: #EEF2FF;
          transform: scale(1.01);
        }

        .drop-zone.has-file {
          border-style: solid;
        }

        .zone-content h3 {
          font-size: 18px;
          font-weight: 700;
          color: #1E293B;
          margin: 16px 0 8px;
        }

        .zone-content p {
          font-size: 14px;
          color: #64748B;
          margin: 0;
        }

        .icon-circle {
          width: 56px;
          height: 56px;
          background: #F5F7FF;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
        }

        .selected-file-preview {
          display: flex;
          align-items: center;
          gap: 20px;
          width: 100%;
          text-align: left;
          background: #F8FAFC;
          padding: 20px;
          border-radius: 16px;
        }

        .file-info h4 {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 700;
          color: #1E293B;
          word-break: break-all;
        }

        .file-info span {
          font-size: 13px;
          color: #64748B;
          font-weight: 600;
        }

        .remove-btn {
          margin-left: auto;
          background: white;
          border: 1px solid #E2E8F0;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #64748B;
          transition: all 0.2s;
        }

        .remove-btn:hover {
          background: #FEF2F2;
          color: #EF4444;
          border-color: #FEE2E2;
        }

        .upload-overlay {
          position: absolute;
          inset: 0;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }

        .progress-container {
          width: 100%;
          max-width: 300px;
        }

        .progress-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 12px;
          font-weight: 700;
          color: #1E293B;
        }

        .progress-bar-bg {
          height: 8px;
          background: #F1F5F9;
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background: #6366F1;
          transition: width 0.3s ease;
        }

        .start-upload-btn {
          background: #6366F1;
          color: white;
          border: none;
          padding: 14px;
          border-radius: 16px;
          font-weight: 700;
          font-size: 16px;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
          transition: all 0.2s;
        }

        .start-upload-btn:hover {
          background: #4F46E5;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
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
