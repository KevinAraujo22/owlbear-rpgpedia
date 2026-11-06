import OBR from 'https://esm.unpkg.com/@owlbear-rodeo/sdk@3.1.0';
import {
  ROLL_CHANNEL, MESA_CHAT_CHANNEL, BRIDGE_FLAG,
  sanitizeRoll, rollSummary, loadHistory, saveHistory, loadSettings, mergeRolls,
} from './shared.js';

// O background fica sempre carregado enquanto o jogador está na sala.
// Ele é o único que:
//  1. recebe as rolagens da extensão do Chrome (ponte) e transmite para a sala;
//  2. escuta a sala, guarda o histórico local e mostra a notificação.

let roomId = '';
let playerName = '';
let unread = 0;
let ready = false;
const pending = [];

const VARIANT = {
  'extreme-success': 'SUCCESS',
  success: 'SUCCESS',
  fail: 'WARNING',
  'extreme-fail': 'ERROR',
};

// ---- Ponte (extensão do Chrome) -> sala --------------------------------------
window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== location.origin) return;
  const data = event.data;
  if (!data || data[BRIDGE_FLAG] !== true || data.type !== 'rolls') return;
  const rolls = (Array.isArray(data.rolls) ? data.rolls : []).map(sanitizeRoll).filter(Boolean);
  if (!rolls.length) return;
  if (ready) void publish(rolls);
  else pending.push(...rolls);
});

async function publish(rolls) {
  const settings = loadSettings();
  for (const roll of rolls) {
    roll.sentBy = playerName;
    try {
      // ALL inclui este próprio cliente, então o fluxo de exibição é único.
      await OBR.broadcast.sendMessage(ROLL_CHANNEL, { type: 'roll', roll }, { destination: 'ALL' });
    } catch (error) {
      console.error('[RPGpédia] falha ao transmitir rolagem', error);
    }
    if (settings.forwardToMesaChat) {
      // O Chat da Mesa aceita entradas do tipo "message" e deduplica pelo id.
      const entry = {
        id: `rpgpedia-${roll.id}`,
        type: 'message',
        createdAt: Date.parse(roll.date) || Date.now(),
        text: `${rollSummary(roll)}${roll.notation ? ` (${roll.notation})` : ''}`,
      };
      OBR.broadcast
        .sendMessage(MESA_CHAT_CHANNEL, { type: 'submit', entry }, { destination: 'ALL' })
        .catch((error) => console.error('[RPGpédia] falha ao enviar ao Chat da Mesa', error));
    }
  }
}

// ---- Sala -> histórico + notificação ------------------------------------------
async function onRoomRoll(event) {
  const data = event.data;
  if (!data || data.type !== 'roll') return;
  const roll = sanitizeRoll(data.roll);
  if (!roll) return;

  const history = loadHistory(roomId);
  if (history.some((r) => r.id === roll.id)) return; // já recebida (ex.: dois jogadores na mesma campanha)
  saveHistory(roomId, mergeRolls(history, [roll]));

  if (loadSettings().notify) {
    OBR.notification.show(rollSummary(roll), VARIANT[roll.outcome] || 'DEFAULT').catch(() => {});
  }
  if (!(await OBR.action.isOpen().catch(() => false))) {
    unread += 1;
    OBR.action.setBadgeText(unread > 99 ? '99+' : String(unread)).catch(() => {});
  }
}

async function setup() {
  if (!OBR.isAvailable) return;
  await new Promise((resolve) => OBR.onReady(resolve));
  roomId = OBR.room.id;
  playerName = await OBR.player.getName().catch(() => '');
  OBR.player.onChange((p) => { playerName = p.name; });

  OBR.broadcast.onMessage(ROLL_CHANNEL, (event) => { void onRoomRoll(event); });
  OBR.action.onOpenChange((open) => {
    if (!open) return;
    unread = 0;
    OBR.action.setBadgeText(undefined).catch(() => {});
  });
  OBR.action.setBadgeBackgroundColor('#5B1EBC').catch(() => {});

  ready = true;
  if (pending.length) void publish(pending.splice(0));
}

setup().catch((error) => console.error('[RPGpédia] erro no background', error));
