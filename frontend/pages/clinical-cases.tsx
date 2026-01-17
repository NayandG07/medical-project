import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

// Types
interface CaseStage {
    stage: number
    title: string
    content: string
    question: string
}

interface VisibleCaseData {
    patient_demographics?: Record<string, any>
    chief_complaint?: string
    history_of_present_illness?: Record<string, any>
    past_medical_history?: Record<string, any>
    family_history?: Record<string, any>
    social_history?: Record<string, any>
    vital_signs?: Record<string, any>
    physical_examination?: Record<string, any>
    initial_investigations?: Record<string, any>
}

interface CaseData {
    case_id: string
    completed: boolean
    current_stage: number
    stage_data: CaseStage | null
    total_stages: number
    visible_case_data?: VisibleCaseData
    progress_percentage?: number
}

interface EvaluationResult {
    score: number
    feedback: string
    strengths: string[]
    improvements: string[]
    model_answer: string
    clinical_tips?: string[]
    advance_stage?: boolean
}

interface StepResult {
    evaluation: EvaluationResult
    step_number: number
    stage_advanced: boolean
}

// Specialties
const SPECIALTIES = [
    { id: 'general_medicine', name: 'General Medicine', icon: '🩺' },
    { id: 'cardiology', name: 'Cardiology', icon: '❤️' },
    { id: 'pulmonology', name: 'Pulmonology', icon: '🫁' },
    { id: 'gastroenterology', name: 'Gastroenterology', icon: '🔬' },
    { id: 'neurology', name: 'Neurology', icon: '🧠' },
    { id: 'nephrology', name: 'Nephrology', icon: '🫘' },
    { id: 'endocrinology', name: 'Endocrinology', icon: '⚡' },
    { id: 'infectious_disease', name: 'Infectious Disease', icon: '🦠' },
    { id: 'emergency_medicine', name: 'Emergency Medicine', icon: '🚑' },
    { id: 'pediatrics', name: 'Pediatrics', icon: '👶' },
    { id: 'surgery', name: 'Surgery', icon: '🔪' },
    { id: 'orthopedics', name: 'Orthopedics', icon: '🦴' },
]

const DIFFICULTIES = [
    { id: 'beginner', name: 'Beginner', desc: 'Classic presentations, single diagnosis', color: '#10B981' },
    { id: 'intermediate', name: 'Intermediate', desc: '3-4 differentials, some atypical features', color: '#F59E0B' },
    { id: 'advanced', name: 'Advanced', desc: 'Complex cases, comorbidities', color: '#EF4444' },
    { id: 'expert', name: 'Expert', desc: 'Rare conditions, diagnostic uncertainty', color: '#8B5CF6' },
]

const STEP_TYPES = [
    { id: 'history_question', name: 'Ask History', icon: '📋' },
    { id: 'examination_request', name: 'Physical Exam', icon: '👨‍⚕️' },
    { id: 'investigation_request', name: 'Investigations', icon: '🔬' },
    { id: 'problem_representation', name: 'Problem Summary', icon: '📝' },
    { id: 'differential_generation', name: 'Differentials', icon: '🎯' },
    { id: 'diagnostic_justification', name: 'Justify Diagnosis', icon: '✅' },
    { id: 'management_plan', name: 'Management', icon: '💊' },
]

