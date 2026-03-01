import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Brain, Zap, Shield, Heart, Activity, CheckCircle2, ChevronRight, Menu, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'
import LandingNavbar from '@/components/LandingNavbar'
import LandingFooter from '@/components/LandingFooter'

export default function LandingPage() {
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)

    // Check auth status
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard')
      }
      setIsLoggedIn(!!session)
    })

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  }

  const staggeredContainer = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  return (
    <div className="min-h-screen bg-[var(--cream-bg)] font-sans text-slate-900">
      <Head>
        <title>Vaidya AI - The Future of Medical Learning</title>
        <meta name="description" content="Advanced AI-powered platform for medical students and professionals." />
      </Head>

      {/* Navigation */}
      <LandingNavbar />


      {/* Hero Section - Premium Refined Layout */}
      <section className="pt-32 pb-24 px-6 relative overflow-hidden">
        {/* Artistic Background Layering */}
        <div className="absolute inset-0 -z-10 bg-[var(--cream-bg)]">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }}></div>

          <motion.div
            animate={{
              scale: [1, 1.15, 1],
              x: [0, 30, 0],
              y: [0, -20, 0]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-indigo-100/30 rounded-full blur-[120px]"
          />
          <motion.div
            animate={{
              scale: [1.15, 1, 1.15],
              x: [0, -30, 0],
              y: [0, 30, 0]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-orange-50/40 rounded-full blur-[100px]"
          />
        </div>

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center w-full">
          <motion.div
            initial="initial"
            animate="animate"
            variants={{
              animate: {
                transition: {
                  staggerChildren: 0.1,
                  delayChildren: 0.2
                }
              }
            }}
            className="flex flex-col items-center lg:items-start text-center lg:text-left pt-12 lg:pt-0"
          >
            {/* Intel Badge */}
            <motion.div
              variants={{
                initial: { opacity: 0, y: 15 },
                animate: { opacity: 1, y: 0 }
              }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex items-center gap-2 px-3.5 py-1 bg-white/60 backdrop-blur-md rounded-full border border-[var(--cream-accent)] mb-6 shadow-sm hover:shadow-md transition-all cursor-default"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-[var(--cream-text-muted)]">Intelligence v2.0 Live</span>
            </motion.div>

            {/* Main Heading */}
            <motion.h1
              variants={{
                initial: { opacity: 0, y: 20 },
                animate: { opacity: 1, y: 0 }
              }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="text-5xl md:text-6xl lg:text-[72px] font-black text-[var(--cream-text-main)] leading-[1.05] mb-6 tracking-tighter"
            >
              Master Medicine <br className="hidden md:block" />
              With <span className="text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 via-indigo-900 to-slate-900 font-black">Intelligence.</span>
            </motion.h1>

            {/* Description */}
            <motion.p
              variants={{
                initial: { opacity: 0, y: 15 },
                animate: { opacity: 1, y: 0 }
              }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-base md:text-lg text-[var(--cream-text-muted)] font-medium leading-[1.6] mb-10 max-w-lg lg:px-0"
            >
              Elevate your medical education with the world&apos;s most advanced AI clinical companion. Master complex cases, visualize concepts, and ace your exams.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={{
                initial: { opacity: 0, scale: 0.95, y: 10 },
                animate: { opacity: 1, scale: 1, y: 0 }
              }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 w-full"
            >
              <Link
                href="/login"
                className="w-full sm:w-auto bg-[var(--cream-text-main)] text-white px-9 py-3.5 rounded-2xl text-[15px] font-bold hover:bg-black transition-all shadow-xl hover:-translate-y-1 active:translate-y-0.5 flex items-center justify-center gap-3 group"
              >
                Start Studying Free
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="#features"
                className="w-full sm:w-auto bg-white text-[var(--cream-text-main)] border border-[var(--cream-accent)] px-9 py-3.5 rounded-2xl text-[15px] font-bold hover:bg-[var(--cream-accent-soft)] transition-all flex items-center justify-center gap-2 group"
              >
                Learn More
                <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          </motion.div>

          {/* Right Visual Asset */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
            className="hidden lg:block relative"
          >
            <div className="relative z-10 p-3 bg-white/20 backdrop-blur-3xl rounded-[40px] border border-white/30 shadow-2xl overflow-hidden group max-h-[70vh]">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none"></div>
              <img
                src="/hero-asset.png"
                alt="Vaidya AI Master Interface"
                className="w-full h-auto max-h-[65vh] object-cover rounded-[30px] shadow-2xl transition-transform duration-700 group-hover:scale-105"
              />
            </div>

            {/* Floating Decorative Elements */}
            <motion.div
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-6 -right-6 w-20 h-20 bg-orange-100 rounded-3xl blur-3xl opacity-60"
            ></motion.div>
            <motion.div
              animate={{ y: [0, 15, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute -bottom-6 -left-6 w-28 h-28 bg-indigo-100 rounded-full blur-3xl opacity-60"
            ></motion.div>
          </motion.div>
        </div>
      </section>

      {/* 1. Features Section */}
      <section id="features" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-[13px] font-bold text-indigo-600 uppercase tracking-[0.3em] mb-4">Powerful Features</h2>
            <h3 className="text-5xl font-extrabold text-[var(--cream-text-main)] tracking-tight">Intelligence built for clinical mastery.</h3>
          </div>

          <motion.div
            variants={staggeredContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 w-full"
          >
            {[
              {
                icon: <Activity size={28} />,
                title: "Clinical Cases",
                desc: "Sharpen diagnostic skills with adaptive simulators and step-by-step reasoning guides.",
                color: "bg-indigo-50 text-indigo-600",
                href: "/clinical"
              },
              {
                icon: <Brain size={28} />,
                title: "Concept Mapping",
                desc: "Visualize complex medical relationships with AI-generated interactive mind maps.",
                color: "bg-purple-50 text-purple-600",
                href: "/conceptmap"
              },
              {
                icon: <Zap size={28} />,
                title: "Question Bank",
                desc: "Access thousands of high-yield clinical scenarios for comprehensive exam preparation.",
                color: "bg-orange-50 text-orange-600",
                href: "/mcqs"
              },
              {
                icon: <Shield size={28} />,
                title: "Flashcards",
                desc: "Master long-term retention with AI-powered spaced repetition and key concept cards.",
                color: "bg-green-50 text-green-600",
                href: "/flashcards"
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                variants={fadeIn}
                className="group bg-white p-8 rounded-[40px] border border-[var(--cream-accent-soft)] shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 flex flex-col items-start"
              >
                <div className={`w-14 h-14 ${feature.color} rounded-2xl flex items-center justify-center mb-8 transition-transform group-hover:scale-110 group-hover:rotate-3`}>
                  {feature.icon}
                </div>
                <h4 className="text-xl font-extrabold text-[var(--cream-text-main)] mb-4">{feature.title}</h4>
                <p className="text-sm text-[var(--cream-text-muted)] font-medium leading-relaxed mb-8 flex-grow">{feature.desc}</p>
                <Link
                  href={isLoggedIn ? feature.href : "/login"}
                  className="inline-flex items-center gap-2 font-bold text-[var(--cream-text-main)] group-hover:gap-4 transition-all"
                >
                  Explore Tool <ChevronRight size={18} />
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 2. Methodology Section */}
      <section id="methodology" className="py-20 px-6 relative overflow-hidden bg-white/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-[13px] font-bold text-indigo-600 uppercase tracking-[0.3em] mb-4">Precision Engine</h2>
            <h3 className="text-5xl font-black text-[var(--cream-text-main)] tracking-tight">The Science of Precision.</h3>
            <p className="mt-4 text-lg text-[var(--cream-text-muted)] max-w-2xl mx-auto font-medium leading-relaxed">
              Vaidya AI utilizes a multi-layered clinical reasoning engine designed to mimic professional expertise.
            </p>
          </div>

          <div className="relative p-1 md:p-4 bg-white rounded-[40px] border border-slate-100 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.06)] overflow-hidden">
            {/* High-Tech Grid Background */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#4f46e5 1px, transparent 1px), linear-gradient(90deg, #4f46e5 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            {/* Neural Scanning Beam */}
            <motion.div
              animate={{ x: ['-20%', '120%'] }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 bottom-0 w-32 bg-gradient-to-r from-transparent via-indigo-50/50 to-transparent skew-x-12 z-0"
            />

            <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-50 relative z-10">
              {[
                {
                  title: "Evidence Ingestion",
                  desc: "We process millions of peer-reviewed articles and clinical guidelines in real-time.",
                  icon: <Shield className="text-indigo-600" size={28} />,
                  accent: "bg-indigo-50/50"
                },
                {
                  title: "Neural Analysis",
                  desc: "Our proprietary LLM architecture identifies complex clinical correlations instantly.",
                  icon: <Brain className="text-indigo-600" size={28} />,
                  accent: "bg-indigo-50/50"
                },
                {
                  title: "Clinical Validation",
                  desc: "Every output is cross-referenced against gold-standard medical benchmarks.",
                  icon: <CheckCircle2 className="text-indigo-600" size={28} />,
                  accent: "bg-indigo-50/50"
                }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="p-8 md:p-10 flex flex-col items-center text-center group"
                >
                  <div className="relative mb-6">
                    <motion.div
                      animate={{ opacity: [0.1, 0.2, 0.1] }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className="absolute -inset-6 bg-indigo-100 rounded-full blur-2xl"
                    />
                    <div className={`w-20 h-20 ${item.accent} rounded-[28px] flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:shadow-[0_15px_30px_-10px_rgba(79,70,229,0.15)] relative z-10 border border-indigo-100/50`}>
                      <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-40 rounded-[28px] transition-opacity duration-500"></div>
                      {item.icon}
                    </div>
                  </div>

                  <h4 className="text-xl font-black text-[var(--cream-text-main)] mb-4 tracking-tight group-hover:text-indigo-600 transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-sm text-[var(--cream-text-muted)] font-medium leading-relaxed max-w-[240px]">
                    {item.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Stats Section - About */}
      <section id="about" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-[13px] font-bold text-indigo-600 uppercase tracking-[0.3em] mb-4">Platform Stats</h2>
            <h3 className="text-5xl font-extrabold text-[var(--cream-text-main)] tracking-tight">Precision at the core of learning.</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Zap className="text-indigo-600" size={24} />,
                value: '99.9%',
                label: 'Clinical Accuracy',
                sub: 'AI-driven evidence retrieval'
              },
              {
                icon: <Activity className="text-indigo-600" size={24} />,
                value: '540B+',
                label: 'Model Parameters',
                sub: 'Trained on medical gold-standards'
              },
              {
                icon: <Brain className="text-indigo-600" size={24} />,
                value: '24/7',
                label: 'AI Assistance',
                sub: 'Instant clinical reasoning'
              }
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-10 rounded-[40px] border border-[var(--cream-accent-soft)] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group"
              >
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-8 transition-transform group-hover:scale-110 group-hover:rotate-6">
                  {stat.icon}
                </div>
                <p className="text-5xl font-black text-[var(--cream-text-main)] mb-2 tracking-tighter">{stat.value}</p>
                <p className="text-sm font-black text-[var(--cream-text-main)] uppercase tracking-[0.1em] mb-2">{stat.label}</p>
                <p className="text-[12px] font-medium text-[var(--cream-text-muted)]">{stat.sub}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-[var(--cream-text-main)] rounded-[60px] p-12 md:p-24 text-center relative overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)]">
            <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-8 tracking-tighter">
                Ready to transform your <br className="hidden md:block" /> medical education?
              </h2>
              <p className="text-xl text-gray-400 font-medium mb-12 max-w-2xl mx-auto leading-relaxed">
                Step into the future of clinical mastery. Vaidya AI is your partner in achieving academic and professional excellence.
              </p>
              <Link href="/login" className="inline-block bg-white text-[var(--cream-text-main)] px-12 py-5 rounded-[24px] text-xl font-black hover:bg-[var(--cream-accent)] transition-all shadow-2xl hover:-translate-y-1 active:translate-y-0">
                Create Free Account
              </Link>
            </motion.div>
          </div>
        </div>
      </section>
      <LandingFooter />
    </div>
  )
}
