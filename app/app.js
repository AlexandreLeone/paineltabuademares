/*
 * Tábua de Marés — versão web instalável (PWA), para iPhone e qualquer navegador.
 * Porta do app Android (repositório Painel-Mares-App-Android): mesmo backend,
 * mesmos dados, mesmos textos, mesma fonte 5x7 e mesmo gráfico dos painéis.
 * Sem dependências externas.
 */
'use strict';

const VERSAO = '1.0.0';
const URL_BACKEND = 'https://script.google.com/macros/s/AKfycbz6F9bqwkayP-zxt7BGdj2BwJyJLfYt64oW8SfE9K0sDi9mUcjjcRasBNyXbwAyI1QQ/exec';
const URL_REGISTRO = 'https://script.google.com/macros/s/AKfycbz2CTGsbaUf6Yd5QL8IEA42O4XGqkFdCr7iDRgleGv5lkRd94wQkK9X0j_KkSjv9o4/exec';
const URL_APK = 'https://drive.google.com/drive/folders/1RwnIj0q2sd1aMOpmRbRcfFxL4z3fKflv';

/** Fonte 5x7 (ASCII 32 a 126), a mesma do firmware DisplayMaresBRGB (glcdfont do Adafruit_GFX, licença BSD).
 *  5 bytes por caractere, um por coluna; bit 0 = linha de cima. */
const FONTE = [0,0,0,0,0,0,0,95,0,0,0,7,0,7,0,20,127,20,127,20,36,42,127,42,18,35,19,8,100,98,54,73,86,32,80,0,8,7,3,0,0,28,34,65,0,0,65,34,28,0,42,28,127,28,42,8,8,62,8,8,0,128,112,48,0,8,8,8,8,8,0,0,96,96,0,32,16,8,4,2,62,81,73,69,62,0,66,127,64,0,114,73,73,73,70,33,65,73,77,51,24,20,18,127,16,39,69,69,69,57,60,74,73,73,49,65,33,17,9,7,54,73,73,73,54,70,73,73,41,30,0,0,20,0,0,0,64,52,0,0,0,8,20,34,65,20,20,20,20,20,0,65,34,20,8,2,1,89,9,6,62,65,93,89,78,124,18,17,18,124,127,73,73,73,54,62,65,65,65,34,127,65,65,65,62,127,73,73,73,65,127,9,9,9,1,62,65,65,81,115,127,8,8,8,127,0,65,127,65,0,32,64,65,63,1,127,8,20,34,65,127,64,64,64,64,127,2,28,2,127,127,4,8,16,127,62,65,65,65,62,127,9,9,9,6,62,65,81,33,94,127,9,25,41,70,38,73,73,73,50,3,1,127,1,3,63,64,64,64,63,31,32,64,32,31,63,64,56,64,63,99,20,8,20,99,3,4,120,4,3,97,89,73,77,67,0,127,65,65,65,2,4,8,16,32,0,65,65,65,127,4,2,1,2,4,64,64,64,64,64,0,3,7,8,0,32,84,84,120,64,127,40,68,68,56,56,68,68,68,40,56,68,68,40,127,56,84,84,84,24,0,8,126,9,2,24,164,164,156,120,127,8,4,4,120,0,68,125,64,0,32,64,64,61,0,127,16,40,68,0,0,65,127,64,0,124,4,120,4,120,124,8,4,4,120,56,68,68,68,56,252,24,36,36,24,24,36,36,24,252,124,8,4,4,8,72,84,84,84,36,4,4,63,68,36,60,64,64,32,124,28,32,64,32,28,60,64,48,64,60,68,40,16,40,68,76,144,144,144,124,68,100,84,76,68,0,8,54,65,0,0,0,119,0,0,0,65,54,8,0,2,1,2,4,2];

// ============================================================
// Armazenamento local (tudo fica no aparelho)
// ============================================================
const guardar = {
  ler(chave, padrao) {
    try { const v = localStorage.getItem('pm_' + chave); return v === null ? padrao : JSON.parse(v); }
    catch (_) { return padrao; }
  },
  gravar(chave, valor) {
    try { localStorage.setItem('pm_' + chave, JSON.stringify(valor)); return true; }
    catch (_) { return false; }
  },
};

const CONFIG_PADRAO = {
  descricao: '', mostrarAtual: true, mostrarProximaMare: true, mostrarLua: true,
  brilho: 10, velocidadeMs: 40, duracaoGraficoS: 10, modulos: 4, estiloRgb: true,
};
const config = () => Object.assign({}, CONFIG_PADRAO, guardar.ler('config', {}));
const salvarConfig = (c) => guardar.gravar('config', c);

/** ID deste aparelho na planilha: aleatório, criado na primeira vez (mesmo formato do Android). */
function idAparelho() {
  let id = guardar.ler('id', null);
  if (!id) {
    const b = new Uint8Array(6);
    (self.crypto || window.crypto).getRandomValues(b);
    id = 'APP-' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
    guardar.gravar('id', id);
  }
  return id;
}

