#!/usr/bin/env node
/**
 * PubChem drug database builder.
 *
 * Fetches pharmacokinetic data from PubChem PUGView REST API for a curated
 * list of common medications and generates src/data/drugDatabase.ts.
 *
 * Usage:  node scripts/build-drug-db.mjs
 *
 * Rate limit: PubChem allows 5 requests/second. We throttle to 3/s to be safe.
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(__dirname, '../src/data/drugDatabase.ts');

// ─── Drug list: name → PubChem CID ──────────────────────────────────
// CIDs looked up from https://pubchem.ncbi.nlm.nih.gov
const DRUGS = [
  // Pain / Anti-inflammatory
  { name: 'Ibuprofen', cid: 3672, category: 'NSAID', commonDosageMg: 200 },
  { name: 'Acetaminophen', cid: 1983, category: 'Analgesic', commonDosageMg: 500 },
  { name: 'Aspirin', cid: 2244, category: 'NSAID', commonDosageMg: 325 },
  { name: 'Naproxen', cid: 156391, category: 'NSAID', commonDosageMg: 220 },
  { name: 'Celecoxib', cid: 2662, category: 'NSAID', commonDosageMg: 200 },
  { name: 'Diclofenac', cid: 3033, category: 'NSAID', commonDosageMg: 50 },
  { name: 'Meloxicam', cid: 54677470, category: 'NSAID', commonDosageMg: 15 },
  { name: 'Indomethacin', cid: 3715, category: 'NSAID', commonDosageMg: 25 },

  // Cardiovascular
  { name: 'Lisinopril', cid: 5362119, category: 'ACE Inhibitor', commonDosageMg: 10 },
  { name: 'Amlodipine', cid: 2162, category: 'Calcium Channel Blocker', commonDosageMg: 5 },
  { name: 'Losartan', cid: 3961, category: 'ARB', commonDosageMg: 50 },
  { name: 'Valsartan', cid: 60846, category: 'ARB', commonDosageMg: 80 },
  { name: 'Metoprolol', cid: 4171, category: 'Beta Blocker', commonDosageMg: 50 },
  { name: 'Atenolol', cid: 2249, category: 'Beta Blocker', commonDosageMg: 50 },
  { name: 'Propranolol', cid: 4946, category: 'Beta Blocker', commonDosageMg: 40 },
  { name: 'Carvedilol', cid: 2585, category: 'Beta Blocker', commonDosageMg: 12.5 },
  { name: 'Hydrochlorothiazide', cid: 3639, category: 'Diuretic', commonDosageMg: 25 },
  { name: 'Furosemide', cid: 3440, category: 'Diuretic', commonDosageMg: 40 },
  { name: 'Spironolactone', cid: 5833, category: 'Diuretic', commonDosageMg: 25 },
  { name: 'Atorvastatin', cid: 60823, category: 'Statin', commonDosageMg: 20 },
  { name: 'Rosuvastatin', cid: 446157, category: 'Statin', commonDosageMg: 10 },
  { name: 'Simvastatin', cid: 54454, category: 'Statin', commonDosageMg: 20 },
  { name: 'Pravastatin', cid: 54687, category: 'Statin', commonDosageMg: 40 },
  { name: 'Warfarin', cid: 54678486, category: 'Anticoagulant', commonDosageMg: 5 },
  { name: 'Clopidogrel', cid: 60606, category: 'Antiplatelet', commonDosageMg: 75 },
  { name: 'Apixaban', cid: 10182969, category: 'Anticoagulant', commonDosageMg: 5 },
  { name: 'Rivaroxaban', cid: 6433119, category: 'Anticoagulant', commonDosageMg: 20 },
  { name: 'Digoxin', cid: 2724385, category: 'Cardiac Glycoside', commonDosageMg: 0.25 },

  // Diabetes
  { name: 'Metformin', cid: 4091, category: 'Antidiabetic', commonDosageMg: 500 },
  { name: 'Glipizide', cid: 3478, category: 'Sulfonylurea', commonDosageMg: 5 },
  { name: 'Glyburide', cid: 3488, category: 'Sulfonylurea', commonDosageMg: 5 },
  { name: 'Sitagliptin', cid: 4369359, category: 'DPP-4 Inhibitor', commonDosageMg: 100 },
  { name: 'Empagliflozin', cid: 11949646, category: 'SGLT2 Inhibitor', commonDosageMg: 10 },
  { name: 'Pioglitazone', cid: 4829, category: 'Thiazolidinedione', commonDosageMg: 30 },

  // Mental Health - Antidepressants
  { name: 'Sertraline', cid: 68617, category: 'SSRI', commonDosageMg: 50 },
  { name: 'Fluoxetine', cid: 3386, category: 'SSRI', commonDosageMg: 20 },
  { name: 'Escitalopram', cid: 146570, category: 'SSRI', commonDosageMg: 10 },
  { name: 'Citalopram', cid: 2771, category: 'SSRI', commonDosageMg: 20 },
  { name: 'Paroxetine', cid: 43815, category: 'SSRI', commonDosageMg: 20 },
  { name: 'Fluvoxamine', cid: 5324346, category: 'SSRI', commonDosageMg: 50 },
  { name: 'Venlafaxine', cid: 5656, category: 'SNRI', commonDosageMg: 75 },
  { name: 'Duloxetine', cid: 60835, category: 'SNRI', commonDosageMg: 60 },
  { name: 'Bupropion', cid: 444, category: 'NDRI', commonDosageMg: 150 },
  { name: 'Trazodone', cid: 5533, category: 'SARI', commonDosageMg: 50 },
  { name: 'Mirtazapine', cid: 4205, category: 'NaSSA', commonDosageMg: 15 },
  { name: 'Amitriptyline', cid: 2160, category: 'TCA', commonDosageMg: 25 },
  { name: 'Nortriptyline', cid: 4543, category: 'TCA', commonDosageMg: 25 },

  // Mental Health - Anxiolytics / Sedatives
  { name: 'Alprazolam', cid: 2118, category: 'Benzodiazepine', commonDosageMg: 0.5 },
  { name: 'Lorazepam', cid: 3958, category: 'Benzodiazepine', commonDosageMg: 1 },
  { name: 'Diazepam', cid: 3016, category: 'Benzodiazepine', commonDosageMg: 5 },
  { name: 'Clonazepam', cid: 2802, category: 'Benzodiazepine', commonDosageMg: 0.5 },
  { name: 'Buspirone', cid: 2477, category: 'Anxiolytic', commonDosageMg: 10 },
  { name: 'Zolpidem', cid: 5732, category: 'Sedative', commonDosageMg: 10 },

  // Mental Health - Antipsychotics
  { name: 'Quetiapine', cid: 5002, category: 'Atypical Antipsychotic', commonDosageMg: 25 },
  { name: 'Aripiprazole', cid: 60795, category: 'Atypical Antipsychotic', commonDosageMg: 10 },
  { name: 'Risperidone', cid: 5073, category: 'Atypical Antipsychotic', commonDosageMg: 2 },
  { name: 'Olanzapine', cid: 4585, category: 'Atypical Antipsychotic', commonDosageMg: 10 },

  // Mental Health - ADHD
  { name: 'Methylphenidate', cid: 4158, category: 'Stimulant', commonDosageMg: 10 },
  { name: 'Amphetamine', cid: 3007, category: 'Stimulant', commonDosageMg: 10 },
  { name: 'Lisdexamfetamine', cid: 11597698, category: 'Stimulant', commonDosageMg: 30 },
  { name: 'Atomoxetine', cid: 54841, category: 'SNRI (ADHD)', commonDosageMg: 40 },

  // Thyroid
  { name: 'Levothyroxine', cid: 5819, category: 'Thyroid Hormone', commonDosageMg: 50 },

  // Respiratory / Allergy
  { name: 'Montelukast', cid: 5281040, category: 'Leukotriene Inhibitor', commonDosageMg: 10 },
  { name: 'Cetirizine', cid: 2678, category: 'Antihistamine', commonDosageMg: 10 },
  { name: 'Loratadine', cid: 3957, category: 'Antihistamine', commonDosageMg: 10 },
  { name: 'Fexofenadine', cid: 3348, category: 'Antihistamine', commonDosageMg: 180 },
  { name: 'Diphenhydramine', cid: 3100, category: 'Antihistamine', commonDosageMg: 25 },
  { name: 'Hydroxyzine', cid: 3658, category: 'Antihistamine', commonDosageMg: 25 },
  { name: 'Levocetirizine', cid: 1549000, category: 'Antihistamine', commonDosageMg: 5 },
  { name: 'Pseudoephedrine', cid: 7028, category: 'Decongestant', commonDosageMg: 60 },

  // GI
  { name: 'Omeprazole', cid: 4594, category: 'PPI', commonDosageMg: 20 },
  { name: 'Pantoprazole', cid: 4679, category: 'PPI', commonDosageMg: 40 },
  { name: 'Esomeprazole', cid: 9579578, category: 'PPI', commonDosageMg: 20 },
  { name: 'Lansoprazole', cid: 3883, category: 'PPI', commonDosageMg: 30 },
  { name: 'Famotidine', cid: 3325, category: 'H2 Blocker', commonDosageMg: 20 },
  { name: 'Ranitidine', cid: 3001055, category: 'H2 Blocker', commonDosageMg: 150 },
  { name: 'Ondansetron', cid: 4595, category: 'Antiemetic', commonDosageMg: 4 },
  { name: 'Loperamide', cid: 3955, category: 'Antidiarrheal', commonDosageMg: 2 },

  // Antibiotics
  { name: 'Amoxicillin', cid: 33613, category: 'Antibiotic', commonDosageMg: 500 },
  { name: 'Azithromycin', cid: 447043, category: 'Antibiotic', commonDosageMg: 250 },
  { name: 'Ciprofloxacin', cid: 2764, category: 'Antibiotic', commonDosageMg: 500 },
  { name: 'Doxycycline', cid: 54671203, category: 'Antibiotic', commonDosageMg: 100 },
  { name: 'Metronidazole', cid: 4173, category: 'Antibiotic', commonDosageMg: 500 },
  { name: 'Sulfamethoxazole', cid: 5329, category: 'Antibiotic', commonDosageMg: 800 },
  { name: 'Trimethoprim', cid: 5578, category: 'Antibiotic', commonDosageMg: 160 },
  { name: 'Cephalexin', cid: 27447, category: 'Antibiotic', commonDosageMg: 500 },
  { name: 'Levofloxacin', cid: 149096, category: 'Antibiotic', commonDosageMg: 500 },
  { name: 'Clindamycin', cid: 29029, category: 'Antibiotic', commonDosageMg: 300 },
  { name: 'Nitrofurantoin', cid: 6604200, category: 'Antibiotic', commonDosageMg: 100 },
  { name: 'Penicillin V', cid: 6869, category: 'Antibiotic', commonDosageMg: 500 },

  // Corticosteroids
  { name: 'Prednisone', cid: 5865, category: 'Corticosteroid', commonDosageMg: 10 },
  { name: 'Prednisolone', cid: 5755, category: 'Corticosteroid', commonDosageMg: 5 },
  { name: 'Dexamethasone', cid: 5743, category: 'Corticosteroid', commonDosageMg: 4 },
  { name: 'Methylprednisolone', cid: 6741, category: 'Corticosteroid', commonDosageMg: 4 },

  // Anticonvulsants / Nerve pain
  { name: 'Gabapentin', cid: 3446, category: 'Anticonvulsant', commonDosageMg: 300 },
  { name: 'Pregabalin', cid: 5486971, category: 'Anticonvulsant', commonDosageMg: 75 },
  { name: 'Lamotrigine', cid: 3878, category: 'Anticonvulsant', commonDosageMg: 25 },
  { name: 'Topiramate', cid: 5284627, category: 'Anticonvulsant', commonDosageMg: 25 },
  { name: 'Valproic Acid', cid: 3121, category: 'Anticonvulsant', commonDosageMg: 250 },
  { name: 'Carbamazepine', cid: 2554, category: 'Anticonvulsant', commonDosageMg: 200 },
  { name: 'Levetiracetam', cid: 441341, category: 'Anticonvulsant', commonDosageMg: 500 },

  // Muscle relaxants / Pain
  { name: 'Cyclobenzaprine', cid: 2895, category: 'Muscle Relaxant', commonDosageMg: 10 },
  { name: 'Baclofen', cid: 2284, category: 'Muscle Relaxant', commonDosageMg: 10 },
  { name: 'Tizanidine', cid: 5487, category: 'Muscle Relaxant', commonDosageMg: 4 },
  { name: 'Tramadol', cid: 33741, category: 'Opioid Analgesic', commonDosageMg: 50 },

  // Migraine
  { name: 'Sumatriptan', cid: 5358, category: 'Triptan', commonDosageMg: 50 },
  { name: 'Rizatriptan', cid: 5078, category: 'Triptan', commonDosageMg: 10 },

  // Supplements / OTC
  { name: 'Melatonin', cid: 896, category: 'Supplement', commonDosageMg: 3 },
  { name: 'Caffeine', cid: 2519, category: 'Stimulant', commonDosageMg: 100 },
  { name: 'Vitamin D3', cid: 5280795, category: 'Supplement', commonDosageMg: 50 },

  // Opioids (common Rx)
  { name: 'Hydrocodone', cid: 5284569, category: 'Opioid', commonDosageMg: 5 },
  { name: 'Oxycodone', cid: 5284603, category: 'Opioid', commonDosageMg: 5 },
  { name: 'Codeine', cid: 2703, category: 'Opioid', commonDosageMg: 30 },
  { name: 'Morphine', cid: 5288826, category: 'Opioid', commonDosageMg: 15 },

  // Erectile dysfunction
  { name: 'Sildenafil', cid: 5212, category: 'PDE5 Inhibitor', commonDosageMg: 50 },
  { name: 'Tadalafil', cid: 110635, category: 'PDE5 Inhibitor', commonDosageMg: 10 },

  // Gout
  { name: 'Allopurinol', cid: 2094, category: 'Xanthine Oxidase Inhibitor', commonDosageMg: 100 },
  { name: 'Colchicine', cid: 6167, category: 'Anti-gout', commonDosageMg: 0.6 },

  // Immunosuppressants
  { name: 'Methotrexate', cid: 126941, category: 'Immunosuppressant', commonDosageMg: 7.5 },
  { name: 'Hydroxychloroquine', cid: 3652, category: 'DMARD', commonDosageMg: 200 },

  // Prostate
  { name: 'Tamsulosin', cid: 129211, category: 'Alpha Blocker', commonDosageMg: 0.4 },
  { name: 'Finasteride', cid: 57363, category: '5-Alpha Reductase Inhibitor', commonDosageMg: 5 },

  // Antifungals
  { name: 'Fluconazole', cid: 3365, category: 'Antifungal', commonDosageMg: 150 },
  { name: 'Terbinafine', cid: 1549008, category: 'Antifungal', commonDosageMg: 250 },

  // Antivirals
  { name: 'Acyclovir', cid: 135398513, category: 'Antiviral', commonDosageMg: 400 },
  { name: 'Valacyclovir', cid: 60773, category: 'Antiviral', commonDosageMg: 500 },
  { name: 'Oseltamivir', cid: 65028, category: 'Antiviral', commonDosageMg: 75 },
];

// ─── PubChem API helpers ─────────────────────────────────────────────

const PUGVIEW_BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound';
const PUG_BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json();
}

/**
 * Extract half-life text from PUGView pharmacology data.
 * Returns the raw text string(s) from the "Biological Half-Life" section.
 */
