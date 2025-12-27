/**
 * Maintenance Control Component
 * Allows admins to view and control system maintenance mode
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5
 */
import { useState, useEffect } from 'react';

interface MaintenanceStatus {
  in_maintenance: boolean;
  level: string | null;
  reason: string | null;
  feature: string | null;
  triggered_by: string | null;
  triggered_at: string | null;
}

export default function MaintenanceControl() {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggerLevel, setTriggerLevel] = useState<'soft' | 'hard'>('soft');
  const [triggerReason, setTriggerReason] = useState('');
  const [triggerFeature, setTriggerFeature] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch current maintenance status
  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('access_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/maintenance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch maintenance status');
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Trigger maintenance mode
  const handleTriggerMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!triggerReason.trim()) {
      setError('Please provide a reason for maintenance');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const token = localStorage.getItem('access_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/maintenance`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level: triggerLevel,
          reason: triggerReason,
          feature: triggerFeature || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail?.error?.message || 'Failed to trigger maintenance');
      }

      const data = await response.json();
      setStatus(data);
      setTriggerReason('');
      setTriggerFeature('');
      alert('Maintenance mode triggered successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  // Override maintenance mode
  const handleOverride = async () => {
    if (!confirm('Are you sure you want to override maintenance mode and restore normal operation?')) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const token = localStorage.getItem('access_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/maintenance/override`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail?.error?.message || 'Failed to override maintenance');
      }

      await fetchStatus();
      alert('Maintenance mode overridden successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading) {
    return <div className="text-center py-8">Loading maintenance status...</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Current Status */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Current Status</h2>
        
        {status?.in_maintenance ? (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <span className="inline-block w-3 h-3 bg-red-500 rounded-full"></span>
              <span className="font-semibold text-red-600">
                System is in {status.level?.toUpperCase()} maintenance mode
              </span>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded p-4 space-y-2">
              <div>
                <span className="font-medium">Reason:</span> {status.reason}
              </div>
              {status.feature && (
                <div>
                  <span className="font-medium">Feature:</span> {status.feature}
                </div>
              )}
              {status.triggered_at && (
                <div>
                  <span className="font-medium">Triggered at:</span>{' '}
                  {new Date(status.triggered_at).toLocaleString()}
                </div>
              )}
            </div>

            <div className="mt-4">
              <button
                onClick={handleOverride}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
              >
                {submitting ? 'Overriding...' : 'Override and Restore Normal Operation'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <span className="inline-block w-3 h-3 bg-green-500 rounded-full"></span>
            <span className="font-semibold text-green-600">System is operating normally</span>
          </div>
        )}
      </div>

      {/* Trigger Maintenance */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Trigger Maintenance Mode</h2>
        
        <form onSubmit={handleTriggerMaintenance} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maintenance Level
            </label>
            <select
              value={triggerLevel}
              onChange={(e) => setTriggerLevel(e.target.value as 'soft' | 'hard')}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="soft">Soft (Block heavy features, allow chat)</option>
              <option value="hard">Hard (Admin-only access)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={triggerReason}
              onChange={(e) => setTriggerReason(e.target.value)}
              placeholder="e.g., API quota exhausted, scheduled maintenance"
              className="w-full border border-gray-300 rounded px-3 py-2"
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Feature (Optional)
            </label>
            <input
              type="text"
              value={triggerFeature}
              onChange={(e) => setTriggerFeature(e.target.value)}
              placeholder="e.g., chat, flashcard, mcq"
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
          >
            {submitting ? 'Triggering...' : 'Trigger Maintenance Mode'}
          </button>
        </form>
      </div>

      {/* Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">Maintenance Mode Information</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>
            <strong>Soft Maintenance:</strong> Blocks heavy features (PDF processing, image analysis) 
            while allowing chat and admin access. Use when API quotas are low or providers are degraded.
          </li>
          <li>
            <strong>Hard Maintenance:</strong> Blocks all non-admin access. Use when all API keys have 
            failed or during critical system maintenance.
          </li>
          <li>
            <strong>Override:</strong> Manually restore normal operation even if automatic triggers 
            are still active. Use with caution.
          </li>
        </ul>
      </div>
    </div>
  );
}
