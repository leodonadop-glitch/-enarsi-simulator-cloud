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
  constructor(initialHostname = 'Router') {
    this.state = {
      hostname: initialHostname,
      mode: MODES.USER_EXEC,
      interfaces: {},
      runningConfig: [],
      history: []
    };

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
      { mode: MODES.GLOBAL_CONFIG, name: 'exit', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },
      { mode: MODES.GLOBAL_CONFIG, name: 'end', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },

      // INTERFACE CONFIG
      { mode: MODES.INTERFACE_CONFIG, name: 'ip address', handler: () => { return ''; } },
      { mode: MODES.INTERFACE_CONFIG, name: 'no shutdown', handler: () => { return '%LINK-3-UPDOWN: Interface, changed state to up'; } },
      { mode: MODES.INTERFACE_CONFIG, name: 'shutdown', handler: () => { return '%LINK-3-UPDOWN: Interface, changed state to down'; } },
      { mode: MODES.INTERFACE_CONFIG, name: 'exit', handler: () => { this.state.mode = MODES.GLOBAL_CONFIG; return ''; } },
      { mode: MODES.INTERFACE_CONFIG, name: 'end', handler: () => { this.state.mode = MODES.PRIV_EXEC; return ''; } },

      // ROUTER CONFIG
      { mode: MODES.ROUTER_CONFIG, name: 'network', handler: () => { return ''; } },
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

  generateRunningConfig() {
    return `Building configuration...\n!\nversion 15.2\nhostname ${this.state.hostname}\n!\nend`;
  }

  execute(input) {
    const trimmed = input.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('!')) return ''; // Comment

    this.state.history.push(trimmed);

    // Help
    if (trimmed === '?') {
      const cmds = this.getAvailableCommands().map(c => c.name).sort();
      return cmds.join('\n');
    }

    const available = this.getAvailableCommands();
    
    // Exact alias match first (like "conf t" or "wr")
    let exactAlias = available.find(c => c.aliases && c.aliases.includes(trimmed));
    if (exactAlias) {
      return exactAlias.handler([]) || '';
    }

    // Command prefix matching
    const parts = trimmed.split(' ');
    const cmdName = parts[0].toLowerCase();
    
    const matches = available.filter(c => c.name.startsWith(cmdName));

    if (matches.length === 0) {
      return '% Unrecognized command';
    } else if (matches.length > 1) {
      // Is one of them an exact match?
      const exact = matches.find(c => c.name === cmdName || c.name === trimmed);
      if (exact) {
        return exact.handler(parts.slice(1)) || '';
      }
      return `% Ambiguous command: "${cmdName}"`;
    } else {
      // Execute the single match
      return matches[0].handler(parts.slice(1)) || '';
    }
  }

  autocomplete(input) {
    const parts = input.split(' ');
    const cmdName = parts[0].toLowerCase();
    
    // Basic autocomplete for the first word
    const available = this.getAvailableCommands();
    const matches = available.filter(c => c.name.startsWith(cmdName));
    
    if (matches.length === 1) {
      return matches[0].name + (parts.length > 1 ? ' ' + parts.slice(1).join(' ') : '');
    }
    
    // Find common prefix if multiple matches
    if (matches.length > 1) {
      let common = matches[0].name;
      for (let i = 1; i < matches.length; i++) {
        let j = 0;
        while (j < common.length && j < matches[i].name.length && common[j] === matches[i].name[j]) {
          j++;
        }
        common = common.slice(0, j);
      }
      return common;
    }
    return input;
  }
}
