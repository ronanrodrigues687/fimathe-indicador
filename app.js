/* =========================================================================
   FIMATHE INDICADOR — app.js
   Uso pessoal. Indicador de análise técnica. NÃO envia ordens a corretora
   nenhuma — apenas lê dados de mercado e mostra COMPRA/VENDA/AGUARDAR.

   Fontes de dados (V1 — internet):
     - Cripto (BTCUSD, ETHUSD)           -> Binance API pública (sem chave)
     - Forex / Ouro / Índices            -> Twelve Data (chave gratuita)
   V2 (futuro): estas mesmas funções de análise poderão receber candles
   vindos diretamente de um conector MT5 local/VPS, sem mudar o motor.
   ========================================================================= */

const ASSETS = [
  {sym:"BTCUSD",  label:"BTCUSD",  provider:"binance",   ticker:"BTCUSDT"},
  {sym:"ETHUSD",  label:"ETHUSD",  provider:"binance",   ticker:"ETHUSDT"},
  {sym:"XAUUSD",  label:"XAUUSD",  provider:"twelvedata",ticker:"XAU/USD"},
  {sym:"EURUSD",  label:"EURUSD",  provider:"twelvedata",ticker:"EUR/USD"},
  {sym:"GBPUSD",  label:"GBPUSD",  provider:"twelvedata",ticker:"GBP/USD"},
  {sym:"USDJPY",  label:"USDJPY",  provider:"twelvedata",ticker:"USD/JPY"},
  {sym:"US30",    label:"US30",    provider:"twelvedata",ticker:"DJI"},
  {sym:"NAS100",  label:"NAS100",  provider:"twelvedata",ticker:"NDX"},
  {sym:"SPX500",  label:"SPX500",  provider:"twelvedata",ticker:"SPX"},
];

// timeframe -> {binance, twelvedata}. null = não disponível nesse provedor.
const TF_MAP = {
  M1:  {binance:"1m",  twelvedata:"1min"},
  M3:  {binance:"3m",  twelvedata:null},
  M5:  {binance:"5m",  twelvedata:"5min"},
  M15: {binance:"15m", twelvedata:"15min"},
  M30: {binance:"30m", twelvedata:"30min"},
  H1:  {binance:"1h",  twelvedata:"1h"},
  H2:  {binance:"2h",  twelvedata:"2h"},
  H4:  {binance:"4h",  twelvedata:"4h"},
  H6:  {binance:"6h",  twelvedata:null},
  H8:  {binance:"8h",  twelvedata:null},
  D1:  {binance:"1d",  twelvedata:"1day"},
  W1:  {binance:"1w",  twelvedata:"1week"},
  MN:  {binance:"1M",  twelvedata:"1month"},
};
const TFS = Object.keys(TF_MAP);
const NAV = [
  {id:"indicador", label:"Indicador", icon:"◈"},
  {id:"historico", label:"Histórico", icon:"☰"},
  {id:"backtest",  label:"Backtest",  icon:"⟲"},
  {id:"config",    label:"Config",    icon:"⚙"},
];

let state = {
  page:"indicador",
  theme: localStorage.getItem("fa_theme") || "dark",
  asset: localStorage.getItem("fa_asset") || "XAUUSD",
  tf: localStorage.getItem("fa_tf") || "M15",
  apiKey: localStorage.getItem("fa_tdkey") || "",
  favorites: JSON.parse(localStorage.getItem("fa_favs") || "[]"),
  history: JSON.parse(localStorage.getItem("fa_history") || "[]"),
  lastAnalysis: null,
  loading: false,
  error: null,
};
document.documentElement.setAttribute("data-theme", state.theme === "light" ? "light" : "dark");

