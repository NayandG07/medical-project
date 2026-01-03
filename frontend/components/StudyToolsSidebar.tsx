import { useRouter } from 'next/router'
import styles from '@/styles/StudyToolsSidebar.module.css'

interface StudyTool {
  id: string
  name: string
  icon: string
  path: string
  description: string
}

const studyTools: StudyTool[] = [
  {
    id: 'flashcards',
    name: 'Flashcards',
    icon: '🎴',
    path: '/study-tools/flashcards',
    description: 'Interactive spaced repetition'
  },
  {
    id: 'mcq',
    name: 'MCQ Practice',
    icon: '📝',
    path: '/study-tools/mcq',
    description: 'Multiple choice questions'
  },
  {
    id: 'conceptmap',
    name: 'Concept Maps',
    icon: '🗺️',
    path: '/study-tools/conceptmap',
    description: 'Visual diagrams'
  },
  {
    id: 'highyield',
    name: 'High-Yield',
    icon: '⭐',
    path: '/study-tools/highyield',
    description: 'Key summary points'
  },
  {
    id: 'explain',
    name: 'Explanations',
    icon: '📚',
    path: '/study-tools/explain',
    description: 'Detailed breakdowns'
  }
]

export default function StudyToolsSidebar() {
  const router = useRouter()
  const currentPath = router.pathname

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <h2>📚 Study Tools</h2>
        <p>Choose a tool to get started</p>
      </div>

      <nav className={styles.nav}>
        {studyTools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => router.push(tool.path)}
            className={`${styles.toolItem} ${currentPath === tool.path ? styles.active : ''}`}
          >
            <span className={styles.toolIcon}>{tool.icon}</span>
            <div className={styles.toolInfo}>
              <div className={styles.toolName}>{tool.name}</div>
              <div className={styles.toolDesc}>{tool.description}</div>
            </div>
          </button>
        ))}
      </nav>

      <div className={styles.footer}>
        <button
          onClick={() => router.push('/dashboard')}
          className={styles.backBtn}
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  )
}
