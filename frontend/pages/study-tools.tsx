import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import ClinicalMapViewer, { parseClinicalMapData } from '@/components/ClinicalMapViewer'
import { parseMarkdown } from '@/lib/markdown'

// Tailwind class mappings
const styles = {
  container: "max-w-[1200px] mx-auto p-8 max-md:p-4",
  header: "mb-8",
  toolSelector: "grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 mb-8 max-md:grid-cols-2",
  toolBtn: "bg-white border-2 border-slate-300 rounded-xl px-4 py-6 cursor-pointer transition-all flex flex-col items-center gap-2 hover:border-medical-indigo hover:-translate-y-0.5 hover:shadow-lg shadow-sm",
  toolBtnActive: "border-medical-indigo bg-gradient-to-br from-medical-indigo to-medical-purple text-white shadow-lg",
  toolIcon: "text-3xl",
  toolName: "font-bold text-base",
  toolDesc: "text-sm opacity-90",
  inputSection: "flex gap-4 mb-8 max-md:flex-col",
  topicInput: "flex-1 px-6 py-4 border-2 border-slate-300 rounded-xl text-base transition-colors focus:outline-none focus:border-medical-indigo text-slate-900 placeholder:text-slate-400",
  generateBtn: "bg-gradient-to-br from-[#6366F1] to-[#4F46E5] text-white border-0 px-10 py-4 rounded-xl text-base font-bold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(99,102,241,0.35)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap max-md:w-full shadow-md",
  error: "bg-red-50 text-red-700 p-4 rounded-lg mb-4 border-l-4 border-red-600 font-medium",
  resultCard: "bg-white rounded-xl p-8 shadow-lg border border-slate-300",
  resultHeader: "flex justify-between items-center mb-6 pb-4 border-b-2 border-slate-300",
  clearBtn: "bg-slate-100 border-2 border-slate-300 px-4 py-2 rounded-lg cursor-pointer transition-all hover:bg-slate-200 hover:border-slate-400 font-semibold text-slate-700",
  resultContent: "whitespace-pre-wrap leading-relaxed text-slate-800 text-base",
  citations: "mt-8 pt-6 border-t-2 border-slate-300",
  citation: "bg-slate-100 px-4 py-3 rounded-lg mb-2 text-slate-700 font-medium border border-slate-300",
  placeholder: "text-center py-16 px-8 text-slate-600",
  placeholderIcon: "text-[5rem] mb-4"
}

type ToolType = 'flashcards' | 'mcq' | 'highyield' | 'explain' | 'conceptmap'

export default function StudyTools() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTool, setSelectedTool] = useState<ToolType>('flashcards')
  const [topic, setTopic] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    const tool = router.query.tool as ToolType
    if (tool) {
      setSelectedTool(tool)
    }
  }, [router.query])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/')
      return
    }
    setUser(session.user as AuthUser)
    setLoading(false)
  }

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic')
      return
    }

    setGenerating(true)
    setError(null)
    setResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      // Call the appropriate study tool endpoint directly
      const endpoint = getToolEndpoint(selectedTool)

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/study-tools/${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            topic: topic,
            format: 'interactive'  // Request interactive format
          })
        }
      ).catch(err => {
        throw new Error('Connection failed. Backend server might be offline.')
      })

      if (response && !response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail?.error?.message || 'Failed to generate content')
      }

      const data = await response.json()
      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Failed to generate content')
    } finally {
      setGenerating(false)
    }
  }

  const getToolEndpoint = (tool: ToolType): string => {
    const endpointMap: Record<ToolType, string> = {
      flashcards: 'flashcards',
      mcq: 'mcq',
      highyield: 'highyield',
      explain: 'explain',
      conceptmap: 'conceptmap'
    }
    return endpointMap[tool]
  }

  const tools = [
    { id: 'flashcards', name: 'Flashcards', icon: '🎴', description: 'Spaced repetition cards' },
    { id: 'mcq', name: 'MCQ Practice', icon: '📝', description: 'Multiple choice questions' },
    { id: 'highyield', name: 'High-Yield', icon: '⭐', description: 'Key summary points' },
    { id: 'explain', name: 'Explanations', icon: '📚', description: 'Detailed breakdowns' },
    { id: 'conceptmap', name: 'Concept Maps', icon: '🗺️', description: 'Visual relationships' }
  ]

  if (loading || !user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Study Tools - Vaidya AI</title>
      </Head>
      <DashboardLayout user={user}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1>Study Tools 📚</h1>
            <p>Generate custom study materials for any medical topic</p>
          </div>

          <div className={styles.toolSelector}>
            {tools.map((tool) => (
              <button
                key={tool.id}
                className={`${styles.toolBtn} ${selectedTool === tool.id ? styles.toolBtnActive : ''}`}
                onClick={() => setSelectedTool(tool.id as ToolType)}
              >
                <span className={styles.toolIcon}>{tool.icon}</span>
                <span className={styles.toolName}>{tool.name}</span>
                <span className={styles.toolDesc}>{tool.description}</span>
              </button>
            ))}
          </div>

          <div className={styles.inputSection}>
            <input
              type="text"
              placeholder="Enter a medical topic (e.g., 'cardiac cycle', 'diabetes mellitus')"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
              className={styles.topicInput}
            />
            <button
              onClick={handleGenerate}
              disabled={generating}
              className={styles.generateBtn}
            >
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>

          {error && (
            <div className={styles.error}>
              ⚠️ {error}
            </div>
          )}

          {result && (
            <div className={styles.resultCard}>
              <div className={styles.resultHeader}>
                <h3>Generated Content</h3>
                <button
                  onClick={() => {
                    setResult(null)
                    setTopic('')
                  }}
                  className={styles.clearBtn}
                >
                  Clear
                </button>
              </div>
              <div className={styles.resultContent}>
                {selectedTool === 'conceptmap' ? (
                  (() => {
                    const { nodes, connections } = parseClinicalMapData(result.content)
                    return (
                      <ClinicalMapViewer
                        title={topic}
                        nodes={nodes}
                        connections={connections}
                      />
                    )
                  })()
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: parseMarkdown(result.content) }} />
                )}
              </div>
              {result.citations && (
                <div className={styles.citations}>
                  <h4>Sources:</h4>
                  {result.citations.sources?.map((source: any, idx: number) => (
                    <div key={idx} className={styles.citation}>
                      📄 {source.document_filename}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!result && !generating && (
            <div className={styles.placeholder}>
              <div className={styles.placeholderIcon}>
                {tools.find(t => t.id === selectedTool)?.icon}
              </div>
              <h3>Ready to generate {tools.find(t => t.id === selectedTool)?.name.toLowerCase()}</h3>
              <p>Enter a topic above and click Generate to create your study materials</p>
            </div>
          )}
        </div>
      </DashboardLayout>
    </>
  )
}