/* ===================== DATA FETCHING ===================== */
async function fetchBinanceCandles(ticker, interval, limit=150){
  const url = `https://api.binance.com/api/v3/klines?symbol=${ticker}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error("Binance: falha ao buscar dados ("+res.status+")");
  const raw = await res.json();
  return raw.map(d => ({time:d[0], o:+d[1], h:+d[2], l:+d[3], c:+d[4]}));
}

async function fetchTwelveDataCandles(ticker, interval, apikey, outputsize=150){
  if(!apikey) throw new Error("Cadastre sua chave gratuita da Twelve Data em Config para ver este ativo.");
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(ticker)}&interval=${interval}&outputsize=${outputsize}&apikey=${encodeURIComponent(apikey)}`;
  const res = await fetch(url);
  const data = await res.json();
  if(data.status === "error" || !data.values) throw new Error(data.message || "Twelve Data: ativo/timeframe indisponível no plano gratuito");
  return data.values.slice().reverse().map(v => ({time:new Date(v.datetime).getTime(), o:+v.open, h:+v.high, l:+v.low, c:+v.close}));
}

async function fetchCandles(assetSym, tf, size=150){
  const asset = ASSETS.find(a => a.sym === assetSym);
  const tfDef = TF_MAP[tf];
  if(asset.provider === "binance"){
    if(!tfDef.binance) throw new Error("TIMEFRAME NÃO DISPONÍVEL para "+assetSym);
    return await fetchBinanceCandles(asset.ticker, tfDef.binance, size);
  } else {
    if(!tfDef.twelvedata) throw new Error("TIMEFRAME NÃO DISPONÍVEL para "+assetSym);
    return await fetchTwelveDataCandles(asset.ticker, tfDef.twelvedata, state.apiKey, size);
  }
}

/* ===================== MOTOR DE ANÁLISE ===================== */
// Recebe candles reais (array {time,o,h,l,c}) — mesma função servirá para MT5 na V2.
function sma(arr,n){ return arr.slice(-n).reduce((a,b)=>a+b,0)/n; }

function runEngine(asset, tf, candles){
  if(candles.length < 35) throw new Error("Dados insuficientes retornados pela API para este timeframe.");
  const closes = candles.map(c=>c.c);
  const smaFast = sma(closes,10), smaSlow = sma(closes,30);
  const trend = smaFast > smaSlow*1.0015 ? "BULLISH" : smaFast < smaSlow*0.9985 ? "BEARISH" : "SIDEWAYS";

  const last20 = candles.slice(-20);
  const highs = last20.map(c=>c.h), lows = last20.map(c=>c.l);
  const structUp = highs.at(-1) > Math.max(...highs.slice(0,10)) && lows.at(-1) > Math.min(...lows.slice(0,10));
  const structDown = highs.at(-1) < Math.max(...highs.slice(0,10)) && lows.at(-1) < Math.min(...lows.slice(0,10));
  const structure = structUp ? "HH/HL (alta)" : structDown ? "LH/LL (baixa)" : "lateral / indefinida";

  const range = Math.max(...highs) - Math.min(...lows) || 1;
  const lastClose = closes.at(-1);
  const nearSupport = (lastClose - Math.min(...lows)) < range*0.3;
  const nearResistance = (Math.max(...highs) - lastClose) < range*0.3;

  let reasons = [], score = 0;
  reasons.push({ok: trend!=="SIDEWAYS", text:`Tendência ${trend==='BULLISH'?'de alta':trend==='BEARISH'?'de baixa':'lateral'} (SMA10 vs SMA30, dados reais)`});
  if(trend!=="SIDEWAYS") score += trend==="BULLISH"?1:-1;
  reasons.push({ok: structure!=="lateral / indefinida", text:`Estrutura de mercado: ${structure}`});
  if(structUp) score+=1; if(structDown) score-=1;
  reasons.push({ok: nearSupport||nearResistance, text: nearSupport?"Preço próximo de região de suporte (últimos 20 candles)":nearResistance?"Preço próximo de região de resistência (últimos 20 candles)":"Preço em região neutra do range recente"});
  if(nearSupport) score+=1; if(nearResistance) score-=1;
  reasons.push({ok:false, text:"Regras Fimathe: MODO DEMONSTRAÇÃO — aguardando parametrização oficial das regras do método"});

  let direction = "AGUARDAR";
  if(score>=2 && nearSupport) direction="COMPRA";
  else if(score<=-2 && nearResistance) direction="VENDA";

  const stop = direction==="COMPRA" ? Math.min(...lows) : direction==="VENDA" ? Math.max(...highs) : null;
  const risk = stop!=null ? Math.abs(lastClose-stop) : null;
  const targets = risk ? [1,2,3].map(m => lastClose + (direction==="COMPRA"?1:-1)*risk*m) : null;

  return {asset, tf, candles, trend, structure, direction, reasons, price:lastClose, stop, targets, time:new Date()};
}

