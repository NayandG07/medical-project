import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import {
  Check, X, ChevronRight, RefreshCw, Sparkles, Clock,
  Trophy, Target, Zap, TrendingUp, Award, BarChart2,
  PieChart, Activity, ArrowRight, BookOpen
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import SessionSidebar, { ChatSession } from '@/components/SessionSidebar'
import styles from '@/styles/MCQ.module.css'

// Types
interface MCQOption {
  id: string
  text: string
}

interface MCQuestion {
  question: string
  options: MCQOption[]
  correctId: string
  explanation: string
  difficulty?: 'easy' | 'medium' | 'hard'
}

interface SessionStats {
  correct: number
  incorrect: number
  totalAttempted: number
  tokensEarned: number
  streak: number
}

interface PerformanceMetrics {
  totalMcqsAttempted: number
  totalCorrect: number
  averageAccuracy: number
  topicsStrength: Record<string, number>
  weakTopics: string[]
  currentStreak: number
}

// Quick topic suggestions
const QUICK_TOPICS = [
  'Pharmacology',
  'Cardiology',
  'Neurology',
  'Respiratory',
  'Endocrinology',
  'Pathology'
]

export default function MCQs() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Quiz state
  const [topic, setTopic] = useState('')
  const [questions, setQuestions] = useState<MCQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [quizComplete, setQuizComplete] = useState(false)

  // UI state
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Session management
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // Statistics
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    correct: 0,
    incorrect: 0,
    totalAttempted: 0,
    tokensEarned: 0,
    streak: 0
  })

  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null)
  const [topicHistory, setTopicHistory] = useState<{ topic: string, count: number, color: string }[]>([])

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/')
        return
      }
      setUser(session.user as AuthUser)
      setLoading(false)
      loadSessions(session.access_token)
      loadPerformanceMetrics(session.access_token)
    }
    checkAuth()
  }, [router])

  const getAuthToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  // Load user sessions
  const loadSessions = async (token?: string) => {
    try {
      setSessionsLoading(true)
      const authToken = token || await getAuthToken()
      if (!authToken) return

      const response = await fetch(`${API_URL}/api/study-tools/sessions?feature=mcq`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      if (response.ok) {
        const data = await response.json()
        setSessions(data)
      }
    } catch (err) {
      console.error('Failed to load sessions:', err)
      setSessionsError('Failed to load sessions')
    } finally {
      setSessionsLoading(false)
    }
  }

  // Load performance metrics from database
  const loadPerformanceMetrics = async (token?: string) => {
    try {
      const authToken = token || await getAuthToken()
      if (!authToken) return

      // Fetch from usage_counters and performance_metrics tables
      const { data: usageData } = await supabase
        .from('usage_counters')
        .select('mcqs_generated')
        .eq('date', new Date().toISOString().split('T')[0])
        .single()

      // Load topic history from study materials
      const { data: materialsData } = await supabase
        .from('study_materials')
        .select('topic, created_at')
        .eq('feature', 'mcq')
        .order('created_at', { ascending: false })
        .limit(10)

      if (materialsData) {
        const topicCounts: Record<string, number> = {}
        materialsData.forEach((m: any) => {
          const t = m.topic || 'General'
          topicCounts[t] = (topicCounts[t] || 0) + 1
        })

        const colors = ['#6366F1', '#10B981', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899']
        const history = Object.entries(topicCounts).slice(0, 4).map(([topic, count], idx) => ({
          topic,
          count,
          color: colors[idx % colors.length]
        }))
        setTopicHistory(history)
      }
    } catch (err) {
      console.error('Failed to load performance metrics:', err)
    }
  }

  // Load session materials
  const loadSessionMaterials = async (sessionId: string) => {
    try {
      setGenerating(true)
      setError(null)
      const authToken = await getAuthToken()
      if (!authToken) return

      const response = await fetch(`${API_URL}/api/study-tools/sessions/${sessionId}/materials`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      if (response.ok) {
        const materials = await response.json()
        if (materials && materials.length > 0) {
          const material = materials[0]
          setTopic(material.topic)
          const parsedQuestions = parseMCQs(material.content)
          setQuestions(parsedQuestions)
          resetQuizState()
        }
      }
    } catch (err) {
      console.error('Failed to load material:', err)
      setError('Failed to load quiz material')
    } finally {
      setGenerating(false)
    }
  }

  // Parse MCQs from AI response
  const parseMCQs = (content: string): MCQuestion[] => {
    const questions: MCQuestion[] = []

    // Try multiple parsing patterns
    const sections = content.split(/Question \d+:|Q\d+:|\n\n(?=\d+\.)/).filter(s => s.trim())

    sections.forEach((section) => {
      const lines = section.trim().split('\n').filter(l => l.trim())
      if (lines.length < 2) return

      const questionText = lines[0].replace(/^\d+\.\s*/, '').trim()
      const options: MCQOption[] = []
      let correctId = ''
      let explanation = ''
      let inExplanation = false

      lines.forEach(line => {
        // Match options
        const optionMatch = line.match(/^([A-Da-d])[\)\.]?\s*(.+)$/i)
        if (optionMatch) {
          options.push({
            id: optionMatch[1].toLowerCase(),
            text: optionMatch[2].trim()
          })
        }

        // Match correct answer
        const correctMatch = line.match(/Correct(?:\s+Answer)?:\s*([A-Da-d])/i)
        if (correctMatch) {
          correctId = correctMatch[1].toLowerCase()
        }

        // Match explanation
        const explanationMatch = line.match(/Explanation:\s*(.+)$/i)
        if (explanationMatch) {
          explanation = explanationMatch[1].trim()
          inExplanation = true
        } else if (inExplanation && !line.match(/^[A-D][\)\.]|Correct|Question/i)) {
          explanation += ' ' + line.trim()
        }
      })

      if (questionText && options.length >= 2) {
        questions.push({
          question: questionText,
          options: options.length >= 4 ? options : [
            ...options,
            ...Array(4 - options.length).fill(null).map((_, i) => ({
              id: String.fromCharCode(97 + options.length + i),
              text: `Option ${String.fromCharCode(65 + options.length + i)}`
            }))
          ],
          correctId: correctId || 'a',
          explanation: explanation || 'This is the correct answer based on clinical evidence.',
          difficulty: Math.random() > 0.6 ? 'hard' : Math.random() > 0.3 ? 'medium' : 'easy'
        })
      }
    })

    // Return parsed questions or fallback
    return questions.length > 0 ? questions : getDefaultQuestions()
  }

  // Default questions as fallback
  const getDefaultQuestions = (): MCQuestion[] => [
    {
      question: "Which of the following drug classes is most commonly used as first-line treatment for hypertension?",
      options: [
        { id: 'a', text: 'β-blockers' },
        { id: 'b', text: 'ACE inhibitors' },
        { id: 'c', text: 'Alpha-2 agonists' },
        { id: 'd', text: 'Peripheral vasodilators' }
      ],
      correctId: 'b',
      explanation: "ACE inhibitors are first-line treatment for hypertension as they effectively lower blood pressure with fewer side effects compared to older classes.",
      difficulty: 'medium'
    },
    {
      question: "A 65-year-old man with atrial fibrillation is being started on a new anticoagulant. Which of the following does not require routine INR monitoring?",
      options: [
        { id: 'a', text: 'Warfarin' },
        { id: 'b', text: 'Dabigatran' },
        { id: 'c', text: 'Heparin' },
        { id: 'd', text: 'Phenindione' }
      ],
      correctId: 'b',
      explanation: "Dabigatran is a direct thrombin inhibitor (DOAC) that provides predictable anticoagulation without the need for regular INR monitoring.",
      difficulty: 'medium'
    },
    {
      question: "What is the primary mechanism of action for Metformin in treating Type 2 Diabetes?",
      options: [
        { id: 'a', text: 'Increases insulin secretion' },
        { id: 'b', text: 'Decreases hepatic glucose production' },
        { id: 'c', text: 'Inhibits alpha-glucosidase' },
        { id: 'd', text: 'Increases renal glucose excretion' }
      ],
      correctId: 'b',
      explanation: "Metformin primarily works by decreasing hepatic glucose production and increasing insulin sensitivity in peripheral tissues.",
      difficulty: 'easy'
    },
    {
      question: "Which antibiotic is known for the risk of causing tendon rupture as a side effect?",
      options: [
        { id: 'a', text: 'Amoxicillin' },
        { id: 'b', text: 'Ciprofloxacin' },
        { id: 'c', text: 'Azithromycin' },
        { id: 'd', text: 'Doxycycline' }
      ],
      correctId: 'b',
      explanation: "Fluoroquinolones like Ciprofloxacin carry a boxed warning for the risk of tendonitis and tendon rupture, especially in older adults.",
      difficulty: 'hard'
    }
  ]

  // Reset quiz state
  const resetQuizState = () => {
    setCurrentIndex(0)
    setSelectedOption(null)
    setShowResult(false)
    setQuizComplete(false)
    setSessionStats({
      correct: 0,
      incorrect: 0,
      totalAttempted: 0,
      tokensEarned: 0,
      streak: 0
    })
  }

  // Generate MCQs
  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic')
      return
    }

    setGenerating(true)
    setError(null)
    setQuestions([])
    resetQuizState()

    try {
      const authToken = await getAuthToken()
      if (!authToken) throw new Error('Not authenticated')

      const response = await fetch(`${API_URL}/api/study-tools/mcqs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          topic,
          session_id: currentSessionId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to generate MCQs')
      }

      const data = await response.json()
      const parsedQuestions = parseMCQs(data.content)
      setQuestions(parsedQuestions)

      // Update session
      if (!currentSessionId && data.session_id) {
        setCurrentSessionId(data.session_id)
        loadSessions(authToken)
      }

      // Update usage counter in database
      await updateUsageCounter(authToken)

    } catch (err: any) {
      console.error('Failed to generate MCQs:', err)
      setError(err.message || 'Failed to generate MCQs. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  // Update usage counter
  const updateUsageCounter = async (token: string) => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data: user } = await supabase.auth.getUser()
      if (!user.user?.id) return

      // Upsert usage counter
      const { error } = await supabase
        .from('usage_counters')
        .upsert({
          user_id: user.user.id,
          date: today,
          mcqs_generated: 1
        }, {
          onConflict: 'user_id,date'
        })
    } catch (err) {
      console.error('Failed to update usage counter:', err)
    }
  }

  // Update performance metrics
  const updatePerformanceMetrics = async (isCorrect: boolean) => {
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user?.id) return

      const today = new Date().toISOString().split('T')[0]

      // Update or create performance_metrics entry
      const { data: existing } = await supabase
        .from('performance_metrics')
        .select('*')
        .eq('user_id', user.user.id)
        .eq('metric_date', today)
        .single()

      if (existing) {
        await supabase
          .from('performance_metrics')
          .update({
            mcqs_attempted: (existing.mcqs_attempted || 0) + 1,
            mcqs_correct: isCorrect ? (existing.mcqs_correct || 0) + 1 : existing.mcqs_correct,
            average_accuracy: calculateAccuracy(
              isCorrect ? (existing.mcqs_correct || 0) + 1 : existing.mcqs_correct || 0,
              (existing.mcqs_attempted || 0) + 1
            )
          })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('performance_metrics')
          .insert({
            user_id: user.user.id,
            metric_date: today,
            mcqs_attempted: 1,
            mcqs_correct: isCorrect ? 1 : 0,
            average_accuracy: isCorrect ? 100 : 0
          })
      }
    } catch (err) {
      console.error('Failed to update performance metrics:', err)
    }
  }

  const calculateAccuracy = (correct: number, total: number): number => {
    if (total === 0) return 0
    return Math.round((correct / total) * 100 * 100) / 100
  }

  // Handle option selection
  const handleOptionSelect = async (optionId: string) => {
    if (showResult) return

    setSelectedOption(optionId)
    setShowResult(true)

    const currentQuestion = questions[currentIndex]
    const isCorrect = optionId === currentQuestion?.correctId

    // Update stats
    setSessionStats(prev => ({
      correct: isCorrect ? prev.correct + 1 : prev.correct,
      incorrect: isCorrect ? prev.incorrect : prev.incorrect + 1,
      totalAttempted: prev.totalAttempted + 1,
      tokensEarned: isCorrect ? prev.tokensEarned + 15 : prev.tokensEarned,
      streak: isCorrect ? prev.streak + 1 : 0
    }))

    // Update performance metrics in database
    await updatePerformanceMetrics(isCorrect)
  }

  // Next question
  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setSelectedOption(null)
      setShowResult(false)
    } else {
      setQuizComplete(true)
    }
  }

  // Session handlers
  const handleSelectSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId)
    await loadSessionMaterials(sessionId)
  }

  const handleNewSession = () => {
    setCurrentSessionId(null)
    setQuestions([])
    setTopic('')
    resetQuizState()
    setError(null)
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const authToken = await getAuthToken()
      if (!authToken) return

      const response = await fetch(`${API_URL}/api/study-tools/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      if (response.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId))
        if (currentSessionId === sessionId) {
          handleNewSession()
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

      const response = await fetch(`${API_URL}/api/study-tools/sessions/all?feature=mcq`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      if (response.ok) {
        setSessions([])
        handleNewSession()
      }
    } catch (err) {
      console.error('Failed to delete all sessions:', err)
    }
  }

  // Quick topic selection
  const handleQuickTopic = (topicName: string) => {
    setTopic(topicName)
  }

  // Calculate stats
  const accuracy = sessionStats.totalAttempted > 0
    ? Math.round((sessionStats.correct / sessionStats.totalAttempted) * 100)
    : 0

  const currentQuestion = questions[currentIndex]

  // Loading state
  if (loading || !user) {
    return (
      <div className={styles.loadingState}>
        <Clock size={48} className={styles.loadingIcon} />
        <h3 className={styles.loadingTitle}>Loading...</h3>
        <p className={styles.loadingSubtitle}>Preparing your study session</p>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>MCQ Practice - Vaidya AI</title>
        <meta name="description" content="Practice medical MCQs with AI-generated questions" />
      </Head>

      <DashboardLayout user={user}>
        <div className={styles.pageLayout}>
          <div className={`${styles.contentArea} ${isSidebarCollapsed ? styles.contentAreaCollapsed : styles.contentAreaExpanded}`}>
            <div className={(questions.length > 0 || generating || quizComplete) ? styles.mainContainer : styles.mainContainerFull}>
              {/* Main Content Area */}
              <div className={styles.mainContentArea}>
                {/* Empty State - No quiz active */}
                {!generating && questions.length === 0 && !quizComplete && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={styles.emptyState}
                  >
                    <div className={styles.iconWrapper}>
                      <Sparkles size={36} color="#6366F1" />
                    </div>
                    <h1 className={styles.emptyTitle}>Generate Practice MCQs</h1>
                    <p className={styles.emptySubtitle}>
                      Enter any medical topic to create a custom quiz with AI-generated questions
                    </p>

                    {error && (
                      <div style={{
                        background: '#FEF2F2',
                        color: '#DC2626',
                        padding: '12px 20px',
                        borderRadius: '12px',
                        marginBottom: '20px',
                        fontSize: '14px',
                        fontWeight: 600
                      }}>
                        {error}
                      </div>
                    )}

                    <div className={styles.searchContainer}>
                      <input
                        type="text"
                        placeholder="e.g. Pharmacology, Cardiology, Diabetes..."
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
                        className={styles.searchInput}
                      />
                      <button
                        className={styles.generateButton}
                        onClick={handleGenerate}
                        disabled={generating || !topic.trim()}
                      >
                        <Zap size={18} />
                        Generate MCQs
                      </button>
                    </div>

                    <div className={styles.quickTopics}>
                      {QUICK_TOPICS.map((t) => (
                        <button
                          key={t}
                          className={styles.quickTopic}
                          onClick={() => handleQuickTopic(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Loading State */}
                {generating && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={styles.loadingState}
                  >
                    <Clock size={48} className={styles.loadingIcon} />
                    <h3 className={styles.loadingTitle}>Creating Your Quiz...</h3>
                    <p className={styles.loadingSubtitle}>
                      Generating high-yield MCQs for <strong>{topic}</strong>
                    </p>
                  </motion.div>
                )}

                {/* Quiz Active State */}
                {!generating && questions.length > 0 && !quizComplete && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={styles.quizContainer}
                  >
                    {/* Topic Header */}
                    <div className={styles.topicHeader}>
                      <div className={styles.topicInfo}>
                        <span className={styles.topicBadge}>
                          <BookOpen size={14} style={{ marginRight: 6 }} />
                          MCQ Quiz
                        </span>
                        <span className={styles.topicName}>{topic}</span>
                      </div>
                      <button
                        className={styles.regenerateButton}
                        onClick={handleGenerate}
                      >
                        <RefreshCw size={14} />
                        Regenerate
                      </button>
                    </div>

                    {/* Question Card */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        className={styles.questionCard}
                      >
                        {/* Header */}
                        <div className={styles.questionHeader}>
                          <div className={styles.progressSection}>
                            <span className={styles.questionCount}>
                              Question {currentIndex + 1} of {questions.length}
                            </span>
                            <div className={styles.progressBarWrapper}>
                              <div
                                className={styles.progressBarFill}
                                style={{ width: `${((currentIndex + (showResult ? 1 : 0)) / questions.length) * 100}%` }}
                              />
                            </div>
                          </div>
                          {currentQuestion?.difficulty && (
                            <span className={`${styles.difficultyBadge} ${currentQuestion.difficulty === 'easy' ? styles.difficultyEasy :
                              currentQuestion.difficulty === 'medium' ? styles.difficultyMedium :
                                styles.difficultyHard
                              }`}>
                              {currentQuestion.difficulty}
                            </span>
                          )}
                        </div>

                        {/* Question */}
                        <p className={styles.questionText}>{currentQuestion?.question}</p>

                        {/* Options */}
                        <div className={styles.optionsGrid}>
                          {currentQuestion?.options.map((option) => {
                            const isSelected = selectedOption === option.id
                            const isCorrect = option.id === currentQuestion.correctId
                            const isWrong = showResult && isSelected && !isCorrect

                            return (
                              <button
                                key={option.id}
                                className={`${styles.optionButton} ${showResult && isCorrect ? styles.optionCorrect :
                                  isWrong ? styles.optionWrong :
                                    isSelected ? styles.optionSelected : ''
                                  }`}
                                onClick={() => handleOptionSelect(option.id)}
                                disabled={showResult}
                              >
                                <span className={styles.optionLabel}>
                                  {option.id.toUpperCase()}
                                </span>
                                <span className={styles.optionText}>{option.text}</span>
                                {showResult && isCorrect && (
                                  <span className={styles.optionIcon}>
                                    <Check size={14} />
                                  </span>
                                )}
                                {isWrong && (
                                  <span className={styles.optionIcon}>
                                    <X size={14} />
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>

                        {/* Feedback Panel */}
                        {showResult && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`${styles.feedbackPanel} ${selectedOption === currentQuestion?.correctId
                              ? styles.feedbackSuccess
                              : styles.feedbackError
                              }`}
                          >
                            <div className={styles.feedbackContent}>
                              <div className={styles.feedbackIconWrapper}>
                                {selectedOption === currentQuestion?.correctId
                                  ? <Check size={20} />
                                  : <X size={20} />
                                }
                              </div>
                              <div className={styles.feedbackBody}>
                                <p className={styles.feedbackTitle}>
                                  {selectedOption === currentQuestion?.correctId
                                    ? 'Correct!'
                                    : 'Incorrect'
                                  }
                                </p>
                                <p className={styles.feedbackExplanation}>
                                  {currentQuestion?.explanation}
                                </p>
                                {selectedOption === currentQuestion?.correctId && (
                                  <span className={styles.tokenReward}>
                                    <Zap size={14} />
                                    +15 Tokens Earned
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              className={styles.nextButton}
                              onClick={handleNextQuestion}
                            >
                              {currentIndex < questions.length - 1 ? 'Next Question' : 'View Results'}
                              <ArrowRight size={16} />
                            </button>
                          </motion.div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* Quiz Complete State */}
                {quizComplete && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={styles.completeState}
                  >
                    <div className={styles.completeIcon}>
                      <Trophy size={48} color="white" />
                    </div>
                    <h2 className={styles.completeTitle}>Quiz Complete!</h2>
                    <p className={styles.completeSubtitle}>
                      You've completed the {topic} quiz
                    </p>

                    <div className={styles.scoreDisplay}>
                      <div className={styles.scoreItem}>
                        <div className={styles.scoreValue}>{sessionStats.correct}/{questions.length}</div>
                        <div className={styles.scoreLabel}>Correct Answers</div>
                      </div>
                      <div className={styles.scoreItem}>
                        <div className={styles.scoreValue}>{accuracy}%</div>
                        <div className={styles.scoreLabel}>Accuracy</div>
                      </div>
                      <div className={styles.scoreItem}>
                        <div className={styles.scoreValue}>{sessionStats.tokensEarned}</div>
                        <div className={styles.scoreLabel}>Tokens Earned</div>
                      </div>
                    </div>

                    <div className={styles.completeActions}>
                      <button
                        className={styles.primaryButton}
                        onClick={handleGenerate}
                      >
                        <RefreshCw size={18} style={{ marginRight: 8 }} />
                        Try Another Quiz
                      </button>
                      <button
                        className={styles.secondaryButton}
                        onClick={handleNewSession}
                      >
                        New Topic
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Stats Sidebar */}
              {(questions.length > 0 || generating || quizComplete) && (
                <aside className={styles.statsSidebar}>
                  {/* MCQ Stats Card */}
                  <div className={styles.statsCard}>
                    <div className={styles.statsCardHeader}>
                      <h3 className={styles.statsCardTitle}>MCQ Stats</h3>
                      <ChevronRight size={16} color="#94A3B8" />
                    </div>

                    <div className={styles.circularProgress}>
                      <div className={`${styles.progressCircle} ${accuracy > 70 ? styles.progressCircleActive :
                        accuracy > 0 ? styles.progressCirclePartial : ''
                        }`}>
                        {sessionStats.correct} / {questions.length || 4}
                      </div>
                      <div className={styles.miniChart}>
                        {[40, 60, 80, 50].map((height, idx) => (
                          <div
                            key={idx}
                            className={`${styles.chartBar} ${sessionStats.correct > idx ? styles.chartBarActive : ''
                              }`}
                            style={{ height: `${height}%` }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className={styles.accuracyDisplay}>
                      <div className={styles.accuracyBadge}>
                        <Check size={12} />
                      </div>
                      <span className={styles.accuracyValue}>{accuracy}%</span>
                      <span className={styles.accuracyLabel}>15 Tokens per Correct</span>
                    </div>

                    <div className={styles.tokenDisplay}>
                      <span className={styles.tokenLabel}>Tokens Earned</span>
                      <span className={styles.tokenValue}>{sessionStats.tokensEarned}</span>
                    </div>
                  </div>

                  {/* Detailed Stats Card */}
                  <div className={styles.statsCard}>
                    <div className={styles.statsCardHeader}>
                      <h3 className={styles.statsCardTitle}>Detailed Stats</h3>
                    </div>

                    <div className={styles.statsList}>
                      <div className={styles.statsItem}>
                        <div className={styles.statsItemLabel}>
                          <div className={`${styles.statsDot} ${styles.statsDotGreen}`} />
                          <span>Correct ({accuracy}%)</span>
                        </div>
                        <Check size={14} className={styles.statsItemValueGreen} />
                      </div>
                      <div className={styles.statsItem}>
                        <div className={styles.statsItemLabel}>
                          <div className={`${styles.statsDot} ${styles.statsDotRed}`} />
                          <span>Incorrect ({sessionStats.totalAttempted > 0
                            ? Math.round((sessionStats.incorrect / sessionStats.totalAttempted) * 100)
                            : 0}%)</span>
                        </div>
                        <X size={14} className={styles.statsItemValueRed} />
                      </div>
                      <div className={`${styles.statsItem} ${styles.statsTotal}`}>
                        <div className={styles.statsItemLabel}>
                          <div className={`${styles.statsDot} ${styles.statsDotYellow}`} />
                          <span>Total Tokens Today</span>
                        </div>
                        <span className={styles.statsItemValue}>{sessionStats.tokensEarned}</span>
                      </div>
                    </div>
                  </div>

                </aside>
              )}
            </div>
          </div>

          {/* Session Sidebar */}
          <div className={styles.fixedSidebarWrap}>
            <SessionSidebar
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSelectSession={handleSelectSession}
              onNewSession={handleNewSession}
              onDeleteSession={handleDeleteSession}
              onDeleteAllSessions={handleDeleteAllSessions}
              loading={sessionsLoading}
              error={sessionsError}
              position="right"
              newSessionLabel="New MCQs"
              untitledLabel="Untitled Quiz"
              isCollapsed={isSidebarCollapsed}
              onToggleCollapsed={setIsSidebarCollapsed}
            />
          </div>
        </div>
      </DashboardLayout>
    </>
  )
}
