import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  StopCircle,
  Send,
  Clock,
  CheckCircle2,
  Circle,
  Stethoscope,
  MessageSquare,
  ClipboardList,
  User,
  AlertCircle,
  Target,
  Award,
  ChevronRight,
  Activity,
  Heart,
  Brain,
  Zap,
  Timer,
  Sparkles,
  Mic,
  Maximize2,
  X
} from 'lucide-react'

// Icon mapping for dynamic configuration
const ICON_MAP = {
  ClipboardList,
  Stethoscope,
  MessageSquare,
  Activity
}

// Default fallback configuration
interface ScenarioType {
  id: string
  label: string
  icon: string
  desc: string
  color: string
  gradient?: string
}

interface DifficultyLevel {
  id: string
  label: string
  color: string
  desc: string
}

interface OsceConfig {
  scenario_types: ScenarioType[]
  difficulty_levels: DifficultyLevel[]
}

const DEFAULT_CONFIG: OsceConfig = {
  scenario_types: [],
  difficulty_levels: []
}

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
  metadata?: {
    observation?: string
    feedback?: string
  }
}

interface ChecklistItem {
  item: string
  points: number
  completed?: boolean
}

interface OSCEScenario {
  scenario_id: string
  scenario_type: string
  patient_info: {
    age: number
    gender: string
    presenting_complaint: string
    background?: string
  }
  instructions: string
  examiner_checklist: ChecklistItem[]
  expected_actions: string[]
}

