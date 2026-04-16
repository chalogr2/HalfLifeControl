#!/usr/bin/env node
/**
 * Duration-of-Action research fetcher (Phase 2).
 *
 * For each drug in src/data/drugDatabase.ts, pulls RAW evidence from:
 *   1. DailyMed (FDA SPL labels) — primary source
 *      - §2  Dosage and Administration  (LOINC 34068-7)
 *      - §12.2 Pharmacodynamics         (LOINC 43681-6)
 *      - §14 Clinical Studies           (LOINC 34090-1)
 *   2. PubChem PUGView — supplementary context
 *      - Pharmacology heading
 *
 * Outputs `docs/duration-research.md` — raw quotes per drug, side by side,
 * with source URLs. **No parsed values.** A human reviews this file and
 * manually curates durationOfActionMinutes into drugDatabase.ts.
 *
 * Usage:
 *   node scripts/build-duration-db.mjs                  # all drugs
 *   node scripts/build-duration-db.mjs --only clonazepam,concerta
 *   node scripts/build-duration-db.mjs --resume         # skip drugs already in output
 *
 * Rate limit: ~3 req/sec to both APIs (polite).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRUG_DB_PATH = resolve(__dirname, '../src/data/drugDatabase.ts');
const OUTPUT_PATH = resolve(__dirname, '../docs/duration-research.md');

const DAILYMED_BASE = 'https://dailymed.nlm.nih.gov/dailymed/services/v2';
const DAILYMED_LOOKUP = 'https://dailymed.nlm.nih.gov/dailymed/lookup.cfm';
const PUBCHEM_PUGVIEW = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound';

// LOINC codes for SPL sections we care about
const LOINC_DOSAGE_ADMIN = '34068-7';   // §2 Dosage and Administration
const LOINC_PHARMACODYN  = '43681-6';   // §12.2 Pharmacodynamics
const LOINC_CLINICAL     = '34090-1';   // §14 Clinical Studies

const RATE_LIMIT_MS = 350;

// ─── CLI args ───────────────────────────────────────────────────────
const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith('--only'));
const ONLY = onlyArg ? (onlyArg.split('=')[1] || args[args.indexOf(onlyArg) + 1] || '').split(',').map((s) => s.trim()).filter(Boolean) : null;
const RESUME = args.includes('--resume');

// ─── Helpers ────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, { accept = '*/*' } = {}) {
  const res = await fetch(url, { headers: { Accept: accept, 'User-Agent': 'HalfLifeControl-research/1.0' } });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'HalfLifeControl-research/1.0' } });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json();
}

// ─── Drug DB parser ─────────────────────────────────────────────────
/**
 * Parse the hand-curated DRUG_DATABASE array out of drugDatabase.ts via regex.
 * Each entry is on a single line, so this is straightforward.
 */
