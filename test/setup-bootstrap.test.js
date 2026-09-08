import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDependencies } from '../src/setup-bootstrap.js';

test('resolved dependencies do not prompt for installation', async () => {
  await checkDependencies({ log() {}, execute: () => true, ask: () => assert.fail('unexpected installation') });
});

test('missing dependencies are installed only after consent and checked again', async () => {
  const installed = new Set();
  const offers = [];
  await checkDependencies({ log() {}, ask: async label => { offers.push(label); return 's'; }, execute(command, args, install) {
    const isProject = args[0] === 'ls' || (install && !args.includes('-g'));
    if (install) { installed.add(isProject ? 'project' : 'claude'); return true; }
    if (args[0] === 'ls') return installed.has('project');
    if (command === 'claude') return installed.has('claude');
    return true;
  } });
  assert.equal(offers.length, 2);
  assert.deepEqual([...installed], ['project', 'claude']);
});

test('declining installation stops without executing a write', async () => {
  await assert.rejects(checkDependencies({ log() {}, ask: async () => 'n', execute(command, args, install) {
    assert.ok(!install);
    return args[0] !== 'ls';
  } }), /Instalación pendiente/);
});

test('failed installation stops setup', async () => {
  await assert.rejects(checkDependencies({ log() {}, ask: async () => 's', execute: (_, args, install) => !install && args[0] !== 'ls' }), /instalación falló/);
});

test('unsupported Node stops before checking packages', async () => {
  await assert.rejects(checkDependencies({ version: '16.0.0', log() {}, execute: () => assert.fail(), ask: () => assert.fail() }), /Node.js 18/);
});
