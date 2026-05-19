// Aggressive extractor for 173 unresolved questions
// Tries many OCR-aware patterns and scores confidence

const fs = require('fs');
const path = require('path');
const data = require('../src/data.json');

const UNRESOLVED = [
  63,65,66,73,74,76,78,79,80,81,82,85,90,91,95,97,103,104,106,108,109,113,
  115,118,119,126,140,146,148,155,157,165,167,170,177,182,188,191,194,195,
  199,201,202,209,217,220,224,231,235,236,239,241,243,244,245,250,252,255,
  256,257,258,259,261,263,265,266,271,272,274,280,281,287,288,299,300,305,
  309,311,313,314,316,318,319,323,328,329,330,331,334,335,336,337,338,339,
  340,344,346,347,349,350,351,353,355,356,357,358,362,363,367,368,369,370,
  371,373,374,375,376,378,379,384,385,386,388,389,390,392,395,398,401,403,
  407,408,409,413,415,417,420,422,425,426,429,430,431,432,433,435,437,438,
  439,440,441,442,443,444,445,446,447,448,449,450,451,452,453,454,455,456,
  457,458,459,460,461,462,463
];

// Each pattern returns { letters: string[], confidence: 'high'|'medium'|'low', source: string }
const PATTERNS = [
  // HIGH confidence — explicit markers
  {
    confidence: 'high', source: 'explicit-answer-colon',
    fn: t => { const m = t.match(/(?:Correct\s+)?Answer[.:]\s*([A-F](?:[,\s]+[A-F])*)/i);
      if (m) return clean(m[1]); }
  },
  {
    confidence: 'high', source: 'answer-is-letter',
    fn: t => { const m = t.match(/[Aa]nswer\s+is\s*:?\s*([A-F](?:[,\s]+[A-F])*)/i);
      if (m) return clean(m[1]); }
  },
  {
    confidence: 'high', source: 'letter-is-correct',
    fn: t => { const m = t.match(/\b([A-F])\s+is\s+(?:the\s+)?correct/i);
      if (m) return [m[1].toUpperCase()]; }
  },
  // HIGH — underscore prefix = selected answer marker in these OCR dumps
  // e.g. "_ B. interface..." or "_B." at start of line
  {
    confidence: 'high', source: 'underscore-prefix',
    fn: t => {
      const matches = [];
      const lines = t.split('\n');
      for (const line of lines) {
        const m = line.match(/^[\s_]+([A-F])\.\s/);
        if (m) matches.push(m[1].toUpperCase());
      }
      // Only trust if exactly 1 match (unambiguous selected option)
      if (matches.length === 1) return matches;
    }
  },
  // MEDIUM — OCR-corrupted answer words
  {
    confidence: 'medium', source: 'ocr-corrupted-answer-word',
    fn: t => { const m = t.match(/(?:Anne|Ansvwer|Ansvvor|Answ|Ans|Anwser|Anser)[.:\s]+([A-F]{1,3})(?:\s|$|\n)/i);
      if (m) return clean(m[1]); }
  },
  // MEDIUM — standalone "Answer X" without colon, anywhere
  {
    confidence: 'medium', source: 'answer-space-letter',
    fn: t => { const m = t.match(/\bAnswer\s+([A-F]{1,3})\b/i);
      if (m) return clean(m[1]); }
  },
  // MEDIUM — "correct: X" shorthand
  {
    confidence: 'medium', source: 'correct-colon-letter',
    fn: t => { const m = t.match(/[Cc]orrect[:\s]+([A-F]{1,3})(?:\s|$|\n)/);
      if (m) return clean(m[1]); }
  },
  // MEDIUM — letter at absolute start of a line followed by dot+space (not "O A." style)
  // The answer page often shows correct option without the radio "O" prefix
  {
    confidence: 'medium', source: 'line-start-letter-dot',
    fn: t => {
      const lines = t.split('\n');
      const hits = [];
      for (const line of lines) {
        const trimmed = line.trimStart();
        // Match lines like "B. interface..." but NOT "O B." (radio button)
        if (/^[A-F]\.\s/.test(trimmed) && !/^O\s+[A-F]\./.test(trimmed)) {
          const letter = trimmed[0].toUpperCase();
          hits.push(letter);
        }
      }
      // If only 1 letter found this way, it's likely the correct one
      if (hits.length === 1) return hits;
      // If multiple, could be multi-select — check if ≤3
      if (hits.length >= 2 && hits.length <= 3) return hits;
    }
  },
  // LOW — last standalone letter A-F on a line by itself
  {
    confidence: 'low', source: 'solo-letter-line',
    fn: t => {
      const lines = t.split('\n').reverse();
      for (const line of lines) {
        const m = line.trim().match(/^([A-F])$/i);
        if (m) return [m[1].toUpperCase()];
      }
    }
  },
];

function clean(str) {
  return str.replace(/[\s,]/g, '').split('').filter(c => /[A-F]/i.test(c)).map(c => c.toUpperCase());
}

function tryExtract(text) {
  if (!text) return null;
  for (const p of PATTERNS) {
    try {
      const result = p.fn(text);
      if (result && result.length > 0 && result.length <= 4) {
        return { letters: result, confidence: p.confidence, source: p.source };
      }
    } catch(e) {}
  }
  return null;
}

const resolved   = {};
const uncertain  = {};
const failed     = [];

for (const id of UNRESOLVED) {
  const q = data.find(x => x.id === id);
  if (!q) { failed.push(id); continue; }

  const combined = (q.answerText || '') + '\n' + (q.questionText || '');
  const result = tryExtract(combined);

  if (!result) {
    failed.push(id);
  } else if (result.confidence === 'high') {
    resolved[id] = result.letters.join('');
  } else {
    // medium/low go to uncertain for manual review
    uncertain[id] = {
      candidates: result.letters,
      confidence: result.confidence,
      source: result.source
    };
  }
}

const output = { resolved, uncertain, failed };

fs.writeFileSync(
  path.join(__dirname, 'extracted_answers.json'),
  JSON.stringify(output, null, 2)
);

console.log(`\n=== Aggressive Extractor Results ===`);
console.log(`High-confidence resolved : ${Object.keys(resolved).length}`);
console.log(`Uncertain (need review)  : ${Object.keys(uncertain).length}`);
console.log(`Failed (image-only)      : ${failed.length}`);
console.log(`Total processed          : ${UNRESOLVED.length}`);
console.log(`\nSaved → scripts/extracted_answers.json`);
