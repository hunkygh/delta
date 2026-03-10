import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import type { ChatContext } from '../types/chat';

export default function AppShell(): JSX.Element {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(196);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiContextTags, setAiContextTags] = useState<string[]>([]);
  const [chatContext, setChatContext] = useState<ChatContext>({});
  const { user, loading } = useAuth();

  // AI context effect - always runs, independent of auth state
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
      // Context tags are scoped to current open action only; no accumulation.
      setAiContextTags(nextTags);
      if (eventContext?.id) {
        setChatContext((prev) => ({
          ...prev,
          time_block_id: eventContext.id,
          time_block_occurrence:
            eventContext.start && eventContext.end
              ? {
                  scheduled_start_utc: eventContext.start,
                  scheduled_end_utc: eventContext.end
                }
              : prev.time_block_occurrence
        }));
      }
    };

    window.addEventListener('delta:ai-open-with-context', handleOpenWithContext);
    return () => window.removeEventListener('delta:ai-open-with-context', handleOpenWithContext);
  }, []);

  useEffect(() => {
    const handleSetContext = (event: Event): void => {
      const custom = event as CustomEvent<Partial<ChatContext>>;
      const detail = custom.detail || {};
      setChatContext((prev) => ({
        ...prev,
        ...detail
      }));
    };

    const handleClearContext = (event: Event): void => {
      const custom = event as CustomEvent<{ keys?: Array<keyof ChatContext> }>;
      const keys = custom.detail?.keys;
      setChatContext((prev) => {
        if (!keys || keys.length === 0) return {};
        const next: ChatContext = { ...prev };
        for (const key of keys) {
          delete next[key];
        }
        return next;
      });
    };

    window.addEventListener('delta:chat-context-set', handleSetContext);
    window.addEventListener('delta:chat-context-clear', handleClearContext);
    return () => {
      window.removeEventListener('delta:chat-context-set', handleSetContext);
      window.removeEventListener('delta:chat-context-clear', handleClearContext);
    };
  }, []);

  // Conditional rendering logic - moved outside of hooks
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-screen-mark" aria-label="Delta loading">
          <img className="loading-screen-logo" src="/in-app-logo.png" alt="" aria-hidden="true" />
          <div className="loading-screen-wordmark">
            <span className="loading-screen-text">THE CLARITY OS</span>
            <span className="loading-screen-cursor" aria-hidden="true">
              _
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return (
    <section
      className={`app-shell ${isAiOpen ? 'ai-open' : ''} ${isSidebarExpanded ? 'sidebar-expanded' : ''}`}
      style={{ '--sidebar-expanded-width': `${sidebarWidth}px` } as CSSProperties}
      aria-label="Application shell"
    >
      <Header
        user={user}
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
          setChatContext({});
        }}
        aiContextTags={aiContextTags}
        onRemoveAiContextTag={(tag) =>
          setAiContextTags((prev) => prev.filter((item) => item !== tag))
        }
        chatContext={chatContext}
        onClearChatContext={() => setChatContext({})}
      />
      <Sidebar
        user={user}
        isExpanded={isSidebarExpanded}
        setIsExpanded={setIsSidebarExpanded}
        sidebarWidth={sidebarWidth}
        setSidebarWidth={setSidebarWidth}
      />

      <main className="app-main-content">
        <Outlet />
      </main>
    </section>
  );
}
