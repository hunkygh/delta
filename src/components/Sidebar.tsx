import { Settings, Plus, LogOut, SlidersHorizontal, LayoutGrid } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { authService } from '../services/authService';
import { focalBoardService } from '../services/focalBoardService';
import { CalendarIcon, DatabaseIcon } from '../icons';

interface SidebarProps {
  user?: SupabaseUser | null;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
}

export default function Sidebar({
  user,
  isExpanded,
  setIsExpanded,
  sidebarWidth,
  setSidebarWidth
}: SidebarProps): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const [focals, setFocals] = useState<any[]>([]);
  const [showNewFocalInput, setShowNewFocalInput] = useState(false);
  const [newFocalName, setNewFocalName] = useState('');
  const [loading, setLoading] = useState(true);
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [focalsDropdownOpen, setFocalsDropdownOpen] = useState(false);
  const [focalsDropdownPinned, setFocalsDropdownPinned] = useState(false);
  const [focalLists, setFocalLists] = useState<Record<string, any[]>>({});
  const [loadingLists, setLoadingLists] = useState(false);
  const [listsLoadError, setListsLoadError] = useState('');
  const [expandedFocalIds, setExpandedFocalIds] = useState<Record<string, boolean>>({});
  const [draggingFocalId, setDraggingFocalId] = useState<string | null>(null);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const hoverOpenTimerRef = useRef<number | null>(null);
  const hoverCloseTimerRef = useRef<number | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const focalsContainerRef = useRef<HTMLDivElement | null>(null);
  const pathParts = location.pathname.split('/').filter(Boolean);
  const currentFocalIdFromPath = (pathParts[0] === 'focals' || pathParts[0] === 'spaces') && pathParts[1] && pathParts[1] !== 'list'
    ? pathParts[1]
    : null;
  const currentFocalId = currentFocalIdFromPath || location.state?.selectedFocalId || null;
  const selectedFocalFromNav = location.state?.selectedFocal;
  const listsRefreshToken = location.state?.listsRefreshToken;
  const currentListId = location.pathname.startsWith('/focals/list/') || location.pathname.startsWith('/spaces/list/')
    ? location.pathname.replace('/focals/list/', '').replace('/spaces/list/', '')
    : null;
  const isFocalsDropdownVisible = focalsDropdownOpen || focalsDropdownPinned;

  // Reset inline create UI when dropdown closes.
  useEffect(() => {
    if (!isFocalsDropdownVisible) {
      setShowNewFocalInput(false);
      setNewFocalName('');
      setCreateError('');
    }
  }, [isFocalsDropdownVisible]);

  useEffect(() => {
    if (isExpanded) {
      setIsExpanded(false);
    }
  }, [isExpanded, setIsExpanded]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(target)) {
        setShowSettingsMenu(false);
      }
      if (focalsContainerRef.current && !focalsContainerRef.current.contains(target)) {
        clearHoverCloseTimer();
        setFocalsDropdownOpen(false);
        setFocalsDropdownPinned(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (hoverOpenTimerRef.current) {
        window.clearTimeout(hoverOpenTimerRef.current);
      }
      if (hoverCloseTimerRef.current) {
        window.clearTimeout(hoverCloseTimerRef.current);
      }
    };
  }, []);

  const clearHoverCloseTimer = (): void => {
    if (hoverCloseTimerRef.current) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  const scheduleHoverClose = (): void => {
    if (focalsDropdownPinned) return;
    clearHoverCloseTimer();
    hoverCloseTimerRef.current = window.setTimeout(() => {
      setFocalsDropdownOpen(false);
      hoverCloseTimerRef.current = null;
    }, 320);
  };

  useEffect(() => {
    const loadFocals = async () => {
      if (!user) {
        setFocals([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const userFocals = await focalBoardService.getFocals(user.id);
        setFocals(userFocals);
      } catch (error) {
        console.error('Sidebar failed to load spaces:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFocals();
  }, [user]);

  const loadListsForUser = async (): Promise<void> => {
    if (!user) return;
    setLoadingLists(true);
    setListsLoadError('');
    try {
      const lists = await focalBoardService.getListsForUser(user.id);
      const grouped = (lists || []).reduce((acc: Record<string, any[]>, list: any) => {
        const focalId = list?.focal_id;
        if (!focalId) return acc;
        const bucket = acc[focalId] || [];
        bucket.push(list);
        acc[focalId] = bucket;
        return acc;
      }, {});
      setFocalLists(grouped);
    } catch (error) {
      console.error('Sidebar failed to load lists:', error);
      setListsLoadError((error as any)?.message || 'Failed to load lists');
      setFocalLists({});
    } finally {
      setLoadingLists(false);
    }
  };

  const toggleFocalExpanded = async (focalId: string): Promise<void> => {
    const willExpand = !expandedFocalIds[focalId];
    setExpandedFocalIds((prev) => ({ ...prev, [focalId]: willExpand }));
  };

  useEffect(() => {
    if (!isFocalsDropdownVisible || !user) {
      return;
    }
    void loadListsForUser();
  }, [isFocalsDropdownVisible, user]);

  useEffect(() => {
    if (!user || !listsRefreshToken) {
      return;
    }
    void loadListsForUser();
  }, [user, listsRefreshToken]);

  const handleAddFocal = async () => {
    if (newFocalName.trim() && user) {
      setIsCreating(true);
      setCreateError('');
      
      try {
        const newFocal = await focalBoardService.createFocal(user.id, newFocalName.trim());

        setFocals([...focals, newFocal]);
        setNewFocalName('');
        setShowNewFocalInput(false);
      } catch (error: any) {
        console.error('Failed to create focal:', error);
        setCreateError(error?.message || 'Failed to create space');
        
        // Clear error after 3 seconds
        setTimeout(() => setCreateError(''), 3000);
      } finally {
        setIsCreating(false);
      }
    } else {
      // Show helpful error message
      if (!newFocalName.trim()) {
        setCreateError('Please enter a space name');
      } else if (!user) {
        setCreateError('Please sign in to create spaces');
      }
      
      // Clear error after 3 seconds
      setTimeout(() => setCreateError(''), 3000);
    }
  };

  const handleFocalClick = (focal: any) => {
    navigate(`/spaces/${focal.id}`, { state: { selectedFocal: focal.name, selectedFocalId: focal.id } });
  };

  const handleListClick = (focal: any, list: any) => {
    navigate(`/spaces/list/${list.id}`, { state: { selectedFocal: focal.name, selectedFocalId: focal.id } });
  };

  const reorderFocalToTarget = async (sourceFocalId: string, targetFocalId: string): Promise<void> => {
    const sourceIndex = focals.findIndex((entry) => entry.id === sourceFocalId);
    const targetIndex = focals.findIndex((entry) => entry.id === targetFocalId);
    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;

    const snapshot = [...focals];
    const reordered = [...focals];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    const normalized = reordered.map((entry, index) => ({ ...entry, order_num: index }));
    setFocals(normalized);
    try {
      await Promise.all(
        normalized.map((entry) =>
          focalBoardService.updateFocal(entry.id, { order_num: entry.order_num ?? 0 })
        )
      );
    } catch (error) {
      console.error('Failed to drag-reorder spaces:', error);
      setFocals(snapshot);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.signOut();
      setFocals([]);
      setShowSettingsMenu(false);
      window.location.href = '/login';
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  const isActivePath = (path: string): boolean => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const state = resizeStateRef.current;
      if (!state) return;
      const delta = event.clientX - state.startX;
      const next = Math.min(360, Math.max(180, state.startWidth + delta));
      setSidebarWidth(next);
    };

    const stopResize = () => {
      resizeStateRef.current = null;
      document.body.classList.remove('sidebar-resizing');
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
    };
  }, [setSidebarWidth]);

  const startResize = (event: any) => {
    if (!isExpanded) return;
    resizeStateRef.current = { startX: event.clientX, startWidth: sidebarWidth };
    document.body.classList.add('sidebar-resizing');
  };

  return (
    <nav className={`sidebar-nav sidebar-locked ${isFocalsDropdownVisible ? 'sidebar-has-focals-active' : ''}`.trim()}>
      <div className="sidebar-content">
        <button
          type="button"
          className="sidebar-top-logo"
          aria-label="Open Delta AI"
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent('delta:ai-open-with-context', {
                detail: { source: 'header' }
              })
            );
          }}
        >
          <img src="/Delta-AI-Button.png" alt="Delta AI" />
        </button>
        <div className="sidebar-nav-items">
          <button className={`sidebar-nav-item ${isActivePath('/') ? 'active' : ''}`.trim()} onClick={() => navigate('/')}>
            <CalendarIcon size={14} />
            <span className="sidebar-nav-text">Calendar</span>
          </button>
          <button className={`sidebar-nav-item ${isActivePath('/shell') ? 'active' : ''}`.trim()} onClick={() => navigate('/shell')}>
            <LayoutGrid size={14} />
            <span className="sidebar-nav-text">Shell</span>
          </button>
        </div>
        
        <div className="sidebar-divider-item" />
        
        <div className="sidebar-nav-items">
          <div
            className="focals-dropdown-container"
            ref={focalsContainerRef}
            onMouseEnter={() => {
              clearHoverCloseTimer();
              if (focalsDropdownPinned) {
                return;
              }
              if (hoverOpenTimerRef.current) {
                window.clearTimeout(hoverOpenTimerRef.current);
              }
              hoverOpenTimerRef.current = window.setTimeout(() => {
                setFocalsDropdownOpen(true);
                hoverOpenTimerRef.current = null;
              }, 500);
            }}
            onMouseLeave={() => {
              if (hoverOpenTimerRef.current) {
                window.clearTimeout(hoverOpenTimerRef.current);
                hoverOpenTimerRef.current = null;
              }
              scheduleHoverClose();
            }}
            onFocusCapture={() => {
              if (!focalsDropdownPinned) {
                setFocalsDropdownOpen(true);
              }
            }}
            onBlurCapture={(event) => {
              const nextFocused = event.relatedTarget as Node | null;
              if (!event.currentTarget.contains(nextFocused)) {
                if (!focalsDropdownPinned) {
                  setFocalsDropdownOpen(false);
                }
              }
            }}
          >
            <div className="focals-parent-row">
              <button
                className={`sidebar-nav-item focals-toggle ${isFocalsDropdownVisible ? 'active' : ''}`.trim()}
                onClick={(e) => {
                  e.stopPropagation();
                  setFocalsDropdownPinned(true);
                  setFocalsDropdownOpen(true);
                }}
              >
                <span className="focals-primary-icon" aria-hidden="true">
                  <DatabaseIcon size={18} />
                </span>
                <span className="sidebar-nav-text">Spaces</span>
                <span className={`focals-parent-toggle ${isFocalsDropdownVisible ? 'visible' : ''}`.trim()} aria-hidden="true">
                  <RoundedTriangle expanded={Boolean(isFocalsDropdownVisible)} />
                </span>
              </button>
            </div>
            
            {/* Focals popout */}
            {isFocalsDropdownVisible && (
              <div
                className="focals-dropdown show focals-popout"
                onMouseEnter={() => clearHoverCloseTimer()}
                onMouseLeave={() => scheduleHoverClose()}
              >
                {/* Only show focals list when there are focals */}
                {focals.length > 0 && (
                  focals.map((focal) => (
                    <div
                      key={focal.id}
                      className={`focal-nav-group ${draggingFocalId === focal.id ? 'dragging' : ''}`.trim()}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', focal.id);
                        setDraggingFocalId(focal.id);
                      }}
                      onDragEnd={() => setDraggingFocalId(null)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const sourceId = event.dataTransfer.getData('text/plain');
                        if (!sourceId) return;
                        void reorderFocalToTarget(sourceId, focal.id);
                        setDraggingFocalId(null);
                      }}
                    >
                      <div className="focal-item-row">
                        <button
                          className={`focal-item ${focal.id === currentFocalId || focal.name === selectedFocalFromNav ? 'selected' : ''}`}
                          onClick={() => handleFocalClick(focal)}
                        >
                          <span>{focal.name}</span>
                          <span
                            className={`focal-expand-btn ${expandedFocalIds[focal.id] ? 'visible' : ''}`.trim()}
                            aria-label={`Toggle ${focal.name} lists`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void toggleFocalExpanded(focal.id);
                            }}
                          >
                            <RoundedTriangle expanded={Boolean(expandedFocalIds[focal.id])} />
                          </span>
                        </button>
                      </div>
                      {expandedFocalIds[focal.id] && (
                        <div className="focal-list-links">
                          {loadingLists && (
                            <div className="focal-list-item is-placeholder">Loading lists...</div>
                          )}
                          {!loadingLists && (focalLists[focal.id] || []).map((list) => (
                            <button
                              key={list.id}
                              className={`focal-list-item ${currentListId === list.id ? 'selected' : ''}`.trim()}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleListClick(focal, list);
                              }}
                            >
                              {list.name}
                            </button>
                          ))}
                          {!loadingLists && listsLoadError && (
                            <div className="focal-list-item is-placeholder">{listsLoadError}</div>
                          )}
                          {!loadingLists && !listsLoadError && (focalLists[focal.id] || []).length === 0 && (
                            <div className="focal-list-item is-placeholder">No lists yet</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div className="focals-popout-add-space-row">
                  <button
                    type="button"
                    className="focals-popout-add-space"
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowNewFocalInput((prev) => !prev);
                      if (showNewFocalInput) {
                        setNewFocalName('');
                        setCreateError('');
                      }
                    }}
                  >
                    <Plus size={12} />
                    <span>Add Space</span>
                  </button>
                </div>
                {showNewFocalInput && (
                  <div className="focals-popout-new-space-row">
                    <input
                      type="text"
                      value={newFocalName}
                      onChange={(event) => setNewFocalName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !isCreating) {
                          event.preventDefault();
                          void handleAddFocal();
                        }
                        if (event.key === 'Escape') {
                          setShowNewFocalInput(false);
                          setNewFocalName('');
                          setCreateError('');
                        }
                      }}
                      disabled={isCreating}
                      placeholder={isCreating ? 'Creating…' : 'Space name'}
                      className="focals-popout-new-space-input"
                      autoFocus
                    />
                  </div>
                )}
                {createError && (
                  <div className="focal-create-error">{createError}</div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Footer with settings */}
        <div className="sidebar-footer" ref={settingsMenuRef}>
          <button 
            className="sidebar-nav-item settings-button"
            onClick={(e) => {
              e.stopPropagation();
              setShowSettingsMenu(!showSettingsMenu);
            }}
          >
            <Settings size={14} />
            <span className="sidebar-nav-text">Settings</span>
          </button>
          
          <div className={`sidebar-settings-dropdown ${showSettingsMenu ? 'open' : ''}`.trim()}>
            <button
              className="sidebar-settings-option"
              onClick={() => {
                setShowSettingsMenu(false);
                navigate('/settings');
              }}
              aria-label="Preferences"
              title="Preferences"
              tabIndex={showSettingsMenu ? 0 : -1}
            >
              <SlidersHorizontal size={16} />
            </button>
            <button
              className="sidebar-settings-option"
              onClick={() => {
                setShowSettingsMenu(false);
                navigate('/shell');
              }}
              aria-label="New layout"
              title="New layout"
              tabIndex={showSettingsMenu ? 0 : -1}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              className="sidebar-settings-option logout"
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
              tabIndex={showSettingsMenu ? 0 : -1}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
      {isExpanded && (
        <div
          className="sidebar-resize-handle"
          onPointerDown={startResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
        />
      )}
    </nav>
  );
}
  const RoundedTriangle = ({ expanded }: { expanded: boolean }) => (
    <svg className={`rounded-triangle ${expanded ? 'expanded' : ''}`} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M4 3.4L8.2 6 4 8.6Z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  );
