# Flexões · Seu ritmo

PWA em português do Brasil, feita com React, TypeScript e Vite. Sem login ou servidor: configuração, sessão ativa e histórico ficam em um único registro no localStorage.

## Executar

Requer Node.js 22.14 ou superior e npm.

```sh
npm install
npm run dev
```

Neste ambiente, uma cópia portátil do Node foi preparada em `.tools/` (ignorada pelo Git). Para usá-la no PowerShell sem instalar Node globalmente:

```powershell
$env:Path = "$PWD\.tools\node-v22.14.0-win-x64;$env:Path"
npm.cmd run dev
```

## Verificar e gerar produção

```sh
npm test
npm run build
npm run preview
```

O build fica em `dist/`, preparado para GitHub Pages em `/aplicativo-habitos/`. Nenhuma publicação foi executada.

## Publicar no GitHub Pages

O repositório local foi inicializado na branch **main**, com `origin` em `https://github.com/thiagocarvalhosantos26-creator/aplicativo-habitos.git`. Na inspeção inicial, o remoto estava vazio. Uma versão portátil oficial do Git for Windows e o GitHub CLI estão disponíveis em `.tools/`, ignorada pelo Git. O projeto fica neste diretório:

```text
C:\Users\Thiago\Desktop\aplicativo-habitos
```

As etapas abaixo são para você executar quando decidir publicar; não foram executadas pelo assistente.

1. O repositório `thiagocarvalhosantos26-creator/aplicativo-habitos` já foi criado pelo proprietário. Use esse repositório para enviar o código-fonte à branch `main`; não é necessário criar outro.
2. Inclua `src`, `public`, `scripts`, `.github/workflows/pages.yml`, `.gitignore`, `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`, **package-lock.json** e `README.md`. Não envie `node_modules`, `.tools`, `dist` ou arquivos de segredos.
3. No repositório, abra **Settings → Pages → Build and deployment → Source** e selecione **GitHub Actions**.
4. Abra **Actions → Publicar aplicativo no GitHub Pages → Run workflow** e escolha `main`. O workflow também executa em cada push para `main`. Se o primeiro push ocorreu antes de habilitar Pages, execute novamente depois de habilitá-lo.
5. Aguarde os jobs de build e deploy terminarem. Abra a URL apresentada pelo ambiente `github-pages` ou em Settings → Pages. Para esse nome, o endereço normalmente será `https://SEU-USUARIO.github.io/aplicativo-habitos/` (exemplo, não uma publicação existente). Ative **Enforce HTTPS**, quando disponível.

O workflow instala com `npm ci`, executa os testes, gera e verifica o build e publica somente `dist` com as ações oficiais. Ele usa `contents: read` no build e `pages: write`/`id-token: write` no deploy, com dependência do build e ambiente `github-pages`. Não é necessário criar um token pessoal. Os runners são hospedados pelo GitHub (`ubuntu-latest`). Se seu repositório usar outra branch principal, ajuste `on.push.branches` em `.github/workflows/pages.yml`.

O Vite usa `/aplicativo-habitos/` por padrão. No workflow, `actions/configure-pages` fornece o caminho real via `PAGES_BASE_PATH`, inclusive para um repositório renomeado ou domínio próprio. Manifesto, ícones, apple-touch-icon, registro e escopo do service worker e fallback offline seguem esse mesmo caminho. Para testar localmente:

```sh
npm ci
npm test
npm run build
npm run check:pages
npm run preview
```

Abra `http://localhost:4173/aplicativo-habitos/`. Para preparar um build local com outro nome, use no PowerShell:

```powershell
$env:PAGES_BASE_PATH = "/OUTRO-REPOSITORIO/"
npm.cmd run build
npm.cmd run check:pages
Remove-Item Env:PAGES_BASE_PATH
```

Se futuramente preferir publicação manual na raiz do Netlify, use `PAGES_BASE_PATH = "/"` antes de gerar o build. O arquivo `_headers` da preparação anterior foi preservado; GitHub Pages não usa suas regras. O build padrão atual deve ser hospedado no subdiretório `/aplicativo-habitos/`.