function loadDrugDatabase() {
  const src = readFileSync(DRUG_DB_PATH, 'utf8');
  const entries = [];

  // Match each object literal entry.
  // id and baseDrugId: simple strings
  // brands: [...] — use a lookahead to stop at the next field marker to tolerate brackets in brand names
  const entryRe = /\{\s*id:\s*'([^']+)',\s*baseDrugId:\s*'([^']+)',\s*name:\s*'([^']+)',\s*brands:\s*(\[.*?\])(?=,\s*formulation:)\s*,\s*formulation:\s*'([^']+)'/g;

  let m;
  while ((m = entryRe.exec(src)) !== null) {
    const [, id, baseDrugId, name, brandsRaw, formulation] = m;
    const brands = [...brandsRaw.matchAll(/'([^']*)'/g)].map((x) => x[1]);
    entries.push({ id, baseDrugId, name, brands, formulation });
  }

  return entries;
}

// ─── Search-query picker ────────────────────────────────────────────
/**
 * Pick the best DailyMed search query for a drug entry.
 * - For IR drugs: search by generic base name (broadest match).
 * - For formulation variants (ER/XR/CR/OROS/etc.): search by the first brand name
 *   (more specific — catches Concerta's OROS label, not generic methylphenidate IR).
 */
function pickSearchQueries(drug) {
  const queries = [];
  if (drug.formulation !== 'IR' && drug.brands.length > 0) {
    // Variant: prioritise brand name(s)
    for (const brand of drug.brands.slice(0, 2)) {
      queries.push(brand);
    }
    queries.push(drug.baseDrugId); // fallback
  } else {
    queries.push(drug.baseDrugId);
    if (drug.brands[0]) queries.push(drug.brands[0]);
  }
  return queries;
}

// ─── DailyMed SPL XML section extraction ────────────────────────────
/**
 * Walk an SPL XML document, find all <section> blocks whose first <code>
 * element matches the given LOINC code, and return their raw XML slices.
 * Handles nested sections via depth counting.
 */
function extractSectionsByLoinc(xml, loincCode) {
  const results = [];
  let pos = 0;

  while (pos < xml.length) {
    const sectionStart = xml.indexOf('<section', pos);
    if (sectionStart === -1) break;

    // Skip if it's actually <sectionXYZ>
    const charAfter = xml[sectionStart + 8];
    if (charAfter !== ' ' && charAfter !== '>' && charAfter !== '\n' && charAfter !== '\r' && charAfter !== '\t') {
      pos = sectionStart + 8;
      continue;
    }

    const openEnd = xml.indexOf('>', sectionStart);
    if (openEnd === -1) break;

    // Look for the first <code code="..."/> within the next ~800 chars (stays within this section's own code)
    const lookahead = xml.slice(openEnd, openEnd + 800);
    const codeMatch = lookahead.match(/<code\s+code="([^"]+)"/);

    if (codeMatch && codeMatch[1] === loincCode) {
      // Find matching </section> via depth counting
      let depth = 1;
      let scan = openEnd + 1;
      while (depth > 0 && scan < xml.length) {
        const nextOpen = xml.indexOf('<section', scan);
        const nextClose = xml.indexOf('</section>', scan);
        if (nextClose === -1) break;
        if (nextOpen !== -1 && nextOpen < nextClose) {
          // Must be a real section open (not <sectionXYZ>)
          const c = xml[nextOpen + 8];
          if (c === ' ' || c === '>' || c === '\n' || c === '\r' || c === '\t') {
            depth++;
          }
          scan = nextOpen + 8;
        } else {
          depth--;
          scan = nextClose + 10;
        }
      }
      results.push(xml.slice(sectionStart, scan));
      pos = scan;
    } else {
      pos = openEnd + 1;
    }
  }
  return results;
}

/**
 * Strip XML tags and decode common entities. Collapses whitespace.
 */
function stripXml(xml) {
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x?[0-9a-fA-F]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pull relevant sentences from a section blob. Prioritises sentences that
 * mention dosing intervals, duration, onset, or time-related pharmacokinetics —
 * these are the signals that let a human curate durationOfActionMinutes.
 */
function distillEvidence(text, { maxChars = 1500 } = {}) {
  if (!text) return '';
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 500);

  const KEYWORDS = /\b(every\s+\d+\s*(?:hour|hr|h|day)|q\d+h|BID|TID|QID|once\s+daily|twice\s+daily|three\s+times|four\s+times|duration|onset|peak|t\s*max|tmax|half[- ]?life|T\s*1\/2|elimination|hours?\s+after|sustained|extended|immediate|prolonged|continuous|steady[- ]state)\b/i;

  const prioritised = sentences.filter((s) => KEYWORDS.test(s));
  const picked = prioritised.length > 0 ? prioritised : sentences;

  let out = '';
  for (const s of picked) {
    if (out.length + s.length + 2 > maxChars) break;
    out += (out ? ' ' : '') + s;
  }
  return out || text.slice(0, maxChars);
}

// ─── DailyMed API ───────────────────────────────────────────────────
async function searchDailyMed(query) {
  const url = `${DAILYMED_BASE}/spls.json?drug_name=${encodeURIComponent(query)}&pagesize=5`;
  const data = await fetchJSON(url);
  if (!data?.data || !Array.isArray(data.data) || data.data.length === 0) return null;
  // Return the top result
  return data.data[0]; // { setid, title, spl_version, ... }
}

async function fetchSplXml(setid) {
  const url = `${DAILYMED_BASE}/spls/${setid}.xml`;
  return fetchText(url);
}

