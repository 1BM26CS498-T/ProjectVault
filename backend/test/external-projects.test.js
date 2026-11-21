import assert from 'node:assert/strict';
import test from 'node:test';
import { extractPdfText, importExternalProject, isBlockedIpv4 } from '../external-projects.js';

function makePdf(text) {
  const stream = `BT /F1 12 Tf 10 100 Td (${text}) Tj ET`;
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];
  let document = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(document));
    document += object;
  }
  const xrefOffset = Buffer.byteLength(document);
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  document += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(document);
}

test('blocks private, local, and reserved IPv4 ranges', () => {
  for (const address of [
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.1.1',
    '172.16.0.1',
    '192.168.1.1',
    '198.18.0.1',
    '224.0.0.1',
    '240.0.0.1',
  ]) {
    assert.equal(isBlockedIpv4(address), true, address);
  }
  assert.equal(isBlockedIpv4('8.8.8.8'), false);
});

test('rejects non-HTTPS external project URLs', async () => {
  await assert.rejects(importExternalProject('http://example.com'), {
    code: 'invalid_external_url',
  });
});

test('rejects IP-address URLs before making a network request', async () => {
  await assert.rejects(importExternalProject('https://127.0.0.1/project'), {
    code: 'invalid_external_url',
  });
});

test('rejects credentialed and query-string URLs', async () => {
  await assert.rejects(importExternalProject('https://user:password@example.com/project'), {
    code: 'invalid_external_url',
  });
  await assert.rejects(importExternalProject('https://example.com/project?token=secret'), {
    code: 'invalid_external_url',
  });
});

test('extracts text from a small PDF', async () => {
  const content = await extractPdfText(makePdf('Project similarity document test.'));
  assert.match(content, /Project similarity document test/);
});