function extractHalfLifeTexts(pugViewData) {
  if (!pugViewData?.Record?.Section) return [];
  const texts = [];

  function walkSections(sections) {
    for (const section of sections) {
      if (section.TOCHeading === 'Biological Half-Life' || section.TOCHeading === 'Half-Life') {
        if (section.Information) {
          for (const info of section.Information) {
            const strs = info.Value?.StringWithMarkup;
            if (strs) {
              for (const s of strs) {
                if (s.String) texts.push(s.String);
              }
            }
          }
        }
      }
      if (section.Section) {
        walkSections(section.Section);
      }
    }
  }

  walkSections(pugViewData.Record.Section);
  return texts;
}

/**
 * Parse half-life from text strings. Returns midpoint in minutes.
 * Handles formats like:
 *   "2 hours", "1.8-2 hours", "~7h", "6-7 days", "20-50 min",
 *   "The half-life is approximately 12 hours."
 */
function parseHalfLife(texts) {
  for (const text of texts) {
    // Look for patterns like "X-Y hours", "X hours", "X ± Y hours", etc.
    const patterns = [
      // "1.8-2 hours" or "1.8 to 2 hours" or "1.8–2 hours"
      /(\d+\.?\d*)\s*(?:to|-|–)\s*(\d+\.?\d*)\s*(hours?|hr|h|minutes?|min|days?|d)\b/i,
      // "5 ± 2 hours" or "7.05±1.54 hours" — take the central value
      /(\d+\.?\d*)\s*[±]\s*\d+\.?\d*\s*(hours?|hr|h|minutes?|min|days?|d)\b/i,
      // "2.6 and 2.5 hours" — take average
      /(\d+\.?\d*)\s+and\s+(\d+\.?\d*)\s*(hours?|hr|h|minutes?|min|days?|d)\b/i,
      // "approximately 12 hours" or "about 2 hours"
      /(?:approximately|about|~|around|roughly|is\s+of)\s*(\d+\.?\d*)\s*(hours?|hr|h|minutes?|min|days?|d)\b/i,
      // "half-life of 2 hours" or "half-life is 12 hours" or "half life was 2.6"
      /half[- ]?life\s+(?:of|is|was|=|:)\s*(?:approximately\s+)?(\d+\.?\d*)\s*(hours?|hr|h|minutes?|min|days?|d)\b/i,
      // "X.Y hours" — bare number + unit (last resort, broader match)
      /(\d+\.?\d*)\s*(hours?|hr|h|minutes?|min|days?|d)(?:[\s,.\);]|$)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let value;
        const unit = match[match.length - 1].toLowerCase();

        if (match.length === 4 && match[2] && !isNaN(parseFloat(match[2]))) {
          // Range or "X and Y": take midpoint
          const low = parseFloat(match[1]);
          const high = parseFloat(match[2]);
          value = (low + high) / 2;
        } else {
          value = parseFloat(match[1]);
        }

        if (isNaN(value) || value <= 0) continue;

        // Convert to minutes
        if (unit.startsWith('hour') || unit === 'hr' || unit === 'h') {
          return Math.round(value * 60);
        } else if (unit.startsWith('min')) {
          return Math.round(value);
        } else if (unit.startsWith('day') || unit === 'd') {
          return Math.round(value * 24 * 60);
        }
      }
    }
  }
  return null;
}

