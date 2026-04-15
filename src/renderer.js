const state = {
  themes: [],
  activeThemeId: null,
  projectSearch: '',
  editingProjectId: null,
  themeModalMode: 'create',
  selectedCoverSourcePath: '',
  selectedCoverPreviewUrl: '',
  developerProfile: {
    name: '',
    bio: '',
    photo: '',
    photoUrl: ''
  },
  selectedDeveloperPhotoSourcePath: '',
  selectedDeveloperPhotoPreviewUrl: ''
};

const els = {
  themesList: document.getElementById('themesList'),
  currentThemeTitle: document.getElementById('currentThemeTitle'),
  currentThemeSubtitle: document.getElementById('currentThemeSubtitle'),
  projectsContainer: document.getElementById('projectsContainer'),
  addThemeBtn: document.getElementById('addThemeBtn'),
  addProjectBtn: document.getElementById('addProjectBtn'),
  renameThemeBtn: document.getElementById('renameThemeBtn'),
  deleteThemeBtn: document.getElementById('deleteThemeBtn'),
  exportBtn: document.getElementById('exportBtn'),
  openExportFolderBtn: document.getElementById('openExportFolderBtn'),
  searchInput: document.getElementById('searchInput'),
  themeCount: document.getElementById('themeCount'),
  projectCount: document.getElementById('projectCount'),
  themeModal: document.getElementById('themeModal'),
  projectModal: document.getElementById('projectModal'),
  themeNameInput: document.getElementById('themeNameInput'),
  saveThemeBtn: document.getElementById('saveThemeBtn'),
  themeModalTitle: document.getElementById('themeModalTitle'),
  projectModalTitle: document.getElementById('projectModalTitle'),
  projectTitle: document.getElementById('projectTitle'),
  projectDescription: document.getElementById('projectDescription'),
  projectLink: document.getElementById('projectLink'),
  projectAdditional: document.getElementById('projectAdditional'),
  pickCoverBtn: document.getElementById('pickCoverBtn'),
  coverFileName: document.getElementById('coverFileName'),
  coverPreview: document.getElementById('coverPreview'),
  saveProjectBtn: document.getElementById('saveProjectBtn'),
  clearProjectFormBtn: document.getElementById('clearProjectFormBtn'),
  toast: document.getElementById('toast'),
  developerNameInput: document.getElementById('developerNameInput'),
  developerBioInput: document.getElementById('developerBioInput'),
  developerPhotoPreview: document.getElementById('developerPhotoPreview'),
  developerPhotoFileName: document.getElementById('developerPhotoFileName'),
  pickDeveloperPhotoBtn: document.getElementById('pickDeveloperPhotoBtn'),
  saveDeveloperProfileBtn: document.getElementById('saveDeveloperProfileBtn'),
};

function uid() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => els.toast.classList.remove('show'), 2400);
}

function getActiveTheme() {
  return state.themes.find(t => t.id === state.activeThemeId) || null;
}

