import { useState, FormEvent, KeyboardEvent, useRef, useEffect } from 'react'

interface ChatInputProps {
    onSendMessage: (message: string) => void
    disabled?: boolean
    placeholder?: string
}

export default function ChatInput({
    onSendMessage,
    disabled = false,
    placeholder = 'Ask anything medical...'
}: ChatInputProps) {
    const [message, setMessage] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
        }
    }, [message])

    const handleSubmit = (e?: FormEvent) => {
        e?.preventDefault()

        const trimmedMessage = message.trim()
        if (!trimmedMessage || disabled) return

        onSendMessage(trimmedMessage)
        setMessage('')
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
        }
    }

    return (
        <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            padding: '8px 10px 8px 18px',
            display: 'flex',
            alignItems: 'flex-end',
            boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.04)',
            border: '1px solid #E2E8F0',
            gap: '12px',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            outline: 'none',
            cursor: 'text',
            position: 'relative'
        }}
            onFocusCapture={(e) => {
                const target = e.currentTarget;
                target.style.borderColor = '#6366f1';
                target.style.boxShadow = '0 12px 40px -12px rgba(99, 102, 241, 0.15), 0 0 0 1px rgba(99, 102, 241, 0.1)';
            }}
            onBlurCapture={(e) => {
                const target = e.currentTarget;
                target.style.borderColor = '#E2E8F0';
                target.style.boxShadow = '0 10px 40px -10px rgba(0, 0, 0, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.04)';
            }}
        >
            <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                rows={1}
                style={{
                    flex: 1,
                    padding: '12px 0',
                    fontSize: '14px',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    fontFamily: 'inherit',
                    lineHeight: '1.6',
                    minHeight: '24px',
                    backgroundColor: 'transparent',
                    cursor: disabled ? 'not-allowed' : 'text',
                    color: '#1e293b',
                    fontWeight: '450'
                }}
            />

            <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={disabled || !message.trim()}
                style={{
                    width: '42px',
                    height: '42px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: disabled || !message.trim() ? '#f1f5f9' : 'linear-gradient(135deg, #6366f1 0%, #3730a3 100%)',
                    color: disabled || !message.trim() ? '#94a3b8' : 'white',
                    border: 'none',
                    borderRadius: '16px',
                    cursor: disabled || !message.trim() ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: disabled || !message.trim() ? 'none' : '0 10px 15px -3px rgba(79, 70, 229, 0.3)',
                    flexShrink: 0,
                    marginBottom: '2px'
                }}
                onMouseEnter={(e) => {
                    if (!disabled && message.trim()) {
                        e.currentTarget.style.transform = 'translateY(-2px) scale(1.04)';
                        e.currentTarget.style.boxShadow = '0 12px 20px -3px rgba(79, 70, 229, 0.4)';
                    }
                }}
                onMouseLeave={(e) => {
                    if (!disabled && message.trim()) {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(79, 70, 229, 0.3)';
                    }
                }}
            >
                <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transform: 'translateX(1px)' }}
                >
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
            </button>
        </div>
    )
}