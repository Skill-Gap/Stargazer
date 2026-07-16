// Stargazer Journal - simple modular JS (localStorage)
(() => {
  const LS_KEY = 'stargazer.entries.v1';
  const form = document.getElementById('entryForm');
  const entriesList = document.getElementById('entriesList');
  const clearBtn = document.getElementById('clear');

  function loadEntries(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
    }catch(e){console.error('loadEntries', e); return []}
  }

  function saveEntries(arr){
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
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
    const entries = loadEntries();
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
    })
  }

  function parseTags(raw){
    if(!raw) return [];
    return raw.split(',').map(s=>s.trim()).filter(Boolean);
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const title = document.getElementById('title').value.trim();
    const mood = document.getElementById('mood').value;
    const tagsRaw = document.getElementById('tags').value;
    const content = document.getElementById('content').value.trim();
    if(!content) return;
    const entries = loadEntries();
    const entry = {
      id: Date.now().toString(36),
      title, mood, tags: parseTags(tagsRaw), content,
      createdAt: new Date().toISOString()
    };
    entries.unshift(entry); // newest first
    saveEntries(entries);
    form.reset();
    renderEntries();
  });

  clearBtn.addEventListener('click', ()=>form.reset());

  // initial render
  renderEntries();
})();
