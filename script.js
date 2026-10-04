'use strict';

const STORAGE_KEY = 'bierBingoInc.state.v1';
const SIZE = 5;
const CELL_COUNT = SIZE * SIZE;

// Songliste für "Leere Felder auffüllen"
const SONGS = [
  "I Sing a Lied für di", "Hulapalu", "Skandal im Sperrbezirk", "Verdammt, ich lieb' dich",
  "Atemlos durch die Nacht", "Sweet Caroline", "Wir fahren mit dem Bob (Bobfahrerlied)",
  "Angels", "Narcotic", "Gimme! Gimme! Gimme!", "Brenna tuats guat", "Griechischer Wein",
  "Fürstenfeld", "Y.M.C.A.", "Joana", "Ohne dich", "Bella Napoli", "Major Tom", "Wackelkontakt",
  "Take Me Home, Country Roads", "Cordula Grün", "Viva Colonia", "Cotton Eye Joe",
  "I Want It That Way", "1000 und 1 Nacht (Zoom!)", "Wahnsinn", "Sternenhimmel", "Titanium",
  "Freed from Desire", "Ich war noch niemals in New York", "Zombie", "99 Luftballons",
  "I'm Gonna Be (500 Miles)", "The Best", "Don't Stop Believin'", "Live Is Life",
  "Sweet Home Alabama", "Summer of '69", "Walking on Sunshine", "T.N.T.", "Highway to Hell",
  "You Give Love a Bad Name", "It's My Life", "I Was Made for Lovin' You", "Livin' on a Prayer",
  "Don't Stop Me Now", "Er gehört zu mir", "Irgendwie, irgendwo, irgendwann", "Ein Kompliment",
  "Tage wie diese", "Westerland", "So ein schöner Tag (Fliegerlied)", "Das rote Pferd",
  "We Will Rock You", "Hey Baby", "Marmor, Stein und Eisen bricht", "Weiß der Geier",
  "Bohemian Rhapsody", "Seven Nation Army", "We Are Young", "I Love Rock 'N' Roll",
  "Sarà perché ti amo", "We Are the Champions", "Macarena", "Volare", "Mon Amour",
  "Mamma Mia", "Schickeria", "Dance with Somebody", "Aber bitte mit Sahne",
  "Dancing Queen", "The Winner Takes It All", "Viva La Vida", "Gute Laune",
  "Sex on Fire", "It's Raining Men", "The Final Countdown", "Mr. Brightside",
  "Wonderwall", "I Will Survive", "Unwritten", "Ab in den Süden", "Monsta",
  "Proud Mary (Rolling on the River)", "What's Up?"
];

// Alle möglichen Bingo-Linien: 5 Reihen, 5 Spalten, 2 Diagonalen.
// x1/y1/x2/y2 = Strich-Koordinaten in Prozent der Rastergröße.
const LINES = [];
for (let r = 0; r < SIZE; r++) {
  const y = (r + 0.5) * 20;
  LINES.push({ name: `Reihe ${r + 1}`, cells: [0, 1, 2, 3, 4].map(c => r * SIZE + c),
    x1: 3, y1: y, x2: 97, y2: y });
}
for (let c = 0; c < SIZE; c++) {
  const x = (c + 0.5) * 20;
  LINES.push({ name: `Spalte ${c + 1}`, cells: [0, 1, 2, 3, 4].map(r => r * SIZE + c),
    x1: x, y1: 3, x2: x, y2: 97 });
}
LINES.push({ name: 'Diagonale ↘', cells: [0, 6, 12, 18, 24], x1: 4, y1: 4, x2: 96, y2: 96 });
LINES.push({ name: 'Diagonale ↙', cells: [4, 8, 12, 16, 20], x1: 96, y1: 4, x2: 4, y2: 96 });

// ---------- Zustand ----------

function defaultState() {
  return {
    mode: 'edit',                           // 'edit' | 'play'
    cells: Array(CELL_COUNT).fill(''),      // Songtitel
    marked: Array(CELL_COUNT).fill(false),  // angekreuzte Felder
    bingos: []                              // Indizes bereits gefeierter Linien
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.cells) && saved.cells.length === CELL_COUNT) {
      const state = defaultState();
      state.mode = saved.mode === 'play' ? 'play' : 'edit';
      state.cells = saved.cells.map(t => (typeof t === 'string' ? t : ''));
      if (Array.isArray(saved.marked) && saved.marked.length === CELL_COUNT) {
        state.marked = saved.marked.map(Boolean);
      }
      if (Array.isArray(saved.bingos)) state.bingos = saved.bingos.filter(i => LINES[i]);
      return state;
    }
  } catch (e) { /* kaputter oder blockierter Speicher -> neu starten */ }
  return defaultState();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('⚠️ Speichern im Browser nicht möglich.');
  }
}

