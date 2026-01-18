import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import styles from '@/styles/OSCE.module.css'

// Types
interface PatientInfo {
  name?: string
  age?: number
  gender?: string
  presenting_complaint?: string
  appearance?: string
  emotional_state?: 'calm' | 'anxious' | 'distressed'
  severity?: 'low' | 'moderate' | 'high'
}

interface OSCEScenario {
  id: string
  scenario_type: string
  specialty: string
  difficulty: string
  status: string
  candidate_instructions: string
  time_limit_seconds: number
  patient_info: PatientInfo
  patient_script?: Record<string, any>
  interaction_history?: Array<{
    timestamp: string
    student: string
    patient: string
    checklist_items?: string[]
  }>
}

interface CompletionResult {
  scenario_id: string
  final_score: number
  earned_points: number
  total_points: number
  completed_items: string[]
  missed_items: string[]
  interaction_count: number
  expected_actions: string[]
}

interface ChecklistItem {
  id: string
  label: string
  status: 'pending' | 'active' | 'completed'
}

// Scenario Types
const SCENARIO_TYPES = [
  { id: 'history_taking', name: 'History Taking', icon: '📋', desc: 'Take a focused patient history' },
  { id: 'physical_examination', name: 'Physical Examination', icon: '🩺', desc: 'Perform systematic examination' },
  { id: 'communication_skills', name: 'Communication Skills', icon: '💬', desc: 'Breaking bad news, counseling' },
  { id: 'clinical_procedure', name: 'Clinical Procedure', icon: '💉', desc: 'Demonstrate clinical skills' },
  { id: 'data_interpretation', name: 'Data Interpretation', icon: '📊', desc: 'Interpret investigations' },
  { id: 'emergency_management', name: 'Emergency Management', icon: '🚑', desc: 'Handle acute scenarios' },
]

const SPECIALTIES = [
  { id: 'general_medicine', name: 'Medicine', icon: '🏥' },
  { id: 'surgery', name: 'Surgery', icon: '🔪' },
  { id: 'pediatrics', name: 'Pediatrics', icon: '👶' },
  { id: 'obstetrics_gynecology', name: 'OBG', icon: '🤰' },
  { id: 'psychiatry', name: 'Psychiatry', icon: '🧠' },
  { id: 'emergency_medicine', name: 'Emergency', icon: '🚑' },
]

const DIFFICULTIES = [
  { id: 'beginner', name: 'Beginner', color: '#10B981' },
  { id: 'intermediate', name: 'Intermediate', color: '#F59E0B' },
  { id: 'advanced', name: 'Advanced', color: '#EF4444' },
]

const OSCE_CHECKLIST: ChecklistItem[] = [
  { id: 'intro', label: 'Introduction', status: 'pending' },
  { id: 'consent', label: 'Consent', status: 'pending' },
  { id: 'history', label: 'History Taking', status: 'pending' },
  { id: 'redflags', label: 'Red Flags', status: 'pending' },
  { id: 'summary', label: 'Summary', status: 'pending' },
]

