// Roda no "mundo" da página do rpgpedia.com (world: MAIN) para conseguir ler o
// estado do app (Vue + Pinia). Não faz nenhuma requisição: só observa o que a
// própria página já tem carregado e avisa o script isolado via postMessage.
//
// Onde as rolagens ficam no rpgpedia (observado no código do site):
//  - fichas:    store "<sistema>Sheet" -> state.sheet.currentRoll / state.sheet.rollsHistory
//  - campanhas: store "campaign"       -> state.diceLogs (rolagens de todos os membros)
(() => {
  if (window.__rpgpediaOwlbearBridge) return;
  window.__rpgpediaOwlbearBridge = true;

  const FLAG = '__rpgpediaBridge';
  const POLL_MS = 500;
  const MAX_AGE_MS = 5 * 60 * 1000; // ignora rolagens antigas que só "apareceram" agora
  const seen = new Set();
  const knownSources = new Set();

  const toRaw = (o) => (o && o.__v_raw ? toRaw(o.__v_raw) : o);
  const num = (v) => { const n = Number(v); return v !== null && v !== '' && Number.isFinite(n) ? n : null; };
  const parse = (v) => {
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch { return null; }
  };

  function findPinia() {
    const app = document.querySelector('#app')?.__vue_app__;
    if (!app) return null;
    const fromGlobal = app.config?.globalProperties?.$pinia;
    if (fromGlobal?.state) return fromGlobal;
    const provides = app._context?.provides || {};
    for (const key of [...Object.getOwnPropertySymbols(provides), ...Object.keys(provides)]) {
      const value = provides[key];
      if (value && value._s instanceof Map && value.state) return value;
    }
    return null;
  }

  function collectSources(pinia) {
    const sources = [];
    const states = toRaw(pinia.state.value) || {};
    for (const [storeId, rawState] of Object.entries(states)) {
      const state = toRaw(rawState);
      if (!state || typeof state !== 'object') continue;

      const sheet = toRaw(state.sheet);
      if (sheet && typeof sheet === 'object' && ('currentRoll' in sheet || 'rollsHistory' in sheet)) {
        const entries = Array.isArray(sheet.rollsHistory) ? [...toRaw(sheet.rollsHistory)] : [];
        if (sheet.currentRoll) entries.push(sheet.currentRoll);
        sources.push({ key: `${storeId}:sheet:${sheet.id || ''}`, entries });
      }

      if (Array.isArray(state.diceLogs)) {
        const campaignId = state.campaignId || toRaw(state.campaign)?.id || '';
        sources.push({ key: `${storeId}:diceLogs:${campaignId}`, entries: [...toRaw(state.diceLogs)] });
      }
    }
    return sources;
  }

  const OUTCOME_PRIORITY = ['extreme-success', 'extreme-fail', 'success', 'fail'];
  const ICON_LABEL = {
    success: 'Sucessos', fail: 'Falhas', exploding: 'Explosões',
    'high-roll': 'Maior', 'low-roll': 'Menor', pavor: 'Pavor',
  };

  function normalize(rawEntry) {
    const entry = toRaw(parse(toRaw(rawEntry)));
    if (!entry || typeof entry !== 'object') return null;
    const roll = toRaw(parse(toRaw(entry.roll))) || {};

    const id = entry.id || (entry.date ? `${entry.sheetId || ''}|${entry.date}|${entry.label || ''}` : null);
    if (!id) return null;

    const dice = (Array.isArray(roll.dices) ? roll.dices : []).map((d) => ({
      faces: num(d?.faces),
      result: num(d?.result),
      dropped: d?.drop === true,
    }));

    // Ícones de resultado: sem "value" indicam sucesso/falha do teste;
    // com "value" são contagens (ex.: sucessos em parada de dados).
    const icons = Array.isArray(entry.resultIcons) ? entry.resultIcons.map(toRaw) : [];
    const details = [];
    let outcome = null;
    for (const type of OUTCOME_PRIORITY) {
      if (icons.some((i) => i?.type === type && i.value == null)) { outcome = type; break; }
    }
    if (!outcome) {
      if (roll.extremeSuccess) outcome = 'extreme-success';
      else if (roll.extremeFail) outcome = 'extreme-fail';
    }
    for (const icon of icons) {
      if (icon?.value != null && ICON_LABEL[icon.type]) details.push({ label: ICON_LABEL[icon.type], value: String(icon.value) });
    }
    const damage = toRaw(entry.cardInfoSection)?.damageList;
    if (Array.isArray(damage)) {
      for (const d of damage) details.push({ label: String(d?.label ?? 'Dano'), value: String(d?.value ?? '') });
    }

    return {
      id: String(id),
      characterName: entry.characterName || '',
      playerName: entry.playerName || '',
      label: entry.label || '',
      total: num(roll.result) ?? num(entry.total) ?? num(entry.rollResult),
      notation: roll.notation || entry.rollNotation || '',
      dice,
      outcome,
      details,
      picture: typeof entry.characterPicture === 'string' ? entry.characterPicture : '',
      kitId: entry.kitId || '',
      date: entry.date || new Date().toISOString(),
    };
  }

  function scan() {
    const pinia = findPinia();
    if (!pinia) return;
    const fresh = [];
    for (const { key, entries } of collectSources(pinia)) {
      // Na primeira vez que uma ficha/campanha aparece, tudo que já existe é
      // histórico: marca como visto e não envia.
      const firstTime = !knownSources.has(key);
      knownSources.add(key);
      for (const raw of entries) {
        const roll = normalize(raw);
        if (!roll || seen.has(roll.id)) continue;
        seen.add(roll.id);
        if (firstTime) continue;
        const at = Date.parse(roll.date);
        if (Number.isFinite(at) && Date.now() - at > MAX_AGE_MS) continue;
        fresh.push(roll);
      }
    }
    if (fresh.length) window.postMessage({ [FLAG]: true, type: 'rolls', rolls: fresh }, location.origin);
  }

  setInterval(() => {
    try { scan(); } catch (error) { console.debug('[RPGpédia → Owlbear] falha ao ler rolagens', error); }
  }, POLL_MS);
})();
