chrome.storage.local.get(['lastRoll', 'lastRollAt'], ({ lastRoll, lastRollAt }) => {
  if (!lastRoll) return;
  const box = document.getElementById('last');
  box.replaceChildren();
  const total = document.createElement('span');
  total.className = 'total';
  total.textContent = lastRoll.total ?? '?';
  const name = document.createElement('strong');
  name.textContent = lastRoll.characterName || 'Personagem';
  const label = document.createElement('div');
  label.textContent = lastRoll.label || 'Rolagem';
  const when = document.createElement('div');
  when.className = 'dim';
  when.textContent = `${lastRoll.notation || ''} · ${new Date(lastRollAt).toLocaleTimeString('pt-BR')}`;
  box.append(total, name, label, when);
});