// ============================================================
// Backend (o mesmo Web App do Google Apps Script dos painéis)
// ============================================================
async function getBackend(base, query) {
  const r = await fetch(base + '?' + query, { redirect: 'follow', cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const texto = await r.text();
  const ini = texto.trimStart();
  if (!ini.startsWith('{')) throw new Error('resposta inesperada do servidor');
  if (ini.length < 2000 && ini.includes('"erro"')) {
    let erro = null;
    try { erro = JSON.parse(ini).erro; } catch (_) { /* segue */ }
    if (erro) throw new Error(erro);
  }
  return texto;
}
const baixarIndiceTexto = () => getBackend(URL_BACKEND, 'action=index');
const baixarArquivo = (nome) => getBackend(URL_BACKEND, 'action=tabua&arquivo=' + encodeURIComponent(nome));

// ============================================================
// Dados: índice, tábua (o ano inteiro) e lua
// ============================================================
function lerIndice(texto) {
  const raiz = JSON.parse(texto);
  return { luaAtual: raiz.lua_atual || null, tabuas: raiz.tabuas || [] };
}
/** Um item por porto (o de maior ano), ordenado por estado e nome — como o combo dos painéis. */
function portosDoIndice(indice) {
  const porPorto = new Map();
  for (const t of indice.tabuas) {
    const atual = porPorto.get(t.porto);
    if (!atual || t.ano > atual.ano) porPorto.set(t.porto, t);
  }
  return [...porPorto.values()].sort((a, b) => (a.estado + a.porto).localeCompare(b.estado + b.porto, 'pt-BR'));
}

/** Junta um ou mais arquivos anuais numa tábua compacta e ordenada. */
function lerTabua(jsons) {
  const eventos = new Map();
  let porto = '', estado = '';
  for (const texto of jsons) {
    const raiz = JSON.parse(texto);
    porto = raiz.porto; estado = raiz.estado || '';
    for (const e of raiz.eventos) eventos.set(e.timestamp_unix, [e.altura_m, e.tipo === 'preamar' ? 1 : 0]);
  }
  const ts = [...eventos.keys()].sort((a, b) => a - b);
  if (ts.length < 2) throw new Error('tábua sem eventos');
  return { porto, estado, ts, h: ts.map((t) => eventos.get(t)[0]), p: ts.map((t) => eventos.get(t)[1]) };
}
function lerLua(jsons) {
  const fases = new Map();
  for (const texto of jsons) for (const f of JSON.parse(texto).fases) fases.set(f.timestamp_unix, f.fase);
  const ts = [...fases.keys()].sort((a, b) => a - b);
  if (!ts.length) throw new Error('tabela de lua vazia');
  return { ts, f: ts.map((t) => fases.get(t)) };
}

/**
 * Baixa todas as tábuas anuais do porto (do ano anterior em diante) e as
 * tabelas de lua. Só grava depois que tudo abriu sem erro.
 */
async function baixarPorto(nomePorto) {
  const indiceTexto = await baixarIndiceTexto();
  const indice = lerIndice(indiceTexto);
  const anoAtual = new Date().getFullYear();
  const itens = indice.tabuas.filter((t) => t.porto === nomePorto);
  if (!itens.length) throw new Error('Tábua "' + nomePorto + '" não encontrada no índice');
  const maior = Math.max(...itens.map((t) => t.ano));
  const escolhidos = itens.filter((t) => t.ano >= anoAtual - 1 || t.ano === maior);
  const tabua = lerTabua(await Promise.all(escolhidos.map((t) => baixarArquivo(t.arquivo))));

  const nomesLua = new Set();
  if (indice.luaAtual) nomesLua.add(indice.luaAtual);
  escolhidos.forEach((t) => nomesLua.add('lua_' + t.ano + '.json'));
  const luas = [];
  for (const nome of nomesLua) {
    try { const t = await baixarArquivo(nome); lerLua([t]); luas.push(t); } catch (_) { /* ano sem tabela de lua */ }
  }
  const lua = luas.length ? lerLua(luas) : null;

  guardar.gravar('indice', indiceTexto);
  if (!guardar.gravar('tabua', tabua)) throw new Error('sem espaço para guardar a tábua');
  guardar.gravar('lua', lua);
  guardar.gravar('arquivos', escolhidos.map((t) => t.arquivo));
  guardar.gravar('porto', nomePorto);
  guardar.gravar('ultimaSinc', Date.now());
}

/** Confere o índice 1x/dia e baixa de novo se apareceu tábua nova (ex.: ano seguinte em dezembro). */
async function sincronizarSeNecessario(forcar) {
  const porto = guardar.ler('porto', null);
  if (!porto) return false;
  const indice = lerIndice(await baixarIndiceTexto());
  const anoAtual = new Date().getFullYear();
  const esperados = indice.tabuas.filter((t) => t.porto === porto && t.ano >= anoAtual - 1).map((t) => t.arquivo);
  const locais = guardar.ler('arquivos', []);
  if (forcar || !guardar.ler('tabua', null) || esperados.some((a) => !locais.includes(a))) {
    await baixarPorto(porto);
    return true;
  }
  guardar.gravar('ultimaSinc', Date.now());
  return false;
}

/** Log de vida do aparelho na planilha "Telefones - Painel de Marés" (o usuário pode desligar). */
async function registrar() {
  if (!URL_REGISTRO || !guardar.ler('enviarDados', true)) return;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.exec(ua);
  const versaoIos = /OS (\d+)_(\d+)/.exec(ua);
  const campos = {
    action: 'registrar_app', id: idAparelho(), porto: guardar.ler('porto', '') || '',
    texto: config().descricao, versao: 'web-' + VERSAO,
    aparelho: ios ? ios[0] + ' (web)' : (/Android/.test(ua) ? 'Android (web)' : 'Navegador'),
    android: versaoIos ? 'iOS ' + versaoIos[1] + '.' + versaoIos[2] : (navigator.platform || ''),
  };
  const q = Object.entries(campos).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  try { await getBackend(URL_REGISTRO, q); } catch (_) { /* tenta de novo no próximo dia */ }
}

// ============================================================
// Cálculos e textos (portados do DisplayMaresB.ino / Mare.kt)
// ============================================================
const agora = () => Math.floor(Date.now() / 1000);
const NOMES_FASE = ['NOVA', 'CRESCENTE', 'CHEIA', 'MINGUANTE'];
const NOMES_FASE_TELA = ['Nova', 'Crescente', 'Cheia', 'Minguante'];

/** Primeiro índice com timestamp > t (busca binária); length se não houver. */
function proximoIndice(ts, t) {
  let lo = 0, hi = ts.length - 1, r = ts.length;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (ts[m] > t) { r = m; hi = m - 1; } else lo = m + 1; }
  return r;
}
const interpolar = (a1, a2, f) => a1 + (a2 - a1) * (1 - Math.cos(Math.PI * f)) / 2;
function alturaEm(tabua, t) {
  const p = proximoIndice(tabua.ts, t);
  if (p <= 0 || p >= tabua.ts.length) return null;
  return interpolar(tabua.h[p - 1], tabua.h[p], (t - tabua.ts[p - 1]) / (tabua.ts[p] - tabua.ts[p - 1]));
}
function subindo(tabua, t) {
  const p = proximoIndice(tabua.ts, t);
  return p <= 0 || p >= tabua.ts.length ? null : tabua.p[p] === 1;
}
// sempre o fuso do aparelho
const hora = (t) => { const d = new Date(t * 1000); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
function diasAte(t, ref) {
  const a = new Date(ref * 1000), b = new Date(t * 1000);
  const dia = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((dia(b) - dia(a)) / 86400000);
}
const removerAcentos = (s) => s.normalize('NFD').replace(/\p{Mn}+/gu, '');

function textoHora(tabua, t) {
  const h = tabua ? alturaEm(tabua, t) : null;
  return h === null ? hora(t) : hora(t) + '  MARE ATUAL: ' + h.toFixed(2) + ' m';
}
function textoProximaMare(tabua, t) {
  if (!tabua) return 'PROXIMA MARE: indisponivel';
  const p = proximoIndice(tabua.ts, t);
  if (p >= tabua.ts.length) return 'PROXIMA MARE: indisponivel';
  return 'PROXIMA ' + (tabua.p[p] ? 'ALTA' : 'BAIXA') + ': ' + hora(tabua.ts[p]) + ' - ' + tabua.h[p].toFixed(2) + ' m';
}
function textoProximaLua(lua, t) {
  if (!lua) return 'PROXIMA FASE DA LUA: indisponivel';
  const p = proximoIndice(lua.ts, t);
  if (p >= lua.ts.length) return 'PROXIMA FASE DA LUA: indisponivel';
  const nome = NOMES_FASE[lua.f[p] & 3], d = diasAte(lua.ts[p], t);
  return d <= 0 ? 'PROXIMA LUA ' + nome + ' HOJE' : 'PROXIMA LUA ' + nome + ' EM ' + d + (d === 1 ? ' DIA' : ' DIAS');
}

// ============================================================
// Painel de LED (mesmo desenho do firmware e do app Android)
// ============================================================
const LINHAS = 8;
const ESTILO_RGB = { texto: '#ff7800', agua: '#0050ff', agora: '#ff0000', inverter: false };
const ESTILO_MAX = { texto: '#ff2818', agua: '#ff2818', agora: '#ff2818', inverter: true };
const estiloDe = (c) => (c.estiloRgb ? ESTILO_RGB : ESTILO_MAX);
const COR_APAGADO = '#16242d', COR_PLACA = '#05090c';

const novoQuadro = (colunas) => ({ colunas, p: new Array(colunas * LINHAS).fill(null) });
function acender(q, c, l, cor) { if (c >= 0 && c < q.colunas && l >= 0 && l < LINHAS) q.p[l * q.colunas + c] = cor; }
const larguraTexto = (s) => s.length * 6;

function desenharTexto(q, texto, x, cor) {
  for (const ch of texto) {
    if (x >= q.colunas) break;
    if (x + 5 >= 0) {
      let k = ch.charCodeAt(0);
      if (k < 32 || k > 126) k = 63; // '?' para o que a fonte não tem
      for (let col = 0; col < 5; col++) {
        const bits = FONTE[(k - 32) * 5 + col];
        for (let l = 0; l < 7; l++) if (bits & (1 << l)) acender(q, x + col, l, cor);
      }
    }
    x += 6;
  }
}

/** Meia onda entre o evento anterior (esquerda) e o próximo (direita), preenchida como água. */
function desenharGrafico(q, tabua, t, estilo) {
  if (!tabua) return;
  const p = proximoIndice(tabua.ts, t);
  if (p <= 0 || p >= tabua.ts.length) return;
  const a1 = tabua.h[p - 1], a2 = tabua.h[p], t1 = tabua.ts[p - 1], t2 = tabua.ts[p];
  const min = Math.min(a1, a2), faixa = Math.max(Math.abs(a2 - a1), 0.01);
  const n = q.colunas;
  const fAgora = Math.min(1, Math.max(0, (t - t1) / (t2 - t1)));
  const cAgora = n > 1 ? Math.round(fAgora * (n - 1)) : 0;
  for (let c = 0; c < n; c++) {
    const h = interpolar(a1, a2, n > 1 ? c / (n - 1) : 0);
    const nivel = Math.min(LINHAS - 1, Math.max(0, Math.round((1 - (h - min) / faixa) * (LINHAS - 1))));
    for (let l = 0; l < LINHAS; l++) {
      const agua = l >= nivel;
      if (c === cAgora && estilo.inverter) { if (!agua) acender(q, c, l, estilo.agora); }
      else if (c === cAgora) acender(q, c, l, estilo.agora);
      else if (agua) acender(q, c, l, estilo.agua);
    }
  }
}

function pintar(ctx, q, x0, y0, passo, brilho) {
  const raio = passo * 0.4, alfa = (90 + 165 * Math.min(15, Math.max(0, brilho)) / 15) / 255;
  for (let l = 0; l < LINHAS; l++) for (let c = 0; c < q.colunas; c++) {
    const cor = q.p[l * q.colunas + c];
    ctx.globalAlpha = cor ? alfa : 1;
    ctx.fillStyle = cor || COR_APAGADO;
    ctx.beginPath();
    ctx.arc(x0 + c * passo + passo / 2, y0 + l * passo + passo / 2, raio, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * Painel com o ciclo do DisplayMaresB: letreiro -> hora+maré -> próxima maré ->
 * próxima lua -> gráfico (sempre por último). modo: 'ciclo', 'grafico' (só o
 * gráfico, fixo) ou 'textos' (só os textos; o gráfico já aparece em outro lugar).
 */
class Painel {
  constructor(canvas, modo) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.modo = modo;
    this.cfg = config(); this.tabua = null; this.lua = null; this.aviso = null;
    this.quadro = novoQuadro(32); this.estado = 'GRAFICO'; this.texto = ''; this.x = 0;
    this.timer = null; this.inicio = 0;
    new ResizeObserver(() => this.medir()).observe(canvas);
  }
  definir(cfg, tabua, lua, aviso) {
    this.cfg = cfg; this.tabua = tabua; this.lua = lua; this.aviso = aviso || null;
    if (this.quadro.colunas !== cfg.modulos * 8) this.quadro = novoQuadro(cfg.modulos * 8);
    this.medir();
    this.iniciar(this.ordem()[0]);
  }
  temTexto() {
    const c = this.cfg;
    return !!this.aviso || c.descricao.trim() !== '' || c.mostrarAtual || c.mostrarProximaMare || c.mostrarLua;
  }
  ordem() {
    if (this.modo === 'grafico') return ['GRAFICO'];
    if (this.aviso) return ['DESCRICAO'];
    const c = this.cfg, o = [];
    if (c.descricao.trim()) o.push('DESCRICAO');
    if (c.mostrarAtual) o.push('HORA');
    if (c.mostrarProximaMare) o.push('PROXIMA_MARE');
    if (c.mostrarLua) o.push('PROXIMA_LUA');
    if (this.modo !== 'textos' || !o.length) o.push('GRAFICO');
    return o;
  }
  proximo() { const o = this.ordem(); return o[(o.indexOf(this.estado) + 1) % o.length]; }
  iniciar(estado) {
    clearTimeout(this.timer);
    this.estado = estado; this.inicio = performance.now();
    const t = agora();
    const txt = {
      DESCRICAO: this.aviso || this.cfg.descricao,
      HORA: textoHora(this.tabua, t),
      PROXIMA_MARE: textoProximaMare(this.tabua, t),
      PROXIMA_LUA: textoProximaLua(this.lua, t),
      GRAFICO: '',
    }[estado];
    this.texto = removerAcentos(txt.replace(/\s+/g, ' '));
    this.x = this.quadro.colunas;
    this.desenhar();
    this.timer = setTimeout(() => this.passo(), estado === 'GRAFICO' ? 1000 : this.cfg.velocidadeMs);
  }
  passo() {
    if (document.hidden) { this.timer = setTimeout(() => this.passo(), 1000); return; }
    if (this.estado === 'GRAFICO') {
      if (performance.now() - this.inicio >= this.cfg.duracaoGraficoS * 1000) this.iniciar(this.proximo());
      else { this.desenhar(); this.timer = setTimeout(() => this.passo(), 1000); }
      return;
    }
    this.x--;
    if (this.x + larguraTexto(this.texto) < 0) {
      this.timer = setTimeout(() => this.iniciar(this.proximo()), 300);
      return;
    }
    this.desenhar();
    this.timer = setTimeout(() => this.passo(), this.cfg.velocidadeMs);
  }
  medir() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    const cols = this.quadro.colunas;
    // altura natural: mesmo passo na horizontal e vertical (a não ser que o CSS fixe a altura)
    const fixa = this.canvas.dataset.alturaFixa === '1';
    const passoLargura = r.width / (cols + 1);
    const altura = fixa ? r.height : Math.round(passoLargura * (LINHAS + 1));
    if (!fixa) this.canvas.style.height = altura + 'px';
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(altura * dpr);
    this.desenhar();
  }
  desenhar() {
    const q = this.quadro, ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    q.p.fill(null);
    if (this.estado === 'GRAFICO') desenharGrafico(q, this.tabua, agora(), estiloDe(this.cfg));
    else desenharTexto(q, this.texto, this.x, estiloDe(this.cfg).texto);
    ctx.fillStyle = COR_PLACA; ctx.fillRect(0, 0, W, H);
    const passo = Math.floor(Math.min(W / (q.colunas + 1), H / (LINHAS + 1)));
    if (passo <= 0) return;
    pintar(ctx, q, (W - passo * q.colunas) / 2, (H - passo * LINHAS) / 2, passo, this.cfg.brilho);
  }
}

// ============================================================
// Mapa do litoral (Natural Earth, desenhado aqui; sem servidor de mapas)
// ============================================================
class Mapa {
  constructor(canvas, aoTocar) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.aoTocar = aoTocar;
    this.aneis = []; this.pontos = []; this.escolhido = null;
    this.m = { s: 1, x: 0, y: 0 }; this.sAjuste = 1; this.ajustado = false;
    this.toques = new Map(); this.ultimoToque = 0; this.moveu = false;
    this.noturno = matchMedia('(prefers-color-scheme: dark)').matches;
    fetch('litoral.json').then((r) => r.json()).then((d) => {
      this.aneis = d.map((a) => {
        const pts = [];
        for (let i = 0; i < a.p.length; i += 2) pts.push(this.mundo(a.p[i], a.p[i + 1]));
        return { br: a.br, pts };
      });
      this.desenhar();
    });
    new ResizeObserver(() => { this.medir(); }).observe(canvas);
    canvas.addEventListener('pointerdown', (e) => this.baixo(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.cima(e));
    canvas.addEventListener('pointercancel', (e) => this.toques.delete(e.pointerId));
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(e.deltaY < 0 ? 1.25 : 0.8, e.offsetX, e.offsetY); }, { passive: false });
  }
  mundo(lon, lat) { return [lon * Math.cos(15 * Math.PI / 180), -lat]; }
  tela([x, y]) { return [x * this.m.s + this.m.x, y * this.m.s + this.m.y]; }
  definirPontos(pontos, escolhido) {
    if (!this.pontos.length) this.ajustado = false;
    this.pontos = pontos.map((p) => Object.assign({ xy: this.mundo(p.lon, p.lat) }, p));
    this.escolhido = escolhido;
    this.ajustar(); this.desenhar();
  }
  medir() {
    const r = this.canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    this.dpr = dpr; this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr);
    this.ajustado = false; this.ajustar(); this.desenhar();
  }
  ajustar() {
    const W = this.canvas.width / (this.dpr || 1), H = this.canvas.height / (this.dpr || 1);
    if (!W || !H || this.ajustado) return;
    const xs = this.pontos.length ? this.pontos.map((p) => p.xy[0]) : [-72, -33].map((l) => this.mundo(l, 0)[0]);
    const ys = this.pontos.length ? this.pontos.map((p) => p.xy[1]) : [5, -34].map((l) => -l);
    const x0 = Math.min(...xs) - 1.5, x1 = Math.max(...xs) + 1.5, y0 = Math.min(...ys) - 1.5, y1 = Math.max(...ys) + 1.5;
    const marg = 24, s = Math.min((W - 2 * marg) / (x1 - x0), (H - 2 * marg) / (y1 - y0));
    this.m = { s, x: W / 2 - s * (x0 + x1) / 2, y: H / 2 - s * (y0 + y1) / 2 };
    this.sAjuste = s; this.ajustado = true;
  }
  zoom(f, fx, fy) {
    const novo = Math.min(this.sAjuste * 60, Math.max(this.sAjuste * 0.8, this.m.s * f));
    const k = novo / this.m.s;
    this.m = { s: novo, x: fx - (fx - this.m.x) * k, y: fy - (fy - this.m.y) * k };
    this.desenhar();
  }
  pos(e) { const r = this.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  baixo(e) {
    this.canvas.setPointerCapture(e.pointerId);
    this.toques.set(e.pointerId, this.pos(e));
    if (this.toques.size === 1) { this.moveu = false; this.inicioToque = this.pos(e); }
    if (this.toques.size === 2) { const [a, b] = [...this.toques.values()]; this.distPinca = Math.hypot(a[0] - b[0], a[1] - b[1]); }
  }
  move(e) {
    if (!this.toques.has(e.pointerId)) return;
    const ant = this.toques.get(e.pointerId), atual = this.pos(e);
    this.toques.set(e.pointerId, atual);
    if (this.toques.size === 2) {
      const [a, b] = [...this.toques.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (this.distPinca) this.zoom(d / this.distPinca, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      this.distPinca = d; this.moveu = true;
    } else if (this.toques.size === 1) {
      if (Math.hypot(atual[0] - this.inicioToque[0], atual[1] - this.inicioToque[1]) > 6) this.moveu = true;
      this.m.x += atual[0] - ant[0]; this.m.y += atual[1] - ant[1]; this.desenhar();
    }
  }
  cima(e) {
    const p = this.pos(e);
    this.toques.delete(e.pointerId);
    if (this.toques.size < 2) this.distPinca = null;
    if (this.moveu || this.toques.size) return;
    const t = performance.now();
    if (t - this.ultimoToque < 300) { this.zoom(2.5, p[0], p[1]); this.ultimoToque = 0; clearTimeout(this.esperaToque); return; }
    this.ultimoToque = t;
    this.esperaToque = setTimeout(() => {
      let melhor = null, dMin = 28;
      for (const pt of this.pontos) {
        const [x, y] = this.tela(pt.xy), d = Math.hypot(x - p[0], y - p[1]);
        if (d <= dMin) { dMin = d; melhor = pt; }
      }
      if (melhor) { this.escolhido = melhor.chave; this.desenhar(); this.aoTocar(melhor); }
    }, 300);
  }
  desenhar() {
    const ctx = this.ctx, dpr = this.dpr || 1, W = this.canvas.width / dpr, H = this.canvas.height / dpr;
    if (!W) return;
    const n = this.noturno;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = n ? '#0e2430' : '#cfe3ea'; ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 1; ctx.strokeStyle = n ? '#5c7782' : '#8fa9b3';
    for (const br of [false, true]) {
      ctx.beginPath();
      for (const a of this.aneis) {
        if (a.br !== br) continue;
        a.pts.forEach((pt, i) => { const [x, y] = this.tela(pt); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.closePath();
      }
      ctx.fillStyle = br ? (n ? '#2a3b33' : '#f4f1e6') : (n ? '#1c292f' : '#e2e0d8');
      ctx.fill(); ctx.stroke();
    }
    const rotulos = this.m.s >= this.sAjuste * 3, ocupados = [];
    ctx.font = '12px -apple-system, sans-serif';
    const lista = [...this.pontos].sort((a, b) => (a.chave === this.escolhido) - (b.chave === this.escolhido));
    for (const pt of lista) {
      const [x, y] = this.tela(pt.xy);
      if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
      const esc = pt.chave === this.escolhido, r = esc ? 8.4 : 6;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = esc ? '#0f6d82' : '#e06a10'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.lineWidth = 1;
    }
    // nomes numa segunda passada, por cima de todos os pontos (o escolhido primeiro);
    // um nome que cobriria outro ponto fica de fora (aparece com mais zoom)
    const caixasPontos = lista.map((pt) => { const [x, y] = this.tela(pt.xy); return [pt.chave, x - 7, y - 7, x + 7, y + 7]; });
    for (const pt of lista.reverse()) {
      const [x, y] = this.tela(pt.xy);
      if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
      const esc = pt.chave === this.escolhido, r = esc ? 8.4 : 6;
      if (rotulos || esc) {
        const w = ctx.measureText(pt.rotulo).width, bx = x + r + 4, caixa = [bx - 3, y - 9, bx + w + 3, y + 6];
        const cruza = (o) => !(caixa[2] < o[0] || caixa[0] > o[2] || caixa[3] < o[1] || caixa[1] > o[3]);
        if (ocupados.some(cruza) || caixasPontos.some((c) => c[0] !== pt.chave && cruza(c.slice(1)))) continue;
        ocupados.push(caixa);
        ctx.fillStyle = n ? 'rgba(10,18,24,.8)' : 'rgba(255,255,255,.85)';
        ctx.fillRect(caixa[0], caixa[1], caixa[2] - caixa[0], caixa[3] - caixa[1]);
        ctx.fillStyle = n ? '#e6edf0' : '#0b2436'; ctx.fillText(pt.rotulo, bx, y + 3);
      }
    }
  }
}

// ============================================================
// Telas
// ============================================================
const $ = (id) => document.getElementById(id);
let painel, graficoFixo, previa, mapa, portos = [], coordenadas = null, sincronizando = false;
const deitado = matchMedia('(orientation: landscape) and (max-height: 600px)');

function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.style.display = 'block';
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.style.display = 'none'; }, 4000);
}
function dialogo(titulo, corpoHtml, acoes) {
  const d = $('dialogo');
  $('dlg-titulo').textContent = titulo; $('dlg-corpo').innerHTML = corpoHtml;
  const box = $('dlg-acoes'); box.innerHTML = '';
  for (const [rotulo, fn] of acoes) {
    const b = document.createElement('button'); b.textContent = rotulo;
    b.onclick = () => { d.close(); if (fn) fn(); }; box.appendChild(b);
  }
  if (!d.open) d.showModal();
}

function mostrarTela(nome) {
  for (const t of document.querySelectorAll('.tela')) t.classList.toggle('ativa', t.id === 'tela-' + nome);
  if (nome === 'display') carregarDisplay();
  if (nome === 'escolher') abrirEscolha();
  if (nome === 'ajustes') abrirAjustes();
  window.scrollTo(0, 0);
}
function rota() {
  const h = location.hash.slice(1);
  if (!guardar.ler('porto', null) && h !== 'ajustes') return mostrarTela('escolher');
  mostrarTela(h === 'escolher' || h === 'ajustes' ? h : 'display');
}

// ---------- display ----------
async function carregarDisplay() {
  const cfg = config(), tabua = guardar.ler('tabua', null), lua = guardar.ler('lua', null);
  $('titulo-porto').textContent = tabua ? tabua.estado + ' - ' + tabua.porto : (guardar.ler('porto', '') || 'Tábua de Marés');
  aplicarOrientacao();
  if (!tabua) {
    painel.definir(cfg, null, null, 'SINCRONIZANDO...'); graficoFixo.definir(cfg, null, null);
    return sincronizar(true);
  }
  painel.definir(cfg, tabua, lua); graficoFixo.definir(cfg, tabua, lua);
  $('painel').style.display = deitado.matches || painel.temTexto() ? '' : 'none';
  mostrarCartoes(tabua, lua);
  if (Date.now() - guardar.ler('ultimaSinc', 0) > 24 * 3600 * 1000) sincronizar(false);
}

async function sincronizar(forcar) {
  if (sincronizando) return;
  sincronizando = true;
  try {
    const mudou = await sincronizarSeNecessario(forcar);
    registrar();
    if (mudou) carregarDisplay();
  } catch (e) {
    if (!guardar.ler('tabua', null)) {
      painel.definir(config(), null, null, 'SEM CONEXAO');
      toast('Não foi possível baixar a tábua: ' + e.message);
    }
  } finally { sincronizando = false; }
}

function mostrarCartoes(tabua, lua) {
  const t = agora(), h = alturaEm(tabua, t);
  $('mare-agora').textContent = h === null ? '—' : h.toFixed(2).replace('.', ',') + ' m';
  const s = subindo(tabua, t);
  $('tendencia').textContent = s === null ? 'Fora do período da tábua baixada' : (s ? '▲ subindo · ' : '▼ descendo · ') + hora(t);
  const dia = (ts) => new Date(ts * 1000).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '');
  const p = proximoIndice(tabua.ts, t), linhas = [];
  for (let i = p; i < Math.min(p + 6, tabua.ts.length); i++) {
    linhas.push(dia(tabua.ts[i]).padEnd(10) + ' ' + hora(tabua.ts[i]) + '  ' + (tabua.p[i] ? '▲ alta ' : '▼ baixa') + '  ' + tabua.h[i].toFixed(2).replace('.', ',').padStart(5) + ' m');
  }
  $('proximas').textContent = linhas.length ? linhas.join('\n') : 'Sem eventos futuros na tábua baixada.';
  if (!lua) $('lua').textContent = 'Tabela de lua indisponível';
  else {
    const q = proximoIndice(lua.ts, t), l = [];
    for (let i = q; i < Math.min(q + 4, lua.ts.length); i++) {
      const d = diasAte(lua.ts[i], t);
      l.push(NOMES_FASE_TELA[lua.f[i] & 3] + ' · ' + dia(lua.ts[i]) + ' · ' + (d === 0 ? 'hoje' : d === 1 ? 'amanhã' : 'em ' + d + ' dias'));
    }
    $('lua').textContent = l.join('\n');
  }
  const sinc = guardar.ler('ultimaSinc', 0);
  $('rodape').textContent = (sinc ? 'Dados baixados em ' + new Date(sinc).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + '. ' : '') +
    'Previsão astronômica da DHN, não medição em tempo real. Vento, pressão e ressacas alteram a maré real. Não use como única fonte para navegação.';
}

let wakeLock = null;
async function aplicarOrientacao() {
  // deitado: ciclo completo em tela cheia; em pé: gráfico fixo em cima e só os textos embaixo
  painel.modo = deitado.matches ? 'ciclo' : 'textos';
  painel.canvas.dataset.alturaFixa = deitado.matches ? '1' : '0';
  if (deitado.matches) painel.canvas.style.height = '';
  if (painel.tabua || painel.aviso) painel.definir(painel.cfg, painel.tabua, painel.lua, painel.aviso);
  $('painel').style.display = deitado.matches || painel.temTexto() ? '' : 'none';
  // tela sempre ligada deitado (quando o navegador permite)
  try {
    if (deitado.matches && 'wakeLock' in navigator && !wakeLock && !document.hidden) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!deitado.matches && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (_) { /* sem permissão: segue sem */ }
}

// ---------- escolha ----------
async function abrirEscolha() {
  const cache = guardar.ler('indice', null);
  if (cache) mostrarPortos(lerIndice(cache));
  $('estado-lista').textContent = cache ? '' : 'Carregando a lista de tábuas…';
  try {
    const texto = await baixarIndiceTexto();
    guardar.gravar('indice', texto);
    mostrarPortos(lerIndice(texto));
    $('estado-lista').textContent = '';
  } catch (e) {
    if (!portos.length) $('estado-lista').textContent = 'Não foi possível baixar a lista de tábuas (' + e.message + '). Verifique a internet e abra esta tela de novo.';
  }
}
async function mostrarPortos(indice) {
  portos = portosDoIndice(indice);
  filtrar();
  if (!coordenadas) coordenadas = await fetch('coordenadas_portos.json').then((r) => r.json()).catch(() => []);
  const porNome = new Map(coordenadas.map((c) => [c.porto, c]));
  mapa.definirPontos(portos.filter((p) => porNome.has(p.porto)).map((p) => ({
    chave: p.porto, rotulo: p.estado + ' - ' + p.porto, lat: porNome.get(p.porto).lat, lon: porNome.get(p.porto).lon,
  })), guardar.ler('porto', null));
}
function filtrar() {
  const termo = removerAcentos($('busca').value.trim()).toLowerCase(), escolhido = guardar.ler('porto', null);
  const ul = $('lista-portos'); ul.innerHTML = '';
  for (const p of portos) {
    if (termo && !removerAcentos(p.estado + ' ' + p.porto).toLowerCase().includes(termo)) continue;
    const li = document.createElement('li'), b = document.createElement('button');
    b.innerHTML = '<span class="uf"></span><span class="nome"></span><span class="marcado"></span>';
    b.querySelector('.uf').textContent = p.estado; b.querySelector('.nome').textContent = p.porto;
    b.querySelector('.marcado').textContent = p.porto === escolhido ? '✓' : '';
    b.onclick = () => confirmar(p.porto, p.estado);
    li.appendChild(b); ul.appendChild(li);
  }
}
function confirmar(porto, estado) {
  dialogo(estado + ' - ' + porto, '<p>Usar esta tábua? O app baixa agora as marés e as fases da lua do ano inteiro.</p>',
    [['Cancelar'], ['Usar', () => baixar(porto)]]);
}
async function baixar(porto) {
  dialogo('Baixando a tábua do ano inteiro…', '<div class="girando"></div>', []);
  try {
    await baixarPorto(porto);
    $('dialogo').close();
    registrar();
    location.hash = '';
    rota();
  } catch (e) {
    dialogo('Falha no download', '<p></p>', [['Cancelar'], ['Tentar de novo', () => baixar(porto)]]);
    $('dlg-corpo').firstChild.textContent = 'Não foi possível baixar a tábua: ' + e.message;
  }
}

// ---------- ajustes ----------
let descricaoInicial = '';
function abrirAjustes() {
  const c = config();
  descricaoInicial = c.descricao;
  $('descricao').value = c.descricao;
  $('mostrar-atual').checked = c.mostrarAtual; $('mostrar-proxima').checked = c.mostrarProximaMare; $('mostrar-lua').checked = c.mostrarLua;
  $('brilho').value = c.brilho; $('velocidade').value = c.velocidadeMs; $('duracao').value = c.duracaoGraficoS; $('modulos').value = c.modulos;
  $(c.estiloRgb ? 'estilo-rgb' : 'estilo-max').checked = true;
  $('enviar-dados').checked = guardar.ler('enviarDados', true);
  rotulos();
  previa.definir(c, guardar.ler('tabua', null), guardar.ler('lua', null));
  $('sobre').textContent = 'Tábua: ' + (guardar.ler('porto', null) || 'nenhuma') + '\nCódigo deste aparelho (para suporte): ' + idAparelho() +
    '\nVersão web ' + VERSAO + '\nDados: DHN (Marinha do Brasil), via o mesmo servidor dos painéis.\n' +
    'Fases da lua por cálculo astronômico médio (o dia e a ordem das fases são corretos; o horário pode variar algumas horas).';
  $('link-android').style.display = /Android/.test(navigator.userAgent) ? '' : 'none';
  $('link-android').href = URL_APK;
}
function lerAjustes() {
  return {
    descricao: $('descricao').value.slice(0, 3999), mostrarAtual: $('mostrar-atual').checked,
    mostrarProximaMare: $('mostrar-proxima').checked, mostrarLua: $('mostrar-lua').checked,
    brilho: +$('brilho').value, velocidadeMs: +$('velocidade').value, duracaoGraficoS: +$('duracao').value,
    modulos: +$('modulos').value, estiloRgb: $('estilo-rgb').checked,
  };
}
function rotulos() {
  const m = +$('modulos').value;
  $('rot-brilho').textContent = 'Brilho: ' + $('brilho').value + ' (0 a 15)';
  $('rot-velocidade').textContent = 'Velocidade da rolagem: ' + $('velocidade').value + ' ms por coluna (menor = mais rápido)';
  $('rot-duracao').textContent = 'Duração do gráfico: ' + $('duracao').value + ' s';
  $('rot-modulos').textContent = 'Tamanho do painel: ' + m + (m === 1 ? ' módulo' : ' módulos') + ' 8x8 (' + m * 8 + ' x 8 LEDs)';
}
function aoMudarAjuste() {
  const c = lerAjustes(); salvarConfig(c); rotulos();
  previa.definir(c, guardar.ler('tabua', null), guardar.ler('lua', null));
}

// ---------- início ----------
function iniciar() {
  painel = new Painel($('painel'), 'textos');
  graficoFixo = new Painel($('grafico-fixo'), 'grafico');
  previa = new Painel($('previa'), 'ciclo');
  mapa = new Mapa($('mapa'), (pt) => {
    const p = portos.find((x) => x.porto === pt.chave);
    if (p) confirmar(p.porto, p.estado);
  });

  document.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); location.hash = b.dataset.ir; }));
  document.querySelectorAll('[data-voltar]').forEach((b) => b.addEventListener('click', () => {
    if (!guardar.ler('porto', null)) return;
    location.hash = '';
  }));
  $('busca').addEventListener('input', filtrar);
  for (const id of ['descricao', 'mostrar-atual', 'mostrar-proxima', 'mostrar-lua', 'brilho', 'velocidade', 'duracao', 'modulos', 'estilo-rgb', 'estilo-max']) {
    $(id).addEventListener('input', aoMudarAjuste);
  }
  $('enviar-dados').addEventListener('change', (e) => { guardar.gravar('enviarDados', e.target.checked); if (e.target.checked) registrar(); });
  $('baixar-de-novo').addEventListener('click', async (e) => {
    const b = e.target; b.disabled = true;
    try { await sincronizarSeNecessario(true); toast('Tábua baixada de novo'); previa.definir(config(), guardar.ler('tabua', null), guardar.ler('lua', null)); }
    catch (err) { toast('Falha: ' + err.message); }
    b.disabled = false;
  });

  // deitado: toque mostra/esconde os botões
  $('tela-display').addEventListener('click', () => {
    if (!deitado.matches) return;
    const t = $('tela-display'); t.classList.toggle('mostrar-barra');
    clearTimeout(iniciar.esconder);
    if (t.classList.contains('mostrar-barra')) iniciar.esconder = setTimeout(() => t.classList.remove('mostrar-barra'), 4000);
  });
  deitado.addEventListener('change', aplicarOrientacao);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && $('tela-display').classList.contains('ativa')) { aplicarOrientacao(); carregarDisplay(); } });
  setInterval(() => { const tb = guardar.ler('tabua', null); if (tb && $('tela-display').classList.contains('ativa') && !deitado.matches) mostrarCartoes(tb, guardar.ler('lua', null)); }, 30000);

  // texto do letreiro mudou: atualiza a planilha ao sair dos ajustes
  window.addEventListener('hashchange', () => {
    if (location.hash.slice(1) !== 'ajustes' && config().descricao !== descricaoInicial) { descricaoInicial = config().descricao; registrar(); }
    rota();
  });

  // dica de instalação no iPhone (Safari, ainda não instalado)
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const instalado = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  if (ios && !instalado && !guardar.ler('avisoFechado', false)) $('aviso-instalar').classList.add('ver');
  $('fechar-aviso').addEventListener('click', (e) => { e.stopPropagation(); $('aviso-instalar').classList.remove('ver'); guardar.gravar('avisoFechado', true); });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { /* funciona sem, só não fica offline */ });
  rota();
}
document.addEventListener('DOMContentLoaded', iniciar);