/* ===================== HELPERS ===================== */
function fmt(n, asset){
  if(n==null || isNaN(n)) return "—";
  const d = asset.includes("JPY") ? 3 : (asset.includes("US30")||asset.includes("NAS")||asset.includes("SPX")||asset.includes("BTC")) ? 1 : asset.includes("XAU") ? 2 : 4;
  return n.toFixed(d);
}
function tagClass(dir){ return dir==="COMPRA"?"buy":dir==="VENDA"?"sell":"wait"; }
function saveState(){
  localStorage.setItem("fa_theme", state.theme);
  localStorage.setItem("fa_asset", state.asset);
  localStorage.setItem("fa_tf", state.tf);
  localStorage.setItem("fa_tdkey", state.apiKey);
  localStorage.setItem("fa_favs", JSON.stringify(state.favorites));
  localStorage.setItem("fa_history", JSON.stringify(state.history.slice(0,200)));
}
function toggleTheme(){ state.theme = state.theme==="dark"?"light":"dark"; document.documentElement.setAttribute("data-theme", state.theme); saveState(); render(); }
function toggleFavorite(sym){
  const i = state.favorites.indexOf(sym);
  if(i>-1) state.favorites.splice(i,1); else state.favorites.push(sym);
  saveState(); render();
}
function goto(page){ state.page=page; render(); }

/* ===================== CHART ===================== */
function drawChart(canvasId, candles){
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  const wCss = canvas.clientWidth || 600, hCss = 260;
  const dpr = window.devicePixelRatio||1;
  canvas.width = wCss*dpr; canvas.height = hCss*dpr;
  canvas.style.height = hCss+"px";
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,wCss,hCss);
  const styles = getComputedStyle(document.documentElement);
  const buy = styles.getPropertyValue("--buy").trim(), sell = styles.getPropertyValue("--sell").trim(), line = styles.getPropertyValue("--line").trim();
  const maxH = Math.max(...candles.map(c=>c.h)), minL = Math.min(...candles.map(c=>c.l));
  const pad = (maxH-minL)*0.08 || 1;
  const top = maxH+pad, bot = minL-pad;
  const cw = wCss/candles.length;
  const y = v => hCss - ((v-bot)/(top-bot))*hCss;
  ctx.strokeStyle = line; ctx.lineWidth=1;
  for(let g=1; g<4; g++){ const yy=hCss/4*g; ctx.beginPath(); ctx.moveTo(0,yy); ctx.lineTo(wCss,yy); ctx.stroke(); }
  candles.forEach((c,i)=>{
    const x = i*cw + cw/2, up = c.c>=c.o;
    ctx.strokeStyle = up?buy:sell;
    ctx.beginPath(); ctx.moveTo(x,y(c.h)); ctx.lineTo(x,y(c.l)); ctx.stroke();
    ctx.fillStyle = up?buy:sell;
    const bodyTop=y(Math.max(c.o,c.c)), bodyBot=y(Math.min(c.o,c.c));
    ctx.fillRect(x-cw*0.32, bodyTop, cw*0.64, Math.max(1,bodyBot-bodyTop));
  });
}