Documentação oficial consultada: [workflows do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node), [configure-pages](https://github.com/actions/configure-pages), [upload-pages-artifact](https://github.com/actions/upload-pages-artifact) e [deploy-pages](https://github.com/actions/deploy-pages). As versões configuradas são `checkout@v7`, `setup-node@v7`, `configure-pages@v6`, `upload-pages-artifact@v5` e `deploy-pages@v5`, conferidas nas releases e nos arquivos `action.yml` oficiais.

Os dados continuam somente no navegador/dispositivo, usando a chave `flexoes:v1`; nenhuma base de dados ou login foi adicionada ao aplicativo. Dados salvos em localhost, outro domínio ou outro dispositivo não são transferidos automaticamente para o endereço publicado. Atualizações no mesmo endereço preservam o armazenamento, desde que os dados do navegador não sejam apagados. Não use URLs temporárias de prévia como endereço definitivo.

## Roteiro curto no iPhone

1. Abra o endereço HTTPS publicado no Safari e aguarde o carregamento completo com internet.
2. Toque em Compartilhar → Adicionar à Tela de Início. Abra o aplicativo pelo novo ícone.
3. Em Configuração, use meta total **2**, **1** flexão por série e descanso de **0 minutos e 10 segundos**. Salve.
4. Inicie o treino e confirme a primeira série. Verifique o cronômetro regressivo de 10 segundos.
5. Bloqueie a tela durante o descanso. Desbloqueie e retorne ao aplicativo: ele deve mostrar o tempo correto ou a segunda série pronta, se os 10 segundos já passaram. Não há promessa de som com a tela bloqueada.
6. Confirme a segunda série. Não deve haver outro descanso. Confira no histórico o treino concluído, com duas séries e duas flexões.
7. Feche e reabra o aplicativo pelo ícone. Confira se a configuração e o histórico permanecem.
8. Depois do primeiro carregamento completo, feche o aplicativo, desligue Wi-Fi e dados móveis (ou ative modo avião) e abra novamente pelo ícone. O aplicativo e o histórico devem carregar offline. Reative a conexão ao terminar.

As verificações em iPhone real, o workflow no GitHub e a URL publicada ficam pendentes até o envio do código e habilitação de Pages. Manifesto, ícones, registro do service worker, arquivos de precache e o build são conferidos localmente com `npm run check:pages`.

## Uso

Configure meta, quantidade por série, descanso, data inicial e frequência. Inicie um treino em qualquer dia; isso não muda o calendário. Confirme a quantidade realizada em cada série. O descanso inicia após a confirmação, exceto na última série. Uma meta de 52 com séries de 5 gera dez séries de 5 e uma de 2.

O descanso usa um horário de término persistido; pausas guardam o tempo restante. Ao atualizar ou retornar do segundo plano, o aplicativo recalcula o descanso e apresenta a próxima série, sem confirmar exercícios automaticamente. Voltar ao início mantém a sessão; use “Retomar treino”. Encerrar salva uma sessão parcial, e descartar exige confirmação. Sessões são deduplicadas por identificador.

## Recuperação dos dados

Uma falha de leitura ou validação bloqueia todas as gravações normais e mostra a tela de recuperação. “Tentar novamente” relê o registro. Quando o navegador permite ler o conteúdo bruto, “Baixar dados para recuperação” exporta exatamente esse conteúdo, mesmo que o JSON seja inválido. Nenhum registro é removido silenciosamente. A redefinição substitui os registros locais pelos valores iniciais somente após a confirmação “Sim, apagar e redefinir”. Cancelar ou pressionar Escape mantém os dados.

Falhas de gravação têm aviso separado e permitem tentar salvar novamente. O aplicativo mantém o último estado salvo até a gravação funcionar. Os dados válidos da primeira versão continuam usando a chave `flexoes:v1` e o mesmo formato, sem migração destrutiva.

## iPhone e offline

Abra no Safari e use Compartilhar → Adicionar à Tela de Início. O manifesto, os ícones PNG e o service worker são gerados/incluídos no build. O funcionamento offline requer um primeiro carregamento completo e o cache do service worker. Service workers exigem HTTPS ou localhost; acessar um IP local via HTTP permite testar a interface, mas não a instalação/offline completa. O servidor de desenvolvimento não ativa o service worker; teste a PWA no build de produção.

Não há som, vibração nem notificações em segundo plano. A tela pode ser bloqueada sem perder o cálculo do descanso, mas o aplicativo não executa exercícios nem avisa com a tela bloqueada. Apagar dados do navegador apaga os registros; não há sincronização ou backup. Use uma aba por vez: edição simultânea em várias abas não é coordenada.

## Arquivos

- `src/App.tsx`: telas e fluxo de treino.
- `src/domain.ts`: calendário local, divisão das séries e cronômetro.
- `src/storage.ts`: persistência e deduplicação.
- `src/Modal.tsx`: diálogos nativos, foco limitado à janela e restauração do foco.
- `src/style.css`: layout mobile first, acessibilidade e áreas seguras.
- `src/domain.test.ts`: testes de calendário, sessão e persistência.
- `vite.config.ts`: manifesto e cache offline.
- `.github/workflows/pages.yml`: testes, build e publicação no GitHub Pages.
- `scripts/check-pages.mjs`: validação dos caminhos e arquivos da PWA no build.
- `public/icons/`: ícones de instalação.

Os 17 testes automatizados cobrem divisão com restante, dois dias de descanso, datas locais, validação, descanso vencido/pausado, retomada pelo armazenamento, última série, parcial, deduplicação, frequência inválida, histórico com `null`, sessões inconsistentes, falhas de acesso e compatibilidade com registros da primeira versão.

Na revisão, foram verificadas no Chrome com perfil isolado: recuperação sem gravações sobre dados inválidos, download bruto, tentativa de leitura novamente, confirmação de redefinição, falhas de gravação, foco inicial, Tab/Shift+Tab, Escape, fundo sem interação e restauração do foco. As telas inicial (meta de 10.000), configuração, treino, descanso, histórico, confirmação e resumo foram verificadas nas larguras de 320, 375 e 390 pixels, sem rolagem horizontal ou corte dos conteúdos testados.

Na preparação para GitHub Pages, `npm ci`, os 17 testes, o build e `npm run check:pages` passaram. No Chrome com perfil isolado, 12 verificações passaram em `/aplicativo-habitos/`, incluindo carregamento, treino, descanso, retomada após recarga, pausa, parcial, correção de quantidade, toques repetidos, conclusão e abertura offline.

Ainda precisam de teste em iPhone real: Safari e modo Tela de Início, VoiceOver e teclado nos diálogos, download do arquivo de recuperação, áreas seguras, instalação/offline e retorno após bloquear a tela. O workflow foi preparado localmente, mas ainda não foi executado no GitHub. Nenhum repositório remoto foi criado e nenhuma publicação foi realizada.
