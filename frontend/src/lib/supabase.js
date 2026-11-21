import { getAuthToken } from './neonAuth.js';

const configuredApiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
const API_URL = configuredApiUrl || '';

export const isApiConfigured = true;

async function request(path, { method = 'GET', body, token: tokenOverride, headers = {} } = {}) {
  const token = tokenOverride === null ? null : tokenOverride || await getAuthToken();
  let response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
    });
  } catch {
    throw new Error('Cannot reach the ProjectVault API. Start the backend in a second terminal, or check VITE_API_URL.');
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`The API did not return JSON (HTTP ${response.status}). Start the backend and check its PostgreSQL connection.`);
  }
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'The API request failed.');
    error.code = payload?.error?.code;
    throw error;
  }
  return payload;
}

class TableQuery {
  constructor(table) {
    this.table = table;
    this.operation = 'select';
    this.columns = '*';
    this.skipAuth = false;
    this.filters = [];
    this.orders = [];
    this.limitValue = 100;
    this.offsetValue = 0;
    this.values = undefined;
    this.countMode = undefined;
    this.head = false;
    this.singleMode = '';
    this.promise = null;
  }

  select(columns = '*', options = {}) {
    this.columns = columns;
    this.countMode = options.count;
    this.head = Boolean(options.head);
    this.skipAuth = options.auth === false;
    return this;
  }

  insert(values) {
    this.operation = 'insert';
    this.values = values;
    return this;
  }

  update(values) {
    this.operation = 'update';
    this.values = values;
    return this;
  }

  eq(column, value) {
    this.filters.push({ column, operator: 'eq', value });
    return this;
  }

  in(column, value) {
    this.filters.push({ column, operator: 'in', value });
    return this;
  }

  is(column, value) {
    this.filters.push({ column, operator: 'is', value });
    return this;
  }

  not(column, operator, value) {
    if (operator !== 'is') throw new Error('Only NULL not-filters are supported.');
    this.filters.push({ column, operator: 'not_is', value });
    return this;
  }

  order(column, { ascending = true } = {}) {
    this.orders.push({ column, ascending });
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  range(from, to) {
    this.offsetValue = from;
    this.limitValue = to - from + 1;
    return this;
  }

  single() {
    this.singleMode = 'single';
    return this.execute();
  }

  maybeSingle() {
    this.singleMode = 'maybeSingle';
    return this.execute();
  }

  async execute() {
    if (!this.promise) {
      this.promise = request('/data', {
        method: 'POST',
        ...(this.skipAuth ? { token: null } : {}),
        body: {
          table: this.table,
          operation: this.operation,
          columns: this.columns,
          filters: this.filters,
          orders: this.orders,
          limit: this.limitValue,
          offset: this.offsetValue,
          count: this.countMode,
          head: this.head,
          values: this.values,
        },
      }).then((result) => {
        let data = result.data;
        if (this.singleMode) {
          if (data?.length === 1) data = data[0];
          else if (this.singleMode === 'maybeSingle' && data?.length === 0) data = null;
          else {
            const error = new Error(data?.length ? 'Expected one row, but the query returned multiple rows.' : 'Expected one row, but no row matched.');
            error.code = 'PGRST116';
            return { data: null, error, count: result.count };
          }
        }
        return { data, error: null, count: result.count };
      }).catch((error) => ({ data: null, error, count: null }));
    }
    return this.promise;
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}

function uploadWithProgress(url, formData, onProgress) {
  return getAuthToken().then((token) => new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let payload;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        resolve({ data: null, error: new Error('The API returned an unreadable upload response.') });
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        resolve({ data: null, error: new Error(payload?.error?.message || 'File upload failed.') });
        return;
      }
      resolve({ data: payload.data, error: null });
    };
    xhr.onerror = () => resolve({ data: null, error: new Error('File upload failed because the network connection was interrupted.') });
    xhr.onabort = () => resolve({ data: null, error: new Error('File upload was cancelled.') });
    xhr.send(formData);
  })).catch((error) => ({ data: null, error }));
}

