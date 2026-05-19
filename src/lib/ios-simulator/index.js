export const MODES = {
  USER_EXEC: 'USER_EXEC',
  PRIV_EXEC: 'PRIV_EXEC',
  GLOBAL_CONFIG: 'GLOBAL_CONFIG',
  INTERFACE_CONFIG: 'INTERFACE_CONFIG',
  ROUTER_CONFIG: 'ROUTER_CONFIG',
  ROUTER_AF_CONFIG: 'ROUTER_AF_CONFIG',
  VRF_CONFIG: 'VRF_CONFIG',
  VLAN_CONFIG: 'VLAN_CONFIG',
  LINE_CONFIG: 'LINE_CONFIG',
  ROUTE_MAP_CONFIG: 'ROUTE_MAP_CONFIG',
  ISAKMP_POLICY_CONFIG: 'ISAKMP_POLICY_CONFIG',
  IPSEC_PROFILE_CONFIG: 'IPSEC_PROFILE_CONFIG',
  CRYPTO_TRANSFORM_CONFIG: 'CRYPTO_TRANSFORM_CONFIG',
  EXT_NACL_CONFIG: 'EXT_NACL_CONFIG',
  KEY_CHAIN_CONFIG: 'KEY_CHAIN_CONFIG',
  KEY_CHAIN_KEY_CONFIG: 'KEY_CHAIN_KEY_CONFIG',
  TIME_RANGE_CONFIG: 'TIME_RANGE_CONFIG'
};

