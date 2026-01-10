import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase, AuthUser } from '@/lib/supabase'
import AdminLayout from '@/components/AdminLayout'

export default function AdminSettings() {
    const router = useRouter()
    const [user, setUser] = useState<AuthUser | null>(null)
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [platformName, setPlatformName] = useState('')
    const [studentPlanPrice, setStudentPlanPrice] = useState(150)
    const [proPlanPrice, setProPlanPrice] = useState(300)
    const [yearlyDiscount, setYearlyDiscount] = useState(10)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    useEffect(() => {
        const checkAdminAccess = async () => {
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                router.push('/')
                return
            }

            setUser(session.user as AuthUser)

            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

            try {
                const response = await fetch(`${API_URL}/api/admin/users?limit=1`, {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                })

                if (response.ok) {
                    setIsAdmin(true)
                    // Fetch current settings
                    const settingsRes = await fetch(`${API_URL}/api/system/settings`)
                    if (settingsRes.ok) {
                        const settings = await settingsRes.json()
                        setPlatformName(settings.platform_name)
                        setStudentPlanPrice(settings.student_plan_price)
                        setProPlanPrice(settings.pro_plan_price)
                        setYearlyDiscount(settings.yearly_discount_percentage)
                    }
                    setLoading(false)
                } else {
                    router.push('/chat')
                }
            } catch (err) {
                console.error('Admin verification failed:', err)
                router.push('/chat')
            }
        }

        checkAdminAccess()
    }, [router])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setMessage(null)

        const { data: { session } } = await supabase.auth.getSession()
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

        try {
            const response = await fetch(`${API_URL}/api/admin/settings`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    platform_name: platformName,
                    student_plan_price: studentPlanPrice,
                    pro_plan_price: proPlanPrice,
                    yearly_discount_percentage: yearlyDiscount
                })
            })

            if (response.ok) {
                setMessage({ type: 'success', text: 'Settings updated successfully!' })
            } else {
                const data = await response.json()
                throw new Error(data.detail || 'Failed to update settings')
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message })
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <p>Loading...</p>
            </div>
        )
    }

    if (!user || !isAdmin) return null

    return (
        <>
            <Head>
                <title>General Settings - Admin Dashboard</title>
            </Head>
            <AdminLayout user={user}>
                <div style={{ padding: '40px', maxWidth: '800px' }}>
                    <h1 style={{ marginBottom: '30px', fontSize: '28px', fontWeight: '700' }}>General Settings</h1>

                    <div style={{
                        backgroundColor: 'white',
                        padding: '40px',
                        borderRadius: '16px',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                        border: '1px solid #f1f5f9'
                    }}>
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#475569',
                                    marginBottom: '8px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    Platform Name
                                </label>
                                <input
                                    type="text"
                                    value={platformName}
                                    onChange={(e) => setPlatformName(e.target.value)}
                                    placeholder="e.g. Vaidya AI"
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: '8px',
                                        border: '1.5px solid #e2e8f0',
                                        fontSize: '16px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#94a3b8'}
                                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                />
                                <p style={{ marginTop: '8px', fontSize: '13px', color: '#64748b' }}>
                                    This name will appear on the login page and throughout the application.
                                </p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                <div>
                                    <label style={{
                                        display: 'block', fontSize: '14px', fontWeight: '600', color: '#475569',
                                        marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em'
                                    }}>
                                        Student Plan Price (INR)
                                    </label>
                                    <input
                                        type="number"
                                        value={studentPlanPrice}
                                        onChange={(e) => setStudentPlanPrice(Number(e.target.value))}
                                        style={{
                                            width: '100%', padding: '12px 16px', borderRadius: '8px',
                                            border: '1.5px solid #e2e8f0', fontSize: '16px', outline: 'none'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{
                                        display: 'block', fontSize: '14px', fontWeight: '600', color: '#475569',
                                        marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em'
                                    }}>
                                        Pro Plan Price (INR)
                                    </label>
                                    <input
                                        type="number"
                                        value={proPlanPrice}
                                        onChange={(e) => setProPlanPrice(Number(e.target.value))}
                                        style={{
                                            width: '100%', padding: '12px 16px', borderRadius: '8px',
                                            border: '1.5px solid #e2e8f0', fontSize: '16px', outline: 'none'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{
                                        display: 'block', fontSize: '14px', fontWeight: '600', color: '#475569',
                                        marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em'
                                    }}>
                                        Yearly Discount (%)
                                    </label>
                                    <input
                                        type="number"
                                        value={yearlyDiscount}
                                        onChange={(e) => setYearlyDiscount(Number(e.target.value))}
                                        style={{
                                            width: '100%', padding: '12px 16px', borderRadius: '8px',
                                            border: '1.5px solid #e2e8f0', fontSize: '16px', outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>

                            {message && (
                                <div style={{
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    backgroundColor: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
                                    border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fee2e2'}`,
                                    color: message.type === 'success' ? '#166534' : '#991b1b',
                                    fontSize: '14px',
                                    fontWeight: '500'
                                }}>
                                    {message.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={saving}
                                style={{
                                    padding: '12px 24px',
                                    backgroundColor: '#1e293b',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    alignSelf: 'flex-start',
                                    transition: 'background-color 0.2s'
                                }}
                            >
                                {saving ? 'Saving...' : 'Save Settings'}
                            </button>
                        </form>
                    </div>
                </div>
            </AdminLayout>
        </>
    )
}
