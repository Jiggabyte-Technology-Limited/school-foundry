# Uncle Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, benefits-first PowerPoint for the School Foundry pilot pitch, with branded styling, clickable links, and real workflow screenshots that support the daily-use story.

**Architecture:** Reuse the existing School Foundry brand assets and app styling so the deck feels native to the product. Capture a small set of representative app screens for the highest-value workflows, then compose a concise deck where each screenshot reinforces a school benefit instead of teaching UI mechanics. Keep the source content in a markdown outline for maintainability and generate the final PPTX as an artifact.

**Tech Stack:** PowerPoint artifact tool (`@oai/artifact-tool` / presentation JSX), in-app browser screenshots, existing School Foundry logos/colors/fonts, markdown source outline, local filesystem assets.

---

### Task 1: Capture the workflow screenshots

**Files:**
- Create: `docs/presentation-assets/uncle-presentation/README.md`
- Create: `docs/presentation-assets/uncle-presentation/screenshots/*.png`

- [ ] **Step 1: Open the local School Foundry app in the in-app browser**

Use the browser runtime to navigate to the local dev app and verify the current tab list, payments flow, learner account view, class list view, and reporting/exports screens.

- [ ] **Step 2: Capture one representative screenshot per key workflow**

Capture these screens at a minimum:
- learner search and account view
- record payment flow
- receipt or statement preview
- class list view
- PDF / Excel export affordance on the relevant report screens

- [ ] **Step 3: Save the screenshots with stable filenames**

Use filenames that map directly to the slide intent, such as:
- `01-learner-search-account.png`
- `02-record-payment.png`
- `03-receipt-statement.png`
- `04-class-list.png`
- `05-export-pdf-excel.png`

- [ ] **Step 4: Write a short asset note**

Document which screen corresponds to which slide and any cropping notes in `README.md`.

---

### Task 2: Draft the polished presentation content

**Files:**
- Modify: `docs/UNCLE_PRESENTATION_DRAFT.md`

- [ ] **Step 1: Rewrite the slide outline in a benefits-first voice**

Replace the tutorial-style framing with school-value framing:
- faster learner lookups
- cleaner fee collection
- immediate receipts
- statements on demand
- class lists and exports
- offline reliability
- easy admin control

- [ ] **Step 2: Add clickable links to the public School Foundry pages**

Include the main site and offline bundle page as explicit click targets in the deck content.

- [ ] **Step 3: Map each key workflow to a screenshot**

Make sure each workflow slide clearly references the correct asset filename for the deck build.

- [ ] **Step 4: Add speaker-note style prompts**

Keep the notes short and pitch-focused so the deck is easy to present live.

---

### Task 3: Build the branded PowerPoint

**Files:**
- Create: `build/presentations/uncle-pilot-deck.pptx`
- Create: `build/presentations/uncle-pilot-deck-source.jsx`

- [ ] **Step 1: Load the School Foundry brand assets and deck tooling**

Use the existing logo and color palette from the app so the deck matches the product identity.

- [ ] **Step 2: Assemble the slide deck**

Use a concise slide count with strong visual hierarchy:
- title
- problem
- value proposition
- learner search and account view
- recording payments
- receipts/statements
- class lists and exports
- offline advantage
- thermal printing
- offline bundle
- cloud roadmap
- pilot ask

- [ ] **Step 3: Add the screenshots into the workflow slides**

Use one image per workflow slide and keep the supporting copy short and benefit-focused.

- [ ] **Step 4: Add clickable links**

Make the site/offline references clickable inside the deck where the presentation naturally introduces them.

- [ ] **Step 5: Export the PPTX**

Write the final deck to `build/presentations/uncle-pilot-deck.pptx`.

---

### Task 4: Verify the deck quality

**Files:**
- Inspect: `build/presentations/uncle-pilot-deck.pptx`

- [ ] **Step 1: Open the rendered deck and check slide order**

Confirm the flow matches the benefits-first story and that the screenshots sit on the intended slides.

- [ ] **Step 2: Check branding consistency**

Confirm the fonts, colors, logo placement, and spacing feel aligned with School Foundry.

- [ ] **Step 3: Check the hyperlinks**

Verify the main site and offline bundle links are clickable from the deck.

- [ ] **Step 4: Fix any visual or copy issues**

Adjust any slide that feels too dense, too tutorial-like, or visually unbalanced.

- [ ] **Step 5: Deliver the final deck**

Share the PPTX path and a short summary of what is included.

