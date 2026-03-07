import Link from 'next/link'
import { Activity, Heart, Shield, Send } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function LandingFooter() {
    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const [supportEmail, setSupportEmail] = useState('support@vaidya.ai')
    const [submitting, setSubmitting] = useState(false)
    const [sent, setSent] = useState(false)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setIsLoggedIn(!!session)
        })

        // Fetch system settings for support email
        const fetchSettings = async () => {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            try {
                // Use a short timeout to prevent long hanging requests if server is down
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                
                const res = await fetch(`${API_URL}/api/system/settings`, {
                    signal: controller.signal
                }).catch(() => {
                   // Silently fail if server is unreachable
                   return null;
                });
                
                clearTimeout(timeoutId);

                if (res && res.ok) {
                    const data = await res.json()
                    if (data.support_email) {
                        setSupportEmail(data.support_email)
                    }
                }
            } catch (error) {
                // If it's an abort error or other fetch error, we just log it normally
                // This prevents the global "Failed to fetch" error overlay in some environments
                console.log("System settings fetch status: Server unavailable or request timed out");
            }
        }

        fetchSettings()
    }, [])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        // Simulate API call
        setTimeout(() => {
            setSubmitting(false)
            setSent(true)
        }, 1500)
    }

    const platformLinks = [
        { name: "Concept Mapping", href: "/conceptmap" },
        { name: "Question Bank", href: "/mcqs" },
        { name: "Clinical Cases", href: "/clinical" },
        { name: "Flashcards", href: "/flashcards" }
    ]

    return (
        <footer className="pt-20 pb-12 px-6 border-t border-[var(--cream-accent-soft)] bg-[var(--cream-bg)]">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-10">
                    <div className="col-span-1 md:col-span-5 md:pr-24 md:pl-12">
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

                    <div className="col-span-1 md:col-span-2">
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

                    <div className="col-span-1 md:col-span-2">
                        <h5 className="font-bold text-[var(--cream-text-main)] uppercase tracking-widest text-xs mb-8">Company</h5>
                        <ul className="space-y-4 text-[var(--cream-text-muted)] font-medium text-sm">
                            <li><Link href="/#about" className="hover:text-black">About Us</Link></li>
                            <li><Link href="/contact" className="hover:text-black">Contact</Link></li>
                            <li><Link href="/privacy" className="hover:text-black">Privacy Policy</Link></li>
                            <li><Link href="/terms" className="hover:text-black">Terms of Service</Link></li>
                        </ul>
                    </div>

                    <div className="col-span-1 md:col-span-3">
                        <div className="w-[260px] bg-white p-5 rounded-2xl shadow-sm border border-[var(--cream-accent-soft)]">
                            {sent ? (
                                <div className="text-center py-6">
                                    <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-3">
                                        <Send size={20} />
                                    </div>
                                    <h3 className="text-base font-bold text-slate-800 mb-2">Message Sent!</h3>
                                    <button
                                        onClick={() => setSent(false)}
                                        className="text-indigo-600 text-xs font-bold hover:underline"
                                    >
                                        Send another
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Topic</label>
                                        <select className="w-full p-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-indigo-500 bg-slate-50">
                                            <option>General Inquiry</option>
                                            <option>Technical Support</option>
                                            <option>Billing Question</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Message</label>
                                        <textarea
                                            rows={2}
                                            required
                                            placeholder="How can we help?"
                                            className="w-full p-2 rounded-lg border border-slate-200 text-xs outline-none focus:border-indigo-500 bg-slate-50 resize-none font-sans"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {submitting ? 'Sending...' : <><Send size={12} /> Send Message</>}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex justify-center pt-8 border-t border-[var(--cream-accent-soft)]">
                    <p className="text-[var(--cream-text-muted)] text-[11px] font-bold uppercase tracking-widest">© 2026 Vaidya AI. All Rights Reserved.</p>
                </div>
            </div>
        </footer>
    )
}