export default function OSCESimulator() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)

  // Setup state
  const [showSetup, setShowSetup] = useState(true)
  const [selectedType, setSelectedType] = useState('history_taking')
  const [selectedSpecialty, setSelectedSpecialty] = useState('general_medicine')
  const [selectedDifficulty, setSelectedDifficulty] = useState('intermediate')

  // Active scenario state
  const [activeScenario, setActiveScenario] = useState<OSCEScenario | null>(null)
  const [userInput, setUserInput] = useState('')
  const [conversation, setConversation] = useState<Array<{ role: 'student' | 'patient' | 'examiner', content: string }>>([])
  const [checklist, setChecklist] = useState<ChecklistItem[]>(OSCE_CHECKLIST)

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(480)
  const [timerActive, setTimerActive] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // UI state
  const [showTips, setShowTips] = useState(false)
  const [clinicalMode, setClinicalMode] = useState(false)

  // Completion state
  const [completed, setCompleted] = useState(false)
  const [completionData, setCompletionData] = useState<CompletionResult | null>(null)

  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkAuth()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [conversation])

  useEffect(() => {
    if (timerActive && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setTimerActive(false)
            handleTimeUp()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [timerActive])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }
    setUser(session.user as AuthUser)
    setLoading(false)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getTimerProgress = () => {
    const total = activeScenario?.time_limit_seconds || 480
    return ((total - timeRemaining) / total) * 100
  }

  const getTimerColor = () => {
    if (timeRemaining < 30) return 'critical'
    if (timeRemaining < 60) return 'warning'
    return ''
  }

  const handleTimeUp = async () => {
    if (activeScenario && !completed) {
      await completeScenario()
    }
  }

  const startScenario = async () => {
    setGenerating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/clinical/osce`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scenario_type: selectedType,
          specialty: selectedSpecialty,
          difficulty: selectedDifficulty
        })
      })

      if (!response.ok) throw new Error('Failed to create OSCE scenario')

      const scenario = await response.json()
      // Add default emotional state and severity if not provided
      if (!scenario.patient_info.emotional_state) {
        scenario.patient_info.emotional_state = 'anxious'
      }
      if (!scenario.patient_info.severity) {
        scenario.patient_info.severity = 'moderate'
      }

      setActiveScenario(scenario)
      setTimeRemaining(scenario.time_limit_seconds || 480)
      setShowSetup(false)
      setTimerActive(true)
      setChecklist(OSCE_CHECKLIST.map((item, index) => ({
        ...item,
        status: index === 0 ? 'active' : 'pending'
      })))

      // Add initial patient greeting
      if (scenario.patient_info) {
        const greeting = `[Patient appears ${scenario.patient_info.appearance || 'seated comfortably'}]`
        setConversation([{ role: 'patient', content: greeting }])
      }
    } catch (error) {
      console.error('Failed to start OSCE:', error)
      alert('Failed to generate OSCE scenario. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const sendMessage = async () => {
    if (!userInput.trim() || !activeScenario || sending) return

    const studentMessage = userInput
    setUserInput('')
    setConversation(prev => [...prev, { role: 'student', content: studentMessage }])
    setSending(true)

    // Update checklist based on message content
    updateChecklist(studentMessage)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/clinical/osce/${activeScenario.id}/interact`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ user_action: studentMessage })
        }
      )

      if (!response.ok) throw new Error('Failed to process interaction')

      const result = await response.json()
      setConversation(prev => [...prev, {
        role: 'patient',
        content: result.patient_response
      }])

      if (result.feedback) {
        setConversation(prev => [...prev, {
          role: 'examiner',
          content: result.feedback
        }])
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setConversation(prev => [...prev, {
        role: 'patient',
        content: "[Unable to process response. Please try again.]"
      }])
    } finally {
      setSending(false)
    }
  }

  const updateChecklist = (message: string) => {
    const lowerMessage = message.toLowerCase()

    setChecklist(prev => {
      const updated = [...prev]

      // Check for introduction keywords
      if (lowerMessage.includes('hello') || lowerMessage.includes('my name') || lowerMessage.includes('introduce')) {
        const introIndex = updated.findIndex(i => i.id === 'intro')
        if (introIndex >= 0) {
          updated[introIndex].status = 'completed'
          if (introIndex + 1 < updated.length) updated[introIndex + 1].status = 'active'
        }
      }

      // Check for consent keywords
      if (lowerMessage.includes('permission') || lowerMessage.includes('consent') || lowerMessage.includes('is it okay')) {
        const consentIndex = updated.findIndex(i => i.id === 'consent')
        if (consentIndex >= 0) {
          updated[consentIndex].status = 'completed'
          if (consentIndex + 1 < updated.length) updated[consentIndex + 1].status = 'active'
        }
      }

      // Check for history taking
      if (lowerMessage.includes('when did') || lowerMessage.includes('how long') || lowerMessage.includes('tell me about')) {
        const historyIndex = updated.findIndex(i => i.id === 'history')
        if (historyIndex >= 0 && updated[historyIndex].status !== 'completed') {
          updated[historyIndex].status = 'completed'
          if (historyIndex + 1 < updated.length) updated[historyIndex + 1].status = 'active'
        }
      }

      // Check for red flags
      if (lowerMessage.includes('weight loss') || lowerMessage.includes('blood') || lowerMessage.includes('fever') || lowerMessage.includes('night sweats')) {
        const redFlagsIndex = updated.findIndex(i => i.id === 'redflags')
        if (redFlagsIndex >= 0) {
          updated[redFlagsIndex].status = 'completed'
          if (redFlagsIndex + 1 < updated.length) updated[redFlagsIndex + 1].status = 'active'
        }
      }

      // Check for summary
      if (lowerMessage.includes('summarize') || lowerMessage.includes('summary') || lowerMessage.includes('to recap')) {
        const summaryIndex = updated.findIndex(i => i.id === 'summary')
        if (summaryIndex >= 0) {
          updated[summaryIndex].status = 'completed'
        }
      }

      return updated
    })
  }

  const completeScenario = async () => {
    if (!activeScenario) return

    setTimerActive(false)
    if (timerRef.current) clearInterval(timerRef.current)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/clinical/osce/${activeScenario.id}/complete`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (!response.ok) throw new Error('Failed to complete scenario')

      const result = await response.json()
      setCompletionData(result)
      setCompleted(true)
    } catch (error) {
      console.error('Failed to complete scenario:', error)
    }
  }

  const resetScenario = () => {
    setActiveScenario(null)
    setShowSetup(true)
    setCompleted(false)
    setCompletionData(null)
    setConversation([])
    setUserInput('')
    setTimeRemaining(480)
    setTimerActive(false)
    setChecklist(OSCE_CHECKLIST)
    setClinicalMode(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  // Quick action suggestions
  const quickSuggestions = [
    { label: 'Introduce yourself', action: 'Hello, I am Dr. Smith, a medical student. Is it okay if I speak with you today?' },
    { label: 'Ask about pain', action: 'Can you tell me more about your pain? Where exactly is it located?' },
    { label: 'Duration', action: 'How long have you been experiencing these symptoms?' },
    { label: 'Red flags', action: 'Have you noticed any weight loss, blood, or fever recently?' },
    { label: 'Summarize', action: 'Let me summarize what you have told me so far...' },
  ]

  const getEmotionalIcon = (state?: string) => {
    switch (state) {
      case 'calm': return '😊'
      case 'anxious': return '😰'
      case 'distressed': return '😣'
      default: return '😐'
    }
  }

  // Timer circle calculations
  const timerRadius = 26
  const timerCircumference = 2 * Math.PI * timerRadius
  const timerOffset = timerCircumference - (getTimerProgress() / 100) * timerCircumference

  if (loading || !user) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading OSCE Simulator...</p>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>OSCE Simulator - Vaidya AI</title>
        <meta name="description" content="Practice OSCE examinations with AI-simulated patients and examiners" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <DashboardLayout user={user}>
        <div className={`${styles.osceWrapper} ${clinicalMode ? styles.clinicalMode : ''}`}>
          {/* Subtle Pulse Wave Background */}
          <div className={styles.pulseBackground}>
            <div className={styles.pulseWave}></div>
          </div>

          <div className={styles.mainContent}>
            {/* Setup View */}
            {showSetup && !activeScenario && (
              <div className={styles.setupView}>
                <div className={styles.setupHeader}>
                  <div className={styles.setupIcon}>🏥</div>
                  <h1>OSCE Simulator</h1>
                  <p>Practice structured clinical examinations with AI patients</p>
                </div>

                {/* Station Type Selection */}
                <div className={styles.stationTypeGrid}>
                  {SCENARIO_TYPES.map((type, index) => (
                    <button
                      key={type.id}
                      className={`${styles.stationTypeCard} ${selectedType === type.id ? styles.active : ''}`}
                      onClick={() => setSelectedType(type.id)}
                    >
                      <div className={styles.iconWell}>{type.icon}</div>
                      <div className={styles.cardBody}>
                        <div className={styles.cardHeader}>
                          <span className={styles.stationCode}>ST-{String(index + 1).padStart(2, '0')}</span>
                          <span className={styles.categoryBadge}>Assessment</span>
                        </div>
                        <span className={styles.stationTypeName}>{type.name}</span>
                        <span className={styles.stationTypeDesc}>{type.desc}</span>
                        <div className={styles.cardFooter}>
                          <div className={styles.tag}>
                            <span>⏱️</span>
                            <span>8-10 mins</span>
                          </div>
                          <div className={styles.tag}>
                            <span>📊</span>
                            <span>Score Weight: 15%</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Specialty and Difficulty */}
                <div className={styles.optionsRow}>
                  <div className={styles.optionSection}>
                    <h3>Specialty</h3>
                    <div className={styles.optionChips}>
                      {SPECIALTIES.map(spec => (
                        <button
                          key={spec.id}
                          className={`${styles.optionChip} ${selectedSpecialty === spec.id ? styles.active : ''}`}
                          onClick={() => setSelectedSpecialty(spec.id)}
                        >
                          <span>{spec.icon}</span>
                          <span>{spec.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.optionSection}>
                    <h3>Difficulty</h3>
                    <div className={styles.difficultyTrack}>
                      {DIFFICULTIES.map(diff => (
                        <button
                          key={diff.id}
                          className={`${styles.difficultyBtn} ${selectedDifficulty === diff.id ? `${styles.active} ${styles[diff.id]}` : ''}`}
                          onClick={() => setSelectedDifficulty(diff.id)}
                        >
                          {diff.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={styles.startSection}>
                  <button
                    className={styles.startButton}
                    onClick={startScenario}
                    disabled={generating}
                  >
                    {generating ? (
                      <>
                        <span className={styles.spinner}></span>
                        Setting Up Station...
                      </>
                    ) : (
                      <>
                        <span>🏁</span>
                        Begin OSCE Station
                      </>
                    )}
                  </button>
                </div>

                {/* OSCE Tips */}
                <div className={styles.setupTipsCard}>
                  <h3>💡 OSCE Tips</h3>
                  <div className={styles.setupTipsList}>
                    <div className={styles.setupTipItem}>
                      <span>📌</span>
                      <div>
                        <strong>Introduction</strong>
                        <span>Always introduce yourself and confirm patient identity</span>
                      </div>
                    </div>
                    <div className={styles.setupTipItem}>
                      <span>✋</span>
                      <div>
                        <strong>Consent</strong>
                        <span>Obtain permission before any examination</span>
                      </div>
                    </div>
                    <div className={styles.setupTipItem}>
                      <span>💬</span>
                      <div>
                        <strong>Communication</strong>
                        <span>Use clear, jargon-free language</span>
                      </div>
                    </div>
                    <div className={styles.setupTipItem}>
                      <span>📋</span>
                      <div>
                        <strong>Systematic</strong>
                        <span>Follow structured approach (e.g., SOCRATES)</span>
                      </div>
                    </div>
                    <div className={styles.setupTipItem}>
                      <span>⏱️</span>
                      <div>
                        <strong>Time Management</strong>
                        <span>Watch the clock and summarize findings</span>
                      </div>
                    </div>
                    <div className={styles.setupTipItem}>
                      <span>🤝</span>
                      <div>
                        <strong>Professionalism</strong>
                        <span>Maintain rapport and show empathy</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Active OSCE View */}
            {activeScenario && !completed && (
              <>
                {/* Top Floating Command Bar */}
                <div className={styles.commandBar}>
                  <div className={styles.commandBarLeft}>
                    <div className={styles.stationTitle}>
                      <div className={styles.stationIcon}>
                        {SCENARIO_TYPES.find(t => t.id === activeScenario.scenario_type)?.icon}
                      </div>
                      <div className={styles.stationInfo}>
                        <h1>OSCE Station</h1>
                        <div className={styles.stationMeta}>
                          <span className={`${styles.metaBadge} ${styles.specialty}`}>
                            {activeScenario.specialty.replace(/_/g, ' ')}
                          </span>
                          <span className={`${styles.metaBadge} ${styles.difficulty} ${styles[activeScenario.difficulty]}`}>
                            {activeScenario.difficulty}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles.commandBarRight}>
                    {/* Circular Timer */}
                    <div className={styles.timerContainer}>
                      <svg className={styles.timerRing} width="64" height="64">
                        <circle
                          className={styles.timerRingBg}
                          cx="32"
                          cy="32"
                          r={timerRadius}
                        />
                        <circle
                          className={`${styles.timerRingProgress} ${styles[getTimerColor()]}`}
                          cx="32"
                          cy="32"
                          r={timerRadius}
                          strokeDasharray={timerCircumference}
                          strokeDashoffset={timerOffset}
                        />
                      </svg>
                      <span className={styles.timerText}>{formatTime(timeRemaining)}</span>
                    </div>
                    <button className={styles.endStationBtn} onClick={completeScenario}>
                      End Station
                    </button>
                  </div>
                </div>

                {/* 3-Zone Layout */}
                <div className={styles.threeZoneLayout}>
                  {/* Left Clinical Context Panel */}
                  <div className={styles.clinicalContextPanel}>
                    {/* Patient Card */}
                    <div className={styles.patientCard}>
                      <div className={styles.patientHeader}>
                        <div className={styles.patientAvatar}>
                          🧑
                        </div>
                        <div className={styles.patientInfo}>
                          <h3>{activeScenario.patient_info.name || 'Unknown Patient'}</h3>
                          <span className={styles.patientMeta}>
                            {activeScenario.patient_info.age || 'N/A'} years, {activeScenario.patient_info.gender || 'N/A'}
                          </span>
                          <span className={`${styles.emotionalBadge} ${styles[activeScenario.patient_info.emotional_state || 'calm']}`}>
                            {getEmotionalIcon(activeScenario.patient_info.emotional_state)} {activeScenario.patient_info.emotional_state || 'Calm'}
                          </span>
                        </div>
                      </div>

                      <div className={styles.complaintSection}>
                        <div className={styles.complaintLabel}>Chief Complaint</div>
                        <div className={styles.complaintText}>
                          {(activeScenario.patient_info.presenting_complaint || 'Not specified').charAt(0).toUpperCase() + (activeScenario.patient_info.presenting_complaint || '').slice(1)}
                        </div>
                      </div>

                      <div className={styles.severityMeter}>
                        <div className={styles.severityLabel}>Scenario Severity</div>
                        <div className={styles.severityBar}>
                          <div className={`${styles.severityFill} ${styles[activeScenario.patient_info.severity || 'moderate']}`}></div>
                        </div>
                      </div>
                    </div>

                    {/* Progress Checklist */}
                    <div className={styles.progressChecklist}>
                      <h4 className={styles.checklistTitle}>
                        📋 Progress Checklist
                      </h4>
                      <div className={styles.checklistItems}>
                        {checklist.map(item => (
                          <div key={item.id} className={`${styles.checklistItem} ${styles[item.status]}`}>
                            <div className={`${styles.checklistIcon} ${styles[item.status]}`}>
                              {item.status === 'completed' ? '✓' : item.status === 'active' ? '→' : '○'}
                            </div>
                            <span className={styles.checklistText}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Main Interaction Canvas */}
                  <div className={styles.interactionCanvas}>
                    {/* Clinical Transcript */}
                    <div className={styles.clinicalTranscript} ref={chatContainerRef}>
                      {conversation.map((msg, i) => (
                        msg.role === 'examiner' ? (
                          <div key={i} className={styles.examinerNote}>
                            <div className={styles.noteLabel}>Examiner Feedback</div>
                            <div className={styles.noteText}>{msg.content}</div>
                          </div>
                        ) : (
                          <div key={i} className={`${styles.transcriptEntry} ${styles[msg.role]}`}>
                            <div className={styles.entryAvatar}>
                              {msg.role === 'student' ? '👨‍⚕️' : '🧑'}
                            </div>
                            <div className={styles.entryContent}>
                              <span className={styles.entryRole}>
                                {msg.role === 'student' ? 'You (Doctor)' : 'Patient'}
                              </span>
                              <p className={styles.entryText}>{msg.content}</p>
                            </div>
                          </div>
                        )
                      ))}
                      {sending && (
                        <div className={`${styles.transcriptEntry} ${styles.patient}`}>
                          <div className={styles.entryAvatar}>🧑</div>
                          <div className={styles.entryContent}>
                            <span className={styles.entryRole}>Patient</span>
                            <div className={styles.typingIndicator}>
                              <span className={styles.typingDot}></span>
                              <span className={styles.typingDot}></span>
                              <span className={styles.typingDot}></span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Clinical Command Box */}
                    <div className={styles.clinicalCommandBox}>
                      <div className={styles.commandInputWrapper}>
                        <div className={styles.commandInput}>
                          <textarea
                            placeholder="Describe your action or speak to the patient..."
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                sendMessage()
                              }
                            }}
                            rows={2}
                            disabled={generating}
                          />
                        </div>
                        <button
                          className={styles.sendButton}
                          onClick={sendMessage}
                          disabled={generating || !userInput.trim()}
                        >
                          {generating ? (
                            <span className={styles.spinner}></span>
                          ) : (
                            <>Send →</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating OSCE Tips Panel */}
                <div className={styles.tipsPanel}>
                  <button
                    className={styles.tipsTrigger}
                    onClick={() => setShowTips(!showTips)}
                  >
                    💡
                  </button>
                  {showTips && (
                    <div className={styles.tipsContent}>
                      <h4>💡 Quick Tips</h4>
                      <div className={styles.tipsList}>
                        <div className={styles.tipItem}>
                          <span className={styles.tipIcon}>📌</span>
                          <span><strong>SOCRATES</strong> for pain assessment</span>
                        </div>
                        <div className={styles.tipItem}>
                          <span className={styles.tipIcon}>⚠️</span>
                          <span>Always ask about <strong>red flags</strong></span>
                        </div>
                        <div className={styles.tipItem}>
                          <span className={styles.tipIcon}>🤝</span>
                          <span>Show <strong>empathy</strong> and rapport</span>
                        </div>
                        <div className={styles.tipItem}>
                          <span className={styles.tipIcon}>📋</span>
                          <span><strong>Summarize</strong> before concluding</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Completion View */}
            {completed && completionData && (
              <div className={styles.completionView}>
                <div className={styles.completionCard}>
                  <div className={styles.completionHeader}>
                    <div className={styles.completionBadge}>🏆</div>
                    <h2>Station Complete!</h2>
                  </div>

                  <div className={styles.scoreSection}>
                    <div className={styles.scoreRing}>
                      <svg width="140" height="140">
                        <circle
                          className={styles.scoreRingBg}
                          cx="70"
                          cy="70"
                          r="60"
                        />
                        <circle
                          className={`${styles.scoreRingProgress} ${completionData.final_score >= 70 ? styles.excellent :
                            completionData.final_score >= 50 ? styles.good : styles.needsWork
                            }`}
                          cx="70"
                          cy="70"
                          r="60"
                          strokeDasharray={2 * Math.PI * 60}
                          strokeDashoffset={2 * Math.PI * 60 * (1 - completionData.final_score / 100)}
                        />
                      </svg>
                      <div className={styles.scoreValue}>
                        <span>{Math.round(completionData.final_score)}</span>
                        <small>%</small>
                      </div>
                    </div>
                    <p className={styles.scoreLabel}>
                      {completionData.final_score >= 70 ? 'Excellent Performance!' :
                        completionData.final_score >= 50 ? 'Satisfactory Performance' : 'Needs Improvement'}
                    </p>
                  </div>

                  <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                      <span className="value">{completionData.earned_points}/{completionData.total_points}</span>
                      <span className="label">Points Earned</span>
                    </div>
                    <div className={styles.statCard}>
                      <span className="value">{completionData.interaction_count}</span>
                      <span className="label">Interactions</span>
                    </div>
                    <div className={styles.statCard}>
                      <span className="value">{completionData.completed_items.length}</span>
                      <span className="label">Checklist Items</span>
                    </div>
                  </div>

                  {completionData.completed_items.length > 0 && (
                    <div className={`${styles.feedbackSection} ${styles.completed}`}>
                      <h3>✅ Completed Items</h3>
                      <ul>
                        {completionData.completed_items.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {completionData.missed_items.length > 0 && (
                    <div className={`${styles.feedbackSection} ${styles.missed}`}>
                      <h3>❌ Missed Items</h3>
                      <ul>
                        {completionData.missed_items.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {completionData.expected_actions.length > 0 && (
                    <div className={`${styles.feedbackSection} ${styles.expected}`}>
                      <h3>📋 Expected Actions</h3>
                      <ol>
                        {completionData.expected_actions.map((action, i) => (
                          <li key={i}>{action}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <div className={styles.completionActions}>
                    <button className={styles.primaryBtn} onClick={resetScenario}>
                      Try Another Station
                    </button>
                    <button className={styles.secondaryBtn} onClick={() => router.push('/dashboard')}>
                      Back to Dashboard
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </>
  )
}