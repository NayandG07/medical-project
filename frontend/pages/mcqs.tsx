import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Check, X, ChevronRight, Send, Search, MoreHorizontal, MessageSquare, Trophy, PieChart, BarChart2, BookOpen, Clock, Activity, ArrowRight, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const MOCK_QUESTIONS = [
  {
    question: "Which of the following drug classes is most commonly used as first-line treatment for hypertension?",
    options: [
      { id: 'a', text: 'β-blockers' },
      { id: 'b', text: 'ACE inhibitors' },
      { id: 'c', text: 'Alpha-2 agonists' },
      { id: 'd', text: 'Peripheral vasodilators' }
    ],
    correctId: 'b',
    explanation: "ACE inhibitors are first-line treatment for hypertension as they effectively lower blood pressure with fewer side effects compared to older classes."
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
    explanation: "Dabigatran is a direct thrombin inhibitor (DOAC) that provides predictable anticoagulation without the need for regular INR monitoring."
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
    explanation: "Metformin primarily works by decreasing hepatic glucose production and increasing insulin sensitivity in peripheral tissues."
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
    explanation: "Fluoroquinolones like Ciprofloxacin carry a boxed warning for the risk of tendonitis and tendon rupture, especially in older adults."
  }
]

export default function MCQs() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [topic, setTopic] = useState('')
  const [isGenerated, setIsGenerated] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)

  // Dynamic Stats
  const [sessionStats, setSessionStats] = useState({
    correct: 0,
    incorrect: 0,
    totalAttempted: 0,
    tokensEarned: 0
  })

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/')
        return
      }
      setUser(session.user as AuthUser)
      setLoading(false)
    }
    checkAuth()
  }, [router])

  const handleGenerate = async () => {
    if (!topic.trim()) return
    setGenerating(true)

    // Reset session
    setSessionStats({ correct: 0, incorrect: 0, totalAttempted: 0, tokensEarned: 0 })
    setCurrentIndex(0)
    setSelectedOption(null)
    setShowResult(false)

    setTimeout(() => {
      setGenerating(false)
      setIsGenerated(true)
    }, 1500)
  }

  const handleOptionSelect = (id: string) => {
    if (showResult) return
    setSelectedOption(id)
    setShowResult(true)

    const isCorrect = id === MOCK_QUESTIONS[currentIndex].correctId
    setSessionStats(prev => ({
      ...prev,
      correct: isCorrect ? prev.correct + 1 : prev.correct,
      incorrect: isCorrect ? prev.incorrect : prev.incorrect + 1,
      totalAttempted: prev.totalAttempted + 1,
      tokensEarned: isCorrect ? prev.tokensEarned + 15 : prev.tokensEarned
    }))
  }

  const nextQuestion = () => {
    if (currentIndex < MOCK_QUESTIONS.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setSelectedOption(null)
      setShowResult(false)
    } else {
      // Logic for completion can go here
      setIsGenerated(false)
      setTopic('')
    }
  }

  if (loading || !user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#F8F9FD' }}>
        <p>Preparing study material...</p>
      </div>
    )
  }

  const currentQuestion = MOCK_QUESTIONS[currentIndex]
  const accuracy = sessionStats.totalAttempted > 0
    ? Math.round((sessionStats.correct / sessionStats.totalAttempted) * 100)
    : 0

  return (
    <>
      <Head>
        <title>MCQs - Pramana Med</title>
      </Head>
      <DashboardLayout user={user}>
        <div className="mcq-container">
          <div className="main-area">
            {!isGenerated && !generating ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="search-only-state"
              >
                <div className="empty-content">
                  <div className="sparkle-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={32} color="#6366F1" />
                  </div>
                  <h1>Generate practice MCQs</h1>
                  <p>Enter any medical topic to create a custom 4-question set</p>
                  <div className="large-search">
                    <input
                      type="text"
                      placeholder="e.g. Pharmacology, Cardiac Cycle, Diabetes..."
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
                    />
                    <button className="generate-mcq-btn" onClick={handleGenerate}>
                      Generate MCQs
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : generating ? (
              <div className="generating-state">
                <div className="loader-box">
                  <Clock size={40} className="animate-spin" color="#6366F1" />
                  <h3>Creating your specialized quiz...</h3>
                  <p>Analyzing high-yield topics for {topic}</p>
                </div>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="active-quiz-state"
              >
                {/* Active Quiz Header / Search Breadcrumb */}
                <div className="active-quiz-header">
                  <div className="breadcrumb-nav">
                    <span>{topic}</span>
                    <ChevronRight size={14} />
                  </div>
                  <div className="mini-search">
                    <strong>{topic}</strong>
                    <button className="send-icon" onClick={handleGenerate}><Send size={14} /></button>
                  </div>
                </div>

                <div className="ai-message">
                  <div className="ai-avatar">PM</div>
                  <div className="ai-bubble">
                    <p>I've created a set of <strong>{topic} MCQs</strong> for you. Start with question 1 below.</p>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="question-card"
                  >
                    <div className="card-header">
                      <div className="progress-info">
                        <span className="q-count">Question {currentIndex + 1} of 4</span>
                        <div className="progress-bar-container">
                          <div className="progress-bar" style={{ width: `${((currentIndex + 1) / 4) * 100}%` }}></div>
                        </div>
                      </div>
                      <MoreHorizontal size={20} className="header-icon" />
                    </div>

                    <div className="question-text">
                      <h3>{currentQuestion.question}</h3>
                    </div>

                    <div className="options-grid">
                      {currentQuestion.options.map((option) => (
                        <button
                          key={option.id}
                          className={`option-btn ${selectedOption === option.id ? 'selected' : ''} ${showResult && option.id === currentQuestion.correctId ? 'correct' : ''} ${showResult && selectedOption === option.id && selectedOption !== currentQuestion.correctId ? 'wrong' : ''}`}
                          onClick={() => handleOptionSelect(option.id)}
                          disabled={showResult}
                        >
                          <span className="option-label">{option.id})</span>
                          <span className="option-text">{option.text}</span>
                          {showResult && option.id === currentQuestion.correctId && (
                            <div className="check-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={14} /></div>
                          )}
                        </button>
                      ))}
                    </div>

                    {showResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`feedback-panel ${selectedOption === currentQuestion.correctId ? 'success' : 'error'}`}
                      >
                        <div className="feedback-content">
                          <div className="feedback-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {selectedOption === currentQuestion.correctId ? <Check size={16} /> : <X size={16} />}
                          </div>
                          <div className="feedback-text">
                            <p><strong>{selectedOption === currentQuestion.correctId ? 'Correct!' : 'Incorrect.'}</strong> {currentQuestion.explanation}</p>
                            {selectedOption === currentQuestion.correctId && <span className="token-award">+15 Tokens Awarded</span>}
                          </div>
                          <button className="next-btn" onClick={nextQuestion}>
                            {currentIndex < 3 ? 'Next Question' : 'Finish Quiz'}
                            <ArrowRight size={16} />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            )}
          </div>

          {/* Sidebar Area - Permanently visible but dynamic stats inside */}
          <aside className="stats-sidebar">
            <div className="sidebar-card">
              <div className="sidebar-title">
                <h3>MCQ Stats</h3>
                <ChevronRight size={16} />
              </div>
              <div className="stat-overview">
                <div className="stat-circle" style={{ borderColor: accuracy > 70 ? '#10B981' : accuracy > 0 ? '#F59E0B' : '#F1F5F9' }}>
                  <span className="stat-value">{sessionStats.correct} / 4</span>
                </div>
                <div className="simple-chart">
                  <div className="chart-bar" style={{ height: '40%', background: sessionStats.correct >= 1 ? '#6366F1' : '#E2E8F0' }}></div>
                  <div className="chart-bar" style={{ height: '60%', background: sessionStats.correct >= 2 ? '#6366F1' : '#E2E8F0' }}></div>
                  <div className="chart-bar highlight" style={{ height: '80%', background: sessionStats.correct >= 3 ? '#6366F1' : '#E2E8F0' }}></div>
                  <div className="chart-bar" style={{ height: '50%', background: sessionStats.correct >= 4 ? '#6366F1' : '#E2E8F0' }}></div>
                </div>
              </div>
              <div className="accuracy-label">
                <div className="check-badge" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: accuracy > 0 ? '#10B981' : '#94A3B8' }}><Check size={12} /></div>
                <span className="pct" style={{ color: accuracy > 0 ? '#10B981' : '#94A3B8' }}>{accuracy}%</span>
                <span className="label">15 Tokens for Correct Answer</span>
              </div>
              <div className="token-earned">
                <span>Token Earned</span>
                <span className="val">{sessionStats.tokensEarned}</span>
              </div>
            </div>

            <div className="sidebar-card">
              <div className="sidebar-title">
                <h3>Detailed Stats</h3>
              </div>
              <div className="detailed-list">
                <div className="list-item">
                  <div className="item-label">
                    <div className="dot green"></div>
                    <span>Correct ({accuracy}%)</span>
                  </div>
                  <Check size={14} className="green-text" />
                </div>
                <div className="list-item">
                  <div className="item-label">
                    <div className="dot red"></div>
                    <span>Incorrect ({sessionStats.totalAttempted > 0 ? Math.round((sessionStats.incorrect / sessionStats.totalAttempted) * 100) : 0}%)</span>
                  </div>
                  <X size={14} className="red-text" />
                </div>
                <div className="list-item total">
                  <div className="item-label">
                    <div className="dot yellow"></div>
                    <span>Total {sessionStats.tokensEarned} Tokens Today</span>
                  </div>
                  <span className="total-val">{sessionStats.tokensEarned}</span>
                </div>
              </div>
            </div>

            <div className="sidebar-card">
              <div className="sidebar-title">
                <h3>Topic Tracker</h3>
                <ChevronRight size={16} />
              </div>
              <div className="topic-list">
                <TopicItem label="Asthma" count={4} icon={<Activity size={12} />} color="#6366F1" />
                <TopicItem label="Dermatology" count={3} icon={<PieChart size={12} />} color="#10B981" />
                <TopicItem label="Cardiology" count={4} icon={<Trophy size={12} />} color="#EF4444" />
                <TopicItem label="Pharmacology" count={6} icon={<BarChart2 size={12} />} color="#F59E0B" />
              </div>
            </div>
          </aside>
        </div>

        <style jsx>{`
          .mcq-container {
            display: grid;
            grid-template-columns: 1fr 340px;
            gap: 32px;
            max-width: 1400px;
            margin: 0 auto;
          }

          @media (max-width: 1100px) {
            .mcq-container {
              grid-template-columns: 1fr;
            }
          }

          /* Search Only State */
          .search-only-state {
            background: white;
            border-radius: 32px;
            padding: 80px 40px;
            text-align: center;
            box-shadow: 0 4px 40px rgba(0, 0, 0, 0.03);
            border: 1px solid rgba(0,0,0,0.02);
            margin-top: 40px;
          }

          .empty-content {
            max-width: 500px;
            margin: 0 auto;
          }

          .sparkle-icon {
            width: 64px;
            height: 64px;
            background: #F5F7FF;
            border-radius: 20px;
            margin: 0 auto 24px;
          }

          .search-only-state h1 {
            font-size: 32px;
            font-weight: 800;
            margin-bottom: 12px;
            color: #1E293B;
          }

          .search-only-state p {
            font-size: 16px;
            color: #64748B;
            margin-bottom: 32px;
          }

          .large-search {
            background: #F8FAFC;
            border: 1.5px solid #E2E8F0;
            padding: 8px 8px 8px 24px;
            border-radius: 20px;
            display: flex;
            align-items: center;
            gap: 16px;
            transition: all 0.2s;
          }

          .large-search:focus-within {
            border-color: #6366F1;
            box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
          }

          .large-search input {
            border: none;
            background: none;
            flex: 1;
            font-size: 16px;
            font-weight: 500;
            outline: none;
          }

          .generate-mcq-btn {
            background: #6366F1;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 14px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
          }

          .generate-mcq-btn:hover {
            background: #4F46E5;
            transform: scale(1.02);
          }

          /* Active State Header Refinement */
          .active-quiz-header {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 20px;
          }

          .breadcrumb-nav {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            font-weight: 700;
            color: #64748B;
            padding-left: 4px;
          }

          .mini-search {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: white;
            padding: 10px 16px;
            border-radius: 14px;
            border: 1px solid rgba(0, 0, 0, 0.05);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
            width: 320px;
          }

          .mini-search strong {
            font-size: 14px;
            color: #1E293B;
          }

          .send-icon {
            background: #1E293B;
            color: white;
            border: none;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .send-icon:hover {
            transform: scale(1.05);
            background: #000;
          }

          .ai-message {
            display: flex;
            gap: 16px;
            margin-bottom: 32px;
            align-items: flex-start;
          }

          .ai-avatar {
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
            color: white;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
            flex-shrink: 0;
          }

          .ai-bubble {
            background: white;
            padding: 16px 24px;
            border-radius: 0 24px 24px 24px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
            border: 1px solid rgba(0, 0, 0, 0.03);
            max-width: 85%;
          }

          .ai-bubble p {
            margin: 0;
            font-size: 15px;
            color: #475569;
            line-height: 1.6;
          }

          /* Question Card */
          .question-card {
            background: white;
            border-radius: 24px;
            padding: 32px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.03);
          }

          .card-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 24px;
          }

          .progress-info {
            display: flex;
            align-items: center;
            gap: 16px;
            flex: 1;
          }

          .q-count {
            font-size: 14px;
            font-weight: 600;
            color: #64748B;
          }

          .progress-bar-container {
            width: 140px;
            height: 8px;
            background: #F1F5F9;
            border-radius: 4px;
            overflow: hidden;
          }

          .progress-bar {
            height: 100%;
            background: #10B981;
            transition: width 0.3s;
          }

          .question-text h3 {
            font-size: 19px;
            font-weight: 700;
            line-height: 1.6;
            margin-bottom: 28px;
          }

          .options-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 24px;
          }

          .option-btn {
            background: white;
            border: 1.5px solid #F1F5F9;
            padding: 16px 20px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            transition: all 0.2s;
            text-align: left;
          }

          .option-btn:hover:not(:disabled) {
            border-color: #6366F1;
            background: #F5F7FF;
          }

          .option-label {
            color: #94A3B8;
            font-weight: 800;
          }

          .option-text {
            color: #475569;
            font-weight: 600;
          }

          .option-btn.correct { border-color: #10B981; background: #F0FDFA; }
          .option-btn.wrong { border-color: #EF4444; background: #FEF2F2; }

          .feedback-panel {
            background: #F8FAFC;
            padding: 24px;
            border-radius: 20px;
            margin-top: 16px;
          }

          .feedback-content {
            display: flex;
            gap: 16px;
            align-items: flex-start;
          }

          .feedback-icon {
            width: 32px;
            height: 32px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.05);
          }

          .token-award {
            display: block;
            margin-top: 8px;
            color: #10B981;
            font-weight: 800;
            font-size: 13px;
          }

          .next-btn {
            background: #6366F1;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 12px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            margin-top: 10px;
          }

          /* Sidebar Card */
          .sidebar-card {
            background: white;
            border-radius: 24px;
            padding: 24px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.02);
            margin-bottom: 24px;
          }

          .sidebar-title {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }

          .sidebar-title h3 {
            font-size: 15px;
            font-weight: 800;
            color: #1E293B;
          }

          .stat-overview {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
          }

          .stat-circle {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            border: 8px solid #F1F5F9;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 14px;
          }

          .simple-chart {
            display: flex;
            align-items: flex-end;
            gap: 4px;
            height: 60px;
          }

          .chart-bar {
            width: 8px;
            border-radius: 2px;
          }

          .accuracy-label {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #F0FDFA;
            padding: 12px;
            border-radius: 14px;
            margin-bottom: 20px;
          }

          .check-badge {
            width: 20px;
            height: 20px;
            color: white;
            border-radius: 50%;
          }

          .pct {
            font-weight: 800;
            font-size: 16px;
          }

          .token-earned {
            display: flex;
            justify-content: space-between;
            font-weight: 700;
            color: #475569;
          }

          .detailed-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .list-item {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            font-weight: 600;
            color: #64748B;
          }

          .item-label {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .dot { width: 8px; height: 8px; border-radius: 50%; }
          .dot.green { background: #10B981; }
          .dot.red { background: #EF4444; }
          .dot.yellow { background: #F59E0B; }

          .total {
            margin-top: 8px;
            padding-top: 12px;
            border-top: 1.5px dashed #F1F5F9;
            color: #1E293B;
            font-weight: 800;
          }

          .topic-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .animate-spin {
            animation: spin 1.5s linear infinite;
          }
        `}</style>
      </DashboardLayout>
    </>
  )
}

function TopicItem({ label, count, icon, color }: any) {
  return (
    <div className="topic-item">
      <div className="topic-info">
        <div className="icon-wrap" style={{ backgroundColor: `${color}15`, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
        <span>{label} ({count})</span>
      </div>
      <style jsx>{`
        .topic-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .topic-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .icon-wrap {
          width: 28px;
          height: 28px;
          border-radius: 8px;
        }
        span {
          font-size: 13px;
          font-weight: 600;
          color: #475569;
        }
      `}</style>
    </div>
  )
}
