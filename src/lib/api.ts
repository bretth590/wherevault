const API_BASE = "/api";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    .then((res) => res.ok)
    .finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });
  return refreshPromise;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  // If 401, attempt a silent refresh and retry once
  if (res.status === 401 && !path.startsWith("/auth/")) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const retryRes = await fetch(`${API_BASE}${path}`, {
        ...options,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
      const retryData = await retryRes.json().catch(() => ({}));
      if (!retryRes.ok) {
        throw new ApiError(retryRes.status, retryData.error || "Request failed");
      }
      return retryData as T;
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, data.error || "Request failed");
  }

  return data as T;
}

// Auth
export const auth = {
  login: (email: string, password: string) =>
    request<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, name?: string) =>
    request<{ user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),
  logout: () =>
    request<{ message: string }>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/account/me"),
  deleteAccount: (password: string) =>
    request<{ message: string }>("/account/me", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    }),
};

// Vault items
export const vault = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ items: VaultItemSummary[]; pagination: Pagination }>(
      `/vault/items${qs}`,
    );
  },
  get: (id: string) => request<{ item: VaultItemDetail }>(`/vault/items/${id}`),
  create: (data: CreateItemPayload) =>
    request<{ item: VaultItemSummary }>("/vault/items", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: UpdateItemPayload) =>
    request<{ item: VaultItemSummary }>(`/vault/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ message: string }>(`/vault/items/${id}`, { method: "DELETE" }),
  toggleFavorite: (id: string) =>
    request<{ item: { id: string; isFavorite: boolean } }>(
      `/vault/items/${id}/favorite`,
      { method: "PATCH" },
    ),
};

// Folders
export const folders = {
  list: () =>
    request<{ folders: Folder[] }>("/vault/folders"),
  create: (name: string, parentId?: string) =>
    request<{ folder: Folder }>("/vault/folders", {
      method: "POST",
      body: JSON.stringify({ name, parentId }),
    }),
  update: (id: string, data: { name?: string; parentId?: string | null }) =>
    request<{ folder: Folder }>(`/vault/folders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ message: string }>(`/vault/folders/${id}`, { method: "DELETE" }),
};

// Tags
export const tags = {
  list: () => request<{ tags: Tag[] }>("/vault/tags"),
  create: (name: string, color?: string) =>
    request<{ tag: Tag }>("/vault/tags", {
      method: "POST",
      body: JSON.stringify({ name, color }),
    }),
  delete: (id: string) =>
    request<{ message: string }>(`/vault/tags/${id}`, { method: "DELETE" }),
};

