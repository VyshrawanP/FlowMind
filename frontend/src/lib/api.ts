const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface User {
  id: string;
  email: string;
  name: string | null;
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

export async function fetchBoards(): Promise<Board[]> {
  const res = await fetch(`${API_BASE_URL}/api/boards`);
  if (!res.ok) throw new Error('Failed to fetch boards');
  return res.json();
}

export async function fetchBoard(id: string): Promise<Board> {
  const res = await fetch(`${API_BASE_URL}/api/boards/${id}`);
  if (!res.ok) throw new Error('Failed to fetch board');
  return res.json();
}

export async function createBoard(name: string, description: string, ownerId: string): Promise<Board> {
  const res = await fetch(`${API_BASE_URL}/api/boards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, ownerId }),
  });
  if (!res.ok) throw new Error('Failed to create board');
  return res.json();
}

export async function fetchUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE_URL}/api/users`);
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function createOrGetUser(email: string, name?: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name }),
  });
  if (!res.ok) throw new Error('Failed to login/register');
  return res.json();
}

export async function createColumn(name: string, boardId: string, position: number, userId: string): Promise<Column> {
  const res = await fetch(`${API_BASE_URL}/api/columns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, boardId, position, userId }),
  });
  if (!res.ok) throw new Error('Failed to create column');
  return res.json();
}

export async function updateColumn(columnId: string, data: { name?: string; position?: number; userId: string }): Promise<Column> {
  const res = await fetch(`${API_BASE_URL}/api/columns/${columnId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update column');
  return res.json();
}

export async function deleteColumn(columnId: string, userId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/columns/${columnId}?userId=${userId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete column');
}

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
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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
  });
  if (!res.ok) throw new Error('Failed to delete card');
}

export async function importGithubIssues(
  boardId: string,
  repoUrl: string,
  userId: string
): Promise<{ success: boolean; message: string; imported: number; skipped: number }> {
  const res = await fetch(`${API_BASE_URL}/api/boards/${boardId}/github-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description }),
  });
  if (!res.ok) throw new Error('Failed to infer task complexity');
  return res.json();
}

export async function triggerAiAnalysis(boardId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/boards/${boardId}/trigger-ai`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to trigger AI analysis');
  return res.json();
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

export async function fetchDigestReports(boardId: string): Promise<DigestReport[]> {
  const res = await fetch(`${API_BASE_URL}/api/boards/${boardId}/digest-reports`);
  if (!res.ok) throw new Error('Failed to fetch digest reports');
  return res.json();
}

export async function triggerDigestReport(boardId: string): Promise<DigestReport> {
  const res = await fetch(`${API_BASE_URL}/api/boards/${boardId}/trigger-digest`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to trigger weekly digest generation');
  return res.json();
}
