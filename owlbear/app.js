import OBR from 'https://esm.unpkg.com/@owlbear-rodeo/sdk@3.1.0';
import {
  ROLL_CHANNEL, BRIDGE_FLAG, OUTCOME_LABEL,
  historyKey, loadHistory, saveHistory, loadSettings, saveSettings, sanitizeRoll, mergeRolls,
} from './shared.js';

const feed = document.getElementById('feed');
const statusEl = document.getElementById('bridge-status');
const settingsEl = document.getElementById('settings');
const settingsToggle = document.getElementById('settings-toggle');
const optNotify = document.getElementById('opt-notify');
const optMesa = document.getElementById('opt-mesa');

let roomId = 'local';
const inOwlbear = OBR.isAvailable;

// ---- Renderização --------------------------------------------------------------
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function timeLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function rollCard(roll) {
  const card = el('article', `card${roll.outcome ? ` card--${roll.outcome}` : ''}`);

  const avatar = el('div', 'avatar');
  if (roll.picture) {
    const img = el('img');
    img.src = roll.picture;
    img.alt = '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => { img.remove(); avatar.textContent = roll.characterName.charAt(0).toUpperCase(); };
    avatar.append(img);
  } else {
    avatar.textContent = roll.characterName.charAt(0).toUpperCase();
  }

  const body = el('div', 'body');
  const head = el('div', 'head');
  head.append(el('span', 'char', roll.characterName));
  if (roll.playerName) head.append(el('span', 'player', roll.playerName));
  head.append(el('time', 'time', timeLabel(roll.date)));
  body.append(head);

  body.append(el('div', 'label', roll.label));

  const meta = el('div', 'meta');
  if (roll.notation) meta.append(el('code', 'notation', roll.notation));
  if (roll.dice.length) {
    const dice = el('span', 'dice');
    for (const d of roll.dice) {
      const chip = el('span', `die${d.dropped ? ' die--dropped' : ''}`, String(d.result));
      if (d.faces) chip.title = `d${d.faces}`;
      dice.append(chip);
    }
    meta.append(dice);
  }
  if (meta.childNodes.length) body.append(meta);

  if (roll.details.length) {
    const details = el('div', 'details');
    for (const d of roll.details) details.append(el('span', 'detail', `${d.label}: ${d.value}`));
    body.append(details);
  }
  if (roll.outcome) body.append(el('span', `tag tag--${roll.outcome}`, OUTCOME_LABEL[roll.outcome]));

  const total = el('div', 'total', roll.total == null ? '?' : String(roll.total));
  total.setAttribute('aria-label', `Resultado ${roll.total ?? 'desconhecido'}`);

  card.append(avatar, body, total);
  return card;
}

function render() {
  const history = loadHistory(roomId);
  feed.replaceChildren();
  if (!history.length) {
    feed.append(document.getElementById('empty-tpl').content.cloneNode(true));
    return;
  }
  // Mais recente em cima.
  for (const roll of [...history].reverse()) feed.append(rollCard(roll));
}

// O background grava o histórico; este evento avisa o popover (mesma origem).
window.addEventListener('storage', (event) => {
  if (event.key === historyKey(roomId)) render();
});

// ---- Status da ponte (extensão do Chrome) -------------------------------------
function setStatus(kind, text) {
  statusEl.className = `status status--${kind}`;
  statusEl.querySelector('.text').textContent = text;
}

let bridgeSeen = false;
window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== location.origin) return;
  const data = event.data;
  if (!data || data[BRIDGE_FLAG] !== true || data.type !== 'hello') return;
  bridgeSeen = true;
  setStatus('ok', `Extensão do Chrome conectada${data.version ? ` (v${data.version})` : ''}`);
});
window.postMessage({ [BRIDGE_FLAG]: true, type: 'ping' }, location.origin);
setTimeout(() => {
  if (!bridgeSeen) setStatus('warn', 'Extensão do Chrome não detectada — você ainda vê as rolagens dos outros, mas não envia as suas.');
}, 1500);

// ---- Configurações ------------------------------------------------------------
const settings = loadSettings();
optNotify.checked = settings.notify;
optMesa.checked = settings.forwardToMesaChat;
optNotify.addEventListener('change', () => saveSettings({ notify: optNotify.checked }));
optMesa.addEventListener('change', () => saveSettings({ forwardToMesaChat: optMesa.checked }));

settingsToggle.addEventListener('click', () => {
  const open = settingsEl.hidden;
  settingsEl.hidden = !open;
  settingsToggle.setAttribute('aria-expanded', String(open));
});

document.getElementById('btn-clear').addEventListener('click', () => {
  saveHistory(roomId, []);
  render();
});

document.getElementById('btn-test').addEventListener('click', () => {
  const d20 = 1 + Math.floor(Math.random() * 20);
  const roll = sanitizeRoll({
    id: `test-${Date.now()}`,
    characterName: 'Personagem de Teste',
    playerName: 'Você',
    label: 'Teste de Agilidade',
    total: d20 + 3,
    notation: '1d20+3',
    dice: [{ faces: 20, result: d20 }],
    outcome: d20 === 20 ? 'extreme-success' : d20 + 3 >= 15 ? 'success' : 'fail',
    date: new Date().toISOString(),
  });
  if (inOwlbear) {
    // LOCAL: passa pelo mesmo caminho do background, mas só neste cliente.
    OBR.broadcast.sendMessage(ROLL_CHANNEL, { type: 'roll', roll }, { destination: 'LOCAL' }).catch(console.error);
  } else {
    saveHistory(roomId, mergeRolls(loadHistory(roomId), [roll]));
    render();
  }
});

// ---- Tema do Owlbear ----------------------------------------------------------
function applyTheme(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme.mode === 'LIGHT' ? 'light' : 'dark';
  root.style.setProperty('--primary', theme.primary.main);
  root.style.setProperty('--bg', theme.background.paper);
  root.style.setProperty('--bg-elev', theme.background.default);
  root.style.setProperty('--text', theme.text.primary);
  root.style.setProperty('--text-dim', theme.text.secondary);
}

if (inOwlbear) {
  OBR.onReady(async () => {
    roomId = OBR.room.id;
    render();
    OBR.theme.getTheme().then(applyTheme).catch(() => {});
    OBR.theme.onChange(applyTheme);
  });
} else {
  document.documentElement.dataset.preview = 'true';
  render();
}
