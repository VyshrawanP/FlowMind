'use client';

import React, { useState, useEffect, useRef, use } from 'react';
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
  importGithubIssues,
  inferComplexity,
  triggerAiAnalysis,
  fetchUsers,
  fetchDigestReports,
  triggerDigestReport,
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
  Calendar, 
  Activity, 
  X, 
  Check,
  AlertTriangle,
  ChevronRight,
  GitBranch,
  Download,
  Loader2,
  Brain,
  ChevronDown,
  Sparkles,
  Users,
  Shield,
  User as UserIcon
} from 'lucide-react';

// Dnd-kit imports
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning';
}

interface PageProps {
  params: Promise<{ boardId: string }>;
}

// -------------------------------------------------------------
// Sortable Card Component for dnd-kit
// -------------------------------------------------------------
interface SortableCardProps {
  card: Card;
  onClick: () => void;
}

function SortableCard({ card, onClick }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.2 : 1,
    zIndex: isDragging ? 100 : 'auto',
  };

  // Determine complexity badge color
  const getComplexityColor = (c: number) => {
    if (c <= 2) return 'bg-emerald-950/80 border-emerald-800 text-emerald-300';
    if (c === 3) return 'bg-amber-950/80 border-amber-800 text-amber-300';
    return 'bg-rose-950/80 border-rose-800 text-rose-300';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="glass-card rounded-lg p-3.5 cursor-grab active:cursor-grabbing shadow-sm relative group touch-none"
    >
      <h4 className="font-semibold text-sm text-zinc-100 group-hover:text-indigo-400 transition-colors">
        {card.title}
      </h4>

      {card.description && (
        <p className="text-xs text-zinc-450 mt-1.5 line-clamp-2 leading-relaxed pointer-events-none">
          {card.description}
        </p>
      )}

      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5 pointer-events-none">
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

      <div className="flex items-center justify-between mt-3.5 pt-2 border-t border-zinc-850/50 text-[10px] text-zinc-550 pointer-events-none">
        <div className="flex items-center gap-1.5">
          <span>Ver: {card.version}</span>
          {card.complexity && (
            <span className={`px-1.5 py-0.5 border rounded text-[9px] font-bold uppercase ${getComplexityColor(card.complexity)}`}>
              Cpx: {card.complexity}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {card.assignee && (
            <span className="text-zinc-400 font-medium flex items-center gap-0.5 bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 rounded">
              <UserIcon className="h-2.5 w-2.5 text-indigo-400" />
              {card.assignee.name || card.assignee.email.split('@')[0]}
            </span>
          )}

          {card.githubIssueNumber ? (
            <span className="text-indigo-400 font-semibold flex items-center gap-0.5">
              <GitBranch className="h-2.5 w-2.5" /> #{card.githubIssueNumber}
            </span>
          ) : (
            <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 text-indigo-400">
              Edit <ChevronRight className="h-2.5 w-2.5" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Droppable Column Component for dnd-kit
// -------------------------------------------------------------
interface DroppableColumnProps {
  id: string;
  children: React.ReactNode;
}

function DroppableColumn({ id, children }: DroppableColumnProps) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="flex-1 overflow-y-auto space-y-3 pr-1 py-1 min-h-[180px]">
      {children}
    </div>
  );
}

// -------------------------------------------------------------
// Markdown Formatter Helpers
// -------------------------------------------------------------
function parseBold(text: string) {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, idx) => {
    if (idx % 2 === 1) {
      return <strong key={idx} className="font-semibold text-zinc-50">{part}</strong>;
    }
    return part;
  });
}

function renderFormattedText(text: string) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        const cleanLine = line.trim();
        if (cleanLine.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-xs font-bold text-indigo-400 mt-4 mb-2 uppercase tracking-wide">
              {parseBold(cleanLine.substring(4))}
            </h3>
          );
        }
        if (cleanLine.startsWith('#### ')) {
          return (
            <h4 key={idx} className="text-xs font-bold text-zinc-150 mt-3 mb-1.5 flex items-center gap-1">
              {parseBold(cleanLine.substring(5))}
            </h4>
          );
        }
        if (cleanLine.startsWith('- ') || cleanLine.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-1.5 ml-2.5 my-1 text-zinc-350 text-[11px]">
              <span className="text-indigo-500 mt-1">•</span>
              <span>{parseBold(cleanLine.substring(2))}</span>
            </div>
          );
        }
        if (cleanLine === '') {
          return <div key={idx} className="h-1.5"></div>;
        }
        return (
          <p key={idx} className="text-zinc-350 text-[11px] leading-relaxed">
            {parseBold(line)}
          </p>
        );
      })}
    </div>
  );
}