export default function ClinicalCases() {
    const router = useRouter()
    const [user, setUser] = useState<AuthUser | null>(null)
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Case creation state
    const [showCaseSetup, setShowCaseSetup] = useState(true)
    const [selectedSpecialty, setSelectedSpecialty] = useState('general_medicine')
    const [selectedDifficulty, setSelectedDifficulty] = useState('intermediate')

    // Active case state
    const [activeCase, setActiveCase] = useState<CaseData | null>(null)
    const [userInput, setUserInput] = useState('')
    const [selectedStepType, setSelectedStepType] = useState('history_question')
    const [notes, setNotes] = useState('')
    const [showNotes, setShowNotes] = useState(false)

    // Evaluation state
    const [lastEvaluation, setLastEvaluation] = useState<EvaluationResult | null>(null)
    const [showEvaluation, setShowEvaluation] = useState(false)

    // Completion state
    const [caseCompleted, setCaseCompleted] = useState(false)
    const [completionData, setCompletionData] = useState<any>(null)

    // Timer
    const [elapsedTime, setElapsedTime] = useState(0)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    const conversationRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        checkAuth()
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [])

    useEffect(() => {
        if (conversationRef.current) {
            conversationRef.current.scrollTop = conversationRef.current.scrollHeight
        }
    }, [activeCase, lastEvaluation])

    const checkAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            router.push('/login')
            return
        }
        setUser(session.user as AuthUser)
        setLoading(false)
    }

    const startTimer = () => {
        setElapsedTime(0)
        timerRef.current = setInterval(() => {
            setElapsedTime(prev => prev + 1)
        }, 1000)
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const startCase = async () => {
        setGenerating(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/clinical/cases`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    specialty: selectedSpecialty,
                    difficulty: selectedDifficulty,
                    case_type: 'clinical_reasoning'
                })
            })

            if (!response.ok) throw new Error('Failed to create case')

            const caseData = await response.json()

            // Fetch the case stage data
            const stageResponse = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/clinical/cases/${caseData.id}`,
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            )

            if (!stageResponse.ok) throw new Error('Failed to get case stage')

            const stageData = await stageResponse.json()
            setActiveCase(stageData)
            setShowCaseSetup(false)
            startTimer()
        } catch (error) {
            console.error('Failed to start case:', error)
            alert('Failed to generate case. Please try again.')
        } finally {
            setGenerating(false)
        }
    }

    const submitStep = async () => {
        if (!userInput.trim() || !activeCase) return

        setSubmitting(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/clinical/cases/${activeCase.case_id}/steps`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        step_type: selectedStepType,
                        user_input: userInput,
                        notes: notes || null
                    })
                }
            )

            if (!response.ok) throw new Error('Failed to submit step')

            const result: StepResult = await response.json()
            setLastEvaluation(result.evaluation)
            setShowEvaluation(true)
            setUserInput('')

            // Refresh case data if stage advanced
            if (result.stage_advanced) {
                const stageResponse = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/api/clinical/cases/${activeCase.case_id}`,
                    {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }
                )
                if (stageResponse.ok) {
                    const stageData = await stageResponse.json()
                    setActiveCase(stageData)
                }
            }
        } catch (error) {
            console.error('Failed to submit step:', error)
        } finally {
            setSubmitting(false)
        }
    }

    const advanceStage = async () => {
        if (!activeCase) return

        try {
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/clinical/cases/${activeCase.case_id}/advance`,
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            )

            if (!response.ok) throw new Error('Failed to advance stage')

            const stageData = await response.json()
            setActiveCase(stageData)
            setShowEvaluation(false)
            setLastEvaluation(null)
        } catch (error) {
            console.error('Failed to advance stage:', error)
        }
    }

    const completeCase = async () => {
        if (!activeCase) return

        try {
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/clinical/cases/${activeCase.case_id}/complete`,
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            )

            if (!response.ok) throw new Error('Failed to complete case')

            const result = await response.json()
            setCompletionData(result)
            setCaseCompleted(true)
            if (timerRef.current) clearInterval(timerRef.current)
        } catch (error) {
            console.error('Failed to complete case:', error)
        }
    }

    const resetCase = () => {
        setActiveCase(null)
        setShowCaseSetup(true)
        setCaseCompleted(false)
        setCompletionData(null)
        setLastEvaluation(null)
        setShowEvaluation(false)
        setUserInput('')
        setNotes('')
        setElapsedTime(0)
        if (timerRef.current) clearInterval(timerRef.current)
    }

    const renderDataSection = (title: string, data: Record<string, any> | undefined, icon: string) => {
        if (!data || Object.keys(data).length === 0) return null

        return (
            <div className="data-section">
                <h4>{icon} {title}</h4>
                <div className="data-content">
                    {Object.entries(data).map(([key, value]) => (
                        <div key={key} className="data-item">
                            <span className="data-label">{key.replace(/_/g, ' ')}:</span>
                            <span className="data-value">
                                {Array.isArray(value) ? value.join(', ') : String(value)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (loading || !user) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading Clinical Reasoning Engine...</p>
            </div>
        )
    }

    return (
        <>
            <Head>
                <title>Clinical Cases - Vaidya AI</title>
                <meta name="description" content="Practice clinical reasoning with structured patient cases" />
            </Head>
            <DashboardLayout user={user}>
                <div className="clinical-container">
                    {/* Case Setup View */}
                    {showCaseSetup && !activeCase && (
                        <div className="setup-view">
                            <div className="setup-header">
                                <h1>🏥 Clinical Reasoning Engine</h1>
                                <p>Master diagnostic thinking with structured patient cases</p>
                            </div>

                            <div className="setup-grid">
                                {/* Specialty Selection */}
                                <div className="setup-section">
                                    <h3>Select Specialty</h3>
                                    <div className="specialty-grid">
                                        {SPECIALTIES.map(spec => (
                                            <button
                                                key={spec.id}
                                                className={`specialty-card ${selectedSpecialty === spec.id ? 'active' : ''}`}
                                                onClick={() => setSelectedSpecialty(spec.id)}
                                            >
                                                <span className="specialty-icon">{spec.icon}</span>
                                                <span className="specialty-name">{spec.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Difficulty Selection */}
                                <div className="setup-section">
                                    <h3>Select Difficulty</h3>
                                    <div className="difficulty-grid">
                                        {DIFFICULTIES.map(diff => (
                                            <button
                                                key={diff.id}
                                                className={`difficulty-card ${selectedDifficulty === diff.id ? 'active' : ''}`}
                                                onClick={() => setSelectedDifficulty(diff.id)}
                                                style={{ '--accent-color': diff.color } as React.CSSProperties}
                                            >
                                                <span className="difficulty-name">{diff.name}</span>
                                                <span className="difficulty-desc">{diff.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="start-section">
                                <button
                                    className="start-button"
                                    onClick={startCase}
                                    disabled={generating}
                                >
                                    {generating ? (
                                        <>
                                            <span className="spinner"></span>
                                            Generating Case...
                                        </>
                                    ) : (
                                        <>
                                            <span>🚀</span>
                                            Start Clinical Case
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Instructions */}
                            <div className="instructions-card">
                                <h3>📚 How It Works</h3>
                                <div className="instruction-steps">
                                    <div className="instruction-step">
                                        <div className="step-number">1</div>
                                        <div className="step-content">
                                            <strong>Progressive Disclosure</strong>
                                            <p>Case information is revealed step-by-step as you proceed</p>
                                        </div>
                                    </div>
                                    <div className="instruction-step">
                                        <div className="step-number">2</div>
                                        <div className="step-content">
                                            <strong>Structured Reasoning</strong>
                                            <p>Follow the clinical reasoning pathway from history to management</p>
                                        </div>
                                    </div>
                                    <div className="instruction-step">
                                        <div className="step-number">3</div>
                                        <div className="step-content">
                                            <strong>AI Evaluation</strong>
                                            <p>Receive detailed feedback on your clinical thinking</p>
                                        </div>
                                    </div>
                                    <div className="instruction-step">
                                        <div className="step-number">4</div>
                                        <div className="step-content">
                                            <strong>Performance Tracking</strong>
                                            <p>Track your progress and identify areas for improvement</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Active Case View */}
                    {activeCase && !caseCompleted && (
                        <div className="case-view">
                            {/* Case Header */}
                            <div className="case-header">
                                <div className="header-left">
                                    <h2>📋 Clinical Case</h2>
                                    <div className="case-meta">
                                        <span className="meta-badge specialty">
                                            {SPECIALTIES.find(s => s.id === selectedSpecialty)?.icon} {selectedSpecialty.replace(/_/g, ' ')}
                                        </span>
                                        <span className="meta-badge difficulty" style={{
                                            backgroundColor: DIFFICULTIES.find(d => d.id === selectedDifficulty)?.color
                                        }}>
                                            {selectedDifficulty}
                                        </span>
                                    </div>
                                </div>
                                <div className="header-right">
                                    <div className="timer">⏱️ {formatTime(elapsedTime)}</div>
                                    <div className="progress-indicator">
                                        Stage {(activeCase.current_stage || 0) + 1} / {activeCase.total_stages}
                                    </div>
                                    <button className="end-button" onClick={resetCase}>End Case</button>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="progress-bar-container">
                                <div
                                    className="progress-bar-fill"
                                    style={{ width: `${activeCase.progress_percentage || 0}%` }}
                                />
                            </div>

                            {/* Main Content */}
                            <div className="case-content">
                                {/* Left Panel - Patient Data */}
                                <div className="patient-panel">
                                    <h3>👤 Patient Information</h3>

                                    {activeCase.visible_case_data && (
                                        <div className="patient-data">
                                            {/* Chief Complaint - Always visible */}
                                            <div className="chief-complaint">
                                                <h4>🚨 Chief Complaint</h4>
                                                <p>{activeCase.visible_case_data.chief_complaint}</p>
                                            </div>

                                            {/* Demographics */}
                                            {renderDataSection('Demographics', activeCase.visible_case_data.patient_demographics, '📊')}

                                            {/* History */}
                                            {renderDataSection('History of Present Illness', activeCase.visible_case_data.history_of_present_illness, '📝')}
                                            {renderDataSection('Past Medical History', activeCase.visible_case_data.past_medical_history, '📁')}
                                            {renderDataSection('Family History', activeCase.visible_case_data.family_history, '👨‍👩‍👧‍👦')}
                                            {renderDataSection('Social History', activeCase.visible_case_data.social_history, '🏠')}

                                            {/* Examination */}
                                            {renderDataSection('Vital Signs', activeCase.visible_case_data.vital_signs, '💓')}
                                            {renderDataSection('Physical Examination', activeCase.visible_case_data.physical_examination, '🩺')}

                                            {/* Investigations */}
                                            {renderDataSection('Initial Investigations', activeCase.visible_case_data.initial_investigations, '🔬')}
                                        </div>
                                    )}
                                </div>

                                {/* Right Panel - Interaction */}
                                <div className="interaction-panel">
                                    {/* Current Stage */}
                                    {activeCase.stage_data && (
                                        <div className="stage-card">
                                            <div className="stage-header">
                                                <span className="stage-number">Stage {activeCase.stage_data.stage}</span>
                                                <h4>{activeCase.stage_data.title}</h4>
                                            </div>
                                            <p className="stage-content">{activeCase.stage_data.content}</p>
                                            <div className="stage-question">
                                                <strong>❓ {activeCase.stage_data.question}</strong>
                                            </div>
                                        </div>
                                    )}

                                    {/* Evaluation Display */}
                                    {showEvaluation && lastEvaluation && (
                                        <div className="evaluation-card">
                                            <div className="evaluation-header">
                                                <h4>📊 Evaluation</h4>
                                                <div className="score-badge" style={{
                                                    backgroundColor: lastEvaluation.score >= 80 ? '#10B981' :
                                                        lastEvaluation.score >= 60 ? '#F59E0B' : '#EF4444'
                                                }}>
                                                    {lastEvaluation.score}%
                                                </div>
                                            </div>

                                            <p className="feedback-text">{lastEvaluation.feedback}</p>

                                            {lastEvaluation.strengths?.length > 0 && (
                                                <div className="feedback-section">
                                                    <h5>✅ Strengths</h5>
                                                    <ul>
                                                        {lastEvaluation.strengths.map((s, i) => (
                                                            <li key={i}>{s}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {lastEvaluation.improvements?.length > 0 && (
                                                <div className="feedback-section">
                                                    <h5>📈 Areas for Improvement</h5>
                                                    <ul>
                                                        {lastEvaluation.improvements.map((s, i) => (
                                                            <li key={i}>{s}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {lastEvaluation.clinical_tips && lastEvaluation.clinical_tips.length > 0 && (
                                                <div className="feedback-section tips">
                                                    <h5>💡 Clinical Tips</h5>
                                                    <ul>
                                                        {lastEvaluation.clinical_tips.map((t, i) => (
                                                            <li key={i}>{t}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            <div className="evaluation-actions">
                                                <button
                                                    className="continue-button"
                                                    onClick={() => setShowEvaluation(false)}
                                                >
                                                    Continue Working
                                                </button>
                                                <button
                                                    className="advance-button"
                                                    onClick={advanceStage}
                                                >
                                                    Next Stage →
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Input Section */}
                                    {!showEvaluation && (
                                        <div className="input-section">
                                            {/* Step Type Selector */}
                                            <div className="step-type-selector">
                                                {STEP_TYPES.map(type => (
                                                    <button
                                                        key={type.id}
                                                        className={`step-type-btn ${selectedStepType === type.id ? 'active' : ''}`}
                                                        onClick={() => setSelectedStepType(type.id)}
                                                    >
                                                        <span>{type.icon}</span>
                                                        <span>{type.name}</span>
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Main Input */}
                                            <textarea
                                                className="reasoning-input"
                                                placeholder="Enter your clinical reasoning, questions, or decisions..."
                                                value={userInput}
                                                onChange={(e) => setUserInput(e.target.value)}
                                                rows={4}
                                            />

                                            {/* Notes Toggle */}
                                            <button
                                                className="notes-toggle"
                                                onClick={() => setShowNotes(!showNotes)}
                                            >
                                                📝 {showNotes ? 'Hide Notes' : 'Add Notes'}
                                            </button>

                                            {showNotes && (
                                                <textarea
                                                    className="notes-input"
                                                    placeholder="Personal notes (saved for your reference)..."
                                                    value={notes}
                                                    onChange={(e) => setNotes(e.target.value)}
                                                    rows={2}
                                                />
                                            )}

                                            {/* Submit Button */}
                                            <div className="submit-section">
                                                <button
                                                    className="submit-button"
                                                    onClick={submitStep}
                                                    disabled={submitting || !userInput.trim()}
                                                >
                                                    {submitting ? (
                                                        <>
                                                            <span className="spinner"></span>
                                                            Evaluating...
                                                        </>
                                                    ) : (
                                                        'Submit for Evaluation'
                                                    )}
                                                </button>

                                                {activeCase.current_stage === activeCase.total_stages - 1 && (
                                                    <button
                                                        className="complete-button"
                                                        onClick={completeCase}
                                                    >
                                                        Complete Case
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Completion View */}
                    {caseCompleted && completionData && (
                        <div className="completion-view">
                            <div className="completion-card">
                                <div className="completion-header">
                                    <div className="completion-icon">🎉</div>
                                    <h2>Case Completed!</h2>
                                </div>

                                <div className="final-score">
                                    <div className="score-circle" style={{
                                        borderColor: completionData.final_score >= 80 ? '#10B981' :
                                            completionData.final_score >= 60 ? '#F59E0B' : '#EF4444'
                                    }}>
                                        <span className="score-value">{completionData.final_score}</span>
                                        <span className="score-label">%</span>
                                    </div>
                                    <p>Final Score</p>
                                </div>

                                <div className="completion-stats">
                                    <div className="stat">
                                        <span className="stat-value">{completionData.steps_completed}</span>
                                        <span className="stat-label">Steps Completed</span>
                                    </div>
                                    <div className="stat">
                                        <span className="stat-value">{formatTime(elapsedTime)}</span>
                                        <span className="stat-label">Time Taken</span>
                                    </div>
                                </div>

                                <div className="diagnosis-reveal">
                                    <h3>🎯 Final Diagnosis</h3>
                                    <p className="diagnosis-text">{completionData.final_diagnosis}</p>
                                    <p className="explanation-text">{completionData.explanation}</p>
                                </div>

                                {completionData.clinical_pearls?.length > 0 && (
                                    <div className="pearls-section">
                                        <h3>💎 Clinical Pearls</h3>
                                        <ul>
                                            {completionData.clinical_pearls.map((pearl: string, i: number) => (
                                                <li key={i}>{pearl}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {completionData.red_flags?.length > 0 && (
                                    <div className="red-flags-section">
                                        <h3>🚨 Red Flags</h3>
                                        <ul>
                                            {completionData.red_flags.map((flag: string, i: number) => (
                                                <li key={i}>{flag}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="completion-actions">
                                    <button className="new-case-button" onClick={resetCase}>
                                        Start New Case
                                    </button>
                                    <button className="dashboard-button" onClick={() => router.push('/dashboard')}>
                                        Back to Dashboard
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <style jsx>{`
          .clinical-container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 0;
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

          .setup-grid {
            display: grid;
            gap: 32px;
            margin-bottom: 40px;
          }

          .setup-section h3 {
            font-size: 1.25rem;
            font-weight: 700;
            color: #374151;
            margin-bottom: 16px;
          }

          .specialty-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 12px;
          }

          .specialty-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            padding: 16px 12px;
            background: white;
            border: 2px solid #E5E7EB;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .specialty-card:hover {
            border-color: #667eea;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
          }

          .specialty-card.active {
            border-color: #667eea;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .specialty-icon {
            font-size: 1.5rem;
          }

          .specialty-name {
            font-size: 0.85rem;
            font-weight: 600;
            text-align: center;
          }

          .difficulty-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
          }

          .difficulty-card {
            padding: 16px;
            background: white;
            border: 2px solid #E5E7EB;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            text-align: left;
          }

          .difficulty-card:hover {
            border-color: var(--accent-color);
            transform: translateY(-2px);
          }

          .difficulty-card.active {
            border-color: var(--accent-color);
            background: var(--accent-color);
            color: white;
          }

          .difficulty-name {
            display: block;
            font-weight: 700;
            font-size: 1rem;
            margin-bottom: 4px;
          }

          .difficulty-desc {
            display: block;
            font-size: 0.85rem;
            opacity: 0.8;
          }

          .start-section {
            text-align: center;
            margin-bottom: 40px;
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
            transition: all 0.2s ease;
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

          .instructions-card {
            background: white;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
            border: 1px solid #E5E7EB;
          }

          .instructions-card h3 {
            font-size: 1.25rem;
            font-weight: 700;
            margin-bottom: 24px;
            color: #1F2937;
          }

          .instruction-steps {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
          }

          .instruction-step {
            display: flex;
            gap: 16px;
          }

          .step-number {
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            flex-shrink: 0;
          }

          .step-content strong {
            display: block;
            color: #1F2937;
            margin-bottom: 4px;
          }

          .step-content p {
            color: #6B7280;
            font-size: 0.9rem;
            margin: 0;
          }

          /* Case View */
          .case-view {
            animation: fadeIn 0.5s ease;
          }

          .case-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 24px;
            background: white;
            border-radius: 12px;
            margin-bottom: 16px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          }

          .header-left h2 {
            font-size: 1.5rem;
            font-weight: 700;
            color: #1F2937;
            margin: 0 0 8px 0;
          }

          .case-meta {
            display: flex;
            gap: 8px;
          }

          .meta-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: capitalize;
          }

          .meta-badge.specialty {
            background: #F3F4F6;
            color: #374151;
          }

          .meta-badge.difficulty {
            color: white;
          }

          .header-right {
            display: flex;
            align-items: center;
            gap: 16px;
          }

          .timer {
            font-size: 1.1rem;
            font-weight: 700;
            color: #667eea;
            font-family: monospace;
          }

          .progress-indicator {
            font-size: 0.9rem;
            color: #6B7280;
            font-weight: 600;
          }

          .end-button {
            padding: 8px 16px;
            background: #FEE2E2;
            color: #DC2626;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .end-button:hover {
            background: #DC2626;
            color: white;
          }

          .progress-bar-container {
            height: 6px;
            background: #E5E7EB;
            border-radius: 3px;
            margin-bottom: 16px;
            overflow: hidden;
          }

          .progress-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            border-radius: 3px;
            transition: width 0.3s ease;
          }

          .case-content {
            display: grid;
            grid-template-columns: 1fr 1.2fr;
            gap: 20px;
          }

          /* Patient Panel */
          .patient-panel {
            background: white;
            border-radius: 12px;
            padding: 20px;
            max-height: calc(100vh - 280px);
            overflow-y: auto;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          }

          .patient-panel h3 {
            font-size: 1.1rem;
            font-weight: 700;
            color: #1F2937;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 2px solid #E5E7EB;
          }

          .chief-complaint {
            background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 16px;
          }

          .chief-complaint h4 {
            font-size: 0.9rem;
            font-weight: 700;
            color: #92400E;
            margin: 0 0 8px 0;
          }

          .chief-complaint p {
            margin: 0;
            color: #78350F;
            font-weight: 500;
          }

          .data-section {
            margin-bottom: 16px;
            padding-bottom: 16px;
            border-bottom: 1px solid #F3F4F6;
          }

          .data-section h4 {
            font-size: 0.9rem;
            font-weight: 700;
            color: #374151;
            margin: 0 0 12px 0;
          }

          .data-item {
            display: flex;
            margin-bottom: 6px;
            font-size: 0.85rem;
          }

          .data-label {
            color: #6B7280;
            min-width: 120px;
            text-transform: capitalize;
          }

          .data-value {
            color: #1F2937;
            font-weight: 500;
          }

          /* Interaction Panel */
          .interaction-panel {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .stage-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
          }

          .stage-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
          }

          .stage-number {
            background: rgba(255, 255, 255, 0.2);
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
          }

          .stage-header h4 {
            margin: 0;
            font-size: 1.1rem;
          }

          .stage-content {
            margin: 0 0 16px 0;
            opacity: 0.95;
            line-height: 1.6;
          }

          .stage-question {
            background: rgba(255, 255, 255, 0.15);
            padding: 12px 16px;
            border-radius: 8px;
          }

          .stage-question strong {
            font-weight: 600;
          }

          /* Evaluation Card */
          .evaluation-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
            border: 2px solid #E5E7EB;
          }

          .evaluation-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
          }

          .evaluation-header h4 {
            margin: 0;
            font-size: 1.1rem;
            color: #1F2937;
          }

          .score-badge {
            padding: 8px 16px;
            border-radius: 20px;
            color: white;
            font-weight: 700;
            font-size: 1.1rem;
          }

          .feedback-text {
            color: #374151;
            line-height: 1.6;
            margin-bottom: 16px;
          }

          .feedback-section {
            margin-bottom: 12px;
          }

          .feedback-section h5 {
            font-size: 0.9rem;
            color: #374151;
            margin: 0 0 8px 0;
          }

          .feedback-section ul {
            margin: 0;
            padding-left: 20px;
          }

          .feedback-section li {
            color: #6B7280;
            font-size: 0.9rem;
            margin-bottom: 4px;
          }

          .feedback-section.tips {
            background: #FEF3C7;
            padding: 12px 16px;
            border-radius: 8px;
          }

          .feedback-section.tips h5 {
            color: #92400E;
          }

          .feedback-section.tips li {
            color: #78350F;
          }

          .evaluation-actions {
            display: flex;
            gap: 12px;
            margin-top: 16px;
          }

          .continue-button, .advance-button {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .continue-button {
            background: #F3F4F6;
            color: #374151;
          }

          .continue-button:hover {
            background: #E5E7EB;
          }

          .advance-button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .advance-button:hover {
            transform: translateY(-2px);
          }

          /* Input Section */
          .input-section {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          }

          .step-type-selector {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 16px;
          }

          .step-type-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            background: #F3F4F6;
            border: 2px solid transparent;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: 600;
            color: #6B7280;
            cursor: pointer;
            transition: all 0.2s;
          }

          .step-type-btn:hover {
            background: #E5E7EB;
            color: #374151;
          }

          .step-type-btn.active {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .reasoning-input, .notes-input {
            width: 100%;
            padding: 14px;
            border: 2px solid #E5E7EB;
            border-radius: 8px;
            font-size: 0.95rem;
            font-family: inherit;
            resize: vertical;
            transition: border-color 0.2s;
          }

          .reasoning-input:focus, .notes-input:focus {
            outline: none;
            border-color: #667eea;
          }

          .notes-toggle {
            background: none;
            border: none;
            color: #6B7280;
            font-size: 0.9rem;
            cursor: pointer;
            padding: 8px 0;
            transition: color 0.2s;
          }

          .notes-toggle:hover {
            color: #667eea;
          }

          .notes-input {
            margin-top: 8px;
            background: #F9FAFB;
          }

          .submit-section {
            display: flex;
            gap: 12px;
            margin-top: 16px;
          }

          .submit-button {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 14px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .submit-button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          }

          .submit-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .complete-button {
            padding: 14px 24px;
            background: #10B981;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .complete-button:hover {
            background: #059669;
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
            max-width: 600px;
            width: 100%;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          }

          .completion-header {
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

          .final-score {
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

          .completion-stats {
            display: flex;
            justify-content: center;
            gap: 48px;
            margin-bottom: 32px;
          }

          .stat {
            text-align: center;
          }

          .stat-value {
            display: block;
            font-size: 1.5rem;
            font-weight: 700;
            color: #1F2937;
          }

          .stat-label {
            font-size: 0.9rem;
            color: #6B7280;
          }

          .diagnosis-reveal {
            background: #F0FDF4;
            padding: 24px;
            border-radius: 12px;
            margin-bottom: 24px;
            text-align: left;
          }

          .diagnosis-reveal h3 {
            color: #166534;
            margin: 0 0 12px 0;
          }

          .diagnosis-text {
            font-size: 1.1rem;
            font-weight: 600;
            color: #166534;
            margin: 0 0 12px 0;
          }

          .explanation-text {
            color: #15803D;
            line-height: 1.6;
            margin: 0;
          }

          .pearls-section, .red-flags-section {
            text-align: left;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 16px;
          }

          .pearls-section {
            background: #FEF3C7;
          }

          .pearls-section h3 {
            color: #92400E;
            margin: 0 0 12px 0;
          }

          .pearls-section li {
            color: #78350F;
          }

          .red-flags-section {
            background: #FEE2E2;
          }

          .red-flags-section h3 {
            color: #991B1B;
            margin: 0 0 12px 0;
          }

          .red-flags-section li {
            color: #7F1D1D;
          }

          .completion-actions {
            display: flex;
            gap: 16px;
            margin-top: 32px;
          }

          .new-case-button, .dashboard-button {
            flex: 1;
            padding: 14px 24px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .new-case-button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .new-case-button:hover {
            transform: translateY(-2px);
          }

          .dashboard-button {
            background: #F3F4F6;
            color: #374151;
          }

          .dashboard-button:hover {
            background: #E5E7EB;
          }

          /* Responsive */
          @media (max-width: 900px) {
            .case-content {
              grid-template-columns: 1fr;
            }

            .patient-panel {
              max-height: 400px;
            }

            .case-header {
              flex-direction: column;
              gap: 16px;
              text-align: center;
            }

            .header-right {
              flex-wrap: wrap;
              justify-content: center;
            }
          }

          @media (max-width: 600px) {
            .setup-header h1 {
              font-size: 1.75rem;
            }

            .specialty-grid {
              grid-template-columns: repeat(3, 1fr);
            }

            .difficulty-grid {
              grid-template-columns: 1fr;
            }

            .step-type-selector {
              justify-content: center;
            }

            .completion-card {
              padding: 32px 20px;
            }
          }
        `}</style>
            </DashboardLayout>
        </>
    )
}
