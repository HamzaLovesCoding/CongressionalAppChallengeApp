# Legal drafts

`terms-of-service.md` and `privacy-policy.md` are **drafts written October 15, 2026**. They aren't shown in the app and aren't in effect. They describe the app as it's built today: no accounts, and everything saved on the device. When the app's data handling changes, update these drafts in the same change.

These drafts were not written by a lawyer. Before publishing, have a parent, teacher or attorney review them, especially the items below.

The in-app policies in `src/legal/documents.ts` use Hamza Wadera, hamza.w.3790@gmail.com, and an effective date of October 18, 2026 (version 1.0), supplied by the owner. Those identity/date fields are also filled in these older review drafts; the remaining policy decisions below are still open.

## Fill in the placeholders

- [x] Team name and contact email: Hamza Wadera, hamza.w.3790@gmail.com.
- [x] Effective and last-updated dates: October 18, 2026.
- [ ] Hosting provider, what it logs (IP address, browser, pages) and for how long. Confirm it sets no cookies and serves Lane over HTTPS.
- [x] Software license for the code: MIT (`LICENSE`).

## Decide before accounts launch

- [ ] **Under-13 users.** Block accounts under 13, or get verifiable parental consent as COPPA requires. Recommended: block, and add an age check at sign-up.
- [ ] **What sign-in collects.** For example, email only. Store only what a feature needs, and show only nicknames on leaderboards.
- [ ] **Supabase region**, and a data-processing agreement with Supabase.
- [ ] **Account deletion timeline** (privacy section 12).
- [ ] **Nickname rules and moderation:** who reviews reported nicknames, and how.
- [ ] **Class codes.** If schools use Lane through class codes, California's Student Online Personal Information Protection Act (SOPIPA) and federal FERPA may apply. Ask a teacher or the school how they handle student apps.
- [ ] Rewrite privacy section 12 and terms section 11 into present-tense rules, and show a notice in the app before the change.

## Decide before the driver coach goes live (October 18, 2026)

The in-app Privacy Policy and Terms (version 1.1) and these drafts now describe the AI driver coach. These drafts still describe the app as local-only elsewhere; the backend sections need the rewrite above.

- [ ] **Anthropic's data terms.** The policy says Anthropic doesn't train on API data and deletes it within 30 days (Anthropic's Privacy Center, checked October 18, 2026; some third-party sites say 7 days). Confirm both in the Privacy Center and Anthropic's commercial terms for the account the key belongs to.
- [ ] **Anthropic's rules for products minors use.** Anthropic's Usage Policy lets apps built on its API serve minors only with extra safeguards (such as age-appropriate content and safety measures, disclosure that the user is talking to an AI, and following child-safety and privacy laws). Lane labels the coach "AI", keeps it on driving and sends no personal details, but read the current policy and confirm the account meets it.
- [ ] Whether the coach needs a parent or guardian notice beyond the Terms the learner agrees to at setup.

## Questions for a reviewer

These are open questions that need someone qualified to answer:

- **Minors and contracts.** In California, minors can generally cancel contracts, so the terms ask a parent or guardian to agree for users under 18. Is that the right approach for a free app?
- **Limits on responsibility (terms sections 14–15).** Are these appropriate and enforceable for a student project?
- **California minors' privacy law** (Business and Professions Code §22580–22582: a minor's right to remove content they posted). Confirm how it applies once nicknames exist.
- **CCPA/CPRA and CalOPPA** may not strictly apply to a noncommercial student project. The drafts follow their disclosure style anyway: what's collected, who it's shared with, Do Not Track, how changes are announced. Confirm nothing required is missing.

## Keep the drafts true to the app

- [ ] Check the data-deletion steps (privacy section 8) on a real iPhone and Android phone. Settings menus change between versions.
- [x] Record video **creator names and license types**. Credits show each video's title, creator (Trubicars or CRUDE Ultimate Driving Education) and CC BY 3.0 license.
- [ ] Remove "Some questions are still being reviewed" (terms section 4) once a person approves the draft quiz content.
- [x] Show the "Never use Lane while driving" message inside the app (the Terms and the Driver coach).
- [ ] Decide where the app links to these pages (for example, Home's menu and a first-launch notice) when they're implemented.
