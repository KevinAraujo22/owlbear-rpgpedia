// Constantes e utilitários compartilhados entre o background e o popover.
export const NS = 'io.github.kevinaraujo22.rpgpedia-rolls';
export const ROLL_CHANNEL = `${NS}/rolls-v1`;
export const BRIDGE_FLAG = '__rpgpediaBridge';

// Canal do "Chat da Mesa" (extensão Ordem2EXT). Usado só se o encaminhamento
// estiver ligado nas configurações.
export const MESA_CHAT_CHANNEL = 'io.github.kevinaraujo22.ordem2ext.chat/channel-v1';

export const MAX_HISTORY = 100;

const SETTINGS_KEY = `${NS}/settings`;
const DEFAULT_SETTINGS = { notify: true, forwardToMesaChat: false };

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage bloqueado */ }
}

export function historyKey(roomId) {
  return `${NS}/history/${roomId || 'local'}`;
}

export function loadHistory(roomId) {
  try {
    const parsed = JSON.parse(safeGet(historyKey(roomId)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveHistory(roomId, entries) {
  safeSet(historyKey(roomId), JSON.stringify(entries.slice(-MAX_HISTORY)));
}

export function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(safeGet(SETTINGS_KEY) || '{}') }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings(settings) {
  safeSet(SETTINGS_KEY, JSON.stringify({ ...loadSettings(), ...settings }));
}

const str = (v, max = 120) => (v == null ? '' : String(v)).slice(0, max);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const OUTCOMES = new Set(['extreme-success', 'success', 'fail', 'extreme-fail']);

// Valida e limita o tamanho de uma rolagem vinda da ponte (ou de outro jogador).
// Tudo que chega pela rede passa por aqui antes de ser exibido.
export function sanitizeRoll(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = str(raw.id, 80);
  if (!id) return null;
  const dice = Array.isArray(raw.dice)
    ? raw.dice.slice(0, 40).map((d) => ({
        faces: num(d?.faces),
        result: num(d?.result),
        dropped: !!d?.dropped,
      })).filter((d) => d.result !== null)
    : [];
  const details = Array.isArray(raw.details)
    ? raw.details.slice(0, 8).map((d) => ({ label: str(d?.label, 40), value: str(d?.value, 40) }))
    : [];
  let picture = str(raw.picture, 500);
  if (picture && !/^https:\/\//i.test(picture)) picture = '';
  return {
    id,
    characterName: str(raw.characterName, 80) || 'Personagem',
    playerName: str(raw.playerName, 80),
    label: str(raw.label, 80) || 'Rolagem',
    total: num(raw.total),
    notation: str(raw.notation, 120),
    dice,
    outcome: OUTCOMES.has(raw.outcome) ? raw.outcome : null,
    details,
    picture,
    kitId: str(raw.kitId, 40),
    date: str(raw.date, 40) || new Date().toISOString(),
    sentBy: str(raw.sentBy, 80),
  };
}

export const OUTCOME_LABEL = {
  'extreme-success': 'Sucesso extremo',
  success: 'Sucesso',
  fail: 'Falha',
  'extreme-fail': 'Falha extrema',
};

// Texto curto usado na notificação e no Chat da Mesa.
export function rollSummary(roll) {
  const total = roll.total ?? '?';
  const outcome = roll.outcome ? ` · ${OUTCOME_LABEL[roll.outcome]}` : '';
  return `🎲 ${roll.characterName} — ${roll.label}: ${total}${outcome}`;
}

export function mergeRolls(current, incoming) {
  const map = new Map();
  for (const r of [...current, ...incoming]) if (r?.id) map.set(r.id, r);
  return [...map.values()]
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .slice(-MAX_HISTORY);
}
