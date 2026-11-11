# UX improvements

Patterns observed on the reference site (see the audit) and how OnGoing applies the *idea* in its own design
system. Nothing of the reference's look, text or artwork is reused.

| Pattern observed | Why it works | How OnGoing applies it | Status |
|---|---|---|---|
| Every workflow states inputs → outputs → flagged items → approver | Users know what the AI did and who signs off | Findings panel shows the source, the proposed value, the severity and who reviewed it; approval buttons only for people who can approve | Planned (S-1) |
| Exceptions first | Busy managers act on problems, not on lists | Each module leads with an issues summary (BOQ checker, procurement flags, missing requirements, overdue work) | Done for the BOQ checker (M1), procurement flags (M3), the register summary (M2) and the management summary (M6) |
| Source shown next to each number | Trust and audit | Document, page and excerpt with a "verified" badge on AI findings; report figures link to their module | Planned (S-1, M6) |
| Honest labelling of demos and estimates | Credibility | Mock AI badge (done); reports label facts, estimates and AI recommendations differently | Partly done |
| Accessible to everyone (WCAG 2.1 AA) | Readable secondary text, labelled controls, honest error pages | Contrast token raised, controls labelled, branded not-found and error pages; `scripts/qa/site-crawl.mjs` runs axe on every page | Done 2026-11-11 (0 violations) |
| Calculators show their formula and caveats | Users can check the arithmetic | Margin, VAT and comparison figures show how they are computed (tooltips / small print) | Planned (M3, M4) |
| Same structure in Arabic and English, right to left | Regional fit | OnGoing is Arabic-first and right to left; navigation still mixes English labels — unify labels to Arabic with English kept only where users expect it (codes, file names) | Planned |
| Phone layout without sideways scrolling | Field use | Already a test requirement for new pages (375 px); apply to older tabs (pricing, procurement) | Ongoing |

## OnGoing-specific improvements found while auditing
- **Navigation:** the header mixes English breadcrumbs ("Projects · Proposals") with Arabic pages. Plan: Arabic labels, consistent order, and the new modules (Calendar, Documents, Reports, Settings) reachable from every page (main nav already added in Stage 3).
- **Tables and filters:** BOQ and quotes tables need sticky headers, totals and filters on phones; procurement needs a comparison view instead of a list (M3).
- **Form validation:** inline Arabic messages next to fields (pattern already used in Settings) for BOQ lines and quotes.
- **Loading and empty states:** every new page has `loading.tsx` and a useful empty state with the next action.
- **Accessibility:** real headings, list semantics, labelled inputs, focus moved to the target when a finding links to a row, `aria-live` for results.
- **Performance:** the project workspace loads several counts in separate queries; batch them in one database function and stream the header (TD-09).
- **Error handling:** server actions return Arabic messages mapped from database errors (permission, validation, conflicts), never raw errors.
