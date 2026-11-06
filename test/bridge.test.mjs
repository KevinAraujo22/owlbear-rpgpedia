// Testes sem dependências: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const pageScript = readFileSync(new URL('../chrome-extension/rpgpedia-page.js', import.meta.url), 'utf8');

// Monta uma "página do rpgpedia" falsa com Vue + Pinia e roda o script nela.
function fakePage(initialState) {
  const posted = [];
  let tick = null;
  const pinia = { state: { value: initialState }, _s: new Map() };
  const appEl = { __vue_app__: { config: { globalProperties: { $pinia: pinia } }, _context: { provides: {} } } };
  const window = {
    // Ida e volta em JSON: simula o structured clone do postMessage e tira os
    // objetos do "realm" do vm (senão o deepEqual compara protótipos diferentes).
    postMessage: (msg, origin) => posted.push({ msg: JSON.parse(JSON.stringify(msg)), origin }),
  };
  const context = {
    window,
    document: { querySelector: (sel) => (sel === '#app' ? appEl : null) },
    location: { origin: 'https://rpgpedia.com' },
    setInterval: (fn) => { tick = fn; return 1; },
    console,
    Date,
  };
  vm.runInNewContext(pageScript, context);
  return { state: pinia.state.value, posted, tick: () => tick() };
}

const now = () => new Date().toISOString();
function sheetRoll(id, overrides = {}) {
  return {
    id,
    sheetId: 'sheet-1',
    kitId: 'ordem-paranormal',
    playerName: 'Kevin',
    characterName: 'Arthur Cervero',
    characterPicture: 'https://cdn.example.com/arthur.png',
    date: now(),
    label: 'Luta',
    roll: {
      result: 17,
      notation: '2d20kh1+5',
      dices: [{ id: 1, faces: 20, result: 12 }, { id: 2, faces: 20, result: 3, drop: true }],
      success: true, extremeSuccess: false, extremeFail: false,
    },
    resultIcons: [{ type: 'success' }],
    ...overrides,
  };
}

test('ignora o histórico que já existia e envia só rolagens novas', () => {
  const sheet = { id: 'sheet-1', currentRoll: sheetRoll('old-2'), rollsHistory: [sheetRoll('old-1'), sheetRoll('old-2')] };
  const page = fakePage({ ordemParanormalSheet: { sheet } });

  page.tick();
  assert.equal(page.posted.length, 0, 'histórico existente não deve ser enviado');

  const fresh = sheetRoll('new-1');
  sheet.rollsHistory.push(fresh);
  sheet.currentRoll = fresh;
  page.tick();
  assert.equal(page.posted.length, 1);
  const { msg, origin } = page.posted[0];
  assert.equal(origin, 'https://rpgpedia.com');
  assert.equal(msg.__rpgpediaBridge, true);
  assert.equal(msg.type, 'rolls');
  assert.equal(msg.rolls.length, 1);
  const roll = msg.rolls[0];
  assert.equal(roll.id, 'new-1');
  assert.equal(roll.characterName, 'Arthur Cervero');
  assert.equal(roll.label, 'Luta');
  assert.equal(roll.total, 17);
  assert.equal(roll.notation, '2d20kh1+5');
  assert.equal(roll.outcome, 'success');
  assert.deepEqual(roll.dice, [{ faces: 20, result: 12, dropped: false }, { faces: 20, result: 3, dropped: true }]);

  page.tick();
  assert.equal(page.posted.length, 1, 'a mesma rolagem não é enviada duas vezes');
});

test('captura rolagens de outros jogadores pelo log da campanha', () => {
  const campaign = { campaign: { id: 'camp-1' }, diceLogs: [] };
  const page = fakePage({ campaign });
  page.tick();

  campaign.diceLogs.push(sheetRoll('log-1', { characterName: 'Dante', label: 'Percepção', resultIcons: [{ type: 'extreme-fail' }] }));
  page.tick();
  const roll = page.posted[0].msg.rolls[0];
  assert.equal(roll.characterName, 'Dante');
  assert.equal(roll.label, 'Percepção');
  assert.equal(roll.outcome, 'extreme-fail');
});

test('aceita "roll" serializado como texto e inclui dano/contagens como detalhes', () => {
  const sheet = { id: 's', currentRoll: null, rollsHistory: [] };
  const page = fakePage({ universalSheet: { sheet } });
  page.tick();

  sheet.rollsHistory.push({
    id: 'r-str',
    characterName: 'Liz',
    label: 'Dano',
    date: now(),
    roll: JSON.stringify({ result: 9, notation: '2d6', dices: [{ faces: 6, result: 4 }, { faces: 6, result: 5 }] }),
    resultIcons: [{ type: 'success', value: 2 }],
    cardInfoSection: { damageList: [{ label: 'Corte', value: 9 }] },
  });
  page.tick();
  const roll = page.posted[0].msg.rolls[0];
  assert.equal(roll.total, 9);
  assert.equal(roll.outcome, null, 'contagem de sucessos não é resultado do teste');
  assert.deepEqual(roll.details, [{ label: 'Sucessos', value: '2' }, { label: 'Corte', value: '9' }]);
});

test('não reenvia rolagens antigas que só carregaram depois', () => {
  const sheet = { id: 's', rollsHistory: [] };
  const page = fakePage({ universalSheet: { sheet } });
  page.tick();
  sheet.rollsHistory.push(sheetRoll('ancient', { date: new Date(Date.now() - 60 * 60 * 1000).toISOString() }));
  page.tick();
  assert.equal(page.posted.length, 0);
});

test('não faz nada enquanto o app do rpgpedia não carregou', () => {
  const posted = [];
  let tick;
  vm.runInNewContext(pageScript, {
    window: { postMessage: (m) => posted.push(m) },
    document: { querySelector: () => null },
    location: { origin: 'https://rpgpedia.com' },
    setInterval: (fn) => { tick = fn; },
    console, Date,
  });
  assert.doesNotThrow(() => tick());
  assert.equal(posted.length, 0);
});

// ---- Lado do Owlbear ----------------------------------------------------------
globalThis.localStorage = (() => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
})();
const shared = await import('../owlbear/shared.js');

test('sanitizeRoll limita campos e descarta imagens não-https', () => {
  const r = shared.sanitizeRoll({
    id: 'x', characterName: 'A'.repeat(500), label: 'Vigor', total: '15',
    picture: 'javascript:alert(1)', outcome: 'hackeado', dice: [{ faces: 20, result: 15 }, { result: 'nope' }],
  });
  assert.equal(r.characterName.length, 80);
  assert.equal(r.total, 15);
  assert.equal(r.picture, '');
  assert.equal(r.outcome, null);
  assert.equal(r.dice.length, 1);
  assert.equal(shared.sanitizeRoll({ label: 'sem id' }), null);
});

test('rollSummary monta o texto da notificação', () => {
  const r = shared.sanitizeRoll({ id: '1', characterName: 'Arthur', label: 'Luta', total: 17, outcome: 'success' });
  assert.equal(shared.rollSummary(r), '🎲 Arthur — Luta: 17 · Sucesso');
});

test('histórico deduplica por id e respeita o limite', () => {
  const base = Date.now();
  const many = Array.from({ length: 120 }, (_, i) => shared.sanitizeRoll({ id: `r${i}`, date: new Date(base + i).toISOString() }));
  const merged = shared.mergeRolls(many.slice(0, 60), many.slice(50));
  assert.equal(merged.length, shared.MAX_HISTORY);
  assert.equal(merged.at(-1).id, 'r119');
  assert.equal(new Set(merged.map((r) => r.id)).size, merged.length);
});
