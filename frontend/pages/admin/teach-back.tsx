/**
 * Teach-Back Admin Panel
 * 
 * Admin controls for managing the teach-back feature.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../components/AdminLayout';
import styles from '../../styles/Admin.module.css';

interface UsageStats {
  total_sessions: number;
  text_sessions: number;
  voice_sessions: number;
  active_users: number;
  avg_session_duration: number;
}

interface ErrorLog {
  id: string;
  error_code: string;
  session_id: string;
  user_id: string;
  message: string;
  timestamp: string;
}

interface FailoverStats {
  total_failovers: number;
  primary_failures: number;
  fallback_failures: number;
  success_rate: number;
}

export default function TeachBackAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  
  // Feature toggles
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  
  // Stats
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [failoverStats, setFailoverStats] = useState<FailoverStats | null>(null);
  
  // Filters
  const [errorCodeFilter, setErrorCodeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('today');

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const getToken = () => localStorage.getItem('token');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    
    // Get user info from localStorage or token
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
    
    fetchSettings();
    fetchStats();
    fetchErrorLogs();
    fetchFailoverStats();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/teach-back/settings`, {
        headers: { 'Authorization': `Bearer ${getToken()}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setFeatureEnabled(data.feature_enabled);
        setVoiceEnabled(data.voice_enabled);
        setMaintenanceMode(data.maintenance_mode);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/teach-back/stats?period=${dateFilter}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsageStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchErrorLogs = async () => {
    try {
      const url = errorCodeFilter
        ? `${API_BASE}/api/admin/teach-back/errors?code=${errorCodeFilter}&period=${dateFilter}`
        : `${API_BASE}/api/admin/teach-back/errors?period=${dateFilter}`;
        
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${getToken()}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setErrorLogs(data.errors);
      }
    } catch (err) {
      console.error('Failed to fetch error logs:', err);
    }
  };

  const fetchFailoverStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/teach-back/failover-stats?period=${dateFilter}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setFailoverStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch failover stats:', err);
    }
  };

  const handleToggleFeature = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/api/admin/teach-back/toggle-feature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ enabled: !featureEnabled }),
      });
      
      if (response.ok) {
        setFeatureEnabled(!featureEnabled);
      } else {
        setError('Failed to toggle feature');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVoice = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/api/admin/teach-back/toggle-voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ enabled: !voiceEnabled }),
      });
      
      if (response.ok) {
        setVoiceEnabled(!voiceEnabled);
      } else {
        setError('Failed to toggle voice');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleOverrideQuota = async (userId: string, textLimit: number, voiceLimit: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/api/admin/teach-back/override-quota`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ user_id: userId, text_limit: textLimit, voice_limit: voiceLimit }),
      });
      
      if (response.ok) {
        alert('Quota override successful');
      } else {
        setError('Failed to override quota');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout user={user}>
      <div className={styles.container}>
        <h1 className={styles.title}>Teach-Back Administration</h1>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        {/* Feature Controls */}
        <div className={styles.section}>
          <h2>Feature Controls</h2>
          
          <div className={styles.controlGrid}>
            <div className={styles.controlCard}>
              <h3>Feature Status</h3>
              <div className={styles.toggle}>
                <label>
                  <input
                    type="checkbox"
                    checked={featureEnabled}
                    onChange={handleToggleFeature}
                    disabled={loading}
                  />
                  <span>{featureEnabled ? 'Enabled' : 'Disabled'}</span>
                </label>
              </div>
              <p className={styles.helpText}>
                Enable or disable the entire teach-back feature
              </p>
            </div>

            <div className={styles.controlCard}>
              <h3>Voice Mode</h3>
              <div className={styles.toggle}>
                <label>
                  <input
                    type="checkbox"
                    checked={voiceEnabled}
                    onChange={handleToggleVoice}
                    disabled={loading || !featureEnabled}
                  />
                  <span>{voiceEnabled ? 'Enabled' : 'Disabled'}</span>
                </label>
              </div>
              <p className={styles.helpText}>
                Enable or disable voice input/output modes
              </p>
            </div>

            <div className={styles.controlCard}>
              <h3>Maintenance Mode</h3>
              <div className={styles.statusBadge}>
                <span className={maintenanceMode ? styles.statusError : styles.statusSuccess}>
                  {maintenanceMode ? 'Active' : 'Normal'}
                </span>
              </div>
              <p className={styles.helpText}>
                Automatically triggered when all LLMs fail
              </p>
            </div>
          </div>
        </div>

        {/* Usage Statistics */}
        <div className={styles.section}>
          <h2>Usage Statistics</h2>
          
          <div className={styles.filterBar}>
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                fetchStats();
              }}
              className={styles.select}
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {usageStats && (
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{usageStats.total_sessions}</div>
                <div className={styles.statLabel}>Total Sessions</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{usageStats.text_sessions}</div>
                <div className={styles.statLabel}>Text Sessions</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{usageStats.voice_sessions}</div>
                <div className={styles.statLabel}>Voice Sessions</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{usageStats.active_users}</div>
                <div className={styles.statLabel}>Active Users</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{usageStats.avg_session_duration}m</div>
                <div className={styles.statLabel}>Avg Duration</div>
              </div>
            </div>
          )}
        </div>

        {/* LLM Failover Statistics */}
        <div className={styles.section}>
          <h2>LLM Failover Statistics</h2>
          
          {failoverStats && (
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{failoverStats.total_failovers}</div>
                <div className={styles.statLabel}>Total Failovers</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{failoverStats.primary_failures}</div>
                <div className={styles.statLabel}>Primary Failures</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{failoverStats.fallback_failures}</div>
                <div className={styles.statLabel}>Fallback Failures</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{failoverStats.success_rate}%</div>
                <div className={styles.statLabel}>Success Rate</div>
              </div>
            </div>
          )}
        </div>

        {/* Error Logs */}
        <div className={styles.section}>
          <h2>Error Logs</h2>
          
          <div className={styles.filterBar}>
            <input
              type="text"
              placeholder="Filter by error code..."
              value={errorCodeFilter}
              onChange={(e) => setErrorCodeFilter(e.target.value)}
              className={styles.input}
            />
            <button
              onClick={fetchErrorLogs}
              className={styles.button}
            >
              Apply Filter
            </button>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Error Code</th>
                  <th>Session ID</th>
                  <th>User ID</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {errorLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                    <td><code>{log.error_code}</code></td>
                    <td><code>{log.session_id.substring(0, 8)}...</code></td>
                    <td><code>{log.user_id.substring(0, 8)}...</code></td>
                    <td>{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quota Override */}
        <div className={styles.section}>
          <h2>Quota Override</h2>
          <p className={styles.helpText}>
            Override rate limits for specific users (use with caution)
          </p>
          
          <div className={styles.form}>
            <input
              type="text"
              placeholder="User ID"
              id="userId"
              className={styles.input}
            />
            <input
              type="number"
              placeholder="Text Sessions Limit"
              id="textLimit"
              className={styles.input}
            />
            <input
              type="number"
              placeholder="Voice Sessions Limit"
              id="voiceLimit"
              className={styles.input}
            />
            <button
              onClick={() => {
                const userId = (document.getElementById('userId') as HTMLInputElement).value;
                const textLimit = parseInt((document.getElementById('textLimit') as HTMLInputElement).value);
                const voiceLimit = parseInt((document.getElementById('voiceLimit') as HTMLInputElement).value);
                handleOverrideQuota(userId, textLimit, voiceLimit);
              }}
              disabled={loading}
              className={styles.button}
            >
              Override Quota
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}


// Disable static generation for this admin page
export async function getServerSideProps() {
  return {
    props: {},
  };
}