const MODE_PROMPTS = {
  [MODES.USER_EXEC]: '>',
  [MODES.PRIV_EXEC]: '#',
  [MODES.GLOBAL_CONFIG]: '(config)#',
  [MODES.INTERFACE_CONFIG]: '(config-if)#',
  [MODES.ROUTER_CONFIG]: '(config-router)#',
  [MODES.ROUTER_AF_CONFIG]: '(config-router-af)#',
  [MODES.VRF_CONFIG]: '(config-vrf)#',
  [MODES.VLAN_CONFIG]: '(config-vlan)#',
  [MODES.LINE_CONFIG]: '(config-line)#',
  [MODES.ROUTE_MAP_CONFIG]: '(config-route-map)#',
  [MODES.ISAKMP_POLICY_CONFIG]: '(config-isakmp)#',
  [MODES.IPSEC_PROFILE_CONFIG]: '(ipsec-profile)#',
  [MODES.CRYPTO_TRANSFORM_CONFIG]: '(cfg-crypto-trans)#',
  [MODES.EXT_NACL_CONFIG]: '(config-ext-nacl)#',
  [MODES.KEY_CHAIN_CONFIG]: '(config-keychain)#',
  [MODES.KEY_CHAIN_KEY_CONFIG]: '(config-keychain-key)#',
  [MODES.TIME_RANGE_CONFIG]: '(config-time-range)#'
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
      { mode: MODES.GLOBAL_CONFIG, name: 'vrf', handler: (args) => { this.state.mode = MODES.VRF_CONFIG; return ''; } },
      { mode: MODES.GLOBAL_CONFIG, name: 'ip vrf', handler: (args) => { this.state.mode = MODES.VRF_CONFIG; return ''; } },
      { mode: MODES.GLOBAL_CONFIG, name: 'line', handler: (args) => { this.state.mode = MODES.LINE_CONFIG; return ''; } },
      { mode: MODES.GLOBAL_CONFIG, name: 'route-map', handler: (args) => { this.state.mode = MODES.ROUTE_MAP_CONFIG; return ''; } },
      { mode: MODES.GLOBAL_CONFIG, name: 'crypto isakmp policy', handler: (args) => { this.state.mode = MODES.ISAKMP_POLICY_CONFIG; return ''; } },
      { mode: MODES.GLOBAL_CONFIG, name: 'crypto ipsec profile', handler: (args) => { this.state.mode = MODES.IPSEC_PROFILE_CONFIG; return ''; } },
      { mode: MODES.GLOBAL_CONFIG, name: 'crypto ipsec transform-set', handler: (args) => { this.state.mode = MODES.CRYPTO_TRANSFORM_CONFIG; return ''; } },
      { mode: MODES.GLOBAL_CONFIG, name: 'ip access-list', handler: (args) => { this.state.mode = MODES.EXT_NACL_CONFIG; return ''; } },
      { mode: MODES.GLOBAL_CONFIG, name: 'key chain', handler: (args) => { this.state.mode = MODES.KEY_CHAIN_CONFIG; return ''; } },
      { mode: MODES.GLOBAL_CONFIG, name: 'time-range', handler: (args) => { this.state.mode = MODES.TIME_RANGE_CONFIG; return ''; } },
      { mode: MODES.GLOBAL_CONFIG, name: 'ip', handler: () => { return ''; } },
      { mode: MODES.GLOBAL_CONFIG, name: 'exit', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },
      { mode: MODES.GLOBAL_CONFIG, name: 'end', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },

      // INTERFACE CONFIG
      { mode: MODES.INTERFACE_CONFIG, name: 'ip', handler: () => { return ''; } },
      { mode: MODES.INTERFACE_CONFIG, name: 'no', handler: () => { return ''; } },
      { mode: MODES.INTERFACE_CONFIG, name: 'shutdown', handler: () => { return '%LINK-3-UPDOWN: Interface, changed state to down'; } },
      { mode: MODES.INTERFACE_CONFIG, name: 'exit', handler: () => { this.state.mode = MODES.GLOBAL_CONFIG; return ''; } },
      { mode: MODES.INTERFACE_CONFIG, name: 'end', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },

      // ROUTER CONFIG
      { mode: MODES.ROUTER_CONFIG, name: 'network', handler: () => { return ''; } },
      { mode: MODES.ROUTER_CONFIG, name: 'address-family', handler: (args) => { this.state.mode = MODES.ROUTER_AF_CONFIG; return ''; } },
      { mode: MODES.ROUTER_CONFIG, name: 'no', handler: () => { return ''; } },
      { mode: MODES.ROUTER_CONFIG, name: 'exit', handler: () => { this.state.mode = MODES.GLOBAL_CONFIG; return ''; } },
      { mode: MODES.ROUTER_CONFIG, name: 'end', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },

      // ROUTER AF CONFIG
      { mode: MODES.ROUTER_AF_CONFIG, name: 'network', handler: () => { return ''; } },
      { mode: MODES.ROUTER_AF_CONFIG, name: 'autonomous-system', handler: () => { return ''; } },
      { mode: MODES.ROUTER_AF_CONFIG, name: 'exit', handler: () => { this.state.mode = MODES.ROUTER_CONFIG; return ''; } },
      { mode: MODES.ROUTER_AF_CONFIG, name: 'end', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },

      // VRF CONFIG
      { mode: MODES.VRF_CONFIG, name: 'rd', handler: () => { return ''; } },
      { mode: MODES.VRF_CONFIG, name: 'exit', handler: () => { this.state.mode = MODES.GLOBAL_CONFIG; return ''; } },
      { mode: MODES.VRF_CONFIG, name: 'end', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },

      // VLAN CONFIG
      { mode: MODES.VLAN_CONFIG, name: 'name', handler: () => { return ''; } },
      { mode: MODES.VLAN_CONFIG, name: 'exit', handler: () => { this.state.mode = MODES.GLOBAL_CONFIG; return ''; } },
      { mode: MODES.VLAN_CONFIG, name: 'end', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },

      // LINE CONFIG
      { mode: MODES.LINE_CONFIG, name: 'password', handler: () => { return ''; } },
      { mode: MODES.LINE_CONFIG, name: 'login', handler: () => { return ''; } },
      { mode: MODES.LINE_CONFIG, name: 'exit', handler: () => { this.state.mode = MODES.GLOBAL_CONFIG; return ''; } },
      { mode: MODES.LINE_CONFIG, name: 'end', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },

      // ROUTE MAP CONFIG
      { mode: MODES.ROUTE_MAP_CONFIG, name: 'set', handler: () => { return ''; } },
      { mode: MODES.ROUTE_MAP_CONFIG, name: 'exit', handler: () => { this.state.mode = MODES.GLOBAL_CONFIG; return ''; } },
      { mode: MODES.ROUTE_MAP_CONFIG, name: 'end', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },

      // ISAKMP POLICY CONFIG
      { mode: MODES.ISAKMP_POLICY_CONFIG, name: 'encr', handler: () => { return ''; } },
      { mode: MODES.ISAKMP_POLICY_CONFIG, name: 'hash', handler: () => { return ''; } },
      { mode: MODES.ISAKMP_POLICY_CONFIG, name: 'authentication', handler: () => { return ''; } },
      { mode: MODES.ISAKMP_POLICY_CONFIG, name: 'group', handler: () => { return ''; } },
      { mode: MODES.ISAKMP_POLICY_CONFIG, name: 'lifetime', handler: () => { return ''; } },
      { mode: MODES.ISAKMP_POLICY_CONFIG, name: 'exit', handler: () => { this.state.mode = MODES.GLOBAL_CONFIG; return ''; } },
      { mode: MODES.ISAKMP_POLICY_CONFIG, name: 'end', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },

      // IPSEC PROFILE CONFIG
      { mode: MODES.IPSEC_PROFILE_CONFIG, name: 'set', handler: () => { return ''; } },
      { mode: MODES.IPSEC_PROFILE_CONFIG, name: 'exit', handler: () => { this.state.mode = MODES.GLOBAL_CONFIG; return ''; } },
      { mode: MODES.IPSEC_PROFILE_CONFIG, name: 'end', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },

      // CRYPTO TRANSFORM CONFIG
      { mode: MODES.CRYPTO_TRANSFORM_CONFIG, name: 'mode', handler: () => { return ''; } },
      { mode: MODES.CRYPTO_TRANSFORM_CONFIG, name: 'exit', handler: () => { this.state.mode = MODES.GLOBAL_CONFIG; return ''; } },
      { mode: MODES.CRYPTO_TRANSFORM_CONFIG, name: 'end', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },

      // EXT NACL CONFIG
      { mode: MODES.EXT_NACL_CONFIG, name: 'permit', handler: () => { return ''; } },
      { mode: MODES.EXT_NACL_CONFIG, name: 'deny', handler: () => { return ''; } },
      { mode: MODES.EXT_NACL_CONFIG, name: 'exit', handler: () => { this.state.mode = MODES.GLOBAL_CONFIG; return ''; } },
      { mode: MODES.EXT_NACL_CONFIG, name: 'end', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },

      // KEY CHAIN CONFIG
      { mode: MODES.KEY_CHAIN_CONFIG, name: 'key', handler: () => { this.state.mode = MODES.KEY_CHAIN_KEY_CONFIG; return ''; } },
      { mode: MODES.KEY_CHAIN_CONFIG, name: 'exit', handler: () => { this.state.mode = MODES.GLOBAL_CONFIG; return ''; } },
      { mode: MODES.KEY_CHAIN_CONFIG, name: 'end', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },

      // KEY CHAIN KEY CONFIG
      { mode: MODES.KEY_CHAIN_KEY_CONFIG, name: 'key-string', handler: () => { return ''; } },
      { mode: MODES.KEY_CHAIN_KEY_CONFIG, name: 'exit', handler: () => { this.state.mode = MODES.KEY_CHAIN_CONFIG; return ''; } },
      { mode: MODES.KEY_CHAIN_KEY_CONFIG, name: 'end', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },

      // TIME RANGE CONFIG
      { mode: MODES.TIME_RANGE_CONFIG, name: 'periodic', handler: () => { return ''; } },
      { mode: MODES.TIME_RANGE_CONFIG, name: 'absolute', handler: () => { return ''; } },
      { mode: MODES.TIME_RANGE_CONFIG, name: 'exit', handler: () => { this.state.mode = MODES.GLOBAL_CONFIG; return ''; } },
      { mode: MODES.TIME_RANGE_CONFIG, name: 'end', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } }
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
      if (/\d/.test(expWords[i])) {
        if (expWords[i] !== typedWords[i]) return false;
      } else {
        if (!expWords[i].startsWith(typedWords[i])) return false;
      }
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
      const typedWords = trimmed.toLowerCase().split(/\s+/);
      
      let matches = available.filter(c => {
        const cmdWords = c.name.split(/\s+/);
        const limit = Math.min(typedWords.length, cmdWords.length);
        for (let i = 0; i < limit; i++) {
          if (!cmdWords[i].startsWith(typedWords[i])) return false;
        }
        return true;
      });

      if (matches.length > 0) {
        // If we matched multiple, try to narrow down to those where we typed at least as many words
        // as the command name (meaning it's not a partial command)
        const fullMatches = matches.filter(c => typedWords.length >= c.name.split(/\s+/).length);
        
        if (fullMatches.length > 0) {
          // Find the most specific match (longest command name)
          let maxLen = 0;
          fullMatches.forEach(c => {
            const len = c.name.split(/\s+/).length;
            if (len > maxLen) maxLen = len;
          });
          matches = fullMatches.filter(c => c.name.split(/\s+/).length === maxLen);
        }
      }

      if (matches.length === 1) {
        const c = matches[0];
        const cmdWordsLen = c.name.split(/\s+/).length;
        finalCommandToHistory = c.name + (typedWords.length > cmdWordsLen ? ' ' + typedWords.slice(cmdWordsLen).join(' ') : '');
        output = c.handler(typedWords.slice(cmdWordsLen)) || '';
        handled = true;
      } else if (matches.length > 1) {
        // Maybe exact string match?
        const exact = matches.find(c => c.name === trimmed);
        if (exact) {
          finalCommandToHistory = exact.name;
          output = exact.handler([]) || '';
          handled = true;
        } else {
          return `% Ambiguous command: "${trimmed}"`;
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

    this.state.history.push({ typed: trimmed, normalized: finalCommandToHistory });
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
