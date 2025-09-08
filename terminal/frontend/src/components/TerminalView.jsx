import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

export default function TerminalView({ sessionId, initialData = '', onOutput }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      theme: { background: '#111111' },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fit.fit();

    if (initialData) {
      term.write(initialData);
    }

    termRef.current = term;
    fitRef.current = fit;

    const connect = () => {
      const url = (() => {
        const loc = window.location;
        const proto = loc.protocol === 'https:' ? 'wss' : 'ws';
        return `${proto}://${loc.host}/terminal/ws?sessionId=${encodeURIComponent(sessionId)}`;
      })();
      const ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        const { cols, rows } = term;
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data));
          if (msg.type === 'output') {
            term.write(msg.data);
            onOutput?.(msg.data);
          } else if (msg.type === 'status') {
            term.writeln(`\r\n[server] ${msg.status}`);
            onOutput?.(`\r\n[server] ${msg.status}`);
          }
        } catch {
          term.write(ev.data);
          if (typeof ev.data === 'string') onOutput?.(ev.data);
        }
      };
      ws.onclose = () => {
        setTimeout(connect, 1000);
      };
      ws.onerror = () => {};

      const disp = term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data }));
        }
      });
      return () => disp.dispose();
    };

    const cleanupDisp = connect();

    const onResize = () => {
      fit.fit();
      const { cols, rows } = term;
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    };

    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(containerRef.current);

    return () => {
      cleanupDisp?.();
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      wsRef.current?.close();
      term.dispose();
    };
  }, [sessionId]);

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}

