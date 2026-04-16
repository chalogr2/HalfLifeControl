# DRUGS.md — Duration / Interval Classification

Per-drug classification into **Category A** (third timer = "Duration of action"), **Category B** (third timer = "Dosing interval" or "Maintenance dosing interval"), or **Category C** (hide third timer entirely — show only half-life + clearance).

## Classification rules (agreed with user)

- **Category A** — requires one of:
  - Engineered delivery system: OROS / ER / XR / SR / CR / XL / LA / patch. These are common-knowledge duration claims backed by the approved-product label.
  - Explicit duration statement in the FDA SPL (§12.2 Pharmacodynamics or §14 Clinical Studies) or a sourced PubChem PUGView statement. The quote must use language like "duration of action is…", "lasts approximately X hours", etc.
- **Category B** — everything else with a stated dosing interval in SPL §2. For interval *ranges* (e.g., q4–6h) the **upper end** is stored. For *loading-then-maintenance* drugs the **maintenance** interval is used and the label says "Maintenance dosing interval".
- **Category C** — PRN-only drugs with no scheduled interval (e.g., triptans). Show only the two timers (half-life, clearance).
- Sources allowed: DailyMed (FDA SPL), PubChem PUGView. Wikipedia excluded.
- Evidence references point to `docs/duration-research.md` line ranges. Cross-check quotes against the SPL URL before committing curated values.

Abbreviations in tables: **QD** = once daily (1440 min), **BID** = twice daily (720 min), **TID** = three times daily (480 min), **QID** = four times daily (360 min). "min" = minutes.

---

## Category A — Duration of action

Third timer label: **"Duration of action"**.

### A1. Explicit duration statement in FDA SPL or PubChem

| id | Drug | Value (min) | Evidence (source, quote) |
|---|---|---|---|
| fexofenadine | Fexofenadine | 1440 | PubChem: "approximately 24 hours" duration of the antihistaminic effect. |
| hydroxyzine | Hydroxyzine | 360 | PubChem: clinical effects last "4–6 hours". (Upper end.) |
| famotidine | Famotidine | 720 | PubChem: "about 10–12 hours" suppression of gastric acid secretion. (Upper end.) |
| cyclobenzaprine | Cyclobenzaprine | 360 | PubChem: "4–6 hours" duration despite long plasma half-life. (Upper end.) |
| codeine | Codeine | 240 | PubChem: "average duration of action is about 4 hours". |
| glipizide | Glipizide | 1440 | PubChem: hypoglycemic effect "12 to 24 hours". (Upper end.) |
| pantoprazole | Pantoprazole | 1440 | SPL §12.2: "The duration of action of pantoprazole sodium for injection was 24 hours." |

### A2. Engineered delivery (formulation-backed)

All have the duration stated on the branded label (e.g., "once-daily", "12-hour release"). Sources: approved product labeling on DailyMed per `duration-research.md`.

