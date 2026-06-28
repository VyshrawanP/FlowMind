'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchBoards, createBoard, User, Board } from '@/lib/api';
import { FolderKanban, Plus, User as UserIcon, ArrowRight, Shield, LogOut } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDesc, setNewBoardDesc] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('flowmind_token');
    const storedUser = localStorage.getItem('flowmind_user');

    if (!token || !storedUser) {
      router.push('/login');
      return;
    }

    try {
      setCurrentUser(JSON.parse(storedUser));
    } catch (e) {
      localStorage.removeItem('flowmind_token');
      localStorage.removeItem('flowmind_user');
      router.push('/login');
      return;
    }
    setIsLoading(false);
  }, [router]);

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
      setError('Could not connect to the workspace API.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('flowmind_token');
    localStorage.removeItem('flowmind_user');
    setCurrentUser(null);
    setBoards([]);
    router.push('/login');
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

  if (isLoading || !currentUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <p className="text-sm text-zinc-400">Loading FlowMind...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen bg-zinc-950 text-zinc-100 p-8 overflow-y-auto">
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
            {currentUser.role === 'ADMIN' && (
              <button
                onClick={() => router.push('/admin')}
                className="flex items-center gap-2 px-3 py-2 bg-indigo-950/40 border border-indigo-900 rounded-lg text-xs font-bold text-indigo-400 hover:bg-indigo-900/30 transition-all cursor-pointer"
              >
                <Shield className="h-4 w-4" /> Admin Panel
              </button>
            )}

            <div className="flex items-center gap-2.5 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300">
              <UserIcon className="h-4 w-4 text-indigo-400" />
              <span>{currentUser.name}</span>
            </div>
            
            <button
              onClick={handleLogout}
              className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-250 transition-all cursor-pointer"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Create Board panel */}
          <section className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-6 h-fit glow-indigo">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <Plus className="h-5 w-5 text-indigo-400" />
              Create New Board
            </h2>
            <form onSubmit={handleCreateBoard} className="space-y-4">
              {error && (
                <div className="p-3 text-xs bg-red-955/40 border border-red-900 text-red-300 rounded-lg">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase tracking-wider">BOARD NAME</label>
                <input
                  type="text"
                  required
                  placeholder="E.g., Q3 Sprint, Roadmap"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  className="w-full rounded-lg bg-zinc-950/80 border border-zinc-850 px-3.5 py-2.5 text-xs text-zinc-150 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase tracking-wider">DESCRIPTION (OPTIONAL)</label>
                <textarea
                  placeholder="Task guidelines or milestones..."
                  value={newBoardDesc}
                  onChange={(e) => setNewBoardDesc(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg bg-zinc-950/80 border border-zinc-850 px-3.5 py-2.5 text-xs text-zinc-150 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 py-3 text-xs font-bold text-white shadow-md shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all cursor-pointer"
              >
                Create Board <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </section>

          {/* Active boards list */}
          <section className="md:col-span-2 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Your Active Board Workspaces</h2>
            
            {boards.length === 0 ? (
              <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-12 text-center text-sm text-zinc-500 italic">
                No board workspaces registered yet. Create one on the left to get started!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {boards.map((board) => (
                  <div
                    key={board.id}
                    onClick={() => router.push(`/boards/${board.id}`)}
                    className="bg-zinc-900/40 hover:bg-zinc-900/60 border border-zinc-900 hover:border-zinc-850 p-6 rounded-xl space-y-3 cursor-pointer transition-all hover:scale-[1.01] flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <h3 className="font-extrabold text-sm text-zinc-100 group-hover:text-indigo-400 transition-colors">
                        {board.name}
                      </h3>
                      <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                        {board.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-zinc-850/50 text-[10px] text-zinc-500">
                      <span>Owner: {board.owner.name || board.owner.email}</span>
                      <span className="font-bold text-indigo-400 flex items-center gap-1">
                        Open Board <ChevronRightIcon />
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

// Simple internal icon helper
function ChevronRightIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right"><path d="m9 18 6-6-6-6"/></svg>
  );
}