// Trustees
export const trustees = {
  list: () => request<{ trustees: TrusteeRecord[] }>("/trustees"),
  received: () => request<{ trustees: ReceivedTrustee[] }>("/trustees/received"),
  inviteInfo: (token: string) =>
    request<{ invite: InviteInfo }>(`/trustees/invite/${token}`),
  add: (data: AddTrusteePayload) =>
    request<{ trustee: TrusteeRecord }>("/trustees", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  accept: (token: string) =>
    request<{ message: string }>(`/trustees/accept/${token}`, { method: "POST" }),
  update: (id: string, data: UpdateTrusteePayload) =>
    request<{ trustee: TrusteeRecord }>(`/trustees/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  revoke: (id: string) =>
    request<{ message: string }>(`/trustees/${id}`, { method: "DELETE" }),
  listVault: (id: string) =>
    request<{ items: VaultItemSummary[] }>(`/trustees/${id}/vault`),
  viewItem: (trusteeId: string, itemId: string) =>
    request<{ item: VaultItemDetail }>(`/trustees/${trusteeId}/vault/${itemId}`),
};

// Access Triggers
export const triggers = {
  list: () => request<{ triggers: AccessTrigger[] }>("/triggers"),
  create: (data: CreateTriggerPayload) =>
    request<{ trigger: AccessTrigger }>("/triggers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: UpdateTriggerPayload) =>
    request<{ trigger: AccessTrigger }>(`/triggers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  cancel: (id: string) =>
    request<{ message: string }>(`/triggers/${id}`, { method: "DELETE" }),
  fire: (id: string) =>
    request<{ message: string; trigger: { status: string; executesAt?: string } }>(
      `/triggers/${id}/fire`,
      { method: "POST" },
    ),
  override: (id: string) =>
    request<{ message: string }>(`/triggers/${id}/override`, { method: "POST" }),
};

// Dead Man Switch
export const deadManSwitch = {
  status: () => request<DeadManSwitchStatus>("/dead-man-switch/status"),
  configure: (checkInIntervalDays: number) =>
    request<{ message: string; checkInIntervalDays: number; lastCheckIn: string }>(
      "/dead-man-switch/configure",
      { method: "POST", body: JSON.stringify({ checkInIntervalDays }) },
    ),
  checkIn: () =>
    request<{ message: string; lastCheckIn: string }>("/dead-man-switch/check-in", {
      method: "POST",
    }),
  disable: () =>
    request<{ message: string }>("/dead-man-switch/disable", { method: "POST" }),
};

// Audit Log
export const auditLog = {
  list: (params?: { action?: string; page?: number }) => {
    const qs = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
    return request<{ entries: AuditEntry[]; pagination: Pagination }>(`/audit-log${qs}`);
  },
};

// Types
export interface User {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export interface VaultItemSummary {
  id: string;
  type: string;
  title: string;
  metadata: Record<string, unknown> | null;
  isFavorite: boolean;
  folderId: string | null;
  folder: { id: string; name: string } | null;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

export interface VaultItemDetail extends VaultItemSummary {
  data: Record<string, unknown>;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  _count?: { vaultItems: number };
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  _count?: { items: number };
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface CreateItemPayload {
  type: string;
  title: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  isFavorite?: boolean;
  folderId?: string | null;
  tagIds?: string[];
}

export interface UpdateItemPayload {
  type?: string;
  title?: string;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
  isFavorite?: boolean;
  folderId?: string | null;
  tagIds?: string[];
}

export interface TrusteeRecord {
  id: string;
  trustee: { id: string; email: string; name: string | null };
  role: "TRUSTEE" | "EXECUTOR";
  status: "PENDING" | "ACCEPTED" | "REVOKED";
  accessLevel: { types?: string[] } | null;
  activatedAt: string | null;
  permittedItems: Array<{ id: string; title: string; type: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface ReceivedTrustee {
  id: string;
  grantor: { id: string; email: string; name: string | null };
  role: "TRUSTEE" | "EXECUTOR";
  status: "PENDING" | "ACCEPTED" | "REVOKED";
  activatedAt: string | null;
  createdAt: string;
}

export interface InviteInfo {
  grantorName: string;
  role: "TRUSTEE" | "EXECUTOR";
  accessLevel: { types?: string[] } | null;
  status: "PENDING" | "ACCEPTED" | "REVOKED";
  expired: boolean;
  expiresAt: string | null;
}

export interface AddTrusteePayload {
  trusteeEmail: string;
  role: "TRUSTEE" | "EXECUTOR";
  accessLevel?: { types?: string[] };
  itemIds?: string[];
}

export interface UpdateTrusteePayload {
  role?: "TRUSTEE" | "EXECUTOR";
  accessLevel?: { types?: string[] } | null;
  itemIds?: string[];
}

export interface AccessTrigger {
  id: string;
  type: "MANUAL" | "DEAD_MAN_SWITCH" | "INACTIVITY";
  status: "ARMED" | "TRIGGERED" | "EXECUTED" | "CANCELLED" | "OVERRIDDEN";
  delayDays: number;
  inactivityDays: number | null;
  triggeredAt: string | null;
  executesAt: string | null;
  executedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface CreateTriggerPayload {
  type: "MANUAL" | "DEAD_MAN_SWITCH" | "INACTIVITY";
  delayDays?: number;
  inactivityDays?: number;
}

export interface UpdateTriggerPayload {
  delayDays?: number;
  inactivityDays?: number;
}

export interface DeadManSwitchStatus {
  enabled: boolean;
  checkInIntervalDays?: number;
  lastCheckIn?: string;
  nextCheckInDue?: string;
  isOverdue?: boolean;
}

export interface AuditEntry {
  id: string;
  action: string;
  actor: { id: string; email: string; name: string | null };
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export { ApiError };
