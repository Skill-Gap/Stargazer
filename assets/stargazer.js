// Stargazer Journal - server-backed with a local offline cache.
(() => {
  const LS_KEY = 'stargazer.entries.v1';
  const API_URL = '/api/journal/entries';
  const form = document.getElementById('entryForm');
  const entriesList = document.getElementById('entriesList');
  const clearBtn = document.getElementById('clear');
  const saveBtn = document.getElementById('saveEntry');
  const status = document.getElementById('journalStatus');
  let entries = [];
  let pendingEntry = null;

  function loadCachedEntries(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(entry => entry && entry.id) : [];
    }catch(e){console.error('loadCachedEntries', e); return []}
  }

  function saveCache(arr){
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(arr));
      return true;
    } catch (error) {
      console.error('saveCache', error);
      return false;
    }
  }

  function setStatus(message, isError = false){
    status.textContent = message;
    status.classList.toggle('error', isError);
  }

  function sortEntries(arr){
    return arr.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  function mergeById(serverEntries, localEntries){
    const merged = new Map();
    localEntries.forEach(entry => merged.set(String(entry.id), entry));
    serverEntries.forEach(entry => {
      if (entry && entry.id) merged.set(String(entry.id), entry);
    });
    return sortEntries([...merged.values()]);
  }

  function formatDate(iso){
    const d = new Date(iso);
    return d.toLocaleString();
  }

  function makeTagEl(tag){
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = tag;
    return span;
  }

  function renderEntries(){
    entriesList.innerHTML = '';
    if(!entries.length){
      const el = document.createElement('div'); el.className='empty'; el.textContent='No entries yet. Write your first stargaze ✨';
      entriesList.appendChild(el); return;
    }

    entries.forEach(entry => {
      const card = document.createElement('article'); card.className='card';
      const meta = document.createElement('div'); meta.className='meta';
      const title = document.createElement('div'); title.className='title'; title.textContent = entry.title || '(untitled)';
      const mood = document.createElement('div'); mood.className='mood'; mood.textContent = entry.mood || '';
      const date = document.createElement('div'); date.className='date'; date.textContent = formatDate(entry.createdAt);
      meta.appendChild(mood); meta.appendChild(date);

      const tagsWrap = document.createElement('div'); tagsWrap.className='tags';
      (entry.tags || []).slice(0,6).forEach(t => tagsWrap.appendChild(makeTagEl(t)));

      const content = document.createElement('div'); content.className='content'; content.textContent = entry.content || '';

      card.appendChild(title);
      card.appendChild(meta);
      card.appendChild(tagsWrap);
      card.appendChild(content);
      entriesList.appendChild(card);
    });
  }

  function parseTags(raw){
    if(!raw) return [];
    return raw.split(',').map(s=>s.trim()).filter(Boolean);
  }

  function createId(){
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  async function postEntry(entry){
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    if (!response.ok) throw new Error('Journal save failed');
  }

  async function syncEntries(){
    const localEntries = loadCachedEntries();
    entries = sortEntries([...localEntries]);
    renderEntries();

    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error('Journal load failed');
      const data = await response.json();
      const serverEntries = Array.isArray(data.entries) ? data.entries : [];
      const serverIds = new Set(serverEntries.map(entry => String(entry.id)));
      const unsynced = localEntries.filter(entry => !serverIds.has(String(entry.id)));

      entries = mergeById(serverEntries, localEntries);
      const cacheSaved = saveCache(entries);
      renderEntries();

      const results = await Promise.allSettled(unsynced.map(postEntry));
      const failed = results.filter(result => result.status === 'rejected').length;
      if (failed) {
        setStatus(`${failed} cached ${failed === 1 ? 'entry is' : 'entries are'} waiting to sync.`, true);
      } else if (!cacheSaved) {
        setStatus('Journal loaded from the server, but the offline cache is unavailable.', true);
      } else if (unsynced.length) {
        setStatus(`Journal loaded. Synced ${unsynced.length} cached ${unsynced.length === 1 ? 'entry' : 'entries'}.`);
      } else {
        setStatus('Journal is up to date.');
      }
    } catch (error) {
      console.warn('Journal sync unavailable', error);
      setStatus('Offline mode: showing entries saved on this browser.', true);
    }
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (pendingEntry) return;
    const title = document.getElementById('title').value.trim();
    const mood = document.getElementById('mood').value;
    const tagsRaw = document.getElementById('tags').value;
    const content = document.getElementById('content').value.trim();
    if(!content) return;
    pendingEntry = {
      id: createId(),
      title, mood, tags: parseTags(tagsRaw), content,
      createdAt: new Date().toISOString()
    };
    saveBtn.disabled = true;
    setStatus('Saving entry…');
    entries = mergeById([], [pendingEntry, ...entries]);
    const cacheSaved = saveCache(entries);
    renderEntries();
    if (cacheSaved) form.reset();

    try {
      await postEntry(pendingEntry);
      if (!cacheSaved) form.reset();
      setStatus(cacheSaved ? 'Entry saved and synced.' : 'Entry synced, but the offline cache is unavailable.', !cacheSaved);
    } catch (error) {
      console.warn('Journal entry could not be synced', error);
      if (cacheSaved) {
        setStatus('Entry saved on this browser and will sync when the server is available.', true);
      } else {
        entries = entries.filter(entry => entry.id !== pendingEntry.id);
        renderEntries();
        setStatus('Entry could not be saved. Your draft remains in the form.', true);
      }
    } finally {
      pendingEntry = null;
      saveBtn.disabled = false;
    }
  });

  clearBtn.addEventListener('click', ()=>form.reset());

  syncEntries();
})();
