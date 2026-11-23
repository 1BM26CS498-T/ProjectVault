import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { createRemoteJWKSet, customFetch, jwtVerify } from 'jose';
import multer from 'multer';
import nodemailer from 'nodemailer';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { dnsLookup, httpsAgent } from './dns-lookup.js';
import { isDatabaseConfigured, pool } from './db.js';
import { importExternalProject } from './external-projects.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const development = process.env.NODE_ENV !== 'production';
const appUrl = (process.env.APP_URL || (development ? 'http://127.0.0.1:5173' : '')).replace(/\/$/, '');
const neonAuthBaseUrl = process.env.NEON_AUTH_BASE_URL?.replace(/\/$/, '');
const neonAuthOrigin = neonAuthBaseUrl ? new URL(neonAuthBaseUrl).origin : null;
const neonAuthJwks = process.env.NEON_AUTH_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL), {
      [customFetch]: (url, options) => fetchExternal(url, options),
    })
  : null;
const neonFunctionUrl = process.env.NEON_FUNCTION_HELLO_BASE_URL;
const storageBucket = 'assets';
const isStorageConfigured = Boolean(
  process.env.AWS_ACCESS_KEY_ID
  && process.env.AWS_SECRET_ACCESS_KEY
  && process.env.AWS_ENDPOINT_URL_S3
  && process.env.AWS_REGION,
);
const storageClient = isStorageConfigured
  ? new S3Client({
      endpoint: process.env.AWS_ENDPOINT_URL_S3,
      region: process.env.AWS_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
      requestHandler: new NodeHttpHandler({ httpsAgent }),
    })
  : null;
const uploadRoot = path.resolve(process.env.UPLOAD_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'uploads'));
const maxUploadBytes = 500 * 1024 * 1024;
const allowedRoles = new Set(['student', 'faculty', 'admin']);
const fileTypes = new Map([
  ['pdf', 'application/pdf'],
  ['doc', 'application/msword'],
  ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['mp4', 'video/mp4'],
  ['mov', 'video/quicktime'],
  ['webm', 'video/webm'],
  ['m4v', 'video/x-m4v'],
]);

if (!appUrl) {
  throw new Error('APP_URL is required.');
}
for (const [label, value] of [['APP_URL', appUrl]]) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid HTTP or HTTPS URL.`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password
    || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${label} must be a valid HTTP or HTTPS URL without embedded credentials.`);
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error(`${label} must use HTTPS in production.`);
  }
}

fs.mkdirSync(uploadRoot, { recursive: true });

const allowedOrigins = (process.env.CORS_ORIGIN || (development ? 'http://127.0.0.1:5173' : ''))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'no-referrer' },
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(httpError(403, 'Origin is not allowed by CORS.', 'origin_not_allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  maxAge: 600,
}));
app.use('/api/neon-auth', proxyNeonAuth);
app.use(express.json({ limit: '1mb' }));
app.use('/api', (req, _res, next) => {
  if (!isDatabaseConfigured && !['/health', '/'].includes(req.path)) {
    next(httpError(503, 'Set DATABASE_URL in the root .env.local from Neon CLI or in backend/.env, then restart the API.', 'database_not_configured'));
    return;
  }
  next();
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const schemas = {
  colleges: new Set(['id', 'college_name', 'created_at']),
  profiles: new Set(['id', 'email', 'full_name', 'role', 'college_id', 'department', 'student_faculty_id', 'batch', 'status', 'email_verified_at', 'created_at']),
  projects: new Set([
    'id', 'college_id', 'title', 'description', 'features', 'technologies', 'department',
    'year_batch', 'domain', 'team_name', 'faculty_guide_id', 'faculty_guide_name',
    'student_id', 'student_name', 'team_members', 'status', 'github_url', 'demo_url',
    'report_path', 'demo_video_path', 'faculty_feedback', 'created_at', 'updated_at',
  ]),
  project_team_members: new Set(['id', 'project_id', 'member_name', 'member_email', 'created_at']),
  project_reviews: new Set(['id', 'project_id', 'faculty_id', 'review_type', 'decision', 'comments', 'created_at', 'reviewed_at']),
  faq_questions: new Set(['id', 'user_id', 'question', 'answer', 'status', 'created_at', 'answered_at', 'answered_by']),
};

const selectGrants = {
  colleges: new Set(['public', 'authenticated']),
  projects: new Set(['public', 'authenticated']),
  faq_questions: new Set(['public', 'authenticated']),
  profiles: new Set(['authenticated']),
  project_team_members: new Set(['authenticated']),
  project_reviews: new Set(['authenticated']),
};

const mailer = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  : null;

function httpError(status, message, code = 'request_error') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function validateWebUrl(value, label) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > 2048) throw httpError(400, `${label} must be a valid web URL.`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw httpError(400, `${label} must be a valid web URL.`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw httpError(400, `${label} must be an HTTP or HTTPS URL without embedded credentials.`);
  }
  return url.toString();
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

async function retryTransient(operation) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError;
}

function requestExternal(url, options = {}, redirectCount = 0) {
  const target = new URL(url);
  if (target.protocol !== 'https:') throw new Error('Neon service endpoints must use HTTPS.');

  return new Promise((resolve, reject) => {
    const requestHeaders = new Headers(options.headers);
    if (!requestHeaders.has('accept-encoding')) requestHeaders.set('accept-encoding', 'identity');
    const request = https.request(target, {
      method: options.method || 'GET',
      headers: Object.fromEntries(requestHeaders.entries()),
      agent: httpsAgent,
      lookup: dnsLookup,
    }, (response) => {
      const status = response.statusCode || 502;
      const location = response.headers.location;
      if ([301, 302, 303, 307, 308].includes(status) && location) {
        response.resume();
        if (redirectCount >= 5) {
          reject(new Error('Neon service endpoint redirected too many times.'));
          return;
        }
        resolve(requestExternal(new URL(location, target), options, redirectCount + 1));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => {
        const headers = new Headers();
        for (const [name, value] of Object.entries(response.headers)) {
          if (typeof value === 'string') headers.set(name, value);
          else if (Array.isArray(value) && name !== 'set-cookie') headers.set(name, value.join(', '));
        }
        const body = [204, 205, 304].includes(status) ? null : Buffer.concat(chunks);
        resolve(new Response(body, { status, headers }));
      });
    });

    request.setTimeout(8000, () => request.destroy(new Error('Neon service request timed out.')));
    request.on('error', reject);
    request.end(options.body);
  });
}

function fetchExternal(url, options = {}) {
  return retryTransient(() => requestExternal(url, options));
}

function proxyNeonAuth(req, res) {
  if (!neonAuthBaseUrl) {
    res.status(503).json({
      error: { code: 'auth_not_configured', message: 'Neon Auth is not configured.' },
    });
    return;
  }

  const authPath = req.originalUrl.slice('/api/neon-auth'.length);
  const target = new URL(`${neonAuthBaseUrl}${authPath}`);
  const headers = { ...req.headers };
  for (const name of ['connection', 'host', 'transfer-encoding']) delete headers[name];
  const upstream = https.request(target, {
    method: req.method,
    headers,
    agent: httpsAgent,
    lookup: dnsLookup,
  }, (response) => {
    res.statusCode = response.statusCode || 502;
    const hopByHopHeaders = new Set([
      'connection',
      'keep-alive',
      'proxy-authenticate',
      'proxy-authorization',
      'te',
      'trailer',
      'transfer-encoding',
      'upgrade',
    ]);
    for (const [name, value] of Object.entries(response.headers)) {
      if (value === undefined || hopByHopHeaders.has(name)) continue;
      if (name === 'set-cookie') {
        res.setHeader(name, response.headers['set-cookie'].map((cookie) => {
          const withoutDomain = cookie.replace(/;\s*domain=[^;]*/i, '');
          const withProxyPath = /;\s*path=[^;]*/i.test(withoutDomain)
            ? withoutDomain.replace(/;\s*path=[^;]*/i, '; Path=/api/neon-auth')
            : `${withoutDomain}; Path=/api/neon-auth`;
          return withProxyPath;
        }));
      } else {
        res.setHeader(name, value);
      }
    }
    response.pipe(res);
  });

  upstream.setTimeout(30_000, () => upstream.destroy(new Error('Neon Auth request timed out.')));
  upstream.on('error', (error) => {
    console.error('Neon Auth proxy failed:', error.message);
    if (!res.headersSent) {
      res.status(502).json({
        error: { code: 'neon_auth_unavailable', message: 'Neon Auth could not be reached.' },
      });
    } else {
      res.destroy(error);
    }
  });
  req.on('aborted', () => upstream.destroy());
  req.pipe(upstream);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function makeOneTimeToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function safeUser(profile) {
  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    name: profile.full_name,
    role: profile.role,
    college_id: profile.college_id,
    collegeId: profile.college_id,
    department: profile.department,
    status: profile.status,
    email_confirmed_at: profile.email_verified_at,
    confirmed_at: profile.email_verified_at,
  };
}

async function sendMail({ to, subject, text, html }) {
  if (!mailer || !process.env.SMTP_FROM) {
    throw httpError(503, 'Email delivery is not configured. Configure SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM.', 'email_not_configured');
  }
  await mailer.sendMail({ from: process.env.SMTP_FROM, to, subject, text, html });
}

const authOptional = asyncRoute(async (req, res, next) => {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    req.user = null;
    next();
    return;
  }
  if (!neonAuthJwks || !neonAuthOrigin) {
    throw httpError(503, 'Neon Auth is not configured for API token verification.', 'auth_not_configured');
  }
  try {
    const { payload } = await jwtVerify(token, neonAuthJwks, {
      issuer: neonAuthOrigin,
      audience: neonAuthOrigin,
    });
    if (typeof payload.sub !== 'string' || !payload.sub) {
      throw new Error('The Neon Auth token has no subject.');
    }
    req.authUserId = payload.sub;
    next();
  } catch (error) {
    if (error.status) throw error;
    throw httpError(401, 'Your Neon Auth session is invalid or expired. Sign in again.', 'invalid_token');
  }
});

