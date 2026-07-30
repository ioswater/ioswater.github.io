'use strict';

const state = {
  tree: [],
  initial: null,
  selected: null, // {kind:'article'|'category', catId, artId?}
  edits: {}, // file -> {field:value}
  newArticles: [], // {dir,title,description,filename?,body?,_new:true}
  deleted: [], // files
  deletedCategories: [], // dirs
  moves: [], // {oldFile, newFile, from, to, order}
  staged: [], // staged import/article ids for display
};

const $ = (s) => document.querySelector(s);
const treeEl = $('#tree');

/* ---------------- 加载 ---------------- */
async function load() {
  const r = await fetch('/api/tree');
  const data = await r.json();
  state.tree = data.categories || [];
  state.initial = JSON.parse(JSON.stringify(state.tree));
  state.edits = {};
  state.newArticles = [];
  state.deleted = [];
  state.deletedCategories = [];
  state.moves = [];
  state.tree.forEach((c) => c.articles.forEach((a) => { a._curFile = a.file; }));
  state.selected = null;
  renderTree();
  renderFormEmpty();
  renderPreview();
}

/* ---------------- 工具 ---------------- */
function slugify(t) {
  const s = String(t).normalize('NFKD').replace(/[^\w\s-]/g, '').trim().toLowerCase().replace(/\s+/g, '-');
  return s || 'post-' + Date.now().toString(36);
}
function findCat(id) {
  return state.tree.find((c) => c.id === id);
}
function findArt(cat, artId) {
  return cat.articles.find((a) => a.id === artId);
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 2600);
}

