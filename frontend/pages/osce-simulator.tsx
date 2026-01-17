import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

// Types
interface PatientInfo {
    name?: string
    age?: number
    gender?: string
    presenting_complaint?: string
    appearance?: string
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
    const [conversation, setConversation] = useState<Array<{ role: 'student' | 'patient', content: string }>>([])

    // Timer state
    const [timeRemaining, setTimeRemaining] = useState(480)
    const [timerActive, setTimerActive] = useState(false)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

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
            setActiveScenario(scenario)
            setTimeRemaining(scenario.time_limit_seconds || 480)
            setShowSetup(false)
            setTimerActive(true)

            // Add initial patient greeting based on patient info
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
                // Show examiner feedback if critical
                setConversation(prev => [...prev, {
                    role: 'patient',
                    content: `[Examiner Note: ${result.feedback}]`
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
        if (timerRef.current) clearInterval(timerRef.current)
    }

    // Quick action buttons for common OSCE actions
    const quickActions = [
        { label: 'Introduce yourself', action: 'Hello, I am Dr. Smith, a medical student. Is it okay if I speak with you today?' },
        { label: 'Ask about pain', action: 'Can you tell me more about your pain? Where exactly is it located?' },
        { label: 'Ask duration', action: 'How long have you been experiencing these symptoms?' },
        { label: 'Summarize', action: 'Let me summarize what you have told me so far...' },
        { label: 'Examine', action: 'I would now like to examine you. Is that okay?' },
        { label: 'Thank patient', action: 'Thank you for sharing that information with me.' },
    ]

    if (loading || !user) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading OSCE Simulator...</p>
            </div>
        )
    }

