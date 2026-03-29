/**
 * Curated drug half-life database.
 * Shipped with the app for instant offline search.
 * Half-life values represent typical ranges for healthy adults.
 * Sources: FDA labeling, clinical pharmacology references.
 */

export interface DrugEntry {
  /** Lowercase generic name (for search matching). */
  id: string;
  /** Display name. */
  name: string;
  /** Brand names. */
  brands: string[];
  /** Half-life in minutes (midpoint of typical range). */
  halfLifeMinutes: number;
  /** Human-readable half-life range. */
  halfLifeLabel: string;
  /** Common dosage in mg. */
  commonDosageMg: number;
  /** Drug category. */
  category: string;
}

export const DRUG_DATABASE: DrugEntry[] = [
  // ─── Pain / Anti-inflammatory ───────────────────────
  { id: 'ibuprofen', name: 'Ibuprofen', brands: ['Advil', 'Motrin'], halfLifeMinutes: 120, halfLifeLabel: '1.8–2h', commonDosageMg: 200, category: 'NSAID' },
  { id: 'acetaminophen', name: 'Acetaminophen', brands: ['Tylenol'], halfLifeMinutes: 150, halfLifeLabel: '2–3h', commonDosageMg: 500, category: 'Analgesic' },
  { id: 'aspirin', name: 'Aspirin', brands: ['Bayer'], halfLifeMinutes: 20, halfLifeLabel: '15–20min (salicylate 2–4.5h)', commonDosageMg: 325, category: 'NSAID' },
  { id: 'naproxen', name: 'Naproxen', brands: ['Aleve', 'Naprosyn'], halfLifeMinutes: 780, halfLifeLabel: '12–17h', commonDosageMg: 220, category: 'NSAID' },
  { id: 'celecoxib', name: 'Celecoxib', brands: ['Celebrex'], halfLifeMinutes: 660, halfLifeLabel: '11h', commonDosageMg: 200, category: 'NSAID' },
  { id: 'diclofenac', name: 'Diclofenac', brands: ['Voltaren'], halfLifeMinutes: 120, halfLifeLabel: '2h', commonDosageMg: 50, category: 'NSAID' },

  // ─── Cardiovascular ─────────────────────────────────
  { id: 'lisinopril', name: 'Lisinopril', brands: ['Zestril', 'Prinivil'], halfLifeMinutes: 720, halfLifeLabel: '12h', commonDosageMg: 10, category: 'ACE Inhibitor' },
  { id: 'amlodipine', name: 'Amlodipine', brands: ['Norvasc'], halfLifeMinutes: 2100, halfLifeLabel: '30–50h', commonDosageMg: 5, category: 'Calcium Channel Blocker' },
  { id: 'losartan', name: 'Losartan', brands: ['Cozaar'], halfLifeMinutes: 120, halfLifeLabel: '2h (active metabolite 6–9h)', commonDosageMg: 50, category: 'ARB' },
  { id: 'metoprolol', name: 'Metoprolol', brands: ['Lopressor', 'Toprol-XL'], halfLifeMinutes: 210, halfLifeLabel: '3–7h', commonDosageMg: 50, category: 'Beta Blocker' },
  { id: 'atenolol', name: 'Atenolol', brands: ['Tenormin'], halfLifeMinutes: 390, halfLifeLabel: '6–7h', commonDosageMg: 50, category: 'Beta Blocker' },
  { id: 'hydrochlorothiazide', name: 'Hydrochlorothiazide', brands: ['Microzide'], halfLifeMinutes: 660, halfLifeLabel: '5.6–14.8h', commonDosageMg: 25, category: 'Diuretic' },
  { id: 'atorvastatin', name: 'Atorvastatin', brands: ['Lipitor'], halfLifeMinutes: 840, halfLifeLabel: '14h', commonDosageMg: 20, category: 'Statin' },
  { id: 'rosuvastatin', name: 'Rosuvastatin', brands: ['Crestor'], halfLifeMinutes: 1140, halfLifeLabel: '19h', commonDosageMg: 10, category: 'Statin' },
  { id: 'simvastatin', name: 'Simvastatin', brands: ['Zocor'], halfLifeMinutes: 180, halfLifeLabel: '3h', commonDosageMg: 20, category: 'Statin' },
  { id: 'warfarin', name: 'Warfarin', brands: ['Coumadin'], halfLifeMinutes: 2400, halfLifeLabel: '20–60h', commonDosageMg: 5, category: 'Anticoagulant' },
  { id: 'clopidogrel', name: 'Clopidogrel', brands: ['Plavix'], halfLifeMinutes: 360, halfLifeLabel: '6h', commonDosageMg: 75, category: 'Antiplatelet' },

  // ─── Diabetes ───────────────────────────────────────
  { id: 'metformin', name: 'Metformin', brands: ['Glucophage'], halfLifeMinutes: 390, halfLifeLabel: '6.2h', commonDosageMg: 500, category: 'Antidiabetic' },
  { id: 'glipizide', name: 'Glipizide', brands: ['Glucotrol'], halfLifeMinutes: 210, halfLifeLabel: '2–5h', commonDosageMg: 5, category: 'Sulfonylurea' },

  // ─── Mental Health ──────────────────────────────────
  { id: 'sertraline', name: 'Sertraline', brands: ['Zoloft'], halfLifeMinutes: 1560, halfLifeLabel: '26h', commonDosageMg: 50, category: 'SSRI' },
  { id: 'fluoxetine', name: 'Fluoxetine', brands: ['Prozac'], halfLifeMinutes: 5760, halfLifeLabel: '1–6 days', commonDosageMg: 20, category: 'SSRI' },
  { id: 'escitalopram', name: 'Escitalopram', brands: ['Lexapro'], halfLifeMinutes: 1680, halfLifeLabel: '27–32h', commonDosageMg: 10, category: 'SSRI' },
  { id: 'citalopram', name: 'Citalopram', brands: ['Celexa'], halfLifeMinutes: 2100, halfLifeLabel: '35h', commonDosageMg: 20, category: 'SSRI' },
  { id: 'venlafaxine', name: 'Venlafaxine', brands: ['Effexor'], halfLifeMinutes: 300, halfLifeLabel: '5h (metabolite 11h)', commonDosageMg: 75, category: 'SNRI' },
  { id: 'duloxetine', name: 'Duloxetine', brands: ['Cymbalta'], halfLifeMinutes: 720, halfLifeLabel: '12h', commonDosageMg: 60, category: 'SNRI' },
  { id: 'bupropion', name: 'Bupropion', brands: ['Wellbutrin'], halfLifeMinutes: 1260, halfLifeLabel: '21h', commonDosageMg: 150, category: 'NDRI' },
  { id: 'trazodone', name: 'Trazodone', brands: ['Desyrel'], halfLifeMinutes: 420, halfLifeLabel: '5–9h', commonDosageMg: 50, category: 'SARI' },
  { id: 'alprazolam', name: 'Alprazolam', brands: ['Xanax'], halfLifeMinutes: 690, halfLifeLabel: '11.2h', commonDosageMg: 0.5, category: 'Benzodiazepine' },
  { id: 'lorazepam', name: 'Lorazepam', brands: ['Ativan'], halfLifeMinutes: 720, halfLifeLabel: '12h', commonDosageMg: 1, category: 'Benzodiazepine' },
  { id: 'diazepam', name: 'Diazepam', brands: ['Valium'], halfLifeMinutes: 2880, halfLifeLabel: '20–100h', commonDosageMg: 5, category: 'Benzodiazepine' },
  { id: 'quetiapine', name: 'Quetiapine', brands: ['Seroquel'], halfLifeMinutes: 420, halfLifeLabel: '~7h', commonDosageMg: 25, category: 'Atypical Antipsychotic' },
  { id: 'aripiprazole', name: 'Aripiprazole', brands: ['Abilify'], halfLifeMinutes: 4500, halfLifeLabel: '75h', commonDosageMg: 10, category: 'Atypical Antipsychotic' },

  // ─── Thyroid ────────────────────────────────────────
  { id: 'levothyroxine', name: 'Levothyroxine', brands: ['Synthroid', 'Levoxyl'], halfLifeMinutes: 10080, halfLifeLabel: '6–7 days', commonDosageMg: 50, category: 'Thyroid Hormone' },

  // ─── Respiratory ────────────────────────────────────
  { id: 'montelukast', name: 'Montelukast', brands: ['Singulair'], halfLifeMinutes: 300, halfLifeLabel: '2.7–5.5h', commonDosageMg: 10, category: 'Leukotriene Inhibitor' },
  { id: 'cetirizine', name: 'Cetirizine', brands: ['Zyrtec'], halfLifeMinutes: 480, halfLifeLabel: '8h', commonDosageMg: 10, category: 'Antihistamine' },
  { id: 'loratadine', name: 'Loratadine', brands: ['Claritin'], halfLifeMinutes: 480, halfLifeLabel: '8h (metabolite 28h)', commonDosageMg: 10, category: 'Antihistamine' },
  { id: 'fexofenadine', name: 'Fexofenadine', brands: ['Allegra'], halfLifeMinutes: 840, halfLifeLabel: '14.4h', commonDosageMg: 180, category: 'Antihistamine' },
  { id: 'diphenhydramine', name: 'Diphenhydramine', brands: ['Benadryl'], halfLifeMinutes: 240, halfLifeLabel: '2.4–9.3h', commonDosageMg: 25, category: 'Antihistamine' },

  // ─── GI ─────────────────────────────────────────────
  { id: 'omeprazole', name: 'Omeprazole', brands: ['Prilosec'], halfLifeMinutes: 60, halfLifeLabel: '0.5–1h', commonDosageMg: 20, category: 'PPI' },
  { id: 'pantoprazole', name: 'Pantoprazole', brands: ['Protonix'], halfLifeMinutes: 60, halfLifeLabel: '1h', commonDosageMg: 40, category: 'PPI' },
  { id: 'famotidine', name: 'Famotidine', brands: ['Pepcid'], halfLifeMinutes: 180, halfLifeLabel: '2.5–3.5h', commonDosageMg: 20, category: 'H2 Blocker' },

  // ─── Antibiotics ────────────────────────────────────
  { id: 'amoxicillin', name: 'Amoxicillin', brands: ['Amoxil'], halfLifeMinutes: 75, halfLifeLabel: '1–1.5h', commonDosageMg: 500, category: 'Antibiotic' },
  { id: 'azithromycin', name: 'Azithromycin', brands: ['Zithromax', 'Z-Pack'], halfLifeMinutes: 4080, halfLifeLabel: '68h', commonDosageMg: 250, category: 'Antibiotic' },
  { id: 'ciprofloxacin', name: 'Ciprofloxacin', brands: ['Cipro'], halfLifeMinutes: 240, halfLifeLabel: '4h', commonDosageMg: 500, category: 'Antibiotic' },
  { id: 'doxycycline', name: 'Doxycycline', brands: ['Vibramycin'], halfLifeMinutes: 1080, halfLifeLabel: '18–22h', commonDosageMg: 100, category: 'Antibiotic' },

  // ─── Other Common ───────────────────────────────────
  { id: 'prednisone', name: 'Prednisone', brands: ['Deltasone'], halfLifeMinutes: 210, halfLifeLabel: '2–3h', commonDosageMg: 10, category: 'Corticosteroid' },
  { id: 'gabapentin', name: 'Gabapentin', brands: ['Neurontin'], halfLifeMinutes: 360, halfLifeLabel: '5–7h', commonDosageMg: 300, category: 'Anticonvulsant' },
  { id: 'pregabalin', name: 'Pregabalin', brands: ['Lyrica'], halfLifeMinutes: 378, halfLifeLabel: '6.3h', commonDosageMg: 75, category: 'Anticonvulsant' },
  { id: 'cyclobenzaprine', name: 'Cyclobenzaprine', brands: ['Flexeril'], halfLifeMinutes: 1080, halfLifeLabel: '18h', commonDosageMg: 10, category: 'Muscle Relaxant' },
  { id: 'tramadol', name: 'Tramadol', brands: ['Ultram'], halfLifeMinutes: 378, halfLifeLabel: '6.3h', commonDosageMg: 50, category: 'Opioid Analgesic' },
  { id: 'melatonin', name: 'Melatonin', brands: [], halfLifeMinutes: 40, halfLifeLabel: '20–50min', commonDosageMg: 3, category: 'Supplement' },
];

/**
 * Search curated database by name or brand.
 * Returns entries matching the query (case-insensitive, prefix match).
 */
export function searchDrugs(query: string): DrugEntry[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return DRUG_DATABASE.filter(
    (drug) =>
      drug.name.toLowerCase().includes(q) ||
      drug.brands.some((b) => b.toLowerCase().includes(q)) ||
      drug.id.includes(q),
  );
}