let state = loadState();
let tool = 'edit';      // Werkzeug im Bearbeitungsmodus: 'edit' | 'swap' | 'clear'
let swapFirst = null;   // erstes Feld beim Tauschen
let selected = null;    // ausgewähltes Feld im Spielmodus
let editIndex = null;   // Feld, das gerade im Popup bearbeitet wird

// ---------- DOM ----------

const $ = id => document.getElementById(id);
const grid = $('grid');
const cellEls = [];

for (let i = 0; i < CELL_COUNT; i++) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cell';
  btn.dataset.index = i;
  const span = document.createElement('span');
  span.className = 'cell-text';
  btn.appendChild(span);
  grid.appendChild(btn);
  cellEls.push(btn);
}

// Overlay mit je einem Strich pro möglicher Bingo-Linie
const SVG_NS = 'http://www.w3.org/2000/svg';
const strikeSvg = document.createElementNS(SVG_NS, 'svg');
strikeSvg.setAttribute('class', 'strikes');
strikeSvg.setAttribute('aria-hidden', 'true');
const strikeEls = LINES.map(line => {
  const el = document.createElementNS(SVG_NS, 'line');
  el.setAttribute('class', 'strike');
  ['x1', 'y1', 'x2', 'y2'].forEach(k => el.setAttribute(k, line[k] + '%'));
  strikeSvg.appendChild(el);
  return el;
});
grid.appendChild(strikeSvg);

// ---------- Darstellung ----------

function render() {
  const playing = state.mode === 'play';
  document.body.className = playing ? 'mode-play' : `mode-edit tool-${tool}`;

  $('modeTitle').textContent = playing ? '🎵 Spielmodus aktiv' : '✏️ Bearbeitungsmodus';
  $('modeSub').textContent = playing
    ? 'Texte sind gesperrt – Feld antippen und ankreuzen'
    : 'Felder bearbeiten, tauschen oder auffüllen';

  $('editTools').hidden = playing;
  $('editActions').hidden = playing;
  $('playActions').hidden = !playing;

  const bingoCells = new Set(state.bingos.flatMap(i => LINES[i].cells));

  cellEls.forEach((el, i) => {
    const text = state.cells[i];
    el.firstChild.textContent = text || (playing ? '–' : '+');
    el.classList.toggle('empty', !text);
    el.classList.toggle('long', text.length > 24);
    el.classList.toggle('swap-first', !playing && swapFirst === i);
    el.classList.toggle('marked', playing && state.marked[i]);
    el.classList.toggle('bingo', playing && bingoCells.has(i));
    el.classList.toggle('selected', playing && selected === i);
    el.setAttribute('aria-label',
      (text || 'Leeres Feld') + (playing && state.marked[i] ? ' (angekreuzt)' : ''));
  });

  strikeEls.forEach((el, idx) => {
    el.classList.toggle('show', playing && state.bingos.includes(idx));
  });

  if (playing) renderPlay(); else renderEdit();
}

function renderEdit() {
  document.querySelectorAll('.tool').forEach(b => {
    const active = b.dataset.tool === tool;
    b.classList.toggle('active', active);
    b.setAttribute('aria-checked', active);
  });

  const hints = {
    edit: 'Tippe auf ein Feld, um den Text zu ändern.',
    swap: swapFirst === null
      ? 'Tippe das erste Feld an, das getauscht werden soll.'
      : 'Jetzt das zweite Feld antippen (gleiches Feld = abbrechen).',
    clear: 'Tippe auf ein Feld, um es zu leeren (mit Bestätigung).'
  };
  $('toolHint').textContent = hints[tool];

  const filled = state.cells.filter(Boolean).length;
  $('filledCount').textContent = `${filled} / ${CELL_COUNT} Felder befüllt`;
}

