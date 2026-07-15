// 로컬 개발용 서버 — Vercel 서버리스 함수(api/*.js)를 그대로 실행한다.
const http = require('http');
const fs = require('fs');
const path = require('path');

// .env 로드
try {
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

http.createServer(async (req, res) => {
  res.status = c => { res.statusCode = c; return res; };
  res.json = o => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); };

  const url = req.url.split('?')[0];

  if (url.startsWith('/api/')) {
    const name = url.slice(5).replace(/[^a-z0-9_-]/gi, '');
    const file = path.join(__dirname, 'api', name + '.js');
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'no such api' });
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try { req.body = body ? JSON.parse(body) : {}; } catch { req.body = {}; }
      try {
        delete require.cache[require.resolve(file)];
        await require(file)(req, res);
      } catch (e) {
        console.error(e);
        if (!res.writableEnded) res.status(500).json({ error: String(e) });
      }
    });
    return;
  }

  const file = path.join(__dirname, url === '/' ? 'index.html' : url.slice(1));
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  } else {
    res.status(404).end('not found');
  }
}).listen(3000, () => console.log('dev server: http://localhost:3000'));