/* ===================== PAGES ===================== */
function apiKeyBanner(){
  if(!state.apiKey) return `<div class="banner warn">⚠ Nenhuma chave da Twelve Data configurada — forex/ouro/índices ficam indisponíveis. Configure em Config.</div>`;
  return "";
}

function pageIndicador(){
  const a = state.lastAnalysis;
  return `
  ${apiKeyBanner()}
  <div class="controls-row">
    <select id="selAsset" onchange="onAssetChange(this.value)">${ASSETS.map(x=>`<option value="${x.sym}" ${x.sym===state.asset?"selected":""}>${x.label}</option>`).join("")}</select>
    <select id="selTf" onchange="onTfChange(this.value)">${TFS.map(x=>`<option ${x===state.tf?"selected":""}>${x}</option>`).join("")}</select>
    <button class="star ${state.favorites.includes(state.asset)?"on":""}" onclick="toggleFavorite('${state.asset}')" title="Favoritar">★</button>
    <button class="btn" onclick="runAnalysis()">${state.loading?"Analisando…":"Analisar"}</button>
  </div>
  ${state.error?`<div class="banner err">✕ ${state.error}</div>`:""}
  <div class="grid grid-2">
    <div class="card">
      <div class="card-title-row"><h2>${state.asset} · ${state.tf}</h2>${a?`<span class="tag ${tagClass(a.direction)}">${a.direction}</span>`:""}</div>
      <div class="chart-wrap"><canvas id="mainChart"></canvas></div>
      <div class="small" style="margin-top:8px">${a?`Última atualização: ${a.time.toLocaleTimeString("pt-BR")} · dados reais`:"Sem análise ainda."}</div>
    </div>
    <div>
      ${a?`
      <div class="card signal-box" style="background:var(--${tagClass(a.direction)}-bg)">
        <div class="dir" style="color:var(--${a.direction==="COMPRA"?"buy":a.direction==="VENDA"?"sell":"wait"})">${a.direction==="COMPRA"?"🟢":a.direction==="VENDA"?"🔴":"🟡"} ${a.direction}</div>
        <div class="sub">Confluência dos módulos de análise</div>
      </div>
      <div class="card" style="margin-bottom:12px">
        <h3>Motivos</h3>
        <ul class="reasons">${a.reasons.map(r=>`<li>${r.ok?"✓":"○"} <span><b>${r.text}</b></span></li>`).join("")}</ul>
      </div>
      <div class="card">
        <h3>Entrada / Stop / Alvos</h3>
        <table>
          <tr><td>Entrada</td><td>${fmt(a.price,a.asset)}</td></tr>
          <tr><td>Stop técnico</td><td>${fmt(a.stop,a.asset)}</td></tr>
          <tr><td>Alvo 1</td><td>${a.targets?fmt(a.targets[0],a.asset):"—"}</td></tr>
          <tr><td>Alvo 2</td><td>${a.targets?fmt(a.targets[1],a.asset):"—"}</td></tr>
          <tr><td>Alvo 3</td><td>${a.targets?fmt(a.targets[2],a.asset):"—"}</td></tr>
        </table>
      </div>`:`<div class="card"><h3>Nenhuma análise ainda</h3><div class="stat-sub">Escolha ativo e timeframe, depois clique em Analisar.</div></div>`}
    </div>
  </div>`;
}
function onAssetChange(v){ state.asset=v; saveState(); }
function onTfChange(v){ state.tf=v; saveState(); }

async function runAnalysis(){
  state.loading = true; state.error = null; render();
  try{
    const candles = await fetchCandles(state.asset, state.tf, 150);
    const result = runEngine(state.asset, state.tf, candles);
    state.lastAnalysis = result;
    state.history.unshift(result);
    saveState();
  }catch(e){
    state.error = e.message || String(e);
  }
  state.loading = false;
  render();
  if(state.lastAnalysis) setTimeout(()=>drawChart("mainChart", state.lastAnalysis.candles),0);
}

