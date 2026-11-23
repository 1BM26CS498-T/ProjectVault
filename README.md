# ProjectVault

A college project repository for discovering, managing, and comparing student projects.

ProjectVault is a React/Vite app backed by an Express API, Neon PostgreSQL, Neon Auth, Neon Object Storage, and a Neon Function. The browser never connects directly to PostgreSQL or S3; the API verifies Neon Auth tokens and enforces ProjectVault roles and file access.

## Architecture

- `frontend/` contains the React application and Neon Auth client.
- `backend/` contains the API, Neon JWT verification, PostgreSQL access, and private S3-compatible file handling.
- `database/postgres_schema.sql` defines ProjectVault tables and seeds example colleges.
- `neon.ts` declares Neon Auth, the private `assets` bucket, and the `hello` Function.

## Run locally

Use Node.js 20 or later. Install dependencies from the repository root and the backend:

```powershell
npm install
npm install --prefix backend
npm run dev
```

The dev command starts the API on `http://127.0.0.1:4000` and Vite on `http://127.0.0.1:5173`. The backend automatically loads the Neon CLI-generated root `.env.local`; never commit or share that file. If you are not using the Neon CLI, copy `backend/.env.example` to `backend/.env` and set the variables described there.

If the operating system DNS resolver blocks Neon hostnames but direct DNS to an approved resolver is allowed, set `DNS_SERVERS` in `.env.local` (for example, `1.1.1.1,1.0.0.1`) and restart the API. This affects DNS lookups made by the backend only; it does not change Windows network settings.

## Database and Neon services

The Neon project configuration is in `neon.ts`. After provisioning or changing services, run `neon deploy` from the repository root. The CLI writes server credentials to `.env.local`; the Vite config exposes only the public Neon Auth URL to the browser.

Apply `database/postgres_schema.sql` to a new database. For an already-connected database, apply the migrations in order: `database/migrations/20261103_faculty_approval.sql`, then `database/migrations/20261121_external_project_references.sql`. The first adds pending faculty approval, restricts role values for pending registrations, enforces case-insensitive unique profile emails, and removes the unused legacy password-hash column (Neon Auth is the sole password provider). The second adds private per-student storage for external project references. The schema seeds example colleges. If the Neon starter database already has its incompatible sample `projects` table, the schema preserves it as `neon_sample_projects_legacy`. Check `http://127.0.0.1:4000/api/health` for PostgreSQL, Neon Auth, Object Storage, and Function status: `not_configured` means required environment variables are missing, `unavailable` means a configured service could not be reached, and `connected` means its health check passed.

The private `assets` bucket stores reports and demo videos. The API generates short-lived download URLs only after checking the signed-in user's ProjectVault role and project membership. The `hello` Function is available through the API at `/api/functions/hello`.

## Similarity checker references

Students can save public HTTPS website pages and public GitHub repositories as private external references from the proposal similarity checker. ProjectVault compares the readable page text, GitHub README, or directly linked documentation with the proposal and displays the matches on screen; external references are not added to the approved-project catalogue. Add a direct public text, Markdown, or PDF URL to compare documentation. Private repositories and multi-page website crawling are not supported. Each source is limited to 2 MB; PDFs are limited to 25 pages; imported text is truncated to 80,000 characters. URLs with credentials or query parameters are rejected.

## Accounts and roles

Neon Auth manages signup, sign-in, email verification, password resets, and passwords. ProjectVault profiles remain in PostgreSQL and are the authority for student, faculty, and admin roles; a verified email domain never assigns a privileged role.

Students and faculty can register through the existing Neon Auth provider. After email verification, students receive active student profiles; faculty receive `Pending` profiles that cannot use protected API routes until an administrator approves them. Admins can approve verified faculty, suspend/reactivate student or approved-faculty accounts, and moderate proposals from the admin workspace. Faculty invitations are optional and require SMTP settings: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`.

Public registration accepts only the `student` and `faculty` roles; it never creates administrators. To initialize the first administrator, first create a student account through ProjectVault and verify its Neon Auth email. Then, from the repository root, set these PowerShell variables and run the one-time setup script:

```powershell
$env:ADMIN_EMAIL = "you@example.com"
$env:ADMIN_NAME = "ProjectVault Administrator"
$env:ADMIN_COLLEGE_ID = "1"
npm run create-admin --prefix backend
```

The script requires the configured `ADMIN_EMAIL` to match an active, verified Neon Auth-linked student, and it refuses to initialize a second admin. It does not create or store a password or promote unverified accounts. Reload ProjectVault after the script succeeds to refresh the account's role.

## Deploy

The included `render.yaml` deploys the Express API. Configure the `sync: false` variables in Render from your Neon project output and set `APP_URL` and `CORS_ORIGIN` to the deployed frontend origin. Add the deployed frontend origin to Neon Auth's trusted origins. Deploy the frontend as a static Vite site with `VITE_API_URL` set to the API's public origin and `VITE_NEON_AUTH_URL` set to the public Neon Auth base URL. Do not put database or S3 credentials in `VITE_` variables.

Neon database, Auth, storage, and Function availability—and SMTP, API hosting, file bandwidth, and connection limits—depend on provider plans. Configure backups and rotate any credentials that may have been exposed.
