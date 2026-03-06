import { useState, useEffect } from 'react';
import { Filter, Pin } from 'lucide-react';

interface Focal {
  id: string;
  name: string;
}

const sampleFocals: Focal[] = [
  { id: '1', name: 'Work' },
  { id: '2', name: 'Personal' },
  { id: '3', name: 'Health' },
  { id: '4', name: 'Finance' },
  { id: '5', name: 'Learning' }
];

export default function FocalFilter() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [selectedFocals, setSelectedFocals] = useState<string[]>([]);

  // Load pinned state from localStorage on mount
  useEffect(() => {
    const storedPinned = localStorage.getItem('delta_focalFilterPinned');
    if (storedPinned) {
      try {
        setIsPinned(Boolean(JSON.parse(storedPinned)));
      } catch {
        setIsPinned(false);
        localStorage.removeItem('delta_focalFilterPinned');
      }
    }
  }, []);

  // Save pinned state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('delta_focalFilterPinned', JSON.stringify(isPinned));
  }, [isPinned]);

  // If pinned, panel should always be open
  useEffect(() => {
    if (isPinned) {
      setIsPanelOpen(true);
    }
  }, [isPinned]);

  const toggleFocal = (focalId: string) => {
    setSelectedFocals(prev => 
      prev.includes(focalId) 
        ? prev.filter(id => id !== focalId)
        : [...prev, focalId]
    );
  };

  const togglePanel = () => {
    if (!isPinned) {
      setIsPanelOpen(!isPanelOpen);
    }
  };

  const togglePin = () => {
    setIsPinned(!isPinned);
  };

  return (
    <div className="focal-filter-container">
      <button 
        className={`focal-filter-toggle ${isPanelOpen ? 'active' : ''}`}
        onClick={togglePanel}
        aria-label="Focal filter"
      >
        <Filter size={14} />
        <span>Focals</span>
        {selectedFocals.length > 0 && (
          <span className="focal-count">({selectedFocals.length})</span>
        )}
      </button>

      {(isPanelOpen || isPinned) && (
        <div className={`focal-filter-panel ${isPanelOpen ? 'open' : ''}`}>
          <div className="focal-filter-panel-header">
            <button 
              className={`pin-button ${isPinned ? 'pinned' : ''}`}
              onClick={togglePin}
              aria-label={isPinned ? 'Unpin filter' : 'Pin filter'}
            >
              <Pin size={12} />
            </button>
          </div>
          
          <div className="focal-options">
            {sampleFocals.map(focal => (
              <button
                key={focal.id}
                className={`focal-option ${selectedFocals.includes(focal.id) ? 'selected' : ''}`}
                onClick={() => toggleFocal(focal.id)}
              >
                {focal.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
