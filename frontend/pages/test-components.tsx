import { useState } from 'react'
import Head from 'next/head'
import Layout from '@/components/Layout'
import FlashcardViewer from '@/components/FlashcardViewer'
import ClinicalMapViewer, { parseClinicalMapData } from '@/components/ClinicalMapViewer'

export default function TestComponents() {
  const [activeTest, setActiveTest] = useState<'flashcards' | 'map' | null>(null)

  // Sample flashcards
  const sampleFlashcards = [
    {
      front: "What are the four chambers of the heart?",
      back: "Right atrium, right ventricle, left atrium, and left ventricle"
    },
    {
      front: "What is the function of the mitral valve?",
      back: "The mitral valve prevents backflow of blood from the left ventricle to the left atrium during ventricular contraction"
    },
    {
      front: "What is systole?",
      back: "Systole is the phase of the cardiac cycle when the ventricles contract and pump blood out of the heart"
    },
    {
      front: "What is diastole?",
      back: "Diastole is the phase of the cardiac cycle when the ventricles relax and fill with blood"
    },
    {
      front: "What is the normal heart rate range?",
      back: "60-100 beats per minute for adults at rest"
    }
  ]

  // Sample clinical map data
  const sampleMapText = `MAIN: Diabetes Mellitus Type 2
SYMPTOM: Polyuria
SYMPTOM: Polydipsia
SYMPTOM: Polyphagia
SYMPTOM: Weight Loss
DIAGNOSIS: Fasting Blood Glucose
DIAGNOSIS: HbA1c Test
DIAGNOSIS: Oral Glucose Tolerance Test
TREATMENT: Metformin
TREATMENT: Lifestyle Modification
TREATMENT: Insulin Therapy
COMPLICATION: Diabetic Retinopathy
COMPLICATION: Diabetic Nephropathy
COMPLICATION: Diabetic Neuropathy
CONNECTION: Diabetes Mellitus Type 2 -> Polyuria
CONNECTION: Diabetes Mellitus Type 2 -> Polydipsia
CONNECTION: Diabetes Mellitus Type 2 -> Polyphagia
CONNECTION: Diabetes Mellitus Type 2 -> Weight Loss
CONNECTION: Diabetes Mellitus Type 2 -> Fasting Blood Glucose
CONNECTION: Diabetes Mellitus Type 2 -> HbA1c Test
CONNECTION: Fasting Blood Glucose -> Metformin
CONNECTION: Metformin -> Lifestyle Modification
CONNECTION: Diabetes Mellitus Type 2 -> Diabetic Retinopathy
CONNECTION: Diabetes Mellitus Type 2 -> Diabetic Nephropathy`

  const { nodes, connections } = parseClinicalMapData(sampleMapText)

  return (
    <Layout>
      <Head>
        <title>Test Components - VaidyaAI</title>
      </Head>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        <h1 style={{ marginBottom: '2rem' }}>Component Testing</h1>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button
            onClick={() => setActiveTest('flashcards')}
            style={{
              padding: '1rem 2rem',
              fontSize: '1rem',
              background: activeTest === 'flashcards' ? '#667eea' : '#f8f9fa',
              color: activeTest === 'flashcards' ? 'white' : '#333',
              border: '2px solid #667eea',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Test Flashcards
          </button>
          <button
            onClick={() => setActiveTest('map')}
            style={{
              padding: '1rem 2rem',
              fontSize: '1rem',
              background: activeTest === 'map' ? '#667eea' : '#f8f9fa',
              color: activeTest === 'map' ? 'white' : '#333',
              border: '2px solid #667eea',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Test Clinical Map
          </button>
          <button
            onClick={() => setActiveTest(null)}
            style={{
              padding: '1rem 2rem',
              fontSize: '1rem',
              background: '#f8f9fa',
              color: '#333',
              border: '2px solid #e2e8f0',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Clear
          </button>
        </div>

        {activeTest === 'flashcards' && (
          <div>
            <h2 style={{ marginBottom: '1rem' }}>Interactive Flashcards</h2>
            <FlashcardViewer
              cards={sampleFlashcards}
              onComplete={() => alert('All cards completed!')}
            />
          </div>
        )}

        {activeTest === 'map' && (
          <div>
            <h2 style={{ marginBottom: '1rem' }}>Clinical Concept Map</h2>
            <ClinicalMapViewer
              title="Diabetes Mellitus Type 2"
              nodes={nodes}
              connections={connections}
            />
          </div>
        )}

        {!activeTest && (
          <div style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            background: '#f8f9fa',
            borderRadius: '12px'
          }}>
            <h2 style={{ color: '#667eea', marginBottom: '1rem' }}>
              Select a component to test
            </h2>
            <p style={{ color: '#6c757d' }}>
              Click one of the buttons above to see the interactive components in action
            </p>
          </div>
        )}
      </div>
    </Layout>
  )
}
