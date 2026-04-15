const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { pathToFileURL } = require('url');
const { shell } = require('electron');

if (process.env.PORTABLE_EXECUTABLE_DIR) {
  app.setPath('userData', path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data'));
}

let mainWindow = null;
let isQuitting = false;


const defaultDeveloperProfile = {
  name: '',
  bio: '',
  photo: ''
};

ipcMain.handle('confirm-delete', async (event, payload) => {
  const win = BrowserWindow.fromWebContents(event.sender);

  const type = payload?.type || 'item';
  const name = payload?.name || 'элемент';

  const result = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Отмена', 'Удалить'],
    defaultId: 1,
    cancelId: 0,
    title: 'Подтверждение удаления',
    message: `Удалить ${type} "${name}"?`,
    detail: 'Это действие нельзя отменить.'
  });

  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
  }

  return result.response === 1;
});

function getAppDataDir() {
  return app.getPath('userData');
}

function getPortfolioPath() {
  return path.join(getAppDataDir(), 'portfolio.json');
}

function getCoversDir() {
  return path.join(getAppDataDir(), 'covers');
}

function getProgramRootDir() {
  if (app.isPackaged) {
    return path.dirname(app.getPath('exe'));
  }

  return path.resolve(__dirname, '..');
}

function getExportRootDir() {
  return path.join(getProgramRootDir(), 'export');
}

function formatDateForFolder(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + '_' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('-');
}

