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
    if (!confirm('Are you sure you want to remove your personal API key? You will fall back to shared keys.')) {
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      style={{
        backgroundColor: 'white',
        borderRadius: '24px',
        padding: '32px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '12px',
          backgroundColor: '#eff6ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#3b82f6'
        }}>
          <Key size={20} />
        </div>
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1e293b' }}>Personal API Key</h3>
      </div>

      <p style={{
        fontSize: '0.95rem',
        color: '#64748b',
        lineHeight: '1.6',
        marginBottom: '24px',
        maxWidth: '600px'
      }}>
        Bring your own API key for dedicated throughput. Your key is <strong>encrypted</strong> and used with absolute priority over shared keys.
      </p>

      {/* Status Messages */}
      <AnimatePresence mode="wait">
        {success && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              padding: '12px 16px',
              backgroundColor: '#f0fdf4',
              color: '#16a34a',
              borderRadius: '12px',
              marginBottom: '20px',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: '1px solid #dcfce7'
            }}
          >
            <CheckCircle2 size={16} />
            {success}
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              padding: '12px 16px',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              borderRadius: '12px',
              marginBottom: '20px',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: '1px solid #fee2e2'
            }}
          >
            <AlertCircle size={16} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current Key Status */}
      {currentKey && (
        <div style={{
          padding: '16px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ color: '#10b981' }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Active Key
              </div>
              <div style={{ fontSize: '1rem', color: '#1e293b', fontWeight: 'bold', fontFamily: 'monospace' }}>
                {maskKey(currentKey)}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            style={{
              background: 'none',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '10px',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: '600'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Trash2 size={16} />
            {removing ? '...' : 'Remove'}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '24px' }}>
          <label
            htmlFor="user-api-key-input"
            style={{
              display: 'block',
              marginBottom: '10px',
              fontWeight: '600',
              fontSize: '0.9rem',
              color: '#475569'
            }}
          >
            {currentKey ? 'Update API Key' : 'Configure New API Key'}
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="user-api-key-input"
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={submitting || removing}
              placeholder="Paste your API key here..."
              style={{
                width: '100%',
                padding: '14px 16px',
                paddingRight: '100px',
                borderRadius: '14px',
                border: '1.5px solid #e2e8f0',
                fontSize: '0.95rem',
                fontFamily: 'monospace',
                transition: 'all 0.2s',
                outline: 'none',
                backgroundColor: (submitting || removing) ? '#f8fafc' : 'white'
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              disabled={submitting || removing}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '6px 10px',
                backgroundColor: '#f1f5f9',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <p style={{
            fontSize: '0.8rem',
            color: '#94a3b8',
            marginTop: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <ShieldCheck size={12} />
            Your credentials are encrypted and stored securely.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting || removing || !key}
          style={{
            width: '100%',
            padding: '14px',
            backgroundColor: '#6366f1',
            color: 'white',
            border: 'none',
            borderRadius: '14px',
            cursor: (submitting || removing || !key) ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: '700',
            transition: 'all 0.2s',
            boxShadow: (submitting || removing || !key) ? 'none' : '0 4px 12px rgba(99, 102, 241, 0.25)',
            opacity: (submitting || removing || !key) ? 0.6 : 1
          }}
          onMouseOver={(e) => {
            if (!submitting && !removing && key) e.currentTarget.style.backgroundColor = '#4f46e5'
          }}
          onMouseOut={(e) => {
            if (!submitting && !removing && key) e.currentTarget.style.backgroundColor = '#6366f1'
          }}
        >
          {submitting ? 'Saving...' : (currentKey ? 'Update API Key' : 'Save API Key')}
        </button>
      </form>

      {/* Usage Tooltip/Info */}
      <div style={{
        marginTop: '32px',
        padding: '20px',
        backgroundColor: '#fffbeb',
        borderRadius: '16px',
        border: '1px solid #fde68a',
        fontSize: '0.85rem',
        color: '#92400e'
      }}>
        <div style={{ fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={14} />
          Important Information
        </div>
        <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: '1.6' }}>
          <li>Your personal key will be used for all processing requests.</li>
          <li>In case of quota exhaustion, we'll gracefully fail back to shared keys.</li>
          <li>Credentials are strictly scoped to your private session.</li>
        </ul>
      </div>
    </motion.div>
  )
}
