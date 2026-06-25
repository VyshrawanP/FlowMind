'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchBoards, createBoard, createOrGetUser, User, Board } from '@/lib/api';
import { FolderKanban, Plus, User as UserIcon, ArrowRight, Activity, LogOut } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDesc, setNewBoardDesc] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const storedUser = localStorage.getItem('flowmind_user');
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('flowmind_user');
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadBoards();
    }
  }, [currentUser]);

  const loadBoards = async () => {
    try {
      const data = await fetchBoards();
      setBoards(data);
    } catch (err) {
      console.error('Failed to load boards:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    setError('');
    try {
      const user = await createOrGetUser(email, username);
      localStorage.setItem('flowmind_user', JSON.stringify(user));
      setCurrentUser(user);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('flowmind_user');
    setCurrentUser(null);
    setBoards([]);
  };

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName || !currentUser) return;
    try {
      const board = await createBoard(newBoardName, newBoardDesc, currentUser.id);
      setNewBoardName('');
      setNewBoardDesc('');
      loadBoards();
      router.push(`/boards/${board.id}`);
    } catch (err) {
      console.error('Failed to create board:', err);
      setError('Could not create board. Please check database connection.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <p className="text-sm text-zinc-400">Loading FlowMind...</p>
        </div>
      </div>
    );
  }

  // Auth screen if not logged in
  if (!currentUser) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6 overflow-hidden">
        {/* Background glow graphics */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[120px] animate-pulse-slow pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[450px] h-[450px] rounded-full bg-purple-600/10 blur-[150px] animate-pulse-slow pointer-events-none"></div>

        <div className="w-full max-w-md glass-panel rounded-2xl p-8 shadow-2xl relative z-10 glow-indigo">
          <div className="flex flex-col items-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-500/30 mb-3">
              <FolderKanban className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-50 via-zinc-100 to-zinc-400">
              Welcome to FlowMind
            </h1>
            <p className="text-zinc-400 text-sm mt-2 text-center">
              A real-time collaborative Kanban board powered by AI
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 text-xs bg-red-950/50 border border-red-800 text-red-300 rounded-lg">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">EMAIL ADDRESS</label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">YOUR NAME (OPTIONAL)</label>
              <input
                type="text"
                placeholder="John Doe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm transition-all"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-4 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/30 transition-all cursor-pointer"
            >
              Continue to Board <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-zinc-950 text-zinc-100 p-8 overflow-hidden">
      {/* Glow effects */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full bg-indigo-600/5 blur-[150px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between mb-12 border-b border-zinc-900 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 shadow-md shadow-indigo-600/30">
              <FolderKanban className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-50">FlowMind Dashboard</h1>
              <p className="text-xs text-zinc-400">Collaborative workspaces synced in real time</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300">
              <UserIcon className="h-4 w-4 text-indigo-400" />
              <span>{currentUser.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Create Board panel */}
          <section className="glass-panel rounded-xl p-6 h-fit glow-indigo">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <Plus className="h-5 w-5 text-indigo-400" />
              Create New Board
            </h2>
            <form onSubmit={handleCreateBoard} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">BOARD NAME</label>
                <input
                  type="text"
                  required
                  placeholder="E.g., Q3 Product Launch"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">DESCRIPTION</label>
                <textarea
                  placeholder="Brief summary of board tasks..."
                  value={newBoardDesc}
                  onChange={(e) => setNewBoardDesc(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 py-2.5 text-sm font-semibold text-white transition-all cursor-pointer shadow-md shadow-indigo-600/10"
              >
                Create Workspace
              </button>
            </form>
          </section>

          {/* Boards List */}
          <section className="md:col-span-2">
            <h2 className="text-lg font-bold text-zinc-200 mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-400" />
              Active Boards ({boards.length})
            </h2>

            {boards.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-zinc-900/30 border border-dashed border-zinc-850 rounded-xl">
                <FolderKanban className="h-10 w-10 text-zinc-650 mb-3" />
                <p className="text-zinc-400 text-sm font-medium">No boards available</p>
                <p className="text-zinc-600 text-xs mt-1 text-center max-w-xs">
                  Create a new Kanban board on the left side to get started.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {boards.map((board) => (
                  <div
                    key={board.id}
                    onClick={() => router.push(`/boards/${board.id}`)}
                    className="glass-card rounded-xl p-5 cursor-pointer flex flex-col justify-between h-36"
                  >
                    <div>
                      <h3 className="font-bold text-base text-zinc-100 line-clamp-1 group-hover:text-indigo-400">
                        {board.name}
                      </h3>
                      <p className="text-zinc-450 text-xs mt-2 line-clamp-2 leading-relaxed">
                        {board.description || 'No description provided.'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-550 border-t border-zinc-850 pt-2">
                      <span>Owner: {board.owner.name || board.owner.email}</span>
                      <span className="flex items-center gap-1 text-indigo-400 font-semibold group">
                        Open Board <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
