import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { Shield, Lock, FileText } from 'lucide-react'

export default function PrivacyPage() {
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
                <title>Privacy Policy - Vaidya AI</title>
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
                            backgroundColor: '#eff6ff',
                            borderRadius: '16px',
                            marginBottom: '24px',
                            color: '#3b82f6'
                        }}>
                            <Shield size={32} />
                        </div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: '#0f172a', marginBottom: '12px' }}>
                            Privacy Policy
                        </h1>
                        <p style={{ color: '#64748b' }}>Last updated: January 2026</p>
                    </div>

                    <Section title="1. Introduction">
                        <p>
                            At Vaidya AI, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our application. Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site.
                        </p>
                    </Section>

                    <Section title="2. Information Collection">
                        <p>
                            We collect information that you voluntarily provide to us when you register on the application. This includes personal information such as your name, email address, and any educational data you choose to upload for processing.
                        </p>
                        <ul style={{ marginTop: '12px', paddingLeft: '20px' }}>
                            <li>Personal identifiers (Name, Email)</li>
                            <li>Authentication data (Securely managed via Supabase)</li>
                            <li>User-generated content (Voice notes, uploaded documents)</li>
                        </ul>
                    </Section>

                    <Section title="3. Data Security">
                        <p>
                            We use administrative, technical, and physical security measures to help protect your personal information. Your personal API keys are encrypted before storage. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
                        </p>
                    </Section>

                    <Section title="4. Third-Party Services">
                        <p>
                            We may use third-party software to provide AI processing capabilities. These services are bound by confidentiality agreements and are prohibited from using your data for any purpose other than providing these services.
                        </p>
                    </Section>


                </motion.div>
            </DashboardLayout>
        </>
    )
}
