import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Upload, X, Loader2, AlertCircle, Sparkles, FileImage } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface AnalysisResult {
  id: string
  findings: string
  image_filename: string
  context?: string
  created_at: string
}

export default function ImageAnalysis() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [additionalContext, setAdditionalContext] = useState('')
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/')
      return
    }
    setUser(session.user as AuthUser)
    setLoading(false)
  }

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  const handleNewAnalysis = () => {
    setCurrentAnalysis(null)
    setSelectedImage(null)
    setImagePreview(null)
    setAdditionalContext('')
    setError(null)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid image file (JPEG, PNG, or WebP)')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image size must be less than 10MB')
      return
    }

    setSelectedImage(file)
    setError(null)

    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      const fakeEvent = {
        target: { files: [file] }
      } as any
      handleFileSelect(fakeEvent)
    }
  }

  const handleAnalyze = async () => {
    if (!selectedImage) {
      setError('Please select an image first')
      return
    }

    setAnalyzing(true)
    setError(null)

    try {
      const authToken = await getAuthToken()
      if (!authToken) throw new Error('Not authenticated')

      const formData = new FormData()
      formData.append('image', selectedImage)
      if (additionalContext.trim()) {
        formData.append('context', additionalContext)
      }

      const response = await fetch(`${API_URL}/api/image/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to analyze image')
      }

      const data = await response.json()
      
      setCurrentAnalysis({
        ...data,
        image_filename: selectedImage.name,
        context: additionalContext
      })
      
    } catch (err: any) {
      console.error('Failed to analyze image:', err)
      setError(err.message || 'Failed to analyze image. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  if (loading || !user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Loader2 size={48} className="animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Medical Image Analysis - Vaidya AI</title>
      </Head>
      <DashboardLayout user={user}>
        <div style={{ 
          height: '100%',
          overflow: 'auto',
          background: '#FAFAFA'
        }}>
          <div style={{ 
            maxWidth: '1200px', 
            margin: '0 auto', 
            padding: '2rem'
          }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.5rem' }}>
                Medical Image Analysis
              </h1>
              <p style={{ color: '#64748B', fontSize: '1rem' }}>
                Upload medical images for AI-powered analysis and interpretation
              </p>
            </div>

            {/* Upload Section */}
            {!currentAnalysis && (
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                border: '2px solid #E2E8F0',
                marginBottom: '2rem'
              }}>
                {!imagePreview ? (
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed #CBD5E1',
                      borderRadius: '12px',
                      padding: '3rem 2rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: '#F8FAFC'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#3B82F6'
                      e.currentTarget.style.background = '#EFF6FF'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#CBD5E1'
                      e.currentTarget.style.background = '#F8FAFC'
                    }}
                  >
                    <Upload size={48} color="#3B82F6" style={{ margin: '0 auto 1rem' }} />
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem' }}>
                      Upload Medical Image
                    </h3>
                    <p style={{ color: '#64748B', fontSize: '0.875rem', marginBottom: '1rem' }}>
                      Drag and drop or click to browse
                    </p>
                    <p style={{ color: '#94A3B8', fontSize: '0.75rem' }}>
                      Supports: X-rays, CT scans, MRI, Ultrasound (JPEG, PNG, WebP • Max 10MB)
                    </p>
                  </div>
                ) : (
                  <div>
                    <div style={{ position: 'relative', marginBottom: '1rem' }}>
                      <img
                        src={imagePreview}
                        alt="Selected medical image"
                        style={{
                          width: '100%',
                          height: 'auto',
                          maxHeight: '400px',
                          objectFit: 'contain',
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0'
                        }}
                      />
                      <button
                        onClick={() => {
                          setSelectedImage(null)
                          setImagePreview(null)
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          background: 'rgba(0,0,0,0.6)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: 'white'
                        }}
                      >
                        <X size={20} />
                      </button>
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>
                        Additional Context (Optional)
                      </label>
                      <textarea
                        value={additionalContext}
                        onChange={(e) => setAdditionalContext(e.target.value)}
                        placeholder="e.g., Patient age, symptoms, clinical history..."
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '2px solid #E2E8F0',
                          borderRadius: '8px',
                          fontSize: '0.875rem',
                          resize: 'vertical',
                          minHeight: '80px',
                          fontFamily: 'inherit'
                        }}
                      />
                    </div>
                    <button
                      onClick={handleAnalyze}
                      disabled={analyzing}
                      style={{
                        width: '100%',
                        background: analyzing ? '#94A3B8' : 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '0.875rem',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        fontWeight: 700,
                        cursor: analyzing ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      {analyzing ? (
                        <>
                          <Loader2 size={20} className="animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles size={20} />
                          Analyze Image
                        </>
                      )}
                    </button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </div>
            )}

            {/* Results Section */}
            {currentAnalysis && (
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                border: '2px solid #E2E8F0',
                marginBottom: '2rem'
              }}>
                {/* Image Preview */}
                {imagePreview && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <img
                      src={imagePreview}
                      alt={currentAnalysis.image_filename}
                      style={{
                        width: '100%',
                        maxHeight: '400px',
                        objectFit: 'contain',
                        borderRadius: '8px',
                        border: '1px solid #E5E7EB'
                      }}
                    />
                  </div>
                )}

                {/* Image Info */}
                <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      background: '#EFF6FF',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <FileImage size={24} color="#3B82F6" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0F172A', margin: '0 0 0.25rem 0' }}>
                        {currentAnalysis.image_filename}
                      </p>
                      {currentAnalysis.context && (
                        <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0 }}>
                          Context: {currentAnalysis.context}
                        </p>
                      )}
                      <p style={{ fontSize: '0.75rem', color: '#94A3B8', margin: '0.25rem 0 0 0' }}>
                        {new Date(currentAnalysis.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Analysis Results */}
                <div className="markdown-content">
                  <ReactMarkdown>{currentAnalysis.findings}</ReactMarkdown>
                </div>

                {/* New Analysis Button */}
                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #E2E8F0' }}>
                  <button
                    onClick={handleNewAnalysis}
                    style={{
                      width: '100%',
                      background: 'white',
                      color: '#3B82F6',
                      border: '2px solid #3B82F6',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#3B82F6'
                      e.currentTarget.style.color = 'white'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'white'
                      e.currentTarget.style.color = '#3B82F6'
                    }}
                  >
                    Analyze Another Image
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div
                style={{
                  padding: '1rem',
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '2rem'
                }}
              >
                <AlertCircle size={20} color="#DC2626" />
                <span style={{ color: '#DC2626', fontSize: '0.875rem' }}>{error}</span>
              </div>
            )}
          </div>
        </div>

        <style jsx global>{`
          .markdown-content {
            color: #334155;
            font-size: 0.875rem;
            line-height: 1.7;
          }
          .markdown-content h1, .markdown-content h2, .markdown-content h3 {
            color: #0F172A;
            font-weight: 700;
            margin: 1rem 0 0.5rem 0;
          }
          .markdown-content h1 { font-size: 1.25rem; }
          .markdown-content h2 { font-size: 1.125rem; }
          .markdown-content h3 { font-size: 1rem; }
          .markdown-content p {
            margin: 0.75rem 0;
          }
          .markdown-content strong {
            font-weight: 700;
            color: #1E293B;
          }
          .markdown-content ul, .markdown-content ol {
            margin: 0.75rem 0;
            padding-left: 1.5rem;
          }
          .markdown-content li {
            margin: 0.5rem 0;
          }
          .markdown-content code {
            background: #E2E8F0;
            padding: 0.125rem 0.25rem;
            border-radius: 0.25rem;
            font-size: 0.8125rem;
          }
        `}</style>
      </DashboardLayout>
    </>
  )
}
