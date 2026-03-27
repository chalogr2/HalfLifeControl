# Design System Specification: The Empathetic Guardian

## 1. Overview & Creative North Star
The "Creative North Star" for this design system is **The Digital Caretaker**. Unlike generic medical utilities that feel cold and clinical, this system is designed to feel like a high-end, tactile concierge. We are moving away from the "app-as-a-tool" and toward "app-as-a-service."

To solve the challenge of designing for elderly, non-tech-savvy users, we reject the "busy" mobile interface. Instead, we use **Soft Editorialism**: large-scale typography, intentional white space, and a layout that breathes. We break the rigid, boxed-in grid of traditional apps by using overlapping elements and tonal depth to guide the eye, ensuring the most important information—the medication schedule—is the undisputed hero of the screen.

---

## 2. Colors: Tonal Clarity & The "No-Line" Rule
Trust is built through stability. Our palette uses deep, authoritative teals (`primary`) paired with soft, inviting surfaces.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section content. Boundaries must be defined through background color shifts.
*   **Method:** A `surface-container-low` section sitting on a `surface` background creates a clear but soft boundary. 
*   **Surface Hierarchy:** Use the hierarchy from `surface-container-lowest` (background) to `surface-container-highest` (focused interactive elements) to create "nested" depth.

### Signature Textures & Glass
To provide a premium feel, use **Glassmorphism** for persistent floating elements (like the "Take All" FAB).
*   **Token:** Use `surface` at 80% opacity with a `backdrop-blur` of 20px. 
*   **Gradients:** Use a subtle linear gradient from `primary` (#004d64) to `primary_container` (#006684) on main CTA buttons to provide a "pill-like" dimensionality.

---

## 3. Typography: The Editorial Voice
We use a high-contrast scale to ensure legibility. The pairing of **Lexend** (Display/Headlines) and **Plus Jakarta Sans** (Body) offers a balance of geometric friendliness and high-readability.

*   **Display-LG (Lexend, 3.5rem):** Used for countdown timers or dosage numbers. It is unmissable.
*   **Headline-MD (Lexend, 1.75rem):** Used for medication names. Bold, clear, and authoritative.
*   **Body-LG (Plus Jakarta Sans, 1rem/16px):** The minimum standard for all instructional text. No text on screen should fall below this for core UX paths.
*   **Label-MD (Plus Jakarta Sans, 0.75rem):** Reserved only for secondary metadata (e.g., "Refill by Oct 20").

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are often too "muddy" for elderly users. We use **Tonal Layering** to convey importance.

*   **The Layering Principle:** Place a `surface-container-lowest` (#ffffff) card on a `surface-container-low` (#f4f3f6) background to create a "lifted" feel.
*   **Ambient Shadows:** If a floating effect is required, use a blur value of 32px with 6% opacity, tinted with `on-surface` (#1a1c1e).
*   **The "Ghost Border" Fallback:** For "Random/One-time" medications, use a 1.5px dashed border using `outline-variant` (#bfc8cd) at 40% opacity. Forbid 100% opaque borders.

---

## 5. Components: Tactile & Accessible
Every component prioritizes a minimum touch target of **48px** (Spacing Scale 10-12).

### The Progress Ring (Countdown)
*   **Visual:** A thick 12px stroke.
*   **Track:** `surface-variant` (#e2e2e5).
*   **Indicator:** `primary` (#004d64) for active tracking; `secondary` (#016a60) when dose is ready.
*   **Center:** Place `Display-MD` typography in the center for the remaining hours/minutes.

### Medication Cards
*   **Scheduled Stack:** Background: `surface-container-lowest`. Border: None. Left-accent: A 6px solid vertical bar of `primary`.
*   **Random/One-time:** Background: `surface-container`. Border: 1.5px dashed `outline-variant`.
*   **Separation:** Forbid dividers. Use `spacing-6` (2rem) between cards to create a clear visual break.

### Primary Action Buttons
*   **Shape:** `rounded-xl` (1.5rem).
*   **Color:** Gradient (`primary` to `primary_container`).
*   **Text:** `title-md` (Plus Jakarta Sans, 1.125rem), `on_primary` (#ffffff).
*   **Height:** 64px minimum for high-dexterity ease.

### Input Fields
*   **Style:** Filled style using `surface-container-high`. 
*   **Indicator:** A 2px bottom-bar using `primary` only on focus.
*   **Errors:** Use `error` (#ba1a1a) for text and `error_container` for the field background to ensure the user cannot miss the mistake.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use `surface-container` shifts to group related medications (e.g., "Morning Meds" section).
*   **Do** use `secondary` (Teal/Green) exclusively for "Success" states like "Medication Taken."
*   **Do** utilize the `XL` and `Full` roundedness tokens to make the UI feel approachable and "soft."

### Don’t:
*   **Don't** use "Grey on Grey" text. Always maintain a minimum 7:1 contrast ratio between text and its immediate background.
*   **Don't** use icons without labels. Elderly users should never have to guess what a "Hamburger" or "Plus" icon does.
*   **Don't** use more than one primary CTA per screen view. Use Tonal Layering to push secondary actions into the background.

### Summary of Tonal Logic
| Tier | Token | Use Case |
| :--- | :--- | :--- |
| **Ground** | `surface` | Main app background. |
| **Level 1** | `surface-container-low` | Grouping containers/sections. |
| **Level 2** | `surface-container-lowest` | Individual medication cards (Standard). |
| **Level 3** | `surface-bright` | Active/Pressed states. |