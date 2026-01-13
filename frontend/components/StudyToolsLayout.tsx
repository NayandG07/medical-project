import { ReactNode } from 'react'
import Layout from './Layout'
import StudyToolsSidebar from './StudyToolsSidebar'

interface StudyToolsLayoutProps {
  children: ReactNode
}

export default function StudyToolsLayout({ children }: StudyToolsLayoutProps) {
  return (
    <Layout>
      <div className="flex min-h-[calc(100vh-70px)] bg-[#f8f9fa] max-[968px]:flex-col">
        <StudyToolsSidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </Layout>
  )
}
