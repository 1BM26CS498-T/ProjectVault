import assert from 'node:assert/strict';
import test from 'node:test';
import { createDnsLookup } from '../dns-lookup.js';

test('resolves addresses with the requested family', async () => {
  const resolver = {
    async resolve4() {
      return ['192.0.2.10'];
    },
    async resolve6() {
      return ['2001:db8::10'];
    },
  };
  const lookup = createDnsLookup(resolver);
  const result = await new Promise((resolve, reject) => {
    lookup('neon.example', { family: 4 }, (error, address, family) => {
      if (error) reject(error);
      else resolve({ address, family });
    });
  });

  assert.deepEqual(result, { address: '192.0.2.10', family: 4 });
});

test('returns both address families when requested', async () => {
  const resolver = {
    async resolve4() {
      return ['192.0.2.10'];
    },
    async resolve6() {
      return ['2001:db8::10'];
    },
  };
  const lookup = createDnsLookup(resolver);
  const result = await new Promise((resolve, reject) => {
    lookup('neon.example', { all: true }, (error, addresses) => {
      if (error) reject(error);
      else resolve(addresses);
    });
  });

  assert.deepEqual(result, [
    { address: '192.0.2.10', family: 4 },
    { address: '2001:db8::10', family: 6 },
  ]);
});
