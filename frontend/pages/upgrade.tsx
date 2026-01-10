import { useState, useEffect } from 'react'
import Head from 'next/head'
import { motion } from 'framer-motion'
import { Check, Sparkles, Zap, Shield, Crown } from 'lucide-react'
import { supabase, AuthUser } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { useRouter } from 'next/router'

export default function UpgradePage() {
    const router = useRouter()
    const [user, setUser] = useState<AuthUser | null>(null)
    const [loading, setLoading] = useState(true)
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
    const [currency, setCurrency] = useState<'INR' | 'USD'>('INR')
    const [studentPrice, setStudentPrice] = useState(150)
    const [proPrice, setProPrice] = useState(300)
    const [yearlyDiscountPercentage, setYearlyDiscountPercentage] = useState(10)
    const [showComparison, setShowComparison] = useState(false)

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

            // Fetch pricing settings
            try {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
                const res = await fetch(`${API_URL}/api/system/settings`)
                if (res.ok) {
                    const data = await res.json()
                    if (data.student_plan_price) setStudentPrice(data.student_plan_price)
                    if (data.pro_plan_price) setProPrice(data.pro_plan_price)
                    if (data.yearly_discount_percentage) setYearlyDiscountPercentage(data.yearly_discount_percentage)
                }
            } catch (error) {
                console.error('Failed to fetch pricing settings', error)
            }
        } finally {
            setLoading(false)
        }
    }

    if (loading) return null

    // Pricing Logic
    const getPrice = (basePrice: number) => {
        let price = basePrice
        if (currency === 'USD') {
            // Approximate conversion or fixed tier: 150 INR ~ $2 USD, 300 INR ~ $4 USD
            // We use simple logic: if price is > 0, we divide by ~80 and round, or map specifically
            if (basePrice > 0) {
                // Simple approximation for user configured price
                price = Math.ceil(basePrice / 75)
            }
        }

        if (billingCycle === 'yearly') {
            price = price * 12 * (1 - yearlyDiscountPercentage / 100)
            // Round to nice numbers
            price = Math.round(price)
        }

        if (price === 0) return currency === 'INR' ? '₹0' : '$0'
        return currency === 'INR' ? `₹${price}` : `$${price}`
    }

    const plans = [
        {
            name: 'Free Plan',
            basePrice: 0,
            description: 'Essential tools to start.',
            features: [
                'Basic Chat Access',
                '50 Flashcards / Day',
                '10 Daily MCQs',
                'Community Access'
            ],
            color: '#94a3b8',
            gradient: 'from-slate-500 to-slate-700',
            buttonVariant: 'outline',
            popular: false
        },
        {
            name: 'Student Plan',
            basePrice: studentPrice,
            description: 'For dedicated learners.',
            features: [
                'Unlimited Flashcards',
                'Unlimited MCQs',
                'Concept Map Generator',
                'High Yield Notes',
                'Ad-free Experience'
            ],
            color: '#3b82f6',
            gradient: 'from-blue-500 to-blue-700',
            buttonVariant: 'outline',
            popular: false
        },
        {
            name: 'Pro Plan',
            basePrice: proPrice,
            description: 'Power for mastery.',
            features: [
                'All Student Features',
                'Clinical Reasoning AI',
                'OSCE Virtual Patient Cases',
                'Document Analysis',
                'Priority 24/7 Support'
            ],
            color: '#8b5cf6',
            gradient: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            buttonVariant: 'solid',
            popular: true
        }
    ]

    return (
        <>
            <Head>
                <title>Upgrade Plan - Vaidya AI</title>
            </Head>
            <DashboardLayout user={user!}>
                <div style={{
                    minHeight: '100%',
                    background: 'linear-gradient(to bottom, #f8fafc, #f1f5f9)',
                    padding: '20px 20px 60px 20px'
                }}>
                    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

                        {/* improved Header */}
                        <div style={{ textAlign: 'center', marginBottom: '32px', paddingTop: '10px' }}>
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                <span style={{
                                    display: 'inline-block',
                                    padding: '6px 16px',
                                    borderRadius: '50px',
                                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                    color: '#6366f1',
                                    fontSize: '0.85rem',
                                    fontWeight: '700',
                                    marginBottom: '12px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    Pricing Plans
                                </span>
                                <h1 style={{
                                    fontSize: '2.5rem',
                                    fontWeight: '800',
                                    color: '#1e293b',
                                    marginBottom: '12px',
                                    letterSpacing: '-0.02em',
                                    lineHeight: '1.2'
                                }}>
                                    Invest in Your Future
                                </h1>
                                <p style={{
                                    fontSize: '1rem',
                                    color: '#64748b',
                                    maxWidth: '500px',
                                    margin: '0 auto',
                                    lineHeight: '1.6'
                                }}>
                                    Choose the perfect plan for your medical learning journey.
                                    Upgrade anytime as you grow.
                                </p>
                            </motion.div>
                        </div>

                        {/* Compact Controls */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            style={{
                                display: 'flex',
                                justifyContent: 'center',
                                gap: '16px',
                                marginBottom: '40px',
                                alignItems: 'center'
                            }}
                        >
                            {/* Combined Toggle */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                backgroundColor: 'white',
                                padding: '6px',
                                borderRadius: '16px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                                border: '1px solid #e2e8f0'
                            }}>
                                <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '10px', padding: '3px' }}>
                                    {['monthly', 'yearly'].map((cycle) => (
                                        <button
                                            key={cycle}
                                            onClick={() => setBillingCycle(cycle as any)}
                                            style={{
                                                padding: '6px 16px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                backgroundColor: billingCycle === cycle ? 'white' : 'transparent',
                                                color: billingCycle === cycle ? '#0f172a' : '#64748b',
                                                fontWeight: billingCycle === cycle ? '700' : '500',
                                                cursor: 'pointer',
                                                boxShadow: billingCycle === cycle ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                                transition: 'all 0.2s',
                                                textTransform: 'capitalize',
                                                fontSize: '0.85rem'
                                            }}
                                        >
                                            {cycle}
                                        </button>
                                    ))}
                                </div>

                                {billingCycle === 'yearly' && (
                                    <span style={{
                                        backgroundColor: '#ecfdf5',
                                        color: '#059669',
                                        fontSize: '0.75rem',
                                        fontWeight: '700',
                                        padding: '4px 8px',
                                        borderRadius: '8px',
                                        marginRight: '6px'
                                    }}>
                                        Save {yearlyDiscountPercentage}%
                                    </span>
                                )}
                            </div>

                            <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0' }}></div>

                            {/* Currency Toggle */}
                            <div style={{ display: 'flex', backgroundColor: '#white', borderRadius: '12px', padding: '3px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                {['INR', 'USD'].map((curr) => (
                                    <button
                                        key={curr}
                                        onClick={() => setCurrency(curr as any)}
                                        style={{
                                            padding: '4px 12px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            backgroundColor: currency === curr ? '#f1f5f9' : 'transparent',
                                            color: currency === curr ? '#0f172a' : '#94a3b8',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            fontSize: '0.8rem'
                                        }}
                                    >
                                        {curr}
                                    </button>
                                ))}
                            </div>
                        </motion.div>

                        {/* Cards Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '24px',
                            alignItems: 'start'
                        }}>
                            {plans.map((plan, idx) => (
                                <motion.div
                                    key={plan.name}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1 + 0.2 }}
                                    style={{
                                        backgroundColor: 'white',
                                        borderRadius: '24px',
                                        border: plan.popular
                                            ? '2px solid transparent'
                                            : '1px solid #e2e8f0',
                                        backgroundImage: plan.popular
                                            ? `linear-gradient(white, white), ${plan.gradient}`
                                            : 'none',
                                        backgroundOrigin: 'border-box',
                                        backgroundClip: 'padding-box, border-box',
                                        boxShadow: plan.popular
                                            ? '0 20px 25px -5px rgba(99, 102, 241, 0.1), 0 8px 10px -6px rgba(99, 102, 241, 0.1)'
                                            : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                        position: 'relative',
                                        padding: '24px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        height: '100%',
                                        transform: plan.popular ? 'scale(1.03)' : 'scale(1)',
                                        zIndex: plan.popular ? 10 : 1
                                    }}
                                >
                                    {plan.popular && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '-12px',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            background: plan.gradient,
                                            color: 'white',
                                            fontSize: '0.7rem',
                                            fontWeight: '800',
                                            padding: '4px 12px',
                                            borderRadius: '20px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.3)',
                                            letterSpacing: '0.05em'
                                        }}>
                                            <Crown size={12} fill="currentColor" /> POPULAR
                                        </div>
                                    )}

                                    {/* Card Header */}
                                    <div style={{ marginBottom: '20px' }}>
                                        <h3 style={{
                                            fontSize: '1.25rem',
                                            fontWeight: '700',
                                            color: '#1e293b',
                                            marginBottom: '4px'
                                        }}>
                                            {plan.name}
                                        </h3>
                                        <p style={{
                                            color: '#64748b',
                                            fontSize: '0.875rem',
                                            lineHeight: '1.4'
                                        }}>
                                            {plan.description}
                                        </p>
                                    </div>

                                    {/* Price */}
                                    <div style={{ marginBottom: '24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'baseline' }}>
                                            <span style={{
                                                fontSize: '2.5rem',
                                                fontWeight: '800',
                                                color: '#0f172a',
                                                letterSpacing: '-0.02em',
                                                lineHeight: '1'
                                            }}>
                                                {getPrice(plan.basePrice)}
                                            </span>
                                            {plan.basePrice > 0 && (
                                                <span style={{
                                                    color: '#64748b',
                                                    marginLeft: '4px',
                                                    fontSize: '0.9rem',
                                                    fontWeight: '500'
                                                }}>
                                                    /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <button
                                        style={{
                                            width: '100%',
                                            padding: '10px 16px',
                                            borderRadius: '12px',
                                            border: plan.buttonVariant === 'solid' ? 'none' : '1px solid #cbd5e1',
                                            background: plan.buttonVariant === 'solid'
                                                ? plan.gradient
                                                : 'transparent',
                                            color: plan.buttonVariant === 'solid' ? 'white' : '#475569',
                                            fontSize: '0.95rem',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            marginBottom: '32px',
                                            transition: 'all 0.2s',
                                            boxShadow: plan.buttonVariant === 'solid'
                                                ? '0 4px 6px -1px rgba(99, 102, 241, 0.2)'
                                                : 'none'
                                        }}
                                        onMouseOver={(e) => {
                                            if (plan.buttonVariant !== 'solid') {
                                                e.currentTarget.style.borderColor = '#94a3b8'
                                                e.currentTarget.style.backgroundColor = '#f8fafc'
                                                e.currentTarget.style.color = '#1e293b'
                                            } else {
                                                e.currentTarget.style.transform = 'translateY(-1px)'
                                                e.currentTarget.style.boxShadow = '0 6px 8px -1px rgba(99, 102, 241, 0.3)'
                                            }
                                        }}
                                        onMouseOut={(e) => {
                                            if (plan.buttonVariant !== 'solid') {
                                                e.currentTarget.style.borderColor = '#cbd5e1'
                                                e.currentTarget.style.backgroundColor = 'transparent'
                                                e.currentTarget.style.color = '#475569'
                                            } else {
                                                e.currentTarget.style.transform = 'none'
                                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(99, 102, 241, 0.2)'
                                            }
                                        }}
                                    >
                                        {plan.basePrice === 0 ? 'Current Plan' : 'Get Started'}
                                    </button>

                                    {/* Features */}
                                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '24px' }}>
                                        <p style={{
                                            fontSize: '0.75rem',
                                            fontWeight: '700',
                                            color: '#94a3b8',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: '16px'
                                        }}>
                                            Features includes:
                                        </p>
                                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                            {plan.features.map((feature, i) => (
                                                <li key={i} style={{
                                                    display: 'flex',
                                                    gap: '10px',
                                                    marginBottom: '12px',
                                                    color: '#334155',
                                                    fontSize: '0.9rem',
                                                    lineHeight: '1.4',
                                                    alignItems: 'start'
                                                }}>
                                                    <div style={{
                                                        marginTop: '2px',
                                                        color: plan.popular ? '#6366f1' : '#10b981',
                                                        flexShrink: 0
                                                    }}>
                                                        <Check size={16} strokeWidth={3} />
                                                    </div>
                                                    <span>{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Footer / Compare */}
                        <div style={{ marginTop: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px' }}>
                            <button
                                onClick={() => setShowComparison(!showComparison)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 16px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#64748b',
                                    fontSize: '0.9rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'color 0.2s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.color = '#334155'}
                                onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
                            >
                                <Sparkles size={16} /> {showComparison ? 'Hide feature comparison' : 'Compare full feature table'}
                            </button>

                            <div style={{ width: '1px', height: '16px', background: '#cbd5e1' }}></div>

                            <div style={{ display: 'flex', gap: '24px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '500' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Shield size={14} /> Secure Payment
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Zap size={14} /> Cancel Anytime
                                </span>
                            </div>
                        </div>

                        {/* Comparison Table */}
                        {showComparison && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                transition={{ duration: 0.4, ease: "easeOut" }}
                                style={{ marginTop: '60px' }}
                            >
                                <div style={{
                                    backgroundColor: 'white',
                                    borderRadius: '24px',
                                    border: '1px solid #e2e8f0',
                                    paddingBottom: '24px',
                                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)'
                                }}>
                                    {/* Table Header */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'minmax(240px, 1.5fr) 1fr 1fr 1fr',
                                        borderBottom: '1px solid #e2e8f0',
                                    }}>
                                        <div style={{ padding: '32px 32px 24px', fontWeight: '800', color: '#1e293b', fontSize: '1.2rem' }}>
                                            Comparison
                                        </div>
                                        <div style={{ padding: '32px 16px 24px', textAlign: 'center', fontWeight: '700', color: '#64748b', fontSize: '1.1rem' }}>
                                            Free
                                        </div>
                                        <div style={{ padding: '32px 16px 24px', textAlign: 'center', fontWeight: '700', color: '#3b82f6', fontSize: '1.1rem' }}>
                                            Student
                                        </div>
                                        <div style={{
                                            padding: '32px 16px 24px',
                                            textAlign: 'center',
                                            fontWeight: '800',
                                            fontSize: '1.1rem',
                                            backgroundColor: 'rgba(99, 102, 241, 0.04)',
                                            borderTopRightRadius: '24px',
                                        }}>
                                            <span style={{ color: '#6366f1' }}>Pro</span>
                                        </div>
                                    </div>

                                    {/* Data Source */}
                                    {[
                                        {
                                            category: 'Core Learning', items: [
                                                { name: 'Flashcards', free: '50 / day', student: 'Unlimited', pro: 'Unlimited' },
                                                { name: 'Daily MCQs', free: '10 / day', student: 'Unlimited', pro: 'Unlimited' },
                                                { name: 'Basic AI Chat', free: true, student: true, pro: true },
                                                { name: 'Community Access', free: true, student: true, pro: true },
                                            ]
                                        },
                                        {
                                            category: 'Advanced Tools', items: [
                                                { name: 'Concept Maps', free: false, student: true, pro: true },
                                                { name: 'High Yield Notes', free: false, student: true, pro: true },
                                                { name: 'Ad-free Experience', free: false, student: true, pro: true },
                                            ]
                                        },
                                        {
                                            category: 'Professional Mastery', items: [
                                                { name: 'Clinical Reasoning AI', free: false, student: false, pro: true },
                                                { name: 'OSCE Virtual Patients', free: false, student: false, pro: true },
                                                { name: 'Document Analysis', free: false, student: false, pro: true },
                                                { name: 'Priority Support', free: false, student: false, pro: true },
                                            ]
                                        }
                                    ].map((section, sIdx) => (
                                        <div key={section.category}>
                                            {/* Category Label */}
                                            <div style={{
                                                padding: '32px 32px 16px',
                                                color: '#0f172a',
                                                fontSize: '0.9rem',
                                                fontWeight: '800',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                display: 'grid',
                                                gridTemplateColumns: 'minmax(240px, 1.5fr) 1fr 1fr 1fr'
                                            }}>
                                                <div>{section.category}</div>
                                                <div></div>
                                                <div></div>
                                                {/* Continuous Pro Background */}
                                                <div style={{
                                                    backgroundColor: 'rgba(99, 102, 241, 0.04)',
                                                    marginTop: '-32px',
                                                    marginBottom: '-16px',
                                                    height: 'calc(100% + 48px)',
                                                    position: 'relative',
                                                    zIndex: -1
                                                }}></div>
                                            </div>

                                            {/* Rows */}
                                            {section.items.map((item, iIdx) => (
                                                <div
                                                    key={item.name}
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'minmax(240px, 1.5fr) 1fr 1fr 1fr',
                                                    }}
                                                >
                                                    <div style={{
                                                        padding: '16px 32px',
                                                        color: '#334155',
                                                        fontWeight: '500',
                                                        fontSize: '0.95rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        borderBottom: '1px solid #f1f5f9'
                                                    }}>
                                                        {item.name}
                                                    </div>

                                                    {/* Free */}
                                                    <div style={{
                                                        padding: '16px',
                                                        display: 'flex',
                                                        justifyContent: 'center',
                                                        alignItems: 'center',
                                                        color: '#64748b',
                                                        borderBottom: '1px solid #f1f5f9'
                                                    }}>
                                                        {item.free === true ? (
                                                            <div style={{ background: '#ecfdf5', borderRadius: '50%', padding: '2px' }}><Check size={18} color="#10b981" strokeWidth={3} /></div>
                                                        ) : item.free === false ? (
                                                            <div style={{ width: '8px', height: '2px', backgroundColor: '#0f172a' }}></div>
                                                        ) : (
                                                            <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>{item.free}</span>
                                                        )}
                                                    </div>

                                                    {/* Student */}
                                                    <div style={{
                                                        padding: '16px',
                                                        display: 'flex',
                                                        justifyContent: 'center',
                                                        alignItems: 'center',
                                                        color: '#334155',
                                                        borderBottom: '1px solid #f1f5f9'
                                                    }}>
                                                        {item.student === true ? (
                                                            <div style={{ background: '#dbeafe', borderRadius: '50%', padding: '2px' }}><Check size={18} color="#3b82f6" strokeWidth={3} /></div>
                                                        ) : item.student === false ? (
                                                            <div style={{ width: '8px', height: '2px', backgroundColor: '#0f172a' }}></div>
                                                        ) : (
                                                            <span style={{ fontWeight: '600', color: '#3b82f6', fontSize: '0.9rem' }}>{item.student}</span>
                                                        )}
                                                    </div>

                                                    {/* Pro */}
                                                    <div style={{
                                                        padding: '16px',
                                                        display: 'flex',
                                                        justifyContent: 'center',
                                                        alignItems: 'center',
                                                        backgroundColor: 'rgba(99, 102, 241, 0.04)',
                                                        borderBottom: '1px solid rgba(99, 102, 241, 0.08)' // Subtle purple separator
                                                    }}>
                                                        {item.pro === true ? (
                                                            <div style={{ background: '#e0e7ff', borderRadius: '50%', padding: '2px' }}><Check size={18} color="#6366f1" strokeWidth={3} /></div>
                                                        ) : item.pro === false ? (
                                                            <div style={{ width: '8px', height: '2px', backgroundColor: '#e2e8f0' }}></div>
                                                        ) : (
                                                            <span style={{ fontWeight: '700', color: '#6366f1', fontSize: '0.95rem' }}>{item.pro}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                    </div>
                </div>
            </DashboardLayout>
        </>
    )
}