async function collectDailyMedEvidence(drug) {
  const queries = pickSearchQueries(drug);
  let chosen = null;
  let triedQueries = [];

  for (const q of queries) {
    triedQueries.push(q);
    try {
      const result = await searchDailyMed(q);
      await sleep(RATE_LIMIT_MS);
      if (result?.setid) {
        chosen = { query: q, ...result };
        break;
      }
    } catch (err) {
      console.error(`  DailyMed search failed for "${q}": ${err.message}`);
    }
  }

  if (!chosen) {
    return { found: false, queries: triedQueries };
  }

  let xml;
  try {
    xml = await fetchSplXml(chosen.setid);
    await sleep(RATE_LIMIT_MS);
  } catch (err) {
    return { found: false, queries: triedQueries, error: `SPL fetch failed: ${err.message}` };
  }
  if (!xml) {
    return { found: false, queries: triedQueries, error: 'SPL not found' };
  }

  const dosage = extractSectionsByLoinc(xml, LOINC_DOSAGE_ADMIN).map(stripXml).join('\n').slice(0, 8000);
  const pharmacodyn = extractSectionsByLoinc(xml, LOINC_PHARMACODYN).map(stripXml).join('\n').slice(0, 8000);
  const clinical = extractSectionsByLoinc(xml, LOINC_CLINICAL).map(stripXml).join('\n').slice(0, 8000);

  return {
    found: true,
    query: chosen.query,
    setid: chosen.setid,
    title: chosen.title,
    url: `${DAILYMED_LOOKUP}?setid=${chosen.setid}`,
    dosage: distillEvidence(dosage),
    pharmacodyn: distillEvidence(pharmacodyn),
    clinical: distillEvidence(clinical),
  };
}

// ─── PubChem PUGView supplementary ──────────────────────────────────
async function collectPubChemEvidence(drug) {
  // We don't have CIDs for every entry here — search by name instead
  const searchUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(drug.baseDrugId)}/cids/JSON`;
  let cid = null;
  try {
    const s = await fetchJSON(searchUrl);
    await sleep(RATE_LIMIT_MS);
    cid = s?.IdentifierList?.CID?.[0];
  } catch {
    return { found: false };
  }
  if (!cid) return { found: false };

  const pharmUrl = `${PUBCHEM_PUGVIEW}/${cid}/JSON?heading=Pharmacology`;
  let pugview;
  try {
    pugview = await fetchJSON(pharmUrl);
    await sleep(RATE_LIMIT_MS);
  } catch {
    return { found: false, cid };
  }
  if (!pugview) return { found: false, cid };

  // Walk sections and collect any string values under Pharmacology-ish headings
  const texts = [];
  function walk(sections) {
    if (!sections) return;
    for (const section of sections) {
      if (section.Information) {
        for (const info of section.Information) {
          const strs = info.Value?.StringWithMarkup;
          if (strs) for (const s of strs) if (s.String) texts.push(s.String);
        }
      }
      if (section.Section) walk(section.Section);
    }
  }
  walk(pugview?.Record?.Section);

  return {
    found: texts.length > 0,
    cid,
    url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Pharmacology`,
    text: distillEvidence(texts.join(' '), { maxChars: 1200 }),
  };
}