| id | Drug | Value (min) | Evidence |
|---|---|---|---|
| methylphenidate_concerta | Methylphenidate ER (Concerta OROS) | 720 | Concerta label: ~12 h duration via OROS delivery. |
| methylphenidate_ritalin_la | Methylphenidate ER (Ritalin LA / Metadate CD) | 480 | Ritalin LA label: ~8 h duration. |
| methylphenidate_daytrana | Methylphenidate (Daytrana patch) | 540 | Daytrana label: 9 h wear-time; effect ends ~3 h after removal — use 9 h as baseline. |
| amphetamine_adderall_xr | Amphetamine XR (Adderall XR) | 720 | Adderall XR label: ~10–12 h duration (upper end). |
| lisdexamfetamine | Lisdexamfetamine (Vyvanse) | 780 | Vyvanse label: behavioral effect up to 13 h post-dose (pediatric) / 14 h (adult). Conservative 13 h. _Flag: per-population value; upper-bound 14 h also defensible._ |
| bupropion_sr | Bupropion SR (Wellbutrin SR) | 720 | SR label: BID dosing → 12 h. |
| bupropion_xl | Bupropion XL (Wellbutrin XL / Aplenzin) | 1440 | XL label: QD dosing → 24 h. |
| venlafaxine_xr | Venlafaxine XR (Effexor XR) | 1440 | Effexor XR SPL §2: once daily. |
| quetiapine_xr | Quetiapine XR (Seroquel XR) | 1440 | Seroquel XR SPL §2: once daily. |
| carbamazepine_xr | Carbamazepine XR (Tegretol XR / Carbatrol / Equetro) | 720 | Tegretol XR / Carbatrol label: BID dosing. |
| topiramate_xr | Topiramate XR (Trokendi XR / Qudexy XR) | 1440 | Trokendi XR / Qudexy XR SPL §2: once daily. |
| valproic_acid_er | Valproate ER (Depakote ER) | 1440 | Depakote ER SPL §2: once daily. |
| gabapentin_er | Gabapentin ER (Gralise / Horizant) | 1440 | Gralise label: QD evening dose. |
| levetiracetam_xr | Levetiracetam XR (Keppra XR) | 1440 | Keppra XR SPL §2: once daily. |
| oxycodone_cr | Oxycodone CR (OxyContin / Xtampza ER) | 720 | OxyContin label: dosed every 12 hours. |
| morphine_cr_mscontin | Morphine CR (MS Contin) | 720 | MS Contin label: every 8–12 h; BID default. |
| morphine_cr_kadian | Morphine CR (Kadian / Avinza) | 1440 | Kadian/Avinza label: once daily. |
| hydrocodone_er_zohydro | Hydrocodone ER (Zohydro ER) | 720 | Zohydro ER label: every 12 hours. |
| hydrocodone_er_hysingla | Hydrocodone ER (Hysingla ER) | 1440 | Hysingla ER label: once daily. |
| tramadol_er | Tramadol ER (Ultram ER / ConZip) | 1440 | Ultram ER SPL §2: once daily. |
| metoprolol_succinate_er | Metoprolol Succinate ER (Toprol XL) | 1440 | Toprol XL label §12.2: "beta-1 blockade of ≥24 hours" after once-daily dose. |
| propranolol_la | Propranolol LA (Inderal LA / InnoPran XL) | 1440 | Inderal LA label: once daily. |
| metformin_xr | Metformin XR (Glucophage XR / Glumetza / Fortamet) | 1440 | Glucophage XR label: once daily with evening meal. |

---

## Category B — Dosing interval

Third timer label: **"Dosing interval"** (or **"Maintenance dosing interval"** where flagged). Values are the upper end of SPL §2 interval ranges. Evidence lines reference `docs/duration-research.md`.

### Antibiotics (finite-course drugs — user may hide timer per-course in UX later)

| id | Drug | Value (min) | Evidence |
|---|---|---|---|
| amoxicillin | Amoxicillin | 480 | SPL §2: typically q8h (TID). |
| azithromycin | Azithromycin | 1440 | SPL §2: QD (Z-pak). |
| cephalexin | Cephalexin | 360 | SPL §2: q6h (QID). |
| ciprofloxacin | Ciprofloxacin | 720 | SPL §2: q12h (BID). |
| clindamycin | Clindamycin | 360 | SPL §2: q6–8h; typically QID → 6 h. |
| doxycycline | Doxycycline | 720 | SPL §2: BID (100 mg) after loading. **Maintenance dosing interval.** |
| levofloxacin | Levofloxacin | 1440 | SPL §2: QD. |
| metronidazole | Metronidazole | 480 | SPL §2: q8h (TID). |
| nitrofurantoin | Nitrofurantoin | 360 | SPL §2: QID (Macrodantin) → 6 h. |
| penicillin_v | Penicillin V | 360 | SPL §2: q6h. |
| sulfamethoxazole | Sulfamethoxazole | 720 | SPL §2 (Bactrim): BID. |
| trimethoprim | Trimethoprim | 720 | SPL §2: q12h (BID). |

### Antivirals

| id | Drug | Value (min) | Evidence |
|---|---|---|---|
| acyclovir | Acyclovir | 240 | SPL §2: 5× daily for HSV → q4h waking. Upper end of waking interval. |
| oseltamivir | Oseltamivir | 720 | SPL §2: BID for 5 days. |
| valacyclovir | Valacyclovir | 480 | SPL §2: TID for herpes zoster → 8 h. |
| fluconazole | Fluconazole | 1440 | SPL §2: QD. |
| terbinafine | Terbinafine | 1440 | SPL §2: QD. |

### Anticoagulants / Antiplatelets

| id | Drug | Value (min) | Evidence |
|---|---|---|---|
| apixaban | Apixaban | 720 | SPL §2: BID. |
| rivaroxaban | Rivaroxaban | 1440 | SPL §2: QD for most indications. |
| warfarin | Warfarin | 1440 | SPL §2: QD. |
| clopidogrel | Clopidogrel | 1440 | SPL §2: QD (maintenance). **Maintenance dosing interval.** |
| aspirin | Aspirin | 1440 | SPL §2 (Ecotrin low-dose cardio): QD. _Analgesic dosing is q4–6h; app uses cardio-QD as default._ |

