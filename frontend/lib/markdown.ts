/**
 * Simple markdown-to-HTML converter for chat messages
 * Handles basic formatting without exposing raw markdown symbols
 */

export function parseMarkdown(text: string): string {
  if (!text) return ''
  
  let html = text
  
  // Convert headers (### Header -> <h3>Header</h3>)
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>')
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>')
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>')
  
  // Convert bold (**text** or __text__ -> <strong>text</strong>)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')
  
  // Convert italic (*text* or _text_ -> <em>text</em>)
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/_(.+?)_/g, '<em>$1</em>')
  
  // Convert inline code (`code` -> <code>code</code>)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  
  // Convert code blocks (```code``` -> <pre><code>code</code></pre>)
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
  
  // Convert unordered lists (- item or * item -> <ul><li>item</li></ul>)
  html = html.replace(/^\s*[-*]\s+(.+)$/gim, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
  
  // Convert ordered lists (1. item -> <ol><li>item</li></ol>)
  html = html.replace(/^\s*\d+\.\s+(.+)$/gim, '<li>$1</li>')
  
  // Convert line breaks
  html = html.replace(/\n\n/g, '<br><br>')
  html = html.replace(/\n/g, '<br>')
  
  return html
}

/**
 * Strip markdown formatting and return plain text
 */
export function stripMarkdown(text: string): string {
  if (!text) return ''
  
  let plain = text
  
  // Remove headers
  plain = plain.replace(/^#{1,6}\s+/gim, '')
  
  // Remove bold/italic
  plain = plain.replace(/\*\*(.+?)\*\*/g, '$1')
  plain = plain.replace(/__(.+?)__/g, '$1')
  plain = plain.replace(/\*(.+?)\*/g, '$1')
  plain = plain.replace(/_(.+?)_/g, '$1')
  
  // Remove code blocks
  plain = plain.replace(/```[\s\S]*?```/g, '')
  plain = plain.replace(/`([^`]+)`/g, '$1')
  
  // Remove list markers
  plain = plain.replace(/^\s*[-*]\s+/gim, '')
  plain = plain.replace(/^\s*\d+\.\s+/gim, '')
  
  return plain.trim()
}
