import './load-env.js';
import dns from 'node:dns';
import https from 'node:https';
import dnsPromises, { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';

export function createDnsLookup(resolver) {
  return (hostname, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    } else if (typeof options === 'number') {
      options = { family: options };
    }

    const family = options?.family || 0;
    const all = Boolean(options?.all);
    const literalFamily = isIP(hostname);
    if (literalFamily) {
      const addresses = [{ address: hostname, family: literalFamily }];
      process.nextTick(() => callback(
        null,
        all ? addresses : addresses[0].address,
        all ? undefined : addresses[0].family,
      ));
      return;
    }

    const families = family === 4 || family === 6 ? [family] : [4, 6];
    (async () => {
      const addresses = [];
      let lastError;
      for (const addressFamily of families) {
        try {
          const records = addressFamily === 4
            ? await resolver.resolve4(hostname)
            : await resolver.resolve6(hostname);
          addresses.push(...records.map((address) => ({ address, family: addressFamily })));
          if (!all) break;
        } catch (error) {
          if (!['ENODATA', 'ENOTFOUND'].includes(error.code)) throw error;
          lastError = error;
        }
      }
      if (!addresses.length) throw lastError || new Error(`No DNS records found for ${hostname}.`);
      return all ? addresses : addresses[0];
    })().then((result) => {
      if (all) callback(null, result);
      else callback(null, result.address, result.family);
    }, callback);
  };
}

const dnsServers = (process.env.DNS_SERVERS || '').split(',').map((server) => server.trim()).filter(Boolean);
const resolver = dnsServers.length ? new Resolver() : null;
if (resolver) resolver.setServers(dnsServers);

export const dnsLookup = resolver ? createDnsLookup(resolver) : undefined;
export const httpsAgent = new https.Agent({ keepAlive: true, lookup: dnsLookup });

if (dnsLookup) {
  const lookupPromise = (hostname, options = {}) => new Promise((resolve, reject) => {
    dnsLookup(hostname, options, (error, address, family) => {
      if (error) reject(error);
      else resolve(options?.all ? address : { address, family });
    });
  });
  dns.lookup = dnsLookup;
  dns.promises.lookup = lookupPromise;
  dnsPromises.lookup = lookupPromise;
}