/**
 * Build a human-readable half-life label from the raw text.
 */
function buildHalfLifeLabel(texts) {
  for (const text of texts) {
    // Try to extract a clean range like "1.8–2h" or "12h"
    const rangeMatch = text.match(/(\d+\.?\d*)\s*(?:to|-|–)\s*(\d+\.?\d*)\s*(hours?|hr|h|minutes?|min|days?|d)\b/i);
    if (rangeMatch) {
      const unit = rangeMatch[3].toLowerCase();
      const unitLabel = unit.startsWith('hour') || unit === 'hr' || unit === 'h' ? 'h'
        : unit.startsWith('min') ? 'min'
        : unit.startsWith('day') || unit === 'd' ? ' days' : unit;
      return `${rangeMatch[1]}–${rangeMatch[2]}${unitLabel}`;
    }

    // "5 ± 2 hours" → "~5h"
    const pmMatch = text.match(/(\d+\.?\d*)\s*[±]\s*\d+\.?\d*\s*(hours?|hr|h|minutes?|min|days?|d)\b/i);
    if (pmMatch) {
      const unit = pmMatch[2].toLowerCase();
      const unitLabel = unit.startsWith('hour') || unit === 'hr' || unit === 'h' ? 'h'
        : unit.startsWith('min') ? 'min'
        : unit.startsWith('day') || unit === 'd' ? ' days' : unit;
      return `~${pmMatch[1]}${unitLabel}`;
    }

    const singleMatch = text.match(/(?:approximately|about|~|around)?\s*(\d+\.?\d*)\s*(hours?|hr|h|minutes?|min|days?|d)\b/i);
    if (singleMatch) {
      const unit = singleMatch[2].toLowerCase();
      const unitLabel = unit.startsWith('hour') || unit === 'hr' || unit === 'h' ? 'h'
        : unit.startsWith('min') ? 'min'
        : unit.startsWith('day') || unit === 'd' ? ' days' : unit;
      return `~${singleMatch[1]}${unitLabel}`;
    }
  }
  return null;
}