### Anticonvulsants (IR)

| id | Drug | Value (min) | Evidence |
|---|---|---|---|
| carbamazepine | Carbamazepine | 720 | SPL §2: BID–QID; maintenance typically BID → 12 h. **Maintenance dosing interval.** |
| gabapentin | Gabapentin | 480 | SPL §2: TID. |
| lamotrigine | Lamotrigine | 720 | SPL §2: BID maintenance. **Maintenance dosing interval.** |
| levetiracetam | Levetiracetam | 720 | SPL §2: BID. |
| pregabalin | Pregabalin | 720 | SPL §2: BID–TID; BID→12 h default. |
| topiramate | Topiramate | 720 | SPL §2: BID maintenance. **Maintenance dosing interval.** |
| valproic_acid | Valproic Acid | 720 | SPL §2: BID–QID; BID maintenance. **Maintenance dosing interval.** |

### Antidepressants (SSRI / SNRI / TCA / other)

| id | Drug | Value (min) | Evidence |
|---|---|---|---|
| citalopram | Citalopram | 1440 | SPL §2: QD. (lines ~2867) |
| escitalopram | Escitalopram | 1440 | SPL §2: QD. (lines ~2894) |
| fluoxetine | Fluoxetine | 1440 | SPL §2: QD (morning). (lines ~2924) |
| fluvoxamine | Fluvoxamine | 720 | SPL §2: QD–BID; BID for >100 mg → 12 h. |
| paroxetine | Paroxetine | 1440 | SPL §2: QD (morning). (lines ~2984) |
| sertraline | Sertraline | 1440 | SPL §2: QD. (lines ~3014) |
| duloxetine | Duloxetine | 1440 | SPL §2: QD. (lines ~2780) |
| venlafaxine | Venlafaxine (IR) | 720 | SPL §2: BID (IR label). |
| mirtazapine | Mirtazapine | 1440 | SPL §2: QD at bedtime. |
| bupropion | Bupropion (IR) | 480 | SPL §2: TID (IR formulation, max single dose 150 mg) → 8 h. |
| trazodone | Trazodone | 720 | SPL §2: "150 mg in divided doses daily" — BID divided → 12 h. |
| amitriptyline | Amitriptyline | 1440 | SPL §2: QD at bedtime (typical). |
| nortriptyline | Nortriptyline | 1440 | SPL §2: QD at bedtime (typical). |
| atomoxetine | Atomoxetine | 1440 | SPL §2: QD morning or BID; QD is standard. |

### Antipsychotics

| id | Drug | Value (min) | Evidence |
|---|---|---|---|
| aripiprazole | Aripiprazole | 1440 | SPL §2: QD. |
| olanzapine | Olanzapine | 1440 | SPL §2: QD. |
| quetiapine | Quetiapine (IR) | 480 | SPL §2: TID acute (safer floor to prevent stacking). Maintenance may be BID. |
| risperidone | Risperidone | 1440 | SPL §2: QD or BID; QD standard. |

### Anxiolytics / Benzodiazepines / Sedatives

| id | Drug | Value (min) | Evidence |
|---|---|---|---|
| alprazolam | Alprazolam | 480 | SPL §2: TID. |
| clonazepam | Clonazepam | 720 | SPL §2: BID–TID; BID default. |
| diazepam | Diazepam | 720 | SPL §2: 2–4× daily; BID→12 h common. |
| lorazepam | Lorazepam | 720 | SPL §2: BID–TID; BID default. |
| buspirone | Buspirone | 480 | SPL §2: BID–TID; TID common. |
| zolpidem | Zolpidem | 1440 | SPL §2: QD at bedtime. (lines ~2724) |

### Cardiovascular (BP / HR / lipids)

| id | Drug | Value (min) | Evidence |
|---|---|---|---|
| atenolol | Atenolol | 1440 | SPL §2: QD. |
| carvedilol | Carvedilol | 720 | SPL §2: BID. |
| metoprolol | Metoprolol (IR tartrate) | 720 | SPL §2: BID. |
| propranolol | Propranolol (IR) | 360 | SPL §2: q6–8h; 6 h floor used to avoid premature-redose implication for BP/HR coverage. |
| amlodipine | Amlodipine | 1440 | SPL §2: QD. |
| lisinopril | Lisinopril | 1440 | SPL §2: QD. |
| losartan | Losartan | 1440 | SPL §2: QD. |
| valsartan | Valsartan | 1440 | SPL §2: QD. |
| digoxin | Digoxin | 1440 | SPL §2: QD maintenance. **Maintenance dosing interval.** |
| furosemide | Furosemide | 720 | SPL §2: QD–BID; BID default. |
| hydrochlorothiazide | Hydrochlorothiazide | 1440 | SPL §2: QD. |
| spironolactone | Spironolactone | 1440 | SPL §2: QD–BID; QD standard. |
| atorvastatin | Atorvastatin | 1440 | SPL §2: QD. (lines ~3044) |
| pravastatin | Pravastatin | 1440 | SPL §2: QD. (lines ~3074) |
| rosuvastatin | Rosuvastatin | 1440 | SPL §2: QD. |
| simvastatin | Simvastatin | 1440 | SPL §2: QD evening. |

