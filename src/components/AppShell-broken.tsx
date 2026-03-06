import { useEffect, useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { authService } from '../services/authService';

export default function AppShell(): JSX.Element {
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiContextTags, setAiContextTags] = useState<string[]>([]);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
        setLoading(false);
      } catch (error) {
        console.error('Auth check failed:', error);
        setUser(null);
        setLoading(false);
      }
    };

    checkAuth();

    // Listen to auth changes
    const { data: { subscription } } = authService.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Show loading or redirect to login if not authenticated
  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  useEffect(() => {
    const handleOpenWithContext = (event: Event): void => {
      const custom = event as CustomEvent<{
        tag?: string;
        source?: 'event_drawer' | 'header';
        eventContext?: {
          id?: string;
          title?: string;
          start?: string;
          end?: string;
          recurrence?: string;
        };
      }>;
      const tag = custom.detail?.tag?.trim();
      const eventContext = custom.detail?.eventContext;
      setIsAiOpen(true);
      const nextTags: string[] = [];
      if (eventContext) {
        const summary = `[Event: ${eventContext.title ?? 'Untitled'}${
          eventContext.recurrence ? ` | ${eventContext.recurrence}` : ''
        }]`;
        nextTags.push(summary);
      }
      if (tag) {
        nextTags.push(tag);
      }
      // Context tags are scoped to the current open action only; no accumulation.
      setAiContextTags(nextTags);
    };

    window.addEventListener('delta:ai-open-with-context', handleOpenWithContext);
    return () => window.removeEventListener('delta:ai-open-with-context', handleOpenWithContext);
  }, []);

  return (
    <section className={`app-shell ${isAiOpen ? 'ai-open' : ''} ${isSidebarExpanded ? 'sidebar-expanded' : ''}`.trim()} aria-label="Application shell">
      <Header
        isAiOpen={isAiOpen}
        onToggleAi={() =>
          setIsAiOpen((value) => {
            const nextOpen = !value;
            // Opening from the header should start clean without inherited event context.
            if (nextOpen) {
              setAiContextTags([]);
            }
            return nextOpen;
          })
        }
        onCloseAi={() => {
          setIsAiOpen(false);
          setAiContextTags([]);
        }}
        aiContextTags={aiContextTags}
        onRemoveAiContextTag={(tag) =>
          setAiContextTags((prev) => prev.filter((item) => item !== tag))
        }
      />
      <Sidebar isExpanded={isSidebarExpanded} setIsExpanded={setIsSidebarExpanded} />

      <main className="app-main-content">
        <Outlet />
      </main>
    </section>
  );
}