/**
 * Fetch brand names from PubChem synonyms API.
 * Filters to likely brand names (capitalized, short, no chemical nomenclature).
 */
async function fetchBrandNames(cid) {
  const data = await fetchJSON(`${PUG_BASE}/cid/${cid}/synonyms/JSON`);
  if (!data?.InformationList?.Information?.[0]?.Synonym) return [];

  const synonyms = data.InformationList.Information[0].Synonym;
  const brands = [];
  const seen = new Set();

  for (const syn of synonyms.slice(0, 100)) { // Only check first 100
    // Skip CAS numbers, chemical names, formulas
    if (/^\d+[-\d]+$/.test(syn)) continue;             // CAS numbers
    if (/^[A-Z]{2,}-\d+/.test(syn)) continue;          // Registry codes
    if (syn.includes('(') && syn.includes(')')) continue; // Chemical notation
    if (syn.length > 25) continue;                        // Too long = chemical name
    if (/acid|yl |oxy|phenyl|propan|benz|meth|eth/i.test(syn)) continue; // Chemical
    if (/^[a-z]/.test(syn)) continue;                    // Lowercase = generic
    if (syn === syn.toUpperCase() && syn.length > 5) continue; // ALL CAPS codes

    const normalized = syn.trim();
    const lower = normalized.toLowerCase();
    if (!seen.has(lower) && normalized.length >= 3) {
      seen.add(lower);
      brands.push(normalized);
      if (brands.length >= 5) break; // Max 5 brand names
    }
  }

  return brands;
}

