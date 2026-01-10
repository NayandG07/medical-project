import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { FileText, Gavel, Scale } from 'lucide-react'

export default function TermsPage() {
    const router = useRouter()
    const [user, setUser] = useState<AuthUser | null>(null)
    const [loading, setLoading] = useState(true)

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

    if (loading) return null

    const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
        <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>{title}</h2>
            <div style={{ fontSize: '1rem', lineHeight: '1.8', color: '#475569' }}>
                {children}
            </div>
        </div>
    )

    return (
        <>
            <Head>
                <title>Terms of Service - Vaidya AI</title>
            </Head>
            <DashboardLayout user={user!}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    style={{
                        maxWidth: '900px',
                        margin: '0 auto',
                        padding: '40px 20px',
                    }}
                >
                    <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                        <div style={{
                            display: 'inline-flex',
                            padding: '12px',
                            backgroundColor: '#f5f3ff',
                            borderRadius: '16px',
                            marginBottom: '24px',
                            color: '#7c3aed'
                        }}>
                            <Scale size={32} />
                        </div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: '#0f172a', marginBottom: '12px' }}>
                            Terms of Service
                        </h1>
                        <p style={{ color: '#64748b' }}>Last updated: January 2026</p>
                    </div>

                    <Section title="1. Agreement to Terms">
                        <p>
                            These Terms of Service constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you") and Vaidya AI ("we," "us" or "our"), concerning your access to and use of the Vaidya AI application. By accessing the site, you acknowledge that you have read, understood, and agree to be bound by all of these Terms of Service.
                        </p>
                    </Section>

                    <Section title="2. Intellectual Property Rights">
                        <p>
                            Unless otherwise indicated, the Site is our proprietary property and all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics on the Site (collectively, the "Content") and the trademarks, service marks, and logos contained therein (the "Marks") are owned or controlled by us or licensed to us, and are protected by copyright and trademark laws.
                        </p>
                    </Section>

                    <Section title="3. User Representations">
                        <p>
                            By using the Site, you represent and warrant that: (1) all registration information you submit will be true, accurate, current, and complete; (2) you will maintain the accuracy of such information and promptly update such registration information as necessary; (3) you have the legal capacity and you agree to comply with these Terms of Service.
                        </p>
                    </Section>

                    <Section title="4. Prohibited Activities">
                        <p>
                            You may not access or use the Site for any purpose other than that for which we make the Site available. The Site may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us.
                        </p>
                    </Section>

                    <Section title="5. Educational Disclaimer">
                        <div style={{ padding: '16px', backgroundColor: '#fff7ed', borderLeft: '4px solid #f97316', borderRadius: '4px' }}>
                            <p style={{ margin: 0, color: '#9a3412', fontWeight: '500' }}>
                                Vaidya AI is an educational tool designed to assist medical students. It is NOT a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.
                            </p>
                        </div>
                    </Section>


                </motion.div>
            </DashboardLayout>
        </>
    )
}
