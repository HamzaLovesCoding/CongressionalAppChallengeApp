// Privacy Policy and Terms, version-controlled. Written from docs/lane/07-data-and-vendor-inventory.md
// (what the code actually stores and sends); scripts/legal.test.mjs checks the two stay in step.
// Operator, contact and effective date supplied by the owner on October 18, 2026.
// Remaining policy decisions still need owner/legal review.

export type LegalSection = { heading: string; body: string[] };
export type LegalDocument = { id: 'privacy' | 'terms'; title: string; version: string; effective: string; sections: LegalSection[] };

export const LEGAL_OWNER = {
  operator: 'Hamza Wadera',
  contact: 'Contact: hamza.w.3790@gmail.com.',
  effective: 'October 18, 2026',
};

export const PRIVACY: LegalDocument = {
  id: 'privacy', title: 'Privacy Policy', version: '1.1', effective: LEGAL_OWNER.effective,
  sections: [
    { heading: 'Who this covers', body: [`This policy describes what the Lane app stores and sends. Lane is operated by ${LEGAL_OWNER.operator}.`] },
    { heading: 'What stays on your device', body: [
      'Lane keeps your learning progress in your browser’s storage on this device: which lessons you completed, your answers and how long they took, how much of each lesson video you watched, XP, streak days, your daily goal, liked and saved lessons, the cars you unlocked and selected, your Review later list, topic practice records, and practice scenario results.',
      'If you add them, it also keeps your permit test date and username, plus the main goal you chose when you started (with any words you typed for it) and when you agreed to these terms. The main goal stays on this device.',
      'Lesson videos you finish may be saved in the browser’s cache so they can play offline.',
    ] },
    { heading: 'What Lane does not collect', body: [
      'Lane does not ask for your real name, email, phone number, address or school. It does not use your location, camera, microphone or contacts. It has no advertising, no analytics and no error-reporting service.',
    ] },
    { heading: 'Syncing (only when it is turned on)', body: [
      'Settings shows whether your progress is backed up. Until backup is turned on, your progress stays on this device.',
      'When backup is on, Lane creates an anonymous account with Supabase (a database hosting provider) and sends a copy of your learning records to it: your selected car, the days you practiced, permit test date, daily goal, lesson progress and video watch coverage, quiz answers and timing, practice scenario results, topic records and Review later list. If you choose a username, it is stored there too. XP for leaderboards is calculated by the server from completed lessons. Likes, saves and car purchases are not sent.',
      'A sign-in token for that anonymous account is kept on this device so it can sync again later.',
      'Like any hosting provider, Supabase may process technical information such as your IP address to deliver the service.',
    ] },
    { heading: 'Leaderboards and groups', body: [
      'Leaderboards work when backup is on. Once you have earned XP in a week, other learners see you on the global weekly leaderboard with your selected car and that week’s XP. You choose a username when you start, and it is shown there; if your account has none (for example, someone else claimed it first), you appear as Anonymous. Don’t use your real name.',
      'You can make a group leaderboard, which gives you a 6-character code, or join one by typing a friend’s code. Lane has no search or list of groups, and a username is needed to make or join one. Members of a group see each other’s username, selected car and that week’s XP. You can leave a group at any time; the last member to leave deletes it.',
    ] },
    { heading: 'Driver coach (AI)', body: [
      'The driver coach on Practice is an AI. It works only when backup is on. When you ask it something, Lane sends your question, along with the last few questions and answers from the same chat, through Lane’s server to Anthropic, the company that makes the Claude AI model, which writes the answer. Anthropic receives a one-way code made from your anonymous account instead of the account itself, so misuse can be stopped without identifying you.',
      'Lane doesn’t store your questions or the coach’s answers. The chat stays in the app only until you start a new chat or close or reload Lane. Lane’s server counts how many questions each account asks per day, to apply the daily limit, and deletes those counts after a week.',
      'Anthropic uses the conversation to write the answer. Under its commercial terms it doesn’t train its AI models on it, and it deletes it within 30 days unless it must keep it longer to enforce its usage policy or the law.',
      'Don’t type personal details such as your full name, address, school or phone number into the coach.',
    ] },
    { heading: 'Links and sharing', body: [
      'Each lesson links to its original video on YouTube. Opening that link takes you to YouTube, whose own privacy policy applies. The Share button uses your device’s share sheet or copies a lesson link; Lane does not see what you share or with whom.',
    ] },
    { heading: 'Your choices', body: [
      'You can change or clear your permit test date and username at any time in Settings. You can remove all progress on this device by clearing this site’s data in your browser settings.',
      'When backup is on, Settings includes Delete backed-up data, which removes your learning records, and group memberships from the server. To remove the anonymous account itself or ask about your data, use the contact below.',
    ] },
    { heading: 'Teens and families', body: [
      'Lane is designed for teens preparing for a learner’s permit. The age policy and any parent or guardian consent process will be set by the operator before public release.',
    ] },
    { heading: 'Security and retention', body: [
      'Server data is protected by access rules that let each learner read only their own records; group members see only the details listed above. No system is perfectly secure. How long backed-up data is kept will be stated here before public release.',
    ] },
    { heading: 'Changes and contact', body: [
      'If this policy changes, the version and effective date above will change too.',
      LEGAL_OWNER.contact,
    ] },
  ],
};