function renderPlay() {
  const info = $('selectionInfo');
  const markBtn = $('markBtn');

  if (selected === null) {
    info.textContent = 'Tippe auf ein Feld, um es auszuwählen.';
    markBtn.disabled = true;
    markBtn.textContent = 'Ausgewähltes Feld ankreuzen';
    markBtn.className = 'btn btn-play btn-big';
  } else {
    const isMarked = state.marked[selected];
    info.textContent = `Ausgewählt: „${state.cells[selected] || 'Leeres Feld'}“` +
      (isMarked ? ' – bereits angekreuzt' : '');
    markBtn.disabled = false;
    markBtn.textContent = isMarked ? '↩️ Kreuz entfernen (rückgängig)' : '✕ Ausgewähltes Feld ankreuzen';
    markBtn.className = isMarked ? 'btn btn-undo btn-big' : 'btn btn-play btn-big';
  }

  const count = state.bingos.length;
  $('bingoCount').textContent = count
    ? `🏆 ${count} Bingo${count > 1 ? 's' : ''} in diesem Spiel`
    : `${state.marked.filter(Boolean).length} / ${CELL_COUNT} Felder angekreuzt`;
}

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

function flash(...indices) {
  indices.forEach(i => {
    const el = cellEls[i];
    el.classList.remove('flash');
    void el.offsetWidth; // Animation neu starten
    el.classList.add('flash');
  });
}

// ---------- Eigene Popups ----------

// Bestätigungs-Popup als Ersatz für window.confirm – liefert ein Promise<boolean>
function confirmModal({ icon, title, text = [], warning = '', okLabel, okClass = 'btn-play' }) {
  const dialog = $('confirmDialog');
  $('confirmIcon').textContent = icon;
  $('confirmTitle').textContent = title;
  $('confirmText').replaceChildren(...text.map(t => {
    const p = document.createElement('p');
    p.textContent = t;
    return p;
  }));
  $('confirmWarning').textContent = warning;
  $('confirmWarning').hidden = !warning;
  $('confirmOk').textContent = okLabel;
  $('confirmOk').className = `btn ${okClass}`;
  dialog.returnValue = '';
  dialog.showModal();
  return new Promise(resolve => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true });
  });
}

$('confirmOk').addEventListener('click', () => $('confirmDialog').close('ok'));
$('confirmCancel').addEventListener('click', () => $('confirmDialog').close('cancel'));

// Tippen auf den abgedunkelten Hintergrund schließt ein Popup (wie "Abbrechen")
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', e => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (outside) dialog.close();
  });
});

// ---------- Bearbeitungsmodus ----------

document.querySelectorAll('.tool').forEach(btn => {
  btn.addEventListener('click', () => {
    tool = btn.dataset.tool;
    swapFirst = null;
    render();
  });
});

grid.addEventListener('click', e => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const i = Number(cell.dataset.index);
  if (state.mode === 'play') selectCell(i);
  else if (tool === 'edit') openEditDialog(i);
  else if (tool === 'swap') swapClick(i);
  else if (tool === 'clear') clearCell(i);
});

function openEditDialog(i) {
  editIndex = i;
  const row = Math.floor(i / SIZE) + 1;
  const col = (i % SIZE) + 1;
  $('editLabel').textContent = `Feld bearbeiten (Reihe ${row}, Spalte ${col})`;
  $('editInput').value = state.cells[i];
  const dialog = $('editDialog');
  dialog.returnValue = '';
  dialog.showModal();
  $('editInput').focus();
}

$('editCancel').addEventListener('click', () => $('editDialog').close('cancel'));

$('editDialog').addEventListener('close', () => {
  if ($('editDialog').returnValue === 'save' && editIndex !== null && state.mode === 'edit') {
    state.cells[editIndex] = $('editInput').value.trim();
    saveState();
    render();
  }
  editIndex = null;
});

function swapClick(i) {
  if (swapFirst === null) {
    swapFirst = i;
  } else if (swapFirst === i) {
    swapFirst = null;
  } else {
    const a = swapFirst;
    [state.cells[a], state.cells[i]] = [state.cells[i], state.cells[a]];
    swapFirst = null;
    saveState();
    flash(a, i);
    toast('🔁 Felder getauscht');
  }
  render();
}

async function clearCell(i) {
  if (!state.cells[i]) {
    toast('Dieses Feld ist bereits leer.');
    return;
  }
  const ok = await confirmModal({
    icon: '🗑️',
    title: 'Feld leeren?',
    text: [`„${state.cells[i]}“ wird aus dem Feld entfernt.`],
    okLabel: 'Ja, leeren',
    okClass: 'btn-danger-solid'
  });
  if (!ok) return;
  state.cells[i] = '';
  saveState();
  render();
}

