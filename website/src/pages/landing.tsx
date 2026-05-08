import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SphereCanvas from '@/components/SpherCanvas';
import {
  Zap,
  Clock,
  Search,
  FolderX,
  Archive,
  LineChart,
  Printer,
  FileText,
  ListOrdered,
  ReceiptText,
  HardDrive,
  Mail,
  MapPin,
  ChevronRight,
  Target,
  Heart,
  Users,
  UserPlus,
  GraduationCap,
  School,
  CheckCircle,
  XCircle,
  BarChart3,
  Settings,
  Lock,
  Cpu,
  Database,
  Activity,
  BookMarked,
  Menu,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const FADE_UP = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } }
};

const FADE_IN = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } }
};

const STAGGER = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } }
};

const SLIDE_LEFT = {
  hidden: { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } }
};

const SLIDE_RIGHT = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } }
};

const SCALE_IN = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } }
};

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Benefits', href: '#benefits' },
  { label: 'About Us', href: '#about' },
];

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menu on resize to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMenuOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden selection:bg-primary/20 selection:text-primary">

      {/* ── Navigation ─────────────────────────────────────── */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-background/95 backdrop-blur-lg border-b border-border/40 py-3' : 'bg-transparent py-5'}`}>
        <div className="container mx-auto px-5 flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2">
            <img src="/logo.svg" alt="FeesFoundry" className="h-10 w-auto" />
            <span className={`font-bold text-xl tracking-tight ${scrolled ? 'text-foreground' : 'text-white'}`}>Fees<span className={`font-normal ${scrolled ? 'text-foreground' : 'text-white'}`}>Foundry</span></span>
          </a>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            {NAV_LINKS.map(({ label, href }) => (
              <a key={label} href={href} className={`transition-colors duration-300 hover:text-primary ${scrolled ? 'text-foreground' : 'text-white/90'}`}>{label}</a>
            ))}
            <a href="#contact" className="bg-primary text-white px-5 py-2.5 rounded-full hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.5)]">
              Request a Demo
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(o => !o)}
            className={`md:hidden p-2 rounded-lg transition-colors ${scrolled ? 'text-foreground hover:bg-border/30' : 'text-white hover:bg-white/10'}`}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile drawer */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="md:hidden bg-background/98 backdrop-blur-xl border-b border-border/40 px-5 py-6 flex flex-col gap-1"
            >
              {NAV_LINKS.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  onClick={closeMenu}
                  className="text-foreground/80 hover:text-primary font-medium py-3 px-3 rounded-xl hover:bg-primary/5 transition-colors text-base"
                >
                  {label}
                </a>
              ))}
              <a
                href="#contact"
                onClick={closeMenu}
                className="mt-3 bg-primary text-white px-5 py-3 rounded-full font-bold text-center hover:bg-primary/90 transition-all"
              >
                Request a Demo
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-[#0A0D14] pt-20">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[radial-gradient(circle,rgba(249,115,22,0.13),transparent_70%)] pointer-events-none" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(249,115,22,0.05),transparent_70%)] pointer-events-none" />

        <div className="container mx-auto px-5 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center py-16 min-h-[calc(100vh-5rem)]">

            {/* Left copy */}
            <motion.div initial="hidden" animate="visible" variants={STAGGER} className="flex flex-col justify-center">
              <motion.div variants={FADE_UP} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary mb-7 font-mono text-xs sm:text-sm w-fit">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
                School Fees Management. Built for African Schools.
              </motion.div>

              <motion.h1 variants={FADE_UP} className="text-4xl sm:text-5xl md:text-6xl xl:text-7xl font-bold tracking-tighter text-white mb-5 leading-[1.05]">
                Stop Drowning in{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-400">
                  School Fees Paperwork
                </span>
              </motion.h1>

              <motion.p variants={FADE_UP} className="text-base sm:text-lg text-gray-400 mb-4 max-w-xl leading-relaxed">
                Replace your receipt books and filing cabinets with a simple desktop system. Pull up any student's full school fees history in seconds and record a payment, no digging, no delays.
              </motion.p>

              <motion.div variants={FADE_UP} className="inline-flex items-center gap-2 mb-9 text-sm text-gray-500">
                <Cpu className="w-4 h-4 text-primary flex-shrink-0" />
                <span>Lightweight desktop app. Runs on any computer that can run Chrome.</span>
              </motion.div>

              <motion.div variants={FADE_UP} className="flex flex-col sm:flex-row gap-3 mb-12">
                <motion.a
                  href="#contact"
                  data-testid="link-hero-cta"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-7 py-4 bg-primary text-white rounded-full font-bold text-base sm:text-lg hover:bg-primary/90 transition-all shadow-[0_0_30px_rgba(249,115,22,0.4)] text-center"
                >
                  Request a Demo
                </motion.a>
                <motion.a
                  href="#features"
                  data-testid="link-hero-learn-more"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-7 py-4 bg-white/5 hover:bg-white/10 text-white rounded-full font-bold text-base sm:text-lg border border-white/10 transition-all text-center"
                >
                  See How It Works
                </motion.a>
              </motion.div>

              <motion.div variants={FADE_UP} className="grid grid-cols-3 gap-4 pt-7 border-t border-white/10">
                {[
                  ['90%', 'Less Admin Time'],
                  ['One-Click', 'Backup'],
                  ['Instant', 'Statements'],
                ].map(([stat, label], i) => (
                  <div key={i} className="flex flex-col">
                    <span className="text-xl sm:text-2xl md:text-3xl font-bold text-white font-mono">{stat}</span>
                    <span className="text-xs text-gray-500 mt-1">{label}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right sphere — desktop only */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.3 }}
              className="relative hidden lg:flex items-center justify-center h-[580px]"
            >
              <div className="w-[480px] h-[480px]">
                <SphereCanvas />
              </div>

              <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.6 }}
                whileHover={{ scale: 1.05, y: -2 }}
                className="absolute top-6 left-0 bg-white/6 backdrop-blur-md border border-white/10 rounded-2xl px-5 py-4 shadow-xl cursor-default"
              >
                <div className="flex items-center gap-2 mb-1">
                  <ReceiptText className="w-4 h-4 text-primary" />
                  <p className="text-primary font-bold font-mono text-sm">Record + Print</p>
                </div>
                <p className="text-gray-400 text-xs">Payment recorded. Receipt printed.</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.1, duration: 0.6 }}
                whileHover={{ scale: 1.05, x: 2 }}
                className="absolute top-[28%] right-0 bg-white/6 backdrop-blur-md border border-white/10 rounded-2xl px-5 py-4 shadow-xl cursor-default"
              >
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-primary" />
                  <p className="text-primary font-bold font-mono text-sm">Statements</p>
                </div>
                <p className="text-gray-400 text-xs">Student, grade and school level</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.3, duration: 0.6 }}
                whileHover={{ scale: 1.05, y: 2 }}
                className="absolute bottom-10 left-2 bg-primary/10 backdrop-blur-md border border-primary/20 rounded-2xl px-5 py-4 shadow-xl cursor-default"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Cpu className="w-4 h-4 text-primary" />
                  <p className="text-primary font-bold font-mono text-sm">Lightweight</p>
                </div>
                <p className="text-gray-400 text-xs">Works on any PC that runs Chrome</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.5, duration: 0.6 }}
                whileHover={{ scale: 1.05, x: 2 }}
                className="absolute bottom-[28%] right-0 bg-white/6 backdrop-blur-md border border-white/10 rounded-2xl px-5 py-4 shadow-xl cursor-default"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Database className="w-4 h-4 text-primary" />
                  <p className="text-primary font-bold font-mono text-sm">Full Data Control</p>
                </div>
                <p className="text-gray-400 text-xs">Offline. Yours. Always backed up.</p>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Lightweight callout strip (right after hero) ──── */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={FADE_IN}
        className="bg-primary py-8 sm:py-10"
      >
        <div className="container mx-auto px-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
                <Cpu className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-lg sm:text-xl">Lightweight. No Server. No Internet Required.</p>
                <p className="text-white/70 text-sm mt-0.5">Built with Electron. If your computer can run Chrome, it can run FeesFoundry.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm text-white/80 font-medium">
              {['Works Offline', 'One-Off Payment', 'No Subscription', 'Full Data Ownership'].map(tag => (
                <span key={tag} className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full">
                  <CheckCircle className="w-3.5 h-3.5 text-white flex-shrink-0" /> {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── Pain Points ────────────────────────────────────── */}
      <section id="problems" className="py-20 sm:py-32 bg-foreground text-white relative">
        <div className="container mx-auto px-5">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={FADE_UP} className="mb-14 sm:mb-20 text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-5">Still Running on <span className="text-primary">Paper and Receipt Books?</span></h2>
            <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto">You are not alone. Most schools in the region are. But the daily cost is real.</p>
          </motion.div>

          <div className="max-w-5xl mx-auto">
            {[
              {
                icon: Clock,
                title: 'Every Parent Query Means Digging',
                desc: 'When a parent comes in asking what their child owes in school fees, you have to stop everything and go through the receipt books by hand. One parent is manageable. Ten in a week is exhausting.'
              },
              {
                icon: Search,
                title: 'Paper Does Not Scale',
                desc: 'When you have a few dozen students, paper works. When you have hundreds, keeping track of who has paid their school fees and who still owes becomes a full-time job on its own.'
              },
              {
                icon: FolderX,
                title: 'A Lost Book Means Lost Records',
                desc: 'One misplaced receipt book and those school fees records are gone for good. No way to recover them, no backup, no proof of payment. The student and the school both lose.'
              },
              {
                icon: Archive,
                title: 'Filing Cabinets Are Slow and Unreliable',
                desc: 'Physical files take up space and demand constant upkeep. Papers get misfiled, folders go missing, and navigating the cabinet to find one school fees record wastes precious time.'
              },
              {
                icon: LineChart,
                title: 'No Clear Picture of Where Things Stand',
                desc: 'How much school fees has been collected this term? Which grade has the most outstanding balances? Without spending days counting manually, you simply cannot know.'
              },
              {
                icon: Printer,
                title: 'Statements Are a Headache to Produce',
                desc: 'When a parent needs a full school fees account statement, you have to go through every entry and write it out or type it up from scratch. One statement can take the better part of an afternoon.'
              }
            ].map((point, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className={`flex flex-col ${i % 2 !== 0 ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-6 sm:gap-8 mb-12 sm:mb-16`}
              >
                <div className="flex-1 w-full">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 border border-primary/20 ${i % 2 !== 0 ? 'md:ml-auto' : ''}`}
                  >
                    <point.icon className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                  </motion.div>
                  <h3 className={`text-xl sm:text-2xl font-bold mb-3 ${i % 2 !== 0 ? 'md:text-right' : ''}`}>{point.title}</h3>
                  <p className={`text-gray-400 text-base sm:text-lg leading-relaxed ${i % 2 !== 0 ? 'md:text-right' : ''}`}>{point.desc}</p>
                </div>
                <div className="flex-1 hidden md:block">
                  <div className="text-[10rem] lg:text-[15rem] font-bold text-white/5 font-mono leading-none select-none text-center">
                    0{i + 1}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section id="features" className="py-20 sm:py-32 bg-background">
        <div className="container mx-auto px-5">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP} className="mb-14 sm:mb-20 max-w-3xl">
            <span className="text-primary font-mono text-sm font-bold uppercase tracking-wider">Everything Included</span>
            <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight mt-3 mb-5">
              Every Tool Your Office Staff <span className="text-primary">Actually Needs</span>
            </h2>
            <p className="text-gray-600 text-base sm:text-lg">
              FeesFoundry is purpose-built for primary and high schools. Every feature below is included out of the box, with detailed documentation so office staff can learn and resolve issues on their own.
            </p>
          </motion.div>

          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mb-4 sm:mb-5">
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={SCALE_IN}
              whileHover={{ y: -4, boxShadow: '0 20px 40px rgba(249,115,22,0.1)' }}
              className="md:col-span-2 bg-foreground text-white rounded-3xl p-7 sm:p-8 relative overflow-hidden group transition-all duration-300"
            >
              <div className="absolute -top-8 -right-8 w-48 h-48 bg-primary/10 rounded-full group-hover:bg-primary/15 transition-colors" />
              <div className="absolute -bottom-16 -left-8 w-64 h-64 bg-primary/5 rounded-full" />
              <div className="relative z-10">
                <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center mb-6">
                  <ReceiptText className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold mb-3">Record Payments and Print Receipts</h3>
                <p className="text-gray-400 text-base sm:text-lg leading-relaxed max-w-lg">
                  Record a school fees payment in seconds and print a professional receipt on the spot. No handwriting, no retyping. Accurate, consistent, and immediate every single time.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={SCALE_IN}
              whileHover={{ y: -4 }}
              className="bg-primary text-white rounded-3xl p-7 sm:p-8 flex flex-col justify-between transition-all duration-300"
            >
              <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center mb-6">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-bold mb-3">Secure Login</h3>
                <p className="text-white/75 leading-relaxed text-sm sm:text-base">
                  100% protected with user authentication. Only authorised office staff can access school fees records.
                </p>
              </div>
            </motion.div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mb-4 sm:mb-5">
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={SCALE_IN}
              whileHover={{ y: -4 }}
              className="bg-white border border-border rounded-3xl p-7 sm:p-8 flex flex-col justify-between shadow-sm transition-all duration-300 group"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold mb-2">Unlimited Office Staff Accounts</h3>
                <p className="text-gray-600 text-sm leading-relaxed">One admin account with the ability to add unlimited office staff users. Each with their own login and access level.</p>
              </div>
            </motion.div>

            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={SCALE_IN}
              whileHover={{ y: -4, boxShadow: '0 20px 40px rgba(0,0,0,0.08)' }}
              className="md:col-span-2 bg-white border border-border rounded-3xl p-7 sm:p-8 relative overflow-hidden shadow-sm transition-all duration-300 group"
            >
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <FileText className="w-48 h-48 text-primary" />
              </div>
              <div className="relative z-10">
                <div className="flex flex-wrap gap-2 sm:gap-3 mb-5">
                  {[
                    { icon: FileText, label: 'Student Statement' },
                    { icon: GraduationCap, label: 'Grade Statement' },
                    { icon: School, label: 'School Statement' },
                  ].map(({ icon: Icon, label }) => (
                    <span key={label} className="flex items-center gap-2 bg-orange-50 text-primary px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold border border-primary/15">
                      <Icon className="w-3.5 h-3.5" /> {label}
                    </span>
                  ))}
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-3">Print Statements at Every Level</h3>
                <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                  Generate and print a full school fees account statement for any individual student, an entire grade, or the whole school. Formatted, professional, and ready in one click.
                </p>
              </div>
            </motion.div>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mb-4 sm:mb-5">
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={SCALE_IN}
              whileHover={{ y: -4 }}
              className="bg-foreground text-white rounded-3xl p-7 sm:p-8 flex flex-col justify-between transition-all duration-300"
            >
              <div className="w-12 h-12 bg-red-500/15 rounded-2xl flex items-center justify-center mb-6">
                <XCircle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold mb-2">Students Owing</h3>
                <p className="text-gray-400 text-sm leading-relaxed">Instantly see every student who still owes school fees, filtered by school, grade, or individually. Print the list in one click.</p>
              </div>
            </motion.div>

            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={SCALE_IN}
              whileHover={{ y: -4 }}
              className="bg-foreground text-white rounded-3xl p-7 sm:p-8 flex flex-col justify-between transition-all duration-300"
            >
              <div className="w-12 h-12 bg-green-500/15 rounded-2xl flex items-center justify-center mb-6">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold mb-2">Students Fully Paid</h3>
                <p className="text-gray-400 text-sm leading-relaxed">See every student whose school fees are fully cleared. Filter by grade or view school-wide at a glance.</p>
              </div>
            </motion.div>

            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={SCALE_IN}
              whileHover={{ y: -4, boxShadow: '0 20px 40px rgba(249,115,22,0.1)' }}
              className="bg-primary text-white rounded-3xl p-7 sm:p-8 flex flex-col justify-between transition-all duration-300 relative overflow-hidden group"
            >
              <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-white/5 rounded-full group-hover:bg-white/10 transition-colors" />
              <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center mb-6">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div className="relative z-10">
                <h3 className="text-lg sm:text-xl font-bold mb-2">Analytics Dashboard</h3>
                <p className="text-white/75 text-sm leading-relaxed">See expected school fees vs what has been collected. Track recorded payments over time. Know your numbers without any manual counting.</p>
              </div>
            </motion.div>
          </div>

          {/* Row 4 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
            {[
              {
                icon: Activity,
                title: 'Activity Logs',
                desc: 'Every action recorded. Tamper-proof logs give you a full audit trail that cannot be manipulated.',
                dark: false
              },
              {
                icon: Settings,
                title: 'Configure Fee Structure',
                desc: 'Set up exactly what school fees apply per grade and term. Flexible to match your school\'s own structure.',
                dark: false
              },
              {
                icon: UserPlus,
                title: 'Add and Manage Students',
                desc: 'Enrol students and keep their records up to date. Works for both primary and high schools.',
                dark: false
              },
              {
                icon: BookMarked,
                title: 'Full Documentation',
                desc: 'Detailed guides for every feature so office staff can resolve issues and learn the system without needing support calls.',
                dark: true
              },
            ].map(({ icon: Icon, title, desc, dark }, i) => (
              <motion.div
                key={i}
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={SCALE_IN}
                whileHover={{ y: -4 }}
                className={`rounded-3xl p-6 sm:p-7 transition-all duration-300 group ${dark ? 'bg-foreground text-white' : 'bg-white border border-border shadow-sm'}`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-colors ${dark ? 'bg-primary/20' : 'bg-primary/10 group-hover:bg-primary/20'}`}>
                  <Icon className={`w-5 h-5 ${dark ? 'text-primary' : 'text-primary'}`} />
                </div>
                <h3 className={`text-base font-bold mb-2 ${dark ? 'text-white' : 'text-foreground'}`}>{title}</h3>
                <p className={`text-xs sm:text-sm leading-relaxed ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits / Comparison ──────────────────────────── */}
      <section id="benefits" className="py-20 sm:py-32 bg-foreground text-white">
        <div className="container mx-auto px-5">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP} className="text-center mb-14 sm:mb-20">
            <span className="text-primary font-mono text-sm font-bold uppercase tracking-wider">Side by Side</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-3">The Difference <span className="text-primary">Is Hard to Ignore</span></h2>
          </motion.div>

          <div className="max-w-4xl mx-auto border border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden bg-white/5 backdrop-blur-sm">
            <div className="grid grid-cols-12 bg-white/5 border-b border-white/10 p-4 sm:p-6 font-bold text-xs sm:text-sm text-gray-400 uppercase tracking-wider">
              <div className="col-span-6">Task</div>
              <div className="col-span-3 text-center">Old Way</div>
              <div className="col-span-3 text-center text-primary">With FeesFoundry</div>
            </div>

            {[
              ["Find a student's school fees history", '5+ minutes of searching', '3 seconds'],
              ['List students who owe school fees', 'Count and list by hand', 'One click'],
              ['Generate a school fees receipt', 'Write it out by hand', 'Auto-print'],
              ['Back up all school fees records', 'Impossible', 'One-click backup'],
              ['Move records to a new computer', 'Carry physical files, risk losing them', 'Copy a folder, done'],
            ].map(([task, before, after], i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="grid grid-cols-12 p-4 sm:p-6 border-b border-white/5 last:border-0 items-center hover:bg-white/5 transition-colors"
              >
                <div className="col-span-6 font-medium text-sm sm:text-base md:text-lg">{task}</div>
                <div className="col-span-3 text-center text-gray-500 text-xs sm:text-sm line-through decoration-red-500/50">{before}</div>
                <div className="col-span-3 text-center font-bold text-primary text-sm sm:text-lg md:text-xl font-mono">{after}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About Us ───────────────────────────────────────── */}
      <section id="about" className="py-20 sm:py-32 bg-background">
        <div className="container mx-auto px-5">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 sm:gap-16 items-center">
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={SLIDE_LEFT}>
                <span className="text-primary font-mono text-sm font-bold uppercase tracking-wider">About Us</span>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mt-3 mb-6">Built by People Who <span className="text-primary">Understand the Problem</span></h2>
                <p className="text-gray-600 text-base sm:text-lg leading-relaxed mb-5">
                  FeesFoundry is developed by <strong>Jiggabyte Technology Limited</strong>, a technology company based in Lusaka, Zambia. We build practical software for African institutions, tools that work in the real conditions schools face every day.
                </p>
                <p className="text-gray-600 text-base sm:text-lg leading-relaxed mb-8">
                  We know that most schools in the region run on paper, deal with unreliable internet, and do not have an IT department. FeesFoundry was designed with all of that in mind. A lightweight desktop app that works offline, is simple to use, and does not require ongoing subscriptions or technical support to maintain.
                </p>
                <div className="flex flex-col gap-4">
                  {[
                    { icon: MapPin, text: 'Based in Lusaka, Zambia. Serving schools across Southern Africa.' },
                    { icon: Target, text: 'Focused on practical tools that work without reliable internet.' },
                    { icon: Heart, text: 'Built with African school office staff in mind, from day one.' },
                  ].map(({ icon: Icon, text }, i) => (
                    <motion.div key={i} whileHover={{ x: 4 }} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <p className="text-gray-600 text-sm sm:text-base">{text}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={SLIDE_RIGHT}>
                <div className="bg-foreground rounded-3xl p-8 sm:p-10 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-7">
                      <img src="/logo.svg" alt="FeesFoundry" className="h-10 w-auto" />
                      <span className="text-xl sm:text-2xl font-bold text-white">Fees<span className="font-normal">Foundry</span></span>
                    </div>
                    <p className="text-gray-300 text-base sm:text-lg leading-relaxed mb-8 italic">
                      "We wanted to build something that office staff at a rural Zambian school could pick up and use on day one, without training, without internet, and without a monthly bill."
                    </p>
                    <div className="border-t border-white/10 pt-6">
                      <p className="text-primary font-bold">Jiggabyte Technology Limited</p>
                      <p className="text-gray-400 text-sm mt-1">Lusaka, Zambia</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA / Contact ──────────────────────────────────── */}
      <section id="contact" className="py-20 sm:py-32 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
        <div className="container mx-auto px-5 relative z-10">
          <div className="max-w-5xl mx-auto bg-white rounded-[2rem] sm:rounded-[3rem] p-8 sm:p-14 md:p-20 shadow-2xl flex flex-col md:flex-row gap-12 sm:gap-16 items-start md:items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={SLIDE_LEFT} className="flex-1">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-5">Ready to Make School Fees Admin Easy?</h2>
              <p className="text-lg sm:text-xl text-gray-600 mb-7">Get in touch and we will walk you through exactly how FeesFoundry works. No pressure, no commitment.</p>
              <div className="flex flex-col gap-3 text-sm text-gray-500 font-medium">
                {[
                  'One-off payment, no monthly subscription',
                  'Works offline. No internet needed.',
                  'Simple setup, no IT team required',
                  'Detailed documentation included',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs font-bold flex-shrink-0">✓</div>
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={SLIDE_RIGHT} className="flex-1 w-full">
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">School Name</label>
                    <Input data-testid="input-school-name" className="bg-gray-50 border-transparent focus-visible:ring-primary focus-visible:bg-white h-12" placeholder="Riverside High School" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Your Name</label>
                    <Input data-testid="input-your-name" className="bg-gray-50 border-transparent focus-visible:ring-primary focus-visible:bg-white h-12" placeholder="Themba Moyo" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Email Address</label>
                    <Input data-testid="input-email" type="email" className="bg-gray-50 border-transparent focus-visible:ring-primary focus-visible:bg-white h-12" placeholder="bursar@school.co.zm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Phone Number</label>
                    <Input data-testid="input-phone" className="bg-gray-50 border-transparent focus-visible:ring-primary focus-visible:bg-white h-12" placeholder="+260 97 123 4567" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Tell us about your school</label>
                  <Textarea data-testid="textarea-school-info" className="bg-gray-50 border-transparent focus-visible:ring-primary focus-visible:bg-white min-h-[110px] resize-none" placeholder="How many students do you have? What are you currently using to manage school fees?" />
                </div>
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                  <Button data-testid="button-submit-demo" className="w-full h-13 text-lg font-bold rounded-xl mt-3" size="lg">
                    Request a Demo
                  </Button>
                </motion.div>
                <p className="text-center text-xs text-gray-500 mt-3">
                  We will show you exactly how FeesFoundry works for your school.
                </p>
              </form>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="bg-[#05080F] text-gray-400 pt-14 pb-8 border-t border-white/5">
        <div className="container mx-auto px-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 mb-14">
            <div className="sm:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <img src="/logo.svg" alt="FeesFoundry" className="h-10 w-auto" />
                <span className="font-bold text-xl tracking-tight text-white">Fees<span className="font-normal">Foundry</span></span>
              </div>
              <p className="text-gray-400 leading-relaxed mb-5 max-w-xs text-sm">
                Forging a Stronger Financial Future for Schools. Simple, reliable school fees management software built for Southern African schools.
              </p>
              <div className="flex flex-col gap-3 text-sm">
                <a href="mailto:info@jiggabyte.co.zm" className="flex items-center gap-2 hover:text-primary transition-colors">
                  <Mail className="w-4 h-4 text-primary flex-shrink-0" />
                  info@jiggabyte.co.zm
                </a>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                  Lusaka, Zambia
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-5">Navigation</h4>
              <div className="flex flex-col gap-3 text-sm">
                {[
                  { label: 'Features', href: '#features' },
                  { label: 'Benefits', href: '#benefits' },
                  { label: 'About Us', href: '#about' },
                  { label: 'Request a Demo', href: '#contact' },
                ].map(({ label, href }) => (
                  <a key={label} href={href} className="hover:text-primary transition-colors flex items-center gap-1">
                    <ChevronRight className="w-3 h-3 text-primary" /> {label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-5">Company</h4>
              <div className="flex flex-col gap-3 text-sm">
                {[
                  { label: 'About Us', href: '#about' },
                  { label: 'Contact', href: '#contact' },
                ].map(({ label, href }) => (
                  <a key={label} href={href} className="hover:text-white transition-colors flex items-center gap-1">
                    <ChevronRight className="w-3 h-3 text-primary" /> {label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 pt-7 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-600">
            <p>&copy; {new Date().getFullYear()} FeesFoundry. All rights reserved.</p>
            <p>
              Developed by{' '}
              <span className="text-primary font-semibold">Jiggabyte Technology Limited</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
