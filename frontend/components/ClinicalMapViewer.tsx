import { useState, useMemo } from 'react'
import styles from '@/styles/ClinicalMapViewer.module.css'

export interface MapNode {
  id: string
  label: string
  type: 'main' | 'symptom' | 'diagnosis' | 'treatment' | 'complication' | 'category'
  description?: string
  x: number
  y: number
}

export interface MapConnection {
  from: string
  to: string
  label?: string
}

interface ClinicalMapViewerProps {
  title: string
  nodes: MapNode[]
  connections: MapConnection[]
}

// Medical icons as SVG paths
const getMedicalIcon = (topic: string): string => {
  const t = topic.toLowerCase()
  if (t.includes('pulmonary') || t.includes('lung') || t.includes('respiratory') || t.includes('embolism')) return 'lungs'
  if (t.includes('heart') || t.includes('cardiac') || t.includes('cardio')) return 'heart'
  if (t.includes('brain') || t.includes('neuro') || t.includes('stroke')) return 'brain'
  return 'medical'
}

const LungsIcon = () => (
  <g transform="scale(1.5)">
    <path d="M0 -8c-3 0-6 2-7 5v28c0 6 4 10 10 10s10-4 10-10V-3c0-3-5-5-13-5z" fill="#ff8a8a" stroke="#e05555" strokeWidth="2"/>
    <path d="M0 -8c3 0 6 2 7 5v28c0 6-4 10-10 10s-10-4-10-10V-3c0-3 5-5 13-5z" fill="#ff8a8a" stroke="#e05555" strokeWidth="2"/>
    <path d="M0 -12v10M-4 -8h8" stroke="#e05555" strokeWidth="3" strokeLinecap="round"/>
  </g>
)

const HeartIcon = () => (
  <g transform="scale(1.3)">
    <path d="M0 30c-2-2-22-16-22-32 0-8 7-15 15-15 5 0 10 3 12 7 2-4 7-7 12-7 8 0 15 7 15 15 0 16-20 30-22 32l-5 4-5-4z" fill="#ff6b6b" stroke="#e05555" strokeWidth="2" transform="translate(-5, -20)"/>
  </g>
)

const BrainIcon = () => (
  <g transform="scale(1.2)">
    <ellipse cx="0" cy="0" rx="25" ry="22" fill="#ffb3d9" stroke="#d63384" strokeWidth="2"/>
    <path d="M-12 -8c0-4 3-7 7-7s7 3 7 7M0 -12c0-4 3-7 7-7s7 3 7 7" stroke="#d63384" strokeWidth="2" fill="none"/>
  </g>
)

const MedicalIcon = () => (
  <g transform="scale(1.2)">
    <rect x="-20" y="-8" width="40" height="16" rx="3" fill="#667eea"/>
    <rect x="-8" y="-20" width="16" height="40" rx="3" fill="#667eea"/>
  </g>
)

const renderIcon = (iconType: string) => {
  switch (iconType) {
    case 'lungs': return <LungsIcon />
    case 'heart': return <HeartIcon />
    case 'brain': return <BrainIcon />
    default: return <MedicalIcon />
  }
}

