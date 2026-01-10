import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import Lenis from 'lenis'

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      wrapper: window, // Ensure global scroll
      content: document.documentElement,
      lerp: 0.1,
      smoothWheel: true,
    })

    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        :root {
          --medical-blue: #6366f1;
          --medical-bg: #fdfbf7;
        }

        * {
          box-sizing: border-box;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        body {
          margin: 0;
          padding: 0;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          background-color: var(--medical-bg);
          color: #1e293b;
        }

        html.lenis {
          height: auto;
        }

        .lenis.lenis-smooth {
          scroll-behavior: auto !important;
        }

        .lenis.lenis-smooth [data-lenis-prevent] {
          overscroll-behavior: contain;
        }

        [data-lenis-prevent] {
          overscroll-behavior: contain;
          -ms-overflow-style: none;
          scrollbar-width: thin;
        }
        .lenis-scrolling iframe {
          pointer-events: none;
        }

        /* Markdown Styles for Chat */
        .prose p { margin-bottom: 1em; margin-top: 0; }
        .prose p:last-child { margin-bottom: 0; }
        .prose strong { fontWeight: 700; }
        .prose ul, .prose ol { margin-bottom: 1em; padding-left: 1.5em; }
        .prose li { margin-bottom: 0.5em; }
        .prose h1, .prose h2, .prose h3 { margin: 1.5em 0 0.5em 0; fontWeight: 700; line-height: 1.3; }
        .prose code { 
          background-color: rgba(0,0,0,0.05); 
          padding: 0.2em 0.4em; 
          borderRadius: 4px; 
          fontSize: 0.9em;
          fontFamily: monospace;
        }
      `}</style>
      <Component {...pageProps} />
    </>
  )
}
