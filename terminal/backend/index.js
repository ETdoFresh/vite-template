import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import pty from 'node-pty';
import { randomUUID } from 'crypto';
import { existsSync, statSync } from 'fs';

const PORT = process.env.TERMINAL_PORT ? Number(process.env.TERMINAL_PORT) : 4001;
const app = express();
app.use(express.json());

// Session store in-memory
const sessions = new Map(); // id -> { id, createdAt, pty, clients: Set<ws> }

function getStartCwd() {
  try {
    if (existsSync('/app') && statSync('/app').isDirectory()) {
      return '/app';
    }
  } catch {}
  return process.cwd();
}

function createSession() {
  const id = randomUUID();
  const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash');

  const term = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: getStartCwd(),
    env: { ...process.env, TERM: 'xterm-256color' },
  });

  const session = { id, createdAt: new Date().toISOString(), pty: term, clients: new Set() };
  sessions.set(id, session);

  term.onExit(() => {
    for (const ws of session.clients) {
      try { ws.send(JSON.stringify({ type: 'status', status: 'session exited' })); } catch {}
      try { ws.close(); } catch {}
    }
    sessions.delete(id);
  });

  return session;
}

function destroySession(id) {
  const s = sessions.get(id);
  if (!s) return;
  try { s.pty?.kill?.(); } catch {}
  sessions.delete(id);
}

// REST API
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/sessions', (_req, res) => {
  res.json(Array.from(sessions.values()).map(({ id, createdAt }) => ({ id, createdAt })));
});

app.post('/api/sessions', (_req, res) => {
  const s = createSession();
  res.json({ id: s.id, createdAt: s.createdAt });
});

app.delete('/api/sessions/:id', (req, res) => {
  destroySession(req.params.id);
  res.json({ ok: true });
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) {
      ws.send(JSON.stringify({ type: 'status', status: 'missing sessionId' }));
      ws.close();
      return;
    }
    const session = sessions.get(sessionId);
    if (!session) {
      ws.send(JSON.stringify({ type: 'status', status: 'unknown session' }));
      ws.close();
      return;
    }

    session.clients.add(ws);

    const onData = (data) => {
      try { ws.send(JSON.stringify({ type: 'output', data })); } catch {}
    };
    session.pty.onData(onData);

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.type === 'input') {
        session.pty.write(msg.data);
      } else if (msg.type === 'resize') {
        const cols = Number(msg.cols) || 80;
        const rows = Number(msg.rows) || 24;
        try { session.pty.resize(cols, rows); } catch {}
      }
    });

    ws.on('close', () => {
      session.clients.delete(ws);
    });
  } catch (e) {
    try { ws.send(JSON.stringify({ type: 'status', status: `error: ${String(e.message || e)}` })); } catch {}
    try { ws.close(); } catch {}
  }
});

server.listen(PORT, () => {
  console.log(`[terminal-backend] listening on http://localhost:${PORT}`);
});
