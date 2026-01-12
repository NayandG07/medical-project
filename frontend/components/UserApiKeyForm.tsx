import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Key, Eye, EyeOff, Trash2, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react'

interface UserApiKeyFormProps {
  currentKey: string | null
  onSubmit: (key: string) => Promise<void>
  onRemove: () => Promise<void>
}

/**
 * User API Key Form Component
 * Form for managing user's personal API key
 * Requirements: 27.1, 27.5
 */
export default function UserApiKeyForm({ currentKey, onSubmit, onRemove }: UserApiKeyFormProps) {
  const [key, setKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null)
        setError(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [success, error])

  const validateKey = (keyValue: string): string | null => {
    if (!keyValue || keyValue.trim() === '') {
      return 'API key is required'
    }
    if (keyValue.length < 10) {
      return 'API key must be at least 10 characters'
    }
    return null
  }

  const maskKey = (keyValue: string): string => {
    if (!keyValue || keyValue.length < 4) {
      return '•••• ••••'
    }
    return '•••• •••• ' + keyValue.slice(-4)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validateKey(key)
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      await onSubmit(key.trim())
      setSuccess('Personal API key saved successfully')
      setKey('')
      setShowKey(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove your personal API key?')) {
      return
    }

    setRemoving(true)
    setError(null)
    setSuccess(null)

    try {
      await onRemove()
      setSuccess('Personal API key removed successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove API key')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="premium-settings-card">
      <div className="section-header">
        <h2 className="section-title">Personal API Key</h2>
        <p className="section-description">
          Scale your throughput with a personal credentials. Your key is encrypted and stored with industry-standard AES-256.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="premium-status-toast success"
          >
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="premium-status-toast error"
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {currentKey && (
        <div className="active-key-vault">
          <div className="vault-content">
            <div className="vault-label">
              <Key size={12} />
              <span>ACTIVE CREDENTIAL</span>
            </div>
            <code className="vault-masked-key">{maskKey(currentKey)}</code>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className="vault-remove-btn"
          >
            <Trash2 size={14} />
            <span>{removing ? 'Removing...' : 'Remove'}</span>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="key-form">
        <div className="input-group">
          <label htmlFor="user-api-key-input" className="premium-input-label">
            {currentKey ? 'Rotate API Key' : 'Configure New API Key'}
          </label>
          <div className="input-field-wrapper">
            <input
              id="user-api-key-input"
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={submitting || removing}
              placeholder="Paste your API key here..."
              className="premium-key-input"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              disabled={submitting || removing}
              className="visibility-toggle-btn"
            >
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div className="priority-notice">
          <div className="notice-icon">
            <ShieldCheck size={16} />
          </div>
          <p>This key takes absolute priority for all your requests. We'll fallback to our shared capacity automatically if your key quota is reached.</p>
        </div>

        <div className="form-submit-container">
          <button
            type="submit"
            disabled={submitting || removing || !key}
            className={`premium-submit-btn ${(!key || submitting || removing) ? 'is-disabled' : ''}`}
          >
            {submitting ? (
              <span className="loading-spinner"></span>
            ) : (
              <span>{currentKey ? 'Update Credentials' : 'Save Connection'}</span>
            )}
          </button>
        </div>
      </form>

      <style jsx>{`
        .premium-settings-card {
          background: white;
          border: 1px solid rgba(229, 231, 235, 0.8);
          border-radius: 16px;
          padding: 32px;
          box-shadow: 
            0 1px 3px rgba(0,0,0,0.02),
            0 4px 6px -1px rgba(0,0,0,0.03),
            0 10px 15px -3px rgba(0,0,0,0.03);
        }

        .section-header {
          margin-bottom: 32px;
        }

        .section-title {
          font-size: 1.25rem;
          font-weight: 800;
          color: #111827;
          margin: 0 0 8px 0;
          letter-spacing: -0.02em;
        }

        .section-description {
          font-size: 0.9375rem;
          color: #6B7280;
          margin: 0;
          line-height: 1.6;
        }

        .premium-status-toast {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 24px;
        }

        .premium-status-toast.success {
          background-color: #F0FDF4;
          color: #166534;
          border: 1px solid #BBF7D0;
        }

        .premium-status-toast.error {
          background-color: #FEF2F2;
          color: #991B1B;
          border: 1px solid #FECACA;
        }

        /* Active Key Vault Display */
        .active-key-vault {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          background-color: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 14px;
          margin-bottom: 32px;
          transition: border-color 0.2s;
        }

        .active-key-vault:hover {
          border-color: #CBD5E1;
        }

        .vault-content {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .vault-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.7rem;
          font-weight: 800;
          color: #94A3B8;
          letter-spacing: 0.08em;
        }

        .vault-masked-key {
          font-size: 1rem;
          color: #334155;
          font-weight: 600;
          letter-spacing: 0.05em;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
        }

        .vault-remove-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: white;
          border: 1px solid #E5E7EB;
          border-radius: 10px;
          color: #64748B;
          font-size: 0.8125rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .vault-remove-btn:hover:not(:disabled) {
          color: #E11D48;
          border-color: #FECACA;
          background-color: #FFF1F2;
        }

        .input-group {
          margin-bottom: 24px;
        }

        .premium-input-label {
          display: block;
          font-size: 0.875rem;
          font-weight: 700;
          color: #374151;
          margin-bottom: 10px;
        }

        .input-field-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .premium-key-input {
          width: 100%;
          height: 48px;
          padding: 0 56px 0 16px;
          background: #FFFFFF;
          border: 1px solid #D1D5DB;
          border-radius: 12px;
          font-size: 0.9375rem;
          color: #111827;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          outline: none;
        }

        .premium-key-input:focus {
          border-color: #4F46E5;
          box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1);
        }

        .visibility-toggle-btn {
          position: absolute;
          right: 12px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #F3F4F6;
          border: none;
          border-radius: 8px;
          color: #4B5563;
          cursor: pointer;
          transition: background 0.2s;
        }

        .visibility-toggle-btn:hover {
          background: #E5E7EB;
          color: #111827;
        }

        /* Priority Notice Section */
        .priority-notice {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 32px;
          padding: 16px;
          background-color: #F0F9FF;
          border: 1px solid #E0F2FE;
          border-radius: 14px;
          color: #0369A1;
        }

        .notice-icon {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          background: white;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .priority-notice p {
          font-size: 0.875rem;
          line-height: 1.5;
          margin: 0;
          font-weight: 500;
        }

        .form-submit-container {
          display: flex;
          justify-content: flex-end;
        }

        .premium-submit-btn {
          height: 48px;
          min-width: 160px;
          padding: 0 24px;
          background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 0.9375rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .premium-submit-btn:hover:not(.is-disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(79, 70, 229, 0.3);
          background: linear-gradient(135deg, #4F46E5 0%, #4338CA 100%);
        }

        .premium-submit-btn.is-disabled {
          background: #E5E7EB;
          color: #9CA3AF;
          cursor: not-allowed;
          box-shadow: none;
        }

        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 640px) {
          .premium-settings-card {
            padding: 24px;
          }
          
          .active-key-vault {
            flex-direction: column;
            align-items: flex-start;
            gap: 20px;
          }
          
          .vault-remove-btn {
            width: 100%;
            justify-content: center;
          }
          
          .premium-submit-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
