# 09 — Owner inputs needed before public release

Only facts that cannot be invented. Each currently shows a visible placeholder in the app (`OWNER_PLACEHOLDER` in `src/legal/documents.ts`).

| # | Needed | Where it appears | Status |
| --- | --- | --- | --- |
| 1 | Legal operator name (person, team or organization responsible for Lane) | Privacy Policy, Terms | placeholder |
| 2 | Support / privacy / copyright contact (email or form) | Privacy, Terms | placeholder |
| 3 | Effective date and version for each document | Privacy, Terms header | placeholder ("0.1 (draft)") |
| 4 | Target age range and parent/guardian consent approach | Privacy → Teens and families | placeholder |
| 5 | Whether sync will be turned on, and the confirmed vendor list (Supabase region/project) | Privacy → Syncing | currently off |
| 6 | Retention period for synced data, and process to delete the anonymous auth account | Privacy → Security and retention / Your choices | placeholder |
| 7 | Governing law / jurisdiction and any limitation-of-liability wording (after legal review) | Terms → Changes, law and contact | placeholder |
| 8 | Whether Terms must be accepted before use (affects whether a `legal_acceptances` record is built) | — | not required now |
| 9 | Video creator names and exact Creative Commons license versions (CC BY requires naming the creator) | Credits, About sheets | pending |

## Release checklist (owner)

- [ ] Items 1–9 above supplied and entered in `src/legal/documents.ts` / `src/legal/credits.ts`.
- [ ] A human reviewer approves every `draft: true` question, similar/harder question and decision activity against the handbook (`src/feed/curriculum.ts`, `src/feed/clips.ts`, `src/content/learning.ts`).
- [ ] A human reviewer approves the 10 simulation manifests (`vendor/lane-simulations/*/scenario-manifest.json`, status `draft-needs-human-handbook-review`).
- [ ] Decide whether to ship the emergency checklist (stash content is an unreviewed draft; not shipped).
- [ ] If sync is wanted: create the Supabase project, enable anonymous sign-ins, apply `supabase/migrations/`, set the two `VITE_` variables, then run the two-user RLS check against the hosted project (`supabase/README.md`).
- [ ] Captions for lesson videos (none exist yet).
- [ ] Test on real phones (the oldest supported model is still a TODO in `CLAUDE.md`).
- [ ] Legal review of Privacy Policy and Terms. They are app-specific drafts, not legal advice.
