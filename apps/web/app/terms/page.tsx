export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#121316] text-[#E4E4E7] py-16 px-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-extrabold text-white mb-6">Terms of Service</h1>
      <div className="space-y-6 text-sm text-[#CBD5E1] leading-relaxed">
        <section>
          <h2 className="text-lg font-bold text-white mb-2">1. Not medical advice</h2>
          <p>HumanAudit provides wellness and nutrition tracking. Scores, estimates and AI-generated nutrition values are informational only and are not medical advice. Consult a professional before changing your diet or training.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-white mb-2">2. Your account</h2>
          <p>You are responsible for activity on your account. You can delete your account and all associated data at any time from Settings or on the account deletion page.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-white mb-2">3. Third-party data</h2>
          <p>Food data comes from Open Food Facts and USDA FoodData Central and may be incomplete or inaccurate. Verify values against product labels.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-white mb-2">4. Shared content</h2>
          <p>Foods and recipes you create are shared with all users, and recipes show your display name. Only share content you have the right to share, and nothing unlawful, offensive or misleading. Users can report items; an item that is reported by several users is hidden, and we may remove content or accounts that break these terms.</p>
        </section>
      </div>
    </div>
  );
}