// ─── Markdown rendering ─────────────────────────────────────────────
function renderDrugBlock(drug, daily, pubchem) {
  const lines = [];
  lines.push(`## ${drug.name}`);
  lines.push('');
  lines.push(`- **id:** \`${drug.id}\``);
  lines.push(`- **baseDrugId:** \`${drug.baseDrugId}\``);
  lines.push(`- **formulation:** ${drug.formulation}`);
  if (drug.brands.length > 0) lines.push(`- **brands:** ${drug.brands.join(', ')}`);
  lines.push('');

  // DailyMed
  lines.push('### DailyMed (FDA SPL)');
  if (daily.found) {
    lines.push(`- **Search query used:** \`${daily.query}\``);
    lines.push(`- **SPL title:** ${daily.title}`);
    lines.push(`- **Set ID:** \`${daily.setid}\``);
    lines.push(`- **URL:** ${daily.url}`);
    lines.push('');
    if (daily.dosage) {
      lines.push('**§2 Dosage and Administration:**');
      lines.push('> ' + daily.dosage.replace(/\n/g, '\n> '));
      lines.push('');
    }
    if (daily.pharmacodyn) {
      lines.push('**§12.2 Pharmacodynamics:**');
      lines.push('> ' + daily.pharmacodyn.replace(/\n/g, '\n> '));
      lines.push('');
    }
    if (daily.clinical) {
      lines.push('**§14 Clinical Studies:**');
      lines.push('> ' + daily.clinical.replace(/\n/g, '\n> '));
      lines.push('');
    }
    if (!daily.dosage && !daily.pharmacodyn && !daily.clinical) {
      lines.push('_SPL found but no target sections extracted. Check the label manually at the URL above._');
      lines.push('');
    }
  } else {
    lines.push(`_Not found on DailyMed. Queries tried: ${daily.queries.map((q) => `\`${q}\``).join(', ')}._`);
    if (daily.error) lines.push(`_Error: ${daily.error}_`);
    lines.push('');
  }

  // PubChem
  lines.push('### PubChem PUGView (supplementary)');
  if (pubchem.found) {
    lines.push(`- **CID:** ${pubchem.cid}`);
    lines.push(`- **URL:** ${pubchem.url}`);
    lines.push('');
    lines.push('> ' + pubchem.text.replace(/\n/g, '\n> '));
    lines.push('');
  } else {
    lines.push('_No pharmacology section found._');
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

function renderHeader(total) {
  return `# Duration of Action — Raw Research

**Auto-generated by** \`scripts/build-duration-db.mjs\`.

This file contains **raw evidence only — no parsed values**. For each drug in
\`src/data/drugDatabase.ts\` we pull:

1. **DailyMed (FDA SPL labels)** — the primary source. We extract three sections:
   - §2 Dosage and Administration (LOINC ${LOINC_DOSAGE_ADMIN}) — dosing intervals
   - §12.2 Pharmacodynamics (LOINC ${LOINC_PHARMACODYN}) — onset/duration/receptor data
   - §14 Clinical Studies (LOINC ${LOINC_CLINICAL}) — efficacy-over-time measurements
2. **PubChem PUGView** — supplementary pharmacology context for drugs DailyMed misses.

## How to use this file

1. **Review each drug's quotes.** Look for dosing-interval phrases ("every 6 hours",
   "BID", "q8h") — the FDA-approved interval is your strongest signal for average
   duration of action in a real clinical setting.
2. **Cross-check with pharmacodynamics.** If §12.2 gives onset + peak + a measured
   duration of effect, use that. For variants (ER/OROS/patch), this is where the
   delivery-system data lives.
3. **Curate into** \`src/data/drugDatabase.ts\`. Set \`durationOfActionMinutes\`
   per entry. Record the source URL in \`docs/SOURCES.md\`.
4. **Leave \`null\` if unsure.** The app falls back to 2 × half-life — wrong by a
   little is better than wrong with false confidence.

## Known limitations

- DailyMed returns **one SPL per search**: whichever the registry ranks first.
  For drugs with many manufacturers (generics), this may not be the canonical
  label — verify by opening the URL.
- Section text is **stripped of XML structure** and filtered to sentences
  mentioning time-related pharmacokinetics. The full label is always richer than
  this extract; open the URL when in doubt.
- PubChem PUGView is **not a primary source for duration of action**. Use it
  only as a sanity check.

---

_${total} drug entries processed. Generated ${new Date().toISOString()}._

---

`;
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  const drugs = loadDrugDatabase();
  console.log(`Loaded ${drugs.length} drug entries from ${DRUG_DB_PATH}`);

  let filtered = drugs;
  if (ONLY) {
    filtered = drugs.filter((d) => ONLY.some((o) => d.id === o || d.baseDrugId === o));
    console.log(`--only filter: ${filtered.length} drugs match ${JSON.stringify(ONLY)}`);
  }

  // Resume support: read existing output, skip drugs already rendered
  let existing = '';
  const alreadyDone = new Set();
  if (RESUME && existsSync(OUTPUT_PATH)) {
    existing = readFileSync(OUTPUT_PATH, 'utf8');
    const re = /\*\*id:\*\*\s*`([^`]+)`/g;
    let m;
    while ((m = re.exec(existing)) !== null) alreadyDone.add(m[1]);
    console.log(`--resume: ${alreadyDone.size} drugs already in ${OUTPUT_PATH}`);
    filtered = filtered.filter((d) => !alreadyDone.has(d.id));
  }

  const blocks = [];
  let i = 0;
  for (const drug of filtered) {
    i++;
    console.log(`[${i}/${filtered.length}] ${drug.id} (${drug.formulation})`);

    let daily, pubchem;
    try {
      daily = await collectDailyMedEvidence(drug);
    } catch (err) {
      console.error(`  DailyMed error: ${err.message}`);
      daily = { found: false, queries: pickSearchQueries(drug), error: err.message };
    }
    try {
      pubchem = await collectPubChemEvidence(drug);
    } catch (err) {
      console.error(`  PubChem error: ${err.message}`);
      pubchem = { found: false };
    }

    blocks.push(renderDrugBlock(drug, daily, pubchem));
  }

  let output;
  if (RESUME && existing) {
    // Append new blocks before the end-of-file marker if any, else just append
    output = existing.replace(/\n+$/, '\n') + '\n' + blocks.join('\n');
  } else {
    output = renderHeader(filtered.length) + blocks.join('\n');
  }

  writeFileSync(OUTPUT_PATH, output, 'utf8');
  console.log(`\nWrote ${OUTPUT_PATH} (${blocks.length} new blocks)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
