'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAdminMetrics, fetchAdminUsers, updateUserRole, deleteUser, User } from '@/lib/api';
import { 
  ArrowLeft, Shield, Users, Folder, MessageSquare, 
  Terminal, ShieldAlert, Trash2, ShieldCheck, Loader2
} from 'lucide-react';

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dashboard metrics
  const [metrics, setMetrics] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const storedUser = localStorage.getItem('flowmind_user');
    if (!storedUser) {
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      if (parsedUser.role !== 'ADMIN') {
        router.push('/');
        return;
      }
      setIsAdmin(true);
      loadAdminData();
    } catch (e) {
      router.push('/login');
    }
  }, [router]);

  const loadAdminData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const metricsData = await fetchAdminMetrics();
      setMetrics(metricsData.metrics);
      setRecentLogs(metricsData.recentLogs);

      const usersData = await fetchAdminUsers();
      setUsersList(usersData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch admin metrics directory.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
    setError('');
    setMessage('');
    try {
      await updateUserRole(userId, newRole);
      setMessage(`User role updated to ${newRole} successfully.`);
      
      // Update local storage if updating oneself
      const storedUserStr = localStorage.getItem('flowmind_user');
      if (storedUserStr) {
        const currentUserObj = JSON.parse(storedUserStr);
        if (currentUserObj.id === userId) {
          currentUserObj.role = newRole;
          localStorage.setItem('flowmind_user', JSON.stringify(currentUserObj));
          if (newRole !== 'ADMIN') {
            router.push('/');
            return;
          }
        }
      }

      await loadAdminData();
    } catch (err: any) {
      setError(err.message || 'Failed to update role.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to permanently delete this user account? All associated boards and tasks will be lost.')) {
      return;
    }
    setError('');
    setMessage('');
    try {
      await deleteUser(userId);
      setMessage('User account and data deleted successfully.');
      await loadAdminData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user.');
    }
  };

  if (isLoading && !isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm text-zinc-400">Verifying administrative access...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen bg-zinc-950 text-zinc-100 p-8 overflow-y-auto">
      {/* Background glow graphic */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full bg-indigo-600/5 blur-[150px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-zinc-900 pb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-50 flex items-center gap-2.5">
                <Shield className="h-6 w-6 text-indigo-400" /> FlowMind Administrator Panel
              </h1>
              <p className="text-xs text-zinc-400">Real-time system telemetry and access controls</p>
            </div>
          </div>
        </header>

        {error && (
          <div className="p-3.5 text-xs bg-red-950/40 border border-red-900 text-red-300 rounded-lg flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="p-3.5 text-xs bg-emerald-950/40 border border-emerald-900 text-emerald-300 rounded-lg flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{message}</span>
          </div>
        )}

        {/* Stats Grid */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-5 space-y-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Total Users</span>
              <span className="text-2xl font-extrabold text-zinc-150">{metrics.totalUsers}</span>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-5 space-y-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1.5"><Folder className="h-3.5 w-3.5" /> Active Boards</span>
              <span className="text-2xl font-extrabold text-zinc-150">{metrics.totalBoards}</span>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-5 space-y-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1.5"><Folder className="h-3.5 w-3.5" /> Columns</span>
              <span className="text-2xl font-extrabold text-zinc-150">{metrics.totalColumns}</span>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-5 space-y-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Total Cards</span>
              <span className="text-2xl font-extrabold text-zinc-150">{metrics.totalCards}</span>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-5 space-y-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Comments</span>
              <span className="text-2xl font-extrabold text-zinc-150">{metrics.totalComments}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* User Management Section */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-400" /> User Administration Directory
            </h2>
            <div className="bg-zinc-900/30 border border-zinc-900 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-900/80 text-zinc-400 font-bold border-b border-zinc-850">
                    <th className="p-4">Name / Email</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850/50">
                  {usersList.map((usr) => (
                    <tr key={usr.id} className="hover:bg-zinc-900/20 text-zinc-300">
                      <td className="p-4">
                        <div className="font-bold text-zinc-100">{usr.name || 'Anonymous'}</div>
                        <div className="text-[10px] text-zinc-500">{usr.email}</div>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleRoleChange(usr.id, usr.role || 'USER')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-all ${
                            usr.role === 'ADMIN'
                              ? 'bg-indigo-950/40 border-indigo-900 text-indigo-400'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                          }`}
                        >
                          {usr.role || 'USER'}
                        </button>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          usr.isVerified
                            ? 'bg-emerald-950/40 text-emerald-400'
                            : 'bg-amber-950/40 text-amber-400'
                        }`}>
                          {usr.isVerified ? 'Verified' : 'Pending OTP'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeleteUser(usr.id)}
                          className="p-1.5 bg-zinc-900 hover:bg-red-950 border border-zinc-800 hover:border-red-900 rounded-lg text-zinc-400 hover:text-red-400 transition-all cursor-pointer"
                          title="Delete User"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Telemetry Log Output */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Terminal className="h-4 w-4 text-indigo-400" /> Audit Telemetry logs
            </h2>
            <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 h-[400px] overflow-y-auto font-mono text-[10px] text-zinc-400 space-y-4 scrollbar-thin">
              {recentLogs.length === 0 ? (
                <div className="text-zinc-600 italic text-center py-12">No audit logs available.</div>
              ) : (
                recentLogs.map((log) => (
                  <div key={log.id} className="border-b border-zinc-900/60 pb-3 last:border-none">
                    <div className="flex items-center justify-between text-zinc-550 mb-1">
                      <span>[{new Date(log.createdAt).toLocaleTimeString()}]</span>
                      <span className="text-indigo-400 font-bold">{log.action}</span>
                    </div>
                    <div className="text-zinc-350 leading-relaxed">{log.details}</div>
                    <div className="text-[9px] text-zinc-600 mt-1">By: {log.user.name || log.user.email}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