const loadAuthenticatedProfile = asyncRoute(async (req, res, next) => {
  if (!req.authUserId) {
    next();
    return;
  }
  const { rows } = await pool.query(
    `SELECT id, email, full_name, role, college_id, department, status, email_verified_at
       FROM profiles
      WHERE auth_user_id = $1`,
    [req.authUserId],
  );
  const profile = rows[0];
  if (!profile || !profile.email_verified_at || profile.status !== 'Active' || !allowedRoles.has(profile.role)) {
    throw httpError(401, 'Your account is unavailable or not email-verified.', 'account_unavailable');
  }
  req.user = profile;
  next();
});

function requireAuth(req, _res, next) {
  if (!req.user) {
    next(httpError(401, 'Sign in to continue.', 'authentication_required'));
    return;
  }
  next();
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(httpError(403, 'You do not have permission to perform this action.', 'forbidden'));
      return;
    }
    next();
  };
}

app.get('/api/health', asyncRoute(async (_req, res) => {
  const services = {
    postgres: 'not_configured',
    auth: 'not_configured',
    objectStorage: 'not_configured',
    function: 'not_configured',
  };
  const errors = {};

  if (isDatabaseConfigured) {
    try {
      await retryTransient(() => pool.query('SELECT 1'));
      services.postgres = 'connected';
    } catch (error) {
      console.error('PostgreSQL health check failed:', error.message);
      services.postgres = 'unavailable';
      errors.postgres = 'The PostgreSQL connection failed.';
    }
  }
  if (neonAuthBaseUrl && neonAuthJwks) {
    try {
      const response = await fetchExternal(`${neonAuthBaseUrl}/get-session`, {
        headers: { Origin: appUrl },
      });
      if (!response.ok) throw new Error(`Neon Auth returned HTTP ${response.status}.`);
      services.auth = 'connected';
    } catch (error) {
      console.error('Neon Auth health check failed:', error.message);
      services.auth = 'unavailable';
      errors.auth = 'The Neon Auth endpoint is unavailable.';
    }
  }
  if (storageClient) {
    try {
      await storageClient.send(new ListObjectsV2Command({ Bucket: storageBucket, MaxKeys: 1 }));
      services.objectStorage = 'connected';
    } catch (error) {
      console.error('Neon Object Storage health check failed:', error.message);
      services.objectStorage = 'unavailable';
      errors.objectStorage = 'The Neon Object Storage bucket is unavailable.';
    }
  }
  if (neonFunctionUrl) {
    try {
      const response = await fetchExternal(neonFunctionUrl);
      if (!response.ok) throw new Error(`Function returned HTTP ${response.status}.`);
      services.function = 'connected';
    } catch (error) {
      console.error('Neon Function health check failed:', error.message);
      services.function = 'unavailable';
      errors.function = 'The Neon Function endpoint is unavailable.';
    }
  }

  const ok = Object.values(services).every((status) => status === 'connected' || status === 'configured');
  res.status(ok ? 200 : 503).json({ ok, services, ...(Object.keys(errors).length ? { errors } : {}) });
}));

