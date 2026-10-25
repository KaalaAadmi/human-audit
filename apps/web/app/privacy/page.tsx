export default function PrivacyPage() {
    return (
      <div className="min-h-screen bg-[#121316] text-[#E4E4E7] py-16 px-6 max-w-3xl mx-auto">
        <h1 className="text-3xl font-extrabold text-white mb-6">Privacy Policy</h1>
        <p className="text-sm text-[#84858E] mb-4">Last Updated: October 2026</p>

        <div className="space-y-6 text-sm text-[#CBD5E1] leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-2">1. Health Data & Privacy First</h2>
            <p>
              HumanAudit reads and writes health records (steps, workouts, heart rate, sleep) via Apple HealthKit and Google Health Connect. We do not sell, rent, or monetize your health data to any advertising or third-party brokers.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-white mb-2">Google Health data</h2>
            <p>
              If you connect your Google account, we request read-only access to your Google Health data: workouts and heart-rate zones, sleep sessions and stages, resting heart rate, heart rate variability, and weight. We use it only to show you your own workouts, sleep, recovery and strain inside HumanAudit.
              Your Google access tokens are stored encrypted. We do not share this data with third parties, and we do not use it for advertising or to train AI models.
              HumanAudit&apos;s use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.
              You can disconnect Google at any time from Manage data sources in the app, which stops syncing and revokes our access. Deleting your account removes all data we hold.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-white mb-2">Shared foods and recipes</h2>
            <p>
              Custom foods and recipes you create are visible to all HumanAudit users. A food is shown by its name only. A recipe is shown with your display name as its author. Do not put personal information in names or ingredients.
              You can delete your own items at any time, which removes them for everyone. Your health, workout, sleep and diary data is never shared.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-white mb-2">2. Data Isolation & Security</h2>
            <p>
              All data stored in our cloud backend is encrypted in transit and at rest. Every request is authenticated with your Clerk session, and the server only ever reads and writes the signed-in user's own records.
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