/**
 * Provider Health Table Component
 * Displays provider health status and allows manual health checks
 * Requirements: 15.1, 15.2, 15.3, 15.4
 */
import { useState, useEffect } from 'react';

interface ProviderHealth {
  provider: string;
  feature: string;
  status: string;
  active_keys: number;
  degraded_keys: number;
  disabled_keys: number;
  recent_failures: Array<{
    checked_at: string;
    status: string;
    error_message: string | null;
    response_time_ms: number | null;
  }>;
}

export default function ProviderHealthTable() {
  const [healthData, setHealthData] = useState<ProviderHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Fetch provider health data
  const fetchHealthData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('access_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/provider-health`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch provider health data');
      }

      const data = await response.json();
      setHealthData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Trigger manual health check
  const handleManualCheck = async () => {
    try {
      setChecking(true);
      setError(null);

      const token = localStorage.getItem('access_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/provider-health/check`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail?.error?.message || 'Failed to trigger health check');
      }

      const result = await response.json();
      alert(`Health checks completed for ${result.checked_count} keys`);
      
      // Refresh data
      await fetchHealthData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setChecking(false);
    }
  };

  // Toggle expanded row
  const toggleRow = (key: string) => {
    setExpandedRow(expandedRow === key ? null : key);
  };

  useEffect(() => {
    fetchHealthData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealthData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="text-center py-8">Loading provider health data...</div>;
  }

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
        <button
          onClick={handleManualCheck}
          disabled={checking}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
        >
          {checking ? 'Checking...' : 'Run Health Checks'}
        </button>
      </div>

      {/* Health Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Provider
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Feature
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Active Keys
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Degraded Keys
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Disabled Keys
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Recent Failures
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {healthData.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  No provider health data available
                </td>
              </tr>
            ) : (
              healthData.map((health) => {
                const rowKey = `${health.provider}:${health.feature}`;
                const isExpanded = expandedRow === rowKey;
                
                return (
                  <>
                    <tr key={rowKey} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleRow(rowKey)}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {health.provider}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {health.feature}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(health.status)}`}>
                          {health.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {health.active_keys}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {health.degraded_keys}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {health.disabled_keys}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {health.recent_failures.length}
                        {health.recent_failures.length > 0 && (
                          <span className="ml-2 text-xs text-blue-600">
                            {isExpanded ? '▼' : '▶'} Details
                          </span>
                        )}
                      </td>
                    </tr>
                    
                    {/* Expanded row for failure details */}
                    {isExpanded && health.recent_failures.length > 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm text-gray-700">Recent Failures:</h4>
                            <div className="space-y-2">
                              {health.recent_failures.map((failure, idx) => (
                                <div key={idx} className="bg-white border border-gray-200 rounded p-3 text-sm">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">
                                        {new Date(failure.checked_at).toLocaleString()}
                                      </div>
                                      {failure.error_message && (
                                        <div className="text-red-600 mt-1">
                                          {failure.error_message}
                                        </div>
                                      )}
                                    </div>
                                    <div className="ml-4">
                                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(failure.status)}`}>
                                        {failure.status}
                                      </span>
                                    </div>
                                  </div>
                                  {failure.response_time_ms && (
                                    <div className="text-gray-500 text-xs mt-1">
                                      Response time: {failure.response_time_ms}ms
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Status Legend</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span>
            <strong>Healthy:</strong> At least one active key available
          </div>
          <div>
            <span className="inline-block w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
            <strong>Degraded:</strong> Only degraded keys available
          </div>
          <div>
            <span className="inline-block w-3 h-3 bg-red-500 rounded-full mr-2"></span>
            <strong>Failed:</strong> No active or degraded keys available
          </div>
        </div>
      </div>
    </div>
  );
}
