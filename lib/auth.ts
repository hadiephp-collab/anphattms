const TOKEN_KEY = 'anphat_token';
const USER_KEY = 'anphat_user';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function getMe(): Promise<{ id: number; username: string; fullName?: string; role: string; branch?: string | null } | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function saveAuth(token: string, user: object) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  const u = localStorage.getItem(USER_KEY);
  return u ? JSON.parse(u) : null;
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function getBranchIds(): number[] {
  const user = getUser();
  return user?.branchIds ?? [];
}
