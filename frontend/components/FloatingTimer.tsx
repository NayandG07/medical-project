import { useState, useEffect, useRef } from 'react'
import { Play, Pause, Check, X, Maximize2, Minimize2 } from 'lucide-react'
import { useRouter } from 'next/router'

interface FloatingTimerProps {
    entry: {
        id: string
        subject: string
        topic?: string
        study_type: string
        color_code: string
    }
    initialSeconds: number
    isRunning: boolean
    onToggleRunning: () => void
    onComplete: () => void
    onDiscard: () => void
}

const STUDY_TYPE_ICONS: Record<string, string> = {
    mcqs: '✓',
    flashcards: '🎴',
    clinical_cases: '🏥',
    revision: '📖',
    osce: '👨‍⚕️',
    reading: '📚',
    conceptmap: '🗺️',
}

export default function FloatingTimer({
    entry,
    initialSeconds,
    isRunning,
    onToggleRunning,
    onComplete,
    onDiscard
}: FloatingTimerProps) {
    const router = useRouter()
    const [seconds, setSeconds] = useState(initialSeconds)
    const [isMinimized, setIsMinimized] = useState(false)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    // Hide on OSCE and Clinical Cases pages
    const hiddenPaths = ['/osce', '/clinical-cases', '/osce-simulator', '/clinical-reasoning']
    const isHidden = hiddenPaths.includes(router.pathname)

    useEffect(() => {
        setSeconds(initialSeconds)
    }, [initialSeconds])

    useEffect(() => {
        if (isRunning) {
            timerRef.current = setInterval(() => {
                setSeconds(prev => {
                    if (prev <= 1) {
                        if (timerRef.current) clearInterval(timerRef.current)
                        onComplete()
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
        } else {
            if (timerRef.current) clearInterval(timerRef.current)
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [isRunning, onComplete])

    const formatTime = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const secs = totalSeconds % 60
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const progress = initialSeconds > 0 ? ((initialSeconds - seconds) / initialSeconds) * 100 : 0

    if (isHidden) return null

    return (
        <div className={`floating-timer ${isMinimized ? 'minimized' : ''}`}>
            <div className="floating-timer-header">
                <div className="timer-info">
                    <span className="timer-icon">{STUDY_TYPE_ICONS[entry.study_type] || '📚'}</span>
                    {!isMinimized && (
                        <div className="timer-text">
                            <div className="timer-subject">{entry.subject}</div>
                            {entry.topic && <div className="timer-topic-small">{entry.topic}</div>}
                        </div>
                    )}
                </div>
                <button 
                    className="timer-minimize-btn" 
                    onClick={() => setIsMinimized(!isMinimized)}
                    title={isMinimized ? 'Expand' : 'Minimize'}
                >
                    {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                </button>
            </div>

            {!isMinimized && (
                <>
                    <div className="floating-timer-display">{formatTime(seconds)}</div>
                    <div className="floating-timer-progress">
                        <div className="progress-bar" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="floating-timer-actions">
                        <button 
                            className="timer-action-btn play-pause" 
                            onClick={onToggleRunning}
                            title={isRunning ? 'Pause' : 'Play'}
                        >
                            {isRunning ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
                        </button>
                        {isRunning && (
                            <button 
                                className="timer-action-btn complete" 
                                onClick={onComplete}
                                title="Complete"
                            >
                                <Check size={16} />
                            </button>
                        )}
                        <button 
                            className="timer-action-btn discard" 
                            onClick={onDiscard}
                            title="Discard"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </>
            )}

            {isMinimized && (
                <div className="minimized-content">
                    <div className="minimized-time">{formatTime(seconds)}</div>
                    <div className="minimized-actions">
                        <button onClick={onToggleRunning} className="mini-btn">
                            {isRunning ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