export default function OSCE() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Session state
  const [sessionActive, setSessionActive] = useState(false)
  const [scenarioData, setScenarioData] = useState<OSCEScenario | null>(null)
  const [conversation, setConversation] = useState<Message[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Setup state
  const [setupStep, setSetupStep] = useState<'instructions' | 'config' | 'session'>('instructions')
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null)

  // Input state
  const [userInput, setUserInput] = useState('')
  const conversationRef = useRef<HTMLDivElement>(null)

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(480) // 8 minutes in seconds
  const [timerActive, setTimerActive] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Performance state
  const [checklistProgress, setChecklistProgress] = useState<string[]>([])

  // Mobile sidebar
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [osceConfig, setOsceConfig] = useState<OsceConfig>(DEFAULT_CONFIG)

  // Fetch configuration
  const fetchConfig = async (token: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/osce/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setOsceConfig(data)
      }
    } catch (err) {
      console.error('Failed to fetch OSCE config:', err)
    }
  }

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight
    }
  }, [conversation])

  useEffect(() => {
    if (timerActive && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => prev - 1)
      }, 1000)
    } else if (timeRemaining === 0) {
      setTimerActive(false)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [timerActive, timeRemaining])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/')
      return
    }
    setUser(session.user as AuthUser)
    await fetchConfig(session.access_token)
    setLoading(false)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getTimerPercentage = () => {
    return ((480 - timeRemaining) / 480) * 100
  }

  const startSession = async () => {
    if (!selectedType || !selectedDifficulty) {
      setError('Please select station type and difficulty')
      return
    }

    setGenerating(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/osce/scenario`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scenario_type: selectedType,
          difficulty: selectedDifficulty
        })
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to create OSCE scenario')
      }

      const scenario = await response.json()

      // The backend returns the scenario structure stored in session metadata or first message
      // We expect the backend to have already initialized the interaction
      setScenarioData({
        scenario_id: scenario.id || scenario.scenario_id, // Adjust based on actual return
        ...scenario
      })

      // If the backend returns initial messages, load them
      // For now, let's assume we need to fetch them if not provided
      const msgResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat/sessions/${scenario.scenario_id || scenario.id}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (msgResponse.ok) {
        const msgs = await msgResponse.json()
        setConversation(msgs.map((m: any) => ({
          role: m.role,
          content: m.content
        })))
      }

      setSessionActive(true)
      setSetupStep('session')
      setTimerActive(true)
      setTimeRemaining(480)
      setChecklistProgress([])

    } catch (err: any) {
      console.error('Failed to start session:', err)
      setError(err.message || 'Failed to start OSCE session')
    } finally {
      setGenerating(false)
    }
  }

  const sendMessage = async () => {
    if (!userInput.trim() || !scenarioData) return

    const userAction = userInput.trim()
    const newMessage: Message = { role: 'user', content: userAction }
    setConversation(prev => [...prev, newMessage])
    setUserInput('')
    setGenerating(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const sessionId = scenarioData.scenario_id

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/osce/sessions/${sessionId}/interaction`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ user_action: userAction })
        }
      )

      if (!response.ok) throw new Error('Failed to send message')
      const data = await response.json()

      // Handle structured response: { patient_response, examiner_observation, checklist_items_met, feedback }
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.patient_response,
        metadata: {
          observation: data.examiner_observation,
          feedback: data.feedback
        }
      }

      setConversation(prev => [...prev, assistantMsg])

      // Update checklist progress
      if (data.checklist_items_met && data.checklist_items_met.length > 0) {
        setChecklistProgress(prev => {
          const newItems = data.checklist_items_met.filter((item: string) => !prev.includes(item))
          return [...prev, ...newItems]
        })
      }

    } catch (err: any) {
      console.error('Failed to send message:', err)
      setError('Failed to get response')
    } finally {
      setGenerating(false)
    }
  }

  const endSession = () => {
    setTimerActive(false)
    if (timerRef.current) clearInterval(timerRef.current)
    setSessionActive(false)
    setSetupStep('instructions')
    setScenarioData(null)
    setConversation([])
    setUserInput('')
    setSelectedType(null)
    setTimeRemaining(480)
    setChecklistProgress([])
  }

  const getTimerColor = () => {
    if (timeRemaining > 300) return '#10B981' // Green > 5 min
    if (timeRemaining > 120) return '#F59E0B' // Yellow > 2 min
    return '#EF4444' // Red < 2 min
  }

  const selectedScenario = osceConfig.scenario_types.find(t => t.id === selectedType)

  return (
    <>
      <Head>
        <title>OSCE Simulator - Vaidya AI</title>
        <meta name="description" content="Practice OSCE examinations with AI-powered simulations" />
      </Head>
      <DashboardLayout user={user} loading={loading}>
        <div className="osce-container">
          {!sessionActive ? (
            /* ================= SETUP FLOW (Instructions -> Config) ================= */
            <div className="setup-container">
              {/* Step 1: Instructions View */}
              {setupStep === 'instructions' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="instructions-view"
                >
                  <header className="page-header center-aligned">
                    <div className="header-badge">
                      <Sparkles size={14} className="sparkle-icon" />
                      <span>AI Clinical Training</span>
                    </div>
                    <h1>OSCE Simulator</h1>
                    <p>Master clinical examinations with realistic, high-fidelity patient simulations</p>
                  </header>

                  <div className="instructions-card">
                    <div className="instruction-step">
                      <div className="step-icon"><ClipboardList size={24} /></div>
                      <h3>1. Select Station</h3>
                      <p>Choose from History Taking, Physical Exam, Communication, or Procedures.</p>
                    </div>
                    <div className="step-arrow"><ChevronRight size={20} /></div>
                    <div className="instruction-step">
                      <div className="step-icon"><Target size={24} /></div>
                      <h3>2. Set Rigor</h3>
                      <p>Adjust difficulty from Beginner to Advanced based on your experience.</p>
                    </div>
                    <div className="step-arrow"><ChevronRight size={20} /></div>
                    <div className="instruction-step">
                      <div className="step-icon"><Play size={24} /></div>
                      <h3>3. Simulate</h3>
                      <p>Interact with the AI patient in real-time and get instant feedback.</p>
                    </div>
                  </div>

                  <button
                    className="start-sim-btn"
                    onClick={() => setSetupStep('config')}
                  >
                    Start Simulation
                  </button>
                </motion.div>
              )}

              {/* Step 2: Configuration Modal */}
              {setupStep === 'config' && (
                <div className="config-overlay">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="config-card"
                  >
                    <div className="config-header">
                      <h2 className="config-title">Configure Session</h2>
                      <button className="close-config-btn" onClick={() => setSetupStep('instructions')}>
                        <X size={20} />
                      </button>
                    </div>

                    <div className="config-body">
                      {/* Station Selection */}
                      <section className="config-section">
                        <label>Station Type</label>
                        <div className="mini-grid">
                          {osceConfig.scenario_types.map((type) => {
                            const Icon = ICON_MAP[type.icon as keyof typeof ICON_MAP] || Activity
                            const isActive = selectedType === type.id
                            return (
                              <button
                                key={type.id}
                                className={`mini-card ${isActive ? 'selected' : ''}`}
                                onClick={() => setSelectedType(type.id)}
                              >
                                <Icon size={20} style={{ color: isActive ? type.color : '#64748B' }} />
                                <span>{type.label}</span>
                                {isActive && <CheckCircle2 size={16} className="check-icon" />}
                              </button>
                            )
                          })}
                        </div>
                      </section>

                      {/* Rigor Selection */}
                      <section className="config-section">
                        <label>Examination Rigor</label>
                        <div className="rigor-options">
                          {osceConfig.difficulty_levels.map((level) => (
                            <button
                              key={level.id}
                              className={`rigor-chip ${selectedDifficulty === level.id ? 'selected' : ''}`}
                              onClick={() => setSelectedDifficulty(level.id)}
                              style={{
                                borderColor: selectedDifficulty === level.id ? level.color : undefined,
                                color: selectedDifficulty === level.id ? level.color : undefined,
                                backgroundColor: selectedDifficulty === level.id ? `${level.color}10` : undefined
                              }}
                            >
                              {level.label}
                            </button>
                          ))}
                        </div>
                      </section>
                    </div>

                    <div className="config-footer">
                      <button
                        className="proceed-button"
                        onClick={startSession}
                        disabled={!selectedType || !selectedDifficulty || generating}
                      >
                        {generating ? 'Processing...' : 'Proceed to Simulation'}
                      </button>
                      {(!selectedType || !selectedDifficulty) && (
                        <div className="validation-msg">
                          Select {!selectedType ? 'Station Type' : ''} {(!selectedType && !selectedDifficulty) ? '&' : ''} {!selectedDifficulty ? 'Rigor' : ''}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              )}
            </div>
          ) : (
            /* ================= ACTIVE SESSION SCREEN ================= */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="session-wrapper"
            >
              {/* Top Bar */}
              <header className="session-topbar">
                <div className="session-meta">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="back-btn"
                    onClick={endSession}
                  >
                    <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
                    <span className="back-text">Abort Station</span>
                  </motion.button>
                  <div className="station-badge">
                    {selectedScenario && (() => {
                      const Icon = ICON_MAP[selectedScenario.icon as keyof typeof ICON_MAP] || Activity
                      return <Icon size={18} style={{ color: selectedScenario.color }} />
                    })()}
                    <span>{selectedScenario?.label}</span>
                  </div>
                  <div className="difficulty-tag" style={{
                    color: osceConfig.difficulty_levels.find(d => d.id === selectedDifficulty)?.color,
                    borderColor: osceConfig.difficulty_levels.find(d => d.id === selectedDifficulty)?.color + '40',
                    backgroundColor: osceConfig.difficulty_levels.find(d => d.id === selectedDifficulty)?.color + '10'
                  }}>
                    {osceConfig.difficulty_levels.find(d => d.id === selectedDifficulty)?.label}
                  </div>
                </div>

                <div className="session-timer" style={{
                  color: 'white',
                  backgroundColor: getTimerColor(),
                  boxShadow: `0 8px 20px ${getTimerColor()}40`
                }}>
                  <Timer size={20} />
                  <span>{formatTime(timeRemaining)}</span>
                </div>
              </header>

              <div className="session-layout">
                {/* Chat Column */}
                <main className="chat-column">
                  <div className="chat-area" ref={conversationRef}>
                    {scenarioData && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="patient-brief-card"
                      >
                        <div className="brief-header">
                          <User size={16} />
                          <span>Initial Presentation</span>
                        </div>
                        <div className="brief-grid">
                          <div className="brief-item">
                            <span className="b-label">Patient</span>
                            <span className="b-value">{scenarioData.patient_info?.gender || 'Unknown'}, {scenarioData.patient_info?.age || '??'}y</span>
                          </div>
                          <div className="brief-item">
                            <span className="b-label">Complaint</span>
                            <span className="b-value">{scenarioData.patient_info?.presenting_complaint || 'General Consultation'}</span>
                          </div>
                          <div className="brief-item">
                            <span className="b-label">Setting</span>
                            <span className="b-value">Clinical Examination Room</span>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <div className="chat-start-marker">
                      <span>Station In Progress</span>
                    </div>

                    <AnimatePresence>
                      {conversation.filter(m => m.role !== 'system').map((msg, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`message-row ${msg.role}`}
                        >
                          <div className={`message-bubble ${msg.role}`}>
                            {msg.role === 'assistant' && (
                              <div className="message-header">
                                <span className="sender-name">Standardized Patient</span>
                              </div>
                            )}
                            <div className="message-text">
                              {msg.content}
                            </div>

                            {/* Metadata: Observation & Feedback */}
                            {msg.metadata?.observation && (
                              <div className="examiner-observation">
                                <Activity size={12} className="obs-icon" />
                                <span>{msg.metadata.observation}</span>
                              </div>
                            )}

                            {msg.metadata?.feedback && (
                              <div className="immediate-feedback">
                                <AlertCircle size={12} className="fb-icon" />
                                <span>{msg.metadata.feedback}</span>
                              </div>
                            )}

                            <div className="message-time">
                              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {generating && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="message-row assistant">
                        <div className="message-bubble assistant typing">
                          <div className="typing-dots">
                            <div className="dot"></div><div className="dot"></div><div className="dot"></div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  <div className="input-deck">
                    <div className="input-container">
                      <input
                        type="text"
                        placeholder="Type your response or action..."
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        disabled={generating}
                      />
                      <button
                        className="send-action-btn"
                        onClick={sendMessage}
                        disabled={!userInput.trim() || generating}
                      >
                        <Send size={18} />
                      </button>
                    </div>
                    <div className="voice-input-hint">
                      <Mic size={12} /> Microphone available for voice input
                    </div>
                  </div>
                </main>

                {/* Info Sidebar */}
                <aside className={`info-column ${showMobileSidebar ? 'mobile-visible' : ''}`}>
                  <div className="info-panel checklist-panel">
                    <div className="panel-header">
                      <ClipboardList size={18} />
                      <h3>Evaluation Criteria</h3>
                    </div>
                    <div className="checklist-scroll">
                      {scenarioData?.examiner_checklist?.length ? (
                        scenarioData.examiner_checklist.map((item, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className={`checklist-item-row ${checklistProgress.includes(item.item) ? 'completed' : ''}`}
                          >
                            <div className={`check-toggle ${checklistProgress.includes(item.item) ? 'checked' : ''}`}>
                              {checklistProgress.includes(item.item) ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                            </div>
                            <div className="check-content">
                              <span className="check-text">{item.item}</span>
                              <div className="check-footer">
                                <span className="check-points">{item.points} Points</span>
                                {checklistProgress.includes(item.item) && (
                                  <motion.span
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="achieved-badge"
                                  >
                                    Achieved
                                  </motion.span>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <div className="checklist-placeholder">
                          <Activity size={32} className="pulse-icon" />
                          <p>Consulting examiner for criteria...</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="info-panel tips-panel">
                    <div className="panel-header">
                      <Zap size={18} />
                      <h3>Clinical Tips</h3>
                    </div>
                    <ul className="tips-list">
                      <li>Always confirm patient identity</li>
                      <li>Use open-ended questions initially</li>
                      <li>Check for 'Red Flags' early</li>
                      <li>Summarize to ensure understanding</li>
                    </ul>
                  </div>
                </aside>

                {/* Mobile Toggle */}
                <button
                  className="mobile-info-toggle"
                  onClick={() => setShowMobileSidebar(!showMobileSidebar)}
                >
                  <ClipboardList size={24} />
                </button>
              </div>
            </motion.div>
          )}

          <style jsx>{`
            /* ================= GLOBAL ================= */
            .osce-container {
              min-height: calc(100vh - 56px);
              background: #F6F7F9; /* PROMPT: Soft silver / off-white */
              font-family: 'Inter', sans-serif;
              color: #1E293B;
              position: relative;
              overflow-x: hidden;
            }

            /* ================= SETUP SCREEN REDESIGN ================= */
            .setup-wrapper {
              max-width: 1120px; /* PROMPT: 1040-1120px */
              margin: 0 auto;
              padding: 40px 32px 80px; /* PROMPT: Side padding 24-32px */
              display: flex;
              flex-direction: column;
            }

            /* --- Header --- */
            .page-header {
              text-align: left;
              margin-bottom: 40px;
            }
            
            .page-header.center-aligned {
              text-align: center;
              margin-top: 60px;
              display: flex;
              flex-direction: column;
              align-items: center;
            }

            .header-badge {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%);
              border: 1px solid #C7D2FE;
              padding: 8px 14px;
              border-radius: 100px;
              font-size: 11px;
              font-weight: 700;
              color: #6366F1;
              margin-bottom: 16px;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
            }
            
            .sparkle-icon {
              animation: sparkle 2s ease-in-out infinite;
            }
            
            @keyframes sparkle {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.7; transform: scale(1.1); }
            }

            .page-header h1 {
              font-size: 36px;
              font-weight: 700;
              color: #0F172A;
              margin: 0 0 12px 0;
              letter-spacing: -0.025em;
            }

            .page-header p {
              font-size: 16px;
              color: #64748B;
              max-width: 640px;
              margin: 0;
              line-height: 1.6;
            }

            /* --- Instructions View --- */
            .instructions-view {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 12px;
              max-width: 1200px;
              margin: 0 auto;
              padding: 0 32px;
              width: 100%;
            }

            .instructions-card {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 32px;
              background: #FFFFFF;
              padding: 48px 40px;
              border-radius: 16px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 8px 24px rgba(0, 0, 0, 0.04);
              border: 1px solid #E8EEF3;
              width: 100%;
              max-width: 900px;
            }

            .instruction-step {
              display: flex;
              flex-direction: column;
              align-items: center;
              text-align: center;
              flex: 1;
              gap: 16px;
              padding: 0 8px;
            }

            .step-icon {
              width: 56px;
              height: 56px;
              border-radius: 14px;
              background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%);
              color: #6366F1;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 8px rgba(99, 102, 241, 0.12);
              transition: all 0.3s ease;
            }
            
            .step-icon:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
            }

            .step-arrow {
              color: #CBD5E1;
              flex-shrink: 0;
              margin: 0 4px;
            }

            .instruction-step h3 {
              font-size: 15px;
              font-weight: 600;
              color: #0F172A;
              margin: 0;
              letter-spacing: -0.01em;
            }

            .instruction-step p {
              font-size: 13px;
              color: #64748B;
              line-height: 1.6;
              margin: 0;
            }

            .start-sim-btn {
              background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
              color: white;
              padding: 16px 40px;
              border-radius: 12px;
              font-weight: 600;
              font-size: 15px;
              border: none;
              cursor: pointer;
              transition: all 0.3s ease;
              box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
              letter-spacing: -0.01em;
              margin-top: 24px;
            }
            
            .start-sim-btn:hover {
              transform: translateY(-2px);
              box-shadow: 0 8px 20px rgba(15, 23, 42, 0.25);
            }
            
            .start-sim-btn:active {
              transform: translateY(0);
            }

            /* --- Configuration Overlay --- */
            .config-overlay {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: rgba(15, 23, 42, 0.4);
              backdrop-filter: blur(4px);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 50;
              padding: 20px;
            }

            .config-card {
              background: white;
              width: 100%;
              max-width: 500px;
              border-radius: 24px;
              padding: 32px;
              border: 1px solid #E2E8F0;
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
              position: relative;
              display: flex;
              flex-direction: column;
              gap: 24px;
            }

            .config-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding-bottom: 20px;
              border-bottom: 1px solid #F1F5F9;
              margin-bottom: 10px;
            }

            .close-config-btn {
              background: #F8FAFC;
              border: 1px solid #E2E8F0;
              color: #64748B;
              cursor: pointer;
              padding: 8px;
              border-radius: 8px; /* Slightly squarer for header button */
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.2s;
            }

            .close-config-btn:hover {
              background: #F1F5F9;
              color: #0F172A;
              border-color: #CBD5E1;
            }

            .config-title {
              font-size: 18px;
              font-weight: 600;
              color: #0F172A;
              margin: 0;
              text-align: center;
            }

            .config-body {
              display: flex;
              flex-direction: column;
              gap: 24px;
            }

            .config-section label {
              display: block;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              font-weight: 600;
              color: #64748B;
              margin-bottom: 12px;
            }

            .mini-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
            }

            .mini-card {
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 12px;
              border: 1px solid #E2E8F0;
              border-radius: 10px;
              background: white;
              cursor: pointer;
              transition: all 0.2s;
              text-align: left;
            }

            .mini-card.selected {
              border-color: #6366F1;
              background: #EEF2FF;
              box-shadow: 0 0 0 1px #6366F1;
            }

            .mini-card span {
              font-size: 13px;
              font-weight: 500;
              color: #334155;
              flex: 1;
            }

            .rigor-options {
              display: flex;
              gap: 10px;
            }

            .rigor-chip {
              flex: 1;
              padding: 10px;
              border: 1px solid #E2E8F0;
              border-radius: 8px;
              background: white;
              font-size: 13px;
              font-weight: 500;
              color: #64748B;
              cursor: pointer;
              text-align: center;
            }

            .rigor-chip.selected {
              font-weight: 600;
            }

            .config-footer {
              display: flex;
              flex-direction: column;
              gap: 12px;
              align-items: center;
              margin-top: 8px;
            }

            .proceed-button {
              width: 100%;
              background: #0F172A;
              color: white;
              padding: 14px;
              border-radius: 12px;
              font-weight: 600;
              border: none;
              cursor: pointer;
            }

            .proceed-button:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }

            .validation-msg {
              font-size: 12px;
              color: #F87171;
            }

            /* --- Main Layout Legacy (keeping for safety or removing if fully replaced) --- */
            /* The previous styles can be cleaned up or repurposed. */ 
            .content-columns {
              display: grid;
              grid-template-columns: 2fr 1.2fr; /* Left (Stations) vs Right (Rigor/Info) */
              gap: 40px; /* PROMPT: Grid gap 16-20px (between cards), Section spacing 32-40px between cols */
              align-items: start;
            }

            .section-title {
              font-size: 12px;
              font-weight: 600;
              color: #94A3B8;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              margin-bottom: 16px;
            }

            /* --- Station Selection (Left) --- */
            .stations-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px; /* PROMPT: Grid gap 16-20px */
            }

            .station-card {
              background: white; /* PROMPT: Pure white */
              border: 1px solid #E6E8EC; /* PROMPT: Soft border */
              border-radius: 12px; /* PROMPT: 12px */
              padding: 24px;
              text-align: left;
              cursor: pointer;
              transition: all 0.2s ease;
              position: relative;
              display: flex;
              flex-direction: column;
              gap: 16px;
              height: 100%;
            }

            .station-card:hover {
              box-shadow: 0 4px 12px rgba(0,0,0,0.04); /* PROMPT: Subtle shadow */
              border-color: #D1D5DB;
            }

            .station-card.selected {
              border-color: #6366F1; /* PROMPT: Highlight border */
              background: #F5F7FF; /* PROMPT: Soft background tint */
              box-shadow: 0 0 0 1px #6366F1;
            }

            .card-icon {
              width: 44px;
              height: 44px;
              border-radius: 10px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #F3F4F6; /* PROMPT: Soft pastel container */
              transition: all 0.2s;
            }

            .card-info h3 {
              font-size: 16px;
              font-weight: 600;
              color: #1E293B;
              margin: 0 0 6px 0;
            }

            .card-info p {
              font-size: 13px;
              color: #64748B;
              margin: 0;
              line-height: 1.4;
            }

            .check-indicator {
              position: absolute;
              top: 16px;
              right: 16px;
              color: #6366F1;
            }

            /* --- Right Column (Rigor + Params) --- */
            .right-column {
              display: flex;
              flex-direction: column;
              gap: 40px;
            }

            /* Rigor */
            .rigor-stack {
              display: flex;
              flex-direction: column;
              gap: 12px;
            }

            .rigor-card {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 16px 20px;
              background: white;
              border: 1px solid #E6E8EC;
              border-radius: 12px;
              cursor: pointer;
              transition: all 0.2s;
              text-align: left;
            }

            .rigor-card:hover {
              border-color: #CBD5E1;
            }

            .rigor-card.selected {
              border-color: #6366F1;
              background: #FDFDFF; /* Very subtle tint */
            }

            .rigor-content {
              display: flex;
              flex-direction: column;
              gap: 2px;
            }

            .rigor-title {
              font-size: 14px;
              font-weight: 600;
              color: #1E293B;
            }

            .rigor-desc {
              font-size: 12px;
              color: #64748B;
            }

            .radio-circle {
              width: 18px;
              height: 18px;
              border-radius: 50%;
              border: 2px solid #E2E8F0;
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .radio-circle.filled {
              border-color: #6366F1;
            }

            .radio-dot {
              width: 10px;
              height: 10px;
              border-radius: 50%;
              background: #6366F1;
            }

            /* Params */
            .params-container {
              background: #F8FAFC; /* PROMPT: Light background container */
              border-radius: 12px;
              padding: 20px;
              display: flex;
              flex-direction: column;
              gap: 16px;
            }

            .param-item {
              display: flex;
              align-items: center;
              gap: 12px;
            }

            .param-icon {
              color: #94A3B8;
            }

            .param-details {
              display: flex;
              flex-direction: column;
            }

            .param-label {
              font-size: 11px;
              font-weight: 700;
              color: #94A3B8;
              text-transform: uppercase;
            }

            .param-value {
              font-size: 14px;
              font-weight: 600;
              color: #334155;
            }

            /* --- Primary Action Area --- */
            .action-area {
              display: flex;
              flex-direction: column;
              align-items: flex-start; /* Aligns with grid */
              gap: 12px;
              margin-top: 20px;
            }

            .proceed-button {
              background: #6366F1; /* PROMPT: Primary accent color */
              color: white;
              font-size: 15px;
              font-weight: 600;
              height: 48px; /* PROMPT: 44-48px */
              padding: 0 40px;
              border-radius: 12px; /* Matching theme */
              border: none;
              cursor: pointer;
              transition: all 0.2s;
              box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25); /* PROMPT: Soft shadow */
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .proceed-button:hover:not(.disabled) {
              background: #4F46E5;
              transform: translateY(-1px);
            }

            .proceed-button.disabled {
              background: #E2E8F0;
              color: #94A3B8;
              cursor: not-allowed;
              box-shadow: none;
            }

            .helper-text {
              font-size: 13px;
              color: #64748B;
            }

            .spinner {
              width: 16px;
              height: 16px;
              border: 2px solid rgba(255,255,255,0.3);
              border-top-color: white;
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
              margin-right: 8px;
            }

            .processing-state {
              display: flex;
              align-items: center;
            }

            /* --- Responsiveness --- */
            @media (max-width: 1024px) {
              .content-columns {
                 grid-template-columns: 1fr;
                 gap: 32px;
              }
              
              .right-column {
                 flex-direction: row;
                 gap: 20px;
              }

              .rigor-section, .params-section {
                 flex: 1;
              }
            }

            @media (max-width: 768px) {
              .right-column {
                 flex-direction: column;
              }
              
              .stations-grid {
                 grid-template-columns: 1fr;
              }
              
              .proceed-button {
                 width: 100%;
              }
              
              .action-area {
                 align-items: center;
                 width: 100%;
              }

              .osce-container {
                 padding-bottom: 40px;
              }
              
              .setup-wrapper {
                 padding: 24px 20px 60px;
              }
            }


            /* ================= ACTIVE SESSION ================= */
            .session-wrapper {
              display: flex;
              flex-direction: column;
              background: #FFF;
            }

            /* ================= ACTIVE SESSION ================= */
            .session-wrapper {
              display: flex;
              flex-direction: column;
              background: #FFF;
              flex: 1;
            }

            .session-topbar {
              height: 64px;
              background: #FDFBF7;
              border-bottom: 1px solid #E2E8F0;
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 0 24px;
              z-index: 10;
              box-shadow: 0 4px 12px rgba(0,0,0,0.02);
            }

            .session-meta {
              display: flex;
              align-items: center;
              gap: 16px;
            }

            .back-btn {
              display: flex;
              align-items: center;
              gap: 8px;
              background: white;
              border: 1px solid #E2E8F0;
              color: #64748B;
              font-weight: 700;
              font-size: 13.5px;
              cursor: pointer;
              padding: 8px 16px;
              border-radius: 12px;
              transition: all 0.2s;
              box-shadow: 0 2px 4px rgba(0,0,0,0.02);
            }

            .back-btn:hover {
              background: #F1F5F9;
              color: #EF4444;
              border-color: #F87171;
            }

            .station-badge {
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 8px 16px;
              background: white;
              border: 1px solid #E2E8F0;
              border-radius: 12px;
              font-size: 14px;
              font-weight: 700;
              color: #1E293B;
              box-shadow: 0 2px 4px rgba(0,0,0,0.02);
            }

            .difficulty-tag {
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              padding: 5px 12px;
              border: 1px solid;
              border-radius: 8px;
              background: white;
              letter-spacing: 0.05em;
            }

            .session-timer {
              display: flex;
              align-items: center;
              gap: 10px;
              font-family: 'Outfit', sans-serif;
              font-size: 20px;
              font-weight: 800;
              background: #1E293B;
              padding: 8px 20px;
              border-radius: 14px;
              box-shadow: 0 8px 16px rgba(0,0,0,0.1);
            }

            /* Layout */
            .session-layout {
              flex: 1;
              display: flex;
              overflow: hidden;
              position: relative;
              background: #F7F6F2;
            }

            /* Chat Column */
            .chat-column {
              flex: 1;
              display: flex;
              flex-direction: column;
              position: relative;
              max-width: 900px;
              margin: 0 auto;
              width: 100%;
            }

            .chat-area {
              flex: 1;
              overflow-y: auto;
              padding: 40px 24px;
              display: flex;
              flex-direction: column;
              gap: 24px;
              scrollbar-width: thin;
              scrollbar-color: #E2E8F0 transparent;
            }

            .chat-area::-webkit-scrollbar {
              width: 6px;
            }
            .chat-area::-webkit-scrollbar-thumb {
              background-color: #E2E8F0;
              border-radius: 10px;
            }

            /* Patient Case Brief Card */
            .patient-brief-card {
              background: rgba(255, 255, 255, 0.85);
              backdrop-filter: blur(12px);
              border: 1px solid #E2E8F0;
              border-radius: 20px;
              padding: 24px;
              margin-bottom: 24px;
              box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.05);
            }

            .brief-header {
              display: flex;
              align-items: center;
              gap: 10px;
              font-size: 12px;
              font-weight: 800;
              color: #6366F1;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              margin-bottom: 16px;
            }

            .brief-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
            }

            .brief-item {
              display: flex;
              flex-direction: column;
              gap: 4px;
            }

            .b-label {
              font-size: 11px;
              color: #94A3B8;
              font-weight: 700;
              text-transform: uppercase;
            }

            .b-value {
              font-size: 14.5px;
              color: #1E293B;
              font-weight: 700;
            }

            .chat-start-marker {
              text-align: center;
              position: relative;
              margin: 20px 0;
            }

            .chat-start-marker span {
              background: #E2E8F0;
              color: #64748B;
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              padding: 6px 16px;
              border-radius: 100px;
            }

            .message-row {
              display: flex;
              width: 100%;
              margin-bottom: 8px;
            }

            .message-row.user {
              justify-content: flex-end;
            }

            .message-bubble {
              max-width: 82%;
              padding: 18px 24px;
              border-radius: 20px;
              position: relative;
              box-shadow: 0 4px 15px -4px rgba(0, 0, 0, 0.05);
            }

            .message-bubble.assistant {
              background: white;
              border: 1px solid #E2E8F0;
              border-radius: 4px 24px 24px 24px;
              color: #1E293B;
            }

            .message-bubble.user {
              background: linear-gradient(135deg, #6366F1 0%, #3730A3 100%);
              color: white;
              border-radius: 24px 24px 4px 24px;
              box-shadow: 0 10px 25px -8px rgba(99, 102, 241, 0.4);
            }

            .message-header {
              margin-bottom: 8px;
              font-size: 11px;
              font-weight: 800;
              color: #6366F1;
              text-transform: uppercase;
              letter-spacing: 0.08em;
            }

            .message-text {
              line-height: 1.65;
              font-size: 15.5px;
              font-weight: 450;
            }

            /* Examiner Metadata Styles */
            .examiner-observation {
              margin-top: 14px;
              padding: 12px 16px;
              background: rgba(99, 102, 241, 0.06);
              border-radius: 12px;
              font-size: 13.5px;
              color: #4F46E5;
              font-style: italic;
              border-left: 3px solid #6366F1;
              display: flex;
              align-items: flex-start;
              gap: 10px;
              line-height: 1.5;
            }

            .obs-icon {
              margin-top: 3px;
              flex-shrink: 0;
            }

            .immediate-feedback {
              margin-top: 10px;
              padding: 12px 16px;
              background: rgba(16, 185, 129, 0.06);
              border-radius: 12px;
              font-size: 13.5px;
              color: #059669;
              border-left: 3px solid #10B981;
              display: flex;
              align-items: flex-start;
              gap: 10px;
              line-height: 1.5;
            }

            .fb-icon {
              margin-top: 3px;
              flex-shrink: 0;
            }

            .message-time {
              font-size: 10px;
              text-align: right;
              margin-top: 8px;
              opacity: 0.5;
              font-weight: 600;
            }

            /* Input Deck */
            .input-deck {
              padding: 24px 24px 40px;
              background: linear-gradient(to top, #F7F6F2 80%, rgba(247, 246, 242, 0));
              z-index: 20;
            }

            .input-container {
              display: flex;
              gap: 12px;
              background: white;
              padding: 8px 8px 8px 20px;
              border-radius: 24px;
              border: 1px solid #E2E8F0;
              transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
              box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.08);
              max-width: 800px;
              margin: 0 auto;
            }
            
            .input-container:focus-within {
              border-color: #6366F1;
              box-shadow: 0 12px 40px -12px rgba(99, 102, 241, 0.15), 0 0 0 1px rgba(99, 102, 241, 0.1);
            }

            .input-container input {
              flex: 1;
              background: transparent;
              border: none;
              padding: 12px 0;
              font-size: 15.5px;
              outline: none;
              color: #1E293B;
              font-weight: 450;
            }

            .send-action-btn {
              width: 44px;
              height: 44px;
              border-radius: 16px;
              background: linear-gradient(135deg, #6366f1 0%, #3730a3 100%);
              color: white;
              border: none;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
              box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
            }

            .send-action-btn:hover:not(:disabled) {
              transform: translateY(-2px);
              box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
            }
            
            .send-action-btn:disabled {
              background: #F1F5F9;
              color: #94A3B8;
              box-shadow: none;
              cursor: not-allowed;
            }

            /* Info Column (Right) */
            .info-column {
              width: 380px;
              background: #FDFBF7;
              border-left: 1px solid #E2E8F0;
              padding: 24px;
              display: flex;
              flex-direction: column;
              gap: 24px;
              overflow-y: auto;
            }

            .info-panel {
              background: white;
              border-radius: 20px;
              padding: 24px;
              border: 1px solid #E2E8F0;
              box-shadow: 0 4px 12px rgba(0,0,0,0.02);
            }

            .checklist-panel {
              flex: 1;
              display: flex;
              flex-direction: column;
              min-height: 0;
            }

            .panel-header {
              display: flex;
              align-items: center;
              gap: 12px;
              color: #1E293B;
              margin-bottom: 20px;
              padding-bottom: 16px;
              border-bottom: 1px solid #F1F5F9;
            }
            
            .panel-header h3 {
               margin: 0;
               font-size: 14px;
               font-weight: 800;
               text-transform: uppercase;
               letter-spacing: 0.1em;
            }

            .checklist-scroll {
              flex: 1;
              overflow-y: auto;
              padding-right: 8px;
            }

            .checklist-item-row {
              display: flex;
              align-items: flex-start;
              gap: 14px;
              margin-bottom: 16px;
              padding: 14px;
              border-radius: 16px;
              background: #F8FAFC;
              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
              border: 1px solid transparent;
            }

            .checklist-item-row.completed {
              background: rgba(16, 185, 129, 0.05);
              border-color: rgba(16, 185, 129, 0.2);
            }

            .check-toggle {
              color: #CBD5E1;
              flex-shrink: 0;
            }

            .check-toggle.checked {
              color: #10B981;
            }

            .check-content {
              flex: 1;
            }

            .check-text {
              display: block;
              font-size: 14px;
              color: #475569;
              line-height: 1.5;
              margin-bottom: 8px;
              font-weight: 600;
            }

            .check-footer {
              display: flex;
              align-items: center;
              gap: 10px;
            }

            .check-points {
              font-size: 10px;
              color: #6366F1;
              font-weight: 800;
              background: rgba(99, 102, 241, 0.08);
              padding: 3px 8px;
              border-radius: 6px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }

            .achieved-badge {
              font-size: 10px;
              color: #10B981;
              font-weight: 800;
              background: rgba(16, 185, 129, 0.1);
              padding: 3px 8px;
              border-radius: 6px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              box-shadow: 0 4px 10px rgba(16, 185, 129, 0.1);
            }

            .tips-list {
               padding: 0;
               margin: 0;
               list-style: none;
            }
            
            .tips-list li {
               font-size: 14px;
               color: #475569;
               margin-bottom: 12px;
               line-height: 1.5;
               display: flex;
               gap: 10px;
               font-weight: 500;
            }

            .tips-list li::before {
              content: "•";
              color: #6366F1;
              font-weight: 800;
            }

            /* Responsive */
            @media (max-width: 1024px) {
              .main-selection-grid {
                 grid-template-columns: 1fr;
              }
              .settings-sidebar {
                 display: grid;
                 grid-template-columns: 1fr 1fr;
                 gap: 24px;
              }
            }

            @media (max-width: 768px) {
              .info-column {
                 position: fixed;
                 bottom: 0;
                 left: 0;
                 width: 100%;
                 height: 75vh;
                 z-index: 100;
                 transform: translateY(100%);
                 transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                 padding: 32px 20px;
              }
              
              .info-column.mobile-visible {
                 transform: translateY(0);
              }

              .brief-grid {
                grid-template-columns: 1fr 1fr;
              }
              
              .page-header h1 {
                font-size: 28px;
              }
              
              .page-header p {
                font-size: 15px;
              }
              
              .instructions-card {
                flex-direction: column;
                padding: 32px 24px;
                gap: 24px;
              }
              
              .step-arrow {
                transform: rotate(90deg);
                margin: 4px 0;
              }
              
              .instruction-step {
                max-width: 100%;
              }
              
              .start-sim-btn {
                width: 100%;
                padding: 14px 32px;
              }
            }
          `}</style>
        </div>
      </DashboardLayout >
    </>
  )
}
