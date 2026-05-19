export const MODES = {
  USER_EXEC: 'USER_EXEC',
  PRIV_EXEC: 'PRIV_EXEC',
  GLOBAL_CONFIG: 'GLOBAL_CONFIG',
  INTERFACE_CONFIG: 'INTERFACE_CONFIG',
  ROUTER_CONFIG: 'ROUTER_CONFIG',
  VLAN_CONFIG: 'VLAN_CONFIG',
  LINE_CONFIG: 'LINE_CONFIG'
};

const MODE_PROMPTS = {
  [MODES.USER_EXEC]: '>',
  [MODES.PRIV_EXEC]: '#',
  [MODES.GLOBAL_CONFIG]: '(config)#',
  [MODES.INTERFACE_CONFIG]: '(config-if)#',
  [MODES.ROUTER_CONFIG]: '(config-router)#',
  [MODES.VLAN_CONFIG]: '(config-vlan)#',
  [MODES.LINE_CONFIG]: '(config-line)#'
};

// Basic IOS Simulator Engine
export class IOSSimulator {
  constructor(initialHostname = 'Router', expectedCommands = []) {
    this.state = {
      hostname: initialHostname,
      mode: MODES.USER_EXEC,
      interfaces: {},
      runningConfig: [],
      history: []
    };
    
    this.expectedCommands = expectedCommands;

    // Very basic command registry for now. 
    // In the future, this should be split into modular files.
    this.commands = [
      // USER EXEC
      { mode: MODES.USER_EXEC, name: 'enable', aliases: ['en'], handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },
      { mode: MODES.USER_EXEC, name: 'exit', handler: () => { return ''; } },
      
      // PRIV EXEC
      { mode: MODES.PRIV_EXEC, name: 'disable', handler: () => { this.state.mode = MODES.USER_EXEC; return ''; } },
      { mode: MODES.PRIV_EXEC, name: 'configure terminal', aliases: ['conf t', 'config t'], handler: () => { this.state.mode = MODES.GLOBAL_CONFIG; return 'Enter configuration commands, one per line.  End with CNTL/Z.'; } },
      { mode: MODES.PRIV_EXEC, name: 'show running-config', aliases: ['sh run'], handler: () => this.generateRunningConfig() },
      { mode: MODES.PRIV_EXEC, name: 'write memory', aliases: ['wr', 'wr mem', 'copy run start'], handler: () => { return 'Building configuration...\n[OK]'; } },
      { mode: MODES.PRIV_EXEC, name: 'exit', handler: () => { this.state.mode = MODES.USER_EXEC; return ''; } },

      // GLOBAL CONFIG
      { mode: MODES.GLOBAL_CONFIG, name: 'hostname', handler: (args) => { if (args.length > 0) this.state.hostname = args[0]; return ''; } },
      { mode: MODES.GLOBAL_CONFIG, name: 'no hostname', handler: () => { this.state.hostname = 'Router'; return ''; } },
      { mode: MODES.GLOBAL_CONFIG, name: 'interface', handler: (args) => { this.state.mode = MODES.INTERFACE_CONFIG; return ''; } },
      { mode: MODES.GLOBAL_CONFIG, name: 'router', handler: (args) => { this.state.mode = MODES.ROUTER_CONFIG; return ''; } },
      { mode: MODES.GLOBAL_CONFIG, name: 'vlan', handler: (args) => { this.state.mode = MODES.VLAN_CONFIG; return ''; } },
      { mode: MODES.GLOBAL_CONFIG, name: 'ip', handler: () => { return ''; } }, // Added to catch ip commands
      { mode: MODES.GLOBAL_CONFIG, name: 'exit', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },
      { mode: MODES.GLOBAL_CONFIG, name: 'end', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },

      // INTERFACE CONFIG
      { mode: MODES.INTERFACE_CONFIG, name: 'ip', handler: () => { return ''; } }, // ip address, ip nhrp
      { mode: MODES.INTERFACE_CONFIG, name: 'no', handler: () => { return ''; } }, // no shutdown
      { mode: MODES.INTERFACE_CONFIG, name: 'shutdown', handler: () => { return '%LINK-3-UPDOWN: Interface, changed state to down'; } },
      { mode: MODES.INTERFACE_CONFIG, name: 'exit', handler: () => { this.state.mode = MODES.GLOBAL_CONFIG; return ''; } },
      { mode: MODES.INTERFACE_CONFIG, name: 'end', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },

      // ROUTER CONFIG
      { mode: MODES.ROUTER_CONFIG, name: 'network', handler: () => { return ''; } },
      { mode: MODES.ROUTER_CONFIG, name: 'no', handler: () => { return ''; } },
      { mode: MODES.ROUTER_CONFIG, name: 'exit', handler: () => { this.state.mode = MODES.GLOBAL_CONFIG; return ''; } },
      { mode: MODES.ROUTER_CONFIG, name: 'end', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },

      // VLAN CONFIG
      { mode: MODES.VLAN_CONFIG, name: 'name', handler: () => { return ''; } },
      { mode: MODES.VLAN_CONFIG, name: 'exit', handler: () => { this.state.mode = MODES.GLOBAL_CONFIG; return ''; } },
      { mode: MODES.VLAN_CONFIG, name: 'end', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } }
    ];
  }

  getPrompt() {
    const suffix = MODE_PROMPTS[this.state.mode] || '>';
    return `${this.state.hostname}${suffix} `;
  }

  getAvailableCommands() {
    return this.commands.filter(c => c.mode === this.state.mode);
  }

  getAllDictionaryOptions() {
    const availableCmds = this.getAvailableCommands();
    let allOptions = new Set(this.expectedCommands.map(c => c.trim()));
    
    availableCmds.forEach(c => {
      allOptions.add(c.name);
      if (c.aliases) c.aliases.forEach(a => allOptions.add(a));
    });
    
    return Array.from(allOptions);
  }

  generateRunningConfig() {
    return `Building configuration...\n!\nversion 15.2\nhostname ${this.state.hostname}\n!\nend`;
  }

  ciscoMatch(expected, typed) {
    const expWords = expected.trim().toLowerCase().split(/\s+/);
    const typedWords = typed.trim().toLowerCase().split(/\s+/);
    if (expWords.length !== typedWords.length) return false;
    for (let i = 0; i < expWords.length; i++) {
      if (!expWords[i].startsWith(typedWords[i])) return false;
    }
    return true;
  }

  execute(input) {
    const trimmed = input.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('!')) return ''; // Comment

    // Help
    if (trimmed === '?') {
      const allOpts = this.getAllDictionaryOptions();
      const rootCmds = Array.from(new Set(allOpts.map(cmd => cmd.split(' ')[0]))).sort();
      return rootCmds.join('\n');
    }
    
    if (trimmed.endsWith('?')) {
      const search = trimmed.slice(0, -1);
      const allOpts = this.getAllDictionaryOptions();
      const matches = allOpts.filter(cmd => cmd.startsWith(search));
      let nextWords = new Set();
      matches.forEach(m => {
        const remaining = m.slice(search.length).trim();
        if (remaining) nextWords.add(remaining.split(' ')[0]);
      });
      return Array.from(nextWords).sort().join('\n') || '% Unrecognized command';
    }

    const available = this.getAvailableCommands();
    let finalCommandToHistory = trimmed;
    let handled = false;
    let output = '';
    
    // Exact alias match first
    let exactAlias = available.find(c => c.aliases && c.aliases.includes(trimmed));
    if (exactAlias) {
      finalCommandToHistory = exactAlias.name;
      output = exactAlias.handler([]) || '';
      handled = true;
    } else {
      // Command prefix matching
      const parts = trimmed.split(' ');
      const cmdName = parts[0].toLowerCase();
      const matches = available.filter(c => c.name.startsWith(cmdName));

      if (matches.length === 1) {
        finalCommandToHistory = matches[0].name + (parts.length > 1 ? ' ' + parts.slice(1).join(' ') : '');
        output = matches[0].handler(parts.slice(1)) || '';
        handled = true;
      } else if (matches.length > 1) {
        const exact = matches.find(c => c.name === cmdName || c.name === trimmed);
        if (exact) {
          finalCommandToHistory = exact.name + (parts.length > 1 ? ' ' + parts.slice(1).join(' ') : '');
          output = exact.handler(parts.slice(1)) || '';
          handled = true;
        } else {
          return `% Ambiguous command: "${cmdName}"`;
        }
      }
    }

    if (!handled) {
      // Not in built-in registry. Check expected commands using Cisco prefix matching
      const expectedMatches = this.expectedCommands.filter(c => this.ciscoMatch(c, trimmed) || c.startsWith(trimmed));
      if (expectedMatches.length === 1) {
        finalCommandToHistory = expectedMatches[0]; // Normalize to full expected command
        output = ''; // Silently accept for lab progress
      } else if (expectedMatches.length > 1) {
        const exact = expectedMatches.find(c => c === trimmed);
        if (exact) {
          finalCommandToHistory = exact;
          output = '';
        } else {
          return `% Ambiguous command: "${trimmed}"`;
        }
      } else {
        return '% Unrecognized command';
      }
    } else {
      // If handled by built-in, try to expand to full expected command if possible
      // Example: "interface tunn 0" -> "interface tunnel 0"
      const expMatch = this.expectedCommands.find(c => this.ciscoMatch(c, finalCommandToHistory));
      if (expMatch) {
        finalCommandToHistory = expMatch;
      }
    }

    this.state.history.push(finalCommandToHistory);
    return output;
  }

  autocomplete(input) {
    const trimmed = input.trimStart();
    if (!trimmed) return input;

    const allOptions = this.getAllDictionaryOptions();
    const matches = allOptions.filter(cmd => cmd.startsWith(trimmed));

    if (matches.length === 1) {
      return matches[0] + ' ';
    }

    if (matches.length > 1) {
      let common = matches[0];
      for (let i = 1; i < matches.length; i++) {
        let j = 0;
        while (j < common.length && j < matches[i].length && common[j] === matches[i][j]) {
          j++;
        }
        common = common.slice(0, j);
      }
      return common;
    }

    return input;
  }
}