export const supabase = {
  externalProjects: {
    async list() {
      try {
        const payload = await request('/external-projects');
        return { data: payload.data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    async add(sourceUrl) {
      try {
        const payload = await request('/external-projects', {
          method: 'POST',
          body: { sourceUrl },
        });
        return { data: payload.data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    async remove(referenceId) {
      try {
        await request(`/external-projects/${encodeURIComponent(referenceId)}`, { method: 'DELETE' });
        return { data: null, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  },
  from(table) {
    return new TableQuery(table);
  },
  async rpc(name, args) {
    try {
      const payload = await request(`/rpc/${encodeURIComponent(name)}`, { method: 'POST', body: args });
      return { data: payload.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
  auth: {
    async prepareRegistration({ email, full_name, college_id, role }) {
      try {
        await request('/auth/pending-registration', {
          method: 'POST',
          body: { email, full_name, college_id, role },
          token: null,
        });
        return { error: null };
      } catch (error) {
        return { error };
      }
    },
    async getProjectVaultProfile() {
      try {
        const token = await getAuthToken();
        if (!token) {
          throw new Error('Your Neon Auth session is not available. Please sign in again.');
        }
        const payload = await request('/auth/profile', { method: 'POST', body: {}, token });
        return { data: payload.user, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    async getInvite(token) {
      try {
        const payload = await request(`/auth/invite?token=${encodeURIComponent(token)}`, { token: null });
        return { data: payload.invite, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  },
  functions: {
    async invoke(name, { body } = {}) {
      try {
        const route = name === 'create-faculty' ? '/admin/faculty' : `/functions/${encodeURIComponent(name)}`;
        const payload = await request(route, {
          method: name === 'create-faculty' ? 'POST' : 'GET',
          ...(name === 'create-faculty' ? { body } : {}),
        });
        return { data: payload.data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  },
  admin: {
    async approveFaculty(profileId) {
      try {
        const payload = await request(`/admin/faculty/${encodeURIComponent(profileId)}/approve`, {
          method: 'POST',
          body: {},
        });
        return { data: payload.user, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    async setProfileStatus(profileId, status) {
      try {
        const payload = await request(`/admin/profiles/${encodeURIComponent(profileId)}/status`, {
          method: 'PATCH',
          body: { status },
        });
        return { data: payload.user, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    async moderateProject(projectId, status) {
      try {
        const payload = await request(`/admin/projects/${encodeURIComponent(projectId)}/moderate`, {
          method: 'PATCH',
          body: { status },
        });
        return { data: payload.project, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  },
  storage: {
    from(_bucket) {
      return {
        async upload(storagePath, file, options = {}) {
          try {
            const parts = String(storagePath).split('/');
            if (parts.length < 3) throw new Error('Invalid project file path.');
            const formData = new FormData();
            formData.append('file', file, file.name);
            const result = await uploadWithProgress(
              `${API_URL}/api/files/upload/${encodeURIComponent(parts[1])}`,
              formData,
            );
            if (result.error) throw result.error;
            return { data: { path: result.data.path }, error: null };
          } catch (error) {
            return { data: null, error };
          }
        },
        async createSignedUrl(storagePath) {
          try {
            const payload = await request('/files/signed-url', {
              method: 'POST',
              body: { path: storagePath },
            });
            return { data: { signedUrl: payload.data.signedUrl }, error: null };
          } catch (error) {
            return { data: null, error };
          }
        },
        async remove(paths) {
          try {
            await request('/files/remove', { method: 'POST', body: { paths } });
            return { data: paths, error: null };
          } catch (error) {
            return { data: null, error };
          }
        },
        async uploadWithProgress(projectId, file, onProgress) {
          const formData = new FormData();
          formData.append('file', file, file.name);
          return uploadWithProgress(
            `${API_URL}/api/files/upload/${encodeURIComponent(projectId)}`,
            formData,
            onProgress,
          );
        },
      };
    },
  },
};
