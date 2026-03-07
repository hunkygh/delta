import { Calendar, Settings, FileText, Plus, CornerDownLeft, User, LogOut } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { authService } from '../services/authService';
import { focalBoardService } from '../services/focalBoardService';
import ApertureIcon from './icons/ApertureIcon';

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
  const [focalLists, setFocalLists] = useState<Record<string, any[]>>({});
  const [loadingLists, setLoadingLists] = useState(false);
  const [listsLoadError, setListsLoadError] = useState('');
  const [expandedFocalIds, setExpandedFocalIds] = useState<Record<string, boolean>>({});
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
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

  // Reset inline create UI when dropdown closes.
  useEffect(() => {
    if (!focalsDropdownOpen) {
      setShowNewFocalInput(false);
      setNewFocalName('');
      setCreateError('');
    }
  }, [focalsDropdownOpen]);

  useEffect(() => {
    if (!currentFocalId) return;
    setExpandedFocalIds((prev) => (prev[currentFocalId] ? prev : { ...prev, [currentFocalId]: true }));
  }, [currentFocalId]);

  useEffect(() => {
    if (!focalsDropdownOpen || focals.length === 0) return;
    setExpandedFocalIds((prev) => {
      const next = { ...prev };
      focals.forEach((focal) => {
        if (!next[focal.id]) {
          next[focal.id] = true;
        }
      });
      return next;
    });
  }, [focalsDropdownOpen, focals]);

  useEffect(() => {
    if (isExpanded) {
      setIsExpanded(false);
    }
  }, [isExpanded, setIsExpanded]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      const settingsDropdown = document.querySelector('.settings-dropdown');
      const settingsButton = document.querySelector('.settings-button');
      const focalsContainer = document.querySelector('.focals-dropdown-container');
      
      if (settingsDropdown && settingsButton && !settingsDropdown.contains(target) && !settingsButton.contains(target)) {
        setShowSettingsMenu(false);
      }
      if (focalsContainer && !focalsContainer.contains(target)) {
        setFocalsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
    if (!focalsDropdownOpen || !user) {
      return;
    }
    void loadListsForUser();
  }, [focalsDropdownOpen, user]);

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
    <nav className="sidebar-nav sidebar-locked">
      <div className="sidebar-content">
        <div className="sidebar-nav-items">
          <button className={`sidebar-nav-item ${isActivePath('/') ? 'active' : ''}`.trim()} onClick={() => navigate('/')}>
            <Calendar size={14} />
            <span className="sidebar-nav-text">Calendar</span>
          </button>
          
        </div>
        
        <div className="sidebar-divider-item" />
        
        <div className="sidebar-nav-items">
          <div className="focals-dropdown-container">
            <div className="focals-parent-row">
              <button
                className={`sidebar-nav-item focals-toggle ${focalsDropdownOpen ? 'active' : ''}`.trim()}
                onClick={(e) => {
                  e.stopPropagation();
                  setFocalsDropdownOpen(!focalsDropdownOpen);
                }}
              >
                <span className="focals-primary-icon" aria-hidden="true">
                  <ApertureIcon size={20} color="currentColor" />
                </span>
                <span className="sidebar-nav-text">Spaces</span>
                <span className={`focals-parent-toggle ${focalsDropdownOpen ? 'visible' : ''}`.trim()} aria-hidden="true">
                  <RoundedTriangle expanded={Boolean(focalsDropdownOpen)} />
                </span>
              </button>
              <button
                className="add-focal-btn focals-add-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNewFocalInput(!showNewFocalInput);
                  if (showNewFocalInput) {
                    setNewFocalName('');
                    setCreateError('');
                  }
                }}
              >
                <Plus size={14} />
              </button>
            </div>
            
            {/* Focals popout */}
            {focalsDropdownOpen && (
              <div className="focals-dropdown show focals-popout">
                {/* Only show focals list when there are focals */}
                {focals.length > 0 && (
                  focals.map((focal) => (
                    <div key={focal.id} className="focal-nav-group">
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
              </div>
            )}
            
            {/* New focal input - shows when + is clicked, regardless of dropdown state */}
            {showNewFocalInput && (
              <div className="new-focal-input show">
                <input
                  type="text"
                  value={newFocalName}
                  onChange={(e) => setNewFocalName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isCreating) {
                      e.preventDefault();
                      handleAddFocal();
                    } else if (e.key === 'Escape') {
                      setShowNewFocalInput(false);
                      setNewFocalName('');
                      setCreateError('');
                    }
                  }}
                  disabled={isCreating}
                  placeholder={isCreating ? 'Creating...' : 'Space name...'}
                  autoFocus
                  className={isCreating ? 'creating' : ''}
                />
                {newFocalName && !isCreating && (
                  <CornerDownLeft className="enter-icon" />
                )}
                {createError && (
                  <div className="focal-create-error">
                    {createError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="sidebar-divider-item" />
        
        <div className="sidebar-nav-items">
          <button className={`sidebar-nav-item ${isActivePath('/docs') ? 'active' : ''}`.trim()} onClick={() => navigate('/docs')}>
            <FileText size={14} />
            <span className="sidebar-nav-text">Docs</span>
          </button>
        </div>
        
        {/* Footer with settings */}
        <div className="sidebar-footer">
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
          
          {showSettingsMenu && (
            <div className="settings-dropdown">
              <div className="settings-header">
                <div className="user-info">
                  <User size={14} />
                  <span>{user?.email}</span>
                </div>
              </div>
              <div className="settings-divider"></div>
              <button
                className="settings-option"
                onClick={() => {
                  setShowSettingsMenu(false);
                  navigate('/settings');
                }}
              >
                <Settings size={14} />
                <span>Preferences</span>
              </button>
              <button
                className="settings-option logout"
                onClick={handleLogout}
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
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
