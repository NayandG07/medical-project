import { useRouter } from 'next/router'

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
    <div className="w-[280px] bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 max-[968px]:w-full max-[968px]:h-auto max-[968px]:relative max-[968px]:border-r-0 max-[968px]:border-b">
      <div className="p-8 pb-6 border-b border-slate-200">
        <h2 className="m-0 mb-2 text-2xl text-slate-700">📚 Study Tools</h2>
        <p className="m-0 text-sm text-slate-500">Choose a tool to get started</p>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto max-[968px]:grid max-[968px]:grid-cols-2 max-[968px]:gap-2 max-[968px]:p-4">
        {studyTools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => router.push(tool.path)}
            className={`w-full flex items-center gap-4 px-6 py-4 bg-transparent border-0 cursor-pointer transition-all text-left border-l-[3px] border-l-transparent hover:bg-slate-50 hover:border-l-slate-300 max-[968px]:flex-col max-[968px]:text-center max-[968px]:p-4 max-[968px]:border-l-0 max-[968px]:rounded-lg max-[968px]:border max-[968px]:border-slate-200 ${
              currentPath === tool.path
                ? 'bg-gradient-to-r from-[rgba(102,126,234,0.1)] to-transparent border-l-[#667eea] max-[968px]:bg-gradient-to-br max-[968px]:from-medical-indigo max-[968px]:to-medical-purple max-[968px]:text-white max-[968px]:border-medical-indigo'
                : ''
            }`}
          >
            <span className="text-3xl flex-shrink-0">{tool.icon}</span>
            <div className="flex-1">
              <div className={`font-semibold text-base text-slate-700 mb-1 ${currentPath === tool.path ? 'max-[968px]:text-white' : ''}`}>{tool.name}</div>
              <div className={`text-[0.85rem] text-slate-500 ${currentPath === tool.path ? 'max-[968px]:text-white' : ''}`}>{tool.description}</div>
            </div>
          </button>
        ))}
      </nav>

      <div className="p-6 border-t border-slate-200">
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-[0.95rem] font-semibold text-slate-600 cursor-pointer transition-all hover:bg-slate-100 hover:border-slate-300"
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  )
}