### Diabetes / Hormones

| id | Drug | Value (min) | Evidence |
|---|---|---|---|
| metformin | Metformin (IR) | 720 | SPL §2: BID–TID with meals; BID default. |
| glyburide | Glyburide | 1440 | SPL §2: QD–BID; QD starting. |
| sitagliptin | Sitagliptin | 1440 | SPL §2: QD. |
| empagliflozin | Empagliflozin | 1440 | SPL §2: QD morning (line ~2751). PubChem also: "relatively long duration of action requiring only once-daily dosing" — supports A, but we keep as B unless user escalates. |
| pioglitazone | Pioglitazone | 1440 | SPL §2: QD. |
| levothyroxine | Levothyroxine | 1440 | SPL §2: QD fasting. |

### GI

| id | Drug | Value (min) | Evidence |
|---|---|---|---|
| esomeprazole | Esomeprazole | 1440 | SPL §2: QD (lines ~2585). |
| lansoprazole | Lansoprazole | 1440 | SPL §2: QD (line ~2613). |
| omeprazole | Omeprazole | 1440 | SPL §2: QD. (§12.2 mentions 72 h enzyme-binding, but that's PD, not clinical — QD matches actual dosing and avoids implying protection past the interval.) |
| ondansetron | Ondansetron | 480 | SPL §2: q8h (TID). |
| ranitidine | Ranitidine | 720 | SPL §2: BID. |

### NSAIDs / Analgesics (non-opioid)

| id | Drug | Value (min) | Evidence |
|---|---|---|---|
| acetaminophen | Acetaminophen | 360 | SPL §2: q4–6h (upper). |
| celecoxib | Celecoxib | 720 | SPL §2: QD or BID; BID for RA. |
| diclofenac | Diclofenac | 480 | SPL §2: TID–QID; TID→8 h common. |
| ibuprofen | Ibuprofen | 360 | SPL §2: q4–6h (upper). |
| indomethacin | Indomethacin | 480 | SPL §2: BID–TID. |
| meloxicam | Meloxicam | 1440 | SPL §2: QD. |
| naproxen | Naproxen | 720 | SPL §2: q8–12h (upper 12 h). |

### Opioids (IR)

| id | Drug | Value (min) | Evidence |
|---|---|---|---|
| hydrocodone | Hydrocodone (IR) | 360 | SPL §2: q4–6h (upper). |
| morphine | Morphine (IR) | 240 | SPL §2: q4h. |
| oxycodone | Oxycodone (IR) | 360 | SPL §2: q4–6h (upper). |
| tramadol | Tramadol (IR) | 360 | SPL §2: q4–6h (upper). |

### Muscle relaxants

| id | Drug | Value (min) | Evidence |
|---|---|---|---|
| baclofen | Baclofen | 480 | SPL §2: TID. |
| tizanidine | Tizanidine | 480 | SPL §2: q6–8h (upper). |

### Antihistamines (IR)

| id | Drug | Value (min) | Evidence |
|---|---|---|---|
| cetirizine | Cetirizine | 1440 | SPL §2: QD. |
| diphenhydramine | Diphenhydramine | 360 | SPL §2: q4–6h (upper). |
| levocetirizine | Levocetirizine | 1440 | SPL §2: QD evening. |
| loratadine | Loratadine | 1440 | SPL §2: QD. |

### Corticosteroids

| id | Drug | Value (min) | Evidence |
|---|---|---|---|
| dexamethasone | Dexamethasone | 1440 | SPL §2: variable QD–QID; QD typical maintenance. **Maintenance dosing interval.** |
| methylprednisolone | Methylprednisolone | 1440 | Medrol Dosepak §2: QD taper. **Maintenance dosing interval.** |
| prednisolone | Prednisolone | 1440 | SPL §2: QD typical. |
| prednisone | Prednisone | 1440 | SPL §2: QD typical. |

### Other

| id | Drug | Value (min) | Evidence |
|---|---|---|---|
| finasteride | Finasteride | 1440 | SPL §2: QD. |
| tamsulosin | Tamsulosin | 1440 | SPL §2: QD (30 min after same meal). |
| colchicine | Colchicine | 720 | SPL §2 (gout prophylaxis): QD or BID; BID default. |
| hydroxychloroquine | Hydroxychloroquine | 1440 | SPL §2: QD–BID maintenance; QD default. **Maintenance dosing interval.** |
| methotrexate | Methotrexate | 10080 | SPL §2: once weekly for RA — 7 d = 10080 min. **Maintenance dosing interval** + **`requiresWeeklyWarning` flag** — UI must render "Next dose: [weekday]" and an explicit WEEKLY warning. Daily MTX dosing is lethal (bone-marrow suppression). |
| montelukast | Montelukast | 1440 | SPL §2: QD evening. |
| pseudoephedrine | Pseudoephedrine | 360 | OTC label: q4–6h (upper). |
| tadalafil | Tadalafil | 1440 | SPL §2: QD (BPH/ED daily dosing). |
| amphetamine | Amphetamine (IR) | 360 | SPL §2: q4–6h (upper) — IR mixed salts. |
| methylphenidate | Methylphenidate (IR) | 240 | SPL §2: BID–TID, 30–45 min before meals; q4h typical. |
| allopurinol | Allopurinol | 1440 | SPL §2: QD (lines ~3535). |

---

## Category C — Hide third timer

Two-timer display only (half-life + clearance). No scheduled interval; PRN / symptomatic only.

| id | Drug | Rationale |
|---|---|---|
| rizatriptan | Rizatriptan | SPL §2: PRN for migraine; "second dose may be administered 2 hours after the first dose" — redose minimum, not a schedule. |
| sumatriptan | Sumatriptan | SPL §2: PRN; "second dose may be administered at least 2 hours after the first dose". |
| sildenafil | Sildenafil | PRN ~1 h before activity; 24 h "interval" would imply active protection far beyond the ~4 h clinical window. |
| caffeine | Caffeine | No authoritative FDA SPL for stimulant use; OTC label interval is marketing copy, not citable. |
| melatonin | Melatonin | Supplement — not FDA-regulated as a drug; no SPL. |
| vitamin_d3 | Vitamin D3 | Supplement; 50-day half-life makes any "dosing interval" timer clinically meaningless. |
| loperamide | Loperamide | "After each unformed stool" is not a scheduled interval; showing 4 h could encourage stacking toward cardiotoxic dose ranges (QT prolongation in abuse cases). |

---

## Edge-case resolutions (applied)

All earlier flagged cases have been resolved with the safer option:

- **omeprazole** → B (1440). 72 h enzyme-binding is PD; QD matches clinical reality and avoids false protection claim.
- **venlafaxine (IR)** → B (720). True IR label is BID; XR stays 1440 as a separate entry.
- **propranolol (IR)** → B (360). 6 h floor prevents premature-redose implication.
- **quetiapine (IR)** → B (480). TID acute floor protects against stacking sedation.
- **hydrocodone_er** → split into `hydrocodone_er_zohydro` (720) and `hydrocodone_er_hysingla` (1440). Opioid safety — never lump BID and QD.
- **morphine_cr** → split into `morphine_cr_mscontin` (720) and `morphine_cr_kadian` (1440). Same rationale.
- **sildenafil, caffeine, melatonin, vitamin_d3, loperamide** → C. PRN/OTC/supplement with no citable scheduled interval.
- **methotrexate** → B (10080) with `requiresWeeklyWarning: true`. UI must render a weekly countdown + explicit warning because daily dosing is lethal.

---

## Summary counts

- **Category A:** 30 drugs (7 with explicit quote, 23 engineered-release).
- **Category B:** 110 drugs.
- **Category C:** 7 drugs.
- **Total:** 147 source drugs → **149 entries** after splits.

## Next steps (after your review)

1. Revise this file — correct any mis-classifications and resolve the "flagged" rows.
2. I will then update `src/data/drugDatabase.ts` adding `durationOfActionMinutes` and a new `durationType: 'action' | 'interval' | 'none'` field plus `isMaintenanceInterval: boolean`.
3. Update `src/core/types.ts` and UI (`CountdownTimer.tsx`, `PillCard.tsx`, `pill/[id].tsx`) to render the correct label ("Duration of action" / "Dosing interval" / "Maintenance dosing interval") or hide the third timer for Category C.
4. Snapshot the value on pill/dose creation so later DB curation doesn't retroactively change history.
