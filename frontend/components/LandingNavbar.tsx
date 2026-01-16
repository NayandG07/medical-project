import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function LandingNavbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [isScrolled, setIsScrolled] = useState(false)
    const [isLoggedIn, setIsLoggedIn] = useState(false)

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 40)
        }
        window.addEventListener('scroll', handleScroll)

        // Check auth status
        supabase.auth.getSession().then(({ data: { session } }) => {
            setIsLoggedIn(!!session)
        })

        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
            <motion.div
                initial={{ y: -100, opacity: 0 }}
                animate={{
                    y: isScrolled ? 20 : 0,
                    opacity: 1,
                    paddingTop: isScrolled ? 0 : 4,
                }}
                transition={{
                    duration: 0.8,
                    ease: [0.16, 1, 0.3, 1],
                    opacity: { duration: 0.4 }
                }}
                className="mx-auto flex justify-center px-6 md:px-10 pointer-events-auto"
            >
                <motion.div
                    initial={false}
                    animate={{
                        backgroundColor: isScrolled ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0)',
                        backdropFilter: isScrolled ? 'blur(20px)' : 'blur(0px)',
                        padding: isScrolled ? '14px 40px' : '16px 0px',
                        borderRadius: isScrolled ? '100px' : '0px',
                        boxShadow: isScrolled ? '0 25px 50px -12px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04)' : '0 0 0 0px rgba(0,0,0,0)',
                        width: '100%',
                        maxWidth: isScrolled ? '1000px' : '1400px',
                    }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="flex justify-between items-center w-full"
                >
                    <Link href="/" className="flex items-center gap-3 group shrink-0">
                        <div className="w-10 h-10 bg-[var(--cream-text-main)] rounded-[14px] flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 shadow-lg shadow-black/10">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                            </svg>
                        </div>
                        <span className="text-2xl font-black tracking-tighter text-[var(--cream-text-main)]">Vaidya <span className="text-indigo-600">AI</span></span>
                    </Link>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center gap-10 lg:gap-12">
                        <Link href="/#features" className="text-[11px] font-black text-[var(--cream-text-muted)] hover:text-black transition-all uppercase tracking-[0.2em]">Features</Link>
                        <Link href="/#methodology" className="text-[11px] font-black text-[var(--cream-text-muted)] hover:text-black transition-all uppercase tracking-[0.2em]">Methodology</Link>
                        <Link href="/#about" className="text-[11px] font-black text-[var(--cream-text-muted)] hover:text-black transition-all uppercase tracking-[0.2em]">About</Link>
                    </div>

                    <div className="hidden md:flex items-center">
                        {isLoggedIn ? (
                            <Link href="/dashboard" className="bg-[var(--cream-text-main)] text-white px-8 py-3 rounded-full text-[14px] font-extrabold hover:bg-black transition-all shadow-xl hover:-translate-y-0.5 active:translate-y-0">
                                Dashboard
                            </Link>
                        ) : (
                            <Link href="/login" className="bg-[var(--cream-text-main)] text-white px-8 py-3.5 rounded-full text-[14px] font-extrabold hover:bg-black transition-all shadow-2xl hover:-translate-y-0.5 active:translate-y-0 group">
                                <span className="flex items-center gap-2">
                                    Get Started
                                    <motion.span animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7 7 7-7 7" /></svg>
                                    </motion.span>
                                </span>
                            </Link>
                        )}
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button className="md:hidden text-[var(--cream-text-main)] p-2 hover:bg-[var(--cream-accent-soft)] rounded-xl transition-colors" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                        {isMenuOpen ? <X size={26} /> : <Menu size={26} />}
                    </button>
                </motion.div>
            </motion.div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="md:hidden absolute top-24 left-6 right-6 bg-[var(--cream-bg)]/95 backdrop-blur-2xl rounded-[40px] p-10 shadow-2xl border border-[var(--cream-accent-soft)] space-y-8 pointer-events-auto"
                    >
                        <div className="flex flex-col gap-6">
                            <Link href="/#features" onClick={() => setIsMenuOpen(false)} className="text-xl font-black text-[var(--cream-text-main)]">Features</Link>
                            <Link href="/#methodology" onClick={() => setIsMenuOpen(false)} className="text-xl font-black text-[var(--cream-text-main)]">Methodology</Link>
                            <Link href="/#about" onClick={() => setIsMenuOpen(false)} className="text-xl font-black text-[var(--cream-text-main)]">About Us</Link>
                        </div>
                        <div className="pt-8 border-t border-[var(--cream-accent-soft)]">
                            <Link href="/login" onClick={() => setIsMenuOpen(false)} className="block bg-[var(--cream-text-main)] text-white py-5 rounded-full text-[18px] font-black text-center shadow-xl">
                                Get Started Free
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    )
}