function getExportDir() {
  return path.join(getExportRootDir(), `portfolio_${formatDateForFolder()}`);
}
async function ensureStorage() {
  await fsp.mkdir(getCoversDir(), { recursive: true });

  const portfolioPath = getPortfolioPath();
  try {
    await fsp.access(portfolioPath);
  } catch {
    const emptyData = { themes: [] };
    await fsp.writeFile(portfolioPath, JSON.stringify(emptyData, null, 2), 'utf8');
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('close', (e) => {
    if (isQuitting) return;
    e.preventDefault();
    mainWindow.webContents.send('app:before-close');
  });
}

function normalizePortfolio(data) {
  const themes = Array.isArray(data?.themes) ? data.themes : [];
  const developerProfile = {
    name: String(data?.developerProfile?.name || ''),
    bio: String(data?.developerProfile?.bio || ''),
    photo: String(data?.developerProfile?.photo || '')
  };

  return {
    developerProfile,
    themes: themes.map(theme => ({
      id: theme.id,
      name: theme.name,
      createdAt: theme.createdAt,
      projects: Array.isArray(theme.projects) ? theme.projects.map(project => ({
        id: project.id,
        title: project.title,
        description: project.description,
        link: project.link,
        additional: project.additional,
        cover: project.cover || '',
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      })) : []
    }))
  };
}

async function loadRawPortfolio() {
  try {
    const text = await fsp.readFile(getPortfolioPath(), 'utf8');
    return JSON.parse(text);
  } catch {
    return {
      developerProfile: { name: '', bio: '', photo: '' },
      themes: []
    };
  }
}

async function saveRawPortfolio(data) {
  const clean = normalizePortfolio(data);
  await ensureStorage();
  await fsp.writeFile(getPortfolioPath(), JSON.stringify(clean, null, 2), 'utf8');
  return clean;
}

async function removeExistingProjectCovers(projectId) {
  const files = await fsp.readdir(getCoversDir()).catch(() => []);
  const prefix = `project_${projectId}.`;

  await Promise.all(
    files
      .filter(file => file.startsWith(prefix))
      .map(file => fsp.unlink(path.join(getCoversDir(), file)).catch(() => { }))
  );
}

function addCoverUrls(data) {
  const clean = normalizePortfolio(data);

  let developerPhotoUrl = '';
  if (clean.developerProfile.photo) {
    const abs = path.join(getAppDataDir(), clean.developerProfile.photo);
    try {
      developerPhotoUrl = pathToFileURL(abs).href;
    } catch {
      developerPhotoUrl = '';
    }
  }

  return {
    developerProfile: {
      ...clean.developerProfile,
      photoUrl: developerPhotoUrl
    },
    themes: clean.themes.map(theme => ({
      ...theme,
      projects: theme.projects.map(project => {
        let coverUrl = '';

        if (project.cover) {
          const abs = path.join(getAppDataDir(), project.cover);
          try {
            coverUrl = pathToFileURL(abs).href;
          } catch {
            coverUrl = '';
          }
        }

        return {
          ...project,
          coverUrl
        };
      })
    }))
  };
}

ipcMain.handle('portfolio:load', async () => {
  const raw = await loadRawPortfolio();
  return addCoverUrls(raw);
});

ipcMain.handle('portfolio:save', async (event, data) => {
  await saveRawPortfolio(data);
  return { ok: true };
});

ipcMain.handle('app:openExternal', async (event, url) => {
  if (!url) return { ok: false };

  await shell.openExternal(url);
  return { ok: true };
});

ipcMain.handle('portfolio:copyCover', async (event, { sourcePath, projectId }) => {
  if (!sourcePath || !projectId) {
    return { ok: false, message: 'Не удалось копировать обложку.' };
  }

  const ext = path.extname(sourcePath).toLowerCase() || '.png';
  await ensureStorage();
  await removeExistingProjectCovers(projectId);

  const fileName = `project_${projectId}${ext}`;
  const targetAbs = path.join(getCoversDir(), fileName);

  await fsp.copyFile(sourcePath, targetAbs);

  return {
    ok: true,
    cover: `covers/${fileName}`
  };
});

async function removeExistingDeveloperPhoto() {
  const files = await fsp.readdir(getCoversDir()).catch(() => []);
  const prefix = 'developer_profile.';

  await Promise.all(
    files
      .filter(file => file.startsWith(prefix))
      .map(file => fsp.unlink(path.join(getCoversDir(), file)).catch(() => { }))
  );
}

ipcMain.handle('portfolio:copyDeveloperPhoto', async (event, sourcePath) => {
  if (!sourcePath) {
    return { ok: false, message: 'Не удалось копировать фото.' };
  }

  const ext = path.extname(sourcePath).toLowerCase() || '.png';
  await ensureStorage();
  await removeExistingDeveloperPhoto();

  const fileName = `developer_profile${ext}`;
  const targetAbs = path.join(getCoversDir(), fileName);

  await fsp.copyFile(sourcePath, targetAbs);

  return {
    ok: true,
    photo: `covers/${fileName}`
  };
});

ipcMain.handle('portfolio:openExportFolder', async () => {
  const exportRootDir = getExportRootDir();

  await fsp.mkdir(exportRootDir, { recursive: true });

  const entries = await fsp.readdir(exportRootDir, { withFileTypes: true }).catch(() => []);
  const folders = entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();

  const latestFolder = folders.length > 0 ? folders[folders.length - 1] : null;
  const targetPath = latestFolder
    ? path.join(exportRootDir, latestFolder)
    : exportRootDir;

  await shell.openPath(targetPath);

  return {
    ok: true,
    path: targetPath
  };
});

ipcMain.handle('dialog:pickImage', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('app:quitAfterSave', async () => {
  isQuitting = true;
  app.quit();
  return { ok: true };
});

ipcMain.handle('portfolio:export', async () => {
  try {
    const raw = await loadRawPortfolio();
    const data = normalizePortfolio(raw);
    const exportRootDir = getExportRootDir();
    const exportDir = getExportDir();
    const exportCoversDir = path.join(exportDir, 'covers');

    await fsp.mkdir(exportRootDir, { recursive: true });
    await fsp.rm(exportDir, { recursive: true, force: true }).catch(() => { });
    await fsp.mkdir(exportCoversDir, { recursive: true });

    await fsp.rm(exportDir, { recursive: true, force: true }).catch(() => { });
    await fsp.mkdir(exportCoversDir, { recursive: true });

    const usedCovers = new Set();

    for (const theme of data.themes) {
      for (const project of theme.projects) {
        if (!project.cover || usedCovers.has(project.cover)) continue;

        usedCovers.add(project.cover);

        const sourceAbs = path.join(getAppDataDir(), project.cover);
        const targetAbs = path.join(exportDir, project.cover);

        await fsp.mkdir(path.dirname(targetAbs), { recursive: true }).catch(() => { });
        await fsp.copyFile(sourceAbs, targetAbs).catch(() => { });
      }
    }

    const exportData = {
      developerProfile: data.developerProfile,
      themes: data.themes
    };

    const inlineData = JSON.stringify(exportData).replace(/</g, '\\u003c');
    const siteHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Портфолио разработчика</title>
  <link rel="icon" href="./favicon.svg" type="image/svg+xml" />
<link rel="icon" href="./favicon.png" type="image/png" />
<link rel="icon" href="./favicon.ico" sizes="any" />
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <div class="app">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand__label">Портфолио разработчика</div>
      </div>

      <div class="developer-card">
        <div class="developer-photo-preview" id="developerPhotoPreview">
          <span>Фото</span>
        </div>

        <div class="developer-name" id="developerName">Имя Фамилия</div>
        <div class="developer-bio" id="developerBio">Биография разработчика.</div>
      </div>

      <div class="themes-panel">
        <div class="themes-panel__title">Темы</div>
        <div class="themes" id="themesList"></div>
      </div>
    </aside>

    <main class="main">
      <div class="topbar">
        <div>
          <h2 id="currentThemeTitle">Выберите тему</h2>
          <p id="currentThemeSubtitle">Проекты выбранной темы.</p>
        </div>
      </div>

      <div class="toolbar">
        <div class="search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21 21l-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <input id="searchInput" type="search" placeholder="Поиск по проектам..." />
        </div>
        <div class="stats">
          <div class="stat">
            <b id="themeCount">0</b>
            <span>тем</span>
          </div>
          <div class="stat">
            <b id="projectCount">0</b>
            <span>проектов в теме</span>
          </div>
        </div>
      </div>

      <section id="projectsContainer" class="projects"></section>
    </main>
  </div>

<script>
  window.__PORTFOLIO_DATA__ = ${inlineData}; 
</script>

  <script src="./script.js"></script>
</body>
</html>`;

    const siteCss = `:root{
  --bg:#0f1220;
  --bg-2:#0b1020;
  --panel:#151a2c;
  --panel-2:#1a2036;
  --line:#2a3150;
  --text:#eef1fb;
  --muted:#aab2cf;
  --accent:#7c8cff;
  --accent-2:#5ad7c5;
  --shadow:0 18px 50px rgba(0,0,0,.28);
  --radius:24px;
  --radius-sm:16px;
  --maxw:1400px;
}
*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;
  font-family:Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  color:var(--text);
  background:
    radial-gradient(circle at top left, rgba(124,140,255,.16), transparent 28%),
    radial-gradient(circle at top right, rgba(90,215,197,.12), transparent 24%),
    linear-gradient(180deg, var(--bg-2), var(--bg) 35%, var(--bg-2));
}
img{max-width:100%;display:block}
a{color:inherit}
.page{
  width:min(var(--maxw), calc(100% - 32px));
  margin:0 auto;
}
.app{
  min-height:100vh;
  display:grid;
  grid-template-columns: 300px 1fr;
  gap:18px;
  padding:18px 0 24px;
}
.sidebar,
.main{
  background:rgba(21,26,44,.9);
  border:1px solid rgba(255,255,255,.06);
  box-shadow:var(--shadow);
  backdrop-filter:blur(10px);
}
.sidebar{
  border-radius:var(--radius);
  padding:18px;
  display:flex;
  flex-direction:column;
  gap:16px;
}
.brand{
  padding-bottom:14px;
  border-bottom:1px solid rgba(255,255,255,.06);
}
.brand__label{
  font-size:.82rem;
  font-weight:700;
  letter-spacing:.08em;
  text-transform:uppercase;
  color:#d8ddf4;
}
.developer-card{
  display:grid;
  gap:12px;
  padding:16px;
  border-radius:20px;
  background:rgba(255,255,255,.03);
  border:1px solid rgba(255,255,255,.06);
}
.developer-photo-preview{
  aspect-ratio:1/1;
  border-radius:18px;
  overflow:hidden;
  background:
    radial-gradient(circle at 30% 20%, rgba(255,255,255,.12), transparent 40%),
    linear-gradient(135deg, rgba(124,140,255,.24), rgba(90,215,197,.18));
  border:1px solid rgba(255,255,255,.08);
  display:flex;
  align-items:center;
  justify-content:center;
  color:rgba(255,255,255,.38);
  font-weight:700;
  font-size:1rem;
}
.developer-photo-preview img{
  width:100%;
  height:100%;
  object-fit:cover;
}
.developer-name{
  font-size:1.05rem;
  font-weight:700;
  line-height:1.25;
}
.developer-bio{
  color:var(--muted);
  line-height:1.55;
  white-space:pre-wrap;
  word-break:break-word;
  font-size:.95rem;
}
.themes-panel{
  display:flex;
  flex-direction:column;
  gap:10px;
  flex:1;
  min-height:0;
}
.themes-panel__title{
  font-size:.9rem;
  font-weight:700;
  color:#d8ddf4;
  text-transform:uppercase;
  letter-spacing:.06em;
}
.themes{
  display:flex;
  flex-direction:column;
  gap:8px;
  overflow:auto;
  padding-right:2px;
  flex:1;
  justify-content:flex-start;
  align-items:stretch;
}
.theme-item{
  padding:12px 12px;
  border-radius:16px;
  background:rgba(255,255,255,.03);
  border:1px solid rgba(255,255,255,.06);
  cursor:pointer;
  transition:transform .18s ease, background .18s ease, border-color .18s ease;
}
.theme-item:hover{transform:translateY(-1px)}
.theme-item.active{
  background:rgba(124,140,255,.16);
  border-color:rgba(124,140,255,.34);
}
.theme-item strong{
  display:block;
  font-size:.98rem;
  line-height:1.3;
  margin-bottom:2px;
}
.theme-item span{
  color:var(--muted);
  font-size:.86rem;
}
.main{
  border-radius:var(--radius);
  padding:18px;
  display:flex;
  flex-direction:column;
  gap:16px;
  min-height:100vh;
}
.topbar{
  display:flex;
  justify-content:space-between;
  gap:16px;
  flex-wrap:wrap;
  padding-bottom:4px;
}
.topbar h2{
  margin:0 0 6px;
  font-size:1.6rem;
  line-height:1.2;
}
.topbar p{
  margin:0;
  color:var(--muted);
}
.toolbar{
  display:flex;
  gap:12px;
  flex-wrap:wrap;
  align-items:center;
  justify-content:space-between;
  padding:14px;
  background:rgba(255,255,255,.03);
  border:1px solid rgba(255,255,255,.06);
  border-radius:var(--radius-sm);
}
.search{
  flex:1;
  min-width:min(460px, 100%);
  position:relative;
}
.search input{
  width:100%;
  border:none;
  outline:none;
  color:var(--text);
  background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.06);
  padding:12px 14px 12px 42px;
  border-radius:16px;
}
.search svg{
  position:absolute;
  left:14px;
  top:50%;
  transform:translateY(-50%);
  opacity:.65;
}
.stats{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}
.stat{
  background:rgba(255,255,255,.04);
  border:1px solid rgba(255,255,255,.06);
  border-radius:16px;
  padding:10px 12px;
  min-width:112px;
}
.stat b{
  display:block;
  font-size:1rem;
  margin-bottom:2px;
}
.stat span{
  font-size:.84rem;
  color:var(--muted);
}
.projects{
  display:grid;
  grid-template-columns:repeat(auto-fill, minmax(270px, 1fr));
  gap:14px;
  align-content:start;
}
.card{
  background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.03));
  border:1px solid rgba(255,255,255,.07);
  border-radius:20px;
  overflow:hidden;
  display:flex;
  flex-direction:column;
}
.cover{
  aspect-ratio:16/9;
  background:linear-gradient(135deg, rgba(124,140,255,.25), rgba(90,215,197,.18));
  border-bottom:1px solid rgba(255,255,255,.05);
  position:relative;
}
.cover img{
  width:100%;
  height:100%;
  object-fit:cover;
}
.cover .fallback{
  position:absolute;
  inset:0;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:2.8rem;
  font-weight:800;
  color:rgba(255,255,255,.24);
  letter-spacing:.08em;
}
.card-body{
  padding:14px;
  display:flex;
  flex-direction:column;
  gap:10px;
  flex:1;
}
.card-title h3{
  margin:0;
  font-size:1.05rem;
  line-height:1.25;
}
.desc{
  color:var(--muted);
  line-height:1.55;
  white-space:pre-wrap;
  word-break:break-word;
}
.pill{
  display:inline-flex;
  width:fit-content;
  padding:6px 10px;
  border-radius:999px;
  font-size:.8rem;
  color:var(--muted);
  background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.06);
}
.card-links{
  margin-top:auto;
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}
.link-btn{
  text-decoration:none;
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding:10px 12px;
  border-radius:14px;
  background:rgba(124,140,255,.12);
  border:1px solid rgba(124,140,255,.22);
}
.empty{
  border:1px dashed rgba(255,255,255,.16);
  border-radius:24px;
  padding:34px 18px;
  text-align:center;
  background:rgba(255,255,255,.03);
  color:var(--muted);
  display:grid;
  gap:10px;
  place-items:center;
}
.empty h3{margin:0;color:var(--text)}
.empty p{margin:0;max-width:52ch;line-height:1.6}
@media (max-width: 980px){
  .app{grid-template-columns:1fr}
  .sidebar{min-height:auto}
  .search{min-width:100%}
}
`;

    const siteScript = `let data = { developerProfile: { name: '', bio: '', photo: '' }, themes: [] };
