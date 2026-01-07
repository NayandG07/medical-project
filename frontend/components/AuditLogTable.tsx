import { useState } from 'react'

export interface AuditLog {
  id: string
  admin_id: string
  action_type: string
  target_type: string
  target_id: string
  details: Record<string, any> | null
  timestamp: string
}

interface AuditLogTableProps {
  logs: AuditLog[]
  loading: boolean
}

/**
 * Audit Log Table Component
 * Displays audit logs in a table format with expandable details
 * Requirements: 19.6
 */
export default function AuditLogTable({ logs, loading }: AuditLogTableProps) {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  const toggleExpand = (logId: string) => {
    setExpandedLogId(expandedLogId === logId ? null : logId)
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  const getActionColor = (actionType: string) => {
    if (actionType.includes('delete') || actionType.includes('disable')) {
      return '#dc3545' // Red
    }
    if (actionType.includes('add') || actionType.includes('enable') || actionType.includes('create')) {
      return '#28a745' // Green
    }
    if (actionType.includes('update') || actionType.includes('reset')) {
      return '#ffc107' // Yellow
    }
    return '#007bff' // Blue
  }

  // Ensure logs is always an array
  const safeLogsArray = Array.isArray(logs) ? logs : []

  if (loading) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <p>Loading audit logs...</p>
      </div>
    )
  }

  if (safeLogsArray.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <p style={{ color: '#6c757d' }}>No audit logs found</p>
      </div>
    )
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      border: '1px solid #dee2e6',
      overflow: 'hidden'
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          minWidth: '800px'
        }}>
          <thead>
            <tr style={{
              backgroundColor: '#f8f9fa',
              borderBottom: '2px solid #dee2e6'
            }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold', width: '50px' }}></th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Timestamp</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Admin ID</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Action</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Target Type</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Target ID</th>
            </tr>
          </thead>
          <tbody>
            {safeLogsArray.map((log) => (
              <>
                <tr
                  key={log.id}
                  style={{
                    borderBottom: '1px solid #dee2e6',
                    cursor: 'pointer'
                  }}
                  onClick={() => toggleExpand(log.id)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8f9fa'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white'
                  }}
                >
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span style={{ fontSize: '18px' }}>
                      {expandedLogId === log.id ? '▼' : '▶'}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px' }}>
                    {formatTimestamp(log.timestamp)}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', fontFamily: 'monospace', color: '#6c757d' }}>
                    {log.admin_id.substring(0, 8)}...
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      backgroundColor: getActionColor(log.action_type),
                      color: log.action_type.includes('update') || log.action_type.includes('reset') ? '#000' : 'white'
                    }}>
                      {log.action_type.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor: '#e9ecef',
                      color: '#495057'
                    }}>
                      {log.target_type}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', fontFamily: 'monospace', color: '#6c757d' }}>
                    {log.target_id.substring(0, 12)}...
                  </td>
                </tr>
                
                {/* Expanded Details Row */}
                {expandedLogId === log.id && (
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <td colSpan={6} style={{ padding: '20px' }}>
                      <div style={{
                        backgroundColor: 'white',
                        padding: '15px',
                        borderRadius: '4px',
                        border: '1px solid #dee2e6'
                      }}>
                        <h4 style={{ marginTop: 0, marginBottom: '15px' }}>Log Details</h4>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '10px', marginBottom: '15px' }}>
                          <div style={{ fontWeight: 'bold' }}>Log ID:</div>
                          <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>{log.id}</div>
                          
                          <div style={{ fontWeight: 'bold' }}>Admin ID:</div>
                          <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>{log.admin_id}</div>
                          
                          <div style={{ fontWeight: 'bold' }}>Action Type:</div>
                          <div>{log.action_type}</div>
                          
                          <div style={{ fontWeight: 'bold' }}>Target Type:</div>
                          <div>{log.target_type}</div>
                          
                          <div style={{ fontWeight: 'bold' }}>Target ID:</div>
                          <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>{log.target_id}</div>
                          
                          <div style={{ fontWeight: 'bold' }}>Timestamp:</div>
                          <div>{formatTimestamp(log.timestamp)}</div>
                        </div>

                        {log.details && Object.keys(log.details).length > 0 && (
                          <div>
                            <h5 style={{ marginTop: '15px', marginBottom: '10px' }}>Additional Details:</h5>
                            <pre style={{
                              backgroundColor: '#f8f9fa',
                              padding: '10px',
                              borderRadius: '4px',
                              fontSize: '13px',
                              overflow: 'auto',
                              margin: 0
                            }}>
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div style={{
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderTop: '1px solid #dee2e6',
        textAlign: 'center',
        color: '#6c757d',
        fontSize: '14px'
      }}>
        Showing {safeLogsArray.length} log{safeLogsArray.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
