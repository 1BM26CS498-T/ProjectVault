import dns from 'node:dns/promises';
import https from 'node:https';
import { isIP } from 'node:net';

const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_CONTENT_LENGTH = 80_000;
const MAX_PDF_PAGES = 25;
const MAX_REDIRECTS = 3;
const blockedIpv4Ranges = [
  [0x00000000, 8],
  [0x0a000000, 8],
  [0x64400000, 10],
  [0x7f000000, 8],
  [0xa9fe0000, 16],
  [0xac100000, 12],
  [0xc0000000, 24],
  [0xc0000200, 24],
  [0xc0586300, 24],
  [0xc0a80000, 16],
  [0xc6120000, 15],
  [0xc6336400, 24],
  [0xcb007100, 24],
  [0xe0000000, 4],
  [0xf0000000, 4],
];

function importError(status, message, code = 'external_project_import_failed') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function ipv4ToNumber(address) {
  return address.split('.').reduce((result, part) => ((result << 8) | Number(part)) >>> 0, 0);
}

export function isBlockedIpv4(address) {
  const value = ipv4ToNumber(address);
  return blockedIpv4Ranges.some(([network, prefix]) => {
    const mask = (0xffffffff << (32 - prefix)) >>> 0;
    return (value & mask) >>> 0 === (network & mask) >>> 0;
  });
}

async function validateAndResolve(url) {
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.port && url.port !== '443') {
    throw importError(400, 'Use a public HTTPS URL without credentials or query parameters.', 'invalid_external_url');
  }
  if (!url.hostname || isIP(url.hostname)) {
    throw importError(400, 'IP-address URLs are not supported; use a public website hostname.', 'invalid_external_url');
  }

  let addresses;
  try {
    addresses = await dns.lookup(url.hostname, { all: true, family: 4, verbatim: true });
  } catch {
    throw importError(400, 'The URL hostname could not be resolved.', 'invalid_external_url');
  }
  if (!addresses.length || addresses.some(({ address }) => isBlockedIpv4(address))) {
    throw importError(400, 'The URL must resolve only to public internet addresses.', 'invalid_external_url');
  }
  return addresses[0].address;
}

function requestHttps(url, address, accept) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: 'GET',
      headers: {
        Accept: accept,
        'Accept-Encoding': 'identity',
        'User-Agent': 'ProjectVault-External-Reference/1.0',
      },
      lookup: (_hostname, _options, callback) => callback(null, address, 4),
      servername: url.hostname,
      timeout: 10_000,
    }, (response) => {
      const location = response.headers.location;
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && location) {
        response.resume();
        resolve({ redirect: location });
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(importError(422, 'The online source did not return a readable page.', 'external_source_unavailable'));
        return;
      }
      const declaredLength = Number(response.headers['content-length']);
      if (Number.isFinite(declaredLength) && declaredLength > MAX_SOURCE_BYTES) {
        response.resume();
        reject(importError(413, 'Online pages and documents must be 2 MB or smaller.', 'external_source_too_large'));
        return;
      }

      const chunks = [];
      let totalBytes = 0;
      response.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_SOURCE_BYTES) {
          request.destroy(importError(413, 'Online pages and documents must be 2 MB or smaller.', 'external_source_too_large'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve({
        body: Buffer.concat(chunks),
        contentType: String(response.headers['content-type'] || '').toLowerCase(),
      }));
      response.on('error', reject);
    });

    request.on('timeout', () => request.destroy(importError(504, 'The online source took too long to respond.', 'external_source_timeout')));
    request.on('error', reject);
    request.end();
  });
}

async function fetchPublicHttps(rawUrl, accept) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw importError(400, 'Enter a valid online source URL.', 'invalid_external_url');
  }

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const address = await validateAndResolve(url);
    const response = await requestHttps(url, address, accept);
    if (!response.redirect) return { ...response, url };
    if (redirectCount === MAX_REDIRECTS) {
      throw importError(422, 'The online source redirected too many times.', 'external_source_redirect_limit');
    }
    try {
      url = new URL(response.redirect, url);
    } catch {
      throw importError(422, 'The online source returned an invalid redirect.', 'external_source_redirect_invalid');
    }
  }
  throw importError(422, 'The online source could not be loaded.', 'external_source_unavailable');
}

function decodeHtmlEntities(value) {
  const named = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return value
    .replace(/&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi, (entity, code) => {
      if (code[0] !== '#') return named[code.toLowerCase()] ?? entity;
      const number = code[1].toLowerCase() === 'x'
        ? Number.parseInt(code.slice(2), 16)
        : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(number) && number > 0 && number <= 0x10ffff
        ? String.fromCodePoint(number)
        : ' ';
    });
}

