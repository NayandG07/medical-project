import { useState } from 'react'

interface AddApiKeyFormProps {
  onClose: () => void
  onSubmit: (provider: string, feature: string, key: string, priority: number, status: string) => Promise<void>
}

/**
 * Add API Key Form Component
 * Modal form for adding new API keys with validation
 * Requirements: 14.2, 14.7
 */
export default function AddApiKeyForm({ onClose, onSubmit }: AddApiKeyFormProps) {
  const [provider, setProvider] = useState('gemini')
  const [feature, setFeature] = useState('chat')
  const [key, setKey] = useState('')
  const [priority, setPriority] = useState(0)
  const [status, setStatus] = useState('active')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Validate form inputs
   * Requirements: 14.2
   */
  const validateForm = (): string | null => {
    if (!provider || provider.trim() === '') {
      return 'Provider is required'
    }
    if (!feature || feature.trim() === '') {
      return 'Feature is required'
    }
    if (!key || key.trim() === '') {
      return 'API key is required'
    }
    if (key.length < 10) {
      return 'API key must be at least 10 characters'
    }
    if (priority < 0 || priority > 100) {
      return 'Priority must be between 0 and 100'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate form
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await onSubmit(provider, feature, key.trim(), priority, status)
      // Form will be closed by parent on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add API key')
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (submitting) return
    onClose()
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '30px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Add API Key</h2>
        
        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            borderRadius: '4px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Provider Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>
              Provider *
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={submitting}
              required
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #ced4da',
                fontSize: '14px'
              }}
            >
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="openrouter">OpenRouter</option>
              <option value="ollama">Ollama</option>
            </select>
          </div>

          {/* Feature Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>
              Feature *
            </label>
            <select
              value={feature}
              onChange={(e) => setFeature(e.target.value)}
              disabled={submitting}
              required
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #ced4da',
                fontSize: '14px'
              }}
            >
              <option value="chat">Chat</option>
              <option value="flashcard">Flashcard</option>
              <option value="mcq">MCQ</option>
              <option value="image">Image</option>
              <option value="embedding">Embedding</option>
              <option value="highyield">High Yield</option>
              <option value="explain">Explain</option>
              <option value="map">Map</option>
              <option value="clinical">Clinical</option>
              <option value="osce">OSCE</option>
            </select>
          </div>

          {/* API Key Input */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>
              API Key *
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={submitting}
              required
              placeholder="Enter API key"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #ced4da',
                fontSize: '14px',
                fontFamily: 'monospace'
              }}
            />
            <p style={{
              fontSize: '12px',
              color: '#6c757d',
              marginTop: '5px',
              marginBottom: 0
            }}>
              The key will be encrypted before storage and validated before saving
            </p>
          </div>

          {/* Priority Input */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>
              Priority (0-100) *
            </label>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
              disabled={submitting}
              required
              min="0"
              max="100"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #ced4da',
                fontSize: '14px'
              }}
            />
            <p style={{
              fontSize: '12px',
              color: '#6c757d',
              marginTop: '5px',
              marginBottom: 0
            }}>
              Higher priority keys are used first (0 = lowest, 100 = highest)
            </p>
          </div>

          {/* Status Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>
              Initial Status *
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={submitting}
              required
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #ced4da',
                fontSize: '14px'
              }}
            >
              <option value="active">Active</option>
              <option value="degraded">Degraded</option>
              <option value="disabled">Disabled</option>
            </select>
            <p style={{
              fontSize: '12px',
              color: '#6c757d',
              marginTop: '5px',
              marginBottom: 0
            }}>
              Set the initial status for this API key
            </p>
          </div>

          {/* Form Actions */}
          <div style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'flex-end',
            marginTop: '30px'
          }}>
            <button
              type="button"
              onClick={handleCancel}
              disabled={submitting}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                opacity: submitting ? 0.6 : 1
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                opacity: submitting ? 0.6 : 1
              }}
            >
              {submitting ? 'Adding...' : 'Add Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
