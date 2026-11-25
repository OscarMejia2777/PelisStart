// PelisStart Supabase Client & Cloud Sync Module
const SUPABASE_ESM_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

let supabase = null;
let supabaseEnabled = false;
let currentUser = null;
let initPromise = null;
let lastPlayLoggedKey = '';
let lastPlayLoggedAt = 0;

function sanitizeText(val, maxLen = 240) {
  return String(val ?? '').trim().slice(0, maxLen);
}

function normalizeMediaType(type) {
  return String(type || '').toLowerCase() === 'serial' ? 'serial' : 'movie';
}

function buildMediaMetadata(item) {
  return {
    categories: Array.isArray(item.categories) ? item.categories.slice(0, 8) : [],
    synopsis: sanitizeText(item.synopsis || '', 600),
    tmdbId: sanitizeText(item.tmdbId || '', 32),
    trailerYt: sanitizeText(item.trailerYt || '', 32),
    source: sanitizeText(item.source || '', 64),
    sources: item.sources || null,
  };
}

export function isSupabaseEnabled() {
  return supabaseEnabled && Boolean(supabase);
}

export function getCurrentUser() {
  return currentUser;
}

export async function initSupabaseSync(onAuthChange) {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const res = await fetch('/api/supabase-config');
      const cfg = await res.json();
      if (!cfg?.enabled || !cfg?.url || !cfg?.publishableKey) {
        supabaseEnabled = false;
        return { enabled: false, user: null };
      }

      const mod = await import(SUPABASE_ESM_URL);
      const createClient = mod.createClient || mod.default?.createClient;
      if (typeof createClient !== 'function') {
        supabaseEnabled = false;
        return { enabled: false, user: null };
      }

      supabase = createClient(cfg.url, cfg.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      supabaseEnabled = true;

      const { data } = await supabase.auth.getSession();
      currentUser = data?.session?.user || null;

      supabase.auth.onAuthStateChange((event, session) => {
        const nextUser = session?.user || null;
        const prevId = currentUser?.id || null;
        const nextId = nextUser?.id || null;
        currentUser = nextUser;
        if (typeof onAuthChange === 'function' && (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' || prevId !== nextId)) {
          onAuthChange(nextUser, event);
        }
      });

      return { enabled: true, user: currentUser };
    } catch {
      supabaseEnabled = false;
      return { enabled: false, user: null };
    }
  })();

  return initPromise;
}

export async function signInWithEmail(email, password) {
  if (!isSupabaseEnabled()) throw new Error('Supabase no está disponible en este servidor.');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: sanitizeText(email, 160),
    password: String(password || ''),
  });
  if (error) throw error;
  currentUser = data?.user || null;
  return data;
}

export async function signUpWithEmail(email, password, displayName) {
  if (!isSupabaseEnabled()) throw new Error('Supabase no está disponible en este servidor.');
  const cleanName = sanitizeText(displayName, 80);
  const { data, error } = await supabase.auth.signUp({
    email: sanitizeText(email, 160),
    password: String(password || ''),
    options: {
      data: cleanName ? { display_name: cleanName } : {},
    },
  });
  if (error) throw error;
  if (data?.session?.user) {
    currentUser = data.session.user;
  }
  return data;
}

export async function signOutAccount() {
  if (!isSupabaseEnabled()) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  currentUser = null;
}

