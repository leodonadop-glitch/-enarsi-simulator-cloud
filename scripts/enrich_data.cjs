// Build enriched data.json with correctAnswer and optionCount
// Combines: 1) parsed answerText, 2) AI-verified manual answers, 3) image analysis fallbacks

const fs = require('fs');
const path = require('path');
const data = require('../src/data.json');

// Manually verified answers from AI image analysis
const manualAnswers = {
  7:"B", 14:"B", 17:"B", 18:"C", 19:"B", 21:"D", 23:"AC", 24:"B", 25:"C",
  27:"D", 29:"B", 31:"B", 33:"B", 35:"A", 36:"A", 48:"B", 50:"B",
  52:"A", 54:"C", 56:"A", 57:"C", 58:"D", 59:"A", 61:"D", 62:"B",
};

// Extract from answerText
function extractFromText(text) {
  if (!text) return null;
  const match = text.match(/Answer[.:]\s*([A-F,\s]+)/i);
  if (!match) return null;
  const letters = match[1].replace(/[\s,]/g, '').split('').filter(c => /[A-F]/i.test(c)).map(c => c.toUpperCase());
  return letters.length > 0 ? letters.join('') : null;
}

let resolved = 0;
let unresolved = 0;
const unresolvedIds = [];

const enriched = data.map(q => {
  let correctAnswer = null;
  
  // Priority 1: Manual AI-verified
  if (manualAnswers[q.id]) {
    correctAnswer = manualAnswers[q.id];
    resolved++;
  }
  // Priority 2: Parse from answerText
  if (!correctAnswer) {
    correctAnswer = extractFromText(q.answerText);
    if (correctAnswer) resolved++;
  }
  // Priority 3: Labs don't need answers
  if (!correctAnswer && q.isLab) {
    correctAnswer = null; // Labs are fine without
    resolved++;
  }
  
  if (!correctAnswer && !q.isLab) {
    unresolved++;
    unresolvedIds.push(q.id);
  }

  // Determine optionCount from correctAnswer
  let optionCount = 4;
  if (correctAnswer) {
    const letters = correctAnswer.split('');
    let maxCode = 'D'.charCodeAt(0);
    letters.forEach(l => {
      if (l.charCodeAt(0) > maxCode) maxCode = l.charCodeAt(0);
    });
    optionCount = maxCode - 'A'.charCodeAt(0) + 1;
  }

  return {
    ...q,
    correctAnswer: correctAnswer || null,
    optionCount
  };
});

console.log(`Total: ${data.length}`);
console.log(`Resolved: ${resolved}`);
console.log(`Unresolved: ${unresolved}`);
if (unresolvedIds.length > 0) {
  console.log(`Unresolved IDs: ${unresolvedIds.join(', ')}`);
}

// Save enriched data
fs.writeFileSync(
  path.join(__dirname, '..', 'src', 'data.json'),
  JSON.stringify(enriched, null, 2)
);

console.log('\nSaved enriched data.json');
