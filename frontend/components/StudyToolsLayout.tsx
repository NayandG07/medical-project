import { ReactNode } from 'react'
import Layout from './Layout'
import StudyToolsSidebar from './StudyToolsSidebar'
import styles from '@/styles/StudyToolsLayout.module.css'

interface StudyToolsLayoutProps {
  children: ReactNode
}

export default function StudyToolsLayout({ children }: StudyToolsLayoutProps) {
  return (
    <Layout>
      <div className={styles.container}>
        <StudyToolsSidebar />
        <main className={styles.main}>
          {children}
        </main>
      </div>
    </Layout>
  )
}