function pageHistorico(){
  const list = state.history;
  return `<div class="card"><div class="card-title-row"><h2>Histórico de análises</h2><button class="icon-btn" onclick="clearHistory()" title="Limpar">🗑</button></div>
  <div class="scrollx">${list.length?`<table><thead><tr><th>Ativo</th><th>TF</th><th>Direção</th><th>Entrada</th><th>Stop</th><th>Motivos</th><th>Horário</th></tr></thead>
  <tbody>${list.map(s=>`<tr><td>${s.asset}</td><td>${s.tf}</td><td><span class="tag ${tagClass(s.direction)}">${s.direction}</span></td><td>${fmt(s.price,s.asset)}</td><td>${fmt(s.stop,s.asset)}</td><td style="font-family:var(--font-ui);color:var(--sub);font-size:11.5px">${s.reasons.filter(r=>r.ok).length}/${s.reasons.length} confirmados</td><td>${new Date(s.time).toLocaleString("pt-BR")}</td></tr>`).join("")}</tbody></table>`:`<div class="stat-sub">Nenhuma análise rodada ainda neste aparelho.</div>`}</div></div>`;
}
function clearHistory(){ state.history=[]; saveState(); render(); }

function pageBacktest(){
  return `<div class="banner warn">⚠ Backtest roda sobre o histórico real trazido pela API no momento do clique — não é garantia de resultado futuro.</div>
  <div class="controls-row">
    <select id="btAsset">${ASSETS.map(x=>`<option value="${x.sym}" ${x.sym===state.asset?"selected":""}>${x.label}</option>`).join("")}</select>
    <select id="btTf">${TFS.map(x=>`<option ${x===state.tf?"selected":""}>${x}</option>`).join("")}</select>
    <button class="btn" onclick="runBacktest()">Rodar backtest</button>
  </div>
  <div id="btResult"><div class="card"><h3>Nenhum backtest executado</h3><div class="stat-sub">Escolha ativo/timeframe e clique em Rodar backtest.</div></div></div>`;
}
async function runBacktest(){
  const asset = document.getElementById("btAsset").value, tf = document.getElementById("btTf").value;
  document.getElementById("btResult").innerHTML = `<div class="card"><h3>Buscando dados…</h3></div>`;
  let candles;
  try{ candles = await fetchCandles(asset, tf, 300); }
  catch(e){ document.getElementById("btResult").innerHTML = `<div class="banner err">✕ ${e.message}</div>`; return; }
  if(candles.length < 60){ document.getElementById("btResult").innerHTML = `<div class="banner err">✕ Poucos candles retornados pela API para backtest neste timeframe.</div>`; return; }

  let equity=1000, peak=1000, maxDD=0, wins=0, losses=0, grossWin=0, grossLoss=0, lossStreak=0, maxLossStreak=0, total=0;
  for(let i=40; i<candles.length-8; i+=4){
    const window = candles.slice(i-40,i).map(c=>c.c);
    const dir = sma(window,8) > sma(window,20) ? 1 : -1;
    const entry = candles[i].c;
    const exit = candles[i+8] ? candles[i+8].c : candles.at(-1).c;
    const pnl = (exit-entry)*dir;
    total++;
    if(pnl>0){ wins++; grossWin+=pnl; lossStreak=0; } else { losses++; grossLoss+=Math.abs(pnl); lossStreak++; maxLossStreak=Math.max(maxLossStreak,lossStreak); }
    equity += pnl*10; peak=Math.max(peak,equity); maxDD=Math.max(maxDD,(peak-equity)/peak*100);
  }
  const winRate = total? (wins/total*100).toFixed(1) : "0.0";
  const profitFactor = grossLoss>0 ? (grossWin/grossLoss).toFixed(2) : "—";
  document.getElementById("btResult").innerHTML = `
  <div class="grid" style="grid-template-columns:repeat(4,1fr)">
    <div class="card"><h3>Resultado (pts simulados)</h3><div class="stat" style="color:${equity>=1000?"var(--buy)":"var(--sell)"}">${(equity-1000).toFixed(0)}</div><div class="stat-sub">capital base: 1000</div></div>
    <div class="card"><h3>Operações</h3><div class="stat">${total}</div><div class="stat-sub">${wins} ganhos · ${losses} perdas</div></div>
    <div class="card"><h3>Taxa de acerto</h3><div class="stat">${winRate}%</div><div class="stat-sub">sobre dados reais retornados</div></div>
    <div class="card"><h3>Profit factor</h3><div class="stat">${profitFactor}</div><div class="stat-sub">drawdown máx: ${maxDD.toFixed(1)}%</div></div>
  </div>`;
}

