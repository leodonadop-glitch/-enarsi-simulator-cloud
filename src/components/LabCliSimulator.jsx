import { useState, useEffect } from 'react';

export default function LabCliSimulator({ question, showAnswer }) {
  const [cliInput, setCliInput] = useState('');
  
  // This will read from question.labCommands once Codex provides them
  const expectedCommands = question.labCommands || []; 
  
  const validateCommands = () => {
    if (!expectedCommands || expectedCommands.length === 0) return null;
    
    // Normalize input (ignore empty lines, comments starting with !)
    const lines = cliInput.split('\n').map(l => l.trim().toLowerCase()).filter(l => l.length > 0 && !l.startsWith('!'));
    const expected = expectedCommands.map(c => c.trim().toLowerCase()).filter(c => !c.startsWith('!'));
    
    const missing = [];
    const matched = [];
    
    expected.forEach(cmd => {
      // Allow flexible matching: check if the exact command is included in any line
      const isMatched = lines.some(line => line === cmd || line.includes(cmd));
      if (isMatched) {
        matched.push(cmd);
      } else {
        missing.push(cmd);
      }
    });
    
    const isCorrect = missing.length === 0 && expected.length > 0;
    return { isCorrect, missing, matched };
  };

  const validation = showAnswer ? validateCommands() : null;

  return (
    <div className="lab-cli-container" style={{ marginTop: '20px', marginBottom: '20px' }}>
      <div className="cli-header" style={{
        background: '#333', 
        padding: '6px 12px', 
        borderTopLeftRadius: '8px', 
        borderTopRightRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56' }}></div>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }}></div>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f' }}></div>
        </div>
        <span style={{ fontSize: '0.75rem', color: '#ccc', fontFamily: 'monospace' }}>Cisco IOS-XE Console</span>
      </div>
      
      <textarea
        className="cli-textarea"
        value={cliInput}
        onChange={(e) => setCliInput(e.target.value)}
        readOnly={showAnswer}
        spellCheck="false"
        placeholder="Router> enable&#10;Router# configure terminal..."
        style={{
          width: '100%',
          minHeight: '200px',
          background: '#000',
          color: '#0f0',
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: '0.85rem',
          padding: '16px',
          border: 'none',
          borderBottomLeftRadius: '8px',
          borderBottomRightRadius: '8px',
          outline: 'none',
          resize: 'vertical',
          boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)'
        }}
      ></textarea>
      
      {showAnswer && validation && (
        <div className={`cli-validation ${validation.isCorrect ? 'cli-correct' : 'cli-incorrect'}`} style={{
          marginTop: '16px',
          padding: '16px',
          borderRadius: '8px',
          background: validation.isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${validation.isCorrect ? 'var(--success)' : 'var(--danger)'}`
        }}>
          <h4 style={{ marginBottom: '12px', color: validation.isCorrect ? 'var(--success)' : 'var(--danger)' }}>
            {validation.isCorrect ? '✅ Valid Configuration!' : '❌ Missing or Incorrect Commands'}
          </h4>
          
          {validation.matched.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <strong style={{ color: 'var(--success)', fontSize: '0.85rem' }}>Matched Commands:</strong>
              <ul style={{ listStyleType: 'none', paddingLeft: '0', marginTop: '6px' }}>
                {validation.matched.map((cmd, idx) => (
                  <li key={idx} style={{ fontFamily: 'monospace', fontSize: '0.85rem', padding: '2px 0' }}>✓ {cmd}</li>
                ))}
              </ul>
            </div>
          )}
          
          {validation.missing.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <strong style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>Missing Commands:</strong>
              <ul style={{ listStyleType: 'none', paddingLeft: '0', marginTop: '6px' }}>
                {validation.missing.map((cmd, idx) => (
                  <li key={idx} style={{ fontFamily: 'monospace', fontSize: '0.85rem', padding: '2px 0' }}>✗ {cmd}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
            <strong style={{ fontSize: '0.8rem', color: '#ccc', textTransform: 'uppercase' }}>Expected Solution</strong>
            <pre style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#4ade80', marginTop: '8px', whiteSpace: 'pre-wrap' }}>
              {expectedCommands.join('\n')}
            </pre>
          </div>
        </div>
      )}
      
      {showAnswer && (!expectedCommands || expectedCommands.length === 0) && (
        <div style={{
          marginTop: '16px', padding: '16px', borderRadius: '8px', 
          background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)',
          color: 'var(--lab-color)', fontSize: '0.85rem'
        }}>
          ⚠️ <strong>Auto-validation not available.</strong> Compare your commands with the solution image below.
        </div>
      )}
    </div>
  );
}