/* ---------------- 渲染：栏目树 ---------------- */
function renderTree() {
  const q = ($('#search').value || '').toLowerCase();
  treeEl.innerHTML = '';
  state.tree.forEach((cat) => {
    if (q && !cat.label.toLowerCase().includes(q) && !cat.articles.some((a) => a.title.toLowerCase().includes(q)))
      return;
    const catEl = document.createElement('div');
    catEl.className = 'cat' + (cat._collapsed ? ' collapsed' : '');
    catEl.dataset.catId = cat.id;

    const head = document.createElement('div');
    head.className = 'cat-head';
    head.draggable = true;
    head.dataset.catId = cat.id;
    head.innerHTML = `
      <span class="caret">▼</span>
      <span class="cat-title">${esc(cat.label)}</span>
      ${cat.internal ? '<span class="badge-internal">仅编辑器可见</span>' : ''}
      <span class="cat-type">${cat.type}</span>
      <span class="cat-actions">
        ${cat.public ? `<button class="icon-btn del" data-act="del-cat" title="删除栏目">✕</button>` : ''}
      </span>`;
    head.addEventListener('click', (e) => {
      if (e.target.closest('[data-act]')) return;
      cat._collapsed = !cat._collapsed;
      renderTree();
    });
    head.querySelector('[data-act="del-cat"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      delCategory(cat);
    });
    // 栏目拖拽
    head.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'cat', id: cat.id }));
      head.classList.add('dragging');
    });
    head.addEventListener('dragend', () => head.classList.remove('dragging'));
    head.addEventListener('dragover', (e) => {
      if (!dragData) return;
      if (dragData.kind === 'cat' || (dragData.kind === 'art' && dragData.catId !== cat.id && !cat.internal)) e.preventDefault();
    });
    head.addEventListener('dragenter', () => {
      if (dragData && dragData.kind === 'art' && dragData.catId !== cat.id && !cat.internal) head.classList.add('drop-target');
    });
    head.addEventListener('dragleave', () => head.classList.remove('drop-target'));
    head.addEventListener('drop', (e) => {
      e.preventDefault();
      head.classList.remove('drop-target');
      if (!dragData) return;
      if (dragData.kind === 'cat') moveCat(dragData.id, cat.id);
      else if (dragData.kind === 'art' && dragData.catId !== cat.id && !cat.internal) moveArtCross(dragData.catId, dragData.artId, cat.id);
    });
    catEl.appendChild(head);

    const list = document.createElement('div');
    list.className = 'articles' + (cat._collapsed ? ' hidden' : '');
    // 拖到文章列表区域 = 跨栏目移动（目标为该栏目末尾）
    list.addEventListener('dragover', (e) => {
      if (dragData && dragData.kind === 'art' && dragData.catId !== cat.id && !cat.internal) e.preventDefault();
    });
    list.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragData && dragData.kind === 'art' && dragData.catId !== cat.id && !cat.internal) moveArtCross(dragData.catId, dragData.artId, cat.id);
    });
    cat.articles.forEach((art) => {
      if (q && !art.title.toLowerCase().includes(q)) return;
      const row = document.createElement('div');
      row.className =
        'art-row' + (state.selected?.kind === 'article' && state.selected.catId === cat.id && state.selected.artId === art.id ? ' active' : '') +
        (art.readOnly ? ' readonly' : '');
      row.draggable = !art.readOnly;
      row.dataset.catId = cat.id;
      row.dataset.artId = art.id;
      row.innerHTML = `
        ${art.readOnly ? '' : '<span class="grip">⠿</span>'}
        <span class="t">${esc(art.title)}</span>
        <span class="en-dot ${art.hasEn ? 'on' : ''}" title="${art.hasEn ? '有 EN 镜像' : '缺 EN'}"></span>`;
      row.addEventListener('click', () => selectArticle(cat.id, art.id));
      if (!art.readOnly) {
        row.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'art', catId: cat.id, artId: art.id }));
          row.classList.add('dragging');
        });
        row.addEventListener('dragend', () => row.classList.remove('dragging'));
        row.addEventListener('dragover', (e) => {
          if (dragData && dragData.kind === 'art' && !cat.internal) e.preventDefault();
        });
        row.addEventListener('drop', (e) => {
          e.preventDefault();
          if (!dragData) return;
          if (dragData.kind === 'art' && dragData.catId === cat.id) moveArt(dragData.catId, dragData.artId, art.id);
          else if (dragData.kind === 'art' && dragData.catId !== cat.id && !cat.internal)
            moveArtCross(dragData.catId, dragData.artId, cat.id);
        });
      }
      list.appendChild(row);
    });
    // 暂存（待加入）文章
    state.newArticles.filter((n) => n.dir === cat.dir).forEach((n, i) => {
      const row = document.createElement('div');
      row.className = 'art-row active';
      row.innerHTML = `<span class="grip">⠿</span><span class="t">${esc(n.title)}</span><span class="staged">待加入</span>`;
      list.appendChild(row);
    });
    catEl.appendChild(list);
    treeEl.appendChild(catEl);
  });
}

let dragData = null;
document.addEventListener('dragend', () => (dragData = null));
document.addEventListener('dragstart', (e) => {
  try {
    dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
  } catch {}
});

function moveCat(fromId, toId) {
  if (fromId === toId) return;
  const from = state.tree.findIndex((c) => c.id === fromId);
  const to = state.tree.findIndex((c) => c.id === toId);
  if (from < 0 || to < 0) return;
  const [item] = state.tree.splice(from, 1);
  state.tree.splice(to, 0, item);
  renderTree();
}
function moveArt(catId, fromId, toId) {
  if (fromId === toId) return;
  const cat = findCat(catId);
  const from = cat.articles.findIndex((a) => a.id === fromId);
  const to = cat.articles.findIndex((a) => a.id === toId);
  if (from < 0 || to < 0) return;
  const [item] = cat.articles.splice(from, 1);
  cat.articles.splice(to, 0, item);
  renderTree();
  if (state.selected?.kind === 'article') renderPreview();
}
function moveArtCross(fromCatId, artId, toCatId) {
  if (fromCatId === toCatId) return;
  const fromCat = findCat(fromCatId);
  const toCat = findCat(toCatId);
  if (!fromCat || !toCat || toCat.readOnly || toCat.internal) return;
  const idx = fromCat.articles.findIndex((a) => a.id === artId);
  if (idx < 0) return;
  const art = fromCat.articles[idx];
  if (art.readOnly) return;
  const stem = art.id;
  const curFile = art._curFile || art.file;
  const newFile = toCat.dir + '/' + stem + '.md';
  // 链式移动：若已存在以 curFile 为目标的移动，则只更新其目标，避免重复移动
  const existing = state.moves.find((m) => m.newFile === curFile);
  if (existing) {
    existing.newFile = newFile;
    existing.to = toCat.dir;
    existing.order = toCat.articles.length + 1;
  } else {
    state.moves.push({ oldFile: curFile, newFile, from: fromCat.dir, to: toCat.dir, order: toCat.articles.length + 1 });
  }
  fromCat.articles.splice(idx, 1);
  toCat.articles.push(art);
  art._curFile = newFile;
  if (state.selected?.kind === 'article' && state.selected.catId === fromCatId && state.selected.artId === artId) {
    state.selected.catId = toCatId;
  }
  renderTree();
  renderPreview();
  toast(`《${art.title}》已移至「${toCat.label}」（应用变更后生效）`);
}

