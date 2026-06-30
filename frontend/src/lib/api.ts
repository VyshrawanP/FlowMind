const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role?: string;
  isVerified?: boolean;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface CardLabel {
  cardId: string;
  labelId: string;
  label: Label;
}

export interface Comment {
  id: string;
  content: string;
  cardId: string;
  userId: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
  };
}

export interface Card {
  id: string;
  title: string;
  description: string | null;
  position: number;
  version: number;
  columnId: string;
  boardId: string;
  comments: Comment[];
  labels: CardLabel[];
  githubIssueNumber: number | null;
  githubRepoUrl: string | null;
  complexity: number | null;
  complexityReason: string | null;
  assigneeId: string | null;
  assignee: User | null;
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  id: string;
  name: string;
  position: number;
  boardId: string;
  cards: Card[];
}

export interface ActivityLog {
  id: string;
  action: string;
  details: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
  };
}

export interface Board {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  owner: User;
  columns: Column[];
  labels: Label[];
  activityLogs: ActivityLog[];
}

export interface DigestReport {
  id: string;
  boardId: string;
  title: string;
  content: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}

// Helper to inject JWT token in headers
function getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders
  };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('flowmind_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

// --- AUTH API METHODS ---

export async function signup(email: string, password: string, name?: string): Promise<{ message: string; email: string }> {
  const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to sign up');
  }
  return res.json();
}

export async function verifyOtp(email: string, otpCode: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otpCode }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'OTP verification failed');
  }
  return res.json();
}

export async function login(email: string, password: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    if (res.status === 403 && err.error === 'UnverifiedAccount') {
      throw { status: 403, message: err.message, email: err.email };
    }
    throw new Error(err.message || 'Failed to log in');
  }
  return res.json();
}

export async function resendOtp(email: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/auth/resend-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to resend verification code');
  }
  return res.json();
}

// --- BOARDS API METHODS ---

export async function fetchBoards(): Promise<Board[]> {
  const res = await fetch(`${API_BASE_URL}/api/boards`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch boards');
  return res.json();
}

export async function fetchBoard(id: string): Promise<Board> {
  const res = await fetch(`${API_BASE_URL}/api/boards/${id}`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch board');
  return res.json();
}

export async function createBoard(name: string, description: string, ownerId: string): Promise<Board> {
  const res = await fetch(`${API_BASE_URL}/api/boards`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name, description, ownerId }),
  });
  if (!res.ok) throw new Error('Failed to create board');
  return res.json();
}

export async function fetchUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE_URL}/api/users`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

// --- COLUMNS API METHODS ---

export async function createColumn(name: string, boardId: string, position: number, userId: string): Promise<Column> {
  const res = await fetch(`${API_BASE_URL}/api/columns`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name, boardId, position, userId }),
  });
  if (!res.ok) throw new Error('Failed to create column');
  return res.json();
}

export async function updateColumn(columnId: string, data: { name?: string; position?: number; userId: string }): Promise<Column> {
  const res = await fetch(`${API_BASE_URL}/api/columns/${columnId}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update column');
  return res.json();
}

export async function deleteColumn(columnId: string, userId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/columns/${columnId}?userId=${userId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete column');
}

// --- CARDS API METHODS ---

export async function createCard(data: {
  title: string;
  description?: string;
  position: number;
  columnId: string;
  boardId: string;
  userId: string;
  labelIds?: string[];
  complexity?: number;
  complexityReason?: string;
  assigneeId?: string;
}): Promise<Card> {
  const res = await fetch(`${API_BASE_URL}/api/cards`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create card');
  return res.json();
}

export async function updateCard(cardId: string, data: {
  title?: string;
  description?: string;
  position?: number;
  columnId?: string;
  version?: number;
  userId: string;
  labelIds?: string[];
  complexity?: number | null;
  complexityReason?: string;
  assigneeId?: string | null;
}): Promise<Card> {
  const res = await fetch(`${API_BASE_URL}/api/cards/${cardId}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (res.status === 409) {
    const errorData = await res.json();
    throw { status: 409, message: errorData.message, card: errorData.card };
  }
  if (!res.ok) throw new Error('Failed to update card');
  return res.json();
}

export async function deleteCard(cardId: string, userId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/cards/${cardId}?userId=${userId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete card');
}

// --- INTEGRATIONS & AI METHODS ---

export async function importGithubIssues(
  boardId: string,
  repoUrl: string,
  userId: string
): Promise<{ success: boolean; message: string; imported: number; skipped: number }> {
  const res = await fetch(`${API_BASE_URL}/api/boards/${boardId}/github-import`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ repoUrl, userId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to import GitHub issues');
  }
  return res.json();
}

export async function inferComplexity(
  title: string,
  description?: string
): Promise<{ complexity: number; reasoning: string }> {
  const res = await fetch(`${API_BASE_URL}/api/cards/infer-complexity`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ title, description }),
  });
  if (!res.ok) throw new Error('Failed to infer task complexity');
  return res.json();
}

export async function triggerAiAnalysis(boardId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/boards/${boardId}/trigger-ai`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to trigger AI analysis');
  return res.json();
}

export async function fetchDigestReports(boardId: string): Promise<DigestReport[]> {
  const res = await fetch(`${API_BASE_URL}/api/boards/${boardId}/digest-reports`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch digest reports');
  return res.json();
}

export async function triggerDigestReport(boardId: string): Promise<DigestReport> {
  const res = await fetch(`${API_BASE_URL}/api/boards/${boardId}/trigger-digest`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to trigger weekly digest generation');
  return res.json();
}

// --- ADMIN API METHODS ---

export async function fetchAdminMetrics(): Promise<{
  success: boolean;
  metrics: {
    totalUsers: number;
    totalBoards: number;
    totalCards: number;
    totalColumns: number;
    totalComments: number;
  };
  recentLogs: any[];
}> {
  const res = await fetch(`${API_BASE_URL}/api/admin/metrics`, {
    headers: getHeaders()
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to fetch admin metrics');
  }
  return res.json();
}

export async function fetchAdminUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
    headers: getHeaders()
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to fetch admin users directory');
  }
  return res.json();
}

export async function updateUserRole(id: string, role: string): Promise<{ success: boolean; message: string; user: User }> {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/${id}/role`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to update user role');
  }
  return res.json();
}

export async function deleteUser(id: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to delete user');
  }
  return res.json();
}
