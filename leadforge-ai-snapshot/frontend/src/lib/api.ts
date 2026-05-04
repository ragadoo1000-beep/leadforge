import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const TOKEN_KEY = "leadforge_token";

export async function setToken(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

async function request(path: string, opts: RequestInit = {}): Promise<any> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((opts.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}/api${path}`, { ...opts, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { detail: text };
  }
  if (!res.ok) {
    const detail = data?.detail;
    const msg =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
        ? detail.map((d: any) => d?.msg || JSON.stringify(d)).join(", ")
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  register: (body: { email: string; password: string; name: string }) =>
    request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => request("/auth/me"),
  updateProfile: (body: any) =>
    request("/auth/profile", { method: "PUT", body: JSON.stringify(body) }),
  togglePremium: () => request("/auth/toggle-premium", { method: "POST" }),
  checkIn: () => request("/auth/check-in", { method: "POST" }),

  fetchLeads: (body?: any) =>
    request("/leads/fetch", {
      method: "POST",
      body: JSON.stringify(body || {}),
    }),
  getFeed: () => request("/leads/feed"),
  getLead: (id: string) => request(`/leads/${id}`),

  generateMessage: (lead_id: string, tone?: string) =>
    request("/leads/generate-message", {
      method: "POST",
      body: JSON.stringify({ lead_id, tone }),
    }),

  saveUserLead: (body: { lead_id: string; status?: string; notes?: string }) =>
    request("/userleads", { method: "POST", body: JSON.stringify(body) }),
  listUserLeads: () => request("/userleads"),
  updateUserLead: (lead_id: string, body: any) =>
    request(`/userleads/${lead_id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  createInvoice: (body: any) =>
    request("/invoices", { method: "POST", body: JSON.stringify(body) }),
  listInvoices: () => request("/invoices"),

  myStats: () => request("/stats/me"),
  leaderboard: () => request("/leaderboard"),

  // Social auth
  googleSession: (session_id: string) =>
    request("/auth/google-session", {
      method: "POST",
      body: JSON.stringify({ session_id }),
    }),
  appleAuth: (body: { identity_token: string; name?: string; email?: string }) =>
    request("/auth/apple", { method: "POST", body: JSON.stringify(body) }),

  // Lead verification
  verifyLead: (lead_id: string) =>
    request(`/leads/${lead_id}/verify`, { method: "POST" }),
  toggleVerifiedFlag: (lead_id: string) =>
    request(`/leads/${lead_id}/mark-verified`, { method: "POST" }),

  // Billing
  billingPlans: () => request("/billing/plans"),
  billingMe: () => request("/billing/me"),
  createSubscription: (tier: string, period: string) =>
    request("/billing/create-subscription", {
      method: "POST",
      body: JSON.stringify({ tier, period }),
    }),
  verifyPayment: (body: any) =>
    request("/billing/verify", { method: "POST", body: JSON.stringify(body) }),
  cancelSubscription: () => request("/billing/cancel", { method: "POST" }),

  // Compliance
  getPolicy: () => request("/policy"),
  deleteAccount: () => request("/account", { method: "DELETE" }),

  // Analytics (internal, user-scoped only)
  trackEvent: (name: string, meta?: any) =>
    request("/events/track", {
      method: "POST",
      body: JSON.stringify({ name, meta: meta || {} }),
    }).catch(() => null), // never fail user flow on analytics error
  eventSummary: () => request("/events/summary"),

  // Public — early access (landing page)
  earlyAccessSignup: (body: { email: string; role?: string; source?: string; company?: string }) =>
    request("/early-access/signup", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  earlyAccessCount: () => request("/early-access/count"),
};