app.post('/api/auth/pending-registration', authLimiter, asyncRoute(async (req, res) => {
  const fullName = String(req.body?.full_name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const collegeId = Number(req.body?.college_id);
  const role = String(req.body?.role || 'student');
  if (fullName.length < 2 || fullName.length > 120) throw httpError(400, 'Enter a name between 2 and 120 characters.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw httpError(400, 'Enter a valid email address.');
  if (!Number.isSafeInteger(collegeId) || collegeId < 1) throw httpError(400, 'Select a valid college.');
  if (!['student', 'faculty'].includes(role)) throw httpError(400, 'Choose student or faculty registration.');

  const college = await pool.query('SELECT id FROM colleges WHERE id = $1', [collegeId]);
  if (!college.rowCount) throw httpError(400, 'The selected college is not available.');
  const existing = await pool.query('SELECT 1 FROM profiles WHERE LOWER(email) = $1', [email]);
  if (existing.rowCount) throw httpError(409, 'An account already uses this email address.');
  await pool.query(
    `INSERT INTO pending_student_profiles (email, full_name, college_id, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE
       SET full_name = EXCLUDED.full_name, college_id = EXCLUDED.college_id,
           role = EXCLUDED.role, created_at = NOW()`,
    [email, fullName, collegeId, role],
  );
  res.status(201).json({
    message: role === 'faculty'
      ? 'Registration details saved. Verify your email; a ProjectVault administrator must approve your faculty account before access is enabled.'
      : 'Registration details saved. Verify your email to activate your student account.',
  });
}));

app.get('/api/auth/invite', authLimiter, asyncRoute(async (req, res) => {
  const token = String(req.query.token || '');
  if (token.length < 32 || token.length > 128) throw httpError(400, 'This invitation link is invalid.');
  const { rows } = await pool.query(
    `SELECT p.email, p.full_name, p.college_id, c.college_name
       FROM email_tokens t
       JOIN profiles p ON p.id = t.profile_id
       LEFT JOIN colleges c ON c.id = p.college_id
      WHERE t.token_hash = $1 AND t.purpose = 'invite' AND t.expires_at > NOW()
        AND p.role = 'faculty' AND p.status = 'Pending'`,
    [sha256(token)],
  );
  if (!rows[0]) throw httpError(400, 'This invitation link has expired or is invalid.');
  res.json({ invite: rows[0] });
}));

app.post('/api/auth/profile', authLimiter, authOptional, asyncRoute(async (req, res) => {
  if (!req.authUserId) throw httpError(401, 'Sign in to complete your ProjectVault profile.');
  const { rows: authRows } = await pool.query(
    'SELECT id, email, name, "emailVerified" FROM neon_auth."user" WHERE id = $1',
    [req.authUserId],
  );
  const authUser = authRows[0];
  if (!authUser || !authUser.email || !authUser.emailVerified) {
    throw httpError(403, 'Verify your Neon Auth email before using ProjectVault.', 'email_not_verified');
  }
  const email = String(authUser.email).trim().toLowerCase();

  const existing = await pool.query(
    `SELECT id, auth_user_id, role FROM profiles
      WHERE auth_user_id = $1 OR LOWER(email) = $2
      ORDER BY (auth_user_id = $1) DESC LIMIT 1`,
    [req.authUserId, email],
  );
  let profile = existing.rows[0];
  if (profile?.auth_user_id && profile.auth_user_id !== req.authUserId) {
    throw httpError(409, 'This email is already linked to another ProjectVault account.', 'profile_link_conflict');
  }

  if (!profile) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: pendingRows } = await client.query(
        `SELECT email, full_name, college_id, role FROM pending_student_profiles
          WHERE email = $1 AND created_at > NOW() - INTERVAL '7 days'
          FOR UPDATE`,
        [email],
      );
      let registration = pendingRows[0];
      let inviteTokenId = null;
      if (!registration) {
        const { rows: inviteRows } = await client.query(
          `SELECT t.id AS token_id, p.full_name, p.college_id
             FROM email_tokens t
             JOIN profiles p ON p.id = t.profile_id
            WHERE LOWER(p.email) = $1 AND p.role = 'faculty'
              AND t.purpose = 'invite' AND t.expires_at > NOW()
            ORDER BY t.created_at DESC LIMIT 1 FOR UPDATE OF t`,
          [email],
        );
        if (!inviteRows[0]) {
          throw httpError(403, 'No student registration or faculty invitation is associated with this verified email.', 'profile_setup_required');
        }
        registration = inviteRows[0];
        inviteTokenId = registration.token_id;
      }
      const { rows: insertedRows } = await client.query(
        `INSERT INTO profiles (auth_user_id, email, full_name, role, college_id, status, email_verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING id, email, full_name, role, college_id, department, status, email_verified_at`,
        [
          req.authUserId,
          email,
          registration.full_name,
          inviteTokenId ? 'faculty' : registration.role,
          registration.college_id,
          inviteTokenId || registration.role === 'faculty' ? 'Pending' : 'Active',
        ],
      );
      profile = insertedRows[0];
      if (inviteTokenId) {
        await client.query('DELETE FROM email_tokens WHERE id = $1', [inviteTokenId]);
      } else {
        await client.query('DELETE FROM pending_student_profiles WHERE email = $1', [email]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') throw httpError(409, 'An account already uses this email address.');
      throw error;
    } finally {
      client.release();
    }
  } else {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (!profile.auth_user_id && profile.role === 'faculty') {
        const invite = await client.query(
          `SELECT id FROM email_tokens
            WHERE profile_id = $1 AND purpose = 'invite' AND expires_at > NOW()
            FOR UPDATE`,
          [profile.id],
        );
        if (!invite.rowCount) {
          throw httpError(403, 'The faculty invitation has expired. Ask an administrator to send a new one.', 'invite_expired');
        }
      }
      const { rows } = await client.query(
        `UPDATE profiles
            SET auth_user_id = $1, email_verified_at = NOW()
          WHERE id = $2 AND (auth_user_id IS NULL OR auth_user_id = $1)
          RETURNING id, email, full_name, role, college_id, department, status, email_verified_at`,
        [req.authUserId, profile.id],
      );
      profile = rows[0];
      await client.query(
        "DELETE FROM email_tokens WHERE profile_id = $1 AND purpose = 'invite'",
        [profile.id],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  const facultyAwaitingApproval = profile?.role === 'faculty' && profile.status === 'Pending';
  if (!profile || (!facultyAwaitingApproval && profile.status !== 'Active') || !allowedRoles.has(profile.role)) {
    throw httpError(403, 'This ProjectVault account is not active.', 'account_unavailable');
  }
  res.json({ user: safeUser(profile) });
}));

app.get('/api/auth/me', authOptional, loadAuthenticatedProfile, requireAuth, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

// Search public GitHub projects
app.get('/api/online-projects/github', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();

    if (!query) {
      return res.status(400).json({
        error: 'Search query is required'
      });
    }

    const page = Math.max(1, Number(req.query.page) || 1);

    const githubUrl = new URL('https://api.github.com/search/repositories');
    githubUrl.searchParams.set('q', query);
    githubUrl.searchParams.set('sort', 'stars');
    githubUrl.searchParams.set('order', 'desc');
    githubUrl.searchParams.set('per_page', '12');
    githubUrl.searchParams.set('page', String(page));

    const response = await fetch(githubUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ProjectVault'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();

      return res.status(response.status).json({
        error: 'GitHub search failed',
        details: errorText
      });
    }

    const data = await response.json();

    const projects = (data.items || []).map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      stars: repo.stargazers_count,
      language: repo.language,
      topics: repo.topics || [],
      updatedAt: repo.updated_at,
      owner: repo.owner?.login,
      avatar: repo.owner?.avatar_url
    }));

    res.json({
      total: data.total_count,
      projects
    });
  } catch (error) {
    console.error('GitHub project search error:', error);

    res.status(500).json({
      error: 'Unable to search GitHub projects'
    });
  }
});
app.get('/api/external-projects', authOptional, loadAuthenticatedProfile, requireAuth, requireRole('student'), asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, title, source_type, source_url, content_text, created_at
       FROM external_project_references
      WHERE owner_id = $1
      ORDER BY created_at DESC`,
    [req.user.id],
  );
  res.json({ data: rows, error: null });
}));

app.post('/api/external-projects', authOptional, loadAuthenticatedProfile, requireAuth, requireRole('student'), authLimiter, asyncRoute(async (req, res) => {
  const sourceUrl = req.body?.sourceUrl;
  const imported = await importExternalProject(sourceUrl);
  const { rows } = await pool.query(
    `INSERT INTO external_project_references
       (owner_id, title, source_type, source_url, content_text)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (owner_id, source_url) DO NOTHING
     RETURNING id, title, source_type, source_url, content_text, created_at`,
    [req.user.id, imported.title, imported.sourceType, imported.sourceUrl, imported.content],
  );
  if (!rows[0]) {
    throw httpError(409, 'This online project is already in your reference library.', 'external_project_exists');
  }
  res.status(201).json({ data: rows[0], error: null });
}));

app.delete('/api/external-projects/:referenceId', authOptional, loadAuthenticatedProfile, requireAuth, requireRole('student'), asyncRoute(async (req, res) => {
  const referenceId = req.params.referenceId;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(referenceId)) {
    throw httpError(400, 'Invalid external reference.', 'invalid_external_reference');
  }
  const { rowCount } = await pool.query(
    'DELETE FROM external_project_references WHERE id = $1 AND owner_id = $2',
    [referenceId, req.user.id],
  );
  if (!rowCount) throw httpError(404, 'The external reference was not found.', 'external_project_not_found');
  res.json({ data: null, error: null });
}));

function validateColumn(table, column) {
  if (typeof column !== 'string' || !schemas[table]?.has(column)) {
    throw httpError(400, 'The requested column is not supported.', 'invalid_column');
  }
}

function appendFilter(where, values, filter, table) {
  const { column, operator, value } = filter;
  validateColumn(table, column);
  if (operator === 'in') {
    if (!Array.isArray(value) || value.length > 200) throw httpError(400, 'Invalid filter value.');
    if (value.length === 0) {
      where.push('FALSE');
      return;
    }
    const placeholders = value.map((item) => {
      values.push(item);
      return `$${values.length}`;
    });
    where.push(`${column === 'status' ? `LOWER(${column})` : column} = ANY(ARRAY[${placeholders.join(',')} ]${column === 'status' ? '::text[]' : ''})`);
    if (column === 'status') where[where.length - 1] = `LOWER(status) = ANY(ARRAY[${placeholders.join(',')}]::text[])`;
    return;
  }
  if (operator === 'not_is') {
    where.push(value === null ? `${column} IS NOT NULL` : `${column} IS DISTINCT FROM $${values.push(value)}`);
    return;
  }
  if (operator === 'is') {
    if (value !== null) throw httpError(400, 'Only NULL checks are supported.');
    where.push(`${column} IS NULL`);
    return;
  }
  if (operator !== 'eq') throw httpError(400, 'The requested filter operator is not supported.');
  values.push(value);
  const placeholder = `$${values.length}`;
  where.push(column === 'status' ? `LOWER(status) = LOWER(${placeholder})` : `${column} = ${placeholder}`);
}

function accessWhere(table, user, values) {
  if (table === 'colleges' || table === 'projects') {
    if (table === 'colleges') return null;
    if (!user) return `LOWER(status) IN ('approved', 'verified')`;
    if (user.role === 'admin') return null;
    values.push(user.id);
    return `(LOWER(status) IN ('approved', 'verified') OR student_id = $${values.length} OR faculty_guide_id = $${values.length})`;
  }
  if (table === 'faq_questions') {
    if (user?.role === 'admin') return null;
    return `status = 'published' AND answer IS NOT NULL`;
  }
  if (!user) throw httpError(401, 'Sign in to access this resource.');
  if (user.role === 'admin') return null;
  if (table === 'profiles') {
    values.push(user.id, user.college_id);
    return `(id = $${values.length - 1} OR (role = 'faculty' AND college_id = $${values.length}))`;
  }
  if (table === 'project_team_members') {
    values.push(user.id);
    return `EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND (p.student_id = $${values.length} OR p.faculty_guide_id = $${values.length}))`;
  }
  if (table === 'project_reviews') {
    values.push(user.id);
    return `(faculty_id = $${values.length} OR EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND (p.student_id = $${values.length} OR p.faculty_guide_id = $${values.length})))`;
  }
  return 'FALSE';
}

function requireAllowedSelection(req, table, operation, body) {
  const user = req.user;
  if (operation === 'select') {
    if (!selectGrants[table]) throw httpError(403, 'Reading this resource is not allowed.');
    if (selectGrants[table].has('public')) return;
    if (!user) throw httpError(401, 'Sign in to access this resource.');
    return;
  }
  if (!user) throw httpError(401, 'Sign in to change data.');
  if (operation === 'insert' && table === 'projects') {
    if (user.role !== 'student') throw httpError(403, 'Only students can submit proposals.');
    return;
  }
  if (operation === 'insert' && table === 'project_team_members') {
    if (user.role !== 'student') throw httpError(403, 'Only students can add project team members.');
    return;
  }
  if (operation === 'insert' && table === 'project_reviews') {
    if (user.role !== 'faculty') throw httpError(403, 'Only faculty can review projects.');
    return;
  }
  if (operation === 'insert' && table === 'faq_questions') {
    if (!['student', 'faculty'].includes(user.role)) throw httpError(403, 'Only students and faculty can submit FAQ questions.');
    return;
  }
  if (operation === 'insert' && table === 'colleges' && user.role === 'admin') return;
  if (operation === 'update' && table === 'profiles') {
    if (Object.keys(body).some((column) => column !== 'full_name')) {
      throw httpError(403, 'Profile role and account status can only be changed through authorized admin actions.');
    }
    return;
  }
  if (operation === 'update' && table === 'projects' && ['faculty', 'admin'].includes(user.role)) return;
  if (operation === 'update' && table === 'faq_questions' && user.role === 'admin') return;
  throw httpError(403, 'You do not have permission to change this resource.');
}

function validateMutationBody(table, operation, body) {
  const rows = Array.isArray(body) ? body : [body];
  if (!rows.length || rows.length > 200) throw httpError(400, 'Invalid number of rows.');
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw httpError(400, 'Invalid row data.');
    for (const column of Object.keys(row)) validateColumn(table, column);
  }
  if (operation === 'update' && !rows[0]) throw httpError(400, 'No update data supplied.');
  if (operation === 'update' && rows.length !== 1) throw httpError(400, 'Updates must include exactly one data object.');
  return rows;
}

app.post('/api/data', authOptional, loadAuthenticatedProfile, asyncRoute(async (req, res) => {
  const table = req.body?.table;
  const operation = req.body?.operation;
  if (!schemas[table] || !['select', 'insert', 'update'].includes(operation)) {
    throw httpError(400, 'Unsupported data operation.', 'unsupported_operation');
  }

  const bodyRows = operation === 'insert' || operation === 'update'
    ? validateMutationBody(table, operation, req.body.values)
    : [];
  requireAllowedSelection(req, table, operation, operation === 'update' ? bodyRows[0] : bodyRows);

  const selectedColumns = req.body.columns === '*'
    ? [...schemas[table]]
    : String(req.body.columns || '').split(',').map((column) => column.trim()).filter(Boolean);
  selectedColumns.forEach((column) => validateColumn(table, column));
  if (operation === 'select') {
    const values = [];
    const where = [];
    const filters = req.body.filters ?? [];
    const requestedOrders = req.body.orders ?? [];
    if (!Array.isArray(filters) || filters.length > 100) throw httpError(400, 'Invalid query filters.');
    if (!Array.isArray(requestedOrders) || requestedOrders.length > 10) throw httpError(400, 'Invalid query ordering.');
    if (selectedColumns.length === 0) throw httpError(400, 'Select at least one column.');
    for (const filter of filters) {
      if (!filter || typeof filter !== 'object' || Array.isArray(filter)) throw httpError(400, 'Invalid query filter.');
      appendFilter(where, values, filter, table);
    }
    const policy = accessWhere(table, req.user, values);
    if (policy) where.push(policy);

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const requestedLimit = req.body.limit ?? 100;
    const requestedOffset = req.body.offset ?? 0;
    if (!Number.isInteger(requestedLimit) || requestedLimit < 0 || requestedLimit > 1000) {
      throw httpError(400, 'The requested result limit is invalid.');
    }
    if (!Number.isInteger(requestedOffset) || requestedOffset < 0 || requestedOffset > 100_000) {
      throw httpError(400, 'The requested result offset is invalid.');
    }
    const limit = requestedLimit;
    const offset = requestedOffset;
    const orders = requestedOrders.map((order) => {
      if (!order || typeof order !== 'object' || Array.isArray(order)) {
        throw httpError(400, 'Invalid sort order.');
      }
      const { column, ascending } = order;
      if (typeof ascending !== 'boolean') throw httpError(400, 'Invalid sort direction.');
      validateColumn(table, column);
      return `${column} ${ascending ? 'ASC' : 'DESC'} NULLS LAST`;
    });
    const orderSql = orders.length ? `ORDER BY ${orders.join(', ')}` : '';
    const countResult = req.body.count
      ? await pool.query(`SELECT COUNT(*)::int AS count FROM ${table} ${whereSql}`, values)
      : null;
    if (req.body.head) {
      res.json({ data: null, error: null, count: countResult?.rows[0]?.count ?? null });
      return;
    }
    let selectionSql = selectedColumns.join(', ');
    if (table === 'projects' && req.user?.role !== 'admin') {
      const privateColumns = new Set(['report_path', 'demo_video_path', 'faculty_feedback']);
      if (selectedColumns.some((column) => privateColumns.has(column))) {
        let permission;
        if (req.user) {
          values.push(req.user.id);
          permission = `(projects.student_id = $${values.length} OR projects.faculty_guide_id = $${values.length})`;
        } else {
          permission = 'FALSE';
        }
        selectionSql = selectedColumns.map((column) => privateColumns.has(column)
          ? `CASE WHEN ${permission} THEN ${column} ELSE NULL END AS ${column}`
          : column).join(', ');
      }
    }
    const result = await pool.query(
      `SELECT ${selectionSql} FROM ${table} ${whereSql} ${orderSql} LIMIT ${limit} OFFSET ${offset}`,
      values,
    );
    res.json({ data: result.rows, error: null, count: countResult?.rows[0]?.count ?? null });
    return;
  }

  if (operation === 'insert') {
    if (table === 'projects') {
      for (const row of bodyRows) {
        const allowedFields = new Set([
          'id', 'college_id', 'title', 'description', 'technologies', 'team_name',
          'github_url', 'demo_url', 'student_id', 'faculty_guide_id', 'status',
          'faculty_feedback',
        ]);
        if (Object.keys(row).some((column) => !allowedFields.has(column))) {
          throw httpError(400, 'The proposal includes unsupported fields.');
        }
        if (Number(row.college_id) !== Number(req.user.college_id)) {
          throw httpError(403, 'Projects must belong to your college.');
        }
        row.github_url = validateWebUrl(row.github_url, 'Repository link');
        row.demo_url = validateWebUrl(row.demo_url, 'Demo link');
        const guide = await pool.query(
          `SELECT id, full_name FROM profiles
            WHERE id = $1 AND role = 'faculty' AND college_id = $2 AND status = 'Active'`,
          [row.faculty_guide_id, req.user.college_id],
        );
        if (!guide.rowCount) throw httpError(400, 'Choose an active faculty guide from your college.');
        row.student_id = req.user.id;
        row.student_name = req.user.full_name;
        row.faculty_guide_name = guide.rows[0].full_name;
        row.college_id = req.user.college_id;
        row.status = 'pending';
        row.faculty_feedback = null;
        row.report_path = null;
        row.demo_video_path = null;
        delete row.created_at;
        delete row.updated_at;
      }
    } else if (table === 'project_team_members') {
      const allowedFields = new Set(['project_id', 'member_name', 'member_email']);
      if (bodyRows.some((row) => Object.keys(row).some((column) => !allowedFields.has(column)))) {
        throw httpError(400, 'The team member entry includes unsupported fields.');
      }
      const projectIds = [...new Set(bodyRows.map((row) => row.project_id))];
      if (projectIds.some((id) => !id)) throw httpError(400, 'Each team member must belong to a project.');
      const ownedProjects = await pool.query(
        `SELECT id FROM projects
          WHERE id = ANY($1::uuid[]) AND student_id = $2 AND LOWER(status) = 'pending'`,
        [projectIds, req.user.id],
      );
      if (ownedProjects.rowCount !== projectIds.length) {
        throw httpError(403, 'You can add team members only to your own pending proposals.');
      }
    } else if (table === 'project_reviews') {
      const allowedFields = new Set(['project_id', 'faculty_id', 'review_type', 'decision', 'comments']);
      if (bodyRows.some((row) => Object.keys(row).some((column) => !allowedFields.has(column)))) {
        throw httpError(400, 'The review includes unsupported fields.');
      }
      const reviewTypes = new Set(['proposal', 'final']);
      const decisions = new Set(['approved', 'verified', 'rejected', 'changes_requested']);
      for (const row of bodyRows) {
        if (!reviewTypes.has(row.review_type) || !decisions.has(row.decision)) {
          throw httpError(400, 'Invalid project review.');
        }
        row.faculty_id = req.user.id;
        delete row.created_at;
        delete row.reviewed_at;
        const stages = row.review_type === 'proposal' ? ['pending'] : ['approved', 'submitted'];
        const project = await pool.query(
          `SELECT id FROM projects
            WHERE id = $1 AND faculty_guide_id = $2 AND LOWER(status) = ANY($3::text[])`,
          [row.project_id, req.user.id, stages],
        );
        if (!project.rowCount) throw httpError(403, 'You can review only projects assigned to you in the matching review stage.');
        if (row.review_type === 'proposal' && row.decision === 'verified') {
          throw httpError(400, 'A proposal cannot be marked verified.');
        }
        if (row.review_type === 'final' && row.decision === 'approved') {
          throw httpError(400, 'A final submission cannot be marked approved.');
        }
      }
    } else if (table === 'faq_questions') {
      const allowedFields = new Set(['question', 'user_id', 'status']);
      if (bodyRows.some((row) => Object.keys(row).some((column) => !allowedFields.has(column)))) {
        throw httpError(400, 'Only the FAQ question text can be submitted.');
      }
      for (const row of bodyRows) {
        row.user_id = req.user.id;
        row.answer = null;
        row.status = 'pending';
        row.answered_at = null;
        row.answered_by = null;
      }
    } else if (table === 'colleges' && bodyRows.some((row) => Object.keys(row).some((column) => column !== 'college_name'))) {
      throw httpError(400, 'Only college names can be supplied.');
    }

    const columns = [...new Set(bodyRows.flatMap((row) => Object.keys(row)))];
    if (columns.length === 0) throw httpError(400, 'No insert data supplied.');
    const parameters = [];
    const tuples = bodyRows.map((row) => {
      const placeholders = columns.map((column) => {
        parameters.push(row[column] ?? null);
        return `$${parameters.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    const result = await pool.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(', ')} RETURNING ${selectedColumns.length ? selectedColumns.join(', ') : 'id'}`,
      parameters,
    );
    res.json({ data: result.rows, error: null, count: result.rowCount });
    return;
  }

  const updateValues = [];
  const setSql = Object.entries(bodyRows[0]).map(([column, value]) => {
    updateValues.push(value);
    return `${column} = $${updateValues.length}`;
  });
  if (setSql.length === 0) throw httpError(400, 'No update data supplied.');

  const where = [];
  const filters = req.body.filters ?? [];
  if (!Array.isArray(filters) || filters.length > 100) throw httpError(400, 'Invalid update filters.');
  for (const filter of filters) {
    if (!filter || typeof filter !== 'object' || Array.isArray(filter)) throw httpError(400, 'Invalid update filter.');
    appendFilter(where, updateValues, filter, table);
  }
  const policy = accessWhere(table, req.user, updateValues);
  if (policy) where.push(policy);
  if (table === 'profiles') {
    updateValues.push(req.user.id);
    where.push(`id = $${updateValues.length}`);
  }
  if (!where.length) throw httpError(400, 'An update must include a restrictive filter.');

  if (table === 'projects' && ['faculty', 'admin'].includes(req.user.role)) {
    const allowedFields = new Set(['status', 'faculty_feedback', 'updated_at']);
    if (!Object.hasOwn(bodyRows[0], 'status') || Object.keys(bodyRows[0]).some((column) => !allowedFields.has(column))) {
      throw httpError(403, 'Project reviewers can update only a project decision and feedback.');
    }
    bodyRows[0].updated_at = new Date().toISOString();
    const status = bodyRows[0].status;
    const allowed = {
      approved: { current: ['pending'], review: 'proposal', decision: 'approved' },
      rejected: { current: ['pending', 'approved', 'submitted'], review: ['proposal', 'final'], decision: 'rejected' },
      changes_requested: { current: ['pending', 'approved', 'submitted'], review: ['proposal', 'final'], decision: 'changes_requested' },
      verified: { current: ['submitted'], review: 'final', decision: 'verified' },
    }[status];
    if (!allowed) throw httpError(403, 'This project transition is not permitted.');
    if (req.user.role === 'faculty') {
      const reviewTypes = Array.isArray(allowed.review) ? allowed.review : [allowed.review];
      updateValues.push(req.user.id, reviewTypes, allowed.decision, allowed.current.map((value) => value.toLowerCase()));
      where.push(`EXISTS (
        SELECT 1 FROM project_reviews r
         WHERE r.project_id = projects.id AND r.faculty_id = $${updateValues.length - 3}
           AND r.review_type = ANY($${updateValues.length - 2}::text[])
           AND r.decision = $${updateValues.length - 1}
      )`);
    }
    where.push(`LOWER(projects.status) = ANY($${updateValues.length}::text[])`);
    if (req.user.role === 'faculty') {
      updateValues.push(req.user.id);
      where.push(`projects.faculty_guide_id = $${updateValues.length}`);
    }
  }

  const returning = selectedColumns.length ? selectedColumns.join(', ') : 'id';
  const result = await pool.query(
    `UPDATE ${table} SET ${setSql.join(', ')} WHERE ${where.join(' AND ')} RETURNING ${returning}`,
    updateValues,
  );
  res.json({ data: result.rows, error: null, count: result.rowCount });
}));

app.post('/api/rpc/submit_project_final', authOptional, loadAuthenticatedProfile, requireAuth, requireRole('student'), asyncRoute(async (req, res) => {
  const { p_project_id: projectId, p_demo_url: demoUrl, p_report_path: reportPath, p_demo_video_path: videoPath } = req.body || {};
  let parsedDemoUrl;
  try {
    parsedDemoUrl = new URL(String(demoUrl || ''));
  } catch {
    throw httpError(400, 'Enter a valid HTTP or HTTPS demo link.');
  }
  if (!['http:', 'https:'].includes(parsedDemoUrl.protocol) || !parsedDemoUrl.hostname) {
    throw httpError(400, 'Enter a valid HTTP or HTTPS demo link.');
  }
  if (typeof projectId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
    throw httpError(400, 'Invalid project id.');
  }
  if (typeof reportPath !== 'string' || typeof videoPath !== 'string' || reportPath === videoPath) {
    throw httpError(400, 'Upload a separate report and demo video before submitting.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, status FROM projects
        WHERE id = $1 AND student_id = $2
        FOR UPDATE`,
      [projectId, req.user.id],
    );
    if (!rows[0] || !['approved', 'changes_requested'].includes(rows[0].status)) {
      throw httpError(409, 'Project not found or not ready for final submission.');
    }
    const fileResult = await client.query(
      `SELECT storage_key, content_type
         FROM project_files
        WHERE project_id = $1 AND owner_id = $2
          AND storage_key = ANY($3::text[])`,
      [projectId, req.user.id, [reportPath, videoPath]],
    );
    if (fileResult.rowCount !== 2) throw httpError(400, 'Upload both final files before submitting.');
    if (!fileResult.rows.some((file) => file.storage_key === reportPath && ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.content_type))) {
      throw httpError(400, 'The report file is invalid.');
    }
    if (!fileResult.rows.some((file) => file.storage_key === videoPath && file.content_type.startsWith('video/'))) {
      throw httpError(400, 'The demo video file is invalid.');
    }
    await client.query(
      `UPDATE projects
          SET demo_url = $1, report_path = $2, demo_video_path = $3,
              status = 'submitted', updated_at = NOW()
        WHERE id = $4`,
      [parsedDemoUrl.toString(), reportPath, videoPath, projectId],
    );
    await client.query('COMMIT');
    res.json({ data: null, error: null });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

