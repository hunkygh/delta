import { Calendar, ChevronLeft, Settings, FileText, Plus, CornerDownLeft, User, LogOut, ChevronDown } from 'lucide-react';
import ApertureIcon from './icons/ApertureIcon';
import FourCirclesIcon from './icons/FourCirclesIcon';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { focalBoardService } from '../services/focalBoardService';

interface SidebarProps {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

export default function Sidebar({ isExpanded, setIsExpanded }: SidebarProps): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const [focals, setFocals] = useState<any[]>([]);
  const [showNewFocalInput, setShowNewFocalInput] = useState(false);
  const [newFocalName, setNewFocalName] = useState('');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [focalsDropdownOpen, setFocalsDropdownOpen] = useState(false);
  const selectedFocalFromNav = location.state?.selectedFocal;

  // Close dropdowns when sidebar collapses
  useEffect(() => {
    if (!isExpanded) {
      setFocalsDropdownOpen(false);
      setShowNewFocalInput(false);
      setNewFocalName('');
      setCreateError('');
    }
  }, [isExpanded]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      const settingsDropdown = document.querySelector('.settings-dropdown');
      const settingsButton = document.querySelector('.settings-button');
      
      if (settingsDropdown && settingsButton && !settingsDropdown.contains(target) && !settingsButton.contains(target)) {
        setShowSettingsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    console.log('🔍 Sidebar: useEffect running...');
    // Get current user and load focals
    const initializeSidebar = async () => {
      console.log('🔍 Sidebar: Initializing sidebar...');
      try {
        console.log('🔍 Sidebar: Getting current user...');
        const currentUser = await authService.getCurrentUser();
        console.log('🔍 Sidebar: Current user result:', currentUser);
        
        if (currentUser) {
          console.log('🔍 Sidebar: Setting user state:', currentUser.id);
          setUser(currentUser);
          
          // Load user's focals from database
          console.log('🔍 Sidebar: Loading focals for user:', currentUser.id);
          const userFocals = await focalBoardService.getFocals(currentUser.id);
          console.log('🔍 Sidebar: User focals loaded:', userFocals);
          setFocals(userFocals);
        } else {
          console.log('🔍 Sidebar: No current user found');
        }
      } catch (error) {
        console.error('🔍 Sidebar: Failed to initialize sidebar:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeSidebar();

    // Listen to auth changes
    const { data: { subscription } } = authService.onAuthStateChange(async (_event: string, session: { user: any } | null) => {
      console.log('🔍 Sidebar: Auth state change:', { event: _event, hasUser: !!session?.user, user: session?.user?.id });
      
      if (session?.user) {
        console.log('🔍 Sidebar: Setting user from auth change:', session.user.id);
        setUser(session.user);
        try {
          const userFocals = await focalBoardService.getFocals(session.user.id);
          setFocals(userFocals);
        } catch (error) {
          console.error('🔍 Sidebar: Failed to load focals on auth change:', error);
        }
      } else {
        console.log('🔍 Sidebar: User logged out, clearing state');
        setUser(null);
        setFocals([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAddFocal = async () => {
    console.log('🔥 handleAddFocal called!');
    console.log('🔥 newFocalName:', newFocalName);
    console.log('🔥 user:', user);
    console.log('🔥 isCreating:', isCreating);
    
    if (newFocalName.trim() && user) {
      setIsCreating(true);
      setCreateError('');
      
      try {
        console.log('🚀 About to call createFocal...');
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Database request timed out after 10 seconds')), 10000);
        });
        
        const newFocal = await Promise.race([
          focalBoardService.createFocal(user.id, newFocalName.trim()),
          timeoutPromise
        ]);
        
        console.log('✅ Focal created successfully:', newFocal);
        
        setFocals([...focals, newFocal]);
        setNewFocalName('');
        setShowNewFocalInput(false);
        console.log('✅ UI updated successfully');
      } catch (error: any) {
        console.error('❌ Failed to create focal:', error);
        setCreateError(error?.message || 'Failed to create focal');
        
        // Clear error after 3 seconds
        setTimeout(() => setCreateError(''), 3000);
      } finally {
        setIsCreating(false);
        console.log('🏁 handleAddFocal finished');
      }
    } else {
      console.log('❌ Validation failed - newFocalName:', newFocalName, 'user:', !!user);
      
      // Show helpful error message
      if (!newFocalName.trim()) {
        setCreateError('Please enter a focal name');
      } else if (!user) {
        setCreateError('Please sign in to create focals');
      }
      
      // Clear error after 3 seconds
      setTimeout(() => setCreateError(''), 3000);
    }
  };

  const handleFocalClick = (focal: any) => {
    navigate('/focals', { state: { selectedFocal: focal.name } });
  };

  const handleLogout = async () => {
    try {
      await authService.signOut();
      setUser(null);
      setShowSettingsMenu(false);
      window.location.href = '/login';
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  const SidebarFocals = () => {
    return (
      <div className="mt-2">
        {/* Focals header row */}
        <button
          className="group flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          onClick={() => setFocalsDropdownOpen(!focalsDropdownOpen)}
        >
          <span className="flex items-center gap-2">
            {/* Icon that becomes chevron on hover */}
            <span className="relative flex h-5 w-5 items-center justify-center">
              {/* Aperture icon (visible by default) */}
              <span className="transition-opacity group-hover:opacity-0">
                <ApertureIcon />
              </span>
              {/* Chevron icon (visible on hover) */}
              <span className="absolute transition-opacity opacity-0 group-hover:opacity-100">
                <ChevronDown size={16} />
              </span>
            </span>
            {isExpanded && <span>Focals</span>}
          </span>
          
          {/* Right-side controls only when expanded sidebar */}
          {isExpanded && (
            <span className="flex items-center gap-1">
              {/* + button for new focal input */}
              <button
                type="button"
                className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-xs text-slate-500 hover:bg-slate-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNewFocalInput(true);
                  setFocalsDropdownOpen(true);
                }}
              >
                <Plus size={12} />
              </button>
              {/* Chevron for open/close */}
              <span
                className={`transition-transform ${focalsDropdownOpen ? "rotate-180" : "rotate-0"}`}
              >
                <ChevronDown size={14} />
              </span>
            </span>
          )}
        </button>

        {/* Dropdown content */}
        {focalsDropdownOpen && isExpanded && (
          <div className="mt-1 space-y-1 pl-8 pr-2">
            {/* Existing focals list */}
            {loading ? (
              <div className="text-xs text-slate-400">Loading...</div>
            ) : focals.length === 0 ? (
              <div className="text-xs text-slate-400">No focals yet</div>
            ) : (
              focals.map((focal) => (
                <button
                  key={focal.id}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 ${
                    focal.name === selectedFocalFromNav ? 'bg-slate-100 text-slate-900' : ''
                  }`}
                  onClick={() => handleFocalClick(focal)}
                >
                  <span>{focal.name}</span>
                </button>
              ))
            )}
            
            {/* New focal input only when + used */}
            {showNewFocalInput && (
              <div className="mt-1">
                <input
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-0"
                  placeholder="Create new focal..."
                  value={newFocalName}
                  onChange={(e) => setNewFocalName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isCreating) {
                      console.log('🎯 Enter detected, calling handleAddFocal');
                      e.preventDefault();
                      handleAddFocal();
                    } else if (e.key === 'Escape') {
                      console.log('🚪 Escape detected');
                      setShowNewFocalInput(false);
                      setNewFocalName('');
                      setCreateError('');
                    }
                  }}
                  disabled={isCreating}
                  autoFocus
                />
                {createError && (
                  <div className="mt-1 text-xs text-red-600">{createError}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className={`sidebar-nav ${isExpanded ? 'expanded' : ''}`}>
      <div className="sidebar-content">
        <div className="sidebar-nav-items">
          <button className="sidebar-nav-item" onClick={() => navigate('/')}>
            <Calendar size={14} />
            <span className="sidebar-nav-text">Calendar</span>
          </button>
          
          <button className="sidebar-nav-item" onClick={() => navigate('/launchpad')}>
            <FourCirclesIcon />
            <span className="sidebar-nav-text">Launchpad</span>
          </button>
        </div>
        
        <div className="sidebar-divider-item" />
        
        <div className="sidebar-nav-items">
          <SidebarFocals />
        </div>
        
        <div className="sidebar-divider-item" />
        
        <div className="sidebar-nav-items">
          <button className="sidebar-nav-item" onClick={() => navigate('/docs')}>
            <FileText size={14} />
            <span className="sidebar-nav-text">Notes</span>
          </button>
        </div>
        
        {/* Footer with collapse and settings */}
        <div className="sidebar-footer">
          <button 
            className="sidebar-nav-item sidebar-expand-btn"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <ChevronLeft className={`sidebar-expand-icon ${isExpanded ? 'rotated' : ''}`} />
            <span className="sidebar-nav-text">{isExpanded ? 'Collapse' : 'Expand'}</span>
          </button>
          
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
    </nav>
  );
}
