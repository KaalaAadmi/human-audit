import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#0C0D10] text-[#E4E4E7] flex flex-col justify-between selection:bg-[#34D399] selection:text-black font-sans antialiased">
      {/* Precision Top Telemetry Header */}
      <header className="px-6 py-5 max-w-6xl mx-auto w-full flex justify-between items-center border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#14151B] border border-white/10 flex items-center justify-center font-mono font-extrabold text-xs text-[#34D399] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            HA
          </div>
          <span className="font-extrabold text-lg tracking-tight text-[#F4F4F5]">HumanAudit</span>
        </div>
        <nav className="flex items-center gap-6 text-xs font-mono uppercase tracking-wider text-[#71717A]">
          <Link href="#telemetry" className="hover:text-white transition">Telemetry</Link>
          <Link href="#savings" className="hover:text-white transition">Economics</Link>
          <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="px-6 pt-16 pb-20 max-w-4xl mx-auto text-center flex flex-col items-center">
        {/* Status Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#14151B] border border-white/10 text-[10px] font-mono font-bold uppercase tracking-widest text-[#34D399] mb-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] shadow-[0_0_6px_#34D399]"></span>
          Zero Recurring Subscriptions
        </div>

        {/* Luminous Multi-Layer Bio-Orb Simulation */}
        <div className="relative mb-8 flex items-center justify-center">
          <div className="w-32 h-32 rounded-full bg-[radial-gradient(circle_at_35%_30%,#F5D0FE,#C084FC_45%,#34D399_85%,#059669_100%)] shadow-[0_0_50px_rgba(192,132,252,0.35),0_0_20px_rgba(52,211,153,0.3),inset_-4px_-4px_12px_rgba(0,0,0,0.6),inset_4px_4px_10px_rgba(255,255,255,0.7)] animate-pulse"></div>
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-[#F4F4F5] mb-6 leading-tight">
          Because your biological age is <br className="hidden md:block"/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C084FC] via-[#7DD3FC] to-[#34D399]">
            currently judging your life choices.
          </span>
        </h1>
        <p className="text-base md:text-lg text-[#84858E] max-w-2xl mb-10 leading-relaxed font-normal">
          Whoop-grade recovery and heart rate reserve zones, MyFitnessPal macro counting, and Waterlogged hydration tracking. Unified into one zero-bloat, instrument-grade operating system.
        </p>

        {/* Store Download Badges */}
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="px-6 py-3 rounded-xl bg-[#14151B] border border-white/10 hover:border-white/20 transition flex items-center gap-3 cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <span className="text-2xl text-white"></span>
            <div className="text-left font-sans">
              <div className="text-[9px] text-[#71717A] font-mono uppercase tracking-widest">Download on the</div>
              <div className="text-sm font-extrabold text-white">App Store</div>
            </div>
          </div>
          <div className="px-6 py-3 rounded-xl bg-[#14151B] border border-white/10 hover:border-white/20 transition flex items-center gap-3 cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <span className="text-xl text-[#34D399]">▶</span>
            <div className="text-left font-sans">
              <div className="text-[9px] text-[#71717A] font-mono uppercase tracking-widest">Get it on</div>
              <div className="text-sm font-extrabold text-white">Google Play</div>
            </div>
          </div>
        </div>
      </section>

      {/* Telemetry Feature Cards (Zero AI Slop) */}
      <section id="telemetry" className="px-6 py-12 max-w-5xl mx-auto w-full grid md:grid-cols-3 gap-6">
        {/* Module 1: Recovery */}
        <div className="p-6 rounded-2xl bg-[#14151B] border border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#71717A]">Recovery Vitals</span>
            <span className="text-xs font-mono font-bold text-[#34D399] bg-[#34D399]/10 px-2 py-0.5 rounded">88% READINESS</span>
          </div>
          <h3 className="text-base font-bold text-[#F4F4F5] mb-2">Whoop-Grade Telemetry</h3>
          <p className="text-xs text-[#84858E] leading-relaxed mb-4">
            Continuous Day Strain (0–21), overnight HRV, resting heart rate dips, and Karvonen HR Reserve zones (1–5) aggregated from raw wearable samples.
          </p>
          <div className="p-3 rounded-xl bg-[#0F1015] border border-white/5 font-mono text-[10px] text-[#A1A1AA] flex justify-between">
            <span>HRV 64ms</span>
            <span>RHR 51 bpm</span>
            <span>Z3 16m</span>
          </div>
        </div>

        {/* Module 2: Nutrition */}
        <div className="p-6 rounded-2xl bg-[#14151B] border border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#71717A]">Nutrition Engine</span>
            <span className="text-xs font-mono font-bold text-[#FDA4AF] bg-[#FDA4AF]/10 px-2 py-0.5 rounded">MFP PREMIUM</span>
          </div>
          <h3 className="text-base font-bold text-[#F4F4F5] mb-2">Single-Day Focus</h3>
          <p className="text-xs text-[#84858E] leading-relaxed mb-4">
            USDA generic database, Open Food Facts barcode scanning, voice logging, and custom Day-of-Week gram targets without paid paywalls.
          </p>
          <div className="p-3 rounded-xl bg-[#0F1015] border border-white/5 font-mono text-[10px] text-[#A1A1AA] flex justify-between">
            <span className="text-[#FDA4AF]">P 142/180g</span>
            <span className="text-[#7DD3FC]">C 160/220g</span>
            <span className="text-[#FDE047]">F 45/65g</span>
          </div>
        </div>

        {/* Module 3: Body Age */}
        <div className="p-6 rounded-2xl bg-[#14151B] border border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#71717A]">Bio-Aging</span>
            <span className="text-xs font-mono font-bold text-[#C084FC] bg-[#C084FC]/10 px-2 py-0.5 rounded">24.2 YRS</span>
          </div>
          <h3 className="text-base font-bold text-[#F4F4F5] mb-2">Biological Trajectory</h3>
          <p className="text-xs text-[#84858E] leading-relaxed mb-4">
            Dynamic 3D breathing bio-orb tracking your biological rejuvenation trajectory over 12 weeks against your chronological baseline.
          </p>
          <div className="p-3 rounded-xl bg-[#0F1015] border border-white/5 font-mono text-[10px] text-[#34D399] flex justify-between">
            <span>↓ 3.8 Yrs Younger</span>
            <span className="text-[#71717A]">Actual: 28</span>
          </div>
        </div>
      </section>

      {/* Economics & Subscription Savings Calculator */}
      <section id="savings" className="px-6 py-12 max-w-4xl mx-auto w-full">
        <div className="p-8 rounded-3xl bg-[#14151B] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] text-center">
          <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#71717A] mb-2">Annualized Subscription Audit</div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#F4F4F5] mb-6">Stop paying $660/year for three separate apps.</h2>
          
          <div className="grid md:grid-cols-3 gap-4 mb-6 text-left">
            <div className="p-4 rounded-xl bg-[#0F1015] border border-white/5">
              <div className="text-xs text-[#71717A]">Whoop Membership</div>
              <div className="text-lg font-mono font-bold text-[#F87171]">$360 / yr</div>
            </div>
            <div className="p-4 rounded-xl bg-[#0F1015] border border-white/5">
              <div className="text-xs text-[#71717A]">MyFitnessPal Premium</div>
              <div className="text-lg font-mono font-bold text-[#F87171]">$240 / yr</div>
            </div>
            <div className="p-4 rounded-xl bg-[#0F1015] border border-white/5">
              <div className="text-xs text-[#71717A]">Waterlogged Pro</div>
              <div className="text-lg font-mono font-bold text-[#F87171]">$60 / yr</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#34D399]/10 border border-[#34D399]/30 flex flex-col md:flex-row justify-between items-center gap-2">
            <span className="font-bold text-sm text-[#F4F4F5]">HumanAudit Total Cost</span>
            <span className="font-mono font-extrabold text-xl text-[#34D399]">$0 / month • Free Forever</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-white/[0.06] text-center text-[11px] font-mono text-[#71717A]">
        &copy; {new Date().getFullYear()} HumanAudit &bull; Handcrafted Telemetry &bull; <Link href="/privacy" className="hover:text-white underline">Privacy</Link> &bull; <Link href="/terms" className="hover:text-white underline">Terms</Link>
      </footer>
    </main>
  );
}
