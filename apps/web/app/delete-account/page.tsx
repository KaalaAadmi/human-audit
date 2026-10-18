export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-[#121316] text-[#E4E4E7] py-16 px-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-extrabold text-white mb-6">Delete Your Account</h1>
      <div className="space-y-4 text-sm text-[#CBD5E1] leading-relaxed">
        <p>Open the HumanAudit app, go to <strong>System</strong> (Settings) and tap <strong>Delete account</strong>. This permanently removes your profile, food and water logs, workouts, vitals and custom foods/recipes, and closes your sign-in account.</p>
        <p>If you cannot access the app, email dev@humanaudit.app from your registered address and we will delete your data.</p>
      </div>
    </div>
  );
}
