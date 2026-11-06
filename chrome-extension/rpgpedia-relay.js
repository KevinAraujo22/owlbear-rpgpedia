// Script isolado no rpgpedia.com: recebe as rolagens do rpgpedia-page.js e as
// coloca no chrome.storage, de onde o owlbear-relay.js entrega ao Owlbear.
window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== location.origin) return;
  const data = event.data;
  if (!data || data.__rpgpediaBridge !== true || data.type !== 'rolls' || !Array.isArray(data.rolls)) return;
  const rolls = data.rolls.slice(0, 20);
  if (!rolls.length) return;
  try {
    chrome.storage.local.set({
      outbox: { seq: `${Date.now()}-${Math.random().toString(36).slice(2)}`, rolls },
      lastRoll: rolls[rolls.length - 1],
      lastRollAt: Date.now(),
    });
  } catch {
    // A extensão foi recarregada: é preciso atualizar a aba do rpgpedia.
    console.warn('[RPGpédia → Owlbear] recarregue esta aba para reconectar a extensão.');
  }
});
