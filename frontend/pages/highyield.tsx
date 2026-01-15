import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { parseMarkdown } from '@/lib/markdown'

// Tailwind class mappings
const styles = {
  container: "max-w-[1200px] mx-auto p-8 max-md:p-4",
  header: "mb-8",
  inputSection: "flex gap-4 mb-8 max-md:flex-col",
  topicInput: "flex-1 px-6 py-4 border-2 border-slate-300 rounded-xl text-base transition-colors focus:outline-none focus:border-medical-indigo text-slate-900 placeholder:text-slate-400",
  generateBtn: "bg-gradient-to-br from-medical-indigo to-medical-purple text-white border-0 px-10 py-4 rounded-xl text-base font-bold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(102,126,234,0.5)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap max-md:w-full shadow-md",
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

export default function HighYield() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [topic, setTopic] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeDocument, setActiveDocument] = useState<any>(null)

  useEffect(() => {
    checkAuth()
    checkDocumentContext()
  }, [])

  const checkDocumentContext = () => {
    const documentId = router.query.document as string
    if (documentId) {
      const stored = sessionStorage.getItem('activeDocument')
      if (stored) {
        try {
          const docData = JSON.parse(stored)
          if (docData.id === documentId) {
            setActiveDocument(docData)
          }
        } catch (e) {
          console.error('Failed to parse document data:', e)
        }
      }
    }
  }

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

      // If document is active, search for relevant context
      let documentContext = ''
      if (activeDocument) {
        try {
          const searchResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/documents/search?query=${encodeURIComponent(topic)}&feature=highyield&top_k=5`,
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          )
          
          if (searchResponse.ok) {
            const searchResults = await searchResponse.json()
            if (searchResults.length > 0) {
              documentContext = '\n\n[Document Context]\n' + searchResults.map((r: any) => r.content).join('\n\n')
            }
          }
        } catch (searchErr) {
          console.error('Document search failed:', searchErr)
        }
      }

      const topicWithContext = documentContext ? topic + documentContext : topic

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/study-tools/highyield`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            topic: topicWithContext,
            format: 'interactive'
          })
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail?.error?.message || 'Failed to generate high-yield notes')
      }

      const data = await response.json()
      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Failed to generate high-yield notes')
    } finally {
      setGenerating(false)
    }
  }

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
        <title>High Yield - Vaidya AI</title>
      </Head>
      <DashboardLayout user={user}>
        <div className={styles.container}>
          {/* Document Context Banner */}
          {activeDocument && (
            <div style={{
              background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
              color: 'white',
              padding: '16px 24px',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>📚 RAG Enabled</div>
                  <div style={{ fontSize: '13px', opacity: 0.9 }}>{activeDocument.filename}</div>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveDocument(null)
                  sessionStorage.removeItem('activeDocument')
                  router.push('/highyield')
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
              >
                Disable RAG
              </button>
            </div>
          )}
          
          <div className={styles.header}>
            <h1>⭐ High-Yield Notes</h1>
            <p>Generate key summary points for any medical topic</p>
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
              {generating ? 'Generating...' : 'Generate High-Yield Notes'}
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
                <h3>High-Yield Notes</h3>
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
                <div dangerouslySetInnerHTML={{ __html: parseMarkdown(result.content) }} />
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
              <div className={styles.placeholderIcon}>⭐</div>
              <h3>Ready to generate high-yield notes</h3>
              <p>Enter a topic above and click Generate to create key summary points</p>
            </div>
          )}
        </div>
      </DashboardLayout>
    </>
  )
}