// ─── Manual fallbacks for drugs PubChem doesn't have structured half-life for ─
// Sources: FDA labeling, clinical pharmacology textbooks.
// ─── Data corrections: PubChem sometimes returns metabolite/extended-release values ─
// These override the parsed PubChem value with the correct immediate-release parent drug value.
const DATA_CORRECTIONS = {
  acetaminophen: { halfLifeMinutes: 150,  halfLifeLabel: '2–3h' },     // PubChem returns 4-8h (overdose/hepatic impairment range)
  diclofenac:    { halfLifeMinutes: 120,  halfLifeLabel: '~2h' },      // PubChem returns 25-33h (enteric-coated/sustained release)
  dexamethasone: { halfLifeMinutes: 240,  halfLifeLabel: '3–5h' },     // Plasma half-life (bio half-life 36-54h is different)
  hydroxychloroquine: { halfLifeMinutes: 2400, halfLifeLabel: '32–50 days' }, // PubChem 3-4h is clearance phase, terminal is 40 days
  apixaban:      { halfLifeMinutes: 720,  halfLifeLabel: '~12h' },     // Standardize
  aripiprazole:  { halfLifeMinutes: 4500, halfLifeLabel: '~75h' },     // PubChem returned ~61h, FDA label says 75h
};

const MANUAL_FALLBACKS = {
  rivaroxaban:     { halfLifeMinutes: 7 * 60,    halfLifeLabel: '5–9h',    brands: ['Xarelto'] },
  olanzapine:      { halfLifeMinutes: 33 * 60,   halfLifeLabel: '21–54h',  brands: ['Zyprexa'] },
  omeprazole:      { halfLifeMinutes: 60,         halfLifeLabel: '0.5–1h',  brands: ['Prilosec'] },
  esomeprazole:    { halfLifeMinutes: 78,         halfLifeLabel: '1–1.5h',  brands: ['Nexium'] },
  famotidine:      { halfLifeMinutes: 180,        halfLifeLabel: '2.5–3.5h', brands: ['Pepcid'] },
  doxycycline:     { halfLifeMinutes: 18 * 60,    halfLifeLabel: '18–22h',  brands: ['Vibramycin'] },
  clindamycin:     { halfLifeMinutes: 150,        halfLifeLabel: '2–3h',    brands: ['Cleocin'] },
  levetiracetam:   { halfLifeMinutes: 7 * 60,     halfLifeLabel: '6–8h',    brands: ['Keppra'] },
  rizatriptan:     { halfLifeMinutes: 150,        halfLifeLabel: '2–3h',    brands: ['Maxalt'] },
  codeine:         { halfLifeMinutes: 180,        halfLifeLabel: '2.5–3h',  brands: ['Tylenol #3'] },
  sildenafil:      { halfLifeMinutes: 240,        halfLifeLabel: '3–5h',    brands: ['Viagra'] },
  allopurinol:     { halfLifeMinutes: 90,         halfLifeLabel: '1–2h',    brands: ['Zyloprim'] },
  valacyclovir:    { halfLifeMinutes: 180,        halfLifeLabel: '2.5–3.3h', brands: ['Valtrex'] },
};