function normalizeUrl(url) {
  const value = (url || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return 'https://' + value;
}

function closeAllModals() {
  els.themeModal.classList.remove('open');
  els.projectModal.classList.remove('open');
  state.editingProjectId = null;
  clearProjectForm();
}


function clearProjectForm() {
  els.projectTitle.value = '';
  els.projectDescription.value = '';
  els.projectLink.value = '';
  els.projectAdditional.value = '';
  els.coverPreview.innerHTML = '<span>Предпросмотр обложки</span>';
  els.coverFileName.textContent = 'Файл не выбран';
  state.selectedCoverSourcePath = '';
  state.selectedCoverPreviewUrl = '';
}

function syncDeveloperProfileForm() {
  els.developerNameInput.value = state.developerProfile.name || '';
  els.developerBioInput.value = state.developerProfile.bio || '';

  const photoSrc = state.selectedDeveloperPhotoPreviewUrl || state.developerProfile.photoUrl || '';
  if (photoSrc) {
    els.developerPhotoPreview.innerHTML = `<img src="${photoSrc}" alt="Фото разработчика">`;
  } else {
    els.developerPhotoPreview.innerHTML = '<span>1:1</span>';
  }

  if (state.selectedDeveloperPhotoSourcePath) {
    els.developerPhotoFileName.textContent = state.selectedDeveloperPhotoSourcePath.split(/[\\/]/).pop();
  } else if (state.developerProfile.photo) {
    els.developerPhotoFileName.textContent = state.developerProfile.photo.split(/[\\/]/).pop();
  } else {
    els.developerPhotoFileName.textContent = 'Фото не выбрано';
  }
}

async function flushCurrentStateToDisk() {
  state.developerProfile.name = els.developerNameInput.value.trim();
  state.developerProfile.bio = els.developerBioInput.value.trim();

  if (state.selectedDeveloperPhotoSourcePath) {
    const result = await window.api.copyDeveloperPhoto(state.selectedDeveloperPhotoSourcePath);
    if (result?.ok && result.photo) {
      state.developerProfile.photo = result.photo;
      state.developerProfile.photoUrl = '';
    }
  }

  const projectModalOpen = els.projectModal.classList.contains('open');
  const projectDirty = [
    els.projectTitle.value,
    els.projectDescription.value,
    els.projectLink.value,
    els.projectAdditional.value,
    state.selectedCoverSourcePath
  ].some(value => String(value || '').trim() !== '');

  if (projectModalOpen && projectDirty) {
    await saveProject();
    return;
  }

  await saveData();
}

async function loadData() {
  try {
    const data = await window.api.loadPortfolio();
    state.themes = Array.isArray(data?.themes) ? data.themes : [];

    state.developerProfile = {
      name: data?.developerProfile?.name || '',
      bio: data?.developerProfile?.bio || '',
      photo: data?.developerProfile?.photo || '',
      photoUrl: data?.developerProfile?.photoUrl || ''
    };

    state.selectedDeveloperPhotoSourcePath = '';
    state.selectedDeveloperPhotoPreviewUrl = '';
    syncDeveloperProfileForm();

    if (!state.activeThemeId) {
      state.activeThemeId = state.themes[0]?.id || null;
    } else if (!state.themes.find(t => t.id === state.activeThemeId)) {
      state.activeThemeId = state.themes[0]?.id || null;
    }

    render();
  } catch (err) {
    console.error(err);
    showToast('Не удалось загрузить данные.');
  }
}

async function saveData() {
  await window.api.savePortfolio({
    developerProfile: {
      name: state.developerProfile.name,
      bio: state.developerProfile.bio,
      photo: state.developerProfile.photo
    },
    themes: state.themes.map(theme => ({
      id: theme.id,
      name: theme.name,
      createdAt: theme.createdAt,
      projects: theme.projects.map(project => ({
        id: project.id,
        title: project.title,
        description: project.description,
        link: project.link,
        additional: project.additional,
        cover: project.cover || '',
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      }))
    }))
  });
}

function openThemeModal(mode = 'create') {
  closeAllModals();

  state.themeModalMode = mode;
  els.themeModal.classList.add('open');
  els.themeNameInput.value = mode === 'edit' ? getActiveTheme()?.name || '' : '';
  els.themeModalTitle.textContent = mode === 'edit' ? 'Переименовать тему' : 'Создать тему';
  els.saveThemeBtn.textContent = mode === 'edit' ? 'Сохранить название' : 'Сохранить тему';

  requestAnimationFrame(() => {
    els.themeNameInput.focus();
  });
}

function closeThemeModal() {
  els.themeModal.classList.remove('open');
  els.themeNameInput.value = '';
  requestAnimationFrame(() => els.addThemeBtn.focus());
}


function openProjectModal(mode = 'create', project = null) {
  closeAllModals();

  state.editingProjectId = project?.id || null;
  els.projectModal.classList.add('open');
  els.projectModalTitle.textContent = mode === 'edit' ? 'Редактировать проект' : 'Создать проект';
  els.saveProjectBtn.textContent = mode === 'edit' ? 'Сохранить изменения' : 'Создать карточку проекта';

  state.selectedCoverSourcePath = '';
  state.selectedCoverPreviewUrl = '';

  if (project) {
    els.projectTitle.value = project.title || '';
    els.projectDescription.value = project.description || '';
    els.projectLink.value = project.link || '';
    els.projectAdditional.value = project.additional || '';

    if (project.coverUrl || project.cover) {
      const coverSrc = project.coverUrl || project.cover;
      els.coverPreview.innerHTML = `<img src="${coverSrc}" alt="Обложка проекта">`;
      els.coverFileName.textContent = project.cover ? project.cover.split(/[\\/]/).pop() : 'Файл выбран';
    } else {
      els.coverPreview.innerHTML = '<span>Предпросмотр обложки</span>';
      els.coverFileName.textContent = 'Файл не выбран';
    }
  } else {
    clearProjectForm();
  }

  requestAnimationFrame(() => {
    els.projectTitle.focus();
  });
}

function closeProjectModal() {
  els.projectModal.classList.remove('open');
  state.editingProjectId = null;
  clearProjectForm();
  requestAnimationFrame(() => els.addProjectBtn.focus());
}
function setActiveTheme(themeId) {
  state.activeThemeId = themeId;
  render();
}

function createTheme(name) {
  const theme = {
    id: uid(),
    name: name.trim(),
    projects: [],
    createdAt: new Date().toISOString()
  };

  state.themes.push(theme);
  state.activeThemeId = theme.id;

  saveData().then(() => {
    render();
    showToast('Тема создана.');
  });
}

function renameTheme(themeId, newName) {
  const theme = state.themes.find(t => t.id === themeId);
  if (!theme) return;

  theme.name = newName.trim();
  saveData().then(() => {
    render();
    showToast('Название темы обновлено.');
  });
}

async function deleteTheme(themeId) {
  const theme = state.themes.find(t => t.id === themeId);
  if (!theme) return;

  const ok = await window.api.confirmDelete({
    type: 'тему',
    name: theme.name
  });

  if (!ok) {
    requestAnimationFrame(() => els.addThemeBtn.focus());
    return;
  }

  state.themes = state.themes.filter(t => t.id !== themeId);
  if (state.activeThemeId === themeId) {
    state.activeThemeId = state.themes[0]?.id || null;
  }

  await saveData();
  render();
  showToast('Тема удалена.');

  requestAnimationFrame(() => {
    const target = els.addProjectBtn.disabled ? els.addThemeBtn : els.addProjectBtn;
    target.focus();
  });
}

async function deleteProject(projectId) {
  const theme = getActiveTheme();
  if (!theme) return;

  const project = theme.projects.find(p => p.id === projectId);
  if (!project) return;

  const ok = await window.api.confirmDelete({
    type: 'проект',
    name: project.title
  });

  if (!ok) {
    requestAnimationFrame(() => els.addProjectBtn.focus());
    return;
  }

  theme.projects = theme.projects.filter(p => p.id !== projectId);

  await saveData();
  render();
  showToast('Проект удалён.');

  requestAnimationFrame(() => els.addProjectBtn.focus());
}

function editProject(projectId) {
  const theme = getActiveTheme();
  if (!theme) return;

  const project = theme.projects.find(p => p.id === projectId);
  if (!project) return;

  openProjectModal('edit', project);
}

function getFilteredProjects(theme) {
  const q = state.projectSearch.trim().toLowerCase();
  if (!q) return theme.projects;

  return theme.projects.filter(p => {
    const blob = [p.title, p.description, p.additional].join(' ').toLowerCase();
    return blob.includes(q);
  });
}

function renderThemes() {
  els.themesList.innerHTML = '';
  els.themeCount.textContent = state.themes.length;

  if (state.themes.length === 0) {
    els.themesList.innerHTML = `
      <div class="empty" style="min-height:auto;padding:18px;border-radius:18px">
        <h3>Тем ещё нет</h3>
        <p>Нажмите “+ Создать тему”, чтобы добавить первое направление.</p>
      </div>
    `;
    return;
  }

  state.themes.forEach(theme => {
    const item = document.createElement('div');
    item.className = 'theme-item' + (theme.id === state.activeThemeId ? ' active' : '');
    item.innerHTML = `
      <div class="theme-name">
        <strong title="${escapeHtml(theme.name)}">${escapeHtml(theme.name)}</strong>
        <span>${theme.projects.length} проект(ов)</span>
      </div>
      <div class="theme-meta">#${theme.projects.length}</div>
    `;
    item.addEventListener('click', () => setActiveTheme(theme.id));
    els.themesList.appendChild(item);
  });
}

function renderProjects() {
  const theme = getActiveTheme();
  els.projectCount.textContent = theme ? theme.projects.length : '0';

  const hasTheme = !!theme;
  els.addProjectBtn.disabled = !hasTheme;
  els.renameThemeBtn.disabled = !hasTheme;
  els.deleteThemeBtn.disabled = !hasTheme;
  els.searchInput.disabled = !hasTheme;

  if (!hasTheme) {
    els.currentThemeTitle.textContent = 'Выберите тему';
    els.currentThemeSubtitle.textContent = 'Создайте тему слева, чтобы начать собирать проекты.';
    els.projectsContainer.innerHTML = `
      <div class="empty">
        <h3>Пока ничего не создано</h3>
        <p>Слева нажмите “+ Создать тему”, затем внутри темы создавайте карточки проектов.</p>
        <button class="btn primary" id="emptyCreateThemeBtn">+ Создать тему</button>
      </div>
    `;
    const btn = document.getElementById('emptyCreateThemeBtn');
    if (btn) btn.addEventListener('click', () => openThemeModal('create'));
    return;
  }

  els.currentThemeTitle.textContent = theme.name;
  els.currentThemeSubtitle.textContent = `Карточки в теме: ${theme.projects.length}. Данные сохраняются локально в приложении.`;

  const projects = getFilteredProjects(theme);

  if (projects.length === 0) {
    els.projectsContainer.innerHTML = `
      <div class="empty">
        <h3>Проектов пока нет</h3>
        <p>${state.projectSearch.trim() ? 'По вашему поиску ничего не найдено.' : 'Нажмите “Создать проект”, чтобы добавить первую карточку в эту тему.'}</p>
        <button class="btn primary" id="emptyCreateProjectBtn" ${state.projectSearch.trim() ? 'style="display:none"' : ''}>Создать проект</button>
      </div>
    `;
    const btn = document.getElementById('emptyCreateProjectBtn');
    if (btn) btn.addEventListener('click', () => openProjectModal('create'));
    return;
  }

  els.projectsContainer.innerHTML = '';

  projects
    .slice()
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .forEach(project => {
      const card = document.createElement('article');
      card.className = 'card';

      const coverSource = project.coverUrl || '';
      const coverHtml = coverSource
        ? `<img src="${coverSource}" alt="${escapeHtml(project.title)}">`
        : `<div class="fallback">${escapeHtml((project.title || 'P').slice(0, 1).toUpperCase())}</div>`;
      card.innerHTML = `
        <div class="cover">${coverHtml}</div>
        <div class="card-body">
          <div class="card-title">
            <h3>${escapeHtml(project.title)}</h3>
            <div class="menu">
              <button class="btn small" data-action="edit">Редактировать</button>
              <button class="btn small danger" data-action="delete">Удалить</button>
            </div>
          </div>

          ${project.description ? `<div class="desc">${escapeHtml(project.description)}</div>` : ''}
          ${project.additional ? `<div class="pill">Дополнительно: ${escapeHtml(project.additional)}</div>` : ''}

          <div class="card-links">
            ${project.link ? `<button class="link-btn" data-link="${escapeHtml(normalizeUrl(project.link))}">Открыть проект ↗</button>` : ''}
            <span class="pill">Создано: ${new Date(project.createdAt).toLocaleDateString('ru-RU')}</span>
          </div>
        </div>
      `;

      const linkBtn = card.querySelector('[data-link]');
      if (linkBtn) {
        linkBtn.addEventListener('click', () => {
          window.api.openExternal(linkBtn.dataset.link);
        });
      }

      card.querySelector('[data-action="edit"]').addEventListener('click', () => editProject(project.id));
      card.querySelector('[data-action="delete"]').addEventListener('click', () => deleteProject(project.id));
      els.projectsContainer.appendChild(card);
    });
}

function render() {
  renderThemes();
  renderProjects();
}

async function handleCoverSelection() {
  const filePath = await window.api.pickImage();
  if (!filePath) return;

  state.selectedCoverSourcePath = filePath;

  const fileName = filePath.split(/[\\/]/).pop();
  els.coverFileName.textContent = fileName;

  const previewSrc = encodeURI(`file:///${filePath.replace(/\\/g, '/')}`);
  state.selectedCoverPreviewUrl = previewSrc;
  els.coverPreview.innerHTML = `<img src="${previewSrc}" alt="Предпросмотр обложки">`;
}
async function saveProject() {
  const theme = getActiveTheme();
  if (!theme) {
    showToast('Сначала создайте тему.');
    return;
  }

  const title = els.projectTitle.value.trim();
  const description = els.projectDescription.value.trim();
  const link = normalizeUrl(els.projectLink.value);
  const additional = els.projectAdditional.value.trim();

  if (!title) {
    showToast('Заполните название проекта.');
    els.projectTitle.focus();
    return;
  }

  const now = new Date().toISOString();
  const editing = !!state.editingProjectId;
  const existing = editing ? theme.projects.find(p => p.id === state.editingProjectId) : null;

  const project = existing || {
    id: uid(),
    createdAt: now,
    cover: ''
  };

  project.title = title;
  project.description = description;
  project.link = link;
  project.additional = additional;
  project.updatedAt = now;

  try {
    if (state.selectedCoverSourcePath) {
      const result = await window.api.copyCover({
        sourcePath: state.selectedCoverSourcePath,
        projectId: project.id
      });

      if (result?.ok && result.cover) {
        project.cover = result.cover;
        project.coverUrl = '';
      }
    }
  } catch (err) {
    console.error(err);
    showToast('Обложка не сохранилась, но проект будет сохранён без неё.');
  }

  if (!existing) {
    theme.projects.push(project);
    showToast('Карточка проекта создана.');
  } else {
    existing.title = project.title;
    existing.description = project.description;
    existing.link = project.link;
    existing.additional = project.additional;
    existing.cover = project.cover || existing.cover;
    existing.updatedAt = now;
    existing.coverUrl = project.coverUrl || existing.coverUrl || '';
    showToast('Карточка проекта обновлена.');
  }

  await saveData();
  await loadData();
  closeProjectModal();
}

async function exportSite() {
  try {
    const result = await window.api.exportSite();
    if (result?.ok) {
      showToast(result.message || 'Сайт экспортирован.');
    } else {
      showToast(result?.message || 'Не удалось экспортировать сайт.');
    }
  } catch (err) {
    console.error(err);
    showToast('Ошибка при экспорте сайта.');
  }
}



els.addThemeBtn.addEventListener('click', () => openThemeModal('create'));
els.addProjectBtn.addEventListener('click', () => openProjectModal('create'));
els.renameThemeBtn.addEventListener('click', () => {
  const theme = getActiveTheme();
  if (!theme) return;
  els.themeNameInput.value = theme.name;
  openThemeModal('edit');
});
els.deleteThemeBtn.addEventListener('click', () => {
  const theme = getActiveTheme();
  if (theme) deleteTheme(theme.id);
});
els.exportBtn.addEventListener('click', async () => {
  try {
    await flushCurrentStateToDisk();
    await window.api.exportSite();
    showToast('Сайт экспортирован.');
  } catch (err) {
    console.error(err);
    showToast('Ошибка при экспорте сайта.');
  }
});

els.openExportFolderBtn.addEventListener('click', async () => {
  try {
    const result = await window.api.openExportFolder();
    if (!result?.ok) {
      showToast('Папка с итоговым сайтом не найдена.');
    } else {
      showToast('Папка с итоговым сайтом открыта.');
    }
  } catch (err) {
    console.error(err);
    showToast('Не удалось открыть папку.');
  }
});

els.developerNameInput.addEventListener('input', e => {
  state.developerProfile.name = e.target.value;
});

els.developerBioInput.addEventListener('input', e => {
  state.developerProfile.bio = e.target.value;
});

els.pickDeveloperPhotoBtn.addEventListener('click', async () => {
  try {
    const filePath = await window.api.pickImage();
    if (!filePath) return;

    state.selectedDeveloperPhotoSourcePath = filePath;
    state.selectedDeveloperPhotoPreviewUrl = encodeURI(`file:///${filePath.replace(/\\/g, '/')}`);
    syncDeveloperProfileForm();
    showToast('Фото выбрано.');
  } catch (err) {
    console.error(err);
    showToast('Не удалось выбрать фото.');
  }
});

els.saveDeveloperProfileBtn.addEventListener('click', async () => {
  try {
    await flushCurrentStateToDisk();
    await loadData();

    state.selectedDeveloperPhotoSourcePath = '';
    state.selectedDeveloperPhotoPreviewUrl = '';
    syncDeveloperProfileForm();

    showToast('Профиль разработчика сохранён.');
  } catch (err) {
    console.error(err);
    showToast('Не удалось сохранить профиль разработчика.');
  }
});

els.saveThemeBtn.addEventListener('click', () => {
  const name = els.themeNameInput.value.trim();
  if (!name) {
    showToast('Введите название темы.');
    els.themeNameInput.focus();
    return;
  }

  if (state.themeModalMode === 'edit') {
    const theme = getActiveTheme();
    if (theme) renameTheme(theme.id, name);
  } else {
    createTheme(name);
  }

  closeThemeModal();
});

els.saveProjectBtn.addEventListener('click', saveProject);
els.clearProjectFormBtn.addEventListener('click', () => {
  state.editingProjectId = null;
  clearProjectForm();
});

els.pickCoverBtn.addEventListener('click', async () => {
  try {
    await handleCoverSelection();
    showToast('Обложка загружена.');
  } catch (err) {
    console.error(err);
    showToast('Не удалось загрузить изображение.');
  }
});

document.querySelectorAll('[data-close-theme-modal]').forEach(btn => {
  btn.addEventListener('click', closeThemeModal);
});

document.querySelectorAll('[data-close-project-modal]').forEach(btn => {
  btn.addEventListener('click', closeProjectModal);
});

els.searchInput.addEventListener('input', e => {
  state.projectSearch = e.target.value;
  renderProjects();
});

[els.themeModal, els.projectModal].forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.classList.remove('open');
      if (modal === els.themeModal) closeThemeModal();
      if (modal === els.projectModal) closeProjectModal();
    }
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeThemeModal();
    closeProjectModal();
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (!els.searchInput.disabled) els.searchInput.focus();
  }
});

loadData();

window.api.onBeforeClose(async () => {
  try {
    await flushCurrentStateToDisk();
    await window.api.quitAfterSave();
  } catch (err) {
    console.error(err);
    await window.api.quitAfterSave();
  }
});