export const TERMS: LegalDocument = {
  id: 'terms', title: 'Terms of Service', version: '1.1', effective: LEGAL_OWNER.effective,
  sections: [
    { heading: 'Using Lane', body: [`By using Lane you agree to these terms. Lane is operated by ${LEGAL_OWNER.operator}.`] },
    { heading: 'What Lane is', body: [
      'Lane is a supplemental learning app about California driving rules. It is not affiliated with or endorsed by the California DMV. It is not driver training, legal advice, a certification of driving ability or a guarantee that you will pass any test. Labels such as “Permit Test Ready” or “Highway Confident” describe your practice in Lane. They can’t predict a test result or show that you’re ready to drive. Always follow the official California Driver’s Handbook, the law and your supervising driver.',
      'Some lesson questions and practice scenarios are still awaiting review against the handbook.',
    ] },
    { heading: 'Safety', body: [
      'Never use Lane while driving or while supervising a driver. Lane is not an emergency service. In an emergency, call 911.',
    ] },
    { heading: 'Driver coach (AI)', body: [
      'The driver coach is an AI tool for learning. Its answers are based on the California Driver’s Handbook but can be wrong or incomplete, so check the handbook pages it shows. It isn’t legal advice or driving instruction, and it can’t tell you that you’re ready to drive or will pass a test.',
      'Ask it about driving only, don’t try to make it say harmful things, and don’t share personal details with it. Questions are limited each day, and the coach may sometimes be unavailable.',
    ] },
    { heading: 'Fair use', body: [
      'Don’t try to change XP, streaks or leaderboard results by tampering with the app, its storage or its server, and don’t interfere with the service or other learners. Usernames must not be offensive, include personal information or impersonate someone. Only share a group code with people you know.',
    ] },
    { heading: 'Content and credits', body: [
      'Lesson videos come from their original creators and are listed in Credits & sources with links to the originals. Where a video differs from California law, the lesson’s California rule applies. If you believe content in Lane infringes your rights, use the contact below and it will be reviewed.',
    ] },
    { heading: 'Availability', body: [
      'Lane may change, pause or stop. Offline use, video playback and syncing can vary by device and connection. Progress kept only on your device can be lost if the browser’s data is cleared.',
    ] },
    { heading: 'Privacy', body: ['The Privacy Policy explains what Lane stores and sends.'] },
    { heading: 'Changes, law and contact', body: [
      'If these terms change, the version and effective date above will change too. Governing law and any limitation of liability will be added after legal review, before public release.',
      LEGAL_OWNER.contact,
    ] },
  ],
};
