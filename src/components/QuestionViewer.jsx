import { useMemo, useState, useEffect } from 'react';
import LabCliSimulator from './LabCliSimulator';

// Extract correct answer letter(s) from answerText
function extractCorrectAnswer(answerText) {
  if (!answerText) return [];
  const match = answerText.match(/Answer[.:]\s*([A-E,\s]+)/i);
  if (!match) return [];
  return match[1].replace(/[\s,]/g, '').split('').filter(c => /[A-E]/i.test(c)).map(c => c.toUpperCase());
}

// Extract reference URL from answerText
function extractReference(answerText) {
  if (!answerText) return null;
  const match = answerText.match(/(https?:\/\/[^\s"]+)/i);
  return match ? match[1] : null;
}

// Detect if question is multi-select
function isMultiSelect(questionText) {
  if (!questionText) return false;
  return /choose\s+two|choose\s+three|choose\s+2|choose\s+3/i.test(questionText);
}

// Determine option letters based on the correct answer
// Default: A-D. Expand to E or F only if the correct answer includes those letters.
function getOptionLetters(correctAnswer) {
  let maxCode = 'D'.charCodeAt(0); // minimum is always A-D
  for (const letter of correctAnswer) {
    if (letter.charCodeAt(0) > maxCode) {
      maxCode = letter.charCodeAt(0);
    }
  }
  const result = [];
  for (let i = 'A'.charCodeAt(0); i <= maxCode; i++) {
    result.push(String.fromCharCode(i));
  }
  return result;
}

function QuestionViewer({ question, showAnswer, onShowAnswer, onMarkResult, currentResult, failCount, selectedLetters, onSelectLetter }) {
  const [zoomedImage, setZoomedImage] = useState(null);
  const [selectedLeftBox, setSelectedLeftBox] = useState(null);

  // Close zoom lightbox on Escape key
  useEffect(() => {
    if (!zoomedImage) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setZoomedImage(null);
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleEscape, true); // Use capture phase to intercept before it reaches App.jsx
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [zoomedImage]);

  const enrichedCorrectAnswer = question?.correctAnswer;
  const answerText = question?.answerText;
  const questionText = question?.questionText;
  const optionCount = question?.optionCount;
  const isDragDrop = question?.type === 'drag_and_drop' || question?.type === 'drag_and_drop_code';
  const dragDropData = question?.dragDropData;

  const correctAnswer = useMemo(() => {
    // Priority: use pre-enriched correctAnswer from data.json (set by enrich script)
    if (enrichedCorrectAnswer) {
      return enrichedCorrectAnswer.split('');
    }
    // Fallback: try to extract from answerText
    return extractCorrectAnswer(answerText);
  }, [enrichedCorrectAnswer, answerText]);
  const hasCorrectAnswer = correctAnswer.length > 0;
  const reference = useMemo(() => extractReference(answerText), [answerText]);
  const multiSelect = useMemo(() => isMultiSelect(questionText), [questionText]);
  const optionLetters = useMemo(() => {
    // Use pre-enriched optionCount if available
    if (optionCount) {
      const result = [];
      for (let i = 0; i < optionCount; i++) {
        result.push(String.fromCharCode('A'.charCodeAt(0) + i));
      }
      return result;
    }
    return getOptionLetters(correctAnswer);
  }, [optionCount, correctAnswer]);

  if (!question) return null;

  const isSelected = (letter) => selectedLetters?.includes(letter);

  const handleLetterClick = (letter) => {
    if (showAnswer) return; // Don't allow changes after answer is shown
    if (multiSelect) {
      // Toggle letter
      const current = selectedLetters || [];
      if (current.includes(letter)) {
        onSelectLetter(current.filter(l => l !== letter));
      } else {
        onSelectLetter([...current, letter]);
      }
    } else {
      onSelectLetter([letter]);
    }
  };

  // Drag and Drop mapping handlers
  const currentMapping = useMemo(() => {
    const mapping = {};
    if (isDragDrop && selectedLetters) {
      selectedLetters.forEach(sel => {
        const [target, item] = sel.split('|');
        mapping[target] = item;
      });
    }
    return mapping;
  }, [isDragDrop, selectedLetters]);

  const handleLeftClick = (item) => {
    if (showAnswer) return;
    setSelectedLeftBox(item === selectedLeftBox ? null : item);
  };

  const handleRightClick = (target) => {
    if (showAnswer) return;
    if (!selectedLeftBox) {
      // Allow unmapping by clicking a target when nothing is selected
      if (currentMapping[target]) {
        const newSelections = (selectedLetters || []).filter(sel => !sel.startsWith(target + '|'));
        onSelectLetter(newSelections);
      }
      return;
    }
    // Remove existing mapping for this target
    const newSelections = (selectedLetters || []).filter(sel => !sel.startsWith(target + '|'));
    // Add new mapping
    newSelections.push(`${target}|${selectedLeftBox}`);
    onSelectLetter(newSelections);
    setSelectedLeftBox(null);
  };

  // Check if user's selection matches the correct answer
  const checkAnswer = () => {
    if (isDragDrop) {
      if (!selectedLetters || selectedLetters.length === 0) return null;
      const correctMapping = dragDropData?.correctMapping || {};
      const expectedArray = [];
      for (const [target, items] of Object.entries(correctMapping)) {
        expectedArray.push(`${target}|${items[0]}`);
      }
      const sorted1 = [...selectedLetters].sort().join('');
      const sorted2 = expectedArray.sort().join('');
      return sorted1 === sorted2;
    }

    if (!selectedLetters || selectedLetters.length === 0 || !hasCorrectAnswer) return null;
    const sorted1 = [...selectedLetters].sort().join('');
    const sorted2 = [...correctAnswer].sort().join('');
    return sorted1 === sorted2;
  };

  const answerResult = showAnswer && hasCorrectAnswer ? checkAnswer() : null;

  return (
    <>
    <div className="question-card glass-panel" key={question.id}>
      {/* Warning for recurring failures */}
      {failCount >= 2 && (
        <div className="recurring-warning">
          ⚠️ You've missed this question <strong>{failCount} times</strong> before. Pay close attention!
        </div>
      )}

      {/* QUESTION */}
      <div className="section-label">
        <span className="section-label-icon">📋</span>
        {question.isLab ? 'Lab Scenario' : 'Question'}
        {multiSelect && hasCorrectAnswer && <span className="multi-badge">Choose {correctAnswer.length}</span>}
      </div>

      {question.questionImages?.length > 0 && (
        <div className="images-section">
          {question.questionImages.map((img, idx) => (
            <div key={idx} className="image-container" style={{ cursor: 'zoom-in' }}>
              <img
                src={`/images/${img}`}
                alt={`Q${question.id} img ${idx + 1}`}
                loading="lazy"
                onClick={() => setZoomedImage(`/images/${img}`)}
              />
            </div>
          ))}
        </div>
      )}

      {question.questionText?.trim() && (
        <details className="ocr-details">
          <summary className="ocr-summary">
            <span className="ocr-title">📄 Extracted Text</span>
          </summary>
          <div className="ocr-text">{question.questionText.trim()}</div>
        </details>
      )}

      {/* LETTER SELECTION / DRAG & DROP UI */}
      {isDragDrop && dragDropData && (
        <div className="dnd-container" style={{ marginTop: '20px' }}>
          <p className="dnd-instruction">
            {showAnswer ? 'Your Mapping:' : dragDropData.instruction}
          </p>
          <div className="dnd-columns">
            <div className="dnd-col">
              <div className="dnd-col-title">Available Options</div>
              {dragDropData.draggableItems.map(item => {
                const isMapped = Object.values(currentMapping).includes(item);
                const isSelected = selectedLeftBox === item;
                let cls = 'dnd-item';
                if (isSelected) cls += ' selected';
                if (isMapped && !isSelected) cls += ' disabled';
                return (
                  <div key={item} className={cls} onClick={() => handleLeftClick(item)}>
                    {item} {isMapped && !isSelected && '✅'}
                  </div>
                );
              })}
            </div>
            <div className="dnd-col">
              <div className="dnd-col-title">Targets</div>
              {dragDropData.dropTargets.map(target => {
                const mappedItem = currentMapping[target];
                let cls = 'dnd-target';
                
                if (showAnswer) {
                  const correctItem = dragDropData.correctMapping[target]?.[0];
                  if (mappedItem === correctItem) {
                    cls += ' correct';
                  } else if (mappedItem) {
                    cls += ' incorrect';
                  } else {
                    cls += ' missed';
                  }
                } else if (selectedLeftBox) {
                  cls += ' highlight'; // You can add CSS for this if you want
                }

                return (
                  <div key={target} className={cls} onClick={() => handleRightClick(target)}>
                    <span className="dnd-target-label">{target}</span>
                    {mappedItem && (
                      <div className="dnd-target-content">{mappedItem}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!question.isLab && !isDragDrop && (
        <div className="letter-selection-section">
          <p className="letter-prompt">
            {showAnswer ? 'Your selection:' : (multiSelect ? 'Select your answers:' : 'Select your answer:')}
          </p>
          <div className="letter-buttons">
            {optionLetters.map(letter => {
              let cls = 'btn-letter';
              if (isSelected(letter)) cls += ' selected';
              if (showAnswer && hasCorrectAnswer) {
                if (correctAnswer.includes(letter) && isSelected(letter)) cls += ' letter-correct';
                else if (correctAnswer.includes(letter) && !isSelected(letter)) cls += ' letter-missed';
                else if (!correctAnswer.includes(letter) && isSelected(letter)) cls += ' letter-wrong';
              }
              return (
                <button key={letter} className={cls} onClick={() => handleLetterClick(letter)}
                  disabled={showAnswer}>
                  {letter}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* LAB CLI SIMULATOR */}
      {question.isLab && (
        <LabCliSimulator question={question} showAnswer={showAnswer} />
      )}

      {/* ANSWER */}
      <div className="answer-section">
          {!showAnswer ? (
            <div className="answer-btn-container">
              <button className="btn btn-show-answer" onClick={onShowAnswer} id="show-answer-btn">
                <span>👁️</span> Verify Answer
              </button>
              <span className="answer-hint">or press <kbd>R</kbd></span>
            </div>
          ) : (
            <div className="answer-reveal">
              {/* Auto-verification result */}
              {(hasCorrectAnswer || isDragDrop) && answerResult !== null && (
                <div className={`auto-result ${answerResult ? 'auto-correct' : 'auto-incorrect'}`}>
                  {answerResult ? '🎉 Correct!' : '❌ Incorrect'}
                  {!isDragDrop && (
                    <span className="correct-answer-display">
                      Correct: <strong>{correctAnswer.join(', ')}</strong>
                    </span>
                  )}
                  {isDragDrop && !answerResult && (
                    <span className="correct-answer-display">
                      Review the solution below!
                    </span>
                  )}
                </div>
              )}

              {hasCorrectAnswer && !isDragDrop && answerResult === null && (
                <div className="auto-result auto-neutral">
                  ✅ Correct Answer: <strong>{correctAnswer.join(', ')}</strong>
                </div>
              )}

              {!hasCorrectAnswer && !isDragDrop && (
                <div className="auto-result auto-neutral">
                  📷 Answer visible in image below
                </div>
              )}

              <div className="manual-mark-section" style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <span style={{ fontSize: '0.9rem', color: '#ccc' }}>Manually mark your result:</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className={`btn btn-sm ${currentResult === 'correct' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => onMarkResult && onMarkResult('correct')}
                    style={{ background: currentResult === 'correct' ? 'var(--success)' : '', borderColor: currentResult === 'correct' ? 'var(--success)' : '' }}
                  >
                    👍 Correct
                  </button>
                  <button 
                    className={`btn btn-sm ${currentResult === 'incorrect' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => onMarkResult && onMarkResult('incorrect')}
                    style={{ background: currentResult === 'incorrect' ? 'var(--danger)' : '', borderColor: currentResult === 'incorrect' ? 'var(--danger)' : '' }}
                  >
                    👎 Incorrect
                  </button>
                </div>
              </div>

              <div className="section-label" style={{ color: 'var(--success)', marginTop: '24px' }}>
                <span className="section-label-icon">✅</span> Solution
              </div>

              {question.answerImages?.map((img, idx) => (
                <div key={`a-${idx}`} className="image-container answer-image" style={{ cursor: 'zoom-in' }}>
                  <img
                    src={`/images/${img}`}
                    alt={`Answer ${question.id} img ${idx + 1}`}
                    loading="lazy"
                    onClick={() => setZoomedImage(`/images/${img}`)}
                  />
                </div>
              ))}

              {reference && (
                <div className="reference-link">
                  🔗 <a href={reference} target="_blank" rel="noopener noreferrer">Cisco Reference</a>
                </div>
              )}
            </div>
          )}
        </div>
    </div>
    {zoomedImage && (
      <div className="lightbox-overlay" onClick={() => setZoomedImage(null)}>
        <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
          <img src={zoomedImage} alt="Zoomed view" className="lightbox-img" />
          <button className="lightbox-close" onClick={() => setZoomedImage(null)}>✕</button>
        </div>
      </div>
    )}
    </>
  );
}

export default QuestionViewer;