let activeThemeId = null;
let searchQuery = '';

const els = {
  developerPhotoPreview: document.getElementById('developerPhotoPreview'),
  developerName: document.getElementById('developerName'),
  developerBio: document.getElementById('developerBio'),
  themesList: document.getElementById('themesList'),
  currentThemeTitle: document.getElementById('currentThemeTitle'),
  currentThemeSubtitle: document.getElementById('currentThemeSubtitle'),
  projectsContainer: document.getElementById('projectsContainer'),
  searchInput: document.getElementById('searchInput'),
  themeCount: document.getElementById('themeCount'),
  projectCount: document.getElementById('projectCount')
};

function escapeHtml(str){
  return String(str)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#39;");
}

function normalizeText(value){
  return String(value || '').trim();
}

function getActiveTheme(){
  return data.themes.find(t => t.id === activeThemeId) || null;
}

function getFilteredProjects(projects){
  const q = searchQuery.trim().toLowerCase();
  if(!q) return projects;
  return projects.filter(p => [p.title, p.description, p.additional].join(' ').toLowerCase().includes(q));
}

function renderDeveloperProfile(){
  const profile = data.developerProfile || {};
  const name = normalizeText(profile.name) || 'Имя Фамилия';
  const bio = normalizeText(profile.bio) || 'Биография разработчика.';
  const photo = normalizeText(profile.photo);

  els.developerName.textContent = name;
  els.developerBio.textContent = bio;

  if(photo){
    els.developerPhotoPreview.innerHTML = '<img src="./' + escapeHtml(photo) + '" alt="Фото разработчика">';
  }else{
    const letter = name.trim().charAt(0).toUpperCase() || '1:1';
    els.developerPhotoPreview.innerHTML = '<span>' + escapeHtml(letter) + '</span>';
  }
}

