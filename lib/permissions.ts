const API = 'http://localhost:3001';

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('anphat_token') ?? '';
}

function headers() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` };
}

export interface PermissionMeta {
  modules: { key: string; label: string }[];
  actions: { key: string; label: string }[];
}

export interface RolePermission {
  id: number;
  roleId: string;
  module: string;
  action: string;
  allowed: boolean;
}

export const permissionsApi = {
  async getMeta(): Promise<PermissionMeta> {
    const r = await fetch(`${API}/permissions/meta`, { headers: headers() });
    if (!r.ok) throw new Error('Không thể tải meta phân quyền');
    return r.json();
  },

  async getPermissions(roleId: string): Promise<RolePermission[]> {
    const r = await fetch(`${API}/permissions/roles/${encodeURIComponent(roleId)}`, { headers: headers() });
    if (!r.ok) throw new Error('Không thể tải phân quyền');
    return r.json();
  },

  async updatePermissions(roleId: string, permissions: { module: string; action: string; allowed: boolean }[]): Promise<RolePermission[]> {
    const r = await fetch(`${API}/permissions/roles/${encodeURIComponent(roleId)}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ permissions }),
    });
    if (!r.ok) throw new Error('Không thể lưu phân quyền');
    return r.json();
  },
};
