import { createAuthClient } from '@neon/neon-js/auth';
import { BetterAuthReactAdapter } from '@neon/neon-js/auth/react/adapters';

const authUrl = import.meta.env.VITE_NEON_AUTH_URL || 'http://127.0.0.1:4000/api/neon-auth';

export const isNeonAuthConfigured = Boolean(import.meta.env.VITE_NEON_AUTH_URL);
export const authClient = createAuthClient(authUrl, {
  adapter: BetterAuthReactAdapter(),
});

export async function getAuthToken() {
  const sessionResult = await authClient.getSession();
  if (!sessionResult.data?.session) return null;
  if (sessionResult.data.session.token) return sessionResult.data.session.token;

  const tokenResult = await authClient.token();
  if (tokenResult.error) throw tokenResult.error;
  return tokenResult.data?.token || null;
}
