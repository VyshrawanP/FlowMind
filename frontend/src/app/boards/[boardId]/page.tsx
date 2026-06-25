'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket, joinBoardRoom, leaveBoardRoom } from '@/lib/socket';
import {
  fetchBoard,
  createColumn,
  updateColumn,
  deleteColumn,
  createCard,
  updateCard,
  deleteCard,
  Board,
  Column,
  Card,
  User,
  Label,
} from '@/lib/api';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Settings, 
  Calendar, 
  Activity, 
  Eye, 
  X, 
  Check,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning';
}

interface PageProps {
  params: Promise<{ boardId: string }>;
}

export default function BoardPage({ params }: PageProps) {
  const router = useRouter();
  const { boardId } = use(params);

  // States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Dialogs & Editing States
  const [isAddingCol, setIsAddingCol] = useState(false);
  const [newColName, setNewColName] = useState('');
  
  const [addingCardColId, setAddingCardColId] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardDesc, setNewCardDesc] = useState('');

  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [editingCardTitle, setEditingCardTitle] = useState('');
  const [editingCardDesc, setEditingCardDesc] = useState('');
  const [editingCardColId, setEditingCardColId] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  // Add toast helper
  const addToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Auth Guard & Loading
  useEffect(() => {
    const storedUser = localStorage.getItem('flowmind_user');
    if (!storedUser) {
      router.push('/');
      return;
    }
    setCurrentUser(JSON.parse(storedUser));
  }, [router]);

  // Load Board data
  const loadBoardData = async () => {
    if (!boardId) return;
    try {
      const data = await fetchBoard(boardId);
      setBoard(data);
    } catch (error) {
      console.error('Error loading board:', error);
      addToast('Failed to load board details. Verify database connections.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadBoardData();
    }
  }, [currentUser, boardId]);

  // Socket sync connection
  useEffect(() => {
    if (!boardId || !currentUser) return;

    const socket = getSocket();
    joinBoardRoom(boardId);

    // Socket Event Handlers
    const handleCardCreated = (newCard: Card) => {
      console.log('WS: card:created received', newCard);
      setBoard((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          columns: prev.columns.map((col) => {
            if (col.id === newCard.columnId) {
              if (col.cards.some((c) => c.id === newCard.id)) return col;
              return {
                ...col,
                cards: [...col.cards, newCard].sort((a, b) => a.position - b.position),
              };
            }
            return col;
          }),
        };
      });
      // Refresh board data to pull activity log updates automatically
      loadBoardData();
    };

    const handleCardUpdated = (updatedCard: Card) => {
      console.log('WS: card:updated received', updatedCard);
      setBoard((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          columns: prev.columns.map((col) => {
            if (col.id === updatedCard.columnId) {
              return {
                ...col,
                cards: col.cards.map((c) => (c.id === updatedCard.id ? updatedCard : c)).sort((a, b) => a.position - b.position),
              };
            }
            return col;
          }),
        };
      });
      // If client has this card open, update active card details so they don't overwrite with stale data
      setActiveCard((prevActive) => {
        if (prevActive && prevActive.id === updatedCard.id) {
          // If active card version is older, notify conflict resolution
          if (updatedCard.version > prevActive.version) {
            return updatedCard;
          }
        }
        return prevActive;
      });
      loadBoardData();
    };

    const handleCardMoved = (movedCard: Card) => {
      console.log('WS: card:moved received', movedCard);
      setBoard((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          columns: prev.columns.map((col) => {
            const filteredCards = col.cards.filter((c) => c.id !== movedCard.id);
            if (col.id === movedCard.columnId) {
              return {
                ...col,
                cards: [...filteredCards, movedCard].sort((a, b) => a.position - b.position),
              };
            }
            return { ...col, cards: filteredCards };
          }),
        };
      });
      setActiveCard((prevActive) => {
        if (prevActive && prevActive.id === movedCard.id) {
          return movedCard;
        }
        return prevActive;
      });
      loadBoardData();
    };

    const handleCardDeleted = (data: { cardId: string; columnId: string }) => {
      console.log('WS: card:deleted received', data);
      setBoard((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          columns: prev.columns.map((col) => {
            if (col.id === data.columnId) {
              return {
                ...col,
                cards: col.cards.filter((c) => c.id !== data.cardId),
              };
            }
            return col;
          }),
        };
      });
      setActiveCard((prevActive) => {
        if (prevActive && prevActive.id === data.cardId) {
          addToast('The card you were viewing was deleted by another user.', 'warning');
          return null;
        }
        return prevActive;
      });
      loadBoardData();
    };

    socket.on('card:created', handleCardCreated);
    socket.on('card:updated', handleCardUpdated);
    socket.on('card:moved', handleCardMoved);
    socket.on('card:deleted', handleCardDeleted);

    return () => {
      socket.off('card:created', handleCardCreated);
      socket.off('card:updated', handleCardUpdated);
      socket.off('card:moved', handleCardMoved);
      socket.off('card:deleted', handleCardDeleted);
      leaveBoardRoom(boardId);
    };
  }, [boardId, currentUser]);

  if (isLoading || !currentUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <p className="text-sm text-zinc-400">Syncing board connection...</p>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100 p-4">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold">Workspace Not Found</h2>
        <button
          onClick={() => router.push('/')}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 transition-all cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </button>
      </div>
    );
  }

  // Column functions
  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;

    // Calculate position (last position + 1000)
    const positions = board.columns.map((c) => c.position);
    const newPos = positions.length > 0 ? Math.max(...positions) + 1000.0 : 1000.0;

    try {
      const col = await createColumn(newColName.trim(), board.id, newPos, currentUser.id);
      setBoard((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          columns: [...prev.columns, { ...col, cards: [] }].sort((a, b) => a.position - b.position),
        };
      });
      setNewColName('');
      setIsAddingCol(false);
      addToast(`Column "${col.name}" added successfully.`);
      loadBoardData(); // update activity log
    } catch (err) {
      console.error(err);
      addToast('Error adding column.', 'error');
    }
  };

  const handleDeleteColumn = async (columnId: string, columnName: string) => {
    if (!confirm(`Are you sure you want to delete column "${columnName}"? All cards inside will be permanently deleted.`)) return;
    try {
      await deleteColumn(columnId, currentUser.id);
      setBoard((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          columns: prev.columns.filter((col) => col.id !== columnId),
        };
      });
      addToast(`Column "${columnName}" deleted.`);
      loadBoardData();
    } catch (err) {
      console.error(err);
      addToast('Error deleting column.', 'error');
    }
  };

  // Card functions
  const handleAddCard = async (e: React.FormEvent, columnId: string) => {
    e.preventDefault();
    if (!newCardTitle.trim()) return;

    // Calculate position
    const col = board.columns.find((c) => c.id === columnId);
    const cardPositions = col?.cards.map((c) => c.position) || [];
    const newPos = cardPositions.length > 0 ? Math.max(...cardPositions) + 1000.0 : 1000.0;

    try {
      await createCard({
        title: newCardTitle.trim(),
        description: newCardDesc.trim(),
        position: newPos,
        columnId,
        boardId: board.id,
        userId: currentUser.id,
        labelIds: [],
      });
      setNewCardTitle('');
      setNewCardDesc('');
      setAddingCardColId(null);
      addToast('Card created successfully.');
    } catch (err) {
      console.error(err);
      addToast('Error creating card.', 'error');
    }
  };

  const openCardDetailModal = (card: Card) => {
    setActiveCard(card);
    setEditingCardTitle(card.title);
    setEditingCardDesc(card.description || '');
    setEditingCardColId(card.columnId);
    setSelectedLabels(card.labels.map((cl) => cl.labelId));
  };

  const handleUpdateCardDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCard) return;

    try {
      const updated = await updateCard(activeCard.id, {
        title: editingCardTitle.trim(),
        description: editingCardDesc.trim(),
        columnId: editingCardColId,
        version: activeCard.version, // Send client version for conflict check
        userId: currentUser.id,
        labelIds: selectedLabels,
      });

      addToast('Card details updated successfully.', 'success');
      setActiveCard(null);
    } catch (err: any) {
      console.error('Update card failed:', err);
      if (err.status === 409) {
        // Show Conflict Toast
        addToast('Conflict detected. Latest version kept.', 'warning');
        // Refresh local cache with latest database version
        if (err.card) {
          openCardDetailModal(err.card);
        }
      } else {
        addToast('Failed to update card details.', 'error');
      }
    }
  };

  const handleDeleteCardClick = async (cardId: string) => {
    if (!confirm('Are you sure you want to delete this card?')) return;
    try {
      await deleteCard(cardId, currentUser.id);
      addToast('Card deleted.');
      setActiveCard(null);
    } catch (err) {
      console.error(err);
      addToast('Error deleting card.', 'error');
    }
  };

  const toggleLabelSelection = (labelId: string) => {
    setSelectedLabels((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
      {/* Background blur decoration */}
      <div className="absolute top-0 left-0 w-[400px] h-[400px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none"></div>

      {/* Header bar */}
      <header className="flex items-center justify-between border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md px-6 py-4 relative z-20 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">{board.name}</h1>
            <p className="text-[11px] text-zinc-400 font-medium">Real-time Kanban Sync Enabled</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-zinc-400 mr-2 bg-zinc-900 border border-zinc-850 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{currentUser.name}</span>
          </div>

          <button
            onClick={() => setShowActivityLog(!showActivityLog)}
            className={`flex items-center gap-2 px-3.5 py-1.5 border rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              showActivityLog
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-850'
            }`}
          >
            <Activity className="h-3.5 w-3.5" /> Activity Log
          </button>
        </div>
      </header>

      {/* Main Kanban Content */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        <div className="flex-1 overflow-x-auto p-6 flex gap-6 items-start">
          {board.columns.map((col) => (
            <div
              key={col.id}
              className="w-80 shrink-0 rounded-xl bg-zinc-900/50 border border-zinc-900 p-4 flex flex-col max-h-[82vh]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 border-b border-zinc-850 pb-2">
                <span className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                  {col.name}
                  <span className="text-xs font-semibold px-2 py-0.5 bg-zinc-800 rounded-full text-zinc-400">
                    {col.cards.length}
                  </span>
                </span>
                <button
                  onClick={() => handleDeleteColumn(col.id, col.name)}
                  className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-red-400 transition-all cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Cards List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1">
                {col.cards.map((card) => (
                  <div
                    key={card.id}
                    onClick={() => openCardDetailModal(card)}
                    className="glass-card rounded-lg p-3.5 cursor-pointer shadow-sm relative group"
                  >
                    {/* Title */}
                    <h4 className="font-semibold text-sm text-zinc-100 group-hover:text-indigo-400 transition-colors">
                      {card.title}
                    </h4>

                    {/* Description excerpt */}
                    {card.description && (
                      <p className="text-xs text-zinc-450 mt-1.5 line-clamp-2 leading-relaxed">
                        {card.description}
                      </p>
                    )}

                    {/* Labels representation */}
                    {card.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {card.labels.map((cl) => (
                          <span
                            key={cl.labelId}
                            className="h-1.5 w-8 rounded-full"
                            style={{ backgroundColor: cl.label.color }}
                            title={cl.label.name}
                          ></span>
                        ))}
                      </div>
                    )}

                    {/* Card Footer details */}
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-850/50 text-[10px] text-zinc-550">
                      <span>Ver: {card.version}</span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 text-indigo-400">
                        View details <ChevronRight className="h-2.5 w-2.5" />
                      </span>
                    </div>
                  </div>
                ))}

                {/* Inline Card Creation */}
                {addingCardColId === col.id ? (
                  <form
                    onSubmit={(e) => handleAddCard(e, col.id)}
                    className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg space-y-2.5"
                  >
                    <input
                      type="text"
                      required
                      placeholder="Card Title..."
                      value={newCardTitle}
                      onChange={(e) => setNewCardTitle(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      autoFocus
                    />
                    <textarea
                      placeholder="Optional details..."
                      value={newCardDesc}
                      onChange={(e) => setNewCardDesc(e.target.value)}
                      rows={2}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setAddingCardColId(null)}
                        className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-[10px] font-bold rounded cursor-pointer transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold text-white rounded cursor-pointer transition-all"
                      >
                        Save Card
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => {
                      setNewCardTitle('');
                      setNewCardDesc('');
                      setAddingCardColId(col.id);
                    }}
                    className="w-full flex items-center justify-center gap-1 py-2 border border-dashed border-zinc-850 hover:border-zinc-700 rounded-lg text-xs text-zinc-450 hover:text-zinc-300 hover:bg-zinc-900/20 transition-all cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Task Card
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Add Column button */}
          {isAddingCol ? (
            <form
              onSubmit={handleAddColumn}
              className="w-80 shrink-0 bg-zinc-900/50 border border-zinc-850 rounded-xl p-4 space-y-3"
            >
              <input
                type="text"
                required
                placeholder="Column name (e.g. Backlog)..."
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                autoFocus
              />
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsAddingCol(false)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 rounded font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-semibold cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsAddingCol(true)}
              className="w-80 shrink-0 flex items-center justify-center gap-2 py-4 border border-dashed border-zinc-850 hover:border-indigo-600/50 hover:bg-indigo-950/5 rounded-xl text-zinc-450 hover:text-indigo-400 transition-all cursor-pointer h-24 shadow-sm"
            >
              <Plus className="h-4 w-4" /> Add Column
            </button>
          )}
        </div>

        {/* Activity Log Overlay */}
        {showActivityLog && (
          <aside className="w-80 border-l border-zinc-900 bg-zinc-950/95 backdrop-blur px-5 py-6 overflow-y-auto shrink-0 animate-fade-in relative z-20 flex flex-col h-[90vh]">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-3 mb-4">
              <h3 className="font-bold text-sm text-zinc-200 flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-indigo-400" /> Board Activity Stream
              </h3>
              <button
                onClick={() => setShowActivityLog(false)}
                className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 pr-1 overflow-y-auto">
              {board.activityLogs.length === 0 ? (
                <p className="text-xs text-zinc-500 italic text-center mt-6">No activity recorded yet.</p>
              ) : (
                board.activityLogs.map((log) => (
                  <div key={log.id} className="text-xs border-b border-zinc-900 pb-2.5">
                    <p className="text-zinc-300 font-medium">{log.details}</p>
                    <div className="flex items-center justify-between mt-1.5 text-[10px] text-zinc-500">
                      <span>User: {log.user.name || 'Anonymous'}</span>
                      <span>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Card Details Modal */}
      {activeCard && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl relative animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-900/50">
              <span className="text-xs font-bold px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-450 uppercase">
                Card Details (v{activeCard.version})
              </span>
              <button
                onClick={() => setActiveCard(null)}
                className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleUpdateCardDetails} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1">CARD TITLE</label>
                <input
                  type="text"
                  required
                  placeholder="Task title"
                  value={editingCardTitle}
                  onChange={(e) => setEditingCardTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1">DESCRIPTION</label>
                <textarea
                  placeholder="Detailed task guidelines..."
                  value={editingCardDesc}
                  onChange={(e) => setEditingCardDesc(e.target.value)}
                  rows={4}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">COLUMN (MOVE)</label>
                  <select
                    value={editingCardColId}
                    onChange={(e) => setEditingCardColId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    {board.columns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">CREATED AT</label>
                  <div className="px-3 py-2 bg-zinc-950 border border-zinc-850 rounded-lg text-xs text-zinc-500 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{new Date(activeCard.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Labels Picker */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-2">BOARD LABELS</label>
                <div className="flex flex-wrap gap-2">
                  {board.labels.map((lbl) => {
                    const isSelected = selectedLabels.includes(lbl.id);
                    return (
                      <button
                        type="button"
                        key={lbl.id}
                        onClick={() => toggleLabelSelection(lbl.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? 'text-white border-transparent'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                        style={isSelected ? { backgroundColor: lbl.color } : {}}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: isSelected ? '#ffffff' : lbl.color }}
                        ></span>
                        {lbl.name}
                        {isSelected && <Check className="h-3 w-3 ml-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-zinc-850 mt-6">
                <button
                  type="button"
                  onClick={() => handleDeleteCardClick(activeCard.id)}
                  className="flex items-center gap-1 px-3 py-2 bg-red-950/30 border border-red-900/50 hover:bg-red-900/20 rounded-lg text-xs font-bold text-red-300 transition-all cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Card
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveCard(null)}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-xs font-semibold rounded-lg cursor-pointer transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-lg cursor-pointer transition-all shadow-md shadow-indigo-600/10"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating custom toasts container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4.5 py-3 rounded-lg border shadow-xl text-xs font-medium animate-slide-in max-w-sm ${
              t.type === 'error'
                ? 'bg-red-950/80 border-red-900 text-red-200'
                : t.type === 'warning'
                ? 'bg-amber-950/80 border-amber-900 text-amber-200'
                : 'bg-zinc-900/90 border-zinc-800 text-indigo-300'
            }`}
          >
            {t.type === 'warning' && <AlertTriangle className="h-4.5 w-4.5 text-amber-400 shrink-0" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
