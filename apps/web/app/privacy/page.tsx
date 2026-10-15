export default function PrivacyPage() {
    return (
      <div className="min-h-screen bg-[#121316] text-[#E4E4E7] py-16 px-6 max-w-3xl mx-auto">
        <h1 className="text-3xl font-extrabold text-white mb-6">Privacy Policy</h1>
        <p className="text-sm text-[#84858E] mb-4">Last Updated: October 2026</p>

        <div className="space-y-6 text-sm text-[#CBD5E1] leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-2">1. Health Data & Privacy First</h2>
            <p>
              HumanAudit reads and writes health records (steps, workouts, heart rate, sleep) via Apple HealthKit and Google Health Connect. We do not sell, rent, or monetize your health data to any advertising or third-party br
  okers.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-white mb-2">2. Data Isolation & Security</h2>
            <p>
              All data stored in our cloud backend is encrypted in transit and at rest. Strict Row-Level Security (RLS) ensures only authenticated users can access their personal metrics.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-white mb-2">3. Account & Data Deletion</h2>
            <p>
              You may permanently delete your account and all associated health records at any time from within the app settings or via our account deletion portal.
            </p>
          </section>
        </div>
      </div>
    );
  }