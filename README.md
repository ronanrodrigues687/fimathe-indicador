# Fimathe Indicador — V1 (dados da internet)

App pessoal de indicador de análise técnica. Roda como **web app instalável** no
iPhone, Android e PC (PWA). Não envia ordens pra nenhuma corretora — só
analisa e mostra COMPRA / VENDA / AGUARDAR com os motivos.

## 1. Colocar no ar (grátis, sem cartão, 100% pelo celular) — GitHub Pages

1. Descompacte o zip no seu celular (no app Arquivos/Files do iPhone, ou no
   gerenciador de arquivos do Android — toque no .zip e escolha "Descompactar/Extrair").
2. Crie uma conta grátis em https://github.com (funciona bem pelo navegador do celular).
3. Toque no **+** no canto superior → **New repository**. Dê um nome (ex:
   `fimathe-indicador`), marque como **Public**, e crie.
4. Dentro do repositório: **Add file → Upload files**.
5. Selecione TODOS os arquivos que você descompactou (index.html, style.css,
   app.js, manifest.json, service-worker.js, icon-192.png, icon-512.png,
   README.md) e confirme o commit ("Commit changes").
6. Vá em **Settings → Pages** (no menu do repositório). Em "Branch",
   escolha `main` e a pasta `/ (root)`, depois **Save**.
7. Espere ~1 minuto e recarregue essa página de Settings → Pages. Vai
   aparecer um link tipo `https://seu-usuario.github.io/fimathe-indicador/`.
   Esse é o link do seu app.

Se preferir e tiver acesso a um computador depois, dá pra fazer o mesmo em
segundos arrastando a pasta em https://app.netlify.com/drop ou vercel.com —
mas pelo celular, GitHub Pages é o caminho mais confiável.

## 2. Instalar no celular como app

- **iPhone**: abra o link no Safari → toque em Compartilhar → "Adicionar à Tela de Início".
- **Android**: abra o link no Chrome → menu (⋮) → "Adicionar à tela inicial" / "Instalar app".

Vira um ícone normal, abre em tela cheia, sem barra de navegador.

## 3. Ativar forex, ouro e índices (opcional, mas recomendado)

Cripto (BTCUSD, ETHUSD) já funciona sem nada. Pra XAUUSD, EURUSD, GBPUSD,
USDJPY, US30, NAS100, SPX500:

1. Crie uma conta grátis em https://twelvedata.com (não pede cartão).
2. Pegue sua **API key** no painel.
3. Abra o app → aba **Config** → cole a chave → Salvar.

O plano gratuito tem limite de requisições por minuto/dia — suficiente pra
uso pessoal olhando o mercado de vez em quando. Se um ativo/timeframe
aparecer como indisponível, é porque o plano gratuito não cobre aquele
dado específico.

## 4. O que já funciona (V1)

- Qualquer ativo da lista, qualquer timeframe suportado pela fonte de dados
- Motor de análise: tendência, estrutura de mercado, região de
  suporte/resistência, confirmação em timeframe maior → COMPRA / VENDA / AGUARDAR
- Entrada, stop técnico e 3 alvos quando o sinal é válido
- Histórico de análises (salvo neste aparelho)
- Backtest simples sobre dados reais recentes
- Tema escuro/claro

## 5. O que ainda não faz (próximas versões)

- **Sincronizar** histórico/favoritos entre iPhone, Android e PC ao mesmo
  tempo (precisa de um banco de dados — ex: Supabase, grátis, sem cartão)
- **V2**: motor lendo direto do MetaTrader 5 (PC ou VPS), sem trocar a
  lógica de análise que já está pronta
- Notificações push
- Regras oficiais da metodologia Fimathe (hoje em MODO DEMONSTRAÇÃO —
  a estrutura já está pronta pra receber as regras exatas quando você definir)
- Publicação nas lojas (Google Play / App Store) — o PWA já cobre "instalar
  no celular" sem passar por loja; publicar nas lojas de verdade é uma etapa
  separada, só faz sentido depois do motor validado

## Arquivos do projeto

```
index.html          # tela única do app
style.css            # visual (tema escuro/claro, responsivo)
app.js               # motor de análise + busca de dados reais
manifest.json        # configuração do PWA (ícone, nome, tela cheia)
service-worker.js     # cache do app (não cacheia preços — sempre busca ao vivo)
icons/               # ícones do app
```
