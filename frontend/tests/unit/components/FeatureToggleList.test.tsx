import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import FeatureToggleList from '@/components/FeatureToggleList'

/**
 * Unit tests for FeatureToggleList component
 * Requirements: 16.1, 16.2 - Test FeatureToggleList displays features correctly and toggle triggers API call
 */
describe('FeatureToggleList Component', () => {
  const mockFeatures = {
    chat: true,
    flashcard: true,
    mcq: false,
    highyield: true,
    explain: false,
    map: true,
    image: false,
    pdf: true
  }

  const mockOnToggle = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    /**
     * Test that FeatureToggleList displays features correctly
     * Requirements: 16.1 - Display all features with their current enabled/disabled status
     */
    it('renders all features with correct display names', () => {
      render(
        <FeatureToggleList
          features={mockFeatures}
          loading={false}
          onToggle={mockOnToggle}
        />
      )

      // Check that all feature display names are rendered
      expect(screen.getByText('AI Chat')).toBeInTheDocument()
      expect(screen.getByText('Flashcards')).toBeInTheDocument()
      expect(screen.getByText('MCQ Generation')).toBeInTheDocument()
      expect(screen.getByText('High-Yield Summaries')).toBeInTheDocument()
      expect(screen.getByText('Explanations')).toBeInTheDocument()
      expect(screen.getByText('Concept Maps')).toBeInTheDocument()
      expect(screen.getByText('Image Analysis')).toBeInTheDocument()
      expect(screen.getByText('PDF Processing')).toBeInTheDocument()
    })

    it('renders feature descriptions', () => {
      render(
        <FeatureToggleList
          features={mockFeatures}
          loading={false}
          onToggle={mockOnToggle}
        />
      )

      // Check that descriptions are rendered
      expect(screen.getByText('Core AI chat functionality for medical tutoring')).toBeInTheDocument()
      expect(screen.getByText('Generate flashcards from medical topics')).toBeInTheDocument()
      expect(screen.getByText('Generate multiple choice questions for practice')).toBeInTheDocument()
    })

    it('displays enabled status badges correctly', () => {
      render(
        <FeatureToggleList
          features={mockFeatures}
          loading={false}
          onToggle={mockOnToggle}
        />
      )

      // Count enabled and disabled badges
      const enabledBadges = screen.getAllByText('ENABLED')
      const disabledBadges = screen.getAllByText('DISABLED')

      expect(enabledBadges).toHaveLength(5)  // chat, flashcard, highyield, map, pdf
      expect(disabledBadges).toHaveLength(3)  // mcq, explain, image
    })

    it('groups features by category', () => {
      render(
        <FeatureToggleList
          features={mockFeatures}
          loading={false}
          onToggle={mockOnToggle}
        />
      )

      // Check that category headers are rendered
      expect(screen.getByText('Core')).toBeInTheDocument()
      expect(screen.getByText('Study Tools')).toBeInTheDocument()
      expect(screen.getByText('Advanced')).toBeInTheDocument()
    })

    it('renders toggle switches for each feature', () => {
      render(
        <FeatureToggleList
          features={mockFeatures}
          loading={false}
          onToggle={mockOnToggle}
        />
      )

      // Check that toggle switches (checkboxes) are rendered
      const toggles = screen.getAllByRole('checkbox')
      expect(toggles).toHaveLength(8)  // One for each feature
    })

    it('sets toggle switches to correct checked state', () => {
      render(
        <FeatureToggleList
          features={mockFeatures}
          loading={false}
          onToggle={mockOnToggle}
        />
      )

      const toggles = screen.getAllByRole('checkbox')
      
      // Count checked and unchecked toggles
      const checkedToggles = toggles.filter(toggle => (toggle as HTMLInputElement).checked)
      const uncheckedToggles = toggles.filter(toggle => !(toggle as HTMLInputElement).checked)

      expect(checkedToggles).toHaveLength(5)  // enabled features
      expect(uncheckedToggles).toHaveLength(3)  // disabled features
    })
  })

  describe('Loading State', () => {
    it('displays loading message when loading is true', () => {
      render(
        <FeatureToggleList
          features={{}}
          loading={true}
          onToggle={mockOnToggle}
        />
      )

      expect(screen.getByText('Loading features...')).toBeInTheDocument()
    })

    it('does not display features when loading', () => {
      render(
        <FeatureToggleList
          features={mockFeatures}
          loading={true}
          onToggle={mockOnToggle}
        />
      )

      // Features should not be rendered during loading
      expect(screen.queryByText('AI Chat')).not.toBeInTheDocument()
      expect(screen.queryByText('Flashcards')).not.toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('displays no features message when features object is empty', () => {
      render(
        <FeatureToggleList
          features={{}}
          loading={false}
          onToggle={mockOnToggle}
        />
      )

      expect(screen.getByText('No features found')).toBeInTheDocument()
    })
  })

  describe('Toggle Functionality', () => {
    /**
     * Test that toggle triggers API call
     * Requirements: 16.2 - Toggle should call onToggle with feature name and new status
     */
    it('triggers onToggle when enabled feature is toggled off', async () => {
      mockOnToggle.mockResolvedValue(undefined)

      render(
        <FeatureToggleList
          features={mockFeatures}
          loading={false}
          onToggle={mockOnToggle}
        />
      )

      // Find the chat feature toggle (first checkbox, currently enabled)
      const toggles = screen.getAllByRole('checkbox')
      const chatToggle = toggles[0]  // chat is first in Core category

      // Toggle it off
      fireEvent.click(chatToggle)

      await waitFor(() => {
        expect(mockOnToggle).toHaveBeenCalledWith('chat', false)
      })
    })

    it('triggers onToggle when disabled feature is toggled on', async () => {
      mockOnToggle.mockResolvedValue(undefined)

      render(
        <FeatureToggleList
          features={mockFeatures}
          loading={false}
          onToggle={mockOnToggle}
        />
      )

      // Find a disabled feature toggle
      const toggles = screen.getAllByRole('checkbox')
      const disabledToggle = toggles.find(toggle => !(toggle as HTMLInputElement).checked)

      if (disabledToggle) {
        fireEvent.click(disabledToggle)

        await waitFor(() => {
          expect(mockOnToggle).toHaveBeenCalled()
          const [featureName, enabled] = mockOnToggle.mock.calls[0]
          expect(enabled).toBe(true)  // Should be toggling to enabled
        })
      }
    })

    it('disables toggle during toggle operation', async () => {
      // Mock onToggle to return a promise that doesn't resolve immediately
      let resolveToggle: () => void
      const togglePromise = new Promise<void>((resolve) => {
        resolveToggle = resolve
      })
      mockOnToggle.mockReturnValue(togglePromise)

      render(
        <FeatureToggleList
          features={mockFeatures}
          loading={false}
          onToggle={mockOnToggle}
        />
      )

      const toggles = screen.getAllByRole('checkbox')
      const chatToggle = toggles[0]

      // Click toggle
      fireEvent.click(chatToggle)

      // Toggle should be disabled during operation
      await waitFor(() => {
        expect(chatToggle).toBeDisabled()
      })

      // Resolve the promise
      resolveToggle!()

      // Toggle should be enabled again
      await waitFor(() => {
        expect(chatToggle).not.toBeDisabled()
      })
    })

    it('calls onToggle with correct feature name for each feature', async () => {
      mockOnToggle.mockResolvedValue(undefined)

      render(
        <FeatureToggleList
          features={mockFeatures}
          loading={false}
          onToggle={mockOnToggle}
        />
      )

      // Test toggling different features
      const featureTests = [
        { name: 'chat', displayName: 'AI Chat' },
        { name: 'flashcard', displayName: 'Flashcards' },
        { name: 'mcq', displayName: 'MCQ Generation' }
      ]

      for (const feature of featureTests) {
        mockOnToggle.mockClear()

        // Find the feature by its display name
        const featureElement = screen.getByText(feature.displayName)
        const container = featureElement.closest('div')
        const toggle = container?.querySelector('input[type="checkbox"]')

        if (toggle) {
          fireEvent.click(toggle)

          await waitFor(() => {
            expect(mockOnToggle).toHaveBeenCalledWith(
              feature.name,
              expect.any(Boolean)
            )
          })
        }
      }
    })
  })

  describe('Visual Feedback', () => {
    it('applies correct styling to enabled features', () => {
      render(
        <FeatureToggleList
          features={mockFeatures}
          loading={false}
          onToggle={mockOnToggle}
        />
      )

      const enabledBadges = screen.getAllByText('ENABLED')
      
      // Check that enabled badges have correct styling (green background)
      enabledBadges.forEach(badge => {
        expect(badge).toHaveStyle({ backgroundColor: '#d4edda' })
      })
    })

    it('applies correct styling to disabled features', () => {
      render(
        <FeatureToggleList
          features={mockFeatures}
          loading={false}
          onToggle={mockOnToggle}
        />
      )

      const disabledBadges = screen.getAllByText('DISABLED')
      
      // Check that disabled badges have correct styling (red background)
      disabledBadges.forEach(badge => {
        expect(badge).toHaveStyle({ backgroundColor: '#f8d7da' })
      })
    })

    it('applies opacity during toggle operation', async () => {
      let resolveToggle: () => void
      const togglePromise = new Promise<void>((resolve) => {
        resolveToggle = resolve
      })
      mockOnToggle.mockReturnValue(togglePromise)

      render(
        <FeatureToggleList
          features={mockFeatures}
          loading={false}
          onToggle={mockOnToggle}
        />
      )

      const chatFeature = screen.getByText('AI Chat')
      const container = chatFeature.closest('div')
      const toggleLabel = container?.querySelector('label')

      if (toggleLabel) {
        const toggle = toggleLabel.querySelector('input')
        if (toggle) {
          fireEvent.click(toggle)

          // Label should have reduced opacity during toggle
          await waitFor(() => {
            expect(toggleLabel).toHaveStyle({ opacity: 0.6 })
          })

          resolveToggle!()

          // Opacity should be restored
          await waitFor(() => {
            expect(toggleLabel).toHaveStyle({ opacity: 1 })
          })
        }
      }
    })
  })

  describe('Edge Cases', () => {
    it('handles unknown features gracefully', () => {
      const featuresWithUnknown = {
        ...mockFeatures,
        unknown_feature: true
      }

      render(
        <FeatureToggleList
          features={featuresWithUnknown}
          loading={false}
          onToggle={mockOnToggle}
        />
      )

      // Unknown feature should be rendered with capitalized name
      expect(screen.getByText('Unknown_feature')).toBeInTheDocument()
      expect(screen.getByText('unknown_feature feature')).toBeInTheDocument()
    })

    it('handles single feature correctly', () => {
      const singleFeature = {
        chat: true
      }

      render(
        <FeatureToggleList
          features={singleFeature}
          loading={false}
          onToggle={mockOnToggle}
        />
      )

      expect(screen.getByText('AI Chat')).toBeInTheDocument()
      expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    })

    it('handles all features disabled', () => {
      const allDisabled = {
        chat: false,
        flashcard: false,
        mcq: false,
        highyield: false,
        explain: false,
        map: false,
        image: false,
        pdf: false
      }

      render(
        <FeatureToggleList
          features={allDisabled}
          loading={false}
          onToggle={mockOnToggle}
        />
      )

      const disabledBadges = screen.getAllByText('DISABLED')
      expect(disabledBadges).toHaveLength(8)

      const toggles = screen.getAllByRole('checkbox')
      toggles.forEach(toggle => {
        expect(toggle).not.toBeChecked()
      })
    })

    it('handles all features enabled', () => {
      const allEnabled = {
        chat: true,
        flashcard: true,
        mcq: true,
        highyield: true,
        explain: true,
        map: true,
        image: true,
        pdf: true
      }

      render(
        <FeatureToggleList
          features={allEnabled}
          loading={false}
          onToggle={mockOnToggle}
        />
      )

      const enabledBadges = screen.getAllByText('ENABLED')
      expect(enabledBadges).toHaveLength(8)

      const toggles = screen.getAllByRole('checkbox')
      toggles.forEach(toggle => {
        expect(toggle).toBeChecked()
      })
    })
  })

  describe('Accessibility', () => {
    it('provides accessible toggle controls', () => {
      render(
        <FeatureToggleList
          features={mockFeatures}
          loading={false}
          onToggle={mockOnToggle}
        />
      )

      // All toggles should be accessible via checkbox role
      const toggles = screen.getAllByRole('checkbox')
      expect(toggles).toHaveLength(8)

      // Toggles should be keyboard accessible
      toggles.forEach(toggle => {
        expect(toggle).toHaveAttribute('type', 'checkbox')
      })
    })

    it('disables toggles with not-allowed cursor during operation', async () => {
      let resolveToggle: () => void
      const togglePromise = new Promise<void>((resolve) => {
        resolveToggle = resolve
      })
      mockOnToggle.mockReturnValue(togglePromise)

      render(
        <FeatureToggleList
          features={mockFeatures}
          loading={false}
          onToggle={mockOnToggle}
        />
      )

      const chatFeature = screen.getByText('AI Chat')
      const container = chatFeature.closest('div')
      const toggleLabel = container?.querySelector('label')

      if (toggleLabel) {
        const toggle = toggleLabel.querySelector('input')
        if (toggle) {
          fireEvent.click(toggle)

          // Label should have not-allowed cursor during toggle
          await waitFor(() => {
            expect(toggleLabel).toHaveStyle({ cursor: 'not-allowed' })
          })

          resolveToggle!()

          // Cursor should be restored to pointer
          await waitFor(() => {
            expect(toggleLabel).toHaveStyle({ cursor: 'pointer' })
          })
        }
      }
    })
  })
})