export async function extractPdfText(body) {
  let document;
  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    document = await getDocument({
      data: new Uint8Array(body),
      disableFontFace: true,
      isEvalSupported: false,
      maxImageSize: 0,
      useSystemFonts: true,
    }).promise;
    if (document.numPages > MAX_PDF_PAGES) {
      throw importError(413, `PDF documents must have ${MAX_PDF_PAGES} pages or fewer.`, 'external_pdf_too_many_pages');
    }

    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const text = await page.getTextContent();
      pages.push(text.items.map((item) => ('str' in item ? item.str : '')).join(' '));
      page.cleanup();
      if (pages.join(' ').length >= MAX_CONTENT_LENGTH) break;
    }
    return pages.join(' ').replace(/\s+/g, ' ').trim().slice(0, MAX_CONTENT_LENGTH);
  } catch (error) {
    if (error.status) throw error;
    throw importError(422, 'The PDF could not be read. Use an unencrypted, text-based PDF.', 'external_pdf_unreadable');
  } finally {
    await document?.destroy();
  }
}

async function extractText(body, contentType) {
  const raw = body.toString('utf8');
  if (contentType.includes('application/pdf')) {
    const content = await extractPdfText(body);
    if (content.length < 20) {
      throw importError(422, 'The PDF did not contain enough readable text to compare.', 'external_source_no_text');
    }
    return { title: '', content };
  }
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')
    && !contentType.includes('text/plain') && !contentType.includes('text/markdown')) {
    throw importError(415, 'Use a public webpage or a text/Markdown document URL.', 'unsupported_external_document');
  }

  const title = contentType.includes('text/html') || contentType.includes('application/xhtml+xml')
    ? decodeHtmlEntities(raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200)
    : '';
  const text = contentType.includes('text/html') || contentType.includes('application/xhtml+xml')
    ? raw
      .replace(/<(script|style|noscript|svg|iframe)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]*>/g, ' ')
    : raw;
  const content = decodeHtmlEntities(text).replace(/\s+/g, ' ').trim().slice(0, MAX_CONTENT_LENGTH);
  if (content.length < 20) {
    throw importError(422, 'The online source did not contain enough readable text to compare.', 'external_source_no_text');
  }
  return { title, content };
}

async function importGithubReadme(url) {
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_.-]+$/.test(part))) {
    throw importError(400, 'For GitHub, provide a public repository URL such as https://github.com/owner/repository.', 'invalid_github_url');
  }
  const [owner, repository] = parts;
  const repoName = repository.replace(/\.git$/i, '');
  const readmeUrl = new URL(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/readme`,
    'https://api.github.com',
  );
  const response = await fetchPublicHttps(readmeUrl.toString(), 'application/vnd.github+json');
  let payload;
  try {
    payload = JSON.parse(response.body.toString('utf8'));
  } catch {
    throw importError(422, 'The GitHub repository did not return a readable README.', 'github_readme_unavailable');
  }
  if (payload.encoding !== 'base64' || typeof payload.content !== 'string') {
    throw importError(422, 'The public GitHub repository does not contain a readable README.', 'github_readme_unavailable');
  }
  const content = Buffer.from(payload.content.replace(/\s/g, ''), 'base64')
    .toString('utf8')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CONTENT_LENGTH);
  if (content.length < 20) {
    throw importError(422, 'The GitHub README did not contain enough text to compare.', 'github_readme_unavailable');
  }
  return {
    title: repoName.slice(0, 200),
    content,
    sourceType: 'github',
  };
}

export async function importExternalProject(sourceUrl) {
  if (typeof sourceUrl !== 'string' || sourceUrl.length > 2048) {
    throw importError(400, 'Enter a valid public project URL.', 'invalid_external_url');
  }
  let url;
  try {
    url = new URL(sourceUrl.trim());
  } catch {
    throw importError(400, 'Enter a valid public project URL.', 'invalid_external_url');
  }
  await validateAndResolve(url);

  if (url.hostname.toLowerCase() === 'github.com') {
    const imported = await importGithubReadme(url);
    return { ...imported, sourceUrl: url.toString() };
  }

  const response = await fetchPublicHttps(url.toString(), 'text/html, text/plain, text/markdown, application/xhtml+xml, application/pdf');
  const { title, content } = await extractText(response.body, response.contentType);
  return {
    title: title || response.url.hostname.slice(0, 200),
    content,
    sourceType: 'website',
    sourceUrl: response.url.toString(),
  };
}
