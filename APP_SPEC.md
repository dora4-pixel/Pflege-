# PflegeBuch Finder — application specification

## Product goal
PflegeBuch Finder has two independent modes:

1. **Book search** — fast local search in user-selected NANDA-I and ENP PDFs. Results are diagnosis-aware, not isolated keyword pages.
2. **Patient / Pflegeplan** — a guided assessment and care-plan workflow using only user-confirmed patient facts and source-backed NANDA/ENP options.

The public repository contains only application code. NANDA/ENP PDFs and patient profiles are never published with the site.

## Book-search result contract
Every result represents a **Pflegediagnose context**, not just a raw page hit.

### NANDA result
- Thema / Pflegebereich
- Domäne
- Klasse
- Diagnosencode
- Pflegediagnose
- matching section(s), e.g. Definition, Bestimmende Merkmale, Beeinflussende Faktoren, Risikofaktoren
- book page
- PDF page when it differs from printed book page
- related pages belonging to the same diagnosis
- button to open the original local PDF page
- separate Russian translation

### ENP result
- Thema / Pflegebereich
- System = ENP
- Bereich
- Pflegediagnose / Praxisleitlinie title
- matching section(s), e.g. Kennzeichen, Ursachen, Ressourcen, Pflegeziele, Pflegemaßnahmen
- book page / PDF page
- related pages
- original page + Russian translation

Navigation pages such as Inhaltsverzeichnis, Index, Stichwortverzeichnis and Diagnosenverzeichnis are excluded.

## Search model
- PDF text is extracted locally with PDF.js.
- Diagnosis metadata is enriched across continuation pages.
- MiniSearch provides local prefix/fuzzy full-text search with no network latency.
- Search results are grouped by diagnosis.
- Title/classification and clinically relevant sections receive more weight than goals/measures.
- Russian query stems expand to German nursing terminology.
- Book and PDF page numbers are separated where the printed page number can be detected.

## Patient workflow
1. New patient (pseudonym only)
2. Free-text initial situation
3. Select Pflegediagnose
4. Select only confirmed Ätiologie/Ursachen or Risikofaktoren
5. Select observed Symptome/Kennzeichen for problem diagnoses
6. Select Ressourcen
7. Review additional risk diagnoses / DNQP-relevant risk areas
8. Select Pflegeziel basis
9. Complete SMART measurable criterion and timeframe
10. Select and concretize Pflegemaßnahmen
11. Define Evaluation
12. Generate final care plan
13. Save selections locally and reopen later

## Care-plan structure
- Problem-focused diagnosis: PESR / PÄS(R)
- Risk diagnosis: diagnosis + confirmed risk factors + resources; no invented symptoms
- SMART goal check: specific, measurable, accepted/attractive, realistic, time-bound
- Measures are included only after user selection
- Additional risks remain separate plans/checks
- Evaluation uses the chosen timeframe and measurable criterion

SMART is used as a practical goal-quality framework. The app does not claim a single federally prescribed SMART sentence template; school/facility rules can differ.

## Risk-quality context
DNQP expert standards are used as **risk-check prompts**, not automatically as diagnoses. A risk is transferred into the patient plan only after the user confirms a patient-specific finding or assessment.

## Language
- Russian UI
- German UI
- switch available in the main UI and in planning/page dialogs
- nursing terminology remains in German where appropriate

## Storage and privacy
- PDFs: IndexedDB, local browser only
- search index: local browser
- patient profiles: IndexedDB, pseudonyms only
- public GitHub repository: code only, no copyrighted book files and no patient records

## Acceptance tests
The CI must fail if any of these fail:
- JavaScript syntax
- diagnosis knowledge-base regression
- NANDA domain/class/code extraction
- independent book-search mode
- book result contains diagnosis context and matching section
- original page viewer opens
- patient creation
- diagnosis/factor/symptom/resource/risk/measure selection
- SMART goal generation
- plan persistence and reopening
- RU/DE switching
- GitHub Pages deployment
