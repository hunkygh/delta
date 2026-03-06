import ApertureIcon from '../components/icons/ApertureIcon';
import { ChevronDown, Plus } from 'lucide-react';

export default function FocalsStockyard() {
  return (
    <div className="stockyard-section">
      <div className="stockyard-label">Focals - Expanded, Dropdown Open</div>
      
      {/* Expanded state with dropdown open */}
      <div className="sidebar-nav-items">
        <div className="focals-dropdown-container">
          <button className="sidebar-nav-item focals-toggle group">
            <span className="relative flex items-center justify-center w-5 h-5">
              {/* Aperture icon (hidden on hover) */}
              <span className="focals-icon transition-opacity group-hover:opacity-0">
                <ApertureIcon />
              </span>
              {/* Chevron icon (visible on hover, rotated down when open) */}
              <span className="absolute transition-opacity opacity-0 group-hover:opacity-100 transition-transform rotate-180">
                <ChevronDown size={16} />
              </span>
            </span>
            <span className="sidebar-nav-text">Focals</span>
            <button className="add-focal-btn">
              <Plus size={14} />
            </button>
          </button>
          
          <div className="focals-dropdown show">
            <button className="focal-item selected">Health</button>
            <button className="focal-item">Global Payments</button>
          </div>
        </div>
      </div>

      <div className="stockyard-label">Focals - Expanded, Dropdown Closed</div>
      
      {/* Expanded state with dropdown closed */}
      <div className="sidebar-nav-items">
        <div className="focals-dropdown-container">
          <button className="sidebar-nav-item focals-toggle group">
            <span className="relative flex items-center justify-center w-5 h-5">
              {/* Aperture icon (visible by default) */}
              <span className="focals-icon transition-opacity">
                <ApertureIcon />
              </span>
              {/* Chevron icon (visible on hover, pointing right when closed) */}
              <span className="absolute transition-opacity opacity-0 group-hover:opacity-100 transition-transform">
                <ChevronDown size={16} />
              </span>
            </span>
            <span className="sidebar-nav-text">Focals</span>
            <button className="add-focal-btn">
              <Plus size={14} />
            </button>
          </button>
        </div>
      </div>

      <div className="stockyard-label">Focals - Input Field Shown</div>
      
      {/* Expanded state with input field */}
      <div className="sidebar-nav-items">
        <div className="focals-dropdown-container">
          <button className="sidebar-nav-item focals-toggle group">
            <span className="relative flex items-center justify-center w-5 h-5">
              <span className="focals-icon transition-opacity group-hover:opacity-0">
                <ApertureIcon />
              </span>
              <span className="absolute transition-opacity opacity-0 group-hover:opacity-100 transition-transform rotate-180">
                <ChevronDown size={16} />
              </span>
            </span>
            <span className="sidebar-nav-text">Focals</span>
            <button className="add-focal-btn">
              <Plus size={14} />
            </button>
          </button>
          
          <div className="focals-dropdown show">
            <button className="focal-item selected">Health</button>
            <button className="focal-item">Global Payments</button>
          </div>
          
          <div className="new-focal-input show">
            <input
              type="text"
              value=""
              placeholder="Focal name..."
              autoFocus
            />
          </div>
        </div>
      </div>

      <div className="stockyard-label">Focals - Collapsed</div>
      
      {/* Collapsed state */}
      <div className="sidebar-nav-items">
        <div className="focals-dropdown-container">
          <button className="sidebar-nav-item focals-toggle group">
            <span className="relative flex items-center justify-center w-5 h-5">
              <span className="focals-icon transition-opacity">
                <ApertureIcon />
              </span>
              <span className="absolute transition-opacity opacity-0 group-hover:opacity-100 transition-transform">
                <ChevronDown size={16} />
              </span>
            </span>
            {/* No text when collapsed */}
            <button className="add-focal-btn">
              <Plus size={14} />
            </button>
          </button>
        </div>
      </div>
    </div>
  );
}