/* ---------------- 选择 ---------------- */
function selectArticle(catId, artId) {
  state.selected = { kind: 'article', catId, artId };
  renderTree();
  renderForm();
  renderPreview();
}
function selectCategory(catId) {
  state.selected = { kind: 'category', catId };
  renderTree();
  renderForm();
  renderPreview();
}

/* ---------------- 渲染：表单 ---------------- */
function renderFormEmpty() {
  $('#form').className = 'form empty';
  $('#form').textContent = '从左侧选择文章或栏目进行编辑';
}
async function renderForm() {
  const form = $('#form');
  form.className = 'form';
  if (!state.selected) return renderFormEmpty();
  if (state.selected.kind === 'category') return renderCategoryForm(findCat(state.selected.catId), form);
  const cat = findCat(state.selected.catId);
  const art = findArt(cat, state.selected.artId);
  if (!art) return renderFormEmpty();
  if (art.readOnly) {
    form.innerHTML = `<h3>${esc(art.title)}</h3><div class="sub">内部栏目文章（仅编辑器可见）· 只读</div>
      <div class="field"><label>文件</label><input type="text" value="${esc(art.file)}" readonly></div>
      <div class="field"><label>简介</label><textarea readonly>${esc(art.description || '（无）')}</textarea></div>
      <p class="muted">该文章属于「仅编辑器可见」栏目，不在公开导航中，因此不支持在此编辑。</p>`;
    return;
  }
  const r = await fetch('/api/article?file=' + encodeURIComponent(art.file));
  const a = await r.json();
  const cur = (f) => (state.edits[art.file] && f in state.edits[art.file] ? state.edits[art.file][f] : a[f]);
  form.innerHTML = `
    <h3>${esc(art.title)}</h3>
    <div class="sub">${esc(art.file)} · ${cat.label}</div>
    <div class="field"><label>标题 title *</label><input data-f="title" type="text" value="${esc(cur('title'))}"><div class="err" data-e="title"></div></div>
    <div class="field"><label>简介 description *（社交摘要，建议 ≤160 字）</label><textarea data-f="description">${esc(cur('description'))}</textarea><div class="hint" data-h="description"></div><div class="err" data-e="description"></div></div>
    <div class="row2">
      <div class="field"><label>更新日期 lastUpdated</label><input data-f="lastUpdated" type="date" value="${esc(cur('lastUpdated'))}"></div>
      <div class="field"><label>排序 order</label><input data-f="order" type="number" value="${esc(cur('order'))}"></div>
    </div>
    <div class="row2">
      <div class="field"><label>自定义路径 slug</label><input data-f="slug" type="text" value="${esc(cur('slug'))}" placeholder="留空=用文件名"></div>
      <div class="field"><label>上一篇 prev</label><input data-f="prev" type="text" value="${esc(cur('prev'))}"></div>
    </div>
    <div class="field"><label>下一篇 next</label><input data-f="next" type="text" value="${esc(cur('next'))}"></div>
    <div class="field switch"><label><input data-f="draft" type="checkbox" ${cur('draft') ? 'checked' : ''}> 草稿（draft，不发布到生产）</label></div>
    <div class="form-actions">
      <button class="btn ghost" data-act="del-art">删除文章</button>
    </div>`;
  form.querySelectorAll('[data-f]').forEach((inp) => {
    inp.addEventListener('input', () => onFieldEdit(art.file, inp.dataset.f, inp.type === 'checkbox' ? inp.checked : inp.value));
    inp.addEventListener('change', () => onFieldEdit(art.file, inp.dataset.f, inp.type === 'checkbox' ? inp.checked : inp.value));
  });
  form.querySelector('[data-act="del-art"]').addEventListener('click', () => delArticle(cat, art));
  renderPreview();
}
function renderCategoryForm(cat, form) {
  if (cat.internal) {
    form.innerHTML = `<h3>${esc(cat.label)}</h3><div class="sub">内部栏目（仅编辑器可见）· 只读</div>
      <p class="muted">该栏目不出现在网站公开导航中。其下文章在「站点维护」中管理，不在本编辑器内编辑。</p>
      <div class="field"><label>类型</label><input type="text" value="${cat.type}" readonly></div>`;
    return;
  }
  form.innerHTML = `
    <h3>栏目设置</h3>
    <div class="sub">${cat.type}${cat.dir ? ' · ' + esc(cat.dir) : ''}${cat.slug ? ' · ' + esc(cat.slug) : ''}</div>
    <div class="field"><label>中文标题 label *</label><input data-cf="label" type="text" value="${esc(cat.label)}"></div>
    <div class="field"><label>英文标题 en</label><input data-cf="en" type="text" value="${esc(cat.en)}"></div>
    <div class="field"><label>文章数</label><input type="text" value="${cat.articles.length}" readonly></div>
    <div class="form-actions"><button class="btn ghost" data-act="del-cat">删除栏目（含目录）</button></div>`;
  form.querySelector('[data-cf="label"]').addEventListener('input', (e) => {
    cat.label = e.target.value;
    cat._raw.label = e.target.value;
    renderTree();
    renderPreview();
  });
  form.querySelector('[data-cf="en"]').addEventListener('input', (e) => {
    cat.en = e.target.value;
    cat._raw.translations = cat._raw.translations || {};
    cat._raw.translations.en = e.target.value;
    renderPreview();
  });
  form.querySelector('[data-act="del-cat"]').addEventListener('click', () => delCategory(cat));
}