// ─── Main pipeline ───────────────────────────────────────────────────

async function main() {
  console.log(`Fetching PubChem data for ${DRUGS.length} drugs...\n`);

  const results = [];
  let fetched = 0;
  let failed = 0;
  let noHalfLife = 0;

  for (const drug of DRUGS) {
    process.stdout.write(`[${fetched + 1}/${DRUGS.length}] ${drug.name}...`);

    try {
      // Fetch pharmacology data + synonyms in parallel
      const [pugView, brands] = await Promise.all([
        fetchJSON(`${PUGVIEW_BASE}/${drug.cid}/JSON?heading=Pharmacology+and+Biochemistry`),
        fetchBrandNames(drug.cid),
      ]);

      const halfLifeTexts = extractHalfLifeTexts(pugView);
      const halfLifeMinutes = parseHalfLife(halfLifeTexts);
      const halfLifeLabel = buildHalfLifeLabel(halfLifeTexts);

      const drugId = drug.name.toLowerCase().replace(/\s+/g, '_');
      const fallback = MANUAL_FALLBACKS[drugId];
      const correction = DATA_CORRECTIONS[drugId];

      // Apply correction if exists
      const finalHL = correction?.halfLifeMinutes ?? halfLifeMinutes;
      const finalLabel = correction?.halfLifeLabel ?? halfLifeLabel;

      if (finalHL) {
        results.push({
          id: drugId,
          name: drug.name,
          brands: brands.length > 0 ? brands : (fallback?.brands || []),
          halfLifeMinutes: finalHL,
          halfLifeLabel: finalLabel || `~${Math.round(finalHL / 60)}h`,
          commonDosageMg: drug.commonDosageMg,
          category: drug.category,
        });
        const corrected = correction ? ' (corrected)' : '';
        console.log(` ${finalLabel || finalHL + 'min'}${corrected} | ${brands.slice(0, 3).join(', ') || 'no brands'}`);
      } else if (fallback) {
        results.push({
          id: drugId,
          name: drug.name,
          brands: brands.length > 0 ? brands : fallback.brands,
          halfLifeMinutes: fallback.halfLifeMinutes,
          halfLifeLabel: fallback.halfLifeLabel,
          commonDosageMg: drug.commonDosageMg,
          category: drug.category,
        });
        console.log(` ${fallback.halfLifeLabel} (manual fallback) | ${(brands.length > 0 ? brands : fallback.brands).slice(0, 3).join(', ')}`);
      } else {
        noHalfLife++;
        console.log(` NO HALF-LIFE DATA — skipped`);
        if (halfLifeTexts.length > 0) {
          console.log(`    Raw text: "${halfLifeTexts[0].substring(0, 120)}..."`);
        }
      }
    } catch (err) {
      failed++;
      console.log(` ERROR: ${err.message}`);
    }

    fetched++;
    // Rate limit: ~3 requests/second (we made 2 above)
    await sleep(350);
  }

  // Sort by category then name
  results.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  // Generate TypeScript
  const ts = generateTypeScript(results);
  writeFileSync(OUTPUT, ts, 'utf-8');

  console.log(`\n─── Done ───`);
  console.log(`  Fetched: ${fetched}`);
  console.log(`  With half-life: ${results.length}`);
  console.log(`  No half-life: ${noHalfLife}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Output: ${OUTPUT}`);
}

function generateTypeScript(entries) {
  const lines = entries.map((e) => {
    const brands = e.brands.map((b) => `'${b.replace(/'/g, "\\'")}'`).join(', ');
    const label = e.halfLifeLabel.replace(/'/g, "\\'");
    return `  { id: '${e.id}', name: '${e.name}', brands: [${brands}], halfLifeMinutes: ${e.halfLifeMinutes}, halfLifeLabel: '${label}', commonDosageMg: ${e.commonDosageMg}, category: '${e.category}' },`;
  });

  return `/**
 * Curated drug half-life database.
 * AUTO-GENERATED by scripts/build-drug-db.mjs from PubChem PUGView data.
 * Do not edit manually — re-run the script to update.
 *
 * Last built: ${new Date().toISOString().split('T')[0]}
 * Source: PubChem PUGView REST API (https://pubchem.ncbi.nlm.nih.gov)
 * Drugs: ${entries.length}
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
${lines.join('\n')}
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
`;
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
