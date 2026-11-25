import { CATALOG, CATEGORIES, ADVENT_CALENDAR } from './catalog.js';

(() => {
  'use strict';

  const STORAGE_KEYS = {
    favorites: 'pelisstart_favorites_v1',
    history: 'pelisstart_history_v1',
    progress: 'pelisstart_progress_v1',
    lang: 'pelisstart_lang_v1',
    source: 'pelisstart_source_v1',
    provider: 'pelisstart_provider_v1',
    advent: 'pelisstart_advent_v1',
  };

  const state = {
    section: 'all', // 'all' | 'movie' | 'serial' | 'discover' | 'favorites'
    category: 'Todas',
    sort: 'featured',
    discoverKind: 'trending', // 'trending' | 'top'
    searchQuery: '',
    defaultLang: localStorage.getItem(STORAGE_KEYS.lang) ?? 'latino',
    sourceFilter: 'all',
    defaultProvider: localStorage.getItem(STORAGE_KEYS.provider) || '',
    favorites: new Set(loadJson(STORAGE_KEYS.favorites, [])),
    history: loadJson(STORAGE_KEYS.history, []),
    progress: loadJson(STORAGE_KEYS.progress, {}),
    openedAdventDays: new Set(loadJson(STORAGE_KEYS.advent, [])),
    customItemsById: new Map(),
    discoverItems: [],
    discoverSources: [],
    discoverSearchOnly: false,
    isLoadingDiscover: false,
    page: 1,
    totalPages: 1,
    remoteResults: [],
    remoteSources: [],
    isSearchingRemote: false,
    providers: [],
    apiStatus: null,
    heroItems: CATALOG.filter((item) => item.featured),
    heroIndex: 0,
    heroTimer: null,
    modal: {
      item: null,
      mode: 'standard', // 'standard' | 'download' | 'trailer'
      embedApi: 'playlatinsrc', // 'playlatinsrc' | 'embed69'
      lang: 'latino',
      season: 1,
      episode: 1,
      episodeSelected: false,
      provider: '',
      tmdbId: '',
      trailerYt: '',
      episodesData: null,
      activeSeason: 1,
    },
  };

  const dom = {
    navbar: document.getElementById('navbar'),
    brandHomeBtn: document.getElementById('brandHomeBtn'),
    navLinks: Array.from(document.querySelectorAll('.nav-link')),
    favCountBadge: document.getElementById('favCountBadge'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    mobileMenuBtn: document.getElementById('mobileMenuBtn'),
    mobileMenu: document.getElementById('mobileMenu'),
    mobileSearchInput: document.getElementById('mobileSearchInput'),
    hamburgerCategories: document.getElementById('hamburgerCategories'),
    globalSourceSelect: document.getElementById('globalSourceSelect'),
    globalLangSelect: document.getElementById('globalLangSelect'),
    apiSettingsBtn: document.getElementById('apiSettingsBtn'),
    apiStatusDot: document.getElementById('apiStatusDot'),
    toastContainer: document.getElementById('toastContainer'),

    heroSection: document.getElementById('heroSection'),
    heroBackdrop: document.getElementById('heroBackdrop'),
    heroTypeBadge: document.getElementById('heroTypeBadge'),
    heroTitle: document.getElementById('heroTitle'),
    heroRating: document.getElementById('heroRating'),
    heroYear: document.getElementById('heroYear'),
    heroDuration: document.getElementById('heroDuration'),
    heroCategories: document.getElementById('heroCategories'),
    heroSynopsis: document.getElementById('heroSynopsis'),
    heroPlayBtn: document.getElementById('heroPlayBtn'),
    heroFavBtn: document.getElementById('heroFavBtn'),
    heroDots: document.getElementById('heroDots'),

    categoryRail: document.getElementById('categoryRail'),
    categorySelect: document.getElementById('categorySelect'),
    discoverKindWrap: document.getElementById('discoverKindWrap'),
    sortSelect: document.getElementById('sortSelect'),
    catalogContainer: document.getElementById('catalogContainer'),

    playerModal: document.getElementById('playerModal'),
    modalBackdrop: document.getElementById('modalBackdrop'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    modalTypeBadge: document.getElementById('modalTypeBadge'),
    modalTitle: document.getElementById('modalTitle'),
    resumeBtn: document.getElementById('resumeBtn'),
    trailerToggleBtn: document.getElementById('trailerToggleBtn'),
    modalFavBtn: document.getElementById('modalFavBtn'),
    embedApiSelect: document.getElementById('embedApiSelect'),
    modalLangGroup: document.getElementById('modalLangGroup'),
    modalLangTabs: document.getElementById('modalLangTabs'),
    modalModeGroup: document.getElementById('modalModeGroup'),
    modalModeTabs: document.getElementById('modalModeTabs'),
    downloadModeBtn: document.getElementById('downloadModeBtn'),
    customOptionsBar: document.getElementById('customOptionsBar'),
    episodePicker: document.getElementById('episodePicker'),
    seasonInput: document.getElementById('seasonInput'),
    episodeInput: document.getElementById('episodeInput'),
    providerWrap: document.getElementById('providerWrap'),
    providerSelect: document.getElementById('providerSelect'),
    applyCustomBtn: document.getElementById('applyCustomBtn'),
    embedIframe: document.getElementById('embedIframe'),
    playerTelemetry: document.getElementById('playerTelemetry'),
    telemetryState: document.getElementById('telemetryState'),
    telemetrySource: document.getElementById('telemetrySource'),
    telemetryTime: document.getElementById('telemetryTime'),
    seriesEpisodesPanel: document.getElementById('seriesEpisodesPanel'),
    episodesSourceBadge: document.getElementById('episodesSourceBadge'),
    seasonTabs: document.getElementById('seasonTabs'),
    episodesGrid: document.getElementById('episodesGrid'),
    modalPoster: document.getElementById('modalPoster'),
    modalMetaRow: document.getElementById('modalMetaRow'),
    modalRatingsRow: document.getElementById('modalRatingsRow'),
    modalSynopsis: document.getElementById('modalSynopsis'),
    modalCredits: document.getElementById('modalCredits'),

    apiModal: document.getElementById('apiModal'),
    apiModalBackdrop: document.getElementById('apiModalBackdrop'),
    closeApiModalBtn: document.getElementById('closeApiModalBtn'),
    apiConfigForm: document.getElementById('apiConfigForm'),
    tmdbKeyInput: document.getElementById('tmdbKeyInput'),
    omdbKeyInput: document.getElementById('omdbKeyInput'),
    rapidApiKeyInput: document.getElementById('rapidApiKeyInput'),
    rapidApiHostInput: document.getElementById('rapidApiHostInput'),
    tmdbStatusBadge: document.getElementById('tmdbStatusBadge'),
    omdbStatusBadge: document.getElementById('omdbStatusBadge'),
    rapidStatusBadge: document.getElementById('rapidStatusBadge'),
    apiTestOutput: document.getElementById('apiTestOutput'),
    clearApisBtn: document.getElementById('clearApisBtn'),
    testApisBtn: document.getElementById('testApisBtn'),

    adventBtn: document.getElementById('adventBtn'),
    adventModal: document.getElementById('adventModal'),
    adventModalBackdrop: document.getElementById('adventModalBackdrop'),
    closeAdventModalBtn: document.getElementById('closeAdventModalBtn'),
    adventGrid: document.getElementById('adventGrid'),
    adventProgressBadge: document.getElementById('adventProgressBadge'),
    adventRevealAllBtn: document.getElementById('adventRevealAllBtn'),
    adventResetBtn: document.getElementById('adventResetBtn'),
  };

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage quota issues
    }
  }

  function findItemById(id) {
    return (
      CATALOG.find((item) => item.id === id) ||
      ADVENT_CALENDAR.find((item) => item.id === id) ||
      state.customItemsById.get(id) ||
      state.discoverItems.find((item) => item.id === id) ||
      null
    );
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeText(str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function formatSeconds(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const rem = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(rem)}` : `${mins}:${pad(rem)}`;
  }

  /* ==================== Favorites & History ==================== */
  function updateFavBadge() {
    if (!dom.favCountBadge) return;
    const count = state.favorites.size;
    dom.favCountBadge.textContent = String(count);
    dom.favCountBadge.classList.toggle('hidden', count === 0);
  }

  function toggleFavorite(id, itemObj = null) {
    if (itemObj && !CATALOG.some((c) => c.id === id)) {
      state.customItemsById.set(id, itemObj);
    }
    if (state.favorites.has(id)) {
      state.favorites.delete(id);
    } else {
      state.favorites.add(id);
    }
    saveJson(STORAGE_KEYS.favorites, Array.from(state.favorites));
    updateFavBadge();
    renderHero();
    if (state.modal.item && state.modal.item.id === id) {
      syncModalFavBtn();
    }
    renderCatalog();
  }

  function recordHistory(item) {
    if (!item || !item.id) return;
    if (!CATALOG.some((c) => c.id === item.id)) {
      state.customItemsById.set(item.id, item);
    }
    const filtered = state.history.filter((entry) => entry.id !== item.id);
    filtered.unshift({
      id: item.id,
      title: item.title,
      type: item.type,
      year: item.year,
      rating: item.rating,
      duration: item.duration,
      poster: item.poster,
      backdrop: item.backdrop,
      categories: item.categories || [],
      synopsis: item.synopsis || '',
      source: item.source || '',
      sources: item.sources || null,
      ts: Date.now(),
    });
    state.history = filtered.slice(0, 12);
    saveJson(STORAGE_KEYS.history, state.history);
  }

  function savePlaybackProgress(id, currentTime, duration) {
    if (!id || !Number.isFinite(currentTime) || currentTime < 5) return;
    state.progress[id] = {
      time: Math.floor(currentTime),
      duration: Number.isFinite(duration) ? Math.floor(duration) : 0,
      updatedAt: Date.now(),
    };
    saveJson(STORAGE_KEYS.progress, state.progress);
  }

  /* ==================== Hero Spotlight ==================== */
  function syncHeroItems() {
    if (state.sourceFilter !== 'all' && state.sourceFilter !== 'local' && state.discoverItems.length > 0) {
      const candidates = state.discoverItems.filter((item) => item.backdrop || item.poster).slice(0, 6);
      if (candidates.length > 0) {
        state.heroItems = candidates;
        state.heroIndex = 0;
        renderHero();
        return;
      }
    }
    state.heroItems = CATALOG.filter((item) => item.featured);
    state.heroIndex = 0;
    renderHero();
  }

  function renderHero() {
    const items = state.heroItems;
    if (!items.length) return;
    const item = items[state.heroIndex % items.length];

    const bg = item.backdrop || item.poster;
    dom.heroBackdrop.style.backgroundImage = bg ? `url("${bg}")` : 'none';
    dom.heroTypeBadge.textContent = item.type === 'serial' ? 'Serie' : 'Película';
    dom.heroTitle.textContent = item.title;
    dom.heroRating.textContent = item.rating ? `★ ${item.rating}` : '★ Destacado';
    dom.heroYear.textContent = item.year || '';
    dom.heroDuration.textContent = item.duration || '';
    dom.heroCategories.textContent = (item.categories || []).filter((c) => c !== 'Tendencias').join(' · ');
    dom.heroSynopsis.textContent = item.synopsis || '';

    const isFav = state.favorites.has(item.id);
    dom.heroFavBtn.classList.toggle('is-saved', isFav);
    dom.heroFavBtn.querySelector('span').textContent = isFav ? 'En Mi Lista' : 'Mi Lista';

    dom.heroDots.innerHTML = items
      .map(
        (_, idx) =>
          `<button type="button" class="hero-dot ${idx === state.heroIndex ? 'active' : ''}" data-hero-dot="${idx}" aria-label="Destacado ${idx + 1}"></button>`
      )
      .join('');
  }

  function startHeroRotation() {
    stopHeroRotation();
    state.heroTimer = setInterval(() => {
      if (!dom.playerModal.classList.contains('hidden')) return;
      state.heroIndex = (state.heroIndex + 1) % state.heroItems.length;
      renderHero();
    }, 7500);
  }

  function stopHeroRotation() {
    if (state.heroTimer) {
      clearInterval(state.heroTimer);
      state.heroTimer = null;
    }
  }

  /* ==================== Category Rail, Select & Hamburger List ==================== */
  function renderCategoryRail() {
    const snowSvg = `
      <svg class="cat-snow-cap" preserveAspectRatio="none" viewBox="0 0 100 14" fill="none" aria-hidden="true">
        <path d="M2 11C12 2 32 1 52 5C72 9 86 2 98 11C84 13 64 10 46 12C28 14 12 12 2 11Z" fill="#f8fafc"/>
      </svg>`;

    const pillsHtml = CATEGORIES.map((cat) => {
      const active = cat.id === state.category;
      const prefix = cat.id === 'Navidad' ? '🎄 ' : '';
      return `<button type="button" role="tab" aria-selected="${active}" class="cat-pill ${active ? 'active' : ''}" data-category="${escapeHtml(cat.id)}">${active ? snowSvg : ''}${prefix}${escapeHtml(cat.label)}</button>`;
    }).join('');

    if (dom.categoryRail) {
      dom.categoryRail.innerHTML = pillsHtml;
    }

    if (dom.hamburgerCategories) {
      dom.hamburgerCategories.innerHTML = CATEGORIES.map((cat) => {
        const active = cat.id === state.category;
        const prefix = cat.id === 'Navidad' ? '🎄 ' : '';
        return `<button type="button" class="cat-pill ${active ? 'active' : ''}" data-category="${escapeHtml(cat.id)}">${prefix}${escapeHtml(cat.label)}</button>`;
      }).join('');
    }

    if (dom.categorySelect) {
      dom.categorySelect.innerHTML = CATEGORIES.map((cat) => {
        const prefix = cat.id === 'Navidad' ? '🎄 ' : '';
        return `<option value="${escapeHtml(cat.id)}">${prefix}${escapeHtml(cat.label)}</option>`;
      }).join('');
      dom.categorySelect.value = state.category;
    }
  }

  /* ==================== Card & Section Builders ==================== */
  function getItemSourcesLabel(item) {
    if (Array.isArray(item.sources) && item.sources.length) return item.sources.join(' · ');
    if (item.source) return item.source;
    return 'Catálogo';
  }

  function createCardHtml(item) {
    const isFav = state.favorites.has(item.id);
    const isSeries = item.type === 'serial';
    const savedProg = state.progress[item.id];
    const sourceLabel = getItemSourcesLabel(item);
    const sourceClass = sourceLabel.includes('TMDB')
      ? 'is-tmdb'
      : sourceLabel === 'Catálogo'
        ? 'is-local'
        : '';
    const metaRight =
      savedProg && savedProg.time > 15
        ? `⏱ ${formatSeconds(savedProg.time)}`
        : item.duration || (isSeries ? 'Serie' : 'Película');

    return `
      <article class="media-card holiday-card" data-open-id="${escapeHtml(item.id)}" data-open-type="${escapeHtml(item.type)}">
        <svg class="card-snow-cap" preserveAspectRatio="none" viewBox="0 0 200 20" fill="none" aria-hidden="true">
          <path d="M4 15C14 3 34 2 52 7C70 12 88 2 110 5C130 8 150 2 172 6C184 8 192 11 196 15C184 18 166 13 148 16C128 19 106 13 84 16C62 19 38 13 20 16C12 17 7 16 4 15Z" fill="#f8fafc"/>
        </svg>
        <svg class="card-holly" viewBox="0 0 40 24" fill="none" aria-hidden="true">
          <path d="M20 12 C14 4, 6 6, 4 13 C9 15, 14 15, 20 12 Z" fill="#15803d"/>
          <path d="M20 12 C26 4, 34 6, 36 13 C31 15, 26 15, 20 12 Z" fill="#166534"/>
          <circle cx="20" cy="11" r="3" fill="#dc2626"/>
          <circle cx="16.5" cy="14" r="2.6" fill="#ef4444"/>
          <circle cx="23.5" cy="14" r="2.6" fill="#ef4444"/>
        </svg>
        <div class="poster-box">
          ${item.poster
        ? `<img src="${escapeHtml(item.poster)}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden');" />
                 <div class="poster-fallback hidden">${escapeHtml(item.title)}</div>`
        : `<div class="poster-fallback">${escapeHtml(item.title)}</div>`
      }
          <div class="card-badges">
            <span class="badge-type ${isSeries ? 'is-series' : ''}">${isSeries ? 'Serie' : 'Película'}</span>
            ${item.rating ? `<span class="badge-rating">★ ${escapeHtml(item.rating)}</span>` : ''}
          </div>
          <span class="card-source-badge ${sourceClass}" title="Origen: ${escapeHtml(sourceLabel)}">${escapeHtml(sourceLabel)}</span>
          <div class="card-hover-play">
            <span class="play-circle" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M8 5.14v14l11-7-11-7z"/>
              </svg>
            </span>
          </div>
          <button type="button" class="card-fav-btn ${isFav ? 'is-fav' : ''}" data-fav-id="${escapeHtml(item.id)}" title="${isFav ? 'Quitar de Mi Lista' : 'Agregar a Mi Lista'}" aria-label="Guardar en Mi Lista">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </button>
        </div>
        <div class="card-body">
          <h3 class="card-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3>
          <div class="card-meta">
            <span>${escapeHtml(item.year || '—')}</span>
            <span>${escapeHtml(metaRight)}</span>
          </div>
        </div>
      </article>
    `;
  }

  function sortItems(items) {
    const arr = [...items];
    if (state.sort === 'year_desc') {
      arr.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
    } else if (state.sort === 'rating_desc') {
      arr.sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
    } else if (state.sort === 'title_asc') {
      arr.sort((a, b) => a.title.localeCompare(b.title, 'es'));
    }
    return arr;
  }

  function parseDirectIdInput(raw) {
    const trimmed = raw.trim();
    const urlMatch = trimmed.match(/playlatinsrc\.co\/(?:custom\/)?(movie|serial)\/(tt\d{5,10}|\d{1,10})/i);
    if (urlMatch) {
      return { id: urlMatch[2].toLowerCase(), type: urlMatch[1].toLowerCase() };
    }
    const imdbMatch = trimmed.match(/^(tt\d{5,10})$/i);
    if (imdbMatch) {
      return { id: imdbMatch[1].toLowerCase(), type: null };
    }
    const tmdbMatch = trimmed.match(/^(\d{2,10})$/);
    if (tmdbMatch) {
      return { id: tmdbMatch[1], type: null, isTmdb: true };
    }
    return null;
  }

  function renderCatalog() {
    const query = state.searchQuery.trim();
    const isBrowseHome = state.section === 'all' && state.category === 'Todas' && !query;
    dom.heroSection.classList.toggle(
      'hidden',
      Boolean(query) || state.section === 'favorites' || state.section === 'discover'
    );
    if (dom.discoverKindWrap) {
      dom.discoverKindWrap.classList.toggle('hidden', state.section !== 'discover' || Boolean(query));
    }

    // Home view: horizontal carousels (History + Live Discover + Categories)
    if (isBrowseHome) {
      const blocks = [];

      if (state.history.length > 0) {
        blocks.push(renderCarouselSection('Seguir viendo', state.history, null, 'history'));
      }

      if (state.sourceFilter !== 'all' && state.sourceFilter !== 'local') {
        if (state.isLoadingDiscover) {
          dom.catalogContainer.innerHTML =
            blocks.join('') +
            `<div class="section-block"><div class="search-status"><span class="spinner" aria-hidden="true"></span><span>Cargando títulos desde ${escapeHtml(state.sourceFilter)}...</span></div></div>`;
          return;
        }
        if (state.discoverSearchOnly) {
          dom.catalogContainer.innerHTML =
            blocks.join('') +
            `<div class="empty-state"><h3>Fuente seleccionada: ${escapeHtml(state.sourceFilter)}</h3><p>Esta API funciona por búsqueda directa. Escribe el título de una película o serie en el buscador superior para consultarla en <strong>${escapeHtml(state.sourceFilter)}</strong>.</p></div>`;
          return;
        }
        const liveItems = sortItems(state.discoverItems);
        if (liveItems.length > 0) {
          blocks.push(`
            <div class="section-block">
              <div class="section-header">
                <div class="section-title-wrap">
                  <h2 class="section-title">Catálogo en vivo · ${escapeHtml(state.sourceFilter)}</h2>
                  <span class="section-count">${liveItems.length} títulos</span>
                  <span class="source-tag">${escapeHtml(state.sourceFilter)}</span>
                </div>
              </div>
              <div class="media-grid">
                ${liveItems.map(createCardHtml).join('')}
              </div>
            </div>
          `);
        } else {
          blocks.push(`<div class="empty-state"><h3>Sin resultados de ${escapeHtml(state.sourceFilter)}</h3><p>Verifica que la API esté configurada en <strong>APIs</strong> o cambia el selector a <strong>Todas las APIs</strong>.</p></div>`);
        }
        dom.catalogContainer.innerHTML = blocks.join('');
        return;
      }

      if (state.sourceFilter !== 'local' && state.discoverItems.length > 0) {
        const badge = state.discoverSources.join(' · ');
        blocks.push(
          renderCarouselSection(
            'Tendencias en vivo',
            sortItems(state.discoverItems.slice(0, 30)),
            null,
            'live-discover',
            badge
          )
        );
      }

      const rowCategories = CATEGORIES.filter((c) => c.id !== 'Todas');
      for (const cat of rowCategories) {
        const items = sortItems(CATALOG.filter((item) => item.categories.includes(cat.id)));
        if (items.length > 0) {
          blocks.push(renderCarouselSection(cat.label, items, cat.id, cat.id));
        }
      }

      dom.catalogContainer.innerHTML = blocks.join('');
      return;
    }

    // Live Discover Grid View
    if (state.section === 'discover' && !query) {
      if (state.isLoadingDiscover) {
        dom.catalogContainer.innerHTML = `
            <div class="section-block">
              <div class="search-status">
                <span class="spinner" aria-hidden="true"></span>
                <span>Cargando página ${state.page} desde APIs conectadas...</span>
              </div>
            </div>
          `;
        return;
      }

      const items = sortItems(state.discoverItems);
      const sourceText = state.discoverSources.length ? state.discoverSources.join(' + ') : 'APIs Públicas';
      dom.catalogContainer.innerHTML = items.length
        ? `
            <div class="section-block">
              <div class="section-header">
                <div class="section-title-wrap">
                  <h2 class="section-title">${state.discoverKind === 'top' ? 'Mejor valoradas en vivo' : 'Tendencias globales en vivo'
        }${state.category !== 'Todas' ? ` · ${escapeHtml(state.category)}` : ''}</h2>
                  <span class="section-count">Página ${state.page} de ${state.totalPages} · ${items.length} títulos</span>
                  <span class="source-tag">${escapeHtml(sourceText)}</span>
                </div>
              </div>
              <div class="media-grid">
                ${items.map(createCardHtml).join('')}
              </div>
              ${renderPaginationBar(state.page, state.totalPages)}
            </div>
          `
        : `
            <div class="empty-state">
              <h3>No se pudieron cargar resultados en vivo</h3>
              <p>Verifica tu conexión a internet o abre el panel de <strong>APIs</strong> para revisar la configuración.</p>
            </div>
          `;
      return;
    }

    // Filtered / Search / Favorites Grid View
    const isApiGridView = !query && state.section !== 'favorites';
    const isExternalSourceOnly = state.sourceFilter !== 'all' && state.sourceFilter !== 'local';
    if (isApiGridView && state.isLoadingDiscover) {
      dom.catalogContainer.innerHTML = `
        <div class="section-block">
          <div class="search-status">
            <span class="spinner" aria-hidden="true"></span>
            <span>Cargando página ${state.page} de ${escapeHtml(state.category === 'Todas' ? 'catálogo' : state.category)}...</span>
          </div>
        </div>
      `;
      return;
    }

    let localPool = CATALOG;
    if (isApiGridView && (isExternalSourceOnly || state.page > 1 || state.category !== 'Todas' || state.section === 'movie' || state.section === 'serial')) {
      if (state.sourceFilter === 'all' && state.page === 1) {
        const merged = new Map();
        state.discoverItems.forEach((item) => merged.set(item.id, item));
        CATALOG.forEach((item) => {
          if (!merged.has(item.id)) merged.set(item.id, item);
        });
        localPool = Array.from(merged.values());
      } else {
        localPool = state.discoverItems;
      }
    } else if (isExternalSourceOnly && query) {
      localPool = [];
    }

    if (state.section === 'movie') {
      localPool = localPool.filter((i) => i.type === 'movie');
    } else if (state.section === 'serial') {
      localPool = localPool.filter((i) => i.type === 'serial');
    } else if (state.section === 'favorites') {
      const favIds = Array.from(state.favorites);
      localPool = favIds.map((id) => findItemById(id) || state.history.find((h) => h.id === id)).filter(Boolean);
    }

    if (state.category !== 'Todas') {
      localPool = localPool.filter((i) => (i.categories || []).includes(state.category));
    }

    if (query) {
      const qNorm = normalizeText(query);
      localPool = localPool.filter(
        (i) =>
          normalizeText(i.title).includes(qNorm) ||
          normalizeText(i.id).includes(qNorm) ||
          (i.categories || []).some((c) => normalizeText(c).includes(qNorm))
      );
    }

    localPool = sortItems(localPool);

    let effectiveTotalPages = state.totalPages;
    let displayPool = localPool;
    if (state.section === 'favorites') {
      const perPage = 24;
      effectiveTotalPages = Math.max(1, Math.ceil(localPool.length / perPage));
      const safePage = Math.min(state.page, effectiveTotalPages);
      displayPool = localPool.slice((safePage - 1) * perPage, safePage * perPage);
    }

    let headingTitle = 'Resultados';
    if (!query) {
      if (state.section === 'favorites') headingTitle = 'Mi Lista';
      else if (state.section === 'movie')
        headingTitle = state.category === 'Todas' ? 'Todas las Películas' : `Películas · ${state.category}`;
      else if (state.section === 'serial')
        headingTitle = state.category === 'Todas' ? 'Todas las Series' : `Series · ${state.category}`;
      else headingTitle = state.category === 'Todas' ? 'Todo el catálogo' : state.category;
    } else {
      headingTitle = `En el catálogo local para "${query}"`;
    }

    let html = '';

    // Direct IMDb / TMDB ID / PlayLatinSRC URL card
    const directId = query ? parseDirectIdInput(query) : null;
    if (directId) {
      const idKindLabel = directId.isTmdb ? 'TMDB' : 'IMDb';
      html += `
        <div class="section-block">
          <div class="section-header">
            <div class="section-title-wrap">
              <h2 class="section-title">Reproducción directa por ID de ${idKindLabel}</h2>
              <span class="section-count">${escapeHtml(directId.id)}</span>
            </div>
          </div>
          <div class="empty-state" style="padding:24px;">
            <h3>Abrir <code>${escapeHtml(directId.id)}</code> en PlayLatinSRC</h3>
            <p>PlayLatinSRC acepta tanto IDs de IMDb (<code>tt...</code>) como IDs numéricos de TMDB.</p>
            <div class="hero-actions">
              ${directId.type !== 'serial'
          ? `<button type="button" class="btn btn-play btn-sm" data-direct-id="${escapeHtml(directId.id)}" data-direct-type="movie">Abrir como Película</button>`
          : ''
        }
              ${directId.type !== 'movie'
          ? `<button type="button" class="btn btn-glass btn-sm" data-direct-id="${escapeHtml(directId.id)}" data-direct-type="serial">Abrir como Serie</button>`
          : ''
        }
            </div>
          </div>
        </div>
      `;
    }

    if (displayPool.length > 0) {
      const countText =
        !query && effectiveTotalPages > 1
          ? `Página ${state.page} de ${effectiveTotalPages} · ${displayPool.length} título${displayPool.length === 1 ? '' : 's'}`
          : `${displayPool.length} título${displayPool.length === 1 ? '' : 's'}`;
      html += `
        <div class="section-block">
          <div class="section-header">
            <div class="section-title-wrap">
              <h2 class="section-title">${escapeHtml(headingTitle)}</h2>
              <span class="section-count">${countText}</span>
            </div>
          </div>
          <div class="media-grid">
            ${displayPool.map(createCardHtml).join('')}
          </div>
          ${!query ? renderPaginationBar(state.page, effectiveTotalPages) : ''}
        </div>
      `;
    } else if (!query) {
      html += `
        <div class="empty-state">
          <h3>${state.section === 'favorites' ? 'Tu lista está vacía' : 'No hay títulos en esta categoría'}</h3>
          <p>${state.section === 'favorites'
          ? 'Guarda películas o series haciendo clic en el corazón de cualquier tarjeta para verlas aquí.'
          : 'Prueba cambiando de categoría o limpiando los filtros.'
        }</p>
        </div>
      `;
    }

    // Remote Multi-API Search Results
    if (query) {
      if (state.isSearchingRemote) {
        html += `
          <div class="section-block">
            <div class="search-status">
              <span class="spinner" aria-hidden="true"></span>
              <span>Buscando en IMDb, Cinemeta, TVmaze y APIs conectadas...</span>
            </div>
          </div>
        `;
      } else {
        const localIds = new Set(localPool.map((i) => i.id));
        const extraRemote = state.remoteResults.filter((r) => !localIds.has(r.id));

        if (extraRemote.length > 0) {
          extraRemote.forEach((r) => state.customItemsById.set(r.id, r));
          const sourcesLabel = state.remoteSources.length ? state.remoteSources.join(' · ') : 'APIs externas';
          html += `
            <div class="section-block">
              <div class="section-header">
                <div class="section-title-wrap">
                  <h2 class="section-title">Resultados globales</h2>
                  <span class="section-count">${extraRemote.length} encontrados</span>
                  <span class="source-tag">${escapeHtml(sourcesLabel)}</span>
                </div>
              </div>
              <div class="media-grid">
                ${extraRemote.map(createCardHtml).join('')}
              </div>
            </div>
          `;
        } else if (localPool.length === 0 && !directId) {
          html += `
            <div class="empty-state">
              <h3>No encontramos resultados para "${escapeHtml(query)}"</h3>
              <p>Intenta con el título original en inglés o español, o pega directamente el ID de IMDb (<code>tt0108778</code>) o TMDB.</p>
            </div>
          `;
        }
      }
    }

    dom.catalogContainer.innerHTML = html;
  }

  function renderPaginationBar(currentPage, totalPages) {
    if (!totalPages || totalPages <= 1) return '';
    const pages = [];
    if (totalPages <= 9) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 4) pages.push('...');
      const start = Math.max(2, currentPage - 2);
      const end = Math.min(totalPages - 1, currentPage + 2);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 3) pages.push('...');
      pages.push(totalPages);
    }

    const buttonsHtml = pages
      .map((p) =>
        p === '...'
          ? `<span class="page-ellipsis">…</span>`
          : `<button type="button" class="page-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`
      )
      .join('');

    return `
      <nav class="pagination-bar" aria-label="Paginación de resultados">
        <button type="button" class="page-btn page-nav" data-page="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''}>‹ Anterior</button>
        <div class="page-numbers">${buttonsHtml}</div>
        <button type="button" class="page-btn page-nav" data-page="${currentPage + 1}" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente ›</button>
        <form class="page-jump-form" data-page-jump>
          <span>Ir a:</span>
          <input type="number" min="1" max="${totalPages}" value="${currentPage}" aria-label="Ir a página" />
          <button type="submit" class="page-btn">Ir</button>
        </form>
      </nav>
    `;
  }

  function renderCarouselSection(title, items, categoryLink, rowId, sourceBadge = '') {
    const flakeSvg = `<svg class="carousel-snowflake" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93 4.93 19.07"/></svg>`;
    return `
      <div class="section-block">
        <div class="section-header">
          <div class="section-title-wrap">
            <h2 class="section-title">${escapeHtml(title)}</h2>
            <span class="section-count">${items.length}</span>
            ${sourceBadge ? `<span class="source-tag">${escapeHtml(sourceBadge)}</span>` : ''}
          </div>
          <div class="section-actions">
            ${categoryLink
        ? `<button type="button" class="see-all-btn" data-see-all="${escapeHtml(categoryLink)}">Ver todo →</button>`
        : ''
      }
            <button type="button" class="carousel-nav-btn" data-scroll-row="${escapeHtml(rowId)}" data-scroll-dir="-1" aria-label="Anterior">‹${flakeSvg}</button>
            <button type="button" class="carousel-nav-btn" data-scroll-row="${escapeHtml(rowId)}" data-scroll-dir="1" aria-label="Siguiente">›${flakeSvg}</button>
          </div>
        </div>
        <div class="media-row" data-row-id="${escapeHtml(rowId)}">
          ${items.map(createCardHtml).join('')}
        </div>
      </div>
    `;
  }

  /* ==================== Live Discover & Multi-API Search ==================== */
  async function loadDiscoverFeed(showSpinner = false) {
    if (state.sourceFilter === 'local') {
      state.discoverItems = [];
      state.discoverSources = [];
      state.discoverSearchOnly = false;
      state.isLoadingDiscover = false;
      syncHeroItems();
      renderCatalog();
      return;
    }

    if (showSpinner) {
      state.isLoadingDiscover = true;
      renderCatalog();
    }
    try {
      const params = new URLSearchParams({
        kind: state.discoverKind,
        type: state.section === 'movie' || state.section === 'serial' ? state.section : 'all',
        genre: state.category,
        source: state.sourceFilter,
        page: String(state.page),
      });
      const res = await fetch(`/api/discover?${params.toString()}`);
      const data = await res.json();
      if (data) {
        state.discoverSearchOnly = Boolean(data.searchOnly);
        state.discoverItems = Array.isArray(data.results) ? data.results : [];
        state.discoverSources = Array.isArray(data.sources) ? data.sources : [];
        state.totalPages = Math.max(1, Number(data.totalPages) || 1);
        state.page = Math.max(1, Number(data.page) || state.page);
        state.discoverItems.forEach((item) => state.customItemsById.set(item.id, item));
      }
    } catch {
      // Keep existing catalog gracefully
    } finally {
      state.isLoadingDiscover = false;
      syncHeroItems();
      renderCatalog();
    }
  }

  let searchDebounce = null;
  let searchReqCounter = 0;

  async function triggerRemoteSearch(query) {
    const trimmed = query.trim();
    if (trimmed.length < 2 || parseDirectIdInput(trimmed) || state.sourceFilter === 'local') {
      state.remoteResults = [];
      state.remoteSources = [];
      state.isSearchingRemote = false;
      renderCatalog();
      return;
    }

    const reqId = ++searchReqCounter;
    state.isSearchingRemote = true;
    renderCatalog();

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(trimmed)}&source=${encodeURIComponent(state.sourceFilter)}`
      );
      if (reqId !== searchReqCounter) return;
      const data = await res.json();
      state.remoteResults = Array.isArray(data.results) ? data.results : [];
      state.remoteSources = Array.isArray(data.sources) ? data.sources : [];
    } catch {
      if (reqId !== searchReqCounter) return;
      state.remoteResults = [];
      state.remoteSources = [];
    } finally {
      if (reqId === searchReqCounter) {
        state.isSearchingRemote = false;
        renderCatalog();
      }
    }
  }

  /* ==================== Player Modal & Enrichment ==================== */
  async function loadProviders() {
    try {
      const res = await fetch('/api/providers');
      const data = await res.json();
      if (data && Array.isArray(data.providers)) {
        state.providers = data.providers;
        const seen = new Set();
        const options = ['<option value="">Automático</option>'];
        for (const p of data.providers) {
          if (!p || !p.id || seen.has(p.id)) continue;
          seen.add(p.id);
          options.push(`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name || p.id)}</option>`);
        }
        dom.providerSelect.innerHTML = options.join('');
        if (state.defaultProvider) dom.providerSelect.value = state.defaultProvider;
      }
    } catch {
      // Keep default Automático option
    }
  }

  function buildEmbedUrl() {
    const { item, mode, embedApi, lang, season, episode, episodeSelected, provider, tmdbId, trailerYt } = state.modal;
    if (!item) return '';

    if (mode === 'trailer' && trailerYt) {
      return `https://www.youtube.com/embed/${encodeURIComponent(trailerYt)}?autoplay=1&rel=0`;
    }

    const isSeries = item.type === 'serial';
    const s = Math.max(1, Number(season) || 1);
    const e = Math.max(1, Number(episode) || 1);
    const imdbOrId = item.imdbId || item.id;

    if (mode === 'download' && !isSeries && embedApi === 'playlatinsrc') {
      return `https://playlatinsrc.co/embed/download/${item.id}`;
    }

    if (embedApi === 'embed69') {
      const epPad = String(e).padStart(2, '0');
      return isSeries
        ? `https://embed69.org/f/${encodeURIComponent(imdbOrId)}-${s}x${epPad}`
        : `https://embed69.org/f/${encodeURIComponent(imdbOrId)}`;
    }

    const params = new URLSearchParams();
    if (lang) params.set('lang', lang);

    if (provider || (isSeries && episodeSelected)) {
      params.set('color', '#e50914');
      if (provider) params.set('lastserver', provider);
      const base = isSeries
        ? `https://playlatinsrc.co/custom/serial/${item.id}/${s}/${e}`
        : `https://playlatinsrc.co/custom/movie/${item.id}`;
      const qs = params.toString();
      return qs ? `${base}?${qs}` : base;
    }

    const base = isSeries
      ? `https://playlatinsrc.co/serial/${item.id}`
      : `https://playlatinsrc.co/movie/${item.id}`;
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  function syncModalControls() {
    const { item, mode, embedApi, lang, trailerYt } = state.modal;
    const isSeries = item && item.type === 'serial';
    const isPlayLatin = embedApi === 'playlatinsrc';

    dom.embedApiSelect.value = embedApi;
    dom.modalLangGroup.classList.toggle('hidden', !isPlayLatin || mode === 'download');
    dom.modalModeGroup.classList.toggle('hidden', !isPlayLatin || Boolean(isSeries));
    dom.downloadModeBtn.classList.toggle('hidden', Boolean(isSeries) || !isPlayLatin);
    dom.providerWrap.classList.toggle('hidden', !isPlayLatin || mode === 'download');
    dom.episodePicker.classList.toggle('hidden', !isSeries);
    dom.applyCustomBtn.classList.toggle('hidden', !isSeries);
    dom.customOptionsBar.classList.toggle('hidden', mode === 'download' || (!isPlayLatin && !isSeries));

    dom.trailerToggleBtn.classList.toggle('hidden', !trailerYt);
    dom.trailerToggleBtn.querySelector('span').textContent = mode === 'trailer' ? 'Volver al reproductor' : 'Ver tráiler';

    dom.modalLangTabs.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    dom.modalModeTabs.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }

  function syncModalFavBtn() {
    if (!state.modal.item) return;
    const isFav = state.favorites.has(state.modal.item.id);
    dom.modalFavBtn.classList.toggle('is-saved', isFav);
    dom.modalFavBtn.querySelector('span').textContent = isFav ? 'En Mi Lista' : 'Guardar';
  }

  function refreshIframe() {
    if (state.modal.mode !== 'download') {
      dom.embedIframe.style.minHeight = '';
    }
    const url = buildEmbedUrl();
    dom.embedIframe.src = url;
  }

  async function enrichModalMeta(item) {
    try {
      const res = await fetch(`/api/meta?type=${encodeURIComponent(item.type)}&id=${encodeURIComponent(item.id)}`);
      const data = await res.json();
      const meta = data?.meta;
      if (!meta || !state.modal.item || state.modal.item.id !== item.id) return;

      if (meta.tmdbId) {
        state.modal.tmdbId = meta.tmdbId;
        if (state.modal.embedApi === 'vidlink') refreshIframe();
      }

      // Keep Spanish curated title/synopsis if item is from our local Spanish catalog unless TMDB provided Spanish
      const isCuratedLocal = CATALOG.some((c) => c.id === item.id);
      if ((!isCuratedLocal || meta.sources.includes('TMDB')) && meta.title) {
        dom.modalTitle.textContent = meta.title;
      }
      if ((!isCuratedLocal || meta.sources.includes('TMDB')) && meta.synopsis) {
        dom.modalSynopsis.textContent = meta.synopsis;
      }
      if (!item.poster && meta.poster) {
        dom.modalPoster.src = meta.poster;
        dom.modalPoster.classList.remove('hidden');
      }

      if (meta.trailerYt) {
        state.modal.trailerYt = meta.trailerYt;
        syncModalControls();
      }

      const chips = [];
      if (meta.imdbRating) chips.push(`<span class="rating-chip gold">IMDb ★ ${escapeHtml(meta.imdbRating)}</span>`);
      if (meta.rottenTomatoes) chips.push(`<span class="rating-chip">🍅 ${escapeHtml(meta.rottenTomatoes)}</span>`);
      if (meta.metacritic) chips.push(`<span class="rating-chip">Metacritic ${escapeHtml(meta.metacritic)}</span>`);
      if (meta.rated) chips.push(`<span class="rating-chip">${escapeHtml(meta.rated)}</span>`);
      if (meta.awards && meta.awards !== 'N/A') chips.push(`<span class="rating-chip">🏆 ${escapeHtml(meta.awards)}</span>`);
      if (meta.sources?.length) chips.push(`<span class="source-tag">${escapeHtml(meta.sources.join(' · '))}</span>`);

      if (chips.length) {
        dom.modalRatingsRow.innerHTML = chips.join('');
        dom.modalRatingsRow.classList.remove('hidden');
      }

      const creditParts = [];
      if (meta.director?.length) creditParts.push(`<strong>Dirección:</strong> ${escapeHtml(meta.director.slice(0, 3).join(', '))}`);
      if (meta.cast?.length) creditParts.push(`<strong>Reparto:</strong> ${escapeHtml(meta.cast.slice(0, 6).join(', '))}`);
      if (meta.country) creditParts.push(`<strong>País:</strong> ${escapeHtml(meta.country)}`);
      if (creditParts.length) {
        dom.modalCredits.innerHTML = creditParts.join(' &nbsp;·&nbsp; ');
        dom.modalCredits.classList.remove('hidden');
      }
    } catch {
      // Metadata enrichment is progressive
    }
  }

  async function loadSeriesEpisodes(item) {
    dom.seriesEpisodesPanel.classList.add('hidden');
    if (item.type !== 'serial') return;

    try {
      const res = await fetch(`/api/episodes?id=${encodeURIComponent(item.id)}`);
      const data = await res.json();
      if (!state.modal.item || state.modal.item.id !== item.id) return;
      if (!data?.seasons?.length) return;

      state.modal.episodesData = data;
      state.modal.activeSeason = data.seasons[0];
      dom.episodesSourceBadge.textContent = (data.sources || []).join(' · ') || 'Guía de episodios';
      renderSeriesEpisodes();
      dom.seriesEpisodesPanel.classList.remove('hidden');
    } catch {
      // Optional episode guide
    }
  }

  function renderSeriesEpisodes() {
    const data = state.modal.episodesData;
    if (!data || !data.seasons?.length) return;

    dom.seasonTabs.innerHTML = data.seasons
      .map(
        (s) =>
          `<button type="button" class="season-tab-btn ${s === state.modal.activeSeason ? 'active' : ''}" data-season-tab="${s}">Temp ${s}</button>`
      )
      .join('');

    const eps = data.episodesBySeason?.[state.modal.activeSeason] || [];
    dom.episodesGrid.innerHTML = eps
      .map((ep) => {
        const isCurrent =
          state.modal.episodeSelected &&
          Number(state.modal.season) === ep.season &&
          Number(state.modal.episode) === ep.episode;
        return `
          <button type="button" class="ep-card ${isCurrent ? 'active' : ''}" data-play-season="${ep.season}" data-play-episode="${ep.episode}">
            ${ep.still
            ? `<img class="ep-thumb" src="${escapeHtml(ep.still)}" alt="E${ep.episode}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden');" />
                   <div class="ep-thumb-fallback hidden">T${ep.season}·E${ep.episode}</div>`
            : `<div class="ep-thumb-fallback">T${ep.season}·E${ep.episode}</div>`
          }
            <div class="ep-info">
              <span class="ep-title">${ep.episode}. ${escapeHtml(ep.title)}</span>
              <span class="ep-sub">${escapeHtml(ep.overview || ep.airdate || `Temporada ${ep.season}`)}</span>
            </div>
          </button>
        `;
      })
      .join('');
  }

  function openPlayer(item) {
    if (!item) return;
    state.modal.item = item;
    state.modal.mode = 'standard';
    state.modal.embedApi = 'playlatinsrc';
    state.modal.lang = state.defaultLang;
    state.modal.provider = state.defaultProvider;
    state.modal.season = 1;
    state.modal.episode = 1;
    state.modal.episodeSelected = false;
    state.modal.tmdbId = item.tmdbId || '';
    state.modal.trailerYt = item.trailerYt || '';
    state.modal.episodesData = null;
    dom.seasonInput.value = '1';
    dom.episodeInput.value = '1';
    dom.providerSelect.value = state.defaultProvider;

    const isSeries = item.type === 'serial';
    dom.modalTypeBadge.textContent = isSeries ? 'Serie' : 'Película';
    dom.modalTitle.textContent = item.title;
    dom.modalPoster.onerror = () => dom.modalPoster.classList.add('hidden');
    dom.modalPoster.src = item.poster || '';
    dom.modalPoster.classList.toggle('hidden', !item.poster);

    dom.modalRatingsRow.innerHTML = '';
    dom.modalRatingsRow.classList.add('hidden');
    dom.modalCredits.innerHTML = '';
    dom.modalCredits.classList.add('hidden');
    dom.playerTelemetry.classList.add('hidden');
    dom.telemetrySource.textContent = '';
    dom.telemetryTime.textContent = '';
    dom.seriesEpisodesPanel.classList.add('hidden');

    const savedProg = state.progress[item.id];
    if (savedProg && savedProg.time > 15) {
      dom.resumeBtn.classList.remove('hidden');
      dom.resumeBtn.querySelector('span').textContent = `Reanudar (${formatSeconds(savedProg.time)})`;
    } else {
      dom.resumeBtn.classList.add('hidden');
    }

    const metaParts = [];
    if (item.rating) metaParts.push(`★ ${item.rating}`);
    if (item.year) metaParts.push(item.year);
    if (item.duration) metaParts.push(item.duration);
    if (item.categories && item.categories.length) {
      metaParts.push(item.categories.filter((c) => c !== 'Tendencias').join(', '));
    }
    dom.modalMetaRow.textContent = metaParts.join(' · ');
    dom.modalSynopsis.textContent = item.synopsis || 'Reproducción integrada desde PlayLatinSRC.';

    syncModalFavBtn();
    syncModalControls();
    refreshIframe();
    enrichModalMeta(item);
    loadSeriesEpisodes(item);
    recordHistory(item);

    dom.playerModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closePlayer() {
    dom.playerModal.classList.add('hidden');
    dom.embedIframe.src = 'about:blank';
    document.body.style.overflow = '';
    state.modal.item = null;
    if (state.section === 'all' && state.category === 'Todas' && !state.searchQuery.trim()) {
      const scrollY = window.scrollY;
      renderCatalog();
      window.scrollTo(0, scrollY);
    }
  }

  /* ==================== PlayLatinSRC postMessage Listener ==================== */
  function handlePlayerMessage(event) {
    if (!event.data || typeof event.data !== 'object') return;

    // Auto-resize download embed iframe if PlayLatinSRC sends height
    if (event.data.playlatinsrcDlEmbed && event.data.height && state.modal.mode === 'download') {
      dom.embedIframe.style.minHeight = `${Math.max(360, Number(event.data.height))}px`;
      return;
    }

    const msgType = event.data.type || event.data.event || '';
    if (typeof msgType !== 'string' || !msgType.startsWith('playlatinsrc:')) return;
    if (!state.modal.item) return;

    dom.playerTelemetry.classList.remove('hidden');

    if (msgType === 'playlatinsrc:ready') {
      dom.telemetryState.textContent = 'Reproductor listo';
    } else if (msgType === 'playlatinsrc:play') {
      dom.telemetryState.textContent = 'Reproduciendo';
    } else if (msgType === 'playlatinsrc:pause') {
      dom.telemetryState.textContent = 'En pausa';
    } else if (msgType === 'playlatinsrc:sourceused') {
      const srcLabel = event.data.source || event.data.server || event.data.version || '';
      if (srcLabel) dom.telemetrySource.textContent = `Fuente: ${srcLabel}`;
    } else if (msgType === 'playlatinsrc:timeupdate') {
      const cur = Number(event.data.currentTime ?? event.data.time ?? 0);
      const dur = Number(event.data.duration ?? 0);
      if (cur > 0) {
        dom.telemetryTime.textContent = dur > 0 ? `${formatSeconds(cur)} / ${formatSeconds(dur)}` : formatSeconds(cur);
        if (Math.floor(cur) % 5 === 0) {
          savePlaybackProgress(state.modal.item.id, cur, dur);
        }
      }
    } else if (msgType === 'playlatinsrc:error') {
      dom.telemetryState.textContent = 'Error en fuente actual — prueba otro servidor';
    } else if (msgType === 'playlatinsrc:close') {
      closePlayer();
    }
  }

  /* ==================== API Integrations Modal ==================== */
  async function loadApiConfig() {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (!data?.integrations) return;
      state.apiStatus = data.integrations;
      syncApiBadges();
    } catch {
      // Ignore if offline
    }
  }

  function syncApiBadges() {
    const cfg = state.apiStatus;
    if (!cfg) return;

    const setBadge = (el, configured, masked) => {
      if (!el) return;
      el.className = `avail-badge ${configured ? 'ok' : 'warn'}`;
      el.textContent = configured ? `Conectada (${masked})` : 'Opcional';
    };

    setBadge(dom.tmdbStatusBadge, cfg.tmdb?.configured, cfg.tmdb?.masked);
    setBadge(dom.omdbStatusBadge, cfg.omdb?.configured, cfg.omdb?.masked);
    setBadge(dom.rapidStatusBadge, cfg.rapidapi?.configured, cfg.rapidapi?.masked);
    if (cfg.rapidapi?.host && !dom.rapidApiHostInput.value) {
      dom.rapidApiHostInput.value = cfg.rapidapi.host;
    }
  }

  function openApiModal() {
    dom.apiTestOutput.classList.add('hidden');
    dom.apiTestOutput.innerHTML = '';
    loadApiConfig();
    dom.apiModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeApiModal() {
    dom.apiModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  /* ==================== Events ==================== */
  function bindEvents() {
    window.addEventListener('message', handlePlayerMessage);

    window.addEventListener('scroll', () => {
      dom.navbar.classList.toggle('scrolled', window.scrollY > 24);
    });

    dom.brandHomeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      state.section = 'all';
      state.category = 'Todas';
      state.page = 1;
      state.searchQuery = '';
      dom.searchInput.value = '';
      if (dom.mobileSearchInput) dom.mobileSearchInput.value = '';
      dom.clearSearchBtn.classList.add('hidden');
      dom.navLinks.forEach((b) => b.classList.toggle('active', b.dataset.section === 'all'));
      if (dom.mobileMenu) dom.mobileMenu.classList.add('hidden');
      renderCategoryRail();
      loadDiscoverFeed(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    if (dom.mobileMenuBtn && dom.mobileMenu) {
      dom.mobileMenuBtn.addEventListener('click', () => {
        const isHidden = dom.mobileMenu.classList.toggle('hidden');
        dom.mobileMenuBtn.setAttribute('aria-expanded', String(!isHidden));
      });
    }

    dom.navLinks.forEach((btn) => {
      btn.addEventListener('click', () => {
        state.section = btn.dataset.section;
        state.page = 1;
        dom.navLinks.forEach((b) => b.classList.toggle('active', b.dataset.section === state.section));
        if (dom.mobileMenu) dom.mobileMenu.classList.add('hidden');
        if (state.section !== 'favorites') {
          loadDiscoverFeed(true);
        } else {
          renderCatalog();
        }
      });
    });

    const selectCategory = (nextCat) => {
      state.category = nextCat;
      state.page = 1;
      renderCategoryRail();
      if (dom.mobileMenu) dom.mobileMenu.classList.add('hidden');
      if (state.section !== 'favorites') {
        loadDiscoverFeed(true);
      } else {
        renderCatalog();
      }
    };

    if (dom.categoryRail) {
      dom.categoryRail.addEventListener('click', (e) => {
        const pill = e.target.closest('.cat-pill');
        if (!pill) return;
        selectCategory(pill.dataset.category);
      });
    }

    if (dom.hamburgerCategories) {
      dom.hamburgerCategories.addEventListener('click', (e) => {
        const pill = e.target.closest('.cat-pill');
        if (!pill) return;
        selectCategory(pill.dataset.category);
      });
    }

    if (dom.categorySelect) {
      dom.categorySelect.addEventListener('change', () => {
        selectCategory(dom.categorySelect.value);
      });
    }

    if (dom.discoverKindWrap) {
      dom.discoverKindWrap.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-discover-kind]');
        if (!btn) return;
        state.discoverKind = btn.dataset.discoverKind;
        state.page = 1;
        dom.discoverKindWrap.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
        loadDiscoverFeed(true);
      });
    }

    if (dom.sortSelect) {
      dom.sortSelect.addEventListener('change', () => {
        state.sort = dom.sortSelect.value;
        renderCatalog();
      });
    }

    if (dom.globalSourceSelect) {
      dom.globalSourceSelect.value = state.sourceFilter;
      dom.globalSourceSelect.addEventListener('change', () => {
        state.sourceFilter = dom.globalSourceSelect.value;
        state.page = 1;
        localStorage.setItem(STORAGE_KEYS.source, state.sourceFilter);
        if (state.searchQuery.trim().length >= 2) {
          triggerRemoteSearch(state.searchQuery);
        }
        loadDiscoverFeed(state.sourceFilter !== 'local');
      });
    }

    dom.globalLangSelect.value = state.defaultLang;
    dom.globalLangSelect.addEventListener('change', () => {
      state.defaultLang = dom.globalLangSelect.value;
      localStorage.setItem(STORAGE_KEYS.lang, state.defaultLang);
      showToast(`Idioma preferido: ${state.defaultLang || 'Automático'}`);
    });

    const handleSearchInput = (val) => {
      state.searchQuery = val;
      dom.searchInput.value = val;
      if (dom.mobileSearchInput) dom.mobileSearchInput.value = val;
      dom.clearSearchBtn.classList.toggle('hidden', !val);
      renderCatalog();

      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        triggerRemoteSearch(state.searchQuery);
      }, 380);
    };

    dom.searchInput.addEventListener('input', () => handleSearchInput(dom.searchInput.value));
    if (dom.mobileSearchInput) {
      dom.mobileSearchInput.addEventListener('input', () => handleSearchInput(dom.mobileSearchInput.value));
    }

    dom.clearSearchBtn.addEventListener('click', () => {
      state.searchQuery = '';
      state.remoteResults = [];
      state.remoteSources = [];
      state.isSearchingRemote = false;
      dom.searchInput.value = '';
      dom.clearSearchBtn.classList.add('hidden');
      renderCatalog();
      dom.searchInput.focus();
    });

    // Hero actions
    dom.heroPlayBtn.addEventListener('click', () => {
      const item = state.heroItems[state.heroIndex % state.heroItems.length];
      openPlayer(item);
    });

    dom.heroFavBtn.addEventListener('click', () => {
      const item = state.heroItems[state.heroIndex % state.heroItems.length];
      if (item) toggleFavorite(item.id, item);
    });

    dom.heroDots.addEventListener('click', (e) => {
      const dot = e.target.closest('[data-hero-dot]');
      if (!dot) return;
      state.heroIndex = Number(dot.dataset.heroDot) || 0;
      renderHero();
      startHeroRotation();
    });

    dom.heroSection.addEventListener('mouseenter', stopHeroRotation);
    dom.heroSection.addEventListener('mouseleave', startHeroRotation);

    // Delegated clicks inside catalog
    dom.catalogContainer.addEventListener('click', (e) => {
      const favBtn = e.target.closest('[data-fav-id]');
      if (favBtn) {
        e.stopPropagation();
        const id = favBtn.dataset.favId;
        toggleFavorite(id, findItemById(id));
        return;
      }

      const seeAll = e.target.closest('[data-see-all]');
      if (seeAll) {
        state.category = seeAll.dataset.seeAll;
        state.page = 1;
        renderCategoryRail();
        loadDiscoverFeed(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const pageBtn = e.target.closest('[data-page]');
      if (pageBtn && !pageBtn.disabled) {
        const nextPage = Math.max(1, Number(pageBtn.dataset.page) || 1);
        if (nextPage === state.page) return;
        state.page = nextPage;
        if (state.section === 'favorites') {
          renderCatalog();
        } else {
          loadDiscoverFeed(true);
        }
        window.scrollTo({ top: Math.max(0, dom.catalogContainer.offsetTop - 130), behavior: 'smooth' });
        return;
      }

      const scrollBtn = e.target.closest('[data-scroll-row]');
      if (scrollBtn) {
        const rowId = scrollBtn.dataset.scrollRow;
        const dir = Number(scrollBtn.dataset.scrollDir) || 1;
        const row = dom.catalogContainer.querySelector(`[data-row-id="${CSS.escape(rowId)}"]`);
        if (row) {
          row.scrollBy({ left: dir * Math.max(420, row.clientWidth * 0.78), behavior: 'smooth' });
        }
        return;
      }

      const directBtn = e.target.closest('[data-direct-id]');
      if (directBtn) {
        const id = directBtn.dataset.directId;
        const type = directBtn.dataset.directType;
        openPlayer({
          id,
          title: `Título (${id})`,
          type,
          year: '',
          rating: '',
          duration: type === 'serial' ? 'Serie' : 'Película',
          categories: [],
          poster: '',
          synopsis: `Cargado directamente mediante identificador ${id}.`,
          isDirect: true,
        });
        return;
      }

      const card = e.target.closest('[data-open-id]');
      if (card) {
        const id = card.dataset.openId;
        const item = findItemById(id) || state.history.find((h) => h.id === id);
        if (item) openPlayer(item);
      }
    });

    dom.catalogContainer.addEventListener('submit', (e) => {
      const jumpForm = e.target.closest('[data-page-jump]');
      if (!jumpForm) return;
      e.preventDefault();
      const input = jumpForm.querySelector('input');
      const max = Number(input?.max) || state.totalPages || 1;
      const nextPage = Math.max(1, Math.min(max, Number(input?.value) || 1));
      if (nextPage === state.page) return;
      state.page = nextPage;
      if (state.section === 'favorites') {
        renderCatalog();
      } else {
        loadDiscoverFeed(true);
      }
      window.scrollTo({ top: Math.max(0, dom.catalogContainer.offsetTop - 130), behavior: 'smooth' });
    });

    // Modal events
    dom.modalBackdrop.addEventListener('click', closePlayer);
    dom.closeModalBtn.addEventListener('click', closePlayer);

    dom.modalFavBtn.addEventListener('click', () => {
      if (state.modal.item) toggleFavorite(state.modal.item.id, state.modal.item);
    });

    dom.trailerToggleBtn.addEventListener('click', () => {
      if (!state.modal.trailerYt) return;
      state.modal.mode = state.modal.mode === 'trailer' ? 'standard' : 'trailer';
      syncModalControls();
      refreshIframe();
    });

    dom.resumeBtn.addEventListener('click', () => {
      if (!state.modal.item) return;
      const saved = state.progress[state.modal.item.id];
      if (!saved?.time || !dom.embedIframe.contentWindow) return;
      dom.embedIframe.contentWindow.postMessage(
        { type: 'playlatinsrc:command', command: 'seek', args: [saved.time] },
        '*'
      );
      dom.telemetryState.textContent = `Saltando a ${formatSeconds(saved.time)}...`;
      dom.playerTelemetry.classList.remove('hidden');
    });

    dom.embedApiSelect.addEventListener('change', () => {
      state.modal.embedApi = dom.embedApiSelect.value;
      if (state.modal.mode === 'download' || state.modal.mode === 'trailer') {
        state.modal.mode = 'standard';
      }
      syncModalControls();
      refreshIframe();
    });

    dom.modalLangTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-lang]');
      if (!btn) return;
      state.modal.lang = btn.dataset.lang;
      if (state.modal.mode === 'trailer') state.modal.mode = 'standard';
      syncModalControls();
      refreshIframe();
    });

    dom.modalModeTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mode]');
      if (!btn) return;
      state.modal.mode = btn.dataset.mode;
      syncModalControls();
      refreshIframe();
    });

    dom.applyCustomBtn.addEventListener('click', () => {
      state.modal.season = Math.max(1, Number(dom.seasonInput.value) || 1);
      state.modal.episode = Math.max(1, Number(dom.episodeInput.value) || 1);
      state.modal.episodeSelected = true;
      state.modal.provider = dom.providerSelect.value;
      renderSeriesEpisodes();
      refreshIframe();
    });

    dom.providerSelect.addEventListener('change', () => {
      state.modal.provider = dom.providerSelect.value;
      state.defaultProvider = state.modal.provider;
      localStorage.setItem(STORAGE_KEYS.provider, state.defaultProvider);
      refreshIframe();
    });

    dom.seriesEpisodesPanel.addEventListener('click', (e) => {
      const seasonBtn = e.target.closest('[data-season-tab]');
      if (seasonBtn) {
        state.modal.activeSeason = Number(seasonBtn.dataset.seasonTab) || 1;
        renderSeriesEpisodes();
        return;
      }

      const epCard = e.target.closest('[data-play-episode]');
      if (epCard) {
        const s = Number(epCard.dataset.playSeason) || 1;
        const ep = Number(epCard.dataset.playEpisode) || 1;
        state.modal.mode = 'standard';
        state.modal.season = s;
        state.modal.episode = ep;
        state.modal.episodeSelected = true;
        dom.seasonInput.value = String(s);
        dom.episodeInput.value = String(ep);
        syncModalControls();
        renderSeriesEpisodes();
        refreshIframe();
      }
    });

    // API Modal Events
    if (dom.apiSettingsBtn) {
      dom.apiSettingsBtn.addEventListener('click', openApiModal);
    }
    dom.apiModalBackdrop.addEventListener('click', closeApiModal);
    dom.closeApiModalBtn.addEventListener('click', closeApiModal);

    dom.clearApisBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tmdbKey: '', omdbKey: '', rapidApiKey: '' }),
        });
        const data = await res.json();
        if (data?.integrations) {
          state.apiStatus = data.integrations;
          syncApiBadges();
          dom.tmdbKeyInput.value = '';
          dom.omdbKeyInput.value = '';
          dom.rapidApiKeyInput.value = '';
          dom.apiTestOutput.classList.remove('hidden');
          dom.apiTestOutput.innerHTML = '<div>⚪ Claves eliminadas. PelisStart sigue operando con PlayLatinSRC y APIs Públicas.</div>';
          loadDiscoverFeed(state.section === 'discover');
        }
      } catch (err) {
        dom.apiTestOutput.classList.remove('hidden');
        dom.apiTestOutput.textContent = `Error al limpiar: ${err.message}`;
      }
    });

    dom.testApisBtn.addEventListener('click', async () => {
      dom.apiTestOutput.classList.remove('hidden');
      dom.apiTestOutput.textContent = 'Probando conexiones...';
      try {
        const payload = {};
        if (dom.tmdbKeyInput.value.trim()) payload.tmdbKey = dom.tmdbKeyInput.value.trim();
        if (dom.omdbKeyInput.value.trim()) payload.omdbKey = dom.omdbKeyInput.value.trim();
        if (dom.rapidApiKeyInput.value.trim()) payload.rapidApiKey = dom.rapidApiKeyInput.value.trim();
        if (dom.rapidApiHostInput.value.trim()) payload.rapidApiHost = dom.rapidApiHostInput.value.trim();

        const res = await fetch('/api/config/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        const r = data.report || {};
        dom.apiTestOutput.innerHTML = ['tmdb', 'omdb', 'rapidapi']
          .map((k) => {
            const item = r[k];
            if (!item) return '';
            const icon = item.ok === true ? '✅' : item.ok === false ? '❌' : '⚪';
            return `<div>${icon} <strong>${k.toUpperCase()}:</strong> ${escapeHtml(item.message)}</div>`;
          })
          .join('');
      } catch (err) {
        dom.apiTestOutput.textContent = `Error al probar: ${err.message}`;
      }
    });

    dom.apiConfigForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        rapidApiHost: dom.rapidApiHostInput.value.trim() || 'moviesdatabase.p.rapidapi.com',
      };
      if (dom.tmdbKeyInput.value.trim()) payload.tmdbKey = dom.tmdbKeyInput.value.trim();
      if (dom.omdbKeyInput.value.trim()) payload.omdbKey = dom.omdbKeyInput.value.trim();
      if (dom.rapidApiKeyInput.value.trim()) payload.rapidApiKey = dom.rapidApiKeyInput.value.trim();

      try {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data?.integrations) {
          state.apiStatus = data.integrations;
          syncApiBadges();
          dom.tmdbKeyInput.value = '';
          dom.omdbKeyInput.value = '';
          dom.rapidApiKeyInput.value = '';
          dom.apiTestOutput.classList.remove('hidden');
          dom.apiTestOutput.innerHTML = '<div>✅ Configuración guardada. Actualizando catálogo...</div>';
          loadDiscoverFeed(state.section === 'discover');
          setTimeout(closeApiModal, 800);
        }
      } catch (err) {
        dom.apiTestOutput.classList.remove('hidden');
        dom.apiTestOutput.textContent = `Error al guardar: ${err.message}`;
      }
    });

    // Advent Calendar Events
    if (dom.adventBtn) {
      dom.adventBtn.addEventListener('click', openAdventModal);
    }
    if (dom.adventModalBackdrop) {
      dom.adventModalBackdrop.addEventListener('click', closeAdventModal);
    }
    if (dom.closeAdventModalBtn) {
      dom.closeAdventModalBtn.addEventListener('click', closeAdventModal);
    }
    if (dom.adventResetBtn) {
      dom.adventResetBtn.addEventListener('click', () => {
        state.openedAdventDays.clear();
        saveJson(STORAGE_KEYS.advent, []);
        renderAdventCalendar();
        showToast('Casillas envueltas de nuevo');
      });
    }
    if (dom.adventGrid) {
      dom.adventGrid.addEventListener('click', (e) => {
        const door = e.target.closest('[data-advent-day]');
        if (!door) return;
        const day = Number(door.dataset.adventDay);
        const entry = ADVENT_CALENDAR.find((item) => item.day === day);
        if (!entry) return;

        const { unlockedUpTo } = getAdventDateStatus();
        if (day > unlockedUpTo) {
          door.classList.remove('is-locked-shake');
          void door.offsetWidth;
          door.classList.add('is-locked-shake');
          showToast(`🔒 El Día ${day} se desbloquea el ${day} de diciembre`);
          return;
        }

        if (!state.openedAdventDays.has(day)) {
          state.openedAdventDays.add(day);
          saveJson(STORAGE_KEYS.advent, Array.from(state.openedAdventDays));
          renderAdventCalendar(day);
          showToast(`Día ${day}: ${entry.title}`);
          const allOpened = state.openedAdventDays.size === ADVENT_CALENDAR.length;
          if (day === 24 || allOpened) {
            setTimeout(() => showChristmasFinale(entry, allOpened), 320);
          }
          return;
        }

        closeAdventModal();
        openPlayer(entry);
      });
    }

    const finaleBackdrop = document.getElementById('christmasFinaleBackdrop');
    const finaleCloseBtn = document.getElementById('christmasFinaleCloseBtn');
    const finalePlayBtn = document.getElementById('christmasFinalePlayBtn');
    if (finaleBackdrop) finaleBackdrop.addEventListener('click', closeChristmasFinale);
    if (finaleCloseBtn) finaleCloseBtn.addEventListener('click', closeChristmasFinale);
    if (finalePlayBtn) {
      finalePlayBtn.addEventListener('click', () => {
        const movieId = finalePlayBtn.dataset.movieId;
        const entry = ADVENT_CALENDAR.find((item) => item.id === movieId) || ADVENT_CALENDAR[ADVENT_CALENDAR.length - 1];
        closeChristmasFinale();
        closeAdventModal();
        if (entry) openPlayer(entry);
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const finaleOverlay = document.getElementById('christmasFinaleOverlay');
        if (finaleOverlay && !finaleOverlay.classList.contains('hidden')) {
          closeChristmasFinale();
          return;
        }
        if (dom.adventModal && !dom.adventModal.classList.contains('hidden')) {
          closeAdventModal();
          return;
        }
        if (!dom.apiModal.classList.contains('hidden')) {
          closeApiModal();
          return;
        }
        if (!dom.playerModal.classList.contains('hidden')) {
          closePlayer();
          return;
        }
      }
      if (
        e.key === '/' &&
        document.activeElement !== dom.searchInput &&
        dom.playerModal.classList.contains('hidden') &&
        dom.apiModal.classList.contains('hidden') &&
        (!dom.adventModal || dom.adventModal.classList.contains('hidden'))
      ) {
        e.preventDefault();
        dom.searchInput.focus();
      }
    });
  }

  /* ==================== Calendario de Adviento ==================== */
  let fireworksRaf = null;
  let fireworksInterval = null;

  function startChristmasFireworks() {
    const canvas = document.getElementById('xmasFireworksCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    stopChristmasFireworks();

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);
    canvas._fwResize = onResize;

    const colorPairs = [
      ['#ff2e4c', '#ffd43b'],
      ['#00e5ff', '#a855f7'],
      ['#22ff7a', '#fde047'],
      ['#ff8c24', '#ffffff'],
      ['#ff47c2', '#38d6ff'],
      ['#ffe066', '#ff3b6b'],
      ['#7cff6b', '#00e5ff'],
      ['#ffffff', '#ffd43b'],
    ];

    const rockets = [];
    const sparks = [];
    const flashes = [];

    function spawnRocket(targetX = null, targetY = null) {
      const pair = colorPairs[Math.floor(Math.random() * colorPairs.length)];
      const tx = targetX ?? w * (0.1 + Math.random() * 0.8);
      const ty = targetY ?? h * (0.12 + Math.random() * 0.36);
      const startX = w * (0.2 + Math.random() * 0.6);
      const flightFrames = 34 + Math.random() * 14;
      rockets.push({
        x: startX,
        y: h + 12,
        vx: (tx - startX) / flightFrames,
        vy: -((h - ty) / flightFrames + 0.5 * 0.12 * flightFrames),
        targetY: ty,
        primary: pair[0],
        secondary: pair[1],
        style: ['chrysanthemum', 'doubleRing', 'willow', 'strobe'][Math.floor(Math.random() * 4)],
        trail: [],
      });
    }

    function explode(r) {
      flashes.push({
        x: r.x,
        y: r.y,
        radius: 95 + Math.random() * 55,
        color: r.primary,
        alpha: 0.65,
      });

      const count = r.style === 'doubleRing' ? 92 : r.style === 'chrysanthemum' ? 84 : 70;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.16;
        let speed = 2.4 + Math.random() * 5.6;
        let color = i % 2 === 0 ? r.primary : r.secondary;
        let decay = 0.011 + Math.random() * 0.011;
        let gravity = 0.055;
        let size = 1.9 + Math.random() * 2.1;

        if (r.style === 'doubleRing') {
          const isOuter = i % 2 === 0;
          speed = isOuter ? 5.6 + Math.random() * 1.1 : 2.9 + Math.random() * 0.8;
          color = isOuter ? r.primary : r.secondary;
          decay = 0.012 + Math.random() * 0.008;
        } else if (r.style === 'willow') {
          speed = 1.8 + Math.random() * 4.4;
          color = i % 3 === 0 ? '#fffbeb' : '#ffd43b';
          decay = 0.0085 + Math.random() * 0.007;
          gravity = 0.038;
        } else if (r.style === 'strobe') {
          speed = 2.0 + Math.random() * 5.2;
          decay = 0.01 + Math.random() * 0.01;
          size = 2.1 + Math.random() * 2.2;
        }

        sparks.push({
          x: r.x,
          y: r.y,
          prevX: r.x,
          prevY: r.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          decay,
          gravity,
          size,
          color,
          strobe: r.style === 'strobe' || Math.random() < 0.25,
          phase: Math.random() * 10,
        });
      }
    }

    // Grand opening salvo
    spawnRocket(w * 0.26, h * 0.22);
    spawnRocket(w * 0.74, h * 0.24);
    setTimeout(() => { if (fireworksRaf) spawnRocket(w * 0.5, h * 0.16); }, 220);
    setTimeout(() => { if (fireworksRaf) spawnRocket(w * 0.18, h * 0.3); }, 420);
    setTimeout(() => { if (fireworksRaf) spawnRocket(w * 0.82, h * 0.28); }, 580);

    fireworksInterval = setInterval(() => {
      if (rockets.length < 9) {
        spawnRocket();
        if (Math.random() < 0.45) {
          setTimeout(() => {
            if (fireworksRaf) spawnRocket();
          }, 160);
        }
      }
    }, 460);

    function tick() {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.19)';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      // Sky flash bloom on detonation
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        const fg = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, f.radius);
        fg.addColorStop(0, '#ffffff');
        fg.addColorStop(0.28, f.color);
        fg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.globalAlpha = f.alpha;
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        ctx.fill();
        f.alpha -= 0.048;
        if (f.alpha <= 0) flashes.splice(i, 1);
      }

      // Rising rockets
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.trail.push({ x: r.x, y: r.y });
        if (r.trail.length > 10) r.trail.shift();

        r.x += r.vx;
        r.y += r.vy;
        r.vy += 0.12;

        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        for (let t = 0; t < r.trail.length; t++) {
          const pt = r.trail[t];
          if (t === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = r.primary;
        ctx.lineWidth = 2.6;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(r.x, r.y, 3.1, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        if (r.y <= r.targetY || r.vy >= -0.6) {
          explode(r);
          rockets.splice(i, 1);
        }
      }

      // Luminous firework rays & sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.prevX = s.x;
        s.prevY = s.y;
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.968;
        s.vy = s.vy * 0.968 + s.gravity;
        s.alpha -= s.decay;
        s.phase += 0.38;

        if (s.alpha <= 0) {
          sparks.splice(i, 1);
          continue;
        }

        const flicker = s.strobe ? (Math.sin(s.phase) > 0 ? 1 : 0.42) : 1;
        ctx.globalAlpha = Math.max(0, s.alpha * flicker);

        // Glowing streak tail
        ctx.beginPath();
        ctx.moveTo(s.prevX, s.prevY);
        ctx.lineTo(s.x, s.y);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.size * 1.35;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Bright ember core
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 0.72, 0, Math.PI * 2);
        ctx.fillStyle = s.alpha > 0.55 ? '#ffffff' : s.color;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      fireworksRaf = requestAnimationFrame(tick);
    }

    fireworksRaf = requestAnimationFrame(tick);
  }

  function stopChristmasFireworks() {
    if (fireworksRaf) {
      cancelAnimationFrame(fireworksRaf);
      fireworksRaf = null;
    }
    if (fireworksInterval) {
      clearInterval(fireworksInterval);
      fireworksInterval = null;
    }
    const canvas = document.getElementById('xmasFireworksCanvas');
    if (canvas) {
      if (canvas._fwResize) {
        window.removeEventListener('resize', canvas._fwResize);
        canvas._fwResize = null;
      }
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  let santaSleighAudio = null;
  let santaAudioMuted = false;
  let santaFlightRaf = null;
  let santaReindeerReady = false;

  function buildAdventReindeerSVG({ x, y, scale, isBack, harnessColor, phase, isRudolph }) {
    const fur = isBack ? 'url(#furBack)' : 'url(#furFront)';
    const belly = isBack ? 'url(#bellyBack)' : 'url(#bellyFront)';
    const legFarColor = isBack ? '#3d1c0a' : '#5e2b0f';
    const harnessMain = harnessColor === 'green' ? '#16a34a' : '#dc2626';
    const harnessTrim = harnessColor === 'green' ? '#dc2626' : '#16a34a';

    const noseMarkup = isRudolph
      ? `<circle cx="96" cy="24" r="19" fill="url(#rudolphHalo)" class="rudolph-aura"/>
         <g class="rudolph-aura" stroke="#fef08a" stroke-width="1.3" stroke-linecap="round" opacity="0.85">
           <line x1="96" y1="8" x2="96" y2="14"/><line x1="96" y1="34" x2="96" y2="40"/>
           <line x1="80" y1="24" x2="86" y2="24"/><line x1="106" y1="24" x2="112" y2="24"/>
         </g>
         <circle cx="96" cy="24" r="4.6" fill="#ff1e1e"/>
         <circle cx="94.8" cy="22.8" r="1.5" fill="#ffffff" opacity="0.9"/>`
      : `<circle cx="95" cy="24" r="3" fill="#1c1917"/>`;

    return `
      <g transform="translate(${x}, ${y}) scale(${scale})">
        <g class="reindeer-group" style="--phase: ${phase}s;">
          <g class="leg-back-far">
            <path d="M22 52 L10 74 L2 86" stroke="${legFarColor}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <path d="M2 86 L-3 89" stroke="#1c1917" stroke-width="5.5" stroke-linecap="round"/>
          </g>
          <g class="leg-front-far">
            <path d="M62 52 L76 68 L84 82" stroke="${legFarColor}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <path d="M84 82 L88 85" stroke="#1c1917" stroke-width="5" stroke-linecap="round"/>
          </g>
          <g class="reindeer-tail">
            <path d="M12 44 C2 38, 0 48, 9 50 Z" fill="${belly}"/>
          </g>
          <path d="M12 46 C18 32, 46 32, 60 36 C68 28, 72 18, 78 14 C86 12, 92 18, 95 23 C96 28, 90 32, 81 32 C76 42, 72 54, 58 58 C42 62, 20 60, 12 46 Z" fill="${fur}"/>
          <path d="M24 55 C38 59, 58 57, 68 48 C74 42, 78 33, 81 28 C76 30, 70 39, 64 46 C52 53, 36 54, 24 55 Z" fill="${belly}" opacity="0.92"/>
          <g stroke="url(#antlerGrad)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none">
            <path d="M77 14 C72 4, 64 -4, 56 -6 M68 2 L68 -8 M62 -2 L54 2"/>
            <path d="M81 13 C80 2, 76 -8, 69 -12 M78 0 L86 -6 M74 -6 L76 -15 M72 -8 L63 -10"/>
          </g>
          <path d="M75 17 C68 12, 63 16, 68 21 Z" fill="${fur}"/>
          <path d="M73 17 C69 15, 67 17, 69 19 Z" fill="#f5d0b5"/>
          <circle cx="84" cy="21" r="2.2" fill="#0f172a"/>
          <circle cx="84.7" cy="20.2" r="0.8" fill="#ffffff"/>
          <path d="M62 34 C66 44, 63 54, 54 57" stroke="${harnessMain}" stroke-width="5.5" stroke-linecap="round" fill="none"/>
          <path d="M38 35 C42 46, 40 56, 36 59" stroke="${harnessTrim}" stroke-width="4.5" stroke-linecap="round" fill="none"/>
          <path d="M40 46 Q52 49, 63 45" stroke="${harnessMain}" stroke-width="3.2" fill="none"/>
          <path d="M79 18 Q86 24, 92 25" stroke="${harnessMain}" stroke-width="1.8" fill="none"/>
          <circle cx="63" cy="40" r="2.8" fill="url(#goldShine)"/>
          <circle cx="61" cy="48" r="2.8" fill="url(#goldShine)"/>
          <circle cx="56" cy="54" r="2.8" fill="url(#goldShine)"/>
          <circle cx="40" cy="46" r="2.6" fill="url(#goldShine)"/>
          <g class="leg-back">
            <path d="M24 52 L14 72 L4 88" stroke="${fur}" stroke-width="7.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <path d="M4 88 L-1 92" stroke="#1c1917" stroke-width="6" stroke-linecap="round"/>
          </g>
          <g class="leg-front">
            <path d="M60 52 L74 64 L85 78" stroke="${fur}" stroke-width="6.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <path d="M85 78 L90 81" stroke="#1c1917" stroke-width="5.5" stroke-linecap="round"/>
          </g>
          ${noseMarkup}
        </g>
      </g>`;
  }

  function ensureSantaReindeerBuilt() {
    if (santaReindeerReady) return;
    const backLayer = document.getElementById('xmasBackReindeerLayer');
    const frontLayer = document.getElementById('xmasFrontReindeerLayer');
    if (!backLayer || !frontLayer) return;

    const backCfg = [
      { x: 350, y: 74, scale: 0.90, isBack: true, harnessColor: 'green', phase: -0.15, isRudolph: false },
      { x: 492, y: 64, scale: 0.92, isBack: true, harnessColor: 'red', phase: -0.42, isRudolph: false },
      { x: 634, y: 52, scale: 0.94, isBack: true, harnessColor: 'green', phase: -0.68, isRudolph: false },
    ];
    const frontCfg = [
      { x: 368, y: 102, scale: 1.04, isBack: false, harnessColor: 'red', phase: 0.0, isRudolph: false },
      { x: 512, y: 90, scale: 1.06, isBack: false, harnessColor: 'green', phase: -0.28, isRudolph: false },
      { x: 656, y: 76, scale: 1.10, isBack: false, harnessColor: 'red', phase: -0.52, isRudolph: true },
    ];

    backLayer.innerHTML = backCfg.map(buildAdventReindeerSVG).join('');
    frontLayer.innerHTML = frontCfg.map(buildAdventReindeerSVG).join('');
    santaReindeerReady = true;
  }

  function startSantaFlight() {
    const canvas = document.getElementById('xmasSantaTrailCanvas');
    const rig = document.getElementById('xmasSantaRig');
    if (!canvas || !rig) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ensureSantaReindeerBuilt();
    stopSantaFlight();

    let viewW = window.innerWidth;
    let viewH = window.innerHeight;
    function resize() {
      viewW = window.innerWidth;
      viewH = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewW * dpr);
      canvas.height = Math.floor(viewH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', resize);
    canvas._santaResize = resize;
    resize();

    const MAGIC_COLORS = ['#fde047', '#f59e0b', '#f472b6', '#fb7185', '#22d3ee', '#ffffff'];
    const particles = [];
    const rigWInit = rig.offsetWidth || 440;
    // Start in view right after opening, flying across the sky lane above the celebration card
    let x = -Math.min(180, rigWInit * 0.38);
    let baseY = Math.max(24, Math.min(72, viewH * 0.06));
    let flying = true;
    let pauseTimer = 0;
    let lastTime = performance.now();

    function spawnParticle(px, py, isRudolph) {
      if (particles.length > 200) return;
      const r = Math.random();
      const kind = isRudolph ? 'spark' : (r < 0.54 ? 'dust' : (r < 0.84 ? 'star' : 'snow'));
      particles.push({
        kind,
        x: px + (Math.random() - 0.5) * 18,
        y: py + (Math.random() - 0.5) * 16,
        vx: -Math.random() * 52 - 14,
        vy: (Math.random() - 0.5) * 20 + (kind === 'snow' ? 18 : 6),
        size: isRudolph ? Math.random() * 2.8 + 1.6 : (kind === 'dust' ? Math.random() * 2.4 + 1.1 : Math.random() * 4.4 + 2.5),
        life: 0,
        maxLife: isRudolph ? Math.random() * 0.5 + 0.3 : Math.random() * 1.0 + 0.55,
        color: isRudolph ? (Math.random() > 0.35 ? '#ff4d4d' : '#fde047') : (kind === 'snow' ? '#e0f2fe' : MAGIC_COLORS[Math.floor(Math.random() * MAGIC_COLORS.length)]),
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 4.5,
      });
    }

    function localToScreen(rx, ry, rw, rh, ang, u, v) {
      const cx = rx + rw * 0.5;
      const cy = ry + rh * 0.5;
      const dx = (u - 0.5) * rw;
      const dy = (v - 0.5) * rh;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
    }

    function getWaveY(xp, span) {
      const p = xp / Math.max(1, span);
      const amp1 = Math.min(26, viewH * 0.036);
      const amp2 = Math.min(10, viewH * 0.015);
      return baseY + Math.sin(p * Math.PI * 2.4) * amp1 + Math.sin(p * Math.PI * 5.0) * amp2;
    }

    function drawStar(cx, cy, outerR, color, alpha, rot) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      const innerR = outerR * 0.34;
      for (let k = 0; k < 8; k++) {
        const rad = k % 2 === 0 ? outerR : innerR;
        const ang = (k * Math.PI) / 4;
        const sx = Math.cos(ang) * rad;
        const sy = Math.sin(ang) * rad;
        if (k === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const rigW = rig.offsetWidth || 440;
      const rigH = rig.offsetHeight || (rigW * 250) / 860;
      const span = viewW + rigW + 140;

      if (flying) {
        const speed = viewW < 640 ? 155 : 210;
        x += speed * dt;
        const y = getWaveY(x + rigW, span);
        const yNext = getWaveY(x + rigW + 18, span);
        const pitch = Math.max(-0.22, Math.min(0.22, Math.atan2(yNext - y, 18) * 0.85));
        rig.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${pitch.toFixed(4)}rad)`;

        const sleighEmit = localToScreen(x, y, rigW, rigH, pitch, 0.14, 0.84);
        const rudolphPos = localToScreen(x, y, rigW, rigH, pitch, 0.885, 0.41);
        spawnParticle(sleighEmit.x, sleighEmit.y, false);
        spawnParticle(sleighEmit.x, sleighEmit.y, false);
        if (Math.random() < 0.72) spawnParticle(rudolphPos.x, rudolphPos.y, true);

        if (x > viewW + 80) {
          flying = false;
          pauseTimer = 1.4;
        }
      } else {
        pauseTimer -= dt;
        if (pauseTimer <= 0) {
          x = -rigW - 40;
          baseY = Math.max(22, Math.min(76, viewH * (0.04 + Math.random() * 0.05)));
          flying = true;
        }
      }

      ctx.clearRect(0, 0, viewW, viewH);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vRot * dt;

        const prog = p.life / p.maxLife;
        const alpha = Math.sin((1 - prog) * Math.PI * 0.5);
        const scale = 1 - prog * 0.45;

        if (p.kind === 'star') {
          drawStar(p.x, p.y, p.size * scale, p.color, alpha, p.rot);
        } else {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.6, p.size * scale), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      santaFlightRaf = requestAnimationFrame(frame);
    }

    santaFlightRaf = requestAnimationFrame(frame);
  }

  function stopSantaFlight() {
    if (santaFlightRaf) {
      cancelAnimationFrame(santaFlightRaf);
      santaFlightRaf = null;
    }
    const canvas = document.getElementById('xmasSantaTrailCanvas');
    if (canvas) {
      if (canvas._santaResize) {
        window.removeEventListener('resize', canvas._santaResize);
        canvas._santaResize = null;
      }
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function playSantaAudio() {
    if (santaAudioMuted) return;
    if (!santaSleighAudio) {
      santaSleighAudio = new Audio('assets/campanas-trineo.mp3');
      santaSleighAudio.loop = true;
      santaSleighAudio.volume = 0.65;
    }
    santaSleighAudio.currentTime = 0;
    santaSleighAudio.play().catch(() => {});
  }

  function stopSantaAudio() {
    if (!santaSleighAudio) return;
    santaSleighAudio.pause();
    santaSleighAudio.currentTime = 0;
  }

  function showChristmasFinale(entry, allCompleted = false) {
    const overlay = document.getElementById('christmasFinaleOverlay');
    if (!overlay || !entry) return;

    const sub = document.getElementById('christmasFinaleSubtitle');
    const poster = document.getElementById('christmasFinalePoster');
    const title = document.getElementById('christmasFinaleMovieTitle');
    const meta = document.getElementById('christmasFinaleMovieMeta');
    const playBtn = document.getElementById('christmasFinalePlayBtn');
    const audioBtn = document.getElementById('christmasFinaleAudioBtn');
    const confettiWrap = document.getElementById('christmasFinaleConfetti');

    if (audioBtn) {
      audioBtn.textContent = santaAudioMuted ? '🔇 Silencio' : '🔊 Sonido';
      if (!audioBtn.dataset.bound) {
        audioBtn.dataset.bound = '1';
        audioBtn.addEventListener('click', () => {
          santaAudioMuted = !santaAudioMuted;
          audioBtn.textContent = santaAudioMuted ? '🔇 Silencio' : '🔊 Sonido';
          if (santaAudioMuted) {
            stopSantaAudio();
          } else {
            playSantaAudio();
          }
        });
      }
    }

    if (sub) {
      sub.textContent = allCompleted
        ? '¡Completaste las 24 películas del Calendario de Adviento! Disfruta una Navidad mágica en PelisStart.'
        : 'Has descubierto la última casilla de Nochebuena del Calendario de Adviento. ¡Que disfrutes la función!';
    }
    if (poster) {
      poster.src = entry.poster || '';
      poster.alt = entry.title || '';
    }
    if (title) title.textContent = entry.title || '';
    if (meta) meta.textContent = `Día ${entry.day} • ${entry.year} • ★ ${entry.rating}`;
    if (playBtn) playBtn.dataset.movieId = entry.id;

    if (confettiWrap) {
      const colors = ['#ff2e4c', '#ffd43b', '#22ff7a', '#38d6ff', '#ffffff', '#ff8c24'];
      const icons = ['✦', '❄', '★', '●'];
      confettiWrap.innerHTML = Array.from({ length: 28 }, (_, idx) => {
        const left = (idx * 3.5 + Math.random() * 2.5).toFixed(1);
        const delay = (Math.random() * 1.4).toFixed(2);
        const dur = (2.6 + Math.random() * 1.8).toFixed(2);
        const color = colors[idx % colors.length];
        const symbol = icons[idx % icons.length];
        const size = (12 + (idx % 4) * 4);
        return `<span class="xmas-confetti-piece" style="left:${left}%;animation-delay:${delay}s;animation-duration:${dur}s;color:${color};font-size:${size}px;">${symbol}</span>`;
      }).join('');
    }

    overlay.classList.remove('hidden');
    playSantaAudio();
    startSantaFlight();
    startChristmasFireworks();
  }

  function closeChristmasFinale() {
    const overlay = document.getElementById('christmasFinaleOverlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    stopChristmasFireworks();
    stopSantaFlight();
    stopSantaAudio();
    const confettiWrap = document.getElementById('christmasFinaleConfetti');
    if (confettiWrap) confettiWrap.innerHTML = '';
  }
  function getAdventDateStatus() {
    const now = new Date();
    const month = now.getMonth(); // 11 = diciembre
    const date = now.getDate();
    if (month === 11) {
      return {
        isDecember: true,
        todayDate: date,
        unlockedUpTo: Math.min(24, date),
        daysUntilDec1: 0,
      };
    }
    const targetYear = month < 11 ? now.getFullYear() : now.getFullYear() + 1;
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dec1 = new Date(targetYear, 11, 1);
    const daysUntilDec1 = Math.max(1, Math.round((dec1 - todayMidnight) / 86400000));
    return {
      isDecember: false,
      todayDate: 0,
      unlockedUpTo: 0,
      daysUntilDec1,
    };
  }

  function renderAdventCalendar(justOpenedDay = null) {
    if (!dom.adventGrid) return;
    const { isDecember, todayDate, unlockedUpTo, daysUntilDec1 } = getAdventDateStatus();

    // Garantiza que nunca queden guardadas casillas futuras bloqueadas
    let pruned = false;
    Array.from(state.openedAdventDays).forEach((d) => {
      if (d > unlockedUpTo) {
        state.openedAdventDays.delete(d);
        pruned = true;
      }
    });
    if (pruned) {
      saveJson(STORAGE_KEYS.advent, Array.from(state.openedAdventDays));
    }

    const openedCount = state.openedAdventDays.size;
    if (dom.adventProgressBadge) {
      dom.adventProgressBadge.textContent = `${openedCount} / ${ADVENT_CALENDAR.length} abiertas`;
    }

    const subtitleEl = document.getElementById('adventSubtitle');
    if (subtitleEl) {
      if (!isDecember) {
        subtitleEl.textContent = `🔒 Cada película se desbloquea en su día de diciembre (del 1 al 24). Faltan ${daysUntilDec1} ${daysUntilDec1 === 1 ? 'día' : 'días'} para abrir el Día 1.`;
      } else if (todayDate <= 24) {
        subtitleEl.textContent = `🎄 Hoy es ${todayDate} de diciembre: ya puedes abrir hasta el Día ${unlockedUpTo}. Las demás casillas se desbloquean en su fecha.`;
      } else {
        subtitleEl.textContent = '🎄 ¡Feliz Navidad! Todas las casillas del Calendario de Adviento ya están desbloqueadas.';
      }
    }

    dom.adventGrid.innerHTML = ADVENT_CALENDAR.map((entry) => {
      const isLocked = entry.day > unlockedUpTo;
      const isToday = isDecember && entry.day === todayDate;
      const isOpened = !isLocked && state.openedAdventDays.has(entry.day);
      const isJustOpened = justOpenedDay === entry.day;
      const watched = Boolean(state.progress[entry.id]?.time > 15 || state.history.some((h) => h.id === entry.id));

      if (isLocked) {
        return `
          <button type="button" class="advent-door is-wrapped is-locked" data-advent-day="${entry.day}" aria-disabled="true" aria-label="Día ${entry.day} bloqueado hasta el ${entry.day} de diciembre">
            <span class="advent-ribbon-v" aria-hidden="true"></span>
            <span class="advent-ribbon-h" aria-hidden="true"></span>
            <span class="advent-day-num">${entry.day}</span>
            <span class="advent-day-label">Diciembre</span>
            <span class="advent-door-hint">🔒 ${entry.day} Dic</span>
          </button>`;
      }

      if (!isOpened) {
        return `
          <button type="button" class="advent-door is-wrapped ${isToday ? 'is-today' : ''}" data-advent-day="${entry.day}" aria-label="Abrir día ${entry.day} de diciembre">
            <span class="advent-ribbon-v" aria-hidden="true"></span>
            <span class="advent-ribbon-h" aria-hidden="true"></span>
            ${isToday ? '<span class="advent-today-badge">¡Hoy!</span>' : ''}
            <span class="advent-day-num">${entry.day}</span>
            <span class="advent-day-label">Diciembre</span>
            <span class="advent-door-hint">🎁 Toca para abrir</span>
          </button>`;
      }

      return `
        <button type="button" class="advent-door is-opened ${isToday ? 'is-today' : ''} ${isJustOpened ? 'is-revealing' : ''}" data-advent-day="${entry.day}" aria-label="Ver Día ${entry.day}: ${escapeHtml(entry.title)}">
          <div class="advent-poster-wrap">
            <img src="${escapeHtml(entry.poster)}" alt="${escapeHtml(entry.title)}" loading="lazy" />
            <span class="advent-day-pill">Día ${entry.day}</span>
            ${watched ? '<span class="advent-watched-pill">✓ Vista</span>' : ''}
            <span class="advent-play-overlay" aria-hidden="true">▶ Ver ahora</span>
          </div>
          <div class="advent-card-info">
            <strong class="advent-movie-title">${escapeHtml(entry.title)}</strong>
            <span class="advent-movie-meta">${escapeHtml(entry.year)} • ★ ${escapeHtml(entry.rating)}</span>
          </div>
        </button>`;
    }).join('');
  }

  function openAdventModal() {
    if (!dom.adventModal) return;
    if (dom.mobileMenu) dom.mobileMenu.classList.add('hidden');
    renderAdventCalendar();
    dom.adventModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeAdventModal() {
    if (!dom.adventModal) return;
    dom.adventModal.classList.add('hidden');
    if (dom.playerModal.classList.contains('hidden')) {
      document.body.style.overflow = '';
    }
  }

  function showToast(message) {
    if (!dom.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast-item';
    toast.innerHTML = `<span class="toast-dot"></span><span>${escapeHtml(message)}</span>`;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2600);
  }

  /* ==================== Christmas Snowfall + Colored Stars (60+ FPS Optimized) ==================== */
  function initSnowfall() {
    const canvas = document.getElementById('nieveCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Pre-render soft-glow white snowflake sprite
    const sprite = document.createElement('canvas');
    sprite.width = 24;
    sprite.height = 24;
    const sctx = sprite.getContext('2d');
    const grad = sctx.createRadialGradient(12, 12, 1, 12, 12, 11);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.75)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 24, 24);

    // Pre-render colorful Christmas star sprites (✦ sparkle & ★ star with colored halo)
    const starColors = [
      { core: '#ffe66d', glow: 'rgba(255, 212, 59, 0.55)' },
      { core: '#ff4764', glow: 'rgba(255, 46, 76, 0.55)' },
      { core: '#38ff8c', glow: 'rgba(34, 255, 122, 0.5)' },
      { core: '#52dfff', glow: 'rgba(56, 214, 255, 0.52)' },
      { core: '#ff9d3b', glow: 'rgba(255, 140, 36, 0.52)' },
      { core: '#ff6ad5', glow: 'rgba(255, 71, 194, 0.5)' },
    ];

    const starSprites = [];
    starColors.forEach((palette, idx) => {
      const cnv = document.createElement('canvas');
      cnv.width = 32;
      cnv.height = 32;
      const g = cnv.getContext('2d');

      const halo = g.createRadialGradient(16, 16, 1, 16, 16, 15);
      halo.addColorStop(0, palette.glow);
      halo.addColorStop(0.55, palette.glow.replace(/[\d.]+\)$/, '0.18)'));
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = halo;
      g.fillRect(0, 0, 32, 32);

      g.fillStyle = palette.core;
      g.beginPath();
      if (idx % 2 === 0) {
        // 4-point sparkle star ✦
        g.moveTo(16, 4);
        g.quadraticCurveTo(17.8, 14.2, 28, 16);
        g.quadraticCurveTo(17.8, 17.8, 16, 28);
        g.quadraticCurveTo(14.2, 17.8, 4, 16);
        g.quadraticCurveTo(14.2, 14.2, 16, 4);
      } else {
        // 5-point Christmas star ★
        const outer = 10.5;
        const inner = 4.6;
        for (let p = 0; p < 10; p++) {
          const r = p % 2 === 0 ? outer : inner;
          const a = -Math.PI / 2 + (p * Math.PI) / 5;
          const px = 16 + Math.cos(a) * r;
          const py = 16 + Math.sin(a) * r;
          if (p === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
      }
      g.closePath();
      g.fill();

      // White-hot sparkle core
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(16, 16, 1.9, 0, Math.PI * 2);
      g.fill();

      starSprites.push(cnv);
    });

    let ancho = window.innerWidth;
    let alto = window.innerHeight;
    let copos = [];

    function crearCopo(randomY = false) {
      const isStar = Math.random() < 0.24;
      return {
        isStar,
        tex: isStar ? starSprites[Math.floor(Math.random() * starSprites.length)] : sprite,
        x: Math.random() * ancho,
        y: randomY ? Math.random() * alto : -14 - Math.random() * 40,
        radio: isStar ? Math.random() * 2.2 + 2.4 : Math.random() * 2.8 + 1.0,
        velocidadY: isStar ? Math.random() * 1.6 + 0.85 : Math.random() * 1.9 + 0.9,
        velocidadX: Math.random() * 0.9 - 0.45,
        opacidad: isStar ? Math.random() * 0.35 + 0.62 : Math.random() * 0.55 + 0.35,
        oscilacionVel: Math.random() * 0.025 + 0.008,
        oscilacionAmplitud: Math.random() * 14 + 4,
        angulo: Math.random() * Math.PI * 2,
      };
    }

    function redimensionar() {
      ancho = window.innerWidth;
      alto = window.innerHeight;
      canvas.width = ancho;
      canvas.height = alto;
      const targetCount = Math.min(210, Math.max(75, Math.floor(ancho / 7.5)));
      copos = Array.from({ length: targetCount }, () => crearCopo(true));
    }

    window.addEventListener('resize', redimensionar);
    redimensionar();

    let lastTime = performance.now();

    function animarNieve(now) {
      const dt = Math.min(0.05, (now - lastTime) / 1000) * 60;
      lastTime = now;

      ctx.clearRect(0, 0, ancho, alto);

      for (let i = 0; i < copos.length; i++) {
        const c = copos[i];
        const size = c.isStar ? c.radio * 4.2 : c.radio * 3.2;

        ctx.globalAlpha = c.isStar
          ? c.opacidad * (0.78 + 0.22 * Math.sin(c.angulo * 2.4))
          : c.opacidad;
        ctx.drawImage(c.tex, c.x - size * 0.5, c.y - size * 0.5, size, size);

        c.y += c.velocidadY * dt;
        c.angulo += c.oscilacionVel * dt;
        c.x += (c.velocidadX + Math.sin(c.angulo) * (c.oscilacionAmplitud * 0.035)) * dt;

          if (c.y > alto + 16 || c.x < -20 || c.x > ancho + 20) {
            copos[i] = crearCopo(false);
          }
        }

        ctx.globalAlpha = 1;
        requestAnimationFrame(animarNieve);
      }

      requestAnimationFrame(animarNieve);
    }

    /* ==================== Init ==================== */
    function init() {
      updateFavBadge();
      renderHero();
      startHeroRotation();
      renderCategoryRail();
      renderCatalog();
      bindEvents();
      initSnowfall();
      loadProviders();
      loadApiConfig();
      loadDiscoverFeed(false);
    }

    init();
  }) ();