function onFieldEdit(file, field, value) {
  state.edits[file] = state.edits[file] || {};
  if (value === '' && (field === 'slug' || field === 'prev' || field === 'next')) delete state.edits[file][field];
  else state.edits[file][field] = value;
  // 同步树节点显示 + 预览
  for (const cat of state.tree) {
    const art = cat.articles.find((x) => x.file === file);
    if (art) {
      if (field === 'title') art.title = value;
      if (field === 'description') art.description = value;
      if (field === 'order') art.order = value === '' ? 999 : Number(value);
      if (field === 'lastUpdated') art.lastUpdated = value;
    }
  }
  renderTree();
  renderPreview();
}

/* ---------------- 渲染：预览 + 校验 ---------------- */
async function renderPreview() {
  const fmEl = $('#fm-preview');
  const sbEl = $('#sb-preview');
  const enBadge = $('#en-badge');
  const valEl = $('#validation');
  if (!state.selected) {
    fmEl.textContent = '---\n# 选择文章后显示 frontmatter';
    sbEl.textContent = JSON.stringify(sidebarSnapshot(), null, 2);
    enBadge.className = 'badge en';
    valEl.innerHTML = '';
    return;
  }
  if (state.selected.kind === 'category') {
    const cat = findCat(state.selected.catId);
    fmEl.textContent = `# 栏目「${cat.label}」\n# 类型: ${cat.type}` + (cat.internal ? '\n# 仅编辑器可见（不发布）' : '');
    enBadge.className = 'badge en';
    valEl.innerHTML = `<li><span class="ok">✓</span> 栏目配置（应用变更时写入 sidebar.json）</li>`;
    return;
  }
  const cat = findCat(state.selected.catId);
  const art = findArt(cat, state.selected.artId);
  if (!art) return;
  let fields = {};
  if (!art.readOnly) {
    const r = await fetch('/api/article?file=' + encodeURIComponent(art.file));
    const a = await r.json();
    fields = { title: a.title, description: a.description, lastUpdated: a.lastUpdated, order: a.order, slug: a.slug, draft: a.draft, prev: a.prev, next: a.next };
    for (const [k, v] of Object.entries(state.edits[art.file] || {})) fields[k] = v;
  } else {
    fields = { title: art.title, description: art.description };
  }
  let yaml = '---\n';
  for (const [k, v] of Object.entries(fields)) {
    if (v === '' || v === null || v === undefined) continue;
    if (typeof v === 'boolean') yaml += `${k}: ${v ? 'true' : 'false'}\n`;
    else if (typeof v === 'number') yaml += `${k}: ${v}\n`;
    else yaml += `${k}: ${String(v).includes(':') ? '"' + v + '"' : v}\n`;
  }
  yaml += '---';
  fmEl.textContent = yaml;
  enBadge.className = 'badge en' + (art.hasEn ? ' on' : '');
  // 校验
  const errs = [];
  if (!fields.title) errs.push(['err', '缺少 title']);
  if (!fields.description) errs.push(['err', '缺少 description（简介）']);
  else if (String(fields.description).length > 160) errs.push(['warn', `description ${fields.description.length} 字，超过 160 建议值`]);
  if (cat.type === 'autogenerate' && !cat.articles.some((x) => x.id === 'index')) {
    // index 提示由栏目级处理
  }
  if (art.readOnly) errs.push(['warn', '内部文章（仅编辑器可见），不参与公开发布']);
  if (errs.length === 0) errs.push(['ok', '校验通过']);
  valEl.innerHTML = errs.map(([c, m]) => `<li><span class="${c}">${c === 'ok' ? '✓' : c === 'warn' ? '!' : '✕'}</span> ${esc(m)}</li>`).join('');
}