// ---------- Leere Felder auffüllen ----------

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function fillEmpty() {
  const empty = [];
  state.cells.forEach((t, i) => { if (!t) empty.push(i); });
  if (empty.length === 0) {
    toast('Es gibt keine leeren Felder.');
    return;
  }

  // Keine Songs doppelt: bereits vorhandene Titel ausschließen
  const used = new Set(state.cells.filter(Boolean).map(t => t.trim().toLowerCase()));
  const pool = shuffle(SONGS.filter(s => {
    const key = s.toLowerCase();
    if (used.has(key)) return false;
    used.add(key);
    return true;
  }));
  const count = Math.min(empty.length, pool.length);

  for (let k = 0; k < count; k++) state.cells[empty[k]] = pool[k];
  saveState();
  render();
  flash(...empty.slice(0, count));

  if (count < empty.length) {
    toast(`⚠️ Nur ${count} von ${empty.length} Feldern gefüllt – nicht genug unterschiedliche Songs.`);
  } else {
    toast(`🎲 ${count} Feld${count > 1 ? 'er' : ''} aufgefüllt`);
  }
}

$('fillBtn').addEventListener('click', fillEmpty);

// ---------- Spiel starten / beenden ----------

$('startBtn').addEventListener('click', async () => {
  const empty = state.cells.filter(t => !t).length;
  const ok = await confirmModal({
    icon: '▶️',
    title: 'Spiel starten?',
    text: [
      'Nach dem Start sind keine Bearbeitungen mehr möglich (Texte ändern, tauschen, löschen, auffüllen).',
      'Um wieder zu bearbeiten, musst du das Spiel beenden – dabei gehen alle Kreuzchen verloren.'
    ],
    warning: empty ? `Hinweis: ${empty} Feld${empty > 1 ? 'er sind' : ' ist'} noch leer.` : '',
    okLabel: 'Ja, starten'
  });
  if (!ok) return;

  state.mode = 'play';
  state.marked = Array(CELL_COUNT).fill(false);
  state.bingos = [];
  selected = null;
  swapFirst = null;
  saveState();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

$('endBtn').addEventListener('click', async () => {
  const ok = await confirmModal({
    icon: '⚠️',
    title: 'Spiel wirklich beenden?',
    text: ['Du landest danach wieder im Bearbeitungsmodus. Die Songtitel bleiben erhalten.'],
    warning: 'Damit wird das bisherige Spiel komplett beendet, alle Kreuzchen gehen verloren ' +
      'und ein neues Spiel wird gestartet!',
    okLabel: 'Ja, beenden',
    okClass: 'btn-danger-solid'
  });
  if (!ok) return;

  state = { ...state, mode: 'edit', marked: Array(CELL_COUNT).fill(false), bingos: [] };
  selected = null;
  tool = 'edit';
  saveState();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ---------- Spielmodus ----------

function selectCell(i) {
  selected = selected === i ? null : i;
  render();
}

$('markBtn').addEventListener('click', () => {
  if (selected === null) return;
  const i = selected;
  state.marked[i] = !state.marked[i];
  selected = null;
  checkBingo();
  saveState();
  render();
  if (!state.marked[i]) toast('↩️ Kreuz entfernt');
});

// Aktualisiert die Liste kompletter Linien und feiert neue Bingos
function checkBingo() {
  const complete = [];
  LINES.forEach((line, idx) => {
    if (line.cells.every(c => state.marked[c])) complete.push(idx);
  });
  const fresh = complete.filter(idx => !state.bingos.includes(idx));
  state.bingos = complete;
  if (fresh.length) showBingo(fresh);
}

function showBingo(fresh) {
  const names = fresh.map(idx => LINES[idx].name).join(', ');
  $('bingoText').textContent = fresh.length > 1
    ? `Gleich ${fresh.length} Linien auf einmal: ${names}!`
    : `Komplett: ${names}!`;
  const total = state.bingos.length;
  $('bingoTotal').textContent = total > 1
    ? `Schon ${total} Bingos in diesem Spiel – weiter so! 🍻`
    : 'Das Spiel geht weiter – auf zum nächsten Bingo!';
  $('bingoDialog').showModal();
}

render();
