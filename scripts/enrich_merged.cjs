// Merge aggressive extraction results into manualAnswers and re-enrich data.json
// Rules:
//   1. High-confidence resolved → always apply
//   2. line-start-letter-dot with [MULTI-SELECT] in questionText → apply as multi
//   3. solo-letter-line → skip (OCR too noisy, not reliable enough)
//   4. line-start-letter-dot single choice with 2 candidates → skip (ambiguous)

const fs = require('fs');
const path = require('path');
const data = require('../src/data.json');
const extracted = require('./extracted_answers.json');

// ---- Existing manual answers (already verified) ----
const manualAnswers = {
  7:"B", 14:"B", 17:"B", 18:"C", 19:"B", 21:"D", 23:"AC", 24:"B", 25:"C",
  27:"D", 29:"B", 31:"B", 33:"B", 35:"A", 36:"A", 48:"B", 50:"B",
  52:"A", 54:"C", 56:"A", 57:"C", 58:"D", 59:"A", 61:"D", 62:"B",
};

// ---- Merge high-confidence from extractor ----
for (const [id, letters] of Object.entries(extracted.resolved)) {
  const numId = parseInt(id);
  if (!manualAnswers[numId]) {
    manualAnswers[numId] = letters;
  }
}

// ---- Merge confirmed multi-selects from uncertain ----
for (const [id, v] of Object.entries(extracted.uncertain)) {
  const numId = parseInt(id);
  if (manualAnswers[numId]) continue; // already known

  if (v.source === 'line-start-letter-dot') {
    const q = data.find(x => x.id === numId);
    const isMulti = /choose\s+two|choose\s+2|choose\s+three|choose\s+3/i.test(q?.questionText || '');
    if (isMulti && v.candidates.length >= 2 && v.candidates.length <= 3) {
      manualAnswers[numId] = v.candidates.join('');
    }
  }
  // solo-letter-line: skip — not reliable
}

// ---- Re-enrich all data ----
const patterns = [
  /Answer[.:]\s*([A-F,\s]+)/i,
  /Correct\s*Answer[.:]\s*([A-F,\s]+)/i,
  /(?:Answer|Correct Answer|Anne|Ansvwer|Ans|Answ|Anwser)[.:\s]+([A-F]{1,3})(?:\s|$|\n)/i,
  /\bAnswer\s+([A-F]{1,3})\b/i,
  /\b(?:Anne|Ansvwer|Ansvvor|Answ|Ans)\\s+([A-F]{1,3})\b/i,
];

let resolved = 0;
let unresolved = 0;
const unresolvedIds = [];

const enriched = data.map(q => {
  let correctAnswer = null;

  // Priority 1: Manual / AI-verified
  if (manualAnswers[q.id]) {
    correctAnswer = manualAnswers[q.id];
  }

  // Priority 2: Regex on answerText
  if (!correctAnswer && q.answerText) {
    for (const pat of patterns) {
      const match = q.answerText.match(pat);
      if (match) {
        const clean = match[1].replace(/[\s,]/g, '').split('').filter(c => /[A-F]/i.test(c)).map(c => c.toUpperCase());
        if (clean.length > 0 && clean.length <= 4) { correctAnswer = clean.join(''); break; }
      }
    }
  }

  // Priority 3: Regex on questionText
  if (!correctAnswer && q.questionText) {
    for (const pat of patterns) {
      const match = q.questionText.match(pat);
      if (match) {
        const clean = match[1].replace(/[\s,]/g, '').split('').filter(c => /[A-F]/i.test(c)).map(c => c.toUpperCase());
        if (clean.length > 0 && clean.length <= 4) { correctAnswer = clean.join(''); break; }
      }
    }
  }

  // Priority 4: Labs
  if (!correctAnswer && q.isLab) {
    correctAnswer = null;
    resolved++;
  } else if (correctAnswer) {
    resolved++;
  } else {
    unresolved++;
    unresolvedIds.push(q.id);
  }

  let optionCount = 4;
  if (correctAnswer) {
    const letters = correctAnswer.split('');
    let maxCode = 'D'.charCodeAt(0);
    letters.forEach(l => { if (l.charCodeAt(0) > maxCode) maxCode = l.charCodeAt(0); });
    optionCount = maxCode - 'A'.charCodeAt(0) + 1;
  }

  return { ...q, correctAnswer: correctAnswer || null, optionCount };
});

console.log(`Total: ${data.length}`);
console.log(`Resolved: ${resolved}`);
console.log(`Unresolved: ${unresolved}`);
if (unresolvedIds.length > 0) {
  console.log(`Unresolved IDs: ${unresolvedIds.join(', ')}`);
}

fs.writeFileSync(
  path.join(__dirname, '..', 'src', 'data.json'),
  JSON.stringify(enriched, null, 2)
);
console.log('\nSaved merged enriched data.json');
