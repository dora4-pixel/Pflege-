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


## Dual-source search and planning contract
NANDA and ENP are not competitors in one global ranking. They are complementary sources and are ranked independently.

- **NANDA role:** formal nursing diagnosis, Domäne, Klasse, Diagnosencode, Definition, defining characteristics / risk factors.
- **ENP role:** practical nursing-process support, especially Ressourcen, Pflegeziele and Pflegemaßnahmen.
- If both books are loaded, the first screen must always surface the best NANDA result and the best ENP result in separate source sections.
- A high text density in ENP must never push the best NANDA diagnosis below several ENP entries.
- Relevance percentages are calibrated **within each source**, not normalized against the other book.
- A semantically exact, risk-aligned, fully classified NANDA diagnosis may show 100% **search relevance**. This is not a diagnosis probability.
- Pflegeplan generation must carry both primary sources into the planning context whenever both exist.

## Anticipated failure modes and required behavior
1. **One book uses more matching synonyms than the other.**  
   Mitigation: semantic evidence does not require every expanded synonym; source-specific calibration prevents synonym density from suppressing another source.

2. **NANDA exact diagnosis appears lower than an ENP page with many keyword matches.**  
   Mitigation: canonical title + semantic concept + risk alignment + complete NANDA classification receives a strong relevance floor; best NANDA is surfaced independently.

3. **ENP is missing but NANDA exists, or vice versa.**  
   Mitigation: show the available source, mark the planning context as incomplete, and never pretend that both source roles are present.

4. **Problem diagnosis and risk diagnosis both match.**  
   Mitigation: preserve both; when the query explicitly expresses risk, risk-title alignment is weighted strongly. Problem diagnoses remain alternatives rather than being deleted.

5. **A symptom occurs on a continuation page without title/classification.**  
   Mitigation: continuation pages inherit diagnosis metadata only inside a bounded diagnosis span and remain grouped under the diagnosis.

6. **Printed book page differs from PDF page.**  
   Mitigation: store and display Buchseite separately from PDF-Seite.

7. **Russian lay wording does not occur literally in either German book.**  
   Mitigation: local semantic concept expansion first, cached RU→DE fallback second.

8. **The same topic has several plausible diagnoses in one book.**  
   Mitigation: show the best source-specific match first and keep alternative diagnoses below it with their own relevance scores.

9. **A generic concept could produce an unjustified 100%.**  
   Mitigation: 100% is reserved for source-complete NANDA matches where semantic concept and diagnosis type align with the query. The UI explicitly labels the number as search relevance.

10. **SMART plan accidentally mixes unrelated pages.**  
    Mitigation: planning context starts with the primary NANDA and primary ENP matches, then uses only bounded alternatives. NANDA evidence is preferred for diagnosis/factors; ENP evidence is preferred for resources/goals/measures.

11. **Risk suggestions are treated as confirmed patient facts.**  
    Mitigation: every cause, symptom, resource, risk and measure remains opt-in. DNQP areas stay risk-check prompts until confirmed by patient-specific assessment.

12. **Stale local PDF indexes survive an application update.**  
    Mitigation: stored books are re-enriched on load before search and planning engines are rebuilt.

## Relevance score meaning
The percentage means **how well a source diagnosis matches the user's search intent**. It does not mean:
- probability that the patient has the diagnosis,
- diagnostic certainty,
- medical risk probability,
- quality score of NANDA versus ENP.

The two books therefore have separate top scores and separate "best in source" labels.
