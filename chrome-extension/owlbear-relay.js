// Roda nos iframes da extensão do Owlbear (só onde existe a meta
// "rpgpedia-owlbear-bridge"). Entrega as rolagens ao background da extensão e
// responde ao "ping" do popover para ele mostrar que a ponte está ativa.
(() => {
  const meta = document.querySelector('meta[name="rpgpedia-owlbear-bridge"]');
  if (!meta) return;

  const FLAG = '__rpgpediaBridge';
  const version = chrome.runtime.getManifest().version;
  const post = (msg) => window.postMessage({ [FLAG]: true, ...msg }, location.origin);

  post({ type: 'hello', version });
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.[FLAG] !== true || event.data.type !== 'ping') return;
    post({ type: 'hello', version });
  });

  // Só o background publica na sala; o popover apenas exibe.
  if (meta.content !== 'background') return;
  chrome.storage.onChanged.addListener((changes, area) => {
    const batch = area === 'local' ? changes.outbox?.newValue : null;
    if (batch && Array.isArray(batch.rolls)) post({ type: 'rolls', rolls: batch.rolls });
  });
})();
