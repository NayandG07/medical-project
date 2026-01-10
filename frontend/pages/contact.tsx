import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Mail, MessageSquare, Send, MapPin, Phone } from 'lucide-react'

export default function ContactPage() {
    const router = useRouter()
    const [user, setUser] = useState<AuthUser | null>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [sent, setSent] = useState(false)

    useEffect(() => {
        checkUser()
    }, [])

    const checkUser = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/')
                return
            }
            setUser(user as AuthUser)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        // Simulate API call
        setTimeout(() => {
            setSubmitting(false)
            setSent(true)
        }, 1500)
    }

    if (loading) return null

    return (
        <>
            <Head>
                <title>Contact Support - Vaidya AI</title>
            </Head>
            <DashboardLayout user={user!}>
                <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>

                    <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                        <motion.h1
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{ fontSize: '2.5rem', fontWeight: '800', color: '#0f172a', marginBottom: '16px' }}
                        >
                            How can we help?
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            style={{ fontSize: '1.2rem', color: '#64748b', maxWidth: '600px', margin: '0 auto' }}
                        >
                            We're here to help with any questions about your account, billing, or technical issues.
                        </motion.p>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                        gap: '40px',
                        alignItems: 'start'
                    }}>

                        {/* Contact Form */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            style={{
                                backgroundColor: 'white',
                                borderRadius: '24px',
                                padding: '32px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                border: '1px solid #e2e8f0'
                            }}
                        >
                            {sent ? (
                                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                    <div style={{
                                        width: '64px', height: '64px', borderRadius: '50%',
                                        backgroundColor: '#dcfce7', color: '#16a34a',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        margin: '0 auto 24px'
                                    }}>
                                        <Send size={32} />
                                    </div>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>Message Sent!</h3>
                                    <p style={{ color: '#64748b' }}>We'll get back to you within 24 hours.</p>
                                    <button
                                        onClick={() => setSent(false)}
                                        style={{
                                            marginTop: '24px',
                                            padding: '12px 24px',
                                            backgroundColor: 'transparent',
                                            color: '#6366f1',
                                            border: '1px solid #6366f1',
                                            borderRadius: '12px',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Send another message
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit}>
                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>Topic</label>
                                        <select style={{
                                            width: '100%',
                                            padding: '12px',
                                            borderRadius: '12px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '1rem',
                                            outline: 'none',
                                            backgroundColor: '#f8fafc'
                                        }}>
                                            <option>General Inquiry</option>
                                            <option>Technical Support</option>
                                            <option>Billing Question</option>
                                            <option>Feature Request</option>
                                        </select>
                                    </div>

                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>Message</label>
                                        <textarea
                                            required
                                            rows={5}
                                            placeholder="Tell us how we can help..."
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                borderRadius: '12px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '1rem',
                                                outline: 'none',
                                                resize: 'none',
                                                fontFamily: 'inherit'
                                            }}
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        style={{
                                            width: '100%',
                                            padding: '14px',
                                            backgroundColor: '#6366f1',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '14px',
                                            fontSize: '1rem',
                                            fontWeight: '700',
                                            cursor: submitting ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            transition: 'all 0.2s',
                                            opacity: submitting ? 0.7 : 1
                                        }}
                                    >
                                        {submitting ? 'Sending...' : (
                                            <>
                                                <Send size={18} /> Send Message
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}
                        </motion.div>

                        {/* Info Cards */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
                        >
                            <div style={{
                                backgroundColor: '#eff6ff',
                                borderRadius: '24px',
                                padding: '24px',
                                display: 'flex',
                                alignItems: 'start',
                                gap: '16px'
                            }}>
                                <div style={{ padding: '12px', backgroundColor: 'white', borderRadius: '12px', color: '#3b82f6' }}>
                                    <Mail size={24} />
                                </div>
                                <div>
                                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: '700', color: '#1e293b' }}>Email Support</h3>
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Direct access to our support team.</p>
                                    <a href="mailto:support@vaidya.ai" style={{ display: 'block', marginTop: '8px', color: '#3b82f6', fontWeight: '600', textDecoration: 'none' }}>support@vaidya.ai</a>
                                </div>
                            </div>


                            <div style={{
                                backgroundColor: '#FFFBEB',
                                borderRadius: '24px',
                                padding: '24px',
                                display: 'flex',
                                alignItems: 'start',
                                gap: '16px'
                            }}>
                                <div style={{ padding: '12px', backgroundColor: 'white', borderRadius: '12px', color: '#B45309' }}>
                                    <MapPin size={24} />
                                </div>
                                <div>
                                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: '700', color: '#1e293b' }}>Office</h3>
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Guwahati, Assam, India</p>
                                </div>
                            </div>

                        </motion.div>
                    </div>
                </div>
            </DashboardLayout>
        </>
    )
}
