import { useState, useMemo, useRef, useEffect } from 'react';

// Basic Cisco dictionary to supplement expected commands
const COMMON_CMDS = ['enable', 'configure terminal', 'end', 'exit', 'write memory', 'wr', 'show running-config'];

const DeviceCli = ({ name, expected, showAnswer }) => {
  const [cliInput, setCliInput] = useState(`${name}# `);
  const textareaRef = useRef(null);

  // Build dictionary from expected commands + common commands
  const dictionary = useMemo(() => {
    const dict = new Set(COMMON_CMDS);
    expected.forEach(cmd => {
      // Add the full command and partial prefixes
      const parts = cmd.split(' ');
      let current = '';
      parts.forEach(p => {
        current += (current ? ' ' : '') + p;
        dict.add(current);
      });
      dict.add(cmd.trim());
    });
    return Array.from(dict);
  }, [expected]);

  const handleKeyDown = (e) => {
    if (showAnswer) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      const lines = cliInput.split('\n');
      const currentLine = lines[lines.length - 1];
      const promptMatch = currentLine.match(/^(.*?#\s*)(.*)$/);
      if (!promptMatch) return;
      
      const prompt = promptMatch[1];
      const typed = promptMatch[2];
      
      // Find matches in dictionary
      const matches = dictionary.filter(cmd => cmd.startsWith(typed));
      if (matches.length === 1) {
        // Autocomplete
        lines[lines.length - 1] = prompt + matches[0];
        setCliInput(lines.join('\n'));
      } else if (matches.length > 1) {
        // Find common prefix
        let common = matches[0];
        for (let i = 1; i < matches.length; i++) {
          let j = 0;
          while (j < common.length && j < matches[i].length && common[j] === matches[i][j]) {
            j++;
          }
          common = common.slice(0, j);
        }
        if (common.length > typed.length) {
          lines[lines.length - 1] = prompt + common;
          setCliInput(lines.join('\n'));
        }
      }
    } else if (e.key === '?') {
      e.preventDefault();
      const lines = cliInput.split('\n');
      const currentLine = lines[lines.length - 1];
      const promptMatch = currentLine.match(/^(.*?#\s*)(.*)$/);
      const prompt = promptMatch ? promptMatch[1] : `${name}# `;
      const typed = promptMatch ? promptMatch[2] : '';
      
      // Find matches
      const matches = dictionary.filter(cmd => cmd.startsWith(typed));
      let nextWords = new Set();
      matches.forEach(m => {
        const remaining = m.slice(typed.length).trim();
        if (remaining) {
          nextWords.add(remaining.split(' ')[0]);
        }
      });
      
      const helpText = Array.from(nextWords).sort().join('  ');
      
      if (helpText) {
        setCliInput(cliInput + '?\n' + helpText + '\n' + prompt + typed);
      } else {
        setCliInput(cliInput + '?\n% Unrecognized command\n' + prompt + typed);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // append new prompt
      setCliInput(cliInput + '\n' + `${name}# `);
    }
  };

  // Scroll to bottom on input
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [cliInput]);

  const validateCommands = () => {
    if (!expected || expected.length === 0) return null;
    
    // Normalize input (ignore prompts, empty lines, comments)
    const lines = cliInput.split('\n').map(l => {
      // remove prompt
      const promptIdx = l.indexOf('#');
      let cleaned = promptIdx >= 0 ? l.slice(promptIdx + 1) : l;
      return cleaned.trim().toLowerCase();
    }).filter(l => l.length > 0 && !l.startsWith('!') && !l.startsWith('?'));
    
    const expectedNormalized = expected.map(c => c.trim().toLowerCase()).filter(c => !c.startsWith('!'));
    
    const missing = [];
    const matched = [];
    
    expectedNormalized.forEach(cmd => {
      const isMatched = lines.some(line => line === cmd || line.includes(cmd));
      if (isMatched) {
        matched.push(cmd);
      } else {
        missing.push(cmd);
      }
    });
    
    const isCorrect = missing.length === 0 && expectedNormalized.length > 0;
    return { isCorrect, missing, matched };
  };

  const validation = showAnswer ? validateCommands() : null;

  return (
    <div className="device-cli" style={{ marginBottom: '24px' }}>
      <div className="cli-header" style={{
        background: '#1e293b', 
        padding: '8px 14px', 
        borderTopLeftRadius: '8px', 
        borderTopRightRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }}></div>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#eab308' }}></div>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e' }}></div>
          </div>
          <span style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: '600', letterSpacing: '0.05em' }}>{name}</span>
        </div>
        <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>IOS-XE Simulator (Use TAB and ?)</span>
      </div>
      
      <textarea
        ref={textareaRef}
        className="cli-textarea"
        value={cliInput}
        onChange={(e) => setCliInput(e.target.value)}
        onKeyDown={handleKeyDown}
        readOnly={showAnswer}
        spellCheck="false"
        style={{
          width: '100%',
          minHeight: '180px',
          background: '#0f172a',
          color: '#4ade80',
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: '0.9rem',
          padding: '16px',
          border: '1px solid rgba(255,255,255,0.1)',
          borderTop: 'none',
          borderBottomLeftRadius: '8px',
          borderBottomRightRadius: '8px',
          outline: 'none',
          resize: 'vertical',
          lineHeight: '1.4',
          boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.3)'
        }}
      ></textarea>
      
      {showAnswer && validation && (
        <div className={`cli-validation ${validation.isCorrect ? 'cli-correct' : 'cli-incorrect'}`} style={{
          marginTop: '12px',
          padding: '16px',
          borderRadius: '8px',
          background: validation.isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${validation.isCorrect ? 'var(--success)' : 'var(--danger)'}`
        }}>
          <h4 style={{ marginBottom: '12px', color: validation.isCorrect ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {validation.isCorrect ? '✅ Valid Configuration!' : '❌ Missing or Incorrect Commands'}
          </h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {validation.matched.length > 0 && (
              <div>
                <strong style={{ color: 'var(--success)', fontSize: '0.85rem' }}>Matched Commands:</strong>
                <ul style={{ listStyleType: 'none', paddingLeft: '0', marginTop: '6px' }}>
                  {validation.matched.map((cmd, idx) => (
                    <li key={idx} style={{ fontFamily: 'monospace', fontSize: '0.8rem', padding: '2px 0' }}>✓ {cmd}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {validation.missing.length > 0 && (
              <div>
                <strong style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>Missing Commands:</strong>
                <ul style={{ listStyleType: 'none', paddingLeft: '0', marginTop: '6px' }}>
                  {validation.missing.map((cmd, idx) => (
                    <li key={idx} style={{ fontFamily: 'monospace', fontSize: '0.8rem', padding: '2px 0' }}>✗ {cmd}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <strong style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expected Solution ({name})</strong>
            <pre style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#f8fafc', marginTop: '8px', whiteSpace: 'pre-wrap' }}>
              {expected.join('\n')}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default function LabCliSimulator({ question, showAnswer }) {
  const expectedCommands = question.labCommands || []; 
  
  // Split commands by device
  const devices = useMemo(() => {
    if (!expectedCommands || expectedCommands.length === 0) return [];
    
    const devs = [];
    let currentDevice = { name: 'Router', commands: [] };
    
    // Check if the first command is a device marker, if not, it will just use 'Router'
    let hasMarkers = expectedCommands.some(cmd => cmd.startsWith('! ---'));
    
    if (!hasMarkers) {
      devs.push({ name: 'Device 1', commands: expectedCommands });
      return devs;
    }

    expectedCommands.forEach(cmd => {
      if (cmd.startsWith('! ---')) {
        const match = cmd.match(/! --- (.*?) ---/);
        if (match) {
          if (currentDevice.commands.length > 0) {
            devs.push(currentDevice);
          }
          currentDevice = { name: match[1].trim(), commands: [] };
        }
      } else {
        // Ignore empty lines
        if (cmd.trim()) {
          currentDevice.commands.push(cmd);
        }
      }
    });
    
    if (currentDevice.commands.length > 0) {
      devs.push(currentDevice);
    }
    
    return devs;
  }, [expectedCommands]);

  if (devices.length === 0) {
    return (
      <div className="lab-cli-container" style={{ marginTop: '20px', marginBottom: '20px' }}>
        {showAnswer && (
          <div style={{
            padding: '16px', borderRadius: '8px', 
            background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)',
            color: 'var(--lab-color)', fontSize: '0.85rem'
          }}>
            ⚠️ <strong>Auto-validation not available.</strong> Compare your commands with the solution image below.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="lab-cli-container" style={{ marginTop: '24px' }}>
      {devices.map((dev, idx) => (
        <DeviceCli key={idx} name={dev.name} expected={dev.commands} showAnswer={showAnswer} />
      ))}
    </div>
  );
}
