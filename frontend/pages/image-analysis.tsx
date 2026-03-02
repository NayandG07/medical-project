import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import SessionSidebar, { ChatSession } from '@/components/SessionSidebar'
import {
  Upload, X, Loader2, AlertCircle, Sparkles,
  FileImage, Microscope, Activity, ChevronRight,
  Maximize2, Download, Share2, Info, History
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { motion, AnimatePresence } from 'framer-motion'

interface AnalysisResult {
  id: string
  findings: string
  image_filename: string
  context?: string
  created_at: string
  image_preview?: string
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

  // Session handling state
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sessionsLoading, setSessionsLoading] = useState(false)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user) {
      loadSessions()
    }
  }, [user])

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

  const loadSessions = async () => {
    setSessionsLoading(true)
    try {
      const authToken = await getAuthToken()
      if (!authToken) return

      const response = await fetch(`${API_URL}/api/image/sessions`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      if (response.ok) {
        const data = await response.json()
        setSessions(data)
      }
    } catch (err) {
      console.error('Failed to load initial sessions:', err)
    } finally {
      setSessionsLoading(false)
    }
  }

  const handleNewAnalysis = () => {
    setCurrentAnalysis(null)
    setSelectedImage(null)
    setImagePreview(null)
    setAdditionalContext('')
    setError(null)
    setCurrentSessionId(null)
  }

  const handleSelectSession = async (sessionId: string) => {
    setSessionsLoading(true)
    try {
      const authToken = await getAuthToken()
      if (!authToken) return

      const response = await fetch(`${API_URL}/api/image/sessions/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentSessionId(sessionId)
        setCurrentAnalysis({
          id: data.id,
          findings: data.analysis_result.findings,
          image_filename: data.image_filename,
          context: data.context,
          created_at: data.created_at,
          image_preview: data.image_preview
        })
        setImagePreview(data.image_preview || null)
        setAdditionalContext(data.context || '')
        setSelectedImage(null)
      }
    } catch (err) {
      console.error('Failed to load session:', err)
      setError('Failed to load selected analysis')
    } finally {
      setSessionsLoading(false)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const authToken = await getAuthToken()
      if (!authToken) return

      const response = await fetch(`${API_URL}/api/image/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      if (response.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId))
        if (currentSessionId === sessionId) {
          handleNewAnalysis()
        }
      }
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }

  const handleDeleteAllSessions = async () => {
    try {
      const authToken = await getAuthToken()
      if (!authToken) return

      const response = await fetch(`${API_URL}/api/image/sessions/all`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      if (response.ok) {
        setSessions([])
        handleNewAnalysis()
      }
    } catch (err) {
      console.error('Failed to delete all sessions:', err)
    }
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

      // Refresh sessions and select the new one if ID returned
      if (data.session_id) {
        setCurrentSessionId(data.session_id)
        loadSessions()
      }

    } catch (err: any) {
      console.error('Failed to analyze image:', err)
      setError(err.message || 'Failed to analyze image. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, staggerChildren: 0.1 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  }

  if (loading || !user) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--cream-bg)] overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-[400px] h-[400px] bg-blue-200/40 rounded-full blur-[100px]"
        />
        <div className="relative mb-8">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 1.5] }}
              transition={{ duration: 3, repeat: Infinity, delay: i * 1, ease: "easeOut" }}
              className="absolute inset-0 bg-blue-500/20 rounded-full blur-sm"
            />
          ))}
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl border border-blue-100 z-10 relative"
          >
            <Microscope className="text-blue-600" size={24} />
          </motion.div>
        </div>
        <div className="text-center z-10">
          <h2 className="text-[22px] font-black text-[var(--cream-text-main)] tracking-tight mb-2">Diagnostic Console</h2>
          <div className="flex items-center justify-center gap-2">
            <span className="text-[12px] font-bold text-[var(--cream-text-muted)] tracking-wider uppercase">Loading Workspace</span>
            <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Medical Image Analysis - Vaidya AI</title>
      </Head>
      <DashboardLayout user={user}>
        <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] gap-0 overflow-hidden bg-[var(--cream-bg)] relative">
          {/* Main Main Content */}
          <div className="flex-1 overflow-hidden no-scrollbar">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={containerVariants}
              className="w-full h-full p-4 md:p-6 lg:px-8 lg:py-6 flex flex-col"
            >
              {/* Header Section */}
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-4 gap-4 px-1 flex-shrink-0">
                <motion.div variants={itemVariants}>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600">
                      <Microscope size={24} />
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black text-[var(--cream-text-main)] tracking-tight">
                      Medical Image Analysis
                    </h1>
                  </div>
                  <p className="text-[var(--cream-text-muted)] text-[14px] font-medium max-w-xl">
                    Analyze radiography, CT, MRI, and ultrasounds with clinical-grade AI interpretation.
                  </p>
                </motion.div>

                {currentAnalysis && (
                  <motion.button
                    variants={itemVariants}
                    onClick={handleNewAnalysis}
                    className="flex items-center gap-2 px-5 py-2 bg-white border-2 border-blue-100 text-blue-600 rounded-full font-bold text-sm hover:border-blue-500 hover:bg-blue-50 transition-all shadow-sm"
                  >
                    <Activity size={18} />
                    New Analysis
                  </motion.button>
                )}
              </div>

              <AnimatePresence mode="wait">
                {!currentAnalysis ? (
                  <motion.div
                    key="upload-view"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="grid lg:grid-cols-12 gap-6 flex-1 min-h-0"
                  >
                    {/* Left Column: Upload Area */}
                    <div className="lg:col-span-7 flex flex-col h-full min-h-0">
                      <div
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                        className={`relative group bg-white border-3 border-dashed rounded-[2.5rem] transition-all cursor-pointer overflow-hidden flex-1 flex flex-col ${imagePreview ? 'border-blue-200 p-2' : 'border-slate-200 hover:border-blue-400 p-8 md:p-12'
                          }`}
                      >
                        {!imagePreview ? (
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            className="flex flex-col items-center justify-center h-full text-center px-6"
                          >
                            <div className="w-20 h-20 bg-blue-50 rounded-[2.5rem] flex items-center justify-center mb-6 text-blue-500 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                              <Upload size={36} />
                            </div>
                            <h3 className="text-2xl font-black text-[var(--cream-text-main)] mb-2">Drop Clinical Imagery</h3>
                            <p className="text-[var(--cream-text-muted)] font-medium mb-6">Drag and drop or click to browse files</p>
                            <div className="flex flex-wrap justify-center gap-3">
                              {['X-Ray', 'CT Scan', 'MRI', 'Ultrasound'].map(tag => (
                                <span key={tag} className="px-4 py-1.5 bg-slate-50 text-slate-500 rounded-full text-xs font-black uppercase tracking-widest">{tag}</span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="relative rounded-2xl overflow-hidden group/img h-full bg-slate-900 flex items-center justify-center">
                            <img
                              src={imagePreview}
                              alt="Selected medical image"
                              className="h-full w-full object-contain transition-transform duration-700"
                            />

                            {/* Interactive Close Button */}
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedImage(null); setImagePreview(null); setCurrentAnalysis(null); setCurrentSessionId(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                              className="absolute top-4 right-4 z-30 p-2.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all duration-700 group/close hover:cursor-pointer"
                            >
                              <X className="transition-transform duration-500 group-hover/close:rotate-[90deg]" size={20} />
                            </button>

                            <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex justify-end items-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                              <span className="text-white text-xs font-bold bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 uppercase tracking-widest">
                                {selectedImage?.name || 'Image Preview'}
                              </span>
                            </div>
                            {analyzing && (
                              <div className="absolute inset-0 bg-blue-900/40 backdrop-blur-sm flex flex-col items-center justify-center">
                                <motion.div
                                  animate={{ height: ['0%', '100%', '0%'], top: ['0%', '0%', '0%'] }}
                                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                  className="absolute left-0 right-0 h-1 bg-blue-400/80 shadow-[0_0_20px_blue] z-20 pointer-events-none"
                                />
                                <Loader2 className="animate-spin text-white mb-4" size={48} />
                                <span className="text-white font-black uppercase tracking-[0.2em] text-sm italic">Scanning Matrix...</span>
                              </div>
                            )}
                          </div>
                        )}

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </div>
                    </div>

                    {/* Right Column: Context & Action */}
                    <div className="lg:col-span-5 flex flex-col h-full gap-4 min-h-0">
                      <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm flex-1 flex flex-col overflow-hidden">
                        <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
                            <Info size={20} />
                          </div>
                          <h3 className="text-xl font-black text-[var(--cream-text-main)]">Clinical Context</h3>
                        </div>

                        <div className="flex-1 min-h-0 flex flex-col">
                          <label className="flex-1 flex flex-col">
                            <span className="text-xs font-black uppercase tracking-widest text-[var(--cream-text-muted)] mb-2 block flex-shrink-0">Symptoms & patient history</span>
                            <textarea
                              value={additionalContext}
                              onChange={(e) => setAdditionalContext(e.target.value)}
                              placeholder="e.g. 45yo Male, chronic cough for 3 weeks, non-smoker..."
                              className="w-full flex-1 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-medium focus:border-blue-500 focus:bg-white transition-all outline-none resize-none"
                            />
                          </label>
                        </div>

                        <div className="mt-6">
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={handleAnalyze}
                            disabled={!selectedImage || analyzing}
                            className={`w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-3 transition-all duration-300 shadow-lg ${!selectedImage || analyzing
                              ? 'bg-slate-200 cursor-not-allowed opacity-50'
                              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-blue-500/25 hover:-translate-y-1'
                              }`}
                          >
                            {analyzing ? (
                              <>
                                <Loader2 size={24} className="animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <Sparkles size={24} />
                                Run Diagnostic
                              </>
                            )}
                          </motion.button>
                        </div>
                      </div>

                      {/* Quick Tips */}
                      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden flex-shrink-0">
                        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl" />
                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-blue-400 mb-2 italic">Pro Tip</h4>
                        <p className="text-sm font-medium text-slate-300 leading-relaxed">
                          For higher diagnostic accuracy, provide patient age, primary symptoms, and any relevant surgical history in the context field.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="results-view"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid lg:grid-cols-12 gap-8 items-start pb-20"
                  >
                    {/* Left Column: Image Card */}
                    <div className="lg:col-span-5 sticky top-8">
                      <div className="bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-xl group">
                        <div className="relative">
                          <img
                            src={imagePreview || ''}
                            alt="Analyzed medical image"
                            className="w-full object-contain max-h-[500px] bg-slate-900"
                          />
                          <div className="absolute top-4 right-4 flex gap-2">
                            <button className="p-2.5 bg-white/10 backdrop-blur-md rounded-full text-white border border-white/20 hover:bg-white hover:text-slate-900 transition-all">
                              <Maximize2 size={18} />
                            </button>
                          </div>
                        </div>
                        <div className="p-6">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                              <FileImage size={20} />
                            </div>
                            <div>
                              <p className="text-sm font-black text-[var(--cream-text-main)] truncate max-w-[200px]">
                                {currentAnalysis.image_filename}
                              </p>
                              <p className="text-[11px] font-bold text-[var(--cream-text-muted)] uppercase tracking-widest">
                                {new Date(currentAnalysis.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          {currentAnalysis.context && (
                            <div className="mt-4 pt-4 border-t border-slate-50">
                              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1 italic">Clinical Notes</p>
                              <p className="text-xs font-medium text-slate-600 italic">"{currentAnalysis.context}"</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Findings */}
                    <div className="lg:col-span-7 space-y-6">
                      <div className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-blue-50 shadow-2xl relative overflow-hidden">
                        {/* Decorative elements */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                        <div className="flex items-center gap-4 mb-8">
                          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                            <Sparkles size={24} />
                          </div>
                          <div>
                            <h2 className="text-2xl font-black text-[var(--cream-text-main)] tracking-tight">AI Diagnostic Report</h2>
                            <div className="flex items-center gap-2">
                              <span className="flex w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest italic">Computed by Vaidya Engine v2.0</span>
                            </div>
                          </div>
                        </div>

                        <div className="prose max-w-none text-slate-700">
                          <ReactMarkdown>{currentAnalysis.findings}</ReactMarkdown>
                        </div>

                        <div className="mt-12 pt-8 border-t border-slate-100 flex flex-wrap gap-4 items-center justify-between">
                          <div className="flex gap-2">
                            <button className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-slate-800 transition-all">
                              <Download size={16} />
                              EXPORT PDF
                            </button>
                            <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black hover:bg-slate-50 transition-all">
                              <Share2 size={16} />
                              SHARE
                            </button>
                          </div>
                          <div className="flex items-center gap-2 text-amber-500 px-4 py-2 bg-amber-50 rounded-xl border border-amber-100">
                            <AlertCircle size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest italic">Clinical verification required</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-red-600 text-white px-8 py-4 rounded-2xl shadow-2xl min-w-[320px]"
                >
                  <div className="bg-white/20 p-2 rounded-lg">
                    <AlertCircle size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80">System Error</p>
                    <p className="text-sm font-bold">{error}</p>
                  </div>
                  <button onClick={() => setError(null)} className="p-1 hover:bg-white/10 rounded-full transition-all">
                    <X size={20} />
                  </button>
                </motion.div>
              )}
            </motion.div>
          </div>

          {/* Session History Sidebar */}
          <SessionSidebar
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelectSession={handleSelectSession}
            onNewSession={handleNewAnalysis}
            onDeleteSession={handleDeleteSession}
            onDeleteAllSessions={handleDeleteAllSessions}
            loading={sessionsLoading}
            position="right"
            newSessionLabel="New Analysis"
          />
        </div>
      </DashboardLayout>
    </>
  )
}
