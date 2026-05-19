// Manually verified answer map from AI image analysis
// Format: { questionId: { answer: "X", opts: 4 } }
// This file will be used to enrich data.json

const manualAnswers = {
  // Already parsed from answerText (243 questions) - these are correct
  // Below are the 227 questions that need manual image review
  // Verified by AI vision analysis of answer images (*.2.png)
  
  7: { answer: "B", opts: 4 },
  14: { answer: "B", opts: 4 },
  17: { answer: "B", opts: 4 },
  18: { answer: "C", opts: 4 },
  19: { answer: "B", opts: 4 },
  21: { answer: "D", opts: 4 },
  23: { answer: "AC", opts: 5 },
  24: { answer: "B", opts: 4 },
  25: { answer: "C", opts: 4 },
  27: { answer: "D", opts: 4 },
  29: { answer: "B", opts: 4 },
  31: { answer: "B", opts: 4 },
  33: { answer: "B", opts: 4 },
  
  // TO BE FILLED by continued image analysis...
};

module.exports = manualAnswers;