export default function ClinicalMapViewer({ title, nodes, connections }: ClinicalMapViewerProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  const mainNode = nodes.find(n => n.type === 'main')
  const iconType = mainNode ? getMedicalIcon(mainNode.label) : 'medical'

  // Layout calculation
  const { displayNodes, displayConnections, viewBox } = useMemo(() => {
    if (!nodes || nodes.length === 0) return { displayNodes: [], displayConnections: [], viewBox: '0 0 800 600' }

    const mainNodeData = nodes.find(n => n.type === 'main')
    if (!mainNodeData) return { displayNodes: nodes, displayConnections: connections, viewBox: '0 0 800 600' }

    const centerX = 450
    const centerY = 350

    // Categories positioned around center
    // baseAngle: direction from center to category
    // detailAngleOffset: how much to rotate detail nodes perpendicular to the radial direction
    const categories = [
      { type: 'symptom', label: 'Symptoms', baseAngle: 230, perpSpread: true },      // bottom-left
      { type: 'diagnosis', label: 'Diagnosis', baseAngle: 310, perpSpread: true },   // bottom-right
      { type: 'treatment', label: 'Treatment', baseAngle: 130, perpSpread: true },   // top-left
      { type: 'complication', label: 'Risk Factors', baseAngle: 50, perpSpread: true } // top-right
    ]

    const newNodes: MapNode[] = []
    const newConnections: MapConnection[] = []

    // Main node at center
    newNodes.push({ ...mainNodeData, x: centerX, y: centerY })

    // Process categories
    categories.forEach(cat => {
      const catNodes = nodes.filter(n => n.type === cat.type)
      if (catNodes.length === 0) return

      // Category node distance from center
      const catRadius = 170
      const catAngleRad = (cat.baseAngle * Math.PI) / 180
      const catX = centerX + Math.cos(catAngleRad) * catRadius
      const catY = centerY - Math.sin(catAngleRad) * catRadius

      const categoryNodeId = `category-${cat.type}`
      newNodes.push({ id: categoryNodeId, label: cat.label, type: 'category', x: catX, y: catY })
      newConnections.push({ from: mainNodeData.id, to: categoryNodeId })

      // Detail nodes - fan out perpendicular to the radial direction
      const nodeCount = catNodes.length
      const detailRadius = 95
      
      // For perpendicular spread, we rotate around the category node
      // The center of the fan points away from main node (same as baseAngle)
      // Nodes spread perpendicular to this direction
      
      // Calculate perpendicular angle (90 degrees offset)
      const perpAngle = cat.baseAngle + 90
      
      // Spread nodes along the perpendicular arc
      const spacing = 55 // vertical/horizontal spacing between nodes
      
      catNodes.forEach((node, idx) => {
        // Calculate offset from center of the group
        const offset = idx - (nodeCount - 1) / 2
        
        // Position along perpendicular direction from category
        const perpRad = (perpAngle * Math.PI) / 180
        const outwardRad = (cat.baseAngle * Math.PI) / 180
        
        // Move outward from category, then offset perpendicular
        const detailX = catX + Math.cos(outwardRad) * detailRadius + Math.cos(perpRad) * offset * spacing
        const detailY = catY - Math.sin(outwardRad) * detailRadius - Math.sin(perpRad) * offset * spacing

        newNodes.push({ ...node, x: detailX, y: detailY })
        newConnections.push({ from: categoryNodeId, to: node.id })
      })
    })

    // Calculate bounds with padding
    const padding = 80
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    newNodes.forEach(n => {
      const nodeWidth = n.type === 'main' ? 70 : 90
      minX = Math.min(minX, n.x - nodeWidth)
      maxX = Math.max(maxX, n.x + nodeWidth)
      minY = Math.min(minY, n.y - 30)
      maxY = Math.max(maxY, n.y + 30)
    })

    const width = maxX - minX + padding * 2
    const height = maxY - minY + padding * 2
    const vb = `${minX - padding} ${minY - padding} ${width} ${height}`

    return { displayNodes: newNodes, displayConnections: newConnections, viewBox: vb }
  }, [nodes, connections])

  if (!nodes || nodes.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🗺️</div>
          <p>No nodes to display</p>
        </div>
      </div>
    )
  }

  const getNodeStyle = (type: string) => {
    switch (type) {
      case 'main': return { fill: '#fff', stroke: '#667eea', strokeWidth: 0, textColor: '#1e293b' }
      case 'category': return { fill: '#f8fafc', stroke: '#94a3b8', strokeWidth: 2, textColor: '#475569' }
      case 'symptom': return { fill: '#fef3c7', stroke: '#f59e0b', strokeWidth: 2.5, textColor: '#92400e' }
      case 'diagnosis': return { fill: '#dbeafe', stroke: '#3b82f6', strokeWidth: 2.5, textColor: '#1e40af' }
      case 'treatment': return { fill: '#d1fae5', stroke: '#10b981', strokeWidth: 2.5, textColor: '#065f46' }
      case 'complication': return { fill: '#fce7f3', stroke: '#ec4899', strokeWidth: 2.5, textColor: '#9d174d' }
      default: return { fill: '#f1f5f9', stroke: '#94a3b8', strokeWidth: 2, textColor: '#475569' }
    }
  }

  const getCurvedPath = (x1: number, y1: number, x2: number, y2: number) => {
    const midX = (x1 + x2) / 2
    const midY = (y1 + y2) / 2
    const dx = x2 - x1
    const dy = y2 - y1
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist === 0) return `M ${x1} ${y1} L ${x2} ${y2}`
    const curvature = dist * 0.12
    const nx = -dy / dist * curvature
    const ny = dx / dist * curvature
    return `M ${x1} ${y1} Q ${midX + nx} ${midY + ny} ${x2} ${y2}`
  }

  return (
    <div className={styles.container}>
      <svg className={styles.svg} viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.08"/>
          </filter>
          <linearGradient id="centerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffeef5"/>
            <stop offset="100%" stopColor="#ffe4ec"/>
          </linearGradient>
        </defs>

        {/* Connections */}
        <g>
          {displayConnections.map((conn, idx) => {
            const from = displayNodes.find(n => n.id === conn.from)
            const to = displayNodes.find(n => n.id === conn.to)
            if (!from || !to) return null
            const highlighted = selectedNode === conn.from || selectedNode === conn.to
            return (
              <path
                key={idx}
                d={getCurvedPath(from.x, from.y, to.x, to.y)}
                fill="none"
                stroke={highlighted ? '#667eea' : '#cbd5e1'}
                strokeWidth={from.type === 'main' ? 2.5 : 2}
                opacity={highlighted ? 1 : 0.7}
              />
            )
          })}
        </g>

        {/* Nodes */}
        <g>
          {displayNodes.map((node) => {
            const style = getNodeStyle(node.type)
            const isSelected = selectedNode === node.id
            const isHovered = hoveredNode === node.id
            const isMain = node.type === 'main'
            const isCategory = node.type === 'category'

            if (isMain) {
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => setSelectedNode(isSelected ? null : node.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {(isHovered || isSelected) && (
                    <circle r="62" fill="none" stroke="#667eea" strokeWidth="2" opacity="0.4"/>
                  )}
                  <circle r="55" fill="url(#centerGrad)" filter="url(#shadow)"/>
                  <g transform="translate(0, -10)">{renderIcon(iconType)}</g>
                  <text textAnchor="middle" y="38" fill="#1e293b" fontSize="16" fontWeight="700" fontFamily="system-ui, sans-serif">
                    {node.label.length > 18 ? node.label.substring(0, 18) + '...' : node.label}
                  </text>
                </g>
              )
            }

            if (isCategory) {
              const w = 100, h = 36
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => setSelectedNode(isSelected ? null : node.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect x={-w/2} y={-h/2} width={w} height={h} rx={h/2} fill={style.fill} stroke={isHovered || isSelected ? '#667eea' : style.stroke} strokeWidth={style.strokeWidth} filter="url(#shadow)"/>
                  <text textAnchor="middle" dy="0.35em" fill={style.textColor} fontSize="14" fontWeight="600" fontFamily="system-ui, sans-serif">{node.label}</text>
                </g>
              )
            }

            // Detail nodes
            const labelLen = node.label.length
            const w = Math.max(90, Math.min(150, labelLen * 9 + 24))
            const h = 34

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => setSelectedNode(isSelected ? null : node.id)}
                style={{ cursor: 'pointer' }}
              >
                {(isHovered || isSelected) && (
                  <rect x={-w/2-4} y={-h/2-4} width={w+8} height={h+8} rx={(h+8)/2} fill="none" stroke={style.stroke} strokeWidth="1.5" opacity="0.5"/>
                )}
                <rect x={-w/2} y={-h/2} width={w} height={h} rx={h/2} fill={style.fill} stroke={style.stroke} strokeWidth={style.strokeWidth} filter="url(#shadow)"/>
                <text textAnchor="middle" dy="0.35em" fill={style.textColor} fontSize="13" fontWeight="600" fontFamily="system-ui, sans-serif">
                  {node.label.length > 16 ? node.label.substring(0, 16) + '...' : node.label}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {selectedNode && (() => {
        const node = displayNodes.find(n => n.id === selectedNode)
        if (!node) return null
        const style = getNodeStyle(node.type)
        return (
          <div className={styles.nodeDetails} style={{ borderColor: style.stroke }}>
            <span className={styles.nodeTypeBadge} style={{ background: style.fill, color: style.textColor, borderColor: style.stroke }}>
              {node.type === 'category' ? node.label : node.type}
            </span>
            <h4>{node.label}</h4>
            {node.description && <p className={styles.nodeDescription}>{node.description}</p>}
            <button onClick={() => setSelectedNode(null)} className={styles.closeBtn}>Close</button>
          </div>
        )
      })()}
    </div>
  )
}

export function parseClinicalMapData(text: string): { nodes: MapNode[], connections: MapConnection[] } {
  let contentText = text
  if (text && text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text)
      contentText = parsed.content || text
    } catch (e) {}
  }
  
  const lines = contentText.split('\n').filter(line => line.trim())
  const nodes: MapNode[] = []
  const connections: MapConnection[] = []
  let nodeCounter = 0
  
  lines.forEach(line => {
    const match = line.match(/^(MAIN|SYMPTOM|DIAGNOSIS|TREATMENT|COMPLICATION):\s*(.+?)(?:\s*\|\s*(.+))?$/i)
    if (match) {
      const type = match[1].toLowerCase() as MapNode['type']
      const label = match[2].trim()
      const description = match[3]?.trim()
      nodes.push({ id: `node-${nodeCounter++}`, label, type, description, x: 0, y: 0 })
    }
  })
  
  lines.forEach(line => {
    const match = line.match(/^CONNECTION:\s*(.+?)\s*->\s*(.+?)(?:\s*\[(.+)\])?$/i)
    if (match) {
      const fromNode = nodes.find(n => n.label.toLowerCase() === match[1].trim().toLowerCase())
      const toNode = nodes.find(n => n.label.toLowerCase() === match[2].trim().toLowerCase())
      if (fromNode && toNode) {
        connections.push({ from: fromNode.id, to: toNode.id, label: match[3]?.trim() })
      }
    }
  })
  
  return { nodes, connections }
}