function pageConfig(){
  return `
  <div class="card" style="margin-bottom:14px">
    <h3 style="margin-bottom:6px">Chave da Twelve Data (forex, ouro, índices)</h3>
    <div class="small">Cadastro gratuito, sem cartão, em <a href="https://twelvedata.com/pricing" target="_blank" rel="noopener">twelvedata.com</a>. A chave fica salva só neste aparelho.</div>
    <input class="keyfield" id="tdKeyInput" placeholder="cole sua chave aqui" value="${state.apiKey}">
    <button class="btn" style="margin-top:8px" onclick="saveApiKey()">Salvar chave</button>
    <div class="ext-note">Cripto (BTCUSD, ETHUSD) já funciona sem nenhuma chave — usa a API pública da Binance.</div>
  </div>
  <div class="card" style="margin-bottom:14px">
    <div class="toggle-row"><div><div style="font-weight:600;font-size:13.5px">Tema escuro</div></div><button class="switch ${state.theme==="dark"?"on":""}" onclick="toggleTheme()"></button></div>
  </div>
  <div class="card">
    <h3 style="margin-bottom:8px">Roteiro (próximas versões)</h3>
    <div class="ext-note">V2: motor lendo candles direto de um Conector MT5 (PC/VPS), sem trocar a lógica de análise.</div>
    <div class="ext-note">Sincronizar histórico/favoritos entre iPhone, Android e PC — precisa de um banco de dados gratuito (ex: Supabase).</div>
    <div class="ext-note">Notificações push de novo sinal — precisa de configuração externa.</div>
    <div class="ext-note">Publicação nas lojas (APK/IPA) — feito só quando o motor estiver validado.</div>
    <div class="ext-note">Regras oficiais da metodologia Fimathe — hoje em MODO DEMONSTRAÇÃO.</div>
  </div>`;
}
function saveApiKey(){ state.apiKey = document.getElementById("tdKeyInput").value.trim(); saveState(); render(); }

/* ===================== ROUTER ===================== */
const PAGES = {indicador:pageIndicador, historico:pageHistorico, backtest:pageBacktest, config:pageConfig};
const TITLES = {indicador:"Indicador", historico:"Histórico", backtest:"Backtest", config:"Configurações"};

function renderNav(){
  const build = () => NAV.map(n=>`<button class="nav-item ${state.page===n.id?"active":""}" onclick="goto('${n.id}')"><span>${n.icon}</span><span>${n.label}</span></button>`).join("");
  document.getElementById("navDesktop").innerHTML = build();
  document.getElementById("navMobile").innerHTML = build();
}

function render(){
  renderNav();
  document.getElementById("pageTitle").textContent = TITLES[state.page];
  document.getElementById("content").innerHTML = PAGES[state.page]();
  document.getElementById("apiStatusSide").innerHTML = state.apiKey
    ? `<span class="status-pill on"><span class="dot"></span> Twelve Data configurada</span>`
    : `<span class="status-pill off"><span class="dot"></span> Sem chave Twelve Data</span>`;
  if(state.page==="indicador" && state.lastAnalysis) setTimeout(()=>drawChart("mainChart", state.lastAnalysis.candles),0);
}

render();

// Registra o service worker (funciona apenas quando hospedado em http(s), não em file://)
if("serviceWorker" in navigator && location.protocol.startsWith("http")){
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(()=>{}));
}
