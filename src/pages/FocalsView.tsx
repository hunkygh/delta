import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import FocalBoard from '../components/FocalBoard/FocalBoard';
import ErrorBoundary from '../components/ErrorBoundary';
import { useAuth } from '../context/AuthContext';

export default function FocalsView(): JSX.Element {
  const location = useLocation();
  const { focalId } = useParams<{ focalId?: string }>();
  const [selectedFocalFromNav, setSelectedFocalFromNav] = useState<string | null>(null);
  const [selectedFocalIdFromNav, setSelectedFocalIdFromNav] = useState<string | null>(null);
  const { user, loading } = useAuth();

  // Update selectedFocalFromNav when location state changes
  useEffect(() => {
    const newSelectedFocal = location.state?.selectedFocal || null;
    setSelectedFocalFromNav(newSelectedFocal);
    setSelectedFocalIdFromNav(focalId || location.state?.selectedFocalId || null);
  }, [location.state, focalId]);

  if (loading) {
    return (
      <div className="app-page">
        <div className="app-page-content">
          <div className="loading-message">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-page">
        <div className="app-page-content">
          <div className="auth-message">
            <h2>Authentication Required</h2>
            <p>Please sign in to access your Spaces.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <div className="app-page-content">
        <ErrorBoundary>
          <FocalBoard 
            userId={user.id} 
            selectedFocalFromNav={selectedFocalFromNav}
            selectedFocalIdFromNav={selectedFocalIdFromNav}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}
