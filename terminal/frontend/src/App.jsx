import React, { useEffect, useMemo, useState } from 'react';
import TerminalView from './components/TerminalView.jsx';

const LAST_SESSION_KEY = 'webterm:lastSessionId';

async function api(path, options) {
  const res = await fetch(`/terminal/api${path}`, options);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(() => localStorage.getItem(LAST_SESSION_KEY) || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [buffers, setBuffers] = useState({}); // { [sessionId]: string }

  const MAX_BUFFER = 200000; // ~200 KB per session
  const appendBuffer = (id, chunk) => {
    if (!chunk) return;
    setBuffers(prev => {
      const prevText = prev[id] || '';
      let next = prevText + chunk;
      if (next.length > MAX_BUFFER) {
        next = next.slice(next.length - MAX_BUFFER);
      }
      if (next === prevText) return prev;
      return { ...prev, [id]: next };
    });
  };

  const activeSession = useMemo(() => sessions.find(s => s.id === activeId), [sessions, activeId]);

  useEffect(() => {
    (async () => {
      try {
        const list = await api('/sessions');
        setSessions(list);
        if (list.length && !list.find(s => s.id === activeId)) {
          setActiveId(list[0].id);
        }
      } catch (e) {
        setError(String(e.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (activeId) localStorage.setItem(LAST_SESSION_KEY, activeId);
  }, [activeId]);

  const createSession = async () => {
    try {
      const s = await api('/sessions', { method: 'POST' });
      setSessions(prev => [...prev, s]);
      setActiveId(s.id);
    } catch (e) {
      setError(String(e.message || e));
    }
  };

  const deleteSession = async (id) => {
    try {
      await api(`/sessions/${id}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== id));
      if (id === activeId) {
        const next = sessions.find(s => s.id !== id);
        setActiveId(next?.id || '');
      }
    } catch (e) {
      setError(String(e.message || e));
    }
  };

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopBar sessions={sessions} activeId={activeId} onSelect={setActiveId} onCreate={createSession} onDelete={deleteSession} />
      {error && <div style={{ color: 'red', padding: '4px 12px' }}>{error}</div>}
      <div style={{ flex: 1, minHeight: 0, background: '#111' }}>
        {activeSession ? (
          <TerminalView
            key={activeSession.id}
            sessionId={activeSession.id}
            initialData={buffers[activeSession.id] || ''}
            onOutput={(d) => appendBuffer(activeSession.id, d)}
          />
        ) : (
          <div style={{ padding: 16, color: '#ddd' }}>
            No sessions. Create one with the + button.
          </div>
        )}
      </div>
    </div>
  );
}

function TopBar({ sessions, activeId, onSelect, onCreate, onDelete }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1f1f1f', color: '#ddd', padding: '8px 12px', borderBottom: '1px solid #333' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {sessions.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', background: s.id === activeId ? '#333' : '#2a2a2a', border: '1px solid #3a3a3a' }}>
            <span onClick={() => onSelect(s.id)} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: 13 }}>
              {s.label || s.id.slice(0, 8)}
            </span>
            <button onClick={() => onDelete(s.id)} title="Close session" style={{ background: 'transparent', border: 'none', color: '#bbb', cursor: 'pointer' }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <button onClick={onCreate} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>+ New Session</button>
    </div>
  );
}

