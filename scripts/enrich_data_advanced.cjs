// Advanced regex parser to extract correct answers from noisy answerText
// Handles multiple variations of OCR errors like "Anne C", "Answer A", "Ansvwer B"

const fs = require('fs');
const path = require('path');
const data = require('../src/data.json');

// Load external answers
const codexAnswersPath = path.join(__dirname, 'codex_answers.json');
const dragDropAnswersPath = path.join(__dirname, 'drag_drop_answers.json');

let codexAnswers = {};
let dragDropAnswers = {};

if (fs.existsSync(codexAnswersPath)) {
  codexAnswers = require(codexAnswersPath);
}

if (fs.existsSync(dragDropAnswersPath)) {
  dragDropAnswers = require(dragDropAnswersPath);
}

// Manually verified answers from AI image analysis
const manualAnswers = {
  7:"B", 14:"B", 17:"B", 18:"C", 19:"B", 21:"D", 23:"AC", 24:"B", 25:"C",
  27:"D", 29:"B", 31:"B", 33:"B", 35:"A", 36:"A", 48:"B", 50:"B",
  52:"A", 54:"C", 56:"A", 57:"C", 58:"D", 59:"A", 61:"D", 62:"B",
  63:"A", 65:"C", 66:"A", 73:"D", 74:"A", 76:"B", 78:"B", 79:"A",
  80:"C", 81:"B", 82:"C", 85:"A", 90:"D", 91:"A", 95:"A", 97:"D",
  103:"B", 104:"C", 106:"C", 108:"D", 109:"C", 113:"CD", 115:"B", 118:"C", 119:"A",
  126:"C", 140:"AD", 146:"D", 148:"BD", 155:"A", 157:"C", 165:"C", 167:"A", 170:"A", 
  177:"B", 182:"A", 183:"A", 185:"C", 188:"D", 191:"C", 194:"B", 195:"C", 196:"C",
  199:"A", 201:"D", 202:"B", 209:"D", 217:"A", 220:"D", 224:"B", 231:"B", 235:"B",
  236:"C", 239:"B", 241:"D", 243:"B", 244:"B", 245:"A", 250:"DE", 252:"A", 255:"C",
  256:"C", 257:"B", 258:"A", 259:"B", 261:"C", 263:"C", 265:"B", 266:"A", 271:"BE",
  272:"C", 274:"D", 280:"D", 281:"C", 287:"D", 288:"B", 299:"D"
};

// Merge Codex Answers into manualAnswers
for (const [id, answerArray] of Object.entries(codexAnswers)) {
  manualAnswers[id] = answerArray.join('');
}

// Patterns to try in order
const patterns = [
  // Standard Answer: X
  /Answer[.:]\s*([A-F,\s]+)/i,
  // Correct Answer: X
  /Correct\s*Answer[.:]\s*([A-F,\s]+)/i,
  // OCR corrupted Answer words: Anne, Ansvwer, Ans, Answ, etc.
  /(?:Answer|Correct Answer|Anne|Ansvwer|Ans|Answ|Anwser)[.:\s]+([A-F]{1,3})(?:\s|$|\n)/i,
  // Standalone "Answer X" at the end of text
  /\bAnswer\s+([A-F]{1,3})\b/i,
  // OCR corrupted like "Anne C" or "Ansvvor B"
  /\b(?:Anne|Ansvwer|Ansvvor|Answ|Ans)\s+([A-F]{1,3})\b/i
];

let resolved = 0;
let unresolved = 0;
const unresolvedIds = [];

const enriched = data.map(q => {
  let correctAnswer = null;
  let dragDropData = null;
  
  // Priority 1: Drag and Drop questions
  if (dragDropAnswers[q.id]) {
    dragDropData = dragDropAnswers[q.id];
    correctAnswer = 'DRAG_DROP';
  }
  
  // Priority 2: Manual AI-verified
  if (!dragDropData && manualAnswers[q.id]) {
    correctAnswer = manualAnswers[q.id];
  }

  // Priority 3: Try regex patterns on answerText
  if (!correctAnswer && q.answerText) {
    for (const pat of patterns) {
      const match = q.answerText.match(pat);
      if (match) {
        // Clean up match
        const clean = match[1].replace(/[\s,]/g, '').split('').filter(c => /[A-F]/i.test(c)).map(c => c.toUpperCase());
        if (clean.length > 0 && clean.length <= 4) { // sanity check
          correctAnswer = clean.join('');
          break;
        }
      }
    }
  }

  // Priority 4: Try regex patterns on questionText (sometimes OCR put answer at the bottom of questionText)
  if (!correctAnswer && q.questionText) {
    for (const pat of patterns) {
      const match = q.questionText.match(pat);
      if (match) {
        const clean = match[1].replace(/[\s,]/g, '').split('').filter(c => /[A-F]/i.test(c)).map(c => c.toUpperCase());
        if (clean.length > 0 && clean.length <= 4) {
          correctAnswer = clean.join('');
          break;
        }
      }
    }
  }

  // Priority 5: Labs
  if (!correctAnswer && q.isLab) {
    correctAnswer = null;
    resolved++;
  } else if (correctAnswer) {
    resolved++;
  } else {
    unresolved++;
    unresolvedIds.push(q.id);
  }

  // Determine optionCount from correctAnswer
  let optionCount = 4;
  if (correctAnswer && correctAnswer !== 'DRAG_DROP') {
    const letters = correctAnswer.split('');
    let maxCode = 'D'.charCodeAt(0);
    letters.forEach(l => {
      if (l.charCodeAt(0) > maxCode) maxCode = l.charCodeAt(0);
    });
    optionCount = maxCode - 'A'.charCodeAt(0) + 1;
  }

  const result = {
    ...q,
    correctAnswer: correctAnswer === 'DRAG_DROP' ? null : (correctAnswer || null),
    optionCount
  };
  
  if (dragDropData) {
    result.type = dragDropData.type;
    result.dragDropData = dragDropData;
  }
  
  return result;
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

console.log('\nSaved advanced enriched data.json');