function sidebarSnapshot() {
  return {
    main: state.tree.filter((c) => c.public).map((c) => c._raw),
    internal: state.tree.filter((c) => c.internal).map((c) => c._raw),
  };
}

/* ---------------- 删除 ---------------- */
function delArticle(cat, art) {
  if (!confirm(`确认删除文章《${art.title}》？\n文件：${art.file}\n（应用变更后生效）`)) return;
  if (!state.deleted.includes(art.file)) state.deleted.push(art.file);
  const i = cat.articles.findIndex((x) => x.id === art.id);
  if (i >= 0) cat.articles.splice(i, 1);
  state.selected = null;
  renderTree();
  renderFormEmpty();
  renderPreview();
  toast('已标记删除，应用变更后生效');
}
function delCategory(cat) {
  if (!confirm(`确认删除栏目《${cat.label}》及其目录下所有文章？\n（应用变更后生效）`)) return;
  if (cat.dir && !state.deletedCategories.includes(cat.dir)) state.deletedCategories.push(cat.dir);
  const i = state.tree.findIndex((c) => c.id === cat.id);
  if (i >= 0) state.tree.splice(i, 1);
  state.selected = null;
  renderTree();
  renderFormEmpty();
  renderPreview();
  toast('已标记删除栏目，应用变更后生效');
}

/* ---------------- 新建 ---------------- */
function newArticle() {
  const title = prompt('新文章标题：');
  if (!title) return;
  const cat = state.selected?.kind === 'category' && findCat(state.selected.catId)?.public && findCat(state.selected.catId)?.type === 'autogenerate'
    ? findCat(state.selected.catId)
    : state.tree.find((c) => c.public && c.type === 'autogenerate');
  if (!cat) return toast('没有可用的公开 autogenerate 栏目');
  const desc = prompt('简介 description（可选）：') || '';
  state.newArticles.push({ dir: cat.dir, title, description: desc, _new: true });
  renderTree();
  renderPreview();
  toast(`已暂存《${title}》到「${cat.label}」，应用变更后正式加入`);
}
function newCategory() {
  const label = prompt('新栏目中文标题：');
  if (!label) return;
  const en = prompt('英文标题（可选）：') || '';
  const dir = slugify(label);
  const cat = {
    id: 'new::' + dir,
    label,
    en,
    public: true,
    internal: false,
    type: 'autogenerate',
    dir,
    articles: [],
    _isNew: true,
    _raw: { label, translations: { en }, autogenerate: { directory: dir } },
  };
  state.tree.push(cat);
  renderTree();
  renderPreview();
  toast(`已暂存新栏目「${label}」，应用变更后创建目录`);
}

