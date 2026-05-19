import { IOSSimulator } from './src/lib/ios-simulator/index.js';

function runTests() {
  console.log("Running IOS Simulator tests...");
  const sim = new IOSSimulator('R1', ['ip address 10.0.0.100 255.255.255.0', 'interface tunnel 0', 'router eigrp 10']);
  
  // Test ciscoMatch
  let result = sim.ciscoMatch('ip address 10.0.0.100 255.255.255.0', 'ip add 10.0.0.1 255.25');
  console.assert(result === false, "Test 1 Failed: Should NOT prefix match numbers");
  
  result = sim.ciscoMatch('interface tunnel 0', 'int t 0');
  console.assert(result === true, "Test 2 Failed: Should match interface tunnel 0");

  result = sim.ciscoMatch('interface tunnel 0', 'int t');
  console.assert(result === false, "Test 3 Failed: Length mismatch should fail");

  sim.execute('en');
  console.assert(sim.state.mode === 'PRIV_EXEC', "Test 4 Failed: Alias not working");
  
  sim.execute('conf t');
  console.assert(sim.state.mode === 'GLOBAL_CONFIG', "Test 5 Failed: conf t not working");

  sim.execute('int t 0');
  let lastHist = sim.state.history[sim.state.history.length - 1];
  console.assert(lastHist.normalized === 'interface tunnel 0', "Test 6 Failed: Normalized history failed");
  
  sim.execute('exit');
  console.assert(sim.state.mode === 'GLOBAL_CONFIG', "Test 7 Failed: Exit from interface failed");
  
  sim.execute('router eigrp 10');
  console.assert(sim.state.mode === 'ROUTER_CONFIG', "Test 8 Failed: router eigrp transition failed");
  
  sim.execute('address-family ipv4 vrf Admin');
  console.assert(sim.state.mode === 'ROUTER_AF_CONFIG', "Test 9 Failed: address-family transition failed");
  
  sim.execute('exit');
  console.assert(sim.state.mode === 'ROUTER_CONFIG', "Test 10 Failed: Exit from router-af failed");
  
  console.log("All tests completed!");
}

runTests();