    return (
        <>
            <Head>
                <title>OSCE Simulator - Vaidya AI</title>
                <meta name="description" content="Practice OSCE examinations with AI-simulated patients and examiners" />
            </Head>
            <DashboardLayout user={user}>
                <div className="osce-container">
                    {/* Setup View */}
                    {showSetup && !activeScenario && (
                        <div className="setup-view">
                            <div className="setup-header">
                                <h1>👨‍⚕️ OSCE Simulator</h1>
                                <p>Practice structured clinical examinations with AI patients</p>
                            </div>

                            {/* Scenario Type Selection */}
                            <div className="selection-section">
                                <h3>Select Station Type</h3>
                                <div className="type-grid">
                                    {SCENARIO_TYPES.map(type => (
                                        <button
                                            key={type.id}
                                            className={`type-card ${selectedType === type.id ? 'active' : ''}`}
                                            onClick={() => setSelectedType(type.id)}
                                        >
                                            <span className="type-icon">{type.icon}</span>
                                            <span className="type-name">{type.name}</span>
                                            <span className="type-desc">{type.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Specialty and Difficulty */}
                            <div className="options-row">
                                <div className="option-section">
                                    <h3>Specialty</h3>
                                    <div className="option-grid">
                                        {SPECIALTIES.map(spec => (
                                            <button
                                                key={spec.id}
                                                className={`option-btn ${selectedSpecialty === spec.id ? 'active' : ''}`}
                                                onClick={() => setSelectedSpecialty(spec.id)}
                                            >
                                                <span>{spec.icon}</span>
                                                <span>{spec.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="option-section">
                                    <h3>Difficulty</h3>
                                    <div className="option-grid">
                                        {DIFFICULTIES.map(diff => (
                                            <button
                                                key={diff.id}
                                                className={`option-btn ${selectedDifficulty === diff.id ? 'active' : ''}`}
                                                onClick={() => setSelectedDifficulty(diff.id)}
                                                style={{ '--accent': diff.color } as React.CSSProperties}
                                            >
                                                {diff.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="start-section">
                                <button
                                    className="start-button"
                                    onClick={startScenario}
                                    disabled={generating}
                                >
                                    {generating ? (
                                        <>
                                            <span className="spinner"></span>
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
                            <div className="tips-card">
                                <h3>💡 OSCE Tips</h3>
                                <ul>
                                    <li><strong>Introduction:</strong> Always introduce yourself and confirm patient identity</li>
                                    <li><strong>Consent:</strong> Obtain permission before any examination</li>
                                    <li><strong>Communication:</strong> Use clear, jargon-free language</li>
                                    <li><strong>Systematic:</strong> Follow a structured approach (e.g., SOCRATES for pain)</li>
                                    <li><strong>Time Management:</strong> Watch the clock and summarize findings</li>
                                    <li><strong>Professionalism:</strong> Maintain rapport and show empathy</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Active OSCE View */}
                    {activeScenario && !completed && (
                        <div className="active-view">
                            {/* Header */}
                            <div className="osce-header">
                                <div className="header-info">
                                    <h2>🏥 OSCE Station</h2>
                                    <div className="header-badges">
                                        <span className="badge type">
                                            {SCENARIO_TYPES.find(t => t.id === activeScenario.scenario_type)?.icon}
                                            {activeScenario.scenario_type.replace(/_/g, ' ')}
                                        </span>
                                        <span className="badge specialty">
                                            {activeScenario.specialty.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                </div>
                                <div className="header-actions">
                                    <div className={`timer ${timeRemaining < 60 ? 'warning' : ''} ${timeRemaining < 30 ? 'critical' : ''}`}>
                                        ⏱️ {formatTime(timeRemaining)}
                                    </div>
                                    <button className="complete-btn" onClick={completeScenario}>
                                        End Station
                                    </button>
                                </div>
                            </div>

                            {/* Main Content */}
                            <div className="osce-content">
                                {/* Left - Instructions & Patient Info */}
                                <div className="info-panel">
                                    <div className="instructions-box">
                                        <h3>📋 Candidate Instructions</h3>
                                        <p>{activeScenario.candidate_instructions}</p>
                                    </div>

                                    <div className="patient-box">
                                        <h3>👤 Patient</h3>
                                        <div className="patient-details">
                                            <p><strong>Name:</strong> {activeScenario.patient_info.name || 'Unknown'}</p>
                                            <p><strong>Age:</strong> {activeScenario.patient_info.age || 'N/A'}</p>
                                            <p><strong>Gender:</strong> {activeScenario.patient_info.gender || 'N/A'}</p>
                                            <p><strong>Complaint:</strong> {activeScenario.patient_info.presenting_complaint || 'N/A'}</p>
                                        </div>
                                    </div>

                                    {/* Quick Actions */}
                                    <div className="quick-actions">
                                        <h4>Quick Actions</h4>
                                        <div className="action-buttons">
                                            {quickActions.map((qa, i) => (
                                                <button
                                                    key={i}
                                                    className="quick-btn"
                                                    onClick={() => setUserInput(qa.action)}
                                                >
                                                    {qa.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Right - Conversation */}
                                <div className="conversation-panel">
                                    <div className="chat-container" ref={chatContainerRef}>
                                        {conversation.map((msg, i) => (
                                            <div key={i} className={`chat-message ${msg.role}`}>
                                                <div className="message-avatar">
                                                    {msg.role === 'student' ? '👨‍⚕️' : '🧑'}
                                                </div>
                                                <div className="message-content">
                                                    <span className="message-role">
                                                        {msg.role === 'student' ? 'You' : 'Patient'}
                                                    </span>
                                                    <p>{msg.content}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {sending && (
                                            <div className="chat-message patient">
                                                <div className="message-avatar">🧑</div>
                                                <div className="message-content">
                                                    <span className="message-role">Patient</span>
                                                    <p className="typing-indicator">...</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="input-area">
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
                                            rows={3}
                                        />
                                        <button
                                            className="send-btn"
                                            onClick={sendMessage}
                                            disabled={sending || !userInput.trim()}
                                        >
                                            {sending ? (
                                                <span className="spinner small"></span>
                                            ) : (
                                                'Send'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Completion View */}
                    {completed && completionData && (
                        <div className="completion-view">
                            <div className="completion-card">
                                <div className="completion-header">
                                    <div className="completion-icon">🏆</div>
                                    <h2>Station Complete!</h2>
                                </div>

                                <div className="score-display">
                                    <div className="score-circle" style={{
                                        borderColor: completionData.final_score >= 70 ? '#10B981' :
                                            completionData.final_score >= 50 ? '#F59E0B' : '#EF4444'
                                    }}>
                                        <span className="score-value">{Math.round(completionData.final_score)}</span>
                                        <span className="score-label">%</span>
                                    </div>
                                    <p className="score-desc">
                                        {completionData.final_score >= 70 ? 'Excellent Performance!' :
                                            completionData.final_score >= 50 ? 'Satisfactory Performance' : 'Needs Improvement'}
                                    </p>
                                </div>

                                <div className="stats-grid">
                                    <div className="stat-item">
                                        <span className="stat-value">{completionData.earned_points}/{completionData.total_points}</span>
                                        <span className="stat-label">Points Earned</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-value">{completionData.interaction_count}</span>
                                        <span className="stat-label">Interactions</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-value">{completionData.completed_items.length}</span>
                                        <span className="stat-label">Checklist Items</span>
                                    </div>
                                </div>

                                {completionData.completed_items.length > 0 && (
                                    <div className="feedback-section completed">
                                        <h3>✅ Completed Items</h3>
                                        <ul>
                                            {completionData.completed_items.map((item, i) => (
                                                <li key={i}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {completionData.missed_items.length > 0 && (
                                    <div className="feedback-section missed">
                                        <h3>❌ Missed Items</h3>
                                        <ul>
                                            {completionData.missed_items.map((item, i) => (
                                                <li key={i}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {completionData.expected_actions.length > 0 && (
                                    <div className="feedback-section expected">
                                        <h3>📋 Expected Actions</h3>
                                        <ol>
                                            {completionData.expected_actions.map((action, i) => (
                                                <li key={i}>{action}</li>
                                            ))}
                                        </ol>
                                    </div>
                                )}

                                <div className="completion-actions">
                                    <button className="primary-btn" onClick={resetScenario}>
                                        Try Another Station
                                    </button>
                                    <button className="secondary-btn" onClick={() => router.push('/dashboard')}>
                                        Back to Dashboard
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <style jsx>{`
          .osce-container {
            max-width: 1400px;
            margin: 0 auto;
          }

          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 60vh;
            gap: 16px;
          }

          .loading-spinner, .spinner {
            width: 24px;
            height: 24px;
            border: 3px solid rgba(102, 126, 234, 0.2);
            border-top-color: #667eea;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          .spinner.small {
            width: 16px;
            height: 16px;
            border-width: 2px;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          /* Setup View */
          .setup-view {
            animation: fadeIn 0.5s ease;
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .setup-header {
            text-align: center;
            margin-bottom: 40px;
          }

          .setup-header h1 {
            font-size: 2.5rem;
            font-weight: 800;
            color: #1F2937;
            margin-bottom: 8px;
          }

          .setup-header p {
            font-size: 1.1rem;
            color: #6B7280;
          }

          .selection-section {
            margin-bottom: 32px;
          }

          .selection-section h3 {
            font-size: 1.1rem;
            font-weight: 700;
            color: #374151;
            margin-bottom: 16px;
          }

          .type-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 12px;
          }

          .type-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px 16px;
            background: white;
            border: 2px solid #E5E7EB;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s;
            text-align: center;
          }

          .type-card:hover {
            border-color: #667eea;
            transform: translateY(-2px);
          }

          .type-card.active {
            border-color: #667eea;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .type-icon {
            font-size: 2rem;
            margin-bottom: 8px;
          }

          .type-name {
            font-weight: 700;
            font-size: 1rem;
            margin-bottom: 4px;
          }

          .type-desc {
            font-size: 0.8rem;
            opacity: 0.8;
          }

          .options-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 32px;
            margin-bottom: 32px;
          }

          .option-section h3 {
            font-size: 1rem;
            font-weight: 700;
            color: #374151;
            margin-bottom: 12px;
          }

          .option-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }

          .option-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 10px 16px;
            background: white;
            border: 2px solid #E5E7EB;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.2s;
          }

          .option-btn:hover {
            border-color: var(--accent, #667eea);
          }

          .option-btn.active {
            border-color: var(--accent, #667eea);
            background: var(--accent, #667eea);
            color: white;
          }

          .start-section {
            text-align: center;
            margin-bottom: 32px;
          }

          .start-button {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            padding: 16px 48px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 1.1rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
          }

          .start-button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
          }

          .start-button:disabled {
            opacity: 0.7;
            cursor: not-allowed;
          }

          .tips-card {
            background: white;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          }

          .tips-card h3 {
            font-size: 1.1rem;
            font-weight: 700;
            color: #1F2937;
            margin-bottom: 16px;
          }

          .tips-card ul {
            margin: 0;
            padding-left: 20px;
          }

          .tips-card li {
            color: #4B5563;
            margin-bottom: 8px;
            line-height: 1.5;
          }

          /* Active View */
          .active-view {
            animation: fadeIn 0.3s ease;
          }

          .osce-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 24px;
            background: white;
            border-radius: 12px;
            margin-bottom: 16px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          }

          .header-info h2 {
            font-size: 1.3rem;
            font-weight: 700;
            color: #1F2937;
            margin: 0 0 8px 0;
          }

          .header-badges {
            display: flex;
            gap: 8px;
          }

          .badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: capitalize;
          }

          .badge.type {
            background: #EEF2FF;
            color: #4F46E5;
          }

          .badge.specialty {
            background: #F3F4F6;
            color: #374151;
          }

          .header-actions {
            display: flex;
            align-items: center;
            gap: 16px;
          }

          .timer {
            font-size: 1.5rem;
            font-weight: 700;
            font-family: monospace;
            color: #10B981;
            background: #D1FAE5;
            padding: 8px 16px;
            border-radius: 8px;
          }

          .timer.warning {
            color: #F59E0B;
            background: #FEF3C7;
          }

          .timer.critical {
            color: #EF4444;
            background: #FEE2E2;
            animation: pulse 1s infinite;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }

          .complete-btn {
            padding: 10px 20px;
            background: #F3F4F6;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .complete-btn:hover {
            background: #E5E7EB;
          }

          .osce-content {
            display: grid;
            grid-template-columns: 350px 1fr;
            gap: 16px;
            height: calc(100vh - 280px);
            min-height: 500px;
          }

          .info-panel {
            display: flex;
            flex-direction: column;
            gap: 12px;
            overflow-y: auto;
          }

          .instructions-box, .patient-box {
            background: white;
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          }

          .instructions-box {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .instructions-box h3, .patient-box h3 {
            font-size: 1rem;
            font-weight: 700;
            margin: 0 0 12px 0;
          }

          .instructions-box p {
            margin: 0;
            line-height: 1.6;
            opacity: 0.95;
          }

          .patient-details p {
            margin: 0 0 6px 0;
            font-size: 0.9rem;
            color: #4B5563;
          }

          .patient-details strong {
            color: #1F2937;
          }

          .quick-actions {
            background: white;
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          }

          .quick-actions h4 {
            font-size: 0.9rem;
            font-weight: 700;
            color: #374151;
            margin: 0 0 12px 0;
          }

          .action-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }

          .quick-btn {
            padding: 6px 12px;
            background: #F3F4F6;
            border: none;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }

          .quick-btn:hover {
            background: #E5E7EB;
          }

          .conversation-panel {
            background: white;
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          }

          .chat-container {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .chat-message {
            display: flex;
            gap: 12px;
            max-width: 85%;
          }

          .chat-message.student {
            align-self: flex-end;
            flex-direction: row-reverse;
          }

          .message-avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: #F3F4F6;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
            flex-shrink: 0;
          }

          .chat-message.student .message-avatar {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }

          .message-content {
            background: #F3F4F6;
            padding: 12px 16px;
            border-radius: 12px;
          }

          .chat-message.student .message-content {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .message-role {
            display: block;
            font-size: 0.75rem;
            font-weight: 700;
            opacity: 0.7;
            margin-bottom: 4px;
          }

          .message-content p {
            margin: 0;
            line-height: 1.5;
          }

          .typing-indicator {
            animation: blink 1s infinite;
          }

          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }

          .input-area {
            display: flex;
            gap: 12px;
            padding: 16px;
            border-top: 1px solid #E5E7EB;
          }

          .input-area textarea {
            flex: 1;
            padding: 12px;
            border: 2px solid #E5E7EB;
            border-radius: 8px;
            font-size: 0.95rem;
            font-family: inherit;
            resize: none;
            transition: border-color 0.2s;
          }

          .input-area textarea:focus {
            outline: none;
            border-color: #667eea;
          }

          .send-btn {
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            min-width: 80px;
          }

          .send-btn:hover:not(:disabled) {
            transform: translateY(-2px);
          }

          .send-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          /* Completion View */
          .completion-view {
            display: flex;
            justify-content: center;
            padding: 40px 20px;
          }

          .completion-card {
            background: white;
            border-radius: 24px;
            padding: 48px;
            max-width: 700px;
            width: 100%;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          }

          .completion-header {
            text-align: center;
            margin-bottom: 32px;
          }

          .completion-icon {
            font-size: 4rem;
            margin-bottom: 16px;
          }

          .completion-header h2 {
            font-size: 2rem;
            font-weight: 800;
            color: #1F2937;
            margin: 0;
          }

          .score-display {
            text-align: center;
            margin-bottom: 32px;
          }

          .score-circle {
            width: 120px;
            height: 120px;
            border: 6px solid;
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin: 0 auto 12px;
          }

          .score-value {
            font-size: 2.5rem;
            font-weight: 800;
            color: #1F2937;
          }

          .score-label {
            font-size: 1.25rem;
            color: #6B7280;
          }

          .score-desc {
            color: #4B5563;
            font-weight: 600;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-bottom: 32px;
          }

          .stat-item {
            text-align: center;
            padding: 16px;
            background: #F9FAFB;
            border-radius: 12px;
          }

          .stat-item .stat-value {
            display: block;
            font-size: 1.5rem;
            font-weight: 700;
            color: #1F2937;
          }

          .stat-item .stat-label {
            font-size: 0.85rem;
            color: #6B7280;
          }

          .feedback-section {
            padding: 16px 20px;
            border-radius: 12px;
            margin-bottom: 16px;
          }

          .feedback-section.completed {
            background: #D1FAE5;
          }

          .feedback-section.completed h3 {
            color: #065F46;
          }

          .feedback-section.completed li {
            color: #047857;
          }

          .feedback-section.missed {
            background: #FEE2E2;
          }

          .feedback-section.missed h3 {
            color: #991B1B;
          }

          .feedback-section.missed li {
            color: #B91C1C;
          }

          .feedback-section.expected {
            background: #FEF3C7;
          }

          .feedback-section.expected h3 {
            color: #92400E;
          }

          .feedback-section.expected li {
            color: #B45309;
          }

          .feedback-section h3 {
            font-size: 1rem;
            margin: 0 0 12px 0;
          }

          .feedback-section ul, .feedback-section ol {
            margin: 0;
            padding-left: 20px;
          }

          .feedback-section li {
            margin-bottom: 6px;
            font-size: 0.9rem;
          }

          .completion-actions {
            display: flex;
            gap: 16px;
            margin-top: 32px;
          }

          .primary-btn, .secondary-btn {
            flex: 1;
            padding: 14px 24px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .primary-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .primary-btn:hover {
            transform: translateY(-2px);
          }

          .secondary-btn {
            background: #F3F4F6;
            color: #374151;
          }

          .secondary-btn:hover {
            background: #E5E7EB;
          }

          /* Responsive */
          @media (max-width: 900px) {
            .osce-content {
              grid-template-columns: 1fr;
              height: auto;
            }

            .info-panel {
              max-height: 300px;
            }

            .conversation-panel {
              height: 400px;
            }

            .options-row {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 600px) {
            .setup-header h1 {
              font-size: 1.75rem;
            }

            .type-grid {
              grid-template-columns: repeat(2, 1fr);
            }

            .osce-header {
              flex-direction: column;
              gap: 12px;
            }

            .stats-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
            </DashboardLayout>
        </>
    )
}