/* ---------------- 导入拖拽 ---------------- */
function setupImport() {
  const zone = $('#import-zone');
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zone.classList.remove('drag');
    const file = e.dataTransfer.files[0];
    if (!file || !/\.mdx?$/.test(file.name)) return toast('请拖入 .md / .mdx 文件');
    const text = await file.text();
    const m = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---/);
    let title = file.name.replace(/\.mdx?$/, '');
    let description = '';
    if (m) {
      for (const line of m[1].split(/\r?\n/)) {
        const mm = line.match(/^(title|description)[ \t]*:[ \t]*(.*)$/);
        if (mm) {
          let v = mm[2].trim().replace(/^["']|["']$/g, '');
          if (mm[1] === 'title') title = v;
          else description = v;
        }
      }
    }
    const cat = state.selected?.kind === 'category' && findCat(state.selected.catId)?.public && findCat(state.selected.catId)?.type === 'autogenerate'
      ? findCat(state.selected.catId)
      : state.tree.find((c) => c.public && c.type === 'autogenerate');
    if (!cat) return toast('没有可用的公开栏目');
    state.newArticles.push({ dir: cat.dir, title, description, body: text, filename: file.name.replace(/\.mdx?$/, ''), _new: true });
    renderTree();
    renderPreview();
    toast(`已暂存导入《${title}》到「${cat.label}」`);
  });
}

/* ---------------- 应用变更 ---------------- */
function computeChanges() {
  const items = [];
  // sidebar 顺序/标题变化
  const pubNow = state.tree.filter((c) => c.public);
  const pubInit = state.initial.filter((c) => c.public);
  const orderSame = pubNow.map((c) => c.id).join() === pubInit.map((c) => c.id).join();
  const labelSame = pubNow.every((c, i) => c.label === pubInit[i]?.label && c.en === pubInit[i]?.en);
  if (!orderSame) items.push(['order', '栏目顺序已调整']);
  if (!labelSame) items.push(['sidebar', '栏目标题/英文名已修改']);
  const intNow = state.tree.filter((c) => c.internal);
  const intInit = state.initial.filter((c) => c.internal);
  if (intNow.map((c) => c.id).join() !== intInit.map((c) => c.id).join())
    items.push(['sidebar', '内部栏目顺序已调整']);
  // 字段编辑
  const editCount = Object.keys(state.edits).length;
  if (editCount) items.push(['update', `文章元数据修改 ×${editCount}`]);
  // 新增
  if (state.newArticles.length) items.push(['create', `新增文章 ×${state.newArticles.length}`]);
  // 跨栏目移动
  if (state.moves.length) items.push(['move', `跨栏目移动 ×${state.moves.length}`]);
  // 删除
  if (state.deleted.length) items.push(['delete', `删除文章 ×${state.deleted.length}`]);
  if (state.deletedCategories.length) items.push(['delete', `删除栏目 ×${state.deletedCategories.length}`]);
  return items;
}

function openApply() {
  const items = computeChanges();
  const list = $('#change-list');
  if (items.length === 0) {
    list.innerHTML = '<p class="muted">没有检测到变更。</p>';
  } else {
    list.innerHTML = items
      .map(([t, m]) => `<div class="change-item"><span class="tag ${t}">${tagText(t)}</span><span>${esc(m)}</span></div>`)
      .join('');
  }
  $('#deploy-log').classList.add('hidden');
  $('#modal').classList.remove('hidden');
}
function tagText(t) {
  return { create: '新增', update: '修改', delete: '删除', order: '排序', sidebar: '导航', move: '移动' }[t] || t;
}

