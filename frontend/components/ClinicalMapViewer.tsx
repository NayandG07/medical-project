import { useState, useEffect } from 'react'
import styles from '@/styles/ClinicalMapViewer.module.css'

interface MapNode {
  id: string
  label: string
  type: 'main' | 'symptom' | 'diagnosis' | 'treatment' | 'complication'
  x: number
  y: number
}

interface MapConnection {
  from: string
  to: string
  label?: string
}

interface ClinicalMapViewerProps {
  title: string
  nodes: MapNode[]
  connections: MapConnection[]
}

export default function ClinicalMapViewer({ title, nodes, connections }: ClinicalMapViewerProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'main': return '#667eea'
      case 'symptom': return '#f093fb'
      case 'diagnosis': return '#4facfe'
      case 'treatment': return '#43e97b'
      case 'complication': return '#fa709a'
      default: return '#6c757d'
    }
  }

  const getNodeSize = (type: string) => {
    return type === 'main' ? 80 : 60
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>{title}</h3>
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <div className={styles.legendColor} style={{ background: '#667eea' }} />
            <span>Main Topic</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendColor} style={{ background: '#f093fb' }} />
            <span>Symptoms</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendColor} style={{ background: '#4facfe' }} />
            <span>Diagnosis</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendColor} style={{ background: '#43e97b' }} />
            <span>Treatment</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendColor} style={{ background: '#fa709a' }} />
            <span>Complications</span>
          </div>
        </div>
      </div>

      <svg className={styles.svg} viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#999" />
          </marker>
          
          {/* Glow filter for selected nodes */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Draw connections */}
        <g className={styles.connections}>
          {connections.map((conn, idx) => {
            const fromNode = nodes.find(n => n.id === conn.from)
            const toNode = nodes.find(n => n.id === conn.to)
            
            if (!fromNode || !toNode) return null

            const isHighlighted = selectedNode === conn.from || selectedNode === conn.to

            return (
              <g key={idx}>
                <line
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={isHighlighted ? '#667eea' : '#ccc'}
                  strokeWidth={isHighlighted ? 3 : 2}
                  markerEnd="url(#arrowhead)"
                  opacity={isHighlighted ? 1 : 0.6}
                />
                {conn.label && (
                  <text
                    x={(fromNode.x + toNode.x) / 2}
                    y={(fromNode.y + toNode.y) / 2}
                    fill="#666"
                    fontSize="12"
                    textAnchor="middle"
                    className={styles.connectionLabel}
                  >
                    {conn.label}
                  </text>
                )}
              </g>
            )
          })}
        </g>

        {/* Draw nodes */}
        <g className={styles.nodes}>
          {nodes.map((node) => {
            const size = getNodeSize(node.type)
            const color = getNodeColor(node.type)
            const isSelected = selectedNode === node.id
            const isHovered = hoveredNode === node.id

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => setSelectedNode(isSelected ? null : node.id)}
                style={{ cursor: 'pointer' }}
                filter={isSelected ? 'url(#glow)' : undefined}
              >
                <circle
                  r={size / 2}
                  fill={color}
                  stroke={isSelected || isHovered ? '#fff' : color}
                  strokeWidth={isSelected || isHovered ? 4 : 2}
                  opacity={isSelected || isHovered ? 1 : 0.9}
                  className={styles.nodeCircle}
                />
                <text
                  textAnchor="middle"
                  dy="0.3em"
                  fill="white"
                  fontSize={node.type === 'main' ? '16' : '13'}
                  fontWeight="600"
                  className={styles.nodeText}
                >
                  {node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {selectedNode && (
        <div className={styles.nodeDetails}>
          <h4>{nodes.find(n => n.id === selectedNode)?.label}</h4>
          <p className={styles.nodeType}>
            Type: {nodes.find(n => n.id === selectedNode)?.type}
          </p>
          <button onClick={() => setSelectedNode(null)} className={styles.closeBtn}>
            Close
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Parse clinical map data from text format
 * Expected format:
 * MAIN: Topic Name
 * SYMPTOM: Symptom 1
 * SYMPTOM: Symptom 2
 * DIAGNOSIS: Diagnosis method
 * TREATMENT: Treatment option
 * COMPLICATION: Possible complication
 * CONNECTION: from -> to [label]
 */
export function parseClinicalMapData(text: string): { nodes: MapNode[], connections: MapConnection[] } {
  const lines = text.split('\n').filter(line => line.trim())
  const nodes: MapNode[] = []
  const connections: MapConnection[] = []
  
  let nodeCounter = 0
  const nodePositions: { [key: string]: { x: number, y: number } } = {}
  
  // First pass: create nodes
  lines.forEach(line => {
    const match = line.match(/^(MAIN|SYMPTOM|DIAGNOSIS|TREATMENT|COMPLICATION):\s*(.+)$/i)
    if (match) {
      const type = match[1].toLowerCase() as MapNode['type']
      const label = match[2].trim()
      const id = `node-${nodeCounter++}`
      
      // Calculate position based on type
      let x = 500, y = 400
      const typeIndex = nodes.filter(n => n.type === type).length
      
      switch (type) {
        case 'main':
          x = 500
          y = 400
          break
        case 'symptom':
          x = 200 + (typeIndex * 150)
          y = 200
          break
        case 'diagnosis':
          x = 200 + (typeIndex * 200)
          y = 500
          break
        case 'treatment':
          x = 700 + (typeIndex * 100)
          y = 300
          break
        case 'complication':
          x = 700 + (typeIndex * 100)
          y = 600
          break
      }
      
      nodes.push({ id, label, type, x, y })
      nodePositions[label.toLowerCase()] = { x, y }
    }
  })
  
  // Second pass: create connections
  lines.forEach(line => {
    const match = line.match(/^CONNECTION:\s*(.+?)\s*->\s*(.+?)(?:\s*\[(.+)\])?$/i)
    if (match) {
      const fromLabel = match[1].trim().toLowerCase()
      const toLabel = match[2].trim().toLowerCase()
      const label = match[3]?.trim()
      
      const fromNode = nodes.find(n => n.label.toLowerCase() === fromLabel)
      const toNode = nodes.find(n => n.label.toLowerCase() === toLabel)
      
      if (fromNode && toNode) {
        connections.push({
          from: fromNode.id,
          to: toNode.id,
          label
        })
      }
    }
  })
  
  return { nodes, connections }
}
