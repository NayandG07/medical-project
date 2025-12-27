import { useState } from 'react'

interface FeatureToggleListProps {
  features: { [feature: string]: boolean }
  loading: boolean
  onToggle: (feature: string, enabled: boolean) => Promise<void>
}

interface FeatureInfo {
  name: string
  displayName: string
  description: string
  category: string
}

const FEATURE_INFO: { [key: string]: FeatureInfo } = {
  chat: {
    name: 'chat',
    displayName: 'AI Chat',
    description: 'Core AI chat functionality for medical tutoring',
    category: 'Core'
  },
  flashcard: {
    name: 'flashcard',
    displayName: 'Flashcards',
    description: 'Generate flashcards from medical topics',
    category: 'Study Tools'
  },
  mcq: {
    name: 'mcq',
    displayName: 'MCQ Generation',
    description: 'Generate multiple choice questions for practice',
    category: 'Study Tools'
  },
  highyield: {
    name: 'highyield',
    displayName: 'High-Yield Summaries',
    description: 'Generate concise high-yield summary points',
    category: 'Study Tools'
  },
  explain: {
    name: 'explain',
    displayName: 'Explanations',
    description: 'Detailed explanations of medical concepts',
    category: 'Study Tools'
  },
  map: {
    name: 'map',
    displayName: 'Concept Maps',
    description: 'Visual concept maps for topics',
    category: 'Study Tools'
  },
  image: {
    name: 'image',
    displayName: 'Image Analysis',
    description: 'AI-powered medical image interpretation',
    category: 'Advanced'
  },
  pdf: {
    name: 'pdf',
    displayName: 'PDF Processing',
    description: 'Upload and process PDF documents',
    category: 'Advanced'
  }
}

/**
 * Feature Toggle List Component
 * Displays all features with toggle switches
 * Requirements: 16.1, 16.2
 */
export default function FeatureToggleList({ features, loading, onToggle }: FeatureToggleListProps) {
  const [togglingFeature, setTogglingFeature] = useState<string | null>(null)

  const handleToggle = async (feature: string, currentStatus: boolean) => {
    setTogglingFeature(feature)
    try {
      await onToggle(feature, !currentStatus)
    } finally {
      setTogglingFeature(null)
    }
  }

  // Group features by category
  const groupedFeatures: { [category: string]: FeatureInfo[] } = {}
  
  Object.keys(features).forEach(featureName => {
    const info = FEATURE_INFO[featureName] || {
      name: featureName,
      displayName: featureName.charAt(0).toUpperCase() + featureName.slice(1),
      description: `${featureName} feature`,
      category: 'Other'
    }
    
    if (!groupedFeatures[info.category]) {
      groupedFeatures[info.category] = []
    }
    groupedFeatures[info.category].push(info)
  })

  if (loading) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <p>Loading features...</p>
      </div>
    )
  }

  if (Object.keys(features).length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <p style={{ color: '#6c757d' }}>No features found</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => (
        <div key={category}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 'bold',
            marginBottom: '15px',
            color: '#343a40'
          }}>
            {category}
          </h2>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #dee2e6',
            overflow: 'hidden'
          }}>
            {categoryFeatures.map((featureInfo, index) => {
              const isEnabled = features[featureInfo.name]
              const isToggling = togglingFeature === featureInfo.name

              return (
                <div
                  key={featureInfo.name}
                  style={{
                    padding: '20px',
                    borderBottom: index < categoryFeatures.length - 1 ? '1px solid #dee2e6' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: isToggling ? '#f8f9fa' : 'white'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                        {featureInfo.displayName}
                      </h3>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        backgroundColor: isEnabled ? '#d4edda' : '#f8d7da',
                        color: isEnabled ? '#155724' : '#721c24'
                      }}>
                        {isEnabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                    <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
                      {featureInfo.description}
                    </p>
                  </div>
                  <div style={{ marginLeft: '20px' }}>
                    <label style={{
                      position: 'relative',
                      display: 'inline-block',
                      width: '60px',
                      height: '34px',
                      cursor: isToggling ? 'not-allowed' : 'pointer',
                      opacity: isToggling ? 0.6 : 1
                    }}>
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => handleToggle(featureInfo.name, isEnabled)}
                        disabled={isToggling}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute',
                        cursor: isToggling ? 'not-allowed' : 'pointer',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: isEnabled ? '#28a745' : '#ccc',
                        transition: '0.4s',
                        borderRadius: '34px'
                      }}>
                        <span style={{
                          position: 'absolute',
                          content: '""',
                          height: '26px',
                          width: '26px',
                          left: isEnabled ? '30px' : '4px',
                          bottom: '4px',
                          backgroundColor: 'white',
                          transition: '0.4s',
                          borderRadius: '50%'
                        }} />
                      </span>
                    </label>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
