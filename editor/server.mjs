// liuluit 内容编辑器 —— 本地后端服务（零依赖，仅 Node 内置模块）
// 启动: npm run editor  →  http://localhost:5179
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..'); // 项目根
const DOCS = path.join(ROOT, 'src/content/docs');
const SIDEBAR = path.join(ROOT, 'src/config/sidebar.json');
const INTERNAL = path.join(ROOT, 'src/config/editor-internal.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.EDITOR_PORT || 5179;

/* ---------- frontmatter 工具（保留正文） ---------- */
function parseFrontmatter(raw) {
  const m = raw.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, content: raw };
  const lines = m[1].split(/\r?\n/);
  const data = {};
  for (const line of lines) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const mm = line.match(/^([A-Za-z0-9_-]+)[ \t]*:[ \t]*(.*)$/);
    if (!mm) continue;
    let key = mm[1];
    let val = mm[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    else if (/^-?\d+$/.test(val)) val = parseInt(val, 10);
    if (val !== '') data[key] = val;
  }
  return { data, content: m[2] };
}

function stringifyFrontmatter(data, body) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(data)) {
    let s;
    if (typeof v === 'boolean') s = v ? 'true' : 'false';
    else if (typeof v === 'number') s = String(v);
    else {
      s = String(v);
      if (s === '' || /[:#]/.test(s) || /^\s|\s$/.test(s)) s = `"${s.replace(/"/g, '\\"')}"`;
    }
    lines.push(`${k}: ${s}`);
  }
  lines.push('---', '');
  return lines.join('\n') + (body || '');
}

function slugify(title) {
  const s = String(title)
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  return s || 'post-' + Date.now().toString(36);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/* ---------- 文件读取 ---------- */
function slugToFile(slug) {
  const p = path.join(DOCS, slug + '.md');
  if (fs.existsSync(p)) return p;
  const px = path.join(DOCS, slug + '.mdx');
  return fs.existsSync(px) ? px : p;
}

function scanDir(dir) {
  const full = path.join(DOCS, dir);
  if (!fs.existsSync(full)) return [];
  const out = [];
  for (const f of fs.readdirSync(full)) {
    if (!/\.mdx?$/.test(f)) continue;
    if (/^index\.mdx?$/.test(f)) continue;
    const file = path.join(dir, f);
    const { data } = parseFrontmatter(fs.readFileSync(path.join(DOCS, file), 'utf8'));
    const id = f.replace(/\.mdx?$/, '');
    out.push({
      id,
      file,
      title: data.title || id,
      description: data.description || '',
      lastUpdated: data.lastUpdated || '',
      order: typeof data.order === 'number' ? data.order : 999,
      slug: data.slug || null,
      draft: !!data.draft,
      prev: data.prev || null,
      next: data.next || null,
      hasEn: fs.existsSync(path.join(DOCS, 'en', dir, f)),
    });
  }
  out.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  return out;
}

function readSlugPage(slug) {
  const file = slugToFile(slug);
  if (!fs.existsSync(file)) return null;
  const { data } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
  const enFile = path.join(DOCS, 'en', slug + '.md');
  return {
    id: slug,
    file: path.relative(DOCS, file),
    title: data.title || slug,
    description: data.description || '',
    lastUpdated: data.lastUpdated || '',
    order: typeof data.order === 'number' ? data.order : 999,
    slug: data.slug || null,
    draft: !!data.draft,
    prev: data.prev || null,
    next: data.next || null,
    hasEn: fs.existsSync(enFile),
    isSinglePage: true,
  };
}

function buildCategory(g, idx, isPublic) {
  const base = {
    id: g.label + '::' + idx,
    label: g.label,
    en: g.translations?.en || '',
    public: isPublic,
    internal: !isPublic,
    type: g.autogenerate ? 'autogenerate' : g.items ? 'items' : 'slug',
    order: idx,
    _raw: g,
    readOnly: !isPublic,
  };
  if (g.autogenerate) {
    base.dir = g.autogenerate.directory;
    base.articles = scanDir(g.autogenerate.directory);
  } else if (g.slug) {
    base.slug = g.slug;
    const p = readSlugPage(g.slug);
    base.articles = p ? [p] : [];
  } else if (g.items) {
    base.articles = g.items.map((it) => {
      const p = readSlugPage(it.slug);
      if (p) return { ...p, title: it.label || p.title, readOnly: true };
      return {
        id: it.slug,
        file: path.relative(DOCS, slugToFile(it.slug)),
        title: it.label || it.slug,
        description: '',
        readOnly: true,
        missing: true,
      };
    });
  }
  return base;
}

function buildTree() {
  const sidebar = JSON.parse(fs.readFileSync(SIDEBAR, 'utf8'));
  const internal = fs.existsSync(INTERNAL)
    ? JSON.parse(fs.readFileSync(INTERNAL, 'utf8'))
    : { internal: [] };
  const publicCats = (sidebar.main || []).map((g, i) => buildCategory(g, i, true));
  const internalCats = (internal.internal || []).map((g, i) => buildCategory(g, i, false));
  return { categories: [...publicCats, ...internalCats] };
}

/* ---------- 应用变更 ---------- */
function backup(file) {
  if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak');
}

function applyChanges(p) {
  const summary = { created: [], updated: [], deleted: [], categoryDeleted: [], sidebarChanged: false };
  backup(SIDEBAR);
  backup(INTERNAL);

  // 写 sidebar.json / editor-internal.json（顺序与 label/en 来自前端）
  if (p.publicGroups) {
    fs.writeFileSync(SIDEBAR, JSON.stringify({ main: p.publicGroups }, null, 2) + '\n');
    summary.sidebarChanged = true;
  }
  if (p.internalGroups) {
    fs.writeFileSync(INTERNAL, JSON.stringify({ internal: p.internalGroups }, null, 2) + '\n');
  }

  // 新建栏目（目录 + index.md 落地页）
  for (const c of p.newCategories || []) {
    const dir = c.dir;
    const full = path.join(DOCS, dir);
    if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
    const indexFile = path.join(full, 'index.md');
    if (!fs.existsSync(indexFile)) {
      const data = { title: c.label || dir, description: c.description || `「${c.label || dir}」栏目。` };
      if (c.en) data.en = c.en;
      fs.writeFileSync(indexFile, stringifyFrontmatter(data, `\n本栏目文章正在整理中。\n`));
    }
    summary.created.push(path.join(dir, 'index.md'));
  }

  // 字段更新（含因排序产生的 order 变更）
  for (const [file, fields] of Object.entries(p.edits || {})) {
    const full = path.join(DOCS, file);
    if (!fs.existsSync(full)) continue;
    const raw = fs.readFileSync(full, 'utf8');
    const { data, content } = parseFrontmatter(raw);
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      if (v === '') delete data[k];
      else data[k] = v;
    }
    fs.writeFileSync(full, stringifyFrontmatter(data, content));
    summary.updated.push(file);
  }

  // 新建文章
  for (const a of p.newArticles || []) {
    const dir = a.dir;
    const fname = (a.filename || slugify(a.title)) + '.md';
    const full = path.join(DOCS, dir, fname);
    if (!fs.existsSync(path.join(DOCS, dir))) fs.mkdirSync(path.join(DOCS, dir), { recursive: true });
    const data = {
      title: a.title,
      description: a.description || '',
      lastUpdated: a.lastUpdated || today(),
      order: typeof a.order === 'number' ? a.order : 999,
    };
    if (a.slug) data.slug = a.slug;
    if (a.draft) data.draft = true;
    const body = a.body || `# ${a.title}\n\n> 正文待编辑（在本地编辑器中完成）。\n`;
    fs.writeFileSync(full, stringifyFrontmatter(data, body));
    summary.created.push(path.join(dir, fname));
  }

  // 删除文章
  for (const file of p.deleted || []) {
    const full = path.join(DOCS, file);
    if (fs.existsSync(full)) {
      fs.rmSync(full, { force: true });
      summary.deleted.push(file);
    }
  }
  // 删除栏目（目录）
  for (const dir of p.deletedCategories || []) {
    const full = path.join(DOCS, dir);
    if (fs.existsSync(full)) {
      fs.rmSync(full, { recursive: true, force: true });
      summary.categoryDeleted.push(dir);
    }
  }
  return summary;
}

function safeCmd(s) {
  return String(s).replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

function deploy(message) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env.CODEBUDDY_SESSION_ID;
    delete env.CLAUDE_SESSION_ID;
    const cmd = `git add -A && git commit -m "${safeCmd(message || 'docs: 内容编辑器批量更新')}" && npm run deploy:github-pages`;
    const child = spawn('bash', ['-c', cmd], { cwd: ROOT, env });
    let log = '';
    child.stdout.on('data', (d) => (log += d));
    child.stderr.on('data', (d) => (log += d));
    child.on('close', (code) => resolve({ ok: code === 0, code, log }));
  });
}

