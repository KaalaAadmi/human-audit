import Link from 'next/link';

  export default function LandingPage() {
    return (
      <main className="min-h-screen bg-[#121316] text-[#E4E4E7] flex flex-col justify-between selection:bg-[#34D399] selection:text-black">
        {/* Navigation */}
        <header className="px-6 py-6 max-w-6xl mx-auto w-full flex justify-between items-center border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#8B5CF6] to-[#34D399] flex items-center justify-center font-bold text-xs text-black">
              HA
            </div>
            <span className="font-bold text-lg tracking-tight text-white">HumanAudit</span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-[#84858E]">
            <Link href="#features" className="hover:text-white transition">Features</Link>
            <Link href="#pricing" className="hover:text-white transition">Pricing</Link>
            <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
          </nav>
        </header>

        {/* Hero Section */}
        <section className="px-6 py-20 max-w-4xl mx-auto text-center flex flex-col items-center">
          <div className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold uppercase tracking-wider text-[#6EE7B7] mb-6">
            Zero Monthly Subscriptions
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
            Because your biological age is <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C084FC] via-[#38BDF8] to-[#34D399]">
              currently judging your life choices.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-[#84858E] max-w-2xl mb-10 leading-relaxed">
            Whoop-grade recovery and heart rate zones, MyFitnessPal macro counting, and Waterlogged hydration tracking. All in one mellow, unified operating system.
          </p>

          {/* Store Download Badges */}
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="px-6 py-3 rounded-xl bg-[#1C1E24] border border-white/10 hover:border-white/20 transition flex items-center gap-3 cursor-pointer">
              <span className="text-2xl"></span>
              <div className="text-left">
                <div className="text-[10px] text-[#84858E] uppercase tracking-wider">Download on the</div>
                <div className="text-sm font-bold text-white">App Store</div>
              </div>
            </div>
            <div className="px-6 py-3 rounded-xl bg-[#1C1E24] border border-white/10 hover:border-white/20 transition flex items-center gap-3 cursor-pointer">
              <span className="text-2xl">▶</span>
              <div className="text-left">
                <div className="text-[10px] text-[#84858E] uppercase tracking-wider">Get it on</div>
                <div className="text-sm font-bold text-white">Google Play</div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="px-6 py-16 max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-[#1C1E24] border border-white/5">
            <div className="text-2xl mb-3">⚡</div>
            <h3 className="text-base font-bold text-white mb-2">Readiness & Day Strain</h3>
            <p className="text-sm text-[#84858E]">
              Daily cardiovascular strain from 0 to 21 with Karvonen HR zones (1-5) and recovery readiness scores.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-[#1C1E24] border border-white/5">
            <div className="text-2xl mb-3">🥗</div>
            <h3 className="text-base font-bold text-white mb-2">Macro Counting & Recipes</h3>
            <p className="text-sm text-[#84858E]">
              Barcode scanning with Open Food Facts, USDA generic foods, custom recipes, and day-of-week custom gram targets.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-[#1C1E24] border border-white/5">
            <div className="text-2xl mb-3">🧬</div>
            <h3 className="text-base font-bold text-white mb-2">Luminous Body Age</h3>
            <p className="text-sm text-[#84858E]">
              3D breathing bio-orb tracking your biological rejuvenation trajectory over 12 weeks against your actual age.
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-8 border-t border-white/5 text-center text-xs text-[#63646C]">
          &copy; {new Date().getFullYear()} HumanAudit. All rights reserved. • <Link href="/privacy" className="hover:underline">Privacy Policy</Link> • <Link href="/terms" className="hover:underline">Terms of Service</Link>
        </footer>
      </main>
    );
  }