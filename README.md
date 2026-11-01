# ProjectVault React + Vite + Supabase starter

## What this version does
- Creates an editable React/Vite application structure (`src/App.jsx`, `src/main.jsx`).
- Preserves the previous standalone ProjectVault interface under `public/legacy/index.html`.
- Adds a Supabase client helper and a connection test against `public.colleges` with a zero-row select.
- Keeps credentials in `.env.local`, which is ignored by Git.

## Run locally
1. Install Node.js (LTS).
2. Open this folder in VS Code.
3. Run `npm install`.
4. Copy `.env.example` to `.env.local`.
5. Fill in the Supabase Project URL and publishable/anon key.
6. Run `npm run dev`.
7. Open the URL shown in the terminal.

If you haven't configured Supabase yet, the UI still opens, but the connection test will explain that the environment file is missing.

## Important migration note
The original interface is preserved as a legacy page displayed in an iframe. Its compiled/minified JavaScript has **not** been magically reconstructed into editable JSX components. Migrate screens one at a time into `src/App.jsx` and other components, replacing the iframe only when the migrated screens are ready. This starter does not yet wire the legacy forms to the database, and the secure faculty review/status workflow must be implemented before production use.

Use only the Supabase publishable/anon key in the browser. Never expose a service-role/secret key. Keep RLS enabled and test policies with separate student/faculty accounts.