/* ---------- HTTP 服务 ---------- */
function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.join(PUBLIC_DIR, urlPath);
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(file);
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[ext] || 'text/plain';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  try {
    if (url === '/api/tree' && req.method === 'GET') {
      return send(res, 200, buildTree());
    }
    if (url === '/api/article' && req.method === 'GET') {
      const u = new URL(req.url, 'http://x');
      const file = u.searchParams.get('file');
      const full = path.join(DOCS, file);
      if (!fs.existsSync(full)) return send(res, 404, { error: 'not found' });
      const raw = fs.readFileSync(full, 'utf8');
      const { data, content } = parseFrontmatter(raw);
      return send(res, 200, {
        file,
        title: data.title || '',
        description: data.description || '',
        lastUpdated: data.lastUpdated || '',
        order: typeof data.order === 'number' ? data.order : '',
        slug: data.slug || '',
        draft: !!data.draft,
        prev: data.prev || '',
        next: data.next || '',
        bodyPreview: content.slice(0, 240),
      });
    }
    if (url === '/api/article' && req.method === 'PUT') {
      const b = await readBody(req);
      const full = path.join(DOCS, b.file);
      if (!fs.existsSync(full)) return send(res, 404, { error: 'not found' });
      const { data, content } = parseFrontmatter(fs.readFileSync(full, 'utf8'));
      for (const [k, v] of Object.entries(b.fields || {})) {
        if (v === undefined) continue;
        if (v === '') delete data[k];
        else data[k] = v;
      }
      fs.writeFileSync(full, stringifyFrontmatter(data, content));
      return send(res, 200, { ok: true });
    }
    if (url === '/api/article' && req.method === 'DELETE') {
      const b = await readBody(req);
      const full = path.join(DOCS, b.file);
      if (fs.existsSync(full)) {
        fs.rmSync(full, { force: true });
        return send(res, 200, { ok: true, deleted: b.file });
      }
      return send(res, 404, { error: 'not found' });
    }
    if (url === '/api/category' && req.method === 'DELETE') {
      const b = await readBody(req);
      const full = path.join(DOCS, b.dir);
      if (fs.existsSync(full)) {
        fs.rmSync(full, { recursive: true, force: true });
        return send(res, 200, { ok: true, deleted: b.dir });
      }
      return send(res, 404, { error: 'not found' });
    }
    if (url === '/api/apply' && req.method === 'POST') {
      const b = await readBody(req);
      const summary = applyChanges(b);
      return send(res, 200, summary);
    }
    if (url === '/api/deploy' && req.method === 'POST') {
      const b = await readBody(req);
      const r = await deploy(b.message);
      return send(res, 200, r);
    }
    if (url.startsWith('/api/')) return send(res, 404, { error: 'unknown endpoint' });
    return serveStatic(req, res);
  } catch (e) {
    return send(res, 500, { error: String(e && e.stack ? e.stack : e) });
  }
});

server.listen(PORT, () => {
  console.log(`liuluit 内容编辑器已启动: http://localhost:${PORT}`);
});
