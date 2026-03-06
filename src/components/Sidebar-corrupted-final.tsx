import { LayoutGrid, ChevronLeft, Target, CalendarDays, Grid3x3, Database, Archive, Library, FolderOpen, Circle, Layers, ChevronDown, Plus, CornerDownLeft, Settings, FileText } from 'lucide-react';
import ApertureIcon from './icons/ApertureIcon';
import FourCirclesIcon from './icons/FourCirclesIcon';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { focalBoardService } from '../services/focalBoardService';

interface NavItem {
  id: string;
  name: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  path: string;
}

interface SidebarProps {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

const navItems: NavItem[] = [
  { id: 'calendar', name: 'Calendar', icon: CalendarDays, path: '/' },
  { id: 'launchpad', name: 'Launchpad', icon: FourCirclesIcon, path: '/launchpad' },
];

const focalItems: NavItem[] = [
  { id: 'focals', name: 'Focals', icon: ApertureIcon, path: '/focals' },
];

const resourceItems: NavItem[] = [
  { id: 'docs', name: 'Docs', icon: FileText, path: '/docs' },
];

export default function Sidebar({ isExpanded, setIsExpanded }: SidebarProps): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const [focalsDropdownOpen, setFocalsDropdownOpen] = useState(false);
  const [focals, setFocals] = useState<any[]>([]);
  const [showNewFocalInput, setShowNewFocalInput] = useState(false);
  const [newFocalName, setNewFocalName] = useState('');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const selectedFocalFromNav = location.state?.selectedFocal;

  // Close floating dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      const dropdown = document.querySelector('.focals-floating-dropdown');
      const button = document.querySelector('.focals-toggle');
      
      if (dropdown && button && !dropdown.contains(target) && !button.contains(target)) {
        setFocalsDropdownOpen(false);
        setShowNewFocalInput(false);
        setNewFocalName('');
        setCreateError('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  console.log('🔍 Sidebar component rendering, user state:', !!user);

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
      
      // Debug: Check current session
      console.log('🔍 Debug - Current user:', user);
      console.log('🔍 Debug - User ID:', user.id);
      
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

  return (
    <nav className={`sidebar-nav ${isExpanded ? 'expanded' : ''}`}>
      <div className="sidebar-content">
        <div className="sidebar-nav-items">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className="sidebar-nav-item"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(item.path);
                }}
              >
                <Icon />
                <span className="sidebar-nav-text">{item.name}</span>
              </button>
            );
          })}
        </div>

        <div className="sidebar-divider-item" />

        {/* Always show focals list - no dropdown toggle */}
        <div className="sidebar-nav-items">
          <div className="focals-header">
            <span className="focals-title">Focals</span>
            <button
              className="btn btn-sm btn-primary"
              onClick={(e) => {
                e.stopPropagation();
                setShowNewFocalInput(!showNewFocalInput);
              }}
            >
              <Plus className="icon-button" />
            </button>
                    {newFocalName && !isCreating && (
                      <CornerDownLeft className="enter-icon" />
                    )}
                    {isCreating && (
                      <div className="creating-indicator">...</div>
                    )}
                    {createError && (
                      <div className="focal-create-error">
                        {createError}
                      </div>
                    )}
                  </div>
                )}
                
                {focals.length === 0 && !showNewFocalInput && (
                  <div className="no-focals">No focals yet</div>
                )}
                
                {focals.map((focal) => (
                  <button
                    key={focal.id}
                    className="focal-item"
                    onClick={() => handleFocalClick(focal)}
                  >
                    {focal.name}
                  </button>
                ))}
              </div>
            )}

            {!focalsDropdownOpen && isExpanded && showNewFocalInput && (
              <div className="focals-dropdown">
                <div className="new-focal-input">
                  <input
                    type="text"
                    value={newFocalName}
                    onChange={(e) => setNewFocalName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddFocal();
                      } else if (e.key === 'Escape') {
                        setShowNewFocalInput(false);
                        setNewFocalName('');
                      }
                    }}
                    autoFocus
                  />
                  {newFocalName && (
                    <CornerDownLeft className="enter-icon" />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="sidebar-divider-item" />

        <div className="sidebar-nav-items">
          {resourceItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className="sidebar-nav-item"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(item.path);
                }}
              >
                <Icon />
                <span className="sidebar-nav-text">{item.name}</span>
              </button>
            );
          })}
        </div>
        
        <div className="sidebar-footer">
          <button 
            className="sidebar-nav-item sidebar-expand-btn"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <ChevronLeft className={`sidebar-expand-icon ${isExpanded ? 'rotated' : ''}`} />
            <span className="sidebar-nav-text">Collapse</span>
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
}</div>

{focalsDropdownOpen && isExpanded && (
  <div className={`focals-dropdown ${focalsDropdownOpen ? 'show' : ''}`}>
    {showNewFocalInput && (
      <div className={`new-focal-input ${showNewFocalInput ? 'show' : ''}`}>
        <input
          type="text"
          value={newFocalName}
          onChange={(e) => setNewFocalName(e.target.value)}
          onKeyDown={(e) => {
            console.log('⌨️ Key pressed:', e.key);
            console.log('⌨️ isCreating:', isCreating);
            
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
          placeholder={isCreating ? 'Creating...' : 'Focal name...'}
          autoFocus
          className={isCreating ? 'creating' : ''}
        />
        {newFocalName && !isCreating && (
          <CornerDownLeft className="enter-icon" />
        )}
        {isCreating && (
          <div className="creating-indicator">...</div>
        )}
        {createError && (
          <div className="focal-create-error">
            {createError}
          </div>
        )}
      </div>
    )}
    
    {focals.length === 0 && !showNewFocalInput && (
      <div className="no-focals">No focals yet</div>
    )}
    
    {focals.map((focal) => (
      <button
        key={focal.id}
        className="focal-item"
        onClick={() => handleFocalClick(focal)}
      >
        {focal.name}
      </button>
    ))}
  </div>
)}

{!focalsDropdownOpen && isExpanded && showNewFocalInput && (
  <div className="focals-dropdown">
    <div className="new-focal-input">
      <input
        type="text"
        value={newFocalName}
        onChange={(e) => setNewFocalName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleAddFocal();
          } else if (e.key === 'Escape') {
            setShowNewFocalInput(false);
            setNewFocalName('');
          }
        }}
        autoFocus
      />
      {newFocalName && (
        <CornerDownLeft className="enter-icon" />
      )}
    </div>
  </div>
)}

<div className="sidebar-divider-item" />

<div className="sidebar-nav-items">
  {resourceItems.map((item) => {
    const Icon = item.icon;
    return (
      <button
        key={item.id}
        className="sidebar-nav-item"
        onClick={(e) => {
          e.stopPropagation();
          navigate(item.path);
        }}
      >
        <Icon />
        <span className="sidebar-nav-text">{item.name}</span>
      </button>
    );
  })}
</div>

<div className="sidebar-footer">
  <button 
    className="sidebar-nav-item sidebar-expand-btn"
    onClick={() => setIsExpanded(!isExpanded)}
);
