import Link from 'next/link'
import { Activity, Heart, Shield, ArrowRight } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function LandingFooter() {
    const [isLoggedIn, setIsLoggedIn] = useState(false)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setIsLoggedIn(!!session)
        })
    }, [])

    const platformLinks = [
        { name: "Concept Mapping", href: "/conceptmap" },
        { name: "Question Bank", href: "/mcqs" },
        { name: "Clinical Cases", href: "/clinical" },
        { name: "Flashcards", href: "/flashcards" }
    ]

    return (
        <footer className="pt-20 pb-12 px-6 border-t border-[var(--cream-accent-soft)] bg-[var(--cream-bg)]">
            <div className="max-w-7xl mx-auto">
                <div className="grid md:grid-cols-4 gap-16 mb-20">
                    <div className="col-span-1 md:col-span-1">
                        <Link href="/" className="flex items-center gap-2 mb-6">
                            <div className="w-8 h-8 bg-[var(--cream-text-main)] rounded-lg flex items-center justify-center">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                                </svg>
                            </div>
                            <span className="text-xl font-black tracking-tight text-[var(--cream-text-main)]">Vaidya AI</span>
                        </Link>
                        <p className="text-[var(--cream-text-muted)] font-medium text-sm leading-relaxed mb-6">
                            Elevating medical education through advanced artificial intelligence and human-centric design.
                        </p>
                        <div className="flex gap-4">
                            {[Activity, Heart, Shield].map((Icon, i) => (
                                <div key={i} className="w-10 h-10 rounded-full bg-[var(--cream-accent-soft)] border border-[var(--cream-accent)] flex items-center justify-center text-[var(--cream-text-main)] cursor-pointer hover:scale-110 transition-transform">
                                    <Icon size={18} />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h5 className="font-bold text-[var(--cream-text-main)] uppercase tracking-widest text-xs mb-8">Platform</h5>
                        <ul className="space-y-4 text-[var(--cream-text-muted)] font-medium text-sm">
                            {platformLinks.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={isLoggedIn ? link.href : "/login"}
                                        className="hover:text-black transition-colors"
                                    >
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h5 className="font-bold text-[var(--cream-text-main)] uppercase tracking-widest text-xs mb-8">Company</h5>
                        <ul className="space-y-4 text-[var(--cream-text-muted)] font-medium text-sm">
                            <li><Link href="/#about" className="hover:text-black">About Us</Link></li>
                            <li><Link href="/contact" className="hover:text-black">Contact</Link></li>
                            <li><Link href="/privacy" className="hover:text-black">Privacy Policy</Link></li>
                            <li><Link href="/terms" className="hover:text-black">Terms of Service</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h5 className="font-bold text-[var(--cream-text-main)] uppercase tracking-widest text-xs mb-8">Subscribe</h5>
                        <p className="text-[var(--cream-text-muted)] font-medium text-xs leading-relaxed mb-6">Receive the latest medical insights and AI updates.</p>
                        <div className="relative">
                            <input type="email" placeholder="Your email" className="w-full bg-[var(--cream-accent-soft)] border border-[var(--cream-accent)] rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-black transition-colors" />
                            <button className="absolute right-2 top-2 w-8 h-8 bg-black text-white rounded-lg flex items-center justify-center"><ArrowRight size={16} /></button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center pt-12 border-t border-[var(--cream-accent-soft)]">
                    <p className="text-[var(--cream-text-muted)] text-[11px] font-bold uppercase tracking-widest">© 2026 Vaidya AI. All Rights Reserved.</p>
                    <div className="flex gap-8 mt-6 md:mt-0">
                        <p className="text-[var(--cream-text-muted)] text-[11px] font-bold uppercase tracking-widest">Designed for Excellence</p>
                    </div>
                </div>
            </div>
        </footer>
    )
}
