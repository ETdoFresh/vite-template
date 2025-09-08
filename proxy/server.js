const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:3001';
const TERMINAL_FRONTEND_URL = process.env.TERMINAL_FRONTEND_URL || 'http://localhost:4173';
const TERMINAL_BACKEND_URL = process.env.TERMINAL_BACKEND_URL || 'http://localhost:4001';

// Main backend API
app.use('/api', createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  onError: (err, req, res) => {
    console.error('Backend proxy error:', err);
    res.status(502).json({ error: 'Backend service unavailable' });
  }
}));

// Terminal backend (REST)
app.use('/terminal/api', createProxyMiddleware({
  target: TERMINAL_BACKEND_URL,
  changeOrigin: true,
  pathRewrite: { '^/terminal': '' },
  onError: (err, req, res) => {
    console.error('Terminal backend proxy error:', err);
    res.status(502).json({ error: 'Terminal backend unavailable' });
  }
}));

// Terminal backend (WebSocket) — also wire upgrade event below
const terminalWsProxy = createProxyMiddleware('/terminal/ws', {
  target: TERMINAL_BACKEND_URL,
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/terminal': '' },
  onError: (err, req, res) => {
    console.error('Terminal WS proxy error:', err);
    if (res && !res.headersSent) res.status(502).end('Terminal WS unavailable');
  }
});
app.use(terminalWsProxy);

// Terminal frontend under /terminal
app.use('/terminal', createProxyMiddleware({
  target: TERMINAL_FRONTEND_URL,
  changeOrigin: true,
  ws: true,
  onError: (err, req, res) => {
    console.error('Terminal frontend proxy error:', err);
    res.status(502).send('Terminal frontend unavailable');
  }
}));

app.use('/', createProxyMiddleware({
  target: FRONTEND_URL,
  changeOrigin: true,
  ws: true,
  onError: (err, req, res) => {
    console.error('Frontend proxy error:', err);
    res.status(502).send('Frontend service unavailable');
  }
}));

const server = app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
  console.log(`Proxying /api/* requests to ${BACKEND_URL}`);
  console.log(`Proxying /terminal -> ${TERMINAL_FRONTEND_URL}`);
  console.log(`Proxying /terminal/api and /terminal/ws -> ${TERMINAL_BACKEND_URL}`);
  console.log(`Proxying all other requests to ${FRONTEND_URL}`);
});

// Ensure WebSocket upgrades for terminal route
server.on('upgrade', (req, socket, head) => {
  try {
    const url = req.url || '';
    if (url.startsWith('/terminal/ws')) {
      return terminalWsProxy.upgrade(req, socket, head);
    }
  } catch (e) {
    try { socket.destroy(); } catch {}
  }
});
