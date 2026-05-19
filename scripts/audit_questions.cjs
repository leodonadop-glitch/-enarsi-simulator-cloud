// Script to audit all questions and extract correct answers + option counts
// This script analyzes answerText patterns and flags questions needing manual review

const fs = require('fs');
const path = require('path');
const data = require('../src/data.json');

const results = [];
const needsReview = [];

data.forEach(q => {
  const entry = {
    id: q.id,
    isLab: q.isLab || false,
    correctAnswer: null,
    optionCount: 4, // default
    source: null,
    questionImages: q.questionImages || [],
    answerImages: q.answerImages || [],
  };

  // Try to extract from answerText with multiple patterns
  const text = q.answerText || '';
  
  // Pattern 1: "Answer: X" or "Answer: XY"
  let match = text.match(/Answer[.:]\s*([A-F,\s]+)/i);
  if (match) {
    const letters = match[1].replace(/[\s,]/g, '').split('').filter(c => /[A-F]/i.test(c)).map(c => c.toUpperCase());
    if (letters.length > 0) {
      entry.correctAnswer = letters;
      entry.source = 'answerText-pattern1';
    }
  }

  // Pattern 2: "Correct Answer: X"
  if (!entry.correctAnswer) {
    match = text.match(/Correct\s*Answer[.:]\s*([A-F,\s]+)/i);
    if (match) {
      const letters = match[1].replace(/[\s,]/g, '').split('').filter(c => /[A-F]/i.test(c)).map(c => c.toUpperCase());
      if (letters.length > 0) {
        entry.correctAnswer = letters;
        entry.source = 'answerText-pattern2';
      }
    }
  }

  // Pattern 3: Look for "Answer: X" anywhere in the text
  if (!entry.correctAnswer) {
    match = text.match(/(?:^|\n)\s*Answer[.:]\s*([A-F]+)/im);
    if (match) {
      const letters = match[1].split('').filter(c => /[A-F]/i.test(c)).map(c => c.toUpperCase());
      if (letters.length > 0) {
        entry.correctAnswer = letters;
        entry.source = 'answerText-pattern3';
      }
    }
  }

  // Determine option count from correct answer
  if (entry.correctAnswer) {
    let maxCode = 'D'.charCodeAt(0);
    entry.correctAnswer.forEach(l => {
      if (l.charCodeAt(0) > maxCode) maxCode = l.charCodeAt(0);
    });
    entry.optionCount = maxCode - 'A'.charCodeAt(0) + 1;
  }

  if (!entry.correctAnswer && !entry.isLab) {
    needsReview.push(entry);
  }

  results.push(entry);
});

console.log(`Total questions: ${data.length}`);
console.log(`Parsed OK: ${results.filter(r => r.correctAnswer).length}`);
console.log(`Labs (no answer needed): ${results.filter(r => r.isLab).length}`);
console.log(`Needs review: ${needsReview.length}`);
console.log('\nQuestions needing review (IDs):');
console.log(needsReview.map(r => r.id).join(', '));

// Save review list
fs.writeFileSync(
  path.join(__dirname, 'needs_review.json'),
  JSON.stringify(needsReview.map(r => ({ id: r.id, answerImages: r.answerImages })), null, 2)
);

// Save all results
fs.writeFileSync(
  path.join(__dirname, 'audit_results.json'),
  JSON.stringify(results, null, 2)
);

console.log('\nSaved audit_results.json and needs_review.json');