async function confirmApply() {
  const pub = state.tree.filter((c) => c.public);
  const pubInit = state.initial.filter((c) => c.public);
  const intNow = state.tree.filter((c) => c.internal);
  // 跨栏目移动：建立 oldFile→newFile 映射，edits 与 order 注入均按移动后的实际路径
  const moveMap = {};
  state.moves.forEach((m) => (moveMap[m.oldFile] = m.newFile));
  const edits = {};
  for (const [k, v] of Object.entries(state.edits)) edits[moveMap[k] || k] = v;
  // 注入因排序产生的 order（使用移动后的实际路径）
  pub.filter((c) => c.type === 'autogenerate').forEach((cat) => {
    cat.articles.forEach((art, i) => {
      if (art.readOnly) return;
      const f = moveMap[art.file] || art.file;
      if (art.order !== i + 1) {
        edits[f] = edits[f] || {};
        edits[f].order = i + 1;
      }
    });
  });
  // 落地页「本栏目文章」顺序 = 编辑器树中各栏目文章的实际排列（用户拖拽顺序）
  const landing = {};
  pub.filter((c) => c.type === 'autogenerate' && c.dir).forEach((cat) => {
    landing[cat.dir] = cat.articles
      .filter((a) => !a.readOnly)
      .map((a) => ({ title: a.title, slug: a.slug || null, id: a.id }));
  });
  const payload = {
    publicGroups: pub.map((c) => c._raw),
    internalGroups: intNow.map((c) => c._raw),
    edits,
    moves: state.moves,
    landing,
    newArticles: state.newArticles.map((n) => ({ dir: n.dir, title: n.title, description: n.description, filename: n.filename, body: n.body })),
    deleted: state.deleted,
    deletedCategories: state.deletedCategories,
    newCategories: state.tree.filter((c) => c._isNew).map((c) => ({ label: c.label, en: c.en, dir: c.dir })),
  };
  $('#btn-confirm').disabled = true;
  $('#btn-confirm').textContent = '写入中…';
  const r = await fetch('/api/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const sum = await r.json();
  $('#btn-confirm').textContent = '部署上线中…';
  const d = await fetch('/api/deploy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'docs: 内容编辑器批量更新' }) });
  const dep = await d.json();
  const log = $('#deploy-log');
  log.classList.remove('hidden');
  const moved = sum.moved && sum.moved.length ? '移动:\n  ' + sum.moved.join('\n  ') + '\n' : '';
  const land = sum.landingSynced && sum.landingSynced.length ? '落地页同步: ' + sum.landingSynced.join(', ') + '\n' : '';
  log.textContent = (dep.ok ? '✅ 部署成功\n' : '⚠️ 部署异常\n') + moved + land + dep.log;
  $('#btn-confirm').disabled = false;
  $('#btn-confirm').textContent = '确认并部署上线';
  if (dep.ok) {
    toast('已应用并部署上线');
    await load();
  } else {
    toast('部署出错，请查看日志');
  }
}

/* ---------------- 主题 ---------------- */
function setupTheme() {
  const t = localStorage.getItem('editor-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
  $('#btn-theme').textContent = t === 'dark' ? '🌙' : '☀️';
  $('#btn-theme').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('editor-theme', next);
    $('#btn-theme').textContent = next === 'dark' ? '🌙' : '☀️';
  });
}

/* ---------------- 辅助 ---------------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------- 初始化 ---------------- */
function init() {
  setupTheme();
  setupImport();
  $('#search').addEventListener('input', renderTree);
  $('#btn-new-article').addEventListener('click', newArticle);
  $('#btn-new-cat').addEventListener('click', newCategory);
  $('#btn-apply').addEventListener('click', openApply);
  $('#btn-cancel').addEventListener('click', () => $('#modal').classList.add('hidden'));
  $('#btn-confirm').addEventListener('click', confirmApply);
  load();
}
init();
