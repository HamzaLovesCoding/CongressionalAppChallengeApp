// Privacy Policy and Terms, version-controlled. Written from docs/lane/07-data-and-vendor-inventory.md
// (what the code actually stores and sends); scripts/legal.test.mjs checks the two stay in step.
// Facts only the owner can supply (operator, contact, effective date, governing law, deletion
// timing) are shown as visible placeholders, never invented. Not legal advice; needs owner/legal review.

export type LegalSection = { heading: string; body: string[] };
export type LegalDocument = { id: 'privacy' | 'terms'; title: string; version: string; effective: string | null; sections: LegalSection[] };

export const OWNER_PLACEHOLDER = {
  operator: 'The Lane project team (legal operator name to be added before public release)',
  contact: 'Contact details will be added before public release.',
  effective: 'Effective date to be set before public release.',
};

export const PRIVACY: LegalDocument = {
  id: 'privacy', title: 'Privacy Policy', version: '0.1 (draft)', effective: null,
  sections: [
    { heading: 'Who this covers', body: [`This policy describes what the Lane app stores and sends. Lane is operated by ${OWNER_PLACEHOLDER.operator}.`] },
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
    { heading: 'Leaderboards and streak buddies', body: [
      'Leaderboards and streak buddies work when backup is on. Other learners see you on the weekly leaderboard only after you choose a username, and then they see your username, selected car and that week’s XP. Don’t use your real name.',
      'A friend can send you a streak-buddy request only by typing your exact username; Lane has no search or list of learners. Nothing is shared until you accept. A streak buddy can see your username, selected car, weekly XP, whether you practiced today and your shared streak. Lane has no private messages or chat. You can decline a request or remove a buddy at any time.',
    ] },
    { heading: 'Links and sharing', body: [
      'Each lesson links to its original video on YouTube. Opening that link takes you to YouTube, whose own privacy policy applies. The Share button uses your device’s share sheet or copies a lesson link; Lane does not see what you share or with whom.',
    ] },
    { heading: 'Your choices', body: [
      'You can change or clear your permit test date and username at any time in Settings. You can remove all progress on this device by clearing this site’s data in your browser settings.',
      'When backup is on, Settings includes Delete backed-up data, which removes your learning records and streak buddies from the server. To remove the anonymous account itself or ask about your data, use the contact below.',
    ] },
    { heading: 'Teens and families', body: [
      'Lane is designed for teens preparing for a learner’s permit. The age policy and any parent or guardian consent process will be set by the operator before public release.',
    ] },
    { heading: 'Security and retention', body: [
      'Server data is protected by access rules that let each learner read only their own records; buddies see only the details listed above. No system is perfectly secure. How long backed-up data is kept will be stated here before public release.',
    ] },
    { heading: 'Changes and contact', body: [
      'If this policy changes, the version and effective date above will change too.',
      OWNER_PLACEHOLDER.contact,
    ] },
  ],
};

export const TERMS: LegalDocument = {
  id: 'terms', title: 'Terms of Service', version: '0.1 (draft)', effective: null,
  sections: [
    { heading: 'Using Lane', body: [`By using Lane you agree to these terms. Lane is operated by ${OWNER_PLACEHOLDER.operator}.`] },
    { heading: 'What Lane is', body: [
      'Lane is a supplemental learning app about California driving rules. It is not affiliated with or endorsed by the California DMV. It is not driver training, legal advice, a certification of driving ability or a guarantee that you will pass any test. Labels such as “Permit Test Ready” or “Highway Confident” describe your practice in Lane. They can’t predict a test result or show that you’re ready to drive. Always follow the official California Driver’s Handbook, the law and your supervising driver.',
      'Some lesson questions and practice scenarios are still awaiting review against the handbook.',
    ] },
    { heading: 'Safety', body: [
      'Never use Lane while driving or while supervising a driver. Lane is not an emergency service. In an emergency, call 911.',
    ] },
    { heading: 'Fair use', body: [
      'Don’t try to change XP, streaks or leaderboard results by tampering with the app, its storage or its server, and don’t interfere with the service or other learners. Usernames must not be offensive, include personal information or impersonate someone. Only add people you know as streak buddies.',
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
      OWNER_PLACEHOLDER.contact,
    ] },
  ],
};
