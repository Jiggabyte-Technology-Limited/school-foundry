# Higgsfield AI — Stage 1 Asset Reference Generation Guide

> **Production Standard:** Follows the Higgsfield 3-Step Cinematic Workflow (Seedance 2.0).  
> **Rule:** Lock all character sheets, location stills, and prop turnarounds **first** before generating video clips. This guarantees 100% facial, clothing, and environment consistency across all 15-second Seedance prompts.

---

## 🎭 1. Characters: Reference Sheets (Soul Cast / Cinema Studio)

### Character 1: The ICT Teacher (`@uncle_teacher`)
- **Tool in Higgsfield:** `Cinema Studio` $\rightarrow$ `Soul Cast` (or `GPT Image 2` for character turnaround sheet)
- **Prompt:**
  ```text
  Cinematic character reference sheet, split-frame layout, photorealistic.
  Left panel — facial close-up: A 38-year-old African Zambian man, warm dark skin tone, short neat black hair, well-groomed beard shadow, subtle laugh lines around warm intelligent brown eyes, living skin texture with natural pores, calm dignified expression, looking straight into lens. Shot on 85mm portrait prime lens, soft natural window key light with gentle fill.
  Right panel — full-body front and back views side by side: The same Zambian man shown in a full-body front view and back view, wearing a smart tailored slate-grey long-sleeve button-down shirt tucked into dark charcoal trousers and clean brown leather oxford shoes. Normal relaxed posture, full height in frame head-to-toe.
  Look: Clean studio character sheet, plain solid neutral grey background, consistent character across all views, soft diffused lighting, true-to-life skin tones, vertical divider separating views.
  ```
- **Tag in Higgsfield Elements:** `@uncle_teacher`
- *Pro Tip:* If the generated sheet shows two faces on the right panel, use Higgsfield EditLayers / Erase to leave only one clear face in the reference image.

---

### Character 2: The Student (`@student_chanda`)
- **Tool in Higgsfield:** `Cinema Studio` $\rightarrow$ `Soul Cast`
- **Prompt:**
  ```text
  Cinematic character reference sheet, split-frame layout, photorealistic.
  Left panel — facial close-up: An 11-year-old Zambian schoolgirl, warm dark skin tone, neat braided hair with dark blue hair ties, bright curious dark brown eyes with soft catchlights, subtle gentle smile, natural child skin texture, looking straight into camera lens. Shot on 85mm portrait lens, soft diffused natural daylight.
  Right panel — full-body front and back views side by side: The same Zambian schoolgirl standing upright in a standard Zambian primary school uniform — a crisp navy blue pleated pinafore dress over a short-sleeve white collared shirt, white ankle socks, and neat black school shoes. Holding a plain exercise notebook.
  Look: Clean studio character sheet, plain solid light-grey background, even lighting, true-to-life African skin tones, high detail.
  ```
- **Tag in Higgsfield Elements:** `@student_chanda`

---

## 🏛️ 2. Locations: 3/4 Perspective Stills (Cinematic Locations)

### Location 1: School Administration Office (`@school_office`)
- **Tool in Higgsfield:** `Cinema Studio` $\rightarrow$ `Soul Location`
- **Prompt:**
  ```text
  A cinematic wide establishing interior shot of a modest school administration and bursar's office in a Zambian community school, early morning around 8 AM.
  3/4 three-quarter perspective angle looking across the room toward an open doorway and large sunny windows.
  Room details: A solid wooden desk with stacks of paper folders and receipt books, a standard desktop computer and laptop running on battery power, a green chalkboard on the cream brick wall with term dates written in white chalk, wooden filing cabinets along the wall.
  Light & Atmosphere: Warm, soft morning sunlight streaming through the windows creating gentle long shadows and subtle atmospheric haze (10% density).
  Color Grade: Lived-in documentary realism, warm ochre and wooden tones, neutral white balance, natural film stock feel. Shot on 35mm prime lens, deep focus, photorealistic, 16:9 widescreen, no people in frame.
  ```
- **Tag in Higgsfield Elements:** `@school_office`

---

### Location 2: School Courtyard & Grounds (`@school_courtyard`)
- **Tool in Higgsfield:** `Cinema Studio` $\rightarrow$ `Soul Location`
- **Prompt:**
  ```text
  A cinematic wide establishing exterior shot of a vibrant community school campus in peri-urban Lusaka, Zambia, morning.
  3/4 elevated perspective looking across the red-earth courtyard toward single-story red brick classroom blocks with green corrugated metal roofs and white trim.
  Details: Large shady jacaranda trees along the perimeter, a clean painted flagpole in the center, neat dirt pathways, a distant open field under a clear sunny blue sky with thin wispy clouds.
  Lighting: Soft, bright African morning sunlight, warm golden glow, gentle low contrast, documentary-realistic texture.
  Camera: Shot on high-end cinema camera, 24mm wide angle, deep focus, photorealistic, ultra high detail, 16:9, no people in frame.
  ```
- **Tag in Higgsfield Elements:** `@school_courtyard`

---

## 📦 3. Props: Product & Turnaround Sheets (GPT Image 2 / Soul Prop)

### Prop 1: Worn Paper Receipt Books (`@receipt_books`)
- **Tool in Higgsfield:** `Image` $\rightarrow$ `GPT Image 2`
- **Prompt:**
  ```text
  A product prop sheet / turnaround of a heavy stack of traditional school fee receipt books on a flat neutral light-grey studio background.
  Layout: Three thick rectangular receipt books with yellowed and carbon-copy pages, worn cardboard covers with handwritten labels like 'Grade 9 Term 1 Fees', stamped with red ink institutional stamps, slightly bent corners and visible paper texture.
  Lighting: Soft even studio product lighting, soft contact shadows, ultra sharp macro detail, photorealistic.
  ```
- **Tag in Higgsfield Elements:** `@receipt_books`

---

### Prop 2: Offline Laptop Station (`@laptop_offline`)
- **Tool in Higgsfield:** `Image` $\rightarrow$ `GPT Image 2`
- **Prompt:**
  ```text
  A clean product prop sheet of a standard 15-inch dark grey business laptop open at a 110-degree angle on a plain neutral grey background.
  Layout: Front 3/4 angle showing the screen and keyboard, side profile showing no plugged-in internet cables (wireless and disconnected), soft studio lighting, sharp focus on the matte screen and trackpad.
  ```
- **Tag in Higgsfield Elements:** `@laptop_offline`

---

## 🚀 Execution Workflow in Higgsfield

1. **Upload / Generate the 6 Assets**: Generate each of the 6 prompts above in Higgsfield.
2. **Add to Elements**: In Higgsfield Cinema Studio, go to **Elements** and upload/assign each image with its exact `@` tag (`@uncle_teacher`, `@student_chanda`, `@school_office`, `@school_courtyard`, `@receipt_books`, `@laptop_offline`).
3. **Generate Seedance 2.0 Prompts**: Open [`shotlist.html`](shotlist.html), click **"📋 Copy Prompt"** on each scene, paste into Seedance 2.0, and generate your 15-second clips.
