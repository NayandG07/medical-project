/**
 * Property-Based Tests for Chat UI Components
 * Feature: medical-ai-platform
 */

import { render, screen } from '@testing-library/react'
import * as fc from 'fast-check'
import ChatWindow, { Message } from '@/components/ChatWindow'

// Generator for valid messages
const messageGenerator = fc.record({
  id: fc.uuid(),
  role: fc.constantFrom('user' as const, 'assistant' as const, 'system' as const),
  content: fc.string({ minLength: 1, maxLength: 500 }),
  created_at: fc.date({ min: new Date('2020-01-01'), max: new Date() }).map(d => d.toISOString()),
  tokens_used: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: undefined }),
  citations: fc.option(fc.jsonValue(), { nil: undefined })
})

describe('Chat UI Property Tests', () => {
  /**
   * Property 9: Message rendering includes metadata
   * For any rendered message, the output should contain both timestamp and sender identification.
   * Validates: Requirements 3.5
   * Feature: medical-ai-platform, Property 9: Message rendering includes metadata
   */
  test('Property 9: Message rendering includes metadata', () => {
    fc.assert(
      fc.property(
        fc.array(messageGenerator, { minLength: 1, maxLength: 10 }),
        (messages: Message[]) => {
          // Render the ChatWindow with generated messages
          const { container } = render(<ChatWindow messages={messages} />)

          // For each message, verify it contains both timestamp and sender
          messages.forEach((message) => {
            // Find the message element
            const messageElement = container.querySelector(`[data-testid="message-${message.id}"]`)
            
            // Message should exist
            expect(messageElement).toBeTruthy()
            
            if (messageElement) {
              // Check that the message has the role data attribute (sender identification)
              const roleAttr = messageElement.getAttribute('data-role')
              expect(roleAttr).toBe(message.role)
              
              // Check that the message has the timestamp data attribute
              const timestampAttr = messageElement.getAttribute('data-timestamp')
              expect(timestampAttr).toBe(message.created_at)
              
              // Verify sender label is rendered in the DOM
              const senderLabels = {
                'user': 'You',
                'assistant': 'AI Assistant',
                'system': 'System'
              }
              const expectedSender = senderLabels[message.role]
              expect(messageElement.textContent).toContain(expectedSender)
              
              // Verify message content is rendered
              expect(messageElement.textContent).toContain(message.content)
              
              // Verify timestamp is formatted and displayed
              // The timestamp should be present in some form in the text content
              // We can't check the exact format since it's formatted, but it should exist
              const timestampElements = messageElement.querySelectorAll('[style*="font-size: 11px"]')
              expect(timestampElements.length).toBeGreaterThan(0)
            }
          })
        }
      ),
      { numRuns: 100 } // Run 100 iterations as per spec requirements
    )
  })

  /**
   * Additional property test: Message content is never empty
   * For any message with non-empty content, the rendered output should display that content.
   */
  test('Property: Message content is always displayed', () => {
    fc.assert(
      fc.property(
        messageGenerator,
        (message: Message) => {
          const { container } = render(<ChatWindow messages={[message]} />)
          
          const messageElement = container.querySelector(`[data-testid="message-${message.id}"]`)
          expect(messageElement).toBeTruthy()
          
          if (messageElement) {
            // The message content should be present in the rendered output
            expect(messageElement.textContent).toContain(message.content)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Messages with different roles are visually distinguished
   * For any message, user messages should have different styling than assistant messages.
   */
  test('Property: User and assistant messages are visually distinguished', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          messageGenerator.map(m => ({ ...m, role: 'user' as const })),
          messageGenerator.map(m => ({ ...m, role: 'assistant' as const }))
        ),
        ([userMessage, assistantMessage]: [Message, Message]) => {
          const { container } = render(
            <ChatWindow messages={[userMessage, assistantMessage]} />
          )
          
          const userElement = container.querySelector(`[data-testid="message-${userMessage.id}"]`)
          const assistantElement = container.querySelector(`[data-testid="message-${assistantMessage.id}"]`)
          
          expect(userElement).toBeTruthy()
          expect(assistantElement).toBeTruthy()
          
          if (userElement && assistantElement) {
            // User messages should be aligned to the right (flex-end)
            const userStyle = window.getComputedStyle(userElement)
            expect(userElement.getAttribute('style')).toContain('flex-end')
            
            // Assistant messages should be aligned to the left (flex-start)
            expect(assistantElement.getAttribute('style')).toContain('flex-start')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Empty message list shows appropriate message
   * For any empty message array, the component should display a helpful message.
   */
  test('Property: Empty message list is handled gracefully', () => {
    const { container } = render(<ChatWindow messages={[]} />)
    
    // Should show "No messages yet" text
    expect(container.textContent).toContain('No messages yet')
  })

  /**
   * Property: Loading state is displayed correctly
   * When loading is true, a loading indicator should be shown.
   */
  test('Property: Loading state is displayed', () => {
    const { container } = render(<ChatWindow messages={[]} loading={true} />)
    
    // Should show "Thinking..." text
    expect(container.textContent).toContain('Thinking...')
  })

  /**
   * Property: Error state is displayed correctly
   * When an error is provided, it should be displayed to the user.
   */
  test('Property: Error state is displayed', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (errorMessage: string) => {
          const { container } = render(
            <ChatWindow messages={[]} error={errorMessage} />
          )
          
          // Error message should be displayed
          expect(container.textContent).toContain(errorMessage)
          expect(container.textContent).toContain('Error:')
        }
      ),
      { numRuns: 100 }
    )
  })
})