function renderThemes(){
  const themes = Array.isArray(data.themes) ? data.themes : [];
  els.themeCount.textContent = themes.length;
  els.themesList.innerHTML = '';

  if(themes.length === 0){
    els.themesList.innerHTML = '<div class="empty"><h3>Тем пока нет</h3><p>В этом портфолио пока нет проектов.</p></div>';
    els.currentThemeTitle.textContent = 'Выберите тему';
    els.currentThemeSubtitle.textContent = 'Тем пока нет.';
    els.projectsContainer.innerHTML = '<div class="empty"><h3>Нет тем</h3><p>Добавьте хотя бы одну тему в админской части, затем экспортируйте сайт снова.</p></div>';
    els.projectCount.textContent = '0';
    return;
  }

  themes.forEach(theme => {
    const item = document.createElement('div');
    item.className = 'theme-item' + (theme.id === activeThemeId ? ' active' : '');
    item.innerHTML = '<strong>' + escapeHtml(theme.name || 'Без названия') + '</strong><span>' + (Array.isArray(theme.projects) ? theme.projects.length : 0) + ' проект(ов)</span>';
    item.addEventListener('click', () => {
      activeThemeId = theme.id;
      render();
    });
    els.themesList.appendChild(item);
  });
}

function renderProjects(){
  const theme = getActiveTheme();
  if(!theme){
    els.currentThemeTitle.textContent = 'Выберите тему';
    els.currentThemeSubtitle.textContent = 'Откройте тему слева.';
    els.projectsContainer.innerHTML = '<div class="empty"><h3>Нет тем</h3><p>В этом портфолио пока нет проектов.</p></div>';
    els.projectCount.textContent = '0';
    return;
  }

  const projects = getFilteredProjects(Array.isArray(theme.projects) ? theme.projects : [])
    .slice()
    .sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  els.currentThemeTitle.textContent = theme.name || 'Без названия';
  els.currentThemeSubtitle.textContent = 'Проекты выбранной темы.';
  els.projectCount.textContent = projects.length;

  if(projects.length === 0){
    els.projectsContainer.innerHTML = '<div class="empty"><h3>Ничего не найдено</h3><p>Измените запрос поиска или выберите другую тему.</p></div>';
    return;
  }

  els.projectsContainer.innerHTML = '';
  projects.forEach(project => {
    const card = document.createElement('article');
    card.className = 'card';

    const cover = normalizeText(project.cover);
    const coverHtml = cover
      ? '<img src="./' + escapeHtml(cover) + '" alt="' + escapeHtml(project.title || 'Проект') + '">'
      : '<div class="fallback">' + escapeHtml((project.title || 'P').slice(0,1).toUpperCase()) + '</div>';

    card.innerHTML = \`
      <div class="cover">\${coverHtml}</div>
      <div class="card-body">
        <div class="card-title">
          <h3>\${escapeHtml(project.title || 'Без названия')}</h3>
        </div>
        \${project.description ? '<div class="desc">' + escapeHtml(project.description) + '</div>' : ''}
        \${project.additional ? '<div class="pill">Дополнительно: ' + escapeHtml(project.additional) + '</div>' : ''}
        <div class="card-links">
          \${project.link ? '<a class="link-btn" href="' + escapeHtml(project.link) + '" target="_blank" rel="noopener noreferrer">Открыть проект ↗</a>' : ''}
        </div>
      </div>
    \`;

    els.projectsContainer.appendChild(card);
  });
}

function render(){
  renderDeveloperProfile();
  renderThemes();
  renderProjects();
}

els.searchInput.addEventListener('input', e => {
  searchQuery = e.target.value;
  renderProjects();
});

data = window.__PORTFOLIO_DATA__ || data;
activeThemeId = data.themes[0]?.id || null;
render();
`;

    if (data.developerProfile?.photo) {
      const sourceAbs = path.join(getAppDataDir(), data.developerProfile.photo);
      const targetAbs = path.join(exportDir, data.developerProfile.photo);
      await fsp.mkdir(path.dirname(targetAbs), { recursive: true }).catch(() => { });
      await fsp.copyFile(sourceAbs, targetAbs).catch(() => { });
    }
    const faviconSvgSource = path.join(__dirname, 'favicon.svg');
    const faviconPngSource = path.join(__dirname, 'favicon.png');
    const faviconIcoSource = path.join(__dirname, 'favicon.ico');

    await fsp.copyFile(faviconSvgSource, path.join(exportDir, 'favicon.svg')).catch(() => { });
    await fsp.copyFile(faviconPngSource, path.join(exportDir, 'favicon.png')).catch(() => { });
    await fsp.copyFile(faviconIcoSource, path.join(exportDir, 'favicon.ico')).catch(() => { });

    await fsp.writeFile(path.join(exportDir, 'index.html'), siteHtml, 'utf8');
    await fsp.writeFile(path.join(exportDir, 'styles.css'), siteCss, 'utf8');
    await fsp.writeFile(path.join(exportDir, 'script.js'), siteScript, 'utf8');
    await fsp.writeFile(path.join(exportDir, 'data.json'), JSON.stringify(exportData, null, 2), 'utf8');

    return {
      ok: true,
      message: `Сайт экспортирован в папку: ${exportDir}`
    };
  } catch (err) {
    console.error(err);
    return {
      ok: false,
      message: 'Не удалось экспортировать сайт.'
    };
  }
});

app.whenReady().then(async () => {
  await ensureStorage();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});