const diskStorage = multer.diskStorage({
  destination(_req, _file, callback) {
    callback(null, uploadRoot);
  },
  filename(_req, _file, callback) {
    callback(null, crypto.randomUUID());
  },
});
const upload = multer({
  storage: diskStorage,
  limits: { fileSize: maxUploadBytes, files: 1 },
});

app.post('/api/files/upload/:projectId', authOptional, loadAuthenticatedProfile, requireAuth, requireRole('student'), upload.single('file'), asyncRoute(async (req, res) => {
  if (!req.file) throw httpError(400, 'Choose a file to upload.');
  if (!storageClient) {
    fs.rmSync(req.file.path, { force: true });
    throw httpError(503, 'Neon Object Storage is not configured.', 'storage_not_configured');
  }
  const projectId = req.params.projectId;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
    fs.rmSync(req.file.path, { force: true });
    throw httpError(400, 'Invalid project id.');
  }
  const extension = path.extname(req.file.originalname).slice(1).toLowerCase();
  const expectedType = fileTypes.get(extension);
  const mimeType = req.file.mimetype;
  let storageKey;
  let objectUploaded = false;
  try {
    if (!expectedType || mimeType !== expectedType) throw httpError(400, 'Unsupported file format.');
    const projectResult = await pool.query(
      `SELECT id FROM projects WHERE id = $1 AND student_id = $2
        AND LOWER(status) IN ('approved', 'changes_requested')`,
      [projectId, req.user.id],
    );
    if (!projectResult.rowCount) {
      throw httpError(403, 'You can upload files only to your approved project.');
    }

    storageKey = `${req.user.id}/${projectId}/${crypto.randomUUID()}`;
    await storageClient.send(new PutObjectCommand({
      Bucket: storageBucket,
      Key: storageKey,
      Body: fs.createReadStream(req.file.path),
      ContentLength: req.file.size,
      ContentType: expectedType,
    }));
    objectUploaded = true;
    await pool.query(
      `INSERT INTO project_files (storage_key, project_id, owner_id, original_name, content_type, byte_size)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [storageKey, projectId, req.user.id, path.basename(req.file.originalname), expectedType, req.file.size],
    );
    res.status(201).json({ data: { path: storageKey }, error: null });
  } catch (error) {
    if (objectUploaded) {
      try {
        await storageClient.send(new DeleteObjectCommand({ Bucket: storageBucket, Key: storageKey }));
      } catch (cleanupError) {
        console.error('Failed to remove an orphaned Neon Object Storage upload:', cleanupError.message);
      }
    }
    throw error;
  } finally {
    fs.rmSync(req.file.path, { force: true });
  }
}));

app.post('/api/files/signed-url', authOptional, loadAuthenticatedProfile, requireAuth, asyncRoute(async (req, res) => {
  const storageKey = String(req.body?.path || '');
  const { rows } = await pool.query(
    `SELECT f.storage_key, f.project_id, f.owner_id, f.original_name, f.content_type,
            p.student_id, p.faculty_guide_id
       FROM project_files f JOIN projects p ON p.id = f.project_id
      WHERE f.storage_key = $1`,
    [storageKey],
  );
  const file = rows[0];
  if (!file) throw httpError(404, 'File not found.');
  const permitted = req.user.role === 'admin'
    || file.owner_id === req.user.id
    || file.student_id === req.user.id
    || file.faculty_guide_id === req.user.id;
  if (!permitted) throw httpError(403, 'You are not allowed to view this file.');
  if (!storageClient) throw httpError(503, 'Neon Object Storage is not configured.', 'storage_not_configured');
  const safeFileName = path.basename(file.original_name).replace(/["\\\r\n]/g, '');
  const url = await getSignedUrl(
    storageClient,
    new GetObjectCommand({
      Bucket: storageBucket,
      Key: storageKey,
      ResponseContentType: file.content_type,
      ResponseContentDisposition: `inline; filename="${safeFileName}"`,
    }),
    { expiresIn: 3600 },
  );
  res.json({ data: { signedUrl: url }, error: null });
}));

app.post('/api/files/remove', authOptional, loadAuthenticatedProfile, requireAuth, requireRole('student'), asyncRoute(async (req, res) => {
  const keys = Array.isArray(req.body?.paths) ? req.body.paths.slice(0, 10) : [];
  if (!keys.every((key) => typeof key === 'string')) throw httpError(400, 'Invalid file list.');
  if (!storageClient) throw httpError(503, 'Neon Object Storage is not configured.', 'storage_not_configured');
  const { rows } = await pool.query(
    'SELECT storage_key FROM project_files WHERE owner_id = $1 AND storage_key = ANY($2::text[])',
    [req.user.id, keys],
  );
  for (const row of rows) {
    await storageClient.send(new DeleteObjectCommand({ Bucket: storageBucket, Key: row.storage_key }));
  }
  await pool.query(
    'DELETE FROM project_files WHERE owner_id = $1 AND storage_key = ANY($2::text[])',
    [req.user.id, rows.map((row) => row.storage_key)],
  );
  res.json({ data: null, error: null });
}));

app.post('/api/admin/faculty/:profileId/approve', authOptional, loadAuthenticatedProfile, requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const profileId = req.params.profileId;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId)) {
    throw httpError(400, 'Invalid profile id.');
  }
  const { rows } = await pool.query(
    `UPDATE profiles
        SET status = 'Active'
      WHERE id = $1 AND role = 'faculty' AND status = 'Pending'
        AND auth_user_id IS NOT NULL AND email_verified_at IS NOT NULL
      RETURNING id, email, full_name, role, college_id, department, status, email_verified_at`,
    [profileId],
  );
  if (!rows[0]) {
    throw httpError(409, 'Only a verified faculty account awaiting approval can be approved.', 'faculty_not_pending');
  }
  res.json({ user: safeUser(rows[0]) });
}));

app.patch('/api/admin/profiles/:profileId/status', authOptional, loadAuthenticatedProfile, requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const profileId = req.params.profileId;
  const status = req.body?.status;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId)) {
    throw httpError(400, 'Invalid profile id.');
  }
  if (!['Active', 'Suspended'].includes(status)) {
    throw httpError(400, 'Choose Active or Suspended for account management.');
  }
  const { rows } = await pool.query(
    `UPDATE profiles
        SET status = $2
      WHERE id = $1 AND role IN ('student', 'faculty')
        AND status IN ('Active', 'Suspended')
        AND ($2 <> 'Active' OR (auth_user_id IS NOT NULL AND email_verified_at IS NOT NULL))
      RETURNING id, email, full_name, role, college_id, department, status, email_verified_at`,
    [profileId, status],
  );
  if (!rows[0]) throw httpError(404, 'No eligible student or approved faculty account was found.');
  res.json({ user: safeUser(rows[0]) });
}));

app.patch('/api/admin/projects/:projectId/moderate', authOptional, loadAuthenticatedProfile, requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const projectId = req.params.projectId;
  const status = req.body?.status;
  const feedback = String(req.body?.faculty_feedback || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
    throw httpError(400, 'Invalid project id.');
  }
  if (feedback.length > 3000) throw httpError(400, 'Review feedback must be 3000 characters or fewer.');
  const transitions = {
    approved: ['pending'],
    rejected: ['pending', 'approved', 'submitted', 'changes_requested'],
    changes_requested: ['pending', 'approved', 'submitted'],
    verified: ['submitted'],
  };
  if (!transitions[status]) throw httpError(400, 'Choose an allowed project moderation decision.');
  const { rows } = await pool.query(
    `UPDATE projects
        SET status = $2, faculty_feedback = NULLIF($3, ''), updated_at = NOW()
      WHERE id = $1 AND LOWER(status) = ANY($4::text[])
      RETURNING id, title, status, faculty_feedback, updated_at`,
    [projectId, status, feedback, transitions[status]],
  );
  if (!rows[0]) throw httpError(409, 'The project is missing or no longer in a state for this decision.');
  res.json({ project: rows[0] });
}));

app.post('/api/admin/faculty', authOptional, loadAuthenticatedProfile, requireAuth, requireRole('admin'), authLimiter, asyncRoute(async (req, res) => {
  if (!mailer || !process.env.SMTP_FROM) {
    throw httpError(503, 'Faculty invitations require configured SMTP email delivery.', 'email_not_configured');
  }
  const fullName = String(req.body?.full_name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const collegeId = Number(req.body?.college_id);
  if (fullName.length < 2 || fullName.length > 120) throw httpError(400, 'Enter a valid faculty name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Enter a valid email address.');
  if (!Number.isSafeInteger(collegeId) || collegeId < 1) throw httpError(400, 'Select a college.');
  const college = await pool.query('SELECT id FROM colleges WHERE id = $1', [collegeId]);
  if (!college.rowCount) throw httpError(400, 'The selected college does not exist.');

  const client = await pool.connect();
  let profile;
  let token;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO profiles (email, full_name, role, college_id, status)
       VALUES ($1, $2, 'faculty', $3, 'Pending')
       RETURNING id, email`,
      [email, fullName, collegeId],
    );
    profile = rows[0];
    token = makeOneTimeToken();
    await client.query(
      `INSERT INTO email_tokens (profile_id, token_hash, purpose, expires_at)
       VALUES ($1, $2, 'invite', NOW() + INTERVAL '24 hours')`,
      [profile.id, sha256(token)],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw httpError(409, 'An account already uses this email address.');
    throw error;
  } finally {
    client.release();
  }
  const inviteUrl = `${appUrl}/#/register?invite=${encodeURIComponent(token)}`;
  try {
    await sendMail({
      to: profile.email,
      subject: 'Your ProjectVault faculty invitation',
      text: `Accept your ProjectVault faculty invitation within 24 hours and create your Neon Auth account: ${inviteUrl}`,
      html: `<p>You have been invited to ProjectVault. Accept within 24 hours and create your Neon Auth account:</p><p><a href="${inviteUrl}">Accept faculty invitation</a></p>`,
    });
  } catch (error) {
    console.error('Faculty invitation email delivery failed:', error.message);
    throw error;
  }
  res.status(201).json({ data: { message: 'Faculty invitation sent.' }, error: null });
}));