export async function updateUserProfile(updates) {
  if (!isSupabaseEnabled() || !currentUser) return null;
  const payload = {
    user_id: currentUser.id,
    updated_at: new Date().toISOString(),
  };
  if (typeof updates.display_name === 'string') {
    payload.display_name = sanitizeText(updates.display_name, 80);
  }
  if (typeof updates.preferred_provider === 'string') {
    payload.preferred_provider = sanitizeText(updates.preferred_provider, 64);
  }
  if (typeof updates.preferred_lang === 'string') {
    payload.preferred_lang = sanitizeText(updates.preferred_lang, 24);
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function syncAndHydrateCloudData({
  localFavorites,
  localHistory,
  localProgress,
  localAdventDays,
  localAdventWatchedIds,
  localProvider,
  localLang,
  adventYear,
  resolveItemById,
  adventEntries,
}) {
  if (!isSupabaseEnabled() || !currentUser) return null;

  const userId = currentUser.id;
  const fallbackName =
    sanitizeText(currentUser.user_metadata?.display_name, 80) ||
    sanitizeText((currentUser.email || '').split('@')[0], 80) ||
    'Cinéfilo';

  // Ensure profile exists cleanly
  await supabase.from('profiles').upsert(
    {
      user_id: userId,
      display_name: fallbackName,
    },
    { onConflict: 'user_id', ignoreDuplicates: true }
  );

  const [profRes, favRes, histRes, advRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('user_favorites').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('user_watch_history').select('*').eq('user_id', userId).order('last_watched_at', { ascending: false }).limit(50),
    supabase.from('user_advent_progress').select('*').eq('user_id', userId).eq('year', adventYear).order('day', { ascending: true }),
  ]);

  const cloudProfile = profRes.data || { user_id: userId, display_name: fallbackName, preferred_provider: localProvider || '', preferred_lang: localLang || 'latino' };
  const cloudFavRows = Array.isArray(favRes.data) ? favRes.data : [];
  const cloudHistRows = Array.isArray(histRes.data) ? histRes.data : [];
  const cloudAdvRows = Array.isArray(advRes.data) ? advRes.data : [];

  // Migrate local favorites not yet in cloud
  const cloudFavIds = new Set(cloudFavRows.map((r) => r.media_id));
  const favsToInsert = [];
  for (const id of localFavorites) {
    if (cloudFavIds.has(id)) continue;
    const item = resolveItemById(id) || localHistory.find((h) => h.id === id);
    if (!item) continue;
    favsToInsert.push({
      user_id: userId,
      media_id: sanitizeText(item.id, 64),
      media_type: normalizeMediaType(item.type),
      title: sanitizeText(item.title || item.id, 240),
      poster: sanitizeText(item.poster || '', 500),
      backdrop: sanitizeText(item.backdrop || '', 500),
      year: sanitizeText(item.year || '', 16),
      rating: sanitizeText(item.rating || '', 16),
      metadata: buildMediaMetadata(item),
    });
  }
  if (favsToInsert.length > 0) {
    await supabase.from('user_favorites').upsert(favsToInsert, { onConflict: 'user_id,media_id' });
  }

  // Migrate local history/progress not yet in cloud
  const cloudHistIds = new Set(cloudHistRows.map((r) => r.media_id));
  const histToInsert = [];
  for (const h of localHistory) {
    if (!h?.id || cloudHistIds.has(h.id)) continue;
    const prog = localProgress?.[h.id];
    histToInsert.push({
      user_id: userId,
      media_id: sanitizeText(h.id, 64),
      media_type: normalizeMediaType(h.type),
      title: sanitizeText(h.title || h.id, 240),
      poster: sanitizeText(h.poster || '', 500),
      backdrop: sanitizeText(h.backdrop || '', 500),
      year: sanitizeText(h.year || '', 16),
      rating: sanitizeText(h.rating || '', 16),
      duration: sanitizeText(h.duration || '', 32),
      last_season: Math.max(1, Number(h.lastSeason) || 1),
      last_episode: Math.max(1, Number(h.lastEpisode) || 1),
      watched_episodes: Array.isArray(h.watchedEpisodes) ? h.watchedEpisodes.slice(0, 200) : [],
      progress_seconds: Math.max(0, Math.floor(Number(prog?.time) || 0)),
      duration_seconds: Math.max(0, Math.floor(Number(prog?.duration) || 0)),
      play_count: 1,
      media_data: buildMediaMetadata(h),
      last_watched_at: h.ts ? new Date(h.ts).toISOString() : new Date().toISOString(),
    });
  }
  if (histToInsert.length > 0) {
    await supabase.from('user_watch_history').upsert(histToInsert, { onConflict: 'user_id,media_id' });
  }

  // Migrate local advent progress
  const cloudAdvDays = new Set(cloudAdvRows.map((r) => Number(r.day)));
  const advToInsert = [];
  for (const day of localAdventDays) {
    const numDay = Number(day);
    if (cloudAdvDays.has(numDay)) continue;
    const entry = adventEntries.find((a) => a.day === numDay);
    advToInsert.push({
      user_id: userId,
      year: adventYear,
      day: numDay,
      media_id: sanitizeText(entry?.id || '', 64),
      watched: Boolean(entry?.id && localAdventWatchedIds?.has(entry.id)),
    });
  }
  if (advToInsert.length > 0) {
    await supabase.from('user_advent_progress').upsert(advToInsert, { onConflict: 'user_id,year,day' });
  }

  // Re-read after merge if anything migrated
  const finalFavRows =
    favsToInsert.length > 0
      ? (await supabase.from('user_favorites').select('*').eq('user_id', userId).order('created_at', { ascending: false })).data || cloudFavRows
      : cloudFavRows;
  const finalHistRows =
    histToInsert.length > 0
      ? (await supabase.from('user_watch_history').select('*').eq('user_id', userId).order('last_watched_at', { ascending: false }).limit(50)).data || cloudHistRows
      : cloudHistRows;
  const finalAdvRows =
    advToInsert.length > 0
      ? (await supabase.from('user_advent_progress').select('*').eq('user_id', userId).eq('year', adventYear).order('day', { ascending: true })).data || cloudAdvRows
      : cloudAdvRows;

  return {
    profile: cloudProfile,
    favorites: finalFavRows,
    history: finalHistRows,
    advent: finalAdvRows,
  };
}

export async function cloudSetFavorite(item, isFavorite) {
  if (!isSupabaseEnabled() || !currentUser || !item?.id) return;
  try {
    if (isFavorite) {
      await supabase.from('user_favorites').upsert(
        {
          user_id: currentUser.id,
          media_id: sanitizeText(item.id, 64),
          media_type: normalizeMediaType(item.type),
          title: sanitizeText(item.title || item.id, 240),
          poster: sanitizeText(item.poster || '', 500),
          backdrop: sanitizeText(item.backdrop || '', 500),
          year: sanitizeText(item.year || '', 16),
          rating: sanitizeText(item.rating || '', 16),
          metadata: buildMediaMetadata(item),
        },
        { onConflict: 'user_id,media_id' }
      );
    } else {
      await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('media_id', sanitizeText(item.id, 64));
    }
  } catch {
    // Non-blocking cloud sync
  }
}

export async function cloudUpsertHistory(item, opts = {}) {
  if (!isSupabaseEnabled() || !currentUser || !item?.id) return;
  try {
    const mediaId = sanitizeText(item.id, 64);
    const { data: existing } = await supabase
      .from('user_watch_history')
      .select('play_count,watched_episodes,progress_seconds,duration_seconds')
      .eq('user_id', currentUser.id)
      .eq('media_id', mediaId)
      .maybeSingle();

    const watchedSet = new Set(Array.isArray(existing?.watched_episodes) ? existing.watched_episodes : []);
    if (Array.isArray(opts.watchedEpisodes)) {
      opts.watchedEpisodes.forEach((k) => watchedSet.add(k));
    }

    const payload = {
      user_id: currentUser.id,
      media_id: mediaId,
      media_type: normalizeMediaType(item.type),
      title: sanitizeText(item.title || item.id, 240),
      poster: sanitizeText(item.poster || '', 500),
      backdrop: sanitizeText(item.backdrop || '', 500),
      year: sanitizeText(item.year || '', 16),
      rating: sanitizeText(item.rating || '', 16),
      duration: sanitizeText(item.duration || '', 32),
      last_season: Math.max(1, Number(opts.season) || 1),
      last_episode: Math.max(1, Number(opts.episode) || 1),
      watched_episodes: Array.from(watchedSet).slice(0, 400),
      progress_seconds: Math.max(0, Math.floor(Number(opts.progressSeconds ?? existing?.progress_seconds) || 0)),
      duration_seconds: Math.max(0, Math.floor(Number(opts.durationSeconds ?? existing?.duration_seconds) || 0)),
      play_count: opts.incrementPlay ? (Number(existing?.play_count) || 0) + 1 : Math.max(1, Number(existing?.play_count) || 1),
      media_data: buildMediaMetadata(item),
      last_watched_at: new Date().toISOString(),
    };

    await supabase.from('user_watch_history').upsert(payload, { onConflict: 'user_id,media_id' });
  } catch {
    // Non-blocking
  }
}

export async function cloudUpdateProgress(mediaId, timeSec, durationSec) {
  if (!isSupabaseEnabled() || !currentUser || !mediaId) return;
  try {
    await supabase
      .from('user_watch_history')
      .update({
        progress_seconds: Math.max(0, Math.floor(Number(timeSec) || 0)),
        duration_seconds: Math.max(0, Math.floor(Number(durationSec) || 0)),
        last_watched_at: new Date().toISOString(),
      })
      .eq('user_id', currentUser.id)
      .eq('media_id', sanitizeText(mediaId, 64));
  } catch {
    // Non-blocking
  }
}

export async function cloudMarkAdventDay(year, day, mediaId, watched = false) {
  if (!isSupabaseEnabled() || !currentUser) return;
  try {
    await supabase.from('user_advent_progress').upsert(
      {
        user_id: currentUser.id,
        year: Number(year),
        day: Number(day),
        media_id: sanitizeText(mediaId || '', 64),
        watched: Boolean(watched),
        opened_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,year,day' }
    );
  } catch {
    // Non-blocking
  }
}

export async function cloudResetAdventYear(year) {
  if (!isSupabaseEnabled() || !currentUser) return;
  try {
    await supabase
      .from('user_advent_progress')
      .delete()
      .eq('user_id', currentUser.id)
      .eq('year', Number(year));
  } catch {
    // Non-blocking
  }
}

export async function recordGlobalPlayEvent(item, episodeKey = '') {
  if (!item?.id || !item?.title) return false;
  const dedupeKey = `${item.id}:${episodeKey}`;
  const now = Date.now();
  if (dedupeKey === lastPlayLoggedKey && now - lastPlayLoggedAt < 90 * 1000) {
    return false;
  }
  lastPlayLoggedKey = dedupeKey;
  lastPlayLoggedAt = now;

  if (!isSupabaseEnabled()) return false;
  try {
    await supabase.from('media_play_events').insert({
      user_id: currentUser?.id || null,
      media_id: sanitizeText(item.id, 64),
      media_type: normalizeMediaType(item.type),
      title: sanitizeText(item.title, 240),
      poster: sanitizeText(item.poster || '', 500),
      backdrop: sanitizeText(item.backdrop || '', 500),
      year: sanitizeText(item.year || '', 16),
      rating: sanitizeText(item.rating || '', 16),
      duration: sanitizeText(item.duration || '', 32),
      metadata: buildMediaMetadata(item),
    });
    return true;
  } catch {
    return false;
  }
}

export async function fetchGlobalTopPlayed(limit = 18) {
  try {
    const res = await fetch(`/api/top-played?limit=${limit}`);
    const data = await res.json();
    if (Array.isArray(data?.items) && data.items.length > 0) {
      return data.items;
    }
  } catch {
    // Fallback to direct Supabase query if needed
  }

  if (!isSupabaseEnabled()) return [];
  try {
    const { data, error } = await supabase
      .from('media_play_stats')
      .select('media_id,media_type,title,poster,backdrop,year,rating,duration,metadata,total_plays,last_played_at')
      .order('total_plays', { ascending: false })
      .order('last_played_at', { ascending: false })
      .limit(limit);
    if (error || !Array.isArray(data)) return [];
    return data.map((row) => ({
      id: row.media_id,
      type: row.media_type === 'serial' ? 'serial' : 'movie',
      title: row.title,
      poster: row.poster || '',
      backdrop: row.backdrop || '',
      year: row.year || '',
      rating: row.rating || '',
      duration: row.duration || '',
      totalPlays: Number(row.total_plays) || 1,
      lastPlayedAt: row.last_played_at || '',
      categories: Array.isArray(row.metadata?.categories) ? row.metadata.categories : [],
      synopsis: row.metadata?.synopsis || '',
      tmdbId: row.metadata?.tmdbId || '',
      source: row.metadata?.source || 'PelisStart Top',
      sources: row.metadata?.sources || null,
    }));
  } catch {
    return [];
  }
}
