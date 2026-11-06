# Rolagens RPGpédia → Owlbear Rodeo

Role os testes na sua ficha do [rpgpedia.com](https://rpgpedia.com) e veja, no Owlbear, para toda a mesa:
**personagem, tipo do teste e o número que saiu** (com notação, dados individuais e sucesso/falha quando o sistema tiver).

## Como funciona

```
rpgpedia.com (sua aba)            Owlbear Rodeo (outra aba)
┌──────────────────────┐          ┌───────────────────────────────────┐
│ ficha / campanha     │          │ extensão "Rolagens RPGpédia"      │
│  └ rpgpedia-page.js  │ chrome.  │  ├ background  → transmite p/ sala │
│    lê a rolagem nova │ storage  │  └ popover     → feed de rolagens  │
│  └ rpgpedia-relay.js ├────────► │ owlbear-relay.js (Chrome)         │
└──────────────────────┘          └───────────────┬───────────────────┘
        extensão do Chrome                        │ OBR.broadcast
                                                  ▼
                                  todos os jogadores da sala
```

São duas peças:

| Pasta | O que é | Quem precisa |
|---|---|---|
| `owlbear/` | Extensão do Owlbear (site estático, GitHub Pages) | Instalada na sala (o mestre adiciona) |
| `chrome-extension/` | Extensão do Chrome que lê as rolagens da aba do rpgpedia | Quem quer **enviar** rolagens |

A extensão do Chrome **não faz nenhuma requisição** ao rpgpedia: ela só lê, na sua própria aba aberta, a rolagem que o site acabou de mostrar.

Duas formas de usar:
- **Cada jogador** instala a extensão do Chrome e rola na própria ficha.
- **Só o mestre** instala e deixa a **página da campanha** aberta no rpgpedia. O log de dados da campanha traz as rolagens de todos os membros, e elas são repassadas para o Owlbear.

Se a mesma rolagem chegar por dois caminhos (jogador + mestre), ela aparece uma vez só.

## 1. Publicar a extensão do Owlbear (GitHub Pages)

1. Crie o repositório `owlbear-rpgpedia` na conta `KevinAraujo22` e envie esta pasta.
2. Em **Settings → Pages**, publique a branch `main` (pasta raiz).
3. O manifest ficará em:
   `https://kevinaraujo22.github.io/owlbear-rpgpedia/owlbear/manifest.json`
4. No Owlbear: **Perfil → Extensões → Adicionar extensão** → cole essa URL. Depois ative a extensão na sala.

> Usando outro nome de repositório ou conta? Troque a URL base em `owlbear/manifest.json`,
> em `chrome-extension/manifest.json` (o terceiro `matches`) e em `PUBLIC_BASE` no arquivo `scripts/serve.mjs`.

## 2. Instalar a extensão do Chrome

1. Abra `chrome://extensions` e ative o **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação** e escolha a pasta `chrome-extension/`.
3. **Recarregue** as abas do rpgpedia e do Owlbear.
4. No Owlbear, abra "Rolagens RPGpédia". Deve aparecer **"Extensão do Chrome conectada"**.

Funciona também no Edge, Brave e Opera (todos baseados no Chromium).

## 3. Jogar

Abra sua ficha no rpgpedia em uma aba e a sala do Owlbear em outra. Cada teste rolado na ficha:
- aparece no feed da extensão para toda a mesa;
- mostra uma notificação no Owlbear (dá para desligar em ⚙);
- opcionalmente também vai para o **Chat da Mesa** (opção em ⚙). A rolagem entra como mensagem de texto: `🎲 Arthur — Luta: 17 · Sucesso (2d20kh1+5)`.

## Desenvolvimento

```bash
npm run dev    # serve owlbear/ em http://localhost:5174 (com CORS)
npm test       # testes (Node 20+, sem dependências)
```

Para testar no Owlbear sem publicar, adicione `http://localhost:5174/manifest.json` como extensão. O servidor reescreve as URLs do manifest para localhost, e a extensão do Chrome já reconhece `localhost`.

Abrindo `http://localhost:5174/` direto no navegador você vê o popover em modo de pré-visualização. O botão **Rolagem de teste** (em ⚙) preenche o feed.

## Limitações

- A extensão do Chrome depende da estrutura interna do rpgpedia (Vue/Pinia):
  - ficha: `sheet.currentRoll` / `sheet.rollsHistory`
  - campanha: `campaign.diceLogs`
  
  Se o site mudar isso, o arquivo a ajustar é `chrome-extension/rpgpedia-page.js`.
- O histórico do feed fica salvo no navegador de cada jogador, por sala. Quem entra depois na sala só vê as rolagens a partir daí.
- Projeto não oficial, sem vínculo com o RPGpédia ou com o Owlbear Rodeo.
