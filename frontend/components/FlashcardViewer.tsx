import { useState } from 'react'

interface Flashcard {
  front: string
  back: string
}

interface FlashcardViewerProps {
  cards: Flashcard[]
  onComplete?: () => void
}

export default function FlashcardViewer({ cards, onComplete }: FlashcardViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [masteredCards, setMasteredCards] = useState<Set<number>>(new Set())

  if (!cards || cards.length === 0) {
    return <div className="text-center p-[60px_20px] text-slate-500 text-base">No flashcards available</div>
  }

  const currentCard = cards[currentIndex]
  const progress = ((currentIndex + 1) / cards.length) * 100

  const handleFlip = () => {
    setIsFlipped(!isFlipped)
  }

  const handleNext = () => {
    setIsFlipped(false)
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else if (onComplete) {
      onComplete()
    }
  }

  const handlePrevious = () => {
    setIsFlipped(false)
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleMastered = () => {
    setMasteredCards(prev => new Set(prev).add(currentIndex))
    handleNext()
  }

  const handleNeedsPractice = () => {
    handleNext()
  }

  return (
    <div className="max-w-[800px] mx-auto p-5">
      <div className="mb-[30px]">
        <div className="w-full h-2 bg-[#e9ecef] rounded overflow-hidden mb-2.5">
          <div className="h-full bg-gradient-to-r from-medical-indigo to-medical-purple transition-[width_0.3s_ease]" style={{ width: `${progress}%` }} />
        </div>
        <div className="text-center text-sm text-slate-500 font-medium">
          Card {currentIndex + 1} of {cards.length}
          {masteredCards.size > 0 && (
            <span className="text-green-600"> • {masteredCards.size} mastered</span>
          )}
        </div>
      </div>

      <div className="[perspective:1000px] mb-[30px] min-h-[400px] flex items-center justify-center">
        <div 
          className={`relative w-full h-[400px] cursor-pointer [transform-style:preserve-3d] transition-transform duration-[0.6s] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
          onClick={handleFlip}
        >
          <div className="absolute w-full h-full [backface-visibility:hidden] flex flex-col items-center justify-center p-10 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.1)] bg-gradient-to-br from-medical-indigo to-medical-purple text-white">
            <div className="text-xs uppercase tracking-wider opacity-80 mb-5 font-semibold">Question</div>
            <div className="text-2xl leading-relaxed text-center flex-1 flex items-center justify-center font-medium">{currentCard.front}</div>
            <div className="text-xs opacity-70 mt-5">Click to flip</div>
          </div>
          <div className="absolute w-full h-full [backface-visibility:hidden] flex flex-col items-center justify-center p-10 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.1)] bg-gradient-to-br from-[#f093fb] to-[#f5576c] text-white [transform:rotateY(180deg)]">
            <div className="text-xs uppercase tracking-wider opacity-80 mb-5 font-semibold">Answer</div>
            <div className="text-2xl leading-relaxed text-center flex-1 flex items-center justify-center font-medium">{currentCard.back}</div>
            <div className="text-xs opacity-70 mt-5">Click to flip back</div>
          </div>
        </div>
      </div>

      <div className="flex gap-[15px] items-center justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="px-6 py-3 text-[15px] font-semibold bg-white text-medical-indigo border-2 border-medical-indigo rounded-lg cursor-pointer transition-all hover:bg-medical-indigo hover:text-white hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(102,126,234,0.3)] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Previous
        </button>

        {isFlipped && (
          <div className="flex gap-2.5">
            <button
              onClick={handleNeedsPractice}
              className="px-6 py-3 text-[15px] font-semibold border-0 rounded-lg cursor-pointer transition-all bg-[#ffc107] text-black hover:bg-[#ffb300] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(255,193,7,0.3)]"
            >
              Need Practice
            </button>
            <button
              onClick={handleMastered}
              className="px-6 py-3 text-[15px] font-semibold border-0 rounded-lg cursor-pointer transition-all bg-green-600 text-white hover:bg-green-700 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(40,167,69,0.3)]"
            >
              ✓ Mastered
            </button>
          </div>
        )}

        <button
          onClick={handleNext}
          disabled={currentIndex === cards.length - 1}
          className="px-6 py-3 text-[15px] font-semibold bg-white text-medical-indigo border-2 border-medical-indigo rounded-lg cursor-pointer transition-all hover:bg-medical-indigo hover:text-white hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(102,126,234,0.3)] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
