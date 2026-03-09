import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import docsService, { type DocCategory, type DocNote } from '../services/docsService';
import './DocViewer.css';

type DocsScope = 'inbox' | 'archived' | string;
type NoteSourceFilter = 'all' | 'quick_capture' | 'memo' | 'ai';

const relativeTime = (value: string): string => {
  const ms = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function DocViewer(): JSX.Element {
  const { user } = useAuth();
  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [notes, setNotes] = useState<DocNote[]>([]);
  const [scope, setScope] = useState<DocsScope>('inbox');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<NoteSourceFilter>('all');
  const [newNoteBody, setNewNoteBody] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const archived = scope === 'archived';
  const categoryId = scope !== 'inbox' && scope !== 'archived' ? scope : null;

  const load = async (): Promise<void> => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const [cats, rows] = await Promise.all([
        docsService.getCategories(user.id),
        docsService.getNotes({
          userId: user.id,
          archived,
          categoryId,
          search
        })
      ]);
      setCategories(cats);
      setNotes(rows);
    } catch (err: any) {
      setError(err?.message || 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, archived, categoryId, search]);

  const scopeLabel = useMemo(() => {
    if (scope === 'inbox') return 'Inbox';
    if (scope === 'archived') return 'Archived';
    return categories.find((cat) => cat.id === scope)?.name || 'Category';
  }, [categories, scope]);

  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      if (sourceFilter === 'all') return true;
      if (sourceFilter === 'quick_capture') {
        return note.source === 'quick_text' || note.source === 'quick_voice';
      }
      return note.source === sourceFilter;
    });
  }, [notes, sourceFilter]);

  const sourceLabel = (source: DocNote['source']): string => {
    if (source === 'quick_text') return 'Quick Text';
    if (source === 'quick_voice') return 'Quick Voice';
    if (source === 'memo') return 'Memo';
    return 'AI';
  };

  const handleCreateNote = async (): Promise<void> => {
    if (!user?.id || !newNoteBody.trim()) return;
    setSubmitting(true);
    try {
      const created = await docsService.createNote({
        userId: user.id,
        body: newNoteBody,
        source: 'quick_text',
        categoryIds: categoryId ? [categoryId] : []
      });
      setNewNoteBody('');
      if (!archived) {
        const withCats = {
          ...created,
          categories: categoryId ? categories.filter((cat) => cat.id === categoryId) : []
        };
        setNotes((prev) => [withCats, ...prev]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create note');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (note: DocNote, nextArchived: boolean): Promise<void> => {
    try {
      await docsService.archiveNote(note.id, nextArchived);
      setNotes((prev) => prev.filter((entry) => entry.id !== note.id));
    } catch (err: any) {
      setError(err?.message || 'Failed to update note');
    }
  };

  const handleCreateCategory = async (): Promise<void> => {
    if (!user?.id || !newCategoryName.trim()) return;
    try {
      const created = await docsService.createCategory(user.id, newCategoryName.trim(), null);
      setCategories((prev) => [...prev, created]);
      setNewCategoryName('');
    } catch (err: any) {
      setError(err?.message || 'Failed to create category');
    }
  };

  return (
    <section className="app-page docs-page">
      <h1 className="page-title">Notes</h1>
      <div className="app-page-scroll docs-scroll">
        <div className="docs-layout">
          <aside className="docs-nav">
            <button
              type="button"
              className={`docs-nav-item ${scope === 'inbox' ? 'active' : ''}`.trim()}
              onClick={() => setScope('inbox')}
            >
              Inbox
            </button>
            <button
              type="button"
              className={`docs-nav-item ${scope === 'archived' ? 'active' : ''}`.trim()}
              onClick={() => setScope('archived')}
            >
              Archived
            </button>
            <div className="docs-nav-divider" />
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`docs-nav-item ${scope === category.id ? 'active' : ''}`.trim()}
                onClick={() => setScope(category.id)}
              >
                {category.name}
              </button>
            ))}
            <div className="docs-category-create">
              <input
                type="text"
                placeholder="+ Category"
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleCreateCategory();
                  }
                }}
              />
            </div>
          </aside>

          <main className="docs-main">
            <header className="docs-main-head">
              <strong>{scopeLabel}</strong>
              <input
                type="text"
                placeholder="Search notes"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </header>
            <div className="docs-source-filters">
              {[
                { id: 'all', label: 'All' },
                { id: 'quick_capture', label: 'Quick Capture' },
                { id: 'memo', label: 'Memo' },
                { id: 'ai', label: 'AI' }
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`docs-source-filter ${sourceFilter === option.id ? 'active' : ''}`.trim()}
                  onClick={() => setSourceFilter(option.id as NoteSourceFilter)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="docs-composer">
              <textarea
                rows={2}
                placeholder="Quick note…"
                value={newNoteBody}
                onChange={(event) => setNewNoteBody(event.target.value)}
              />
              <button type="button" onClick={() => void handleCreateNote()} disabled={submitting || !newNoteBody.trim()}>
                Save note
              </button>
            </div>

            {error && <p className="docs-error">{error}</p>}
            {loading && <p className="docs-empty">Loading…</p>}
            {!loading && notes.length === 0 && <p className="docs-empty">No notes yet.</p>}
            {!loading && notes.length > 0 && filteredNotes.length === 0 && (
              <p className="docs-empty">No notes in this filter.</p>
            )}

            {!loading && filteredNotes.length > 0 && (
              <div className="docs-note-list">
                {filteredNotes.map((note) => (
                  <article key={note.id} className="docs-note-row">
                    <div className="docs-note-title-row">
                      <strong>{note.title}</strong>
                      <span>{relativeTime(note.created_at)}</span>
                    </div>
                    <p>{note.body}</p>
                    <div className="docs-note-meta">
                      <span>{sourceLabel(note.source)}</span>
                      <span>{(note.categories || []).map((cat) => cat.name).join(' • ') || 'Uncategorized'}</span>
                      <button
                        type="button"
                        onClick={() => void handleArchive(note, !note.is_archived)}
                      >
                        {note.is_archived ? 'Unarchive' : 'Archive'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </section>
  );
}
