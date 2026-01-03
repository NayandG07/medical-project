import { useState } from 'react'
import styles from '@/styles/FlashcardViewer.module.css'

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
    return <div className={styles.empty}>No flashcards available</div>
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
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.progress}>
          <div className={styles.progressBar} style={{ width: `${progress}%` }} />
        </div>
        <div className={styles.counter}>
          Card {currentIndex + 1} of {cards.length}
          {masteredCards.size > 0 && (
            <span className={styles.mastered}> • {masteredCards.size} mastered</span>
          )}
        </div>
      </div>

      <div className={styles.cardContainer}>
        <div 
          className={`${styles.card} ${isFlipped ? styles.flipped : ''}`}
          onClick={handleFlip}
        >
          <div className={styles.cardFront}>
            <div className={styles.cardLabel}>Question</div>
            <div className={styles.cardContent}>{currentCard.front}</div>
            <div className={styles.flipHint}>Click to flip</div>
          </div>
          <div className={styles.cardBack}>
            <div className={styles.cardLabel}>Answer</div>
            <div className={styles.cardContent}>{currentCard.back}</div>
            <div className={styles.flipHint}>Click to flip back</div>
          </div>
        </div>
      </div>

      <div className={styles.controls}>
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className={styles.navBtn}
        >
          ← Previous
        </button>

        {isFlipped && (
          <div className={styles.responseButtons}>
            <button
              onClick={handleNeedsPractice}
              className={`${styles.responseBtn} ${styles.needsPractice}`}
            >
              Need Practice
            </button>
            <button
              onClick={handleMastered}
              className={`${styles.responseBtn} ${styles.masteredBtn}`}
            >
              ✓ Mastered
            </button>
          </div>
        )}

        <button
          onClick={handleNext}
          disabled={currentIndex === cards.length - 1}
          className={styles.navBtn}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