app.get('/api/functions/hello', asyncRoute(async (_req, res) => {
  if (!neonFunctionUrl) throw httpError(503, 'Neon Functions is not configured.', 'function_not_configured');
  const response = await fetchExternal(neonFunctionUrl);
  if (!response.ok) throw httpError(502, `Neon Function returned HTTP ${response.status}.`, 'function_request_failed');
  res.json({ data: { message: await response.text() }, error: null });
}));

app.get('/api', (_req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: 'API route not found.' } });
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      error: {
        code: error.code,
        message: error.code === 'LIMIT_FILE_SIZE' ? 'Files must be 500 MB or smaller.' : 'Invalid upload.',
      },
    });
    return;
  }
  if (['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', '28P01', '3D000'].includes(error.code)) {
    console.error('PostgreSQL connection error:', error.code);
    res.status(503).json({
      error: {
        code: 'database_unavailable',
        message: 'The PostgreSQL database is unreachable or rejected the connection. Check DATABASE_URL and the database status.',
      },
    });
    return;
  }
  const status = Number(error.status || 500);
  if (status >= 500) console.error('API error:', error);
  res.status(status).json({
    error: {
      code: error.code || 'request_failed',
      message: status >= 500 && status !== 503 ? 'The server could not complete this request.' : error.message,
    },
  });
});

app.listen(port, () => {
  if (dnsLookup) console.log('Backend DNS_SERVERS override is active.');
  console.log(`ProjectVault PostgreSQL API listening on ${port}`);
});
