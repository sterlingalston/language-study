const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9001;
const PUBLIC = path.join(__dirname, 'dist');

const MIME = {
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.html': 'text/html',
  '.svg': 'image/svg+xml',
};

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  // Prevent browser caching so new builds are always loaded
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Debug endpoint — plugin pings this to prove code is running
  if (req.url.startsWith('/debug')) {
    const msg = new URL(req.url, 'http://localhost').searchParams.get('msg') ?? '(no msg)';
    console.log('[DEBUG]', msg);
    res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return;
  }

  console.log(req.method, req.url);

  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(PUBLIC, urlPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.log('  404:', filePath);
      res.writeHead(404); res.end('Not found'); return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Plugin server on http://localhost:${PORT}`));
