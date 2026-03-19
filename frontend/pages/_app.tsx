import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Lenis from 'lenis'
import '@/styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  
  useEffect(() => {
    // Disable Lenis on pages with custom scrolling
    const disableLenisPages = ['/highyield', '/image-analysis']
    const shouldDisableLenis = disableLenisPages.includes(router.pathname)
    
    if (shouldDisableLenis) {
      // Don't initialize Lenis on these pages
      return
    }
    
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      wrapper: window,
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
  }, [router.pathname])

  return <Component {...pageProps} />
}