// -------------------------------------------------------------
// Main Board Page Component
// -------------------------------------------------------------
export default function BoardPage({ params }: PageProps) {
  const router = useRouter();
  const { boardId } = use(params);

  // States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showGithubImport, setShowGithubImport] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // AI Insights Streaming Panel States
  const [showAiInsights, setShowAiInsights] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [streamedInsight, setStreamedInsight] = useState('');
  const [latestSavedInsight, setLatestSavedInsight] = useState<string | null>(null);

  // Weekly Digest States
  const [showDigestReports, setShowDigestReports] = useState(false);
  const [digestReports, setDigestReports] = useState<any[]>([]);
  const [isGeneratingDigest, setIsGeneratingDigest] = useState(false);

  // Team View States
  const [showTeamView, setShowTeamView] = useState(false);

  // GitHub Importer States
  const [githubRepoUrl, setGithubRepoUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Dialogs & Editing States
  const [isAddingCol, setIsAddingCol] = useState(false);
  const [newColName, setNewColName] = useState('');
  
  const [addingCardColId, setAddingCardColId] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardDesc, setNewCardDesc] = useState('');
  
  // Complexity Inference States (card creation)
  const [isInferringComplexity, setIsInferringComplexity] = useState(false);
  const [suggestedComplexity, setSuggestedComplexity] = useState<number | null>(null);
  const [suggestedReason, setSuggestedReason] = useState<string | null>(null);
  const [creationComplexity, setCreationComplexity] = useState<string>('');
  const [creationAssigneeId, setCreationAssigneeId] = useState<string>('');

  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [editingCardTitle, setEditingCardTitle] = useState('');
  const [editingCardDesc, setEditingCardDesc] = useState('');
  const [editingCardColId, setEditingCardColId] = useState('');
  const [editingCardAssigneeId, setEditingCardAssigneeId] = useState<string | null>(null);
  const [editingCardComplexity, setEditingCardComplexity] = useState<string>('');
  const [editingCardComplexityReason, setEditingCardComplexityReason] = useState<string>('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  // Ref to hold original state for optimistic UI reversion
  const lastValidBoardStateRef = useRef<Board | null>(null);

  // Dnd-kit Pointer activation constraint (preserve clicks to open modals)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Add toast helper
  const addToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Auth Guard & User Retrieval
  useEffect(() => {
    const token = localStorage.getItem('flowmind_token');
    const storedUser = localStorage.getItem('flowmind_user');
    if (!token || !storedUser) {
      router.push('/login');
      return;
    }
    setCurrentUser(JSON.parse(storedUser));
    
    // Fetch users directory
    const loadUsers = async () => {
      try {
        const directory = await fetchUsers();
        setUsers(directory);
      } catch (e) {
        console.error('Failed fetching users:', e);
      }
    };
    loadUsers();
  }, [router]);

  const loadDigestReports = async () => {
    if (!boardId) return;
    try {
      const reports = await fetchDigestReports(boardId);
      setDigestReports(reports);
    } catch (e) {
      console.error('Failed fetching weekly digests:', e);
    }
  };

  // Load Board data
  const loadBoardData = async () => {
    if (!boardId) return;
    try {
      const data = await fetchBoard(boardId);
      setBoard(data);
      
      // Look up latest AI insight if available
      // Wait, in boards GET response we can fetch board.aiInsights
      // Let's see: board object has aiInsights array. Get the latest one.
      const insights = (data as any).aiInsights || [];
      if (insights.length > 0) {
        // Sort by createdAt desc
        const sorted = [...insights].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setLatestSavedInsight(sorted[0].content);
      }

      await loadDigestReports();
    } catch (error) {
      console.error('Error loading board:', error);
      // do nothing on load failure
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
      setActiveCard((prevActive) => {
        if (prevActive && prevActive.id === updatedCard.id) {
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

    const handleCardMoveFailed = (data: { cardId: string; error: string; card?: Card }) => {
      console.log('WS: card:move:failed received', data);
      addToast(data.error || 'Conflict detected. Latest version kept.', 'warning');
      
      // Revert UI to the last valid state
      if (lastValidBoardStateRef.current) {
        setBoard(lastValidBoardStateRef.current);
      }
      loadBoardData();
    };

    socket.on('card:created', handleCardCreated);
    socket.on('card:updated', handleCardUpdated);
    socket.on('card:moved', handleCardMoved);
    socket.on('card:deleted', handleCardDeleted);
    socket.on('card:move:failed', handleCardMoveFailed);

    return () => {
      socket.off('card:created', handleCardCreated);
      socket.off('card:updated', handleCardUpdated);
      socket.off('card:moved', handleCardMoved);
      socket.off('card:deleted', handleCardDeleted);
      socket.off('card:move:failed', handleCardMoveFailed);
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

  // -------------------------------------------------------------
  // Dnd-kit Drag and Drop Handler with Fractional Indexing
  // -------------------------------------------------------------
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const cardId = active.id as string;
    const overId = over.id as string;

    let activeCardItem: Card | null = null;
    let sourceColId = '';
    for (const col of board.columns) {
      const card = col.cards.find((c) => c.id === cardId);
      if (card) {
        activeCardItem = card;
        sourceColId = col.id;
        break;
      }
    }

    if (!activeCardItem) return;

    let targetColId = '';
    let targetCol: Column | null = null;

    const overColumn = board.columns.find((c) => c.id === overId);
    if (overColumn) {
      targetColId = overId;
      targetCol = overColumn;
    } else {
      for (const col of board.columns) {
        if (col.cards.some((c) => c.id === overId)) {
          targetColId = col.id;
          targetCol = col;
          break;
        }
      }
    }

    if (!targetCol || !targetColId) return;

    let newPosition = 1000.0;
    const destCards = targetCol.cards.filter((c) => c.id !== cardId);

    if (overColumn) {
      if (destCards.length > 0) {
        newPosition = destCards[destCards.length - 1].position + 1000.0;
      } else {
        newPosition = 1000.0;
      }
    } else {
      const overIndex = destCards.findIndex((c) => c.id === overId);
      if (overIndex === -1) {
        newPosition = destCards.length > 0 ? destCards[destCards.length - 1].position + 1000.0 : 1000.0;
      } else {
        if (overIndex === 0) {
          newPosition = destCards[0].position / 2;
        } else {
          const prevPos = destCards[overIndex - 1].position;
          const currPos = destCards[overIndex].position;
          newPosition = (prevPos + currPos) / 2;
        }
      }
    }

    if (sourceColId === targetColId && activeCardItem.position === newPosition) {
      return;
    }

    const originalState = JSON.parse(JSON.stringify(board));
    lastValidBoardStateRef.current = originalState;

    setBoard((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        columns: prev.columns.map((col) => {
          let cards = col.cards;
          if (col.id === sourceColId) {
            cards = cards.filter((c) => c.id !== cardId);
          }
          if (col.id === targetColId) {
            const movedCard = {
              ...activeCardItem!,
              columnId: targetColId,
              position: newPosition,
            };
            cards = [...cards.filter((c) => c.id !== cardId), movedCard].sort((a, b) => a.position - b.position);
          }
          return { ...col, cards };
        }),
      };
    });

    const socket = getSocket();
    socket.emit('card:move', {
      cardId,
      columnId: targetColId,
      position: newPosition,
      version: activeCardItem.version,
      userId: currentUser!.id,
    });
  };

  // GitHub Import trigger
  const handleGithubImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubRepoUrl.trim() || !currentUser) return;

    setIsImporting(true);
    addToast('Contacting GitHub scraper... This might take a few moments.', 'success');

    try {
      const data = await importGithubIssues(board.id, githubRepoUrl.trim(), currentUser.id);
      addToast(data.message || 'Scrape completed.', 'success');
      setGithubRepoUrl('');
      setShowGithubImport(false);
      loadBoardData();
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Error executing GitHub importer.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  // -------------------------------------------------------------
  // AI Project Manager SSE Analysis Stream trigger
  // -------------------------------------------------------------
  const handleTriggerAiSummary = async () => {
    if (isAnalyzing || !currentUser) return;
    
    setIsAnalyzing(true);
    setStreamedInsight('');
    addToast('Calculating bottlenecks and sprint velocity risk levels...', 'success');

    try {
      // Trigger backend computation cron routing
      await triggerAiAnalysis(board.id);

      // Connect EventSource to SSE stream channel
      const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 
        (process.env.NODE_ENV === 'development' 
          ? 'http://localhost:3001' 
          : 'https://flowmind-backend-production-a16e.up.railway.app');
      const API_BASE_URL = rawApiUrl.replace(/\/+$/, '');
      const token = typeof window !== 'undefined' ? localStorage.getItem('flowmind_token') || '' : '';
      const eventSource = new EventSource(`${API_BASE_URL}/api/boards/${board.id}/ai-stream?token=${encodeURIComponent(token)}`);

      eventSource.onmessage = (event) => {
        if (event.data === '[DONE]') {
          eventSource.close();
          setIsAnalyzing(false);
          addToast('AI audit streaming complete!', 'success');
          loadBoardData(); // pull saved result
          return;
        }
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.token) {
            setStreamedInsight((prev) => prev + parsed.token);
          }
        } catch (e) {
          // ignore parsing error
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE connection closed or failed:', err);
        eventSource.close();
        setIsAnalyzing(false);
      };

    } catch (error: any) {
      console.error(error);
      addToast(error.message || 'Failed triggering AI analysis.', 'error');
      setIsAnalyzing(false);
    }
  };

  // -------------------------------------------------------------
  // Weekly Digest compilation trigger
  // -------------------------------------------------------------
  const handleTriggerWeeklyDigest = async () => {
    if (isGeneratingDigest || !board) return;
    setIsGeneratingDigest(true);
    addToast('Generating Weekly Digest Report analyzing sprint velocity trends and team progress...', 'success');
    try {
      await triggerDigestReport(board.id);
      addToast('Weekly Digest Report compiled successfully!', 'success');
      await loadDigestReports();
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to generate weekly digest report.', 'error');
    } finally {
      setIsGeneratingDigest(false);
    }
  };

  // -------------------------------------------------------------
  // Card Complexity Inferrer Trigger (Creation)
  // -------------------------------------------------------------
  const handleGetAiComplexitySuggestion = async () => {
    if (!newCardTitle.trim() || isInferringComplexity) return;

    setIsInferringComplexity(true);
    setSuggestedComplexity(null);
    setSuggestedReason(null);
    
    try {
      const data = await inferComplexity(newCardTitle, newCardDesc);
      setSuggestedComplexity(data.complexity);
      setSuggestedReason(data.reasoning);
      addToast(`AI suggested complexity: ${data.complexity}/5`, 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to fetch complexity recommendations.', 'error');
    } finally {
      setIsInferringComplexity(false);
    }
  };

  const applyComplexitySuggestion = () => {
    if (suggestedComplexity !== null) {
      setCreationComplexity(suggestedComplexity.toString());
    }
  };

  // Column functions
  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;

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
      loadBoardData();
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
        complexity: creationComplexity ? parseInt(creationComplexity) : undefined,
        complexityReason: suggestedReason || undefined,
        assigneeId: creationAssigneeId || undefined,
      });

      setNewCardTitle('');
      setNewCardDesc('');
      setCreationComplexity('');
      setCreationAssigneeId('');
      setSuggestedComplexity(null);
      setSuggestedReason(null);
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
    setEditingCardAssigneeId(card.assigneeId);
    setEditingCardComplexity(card.complexity ? card.complexity.toString() : '');
    setEditingCardComplexityReason(card.complexityReason || '');
    setSelectedLabels(card.labels.map((cl) => cl.labelId));
  };

  const handleUpdateCardDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCard) return;

    try {
      await updateCard(activeCard.id, {
        title: editingCardTitle.trim(),
        description: editingCardDesc.trim(),
        columnId: editingCardColId,
        assigneeId: editingCardAssigneeId,
        complexity: editingCardComplexity ? parseInt(editingCardComplexity) : null,
        complexityReason: editingCardComplexityReason || undefined,
        version: activeCard.version,
        userId: currentUser.id,
        labelIds: selectedLabels,
      });

      addToast('Card details updated successfully.', 'success');
      setActiveCard(null);
    } catch (err: any) {
      console.error('Update card failed:', err);
      if (err.status === 409) {
        addToast('Conflict detected. Latest version kept.', 'warning');
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
      {/* Background glow graphics */}
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
        </div>        <div className="flex items-center gap-3">
          {/* Admin Panel button (only for ADMIN role) */}
          {currentUser && currentUser.role === 'ADMIN' && (
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center gap-2 px-3.5 py-1.5 border border-indigo-900 bg-indigo-950/40 hover:bg-indigo-900/30 rounded-lg text-xs font-bold text-indigo-400 transition-all cursor-pointer hover:shadow-indigo-500/10"
            >
              <Shield className="h-3.5 w-3.5" /> Admin Panel
            </button>
          )}

          {/* AI Project Manager Toggle Button */}
          <button
            onClick={() => {
              setShowAiInsights(!showAiInsights);
              setShowActivityLog(false);
              setShowDigestReports(false);
              setShowTeamView(false);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 border rounded-lg text-xs font-bold cursor-pointer transition-all glow-indigo hover:shadow-indigo-500/20 ${
              showAiInsights
                ? 'bg-indigo-650 border-indigo-550 text-white'
                : 'bg-zinc-900 border-zinc-850 text-indigo-300 hover:bg-zinc-850 hover:border-zinc-700'
            }`}
          >
            <Brain className="h-3.5 w-3.5 animate-pulse" /> AI Project Manager
          </button>

          {/* Weekly Digests Toggle Button */}
          <button
            onClick={() => {
              setShowDigestReports(!showDigestReports);
              setShowAiInsights(false);
              setShowActivityLog(false);
              setShowTeamView(false);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 border rounded-lg text-xs font-bold cursor-pointer transition-all hover:shadow-purple-500/20 ${
              showDigestReports
                ? 'bg-purple-650 border-purple-550 text-white'
                : 'bg-zinc-900 border-zinc-855 text-purple-300 hover:bg-zinc-850 hover:border-zinc-700'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" /> Weekly Digests
          </button>

          {/* Team View Toggle Button */}
          <button
            onClick={() => {
              setShowTeamView(!showTeamView);
              setShowAiInsights(false);
              setShowDigestReports(false);
              setShowActivityLog(false);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 border rounded-lg text-xs font-bold cursor-pointer transition-all hover:shadow-emerald-500/20 ${
              showTeamView
                ? 'bg-emerald-650 border-emerald-555 text-white'
                : 'bg-zinc-900 border-zinc-855 text-emerald-355 hover:bg-zinc-850 hover:border-zinc-700'
            }`}
          >
            <Users className="h-3.5 w-3.5" /> Team View
          </button>

          <button
            onClick={() => setShowGithubImport(!showGithubImport)}
            className={`flex items-center gap-2 px-3.5 py-1.5 border rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              showGithubImport
                ? 'bg-purple-650 border-purple-550 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-850'
            }`}
          >
            <GitBranch className="h-3.5 w-3.5" /> GitHub Import
          </button>

          <div className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-850 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{currentUser.name}</span>
          </div>

          <button
            onClick={() => {
              setShowActivityLog(!showActivityLog);
              setShowAiInsights(false);
              setShowDigestReports(false);
              setShowTeamView(false);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 border rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              showActivityLog
                ? 'bg-indigo-655 border-indigo-555 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-850'
            }`}
          >
            <Activity className="h-3.5 w-3.5" /> Activity Log
          </button>
        </div>
      </header>

      {/* GitHub Scraper Slide-Down Drawer */}
      {showGithubImport && (
        <div className="border-b border-zinc-900 bg-zinc-900/40 backdrop-blur-md px-8 py-5 relative z-25">
          <div className="max-w-2xl mx-auto glass-panel p-5 rounded-xl glow-purple">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-3 text-purple-400">
              <Download className="h-4 w-4 text-purple-400" />
              Import Public GitHub Issues
            </h3>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              Accepts public repositories (e.g. <code>facebook/react</code> or full URL). Resolves labels, maps assignees, de-duplicates existing items, and automatically feeds columns.
            </p>
            <form onSubmit={handleGithubImport} className="flex gap-3">
              <input
                type="text"
                required
                placeholder="E.g., facebook/react or github.com/owner/repo"
                value={githubRepoUrl}
                onChange={(e) => setGithubRepoUrl(e.target.value)}
                disabled={isImporting}
                className="flex-1 rounded-lg bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <button
                type="submit"
                disabled={isImporting}
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-650 hover:bg-purple-550 disabled:bg-purple-900/50 text-white text-xs font-bold rounded-lg cursor-pointer transition-all shrink-0"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Scraping...
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" /> Import Issues
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Main Kanban Content using dnd-kit */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
      >
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

                {/* Droppable Card Container */}
                <DroppableColumn id={col.id}>
                  <SortableContext
                    items={col.cards.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {col.cards.map((card) => (
                      <SortableCard
                        key={card.id}
                        card={card}
                        onClick={() => openCardDetailModal(card)}
                      />
                    ))}
                  </SortableContext>
                </DroppableColumn>

                {/* Inline Card Creation */}
                {addingCardColId === col.id ? (
                  <form
                    onSubmit={(e) => handleAddCard(e, col.id)}
                    className="p-3 bg-zinc-900 border border-zinc-850 rounded-lg space-y-2.5 mt-3"
                  >
                    <input
                      type="text"
                      required
                      placeholder="Card Title..."
                      value={newCardTitle}
                      onChange={(e) => setNewCardTitle(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                      autoFocus
                    />
                    <textarea
                      placeholder="Optional description details..."
                      value={newCardDesc}
                      onChange={(e) => setNewCardDesc(e.target.value)}
                      rows={2}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-655 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none leading-relaxed"
                    />

                    {/* AI Complexity Recommendation Panel */}
                    {newCardTitle.trim().length > 3 && (
                      <div className="border border-zinc-800 bg-zinc-950/40 p-2 rounded-lg text-[10px] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-indigo-400 font-semibold flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-indigo-400" /> Task Complexity
                          </span>
                          <button
                            type="button"
                            onClick={handleGetAiComplexitySuggestion}
                            disabled={isInferringComplexity}
                            className="text-zinc-400 hover:text-indigo-300 font-bold hover:underline cursor-pointer transition-colors"
                          >
                            {isInferringComplexity ? 'Inferring...' : 'Get AI Suggestion'}
                          </button>
                        </div>
                        
                        {suggestedComplexity !== null && (
                          <div className="space-y-1 bg-zinc-900/50 p-1.5 rounded">
                            <p className="text-zinc-300">
                              Suggested: <span className="text-indigo-400 font-bold">{suggestedComplexity}/5</span>
                            </p>
                            {suggestedReason && <p className="text-zinc-500 leading-normal">{suggestedReason}</p>}
                            <button
                              type="button"
                              onClick={applyComplexitySuggestion}
                              className="text-[9px] text-emerald-400 hover:underline font-bold mt-1 block"
                            >
                              Apply Suggested Complexity
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Manual Assignee & Complexity Selectors */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-500 mb-0.5">COMPLEXITY</label>
                        <select
                          value={creationComplexity}
                          onChange={(e) => setCreationComplexity(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-zinc-400 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">Select (1-5)</option>
                          <option value="1">1 (Trivial)</option>
                          <option value="2">2 (Easy)</option>
                          <option value="3">3 (Medium)</option>
                          <option value="4">4 (Hard)</option>
                          <option value="5">5 (Complex)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-zinc-500 mb-0.5">ASSIGNEE</label>
                        <select
                          value={creationAssigneeId}
                          onChange={(e) => setCreationAssigneeId(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-zinc-400 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">Unassigned</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name || u.email.split('@')[0]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAddingCardColId(null);
                          setSuggestedComplexity(null);
                          setSuggestedReason(null);
                        }}
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
                      setCreationComplexity('');
                      setCreationAssigneeId('');
                      setSuggestedComplexity(null);
                      setSuggestedReason(null);
                      setAddingCardColId(col.id);
                    }}
                    className="w-full flex items-center justify-center gap-1 py-2 border border-dashed border-zinc-850 hover:border-zinc-700 rounded-lg text-xs text-zinc-450 hover:text-zinc-300 hover:bg-zinc-900/20 transition-all cursor-pointer mt-3"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Task Card
                  </button>
                )}
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
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                  board.activityLogs.map((log) => {
                    let logText = log.details;
                    try {
                      const data = JSON.parse(log.details);
                      logText = data.text || log.details;
                    } catch (e) {
                      // fallback for seeded string descriptions
                    }
                    return (
                      <div key={log.id} className="text-xs border-b border-zinc-900 pb-2.5">
                        <p className="text-zinc-300 font-medium">{logText}</p>
                        <div className="flex items-center justify-between mt-1.5 text-[10px] text-zinc-500">
                          <span>User: {log.user.name || 'Anonymous'}</span>
                          <span>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>
          )}

          {/* AI Project Manager Sidebar Panel */}
          {showAiInsights && (
            <aside className="w-96 border-l border-zinc-900 bg-zinc-950/95 backdrop-blur px-6 py-6 overflow-y-auto shrink-0 animate-fade-in relative z-20 flex flex-col h-[90vh] glow-indigo">
              <div className="flex items-center justify-between border-b border-zinc-850 pb-3 mb-5">
                <h3 className="font-extrabold text-sm text-zinc-100 flex items-center gap-2">
                  <Brain className="h-4 w-4 text-indigo-400" /> AI Project Manager
                </h3>
                <button
                  onClick={() => setShowAiInsights(false)}
                  className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Trigger Button */}
              <button
                onClick={handleTriggerAiSummary}
                disabled={isAnalyzing}
                className="w-full mb-6 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 py-2.5 text-xs font-bold text-white transition-all cursor-pointer shadow-md shadow-indigo-600/10"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing Board metrics...
                  </>
                ) : (
                  <>
                    <Brain className="h-3.5 w-3.5" /> Analyze Board Status
                  </>
                )}
              </button>

              {/* Streaming Content Display */}
              <div className="flex-1 overflow-y-auto bg-zinc-900/30 border border-zinc-900 rounded-xl p-4 text-xs font-normal leading-relaxed text-zinc-300">
                {isAnalyzing && streamedInsight === '' && (
                  <div className="flex items-center gap-2 text-zinc-400 italic">
                    <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
                    Connecting to streaming AI agent...
                  </div>
                )}
                
                {/* Streaming output text or the latest saved database insight */}
                {streamedInsight ? (
                  renderFormattedText(streamedInsight)
                ) : latestSavedInsight ? (
                  <div className="space-y-3">
                    <div className="text-[10px] text-zinc-550 border-b border-zinc-850 pb-1.5 uppercase font-bold tracking-wider">
                      LATEST AUDIT REPORT SAVED
                    </div>
                    {renderFormattedText(latestSavedInsight)}
                  </div>
                ) : (
                  <div className="text-zinc-550 italic text-center py-8">
                    No status analysis generated yet. Click the button above to run bottleneck & risk evaluation.
                  </div>
                )}
              </div>
            </aside>
          )}

          {/* Weekly Digest Sidebar Panel */}
          {showDigestReports && (
            <aside className="w-96 border-l border-zinc-900 bg-zinc-950/95 backdrop-blur px-6 py-6 overflow-y-auto shrink-0 animate-fade-in relative z-20 flex flex-col h-[90vh] glow-indigo">
              <div className="flex items-center justify-between border-b border-zinc-850 pb-3 mb-5">
                <h3 className="font-extrabold text-sm text-zinc-100 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-400" /> Weekly Digest Reports
                </h3>
                <button
                  onClick={() => setShowDigestReports(false)}
                  className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Trigger Button */}
              <button
                onClick={handleTriggerWeeklyDigest}
                disabled={isGeneratingDigest}
                className="w-full mb-6 flex items-center justify-center gap-2 rounded-lg bg-purple-650 hover:bg-purple-600 disabled:bg-purple-900/50 py-2.5 text-xs font-bold text-white transition-all cursor-pointer shadow-md shadow-purple-600/10"
              >
                {isGeneratingDigest ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Compiling narrative digest...
                  </>
                ) : (
                  <>
                    <Calendar className="h-3.5 w-3.5" /> Compile Weekly Digest
                  </>
                )}
              </button>

              {/* Digest Reports List */}
              <div className="flex-1 overflow-y-auto space-y-4">
                {digestReports.length === 0 ? (
                  <div className="text-zinc-550 italic text-center py-8 text-xs">
                    No digest reports generated yet. Click the button above to compile a weekly sprint analysis.
                  </div>
                ) : (
                  digestReports.map((report) => (
                    <div key={report.id} className="p-4 bg-zinc-900/40 border border-zinc-905 rounded-xl space-y-3">
                      <div className="flex flex-col gap-1 border-b border-zinc-850/50 pb-2">
                        <span className="font-bold text-xs text-zinc-100">{report.title}</span>
                        <span className="text-[10px] text-zinc-500">
                          Period: {new Date(report.startDate).toLocaleDateString()} - {new Date(report.endDate).toLocaleDateString()}
                        </span>
                      </div>
                      {renderFormattedText(report.content)}
                      <div className="text-[9px] text-zinc-550 text-right pt-1">
                        Compiled on {new Date(report.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </aside>
          )}

          {/* Team View Sidebar Panel */}
          {showTeamView && board && (
            <aside className="w-96 border-l border-zinc-900 bg-zinc-950/95 backdrop-blur px-6 py-6 overflow-y-auto shrink-0 animate-fade-in relative z-20 flex flex-col h-[90vh] glow-emerald">
              <div className="flex items-center justify-between border-b border-zinc-850 pb-3 mb-5">
                <h3 className="font-extrabold text-sm text-zinc-100 flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-400" /> Team Workloads
                </h3>
                <button
                  onClick={() => setShowTeamView(false)}
                  className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4">
                {users.length === 0 ? (
                  <div className="text-zinc-550 italic text-center py-8 text-xs">
                    No team members registered yet.
                  </div>
                ) : (
                  users.map((member) => {
                    const sortedCols = [...board.columns].sort((a, b) => a.position - b.position);
                    const doneColId = sortedCols.length > 0 ? sortedCols[sortedCols.length - 1].id : null;

                    const userCards = board.columns
                      .flatMap((c) => c.cards)
                      .filter((card) => card.assigneeId === member.id);

                    const activeCardsCount = userCards.filter((card) => card.columnId !== doneColId).length;
                    const completedCardsCount = userCards.filter((card) => card.columnId === doneColId).length;
                    
                    const completionRate = userCards.length > 0
                      ? Math.round((completedCardsCount / userCards.length) * 100)
                      : 0;

                    const labelCounts: Record<string, number> = {};
                    userCards.forEach((card) => {
                      card.labels.forEach((cl) => {
                        labelCounts[cl.label.name] = (labelCounts[cl.label.name] || 0) + 1;
                      });
                    });
                    const specialization =
                      Object.keys(labelCounts).sort((a, b) => labelCounts[b] - labelCounts[a])[0] || 'Generalist';

                    return (
                      <div key={member.id} className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-xs font-bold text-emerald-400">
                            {member.name ? member.name.substring(0, 2).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-zinc-100">{member.name || member.email.split('@')[0]}</div>
                            <div className="text-[10px] text-zinc-500">{member.email}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 border-t border-zinc-850/50 pt-2 text-xs">
                          <div>
                            <span className="text-[10px] text-zinc-500 block font-semibold">ACTIVE TASKS</span>
                            <span className={`text-xs font-extrabold ${activeCardsCount > 3 ? 'text-amber-400' : 'text-zinc-200'}`}>
                              {activeCardsCount} active
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-zinc-500 block font-semibold">SPECIALIZATION</span>
                            <span className="text-xs font-extrabold text-emerald-400">
                              {specialization}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-zinc-500 font-semibold">COMPLETION RATE</span>
                            <span className="text-zinc-300 font-bold">{completionRate}%</span>
                          </div>
                          <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${completionRate}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>
          )}
        </div>
      </DndContext>

      {/* Card Details Modal */}
      {activeCard && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl relative animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-900/50">
              <span className="text-xs font-bold px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-450 uppercase flex items-center gap-1.5">
                {activeCard.githubRepoUrl && <GitBranch className="h-3.5 w-3.5 text-indigo-400" />}
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
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 mb-1">DESCRIPTION</label>
                <textarea
                  placeholder="Detailed task guidelines..."
                  value={editingCardDesc}
                  onChange={(e) => setEditingCardDesc(e.target.value)}
                  rows={4}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-655 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none leading-relaxed"
                />
              </div>

              {activeCard.githubRepoUrl && (
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">GITHUB SOURCE LINK</label>
                  <a
                    href={`${activeCard.githubRepoUrl}/issues/${activeCard.githubIssueNumber}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1 px-3 py-2 bg-zinc-950 border border-zinc-850 rounded-lg h-9"
                  >
                    <GitBranch className="h-3.5 w-3.5" />
                    <span>View Issue #{activeCard.githubIssueNumber} on GitHub</span>
                  </a>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">COLUMN (MOVE)</label>
                  <select
                    value={editingCardColId}
                    onChange={(e) => setEditingCardColId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-350 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-medium"
                  >
                    {board.columns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">ASSIGNEE</label>
                  <select
                    value={editingCardAssigneeId || ''}
                    onChange={(e) => setEditingCardAssigneeId(e.target.value || null)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-350 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-medium"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email.split('@')[0]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">COMPLEXITY</label>
                  <select
                    value={editingCardComplexity}
                    onChange={(e) => setEditingCardComplexity(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-350 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-medium"
                  >
                    <option value="">Select (1-5)</option>
                    <option value="1">1 (Trivial)</option>
                    <option value="2">2 (Easy)</option>
                    <option value="3">3 (Medium)</option>
                    <option value="4">4 (Hard)</option>
                    <option value="5">5 (Complex)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">CREATED AT</label>
                  <div className="px-3 py-2 bg-zinc-950 border border-zinc-850 rounded-lg text-xs text-zinc-500 flex items-center gap-1.5 h-[34px]">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{new Date(activeCard.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {editingCardComplexityReason && (
                <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-lg">
                  <span className="block text-[9px] font-bold text-zinc-500 mb-1">AI INFerred REASONING</span>
                  <p className="text-[11px] text-zinc-400 leading-normal">{editingCardComplexityReason}</p>
                </div>
              )}

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
