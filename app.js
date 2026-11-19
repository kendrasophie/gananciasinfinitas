/* =========================================================
   Ganancias infinitas · lógica de la aplicación
   ========================================================= */
'use strict';

const VERSION = '1.1.0';

/* ---------- Utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;

function num(v) {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).trim().replace(/\s/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return isFinite(n) ? n : null;
}
const bool = v => v === true || v === 'Sí' || v === 'true';

const nf0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const fmt = n => (n === null || n === undefined || isNaN(n)) ? '—' : (Math.abs(n) >= 100 || Number.isInteger(n) ? nf0 : nf2).format(n);
const money = (n, cur = 'USD') => `${cur} ${fmt(n)}`;

/* Fechas en hora local: 'YYYY-MM-DDTHH:mm' */
function nowLocal() { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); }
const hoyStr = () => nowLocal().slice(0, 10);
function dStr(d) { return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
function parseDay(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseDay(s); d.setDate(d.getDate() + n); return dStr(d); }
const toDate = s => s ? new Date(s) : null;
const hm = s => s ? String(s).slice(11, 16) : '—';
const ddmm = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '';
const ddmmyyyy = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '';
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function diaLargo(s) { const d = parseDay(s); return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; }
function minutosEntre(a, b) { if (!a || !b) return null; return Math.round((toDate(b) - toDate(a)) / 6e4); }
function relativo(min) {
  const a = Math.abs(min), h = Math.floor(a / 60), m = a % 60;
  const t = h ? `${h} h${m ? ' ' + m + ' min' : ''}` : `${m} min`;
  return min >= 0 ? `en ${t}` : `hace ${t}`;
}

/* ---------- Almacenamiento local ---------- */
const store = (area) => ({
  get(k, d = null) { try { const v = area.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { area.setItem(k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { area.removeItem(k); } catch (e) { } }
});
const LS = store(window.localStorage);
const SS = store(window.sessionStorage);

/* ---------- Datos fijos ---------- */
const PROVINCIAS = ['Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'];
const PAISES = ['Alemania', 'Australia', 'Bolivia', 'Brasil', 'Canadá', 'Chile', 'China', 'Colombia', 'Corea del Sur', 'Ecuador', 'España', 'Estados Unidos', 'Francia', 'Israel', 'Italia', 'Japón', 'México', 'Países Bajos', 'Paraguay', 'Perú', 'Portugal', 'Reino Unido', 'Suiza', 'Uruguay', 'Venezuela'];

function tramoPar(origen, destino, monto, km) {
  return [
    { id: uid(), origen, destino, monto, km },
    { id: uid(), origen: destino, destino: origen, monto, km }
  ];
}
const CONFIG_DEF = {
  tramos: [
    ...tramoPar('Aeropuerto Ezeiza', 'Ciudad Autónoma de Buenos Aires', 40, 35),
    ...tramoPar('Aeroparque Jorge Newbery', 'Aeropuerto Ezeiza', 45, 48),
    ...tramoPar('Aeroparque Jorge Newbery', 'Microcentro', 30, 7),
    ...tramoPar('Aeroparque Jorge Newbery', 'Devoto', 35, 14)
  ],
  cotUSD: null,
  cotEUR: null,
  cotFecha: '',
  coordinador: '5491132693757',
  meta: null,
  comb: { activo: false, capacidad: null, autonomia: null, factor: 1.5 }
};

/* ---------- Estado ---------- */
const S = {
  viajes: [], cargas: [], config: clone(CONFIG_DEF), cola: [],
  url: '', token: '', demo: false, online: navigator.onLine,
  sincronizando: false, ultimaSync: null, errorSync: '',
  tab: 'inicio',
  fViajes: { p: 'semana', desde: '', hasta: '', q: '' },
  fResumen: { p: 'mes', desde: '', hasta: '' },
  qClientes: '',
  propinasEnTotal: LS.get('av_prop_total', true),
  draft: null, draftDirty: false, cargaDraft: null
};

function guardarCache() { if (!S.demo) LS.set('av_datos', { viajes: S.viajes, cargas: S.cargas, config: S.config }); }
function guardarCola() { if (!S.demo) LS.set('av_cola', S.cola); }
function cargarCache() {
  const d = LS.get('av_datos');
  if (d) { S.viajes = d.viajes || []; S.cargas = d.cargas || []; S.config = mergeConfig(d.config); }
  S.cola = LS.get('av_cola', []);
}
function mergeConfig(c) {
  const out = clone(CONFIG_DEF);
  if (!c) return out;
  Object.assign(out, c);
  out.comb = Object.assign(clone(CONFIG_DEF.comb), c.comb || {});
  if (!Array.isArray(out.tramos)) out.tramos = clone(CONFIG_DEF.tramos);
  return out;
}

/* Normaliza lo que llega de la hoja */
function normViaje(v) {
  const n = Object.assign({}, v);
  ['pasajeros', 'km', 'monto', 'propinaMonto', 'peajeMonto', 'aguaCant', 'toallitasCant', 'cotUSD', 'cotEUR', 'demoraMin'].forEach(k => n[k] = num(n[k]));
  ['propina', 'peaje', 'combustible', 'agua', 'toallitas'].forEach(k => n[k] = bool(n[k]));
  n.estado = n.estado === 'realizado' ? 'realizado' : 'agendado';
  n.pago = n.pago === 'cobrado' ? 'cobrado' : 'pendiente';
  n.id = String(n.id);
  return n;
}
function normCarga(c) {
  const n = Object.assign({}, c);
  ['litros', 'monto', 'odometro', 'cotUSD'].forEach(k => n[k] = num(n[k]));
  n.lleno = bool(n.lleno);
  n.id = String(n.id);
  return n;
}

/* ---------- Comunicación con el servidor ---------- */
async function post(url, body, ms = 25000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
async function api(accion, extra = {}) {
  if (S.demo) return { ok: true };
  const res = await post(S.url, Object.assign({ accion, token: S.token }, extra));
  if (res && res.error === 'SESION') { sesionVencida(res.mensaje); throw new Error('SESION'); }
  return res;
}

function aplicarOp(op) {
  if (op.tipo === 'guardarViaje') {
    const i = S.viajes.findIndex(v => v.id === op.datos.id);
    if (i >= 0) S.viajes[i] = clone(op.datos); else S.viajes.push(clone(op.datos));
  } else if (op.tipo === 'borrarViaje') {
    S.viajes = S.viajes.filter(v => v.id !== op.id);
  } else if (op.tipo === 'guardarCarga') {
    const i = S.cargas.findIndex(c => c.id === op.datos.id);
    if (i >= 0) S.cargas[i] = clone(op.datos); else S.cargas.push(clone(op.datos));
  } else if (op.tipo === 'borrarCarga') {
    S.cargas = S.cargas.filter(c => c.id !== op.id);
  } else if (op.tipo === 'guardarConfig') {
    S.config = mergeConfig(op.config);
  }
}
function encolar(op) {
  S.cola.push(op);
  aplicarOp(op);
  guardarCola(); guardarCache();
  render(); pintarSync();
  flush();
}
async function flush() {
  if (S.demo) { S.cola = []; pintarSync(); return; }
  if (S.sincronizando || !S.cola.length || !S.token) return;
  S.sincronizando = true; pintarSync();
  try {
    while (S.cola.length) {
      const op = S.cola[0];
      const extra = op.datos ? { datos: op.datos } : op.config ? { config: op.config } : { id: op.id };
      let res;
      try { res = await api(op.tipo, extra); }
      catch (e) { if (e.message !== 'SESION') S.online = false; break; }
      S.online = true;
      if (res && res.ok) { S.cola.shift(); guardarCola(); S.errorSync = ''; }
      else { S.errorSync = (res && (res.mensaje || res.error)) || 'Error desconocido'; break; }
    }
  } finally { S.sincronizando = false; pintarSync(); }
}
async function sincronizar(avisar = false) {
  if (S.demo) { if (avisar) toast('Modo demostración'); return; }
  if (!S.token) return;
  await flush();
  if (S.cola.length) { if (avisar) toast(S.online ? 'Hay registros pendientes de envío' : 'Sin conexión: se enviará después'); return; }
  S.sincronizando = true; pintarSync();
  try {
    const res = await api('listar');
    if (res && res.ok) {
      S.online = true;
      S.viajes = (res.viajes || []).map(normViaje);
      S.cargas = (res.cargas || []).map(normCarga);
      if (res.config) S.config = mergeConfig(res.config);
      else { S.sincronizando = false; encolar({ tipo: 'guardarConfig', config: clone(S.config) }); }
      S.ultimaSync = new Date(); S.errorSync = '';
      guardarCache();
      if (!S.sheetAbierta) render();
      if (avisar) toast('Datos actualizados');
    } else if (res) { S.errorSync = res.mensaje || res.error; }
  } catch (e) {
    if (e.message !== 'SESION') { S.online = false; if (avisar) toast('Sin conexión con el servidor'); }
  } finally { S.sincronizando = false; pintarSync(); }
}

function pintarSync() {
  const b = $('#sync-btn'), t = $('#sync-text');
  if (!b) return;
  b.className = 'sync';
  if (S.demo) { t.textContent = 'Demo'; b.classList.add('pend'); return; }
  if (S.sincronizando) { t.textContent = 'Enviando…'; b.classList.add('pend'); return; }
  if (S.cola.length) { t.textContent = `${S.cola.length} pendiente${S.cola.length > 1 ? 's' : ''}`; b.classList.add(S.online ? 'pend' : 'off'); return; }
  if (!S.online) { t.textContent = 'Sin conexión'; b.classList.add('off'); return; }
  if (S.errorSync) { t.textContent = 'Revisar'; b.classList.add('off'); return; }
  t.textContent = 'Al día'; b.classList.add('ok');
}

/* ---------- Acceso ---------- */
function mostrarLogin(msg = '') {
  $('#app').hidden = true;
  $('#login').hidden = false;
  const tieneUrl = !!S.url;
  $('#login-url-wrap').hidden = tieneUrl;
  $('#login-cambiar-url').hidden = !tieneUrl;
  $('#login-error').textContent = msg;
  $('#login-clave').value = '';
  setTimeout(() => (tieneUrl ? $('#login-clave') : $('#login-url')).focus(), 100);
}
function guardarToken(token, recordar) {
  S.token = token;
  LS.del('av_token'); SS.del('av_token');
  (recordar ? LS : SS).set('av_token', token);
}
function borrarToken() { S.token = ''; LS.del('av_token'); SS.del('av_token'); }
function sesionVencida(msg) { borrarToken(); cerrarSheet(true); mostrarLogin(msg || 'La sesión venció. Ingresá la clave de nuevo.'); }

async function onLogin(ev) {
  ev.preventDefault();
  const err = $('#login-error');
  const url = S.url || $('#login-url').value.trim();
  const clave = $('#login-clave').value;
  const recordar = $('#login-recordar').checked;
  if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) { err.textContent = 'La dirección debe empezar con https://script.google.com/'; return; }
  if (!clave) { err.textContent = 'Escribí tu clave.'; return; }
  const btn = $('#login-btn');
  btn.disabled = true; btn.textContent = 'Verificando…'; err.textContent = '';
  try {
    const res = await post(url, { accion: 'login', clave, recordar });
    if (res.ok) {
      S.url = url; LS.set('av_url', url);
      guardarToken(res.token, recordar);
      S.demo = false;
      abrirApp();
      sincronizar();
    } else {
      err.textContent = res.mensaje || 'No se pudo ingresar.';
    }
  } catch (e) {
    err.textContent = 'No se pudo conectar. Revisá la dirección del servidor y tu conexión.';
  } finally { btn.disabled = false; btn.textContent = 'Ingresar'; }
}
async function bloquear() {
  if (S.demo) { S.demo = false; S.viajes = []; S.cargas = []; S.config = clone(CONFIG_DEF); cargarCache(); mostrarLogin(); return; }
  if (S.cola.length && !confirm('Hay registros sin enviar. Se van a enviar cuando vuelvas a ingresar. ¿Bloquear igual?')) return;
  try { await api('logout'); } catch (e) { }
  borrarToken();
  mostrarLogin('App bloqueada.');
}

function abrirApp() {
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#demo-banner').hidden = !S.demo;
  irA(S.tab || 'inicio');
  pintarSync();
}

/* ---------- Tema ---------- */
function aplicarTema() {
  const modo = LS.get('av_tema', 'auto');
  const h = new Date().getHours();
  const t = modo === 'auto' ? (h >= 19 || h < 7 ? 'dark' : 'light') : modo;
  document.documentElement.dataset.theme = t;
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = t === 'dark' ? '#090E22' : '#F6F2EA';
  const b = $('#tema-btn');
  if (b) b.innerHTML = `<i class="ic ${modo === 'auto' ? 'ic-auto' : modo === 'dark' ? 'ic-moon' : 'ic-sun'}"></i>`;
}
function ciclarTema() {
  const orden = ['auto', 'light', 'dark'];
  const m = LS.get('av_tema', 'auto');
  const nuevo = orden[(orden.indexOf(m) + 1) % 3];
  LS.set('av_tema', nuevo); aplicarTema();
  toast({ auto: 'Tema automático (oscuro de 19 a 7 h)', light: 'Tema claro', dark: 'Tema oscuro' }[nuevo]);
  if (S.tab === 'ajustes') render();
}

/* ---------- Aviso ---------- */
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

/* =========================================================
   Cálculos
   ========================================================= */
const fechaViaje = v => (v.pickup || v.conocimiento || v.creado || '').slice(0, 10);

function rango(f) {
  const h = hoyStr();
  if (f.p === 'hoy') return [h, h];
  if (f.p === 'semana') { const d = parseDay(h); const lunes = addDays(h, -((d.getDay() + 6) % 7)); return [lunes, addDays(lunes, 6)]; }
  if (f.p === 'mes') { const d = parseDay(h); return [dStr(new Date(d.getFullYear(), d.getMonth(), 1)), dStr(new Date(d.getFullYear(), d.getMonth() + 1, 0))]; }
  if (f.p === 'rango') return [f.desde || '0000-01-01', f.hasta || '9999-12-31'];
  return ['0000-01-01', '9999-12-31'];
}
const enRango = (s, r) => s && s >= r[0] && s <= r[1];
function textoRango(r, p) {
  if (p === 'todo') return 'Todo el historial';
  if (r[0] === r[1]) return diaLargo(r[0]);
  return `${ddmmyyyy(r[0])} al ${ddmmyyyy(r[1])}`;
}

function aUSD(monto, moneda, cotUSD, cotEUR) {
  if (!monto) return 0;
  if (moneda === 'USD') return monto;
  const cu = cotUSD || S.config.cotUSD, ce = cotEUR || S.config.cotEUR;
  if (moneda === 'ARS') return cu ? monto / cu : null;
  if (moneda === 'EUR') return cu && ce ? monto * ce / cu : null;
  return null;
}

function calcular(r) {
  const vs = S.viajes.filter(v => enRango(fechaViaje(v), r));
  const real = vs.filter(v => v.estado === 'realizado');
  const agend = vs.filter(v => v.estado !== 'realizado');
  const cobrado = sum(real.filter(v => v.pago === 'cobrado'), v => v.monto);
  const pendiente = sum(real.filter(v => v.pago !== 'cobrado'), v => v.monto);
  const prop = { USD: 0, ARS: 0, EUR: 0 };
  let propUSD = 0, propFalta = false;
  real.filter(v => v.propina && v.propinaMonto).forEach(v => {
    const m = v.propinaMoneda || 'USD';
    prop[m] = (prop[m] || 0) + v.propinaMonto;
    const u = aUSD(v.propinaMonto, m, v.cotUSD, v.cotEUR);
    if (u === null) propFalta = true; else propUSD += u;
  });
  const peajesARS = sum(real.filter(v => v.peaje), v => v.peajeMonto);
  const cargas = S.cargas.filter(c => enRango((c.fecha || '').slice(0, 10), r));
  const combARS = sum(cargas, c => c.monto);
  let gastosUSD = 0, gastosFalta = false;
  real.filter(v => v.peaje && v.peajeMonto).forEach(v => { const u = aUSD(v.peajeMonto, 'ARS', v.cotUSD); if (u === null) gastosFalta = true; else gastosUSD += u; });
  cargas.filter(c => c.monto).forEach(c => { const u = aUSD(c.monto, 'ARS', c.cotUSD); if (u === null) gastosFalta = true; else gastosUSD += u; });
  const demoras = real.filter(v => v.pickup && v.subio).map(v => minutosEntre(v.pickup, v.subio));
  const proc = { 'Local': 0, 'Otra provincia': 0, 'Extranjero': 0 };
  real.forEach(v => { if (proc[v.procTipo] !== undefined) proc[v.procTipo]++; });
  const facturado = cobrado + pendiente;
  const total = facturado + (S.propinasEnTotal ? propUSD : 0);
  return {
    vs, real, agend, cobrado, pendiente, facturado, prop, propUSD, propFalta, total,
    peajesARS, combARS, gastosUSD, gastosFalta, neto: total - gastosUSD,
    pasajeros: sum(real, v => v.pasajeros), botellas: sum(real.filter(v => v.agua), v => v.aguaCant),
    toallitas: sum(real.filter(v => v.toallitas), v => v.toallitasCant),
    demoraProm: avg(demoras), aTiempo: demoras.filter(d => d <= 5).length, conDemora: demoras.length,
    proc, previsto: sum(agend, v => v.monto)
  };
}

/* Combustible: estimación del tanque */
function estadoTanque() {
  const cfg = S.config.comb || {};
  if (!cfg.activo) return null;
  const cap = num(cfg.capacidad);
  const cs = S.cargas.filter(c => c.fecha).slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
  const kmViajes = (desde, hasta) => sum(S.viajes.filter(v => v.estado === 'realizado' && v.km && (v.pickup || '') > desde && (v.pickup || '') <= hasta), v => v.km);
  const ratios = [];
  for (let i = 1; i < cs.length; i++) {
    const a = cs[i - 1], b = cs[i];
    if (a.odometro && b.odometro && b.odometro > a.odometro) { const kv = kmViajes(a.fecha, b.fecha); if (kv > 0) ratios.push((b.odometro - a.odometro) / kv); }
  }
  const factor = ratios.length ? Math.min(4, Math.max(1, avg(ratios.slice(-3)))) : (num(cfg.factor) || 1.5);
  const kmEntre = (a, b) => (a.odometro && b.odometro && b.odometro > a.odometro) ? b.odometro - a.odometro : kmViajes(a.fecha, b.fecha) * factor;
  const llenos = cs.map((c, i) => c.lleno ? i : -1).filter(i => i >= 0);
  const rends = [];
  for (let k = 1; k < llenos.length; k++) {
    const i = llenos[k - 1], j = llenos[k];
    let litros = 0, km = 0;
    for (let x = i + 1; x <= j; x++) { litros += cs[x].litros || 0; km += kmEntre(cs[x - 1], cs[x]); }
    if (litros > 0 && km > 0) rends.push(km / litros);
  }
  const rendCfg = cap && num(cfg.autonomia) ? num(cfg.autonomia) / cap : null;
  const rend = rends.length ? avg(rends.slice(-3)) : rendCfg;
  const falta = [];
  if (!cap) falta.push('la capacidad del tanque');
  if (!rend) falta.push('la autonomía con tanque lleno');
  if (!llenos.length) falta.push('una carga marcada como tanque lleno');
  if (falta.length) return { falta };
  let nivel = cap;
  for (let x = llenos[0] + 1; x < cs.length; x++) {
    nivel = Math.max(0, nivel - kmEntre(cs[x - 1], cs[x]) / rend);
    nivel = cs[x].lleno ? cap : Math.min(cap, nivel + (cs[x].litros || 0));
  }
  const ult = cs[cs.length - 1];
  const kmDesde = kmViajes(ult.fecha, nowLocal()) * factor;
  nivel = Math.max(0, nivel - kmDesde / rend);
  const kmRest = nivel * rend;
  const ref = S.config.tramos.find(t => t.km) || null;
  return { pct: nivel / cap, litros: nivel, kmRest, rend, factor, aprendido: rends.length > 0, ref, viajesRef: ref ? Math.floor(kmRest / (ref.km * factor)) : null, kmDesde, ult };
}

/* =========================================================
   Componentes
   ========================================================= */
function badgeDemora(v) {
  if (!v.pickup || !v.subio) return '';
  const d = minutosEntre(v.pickup, v.subio);
  if (d <= 0) return `<span class="badge b-azul">${d === 0 ? 'Puntual' : 'Antes ' + Math.abs(d) + ' min'}</span>`;
  if (d <= 10) return `<span class="badge b-gold">Demora ${d} min</span>`;
  return `<span class="badge b-danger">Demora ${d} min</span>`;
}
function badgePago(v) {
  return v.pago === 'cobrado' ? '<span class="badge b-azul">Cobrado</span>' : '<span class="badge b-lila">Pendiente</span>';
}
function tarjetaViaje(v, conAcciones = false) {
  const ag = v.estado !== 'realizado';
  let cuenta = '';
  if (ag && v.pickup) {
    const m = minutosEntre(nowLocal(), v.pickup);
    if (v.subio) cuenta = '<span class="badge b-gold">En curso</span>';
    else if (m < 0) cuenta = `<span class="badge b-danger">Pick up ${relativo(m)}</span>`;
    else if (m < 24 * 60) cuenta = `<span class="countdown">${relativo(m)}</span>`;
  }
  const iconos = [
    v.pasajeros ? `${v.pasajeros} pax` : '',
    v.agua ? `💧${v.aguaCant || ''}` : '',
    v.toallitas ? `🧻${v.toallitasCant || ''}` : '',
    v.peaje ? '🛣️' : '',
    v.combustible ? '⛽' : '',
    v.propina ? `<span class="gold-t">+ ${esc(v.propinaMoneda || 'USD')} ${fmt(v.propinaMonto)}</span>` : ''
  ].filter(Boolean).join(' · ');
  return `
  <article class="card trip" data-act="editar" data-id="${esc(v.id)}">
    <div class="trip-top">
      <div class="trip-time">${hm(v.pickup)}<small>${ddmm(v.pickup)}</small></div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
        ${cuenta}${ag ? '<span class="badge b-muted">Agendado</span>' : badgePago(v)}
        ${v.monto ? `<span class="trip-amt">${fmt(v.monto)}</span>` : ''}
      </div>
    </div>
    <div class="trip-route">
      <span class="pt"></span><span>${esc(v.origen) || '<span class="muted">Origen sin cargar</span>'}</span>
      <span class="ln"></span><span></span>
      <span class="pt end"></span><span>${esc(v.destino) || '<span class="muted">Destino sin cargar</span>'}</span>
    </div>
    <div class="trip-meta">
      ${v.cliente ? `<b style="color:var(--text)">${esc(v.cliente)}</b>` : ''}
      ${v.procTipo ? `<span class="badge b-lila">${esc(v.procDetalle || v.procTipo)}</span>` : ''}
      ${badgeDemora(v)}
      ${iconos ? `<span>${iconos}</span>` : ''}
    </div>
    ${conAcciones && ag ? `
    <div class="trip-actions">
      ${!v.subio ? `<button class="btn btn-gold btn-sm" data-act="subio" data-id="${esc(v.id)}">Subió el pasajero</button>` : ''}
      <button class="btn ${v.subio ? 'btn-gold' : 'btn-ghost'} btn-sm" data-act="editar" data-id="${esc(v.id)}" data-finalizar="1">Finalizar</button>
      <button class="btn btn-soft btn-sm" style="flex:0 0 auto" data-act="wa" data-id="${esc(v.id)}" aria-label="WhatsApp"><i class="ic ic-wa"></i></button>
    </div>` : ''}
  </article>`;
}

function chipsPeriodo(f, grupo, opciones = ['hoy', 'semana', 'mes', 'rango']) {
  const nombres = { hoy: 'Hoy', semana: 'Semana', mes: 'Mes', todo: 'Todo', rango: 'Elegir fechas' };
  return `<div class="chips">${opciones.map(o => `<button class="chip ${f.p === o ? 'on' : ''}" data-act="periodo" data-g="${grupo}" data-p="${o}">${nombres[o]}</button>`).join('')}</div>
  ${f.p === 'rango' ? `<div class="range">
    <label class="field"><span>Desde</span><input type="date" data-rango="${grupo}" data-k="desde" value="${esc(f.desde)}"></label>
    <label class="field"><span>Hasta</span><input type="date" data-rango="${grupo}" data-k="hasta" value="${esc(f.hasta)}"></label>
  </div>` : ''}`;
}

function tarjetaTanque(t, compacta = false) {
  if (!t) return '';
  if (t.falta) {
    return `<div class="card"><div class="split"><div><div class="stat"><div class="lbl">Combustible</div></div>
      <div class="note">Para estimar el tanque falta: ${t.falta.join(', ')}.</div></div>
      <button class="btn btn-soft btn-sm" data-act="combustible"><i class="ic ic-fuel"></i></button></div></div>`;
  }
  const p = Math.round(t.pct * 100);
  const color = p <= 20 ? 'var(--danger)' : p <= 40 ? 'var(--gold)' : 'var(--azul)';
  const estado = p <= 20 ? '<span class="badge b-danger">Cargá pronto</span>' : p <= 40 ? '<span class="badge b-gold">Conviene cargar</span>' : '<span class="badge b-azul">Bien</span>';
  return `<div class="card ${p <= 40 ? 'gold' : ''}" data-act="combustible" style="cursor:pointer">
    <div class="fuel">
      <div class="tank"><span style="height:${p}%;background:${color};opacity:.85"></span><b>${p}%</b></div>
      <div>
        <div class="split"><div class="stat"><div class="lbl">Tanque estimado</div></div>${estado}</div>
        <div style="font-family:var(--f-display);font-size:24px;font-weight:600;margin-top:2px">≈ ${fmt(t.kmRest)} km</div>
        <div class="note">${t.ref && t.viajesRef !== null ? `Alcanza para ~${t.viajesRef} viaje${t.viajesRef === 1 ? '' : 's'} como ${esc(t.ref.origen)} → ${esc(t.ref.destino)}` : ''}
        ${compacta ? '' : `<br>Rendimiento ${t.aprendido ? 'medido' : 'estimado'}: ${fmt(t.rend)} km/l`}</div>
      </div>
    </div>
  </div>`;
}

function tarjetaMeta() {
  const m = S.config.meta;
  if (!m || !m.monto) return '';
  const c = calcular([m.desde, m.hasta]);
  const hecho = c.cobrado + (S.propinasEnTotal ? c.propUSD : 0);
  const pend = c.pendiente;
  const pc = Math.min(100, hecho / m.monto * 100), pp = Math.min(100 - pc, pend / m.monto * 100);
  const falta = Math.max(0, m.monto - hecho - pend);
  const h = hoyStr();
  const dias = h > m.hasta ? 0 : Math.max(1, Math.round((parseDay(m.hasta) - parseDay(h > m.desde ? h : m.desde)) / 864e5) + 1);
  return `<div class="card gold">
    <div class="split"><div class="stat"><div class="lbl">Meta · ${esc(m.nombre || 'Objetivo')}</div></div><span class="badge b-muted">${ddmm(m.desde)} – ${ddmm(m.hasta)}</span></div>
    <div style="font-family:var(--f-display);font-size:30px;font-weight:600;margin-top:6px">${money(hecho + pend)} <span class="muted" style="font-size:18px">de ${fmt(m.monto)}</span></div>
    <div class="prog"><span class="p-gold" style="width:${pc}%"></span><span class="p-lila" style="width:${pp}%"></span></div>
    <div class="legend"><span><i style="background:var(--gold)"></i>Cobrado ${fmt(hecho)}</span><span><i style="background:var(--lila)"></i>Pendiente ${fmt(pend)}</span></div>
    <div class="note mt">${falta > 0 ? (dias ? `Faltan <b class="gold-t">${money(falta)}</b> · ${dias} día${dias > 1 ? 's' : ''} · ~${money(falta / dias)} por día` : `Período terminado. Faltaron ${money(falta)}.`) : '<b class="gold-t">¡Meta alcanzada!</b>'}</div>
  </div>`;
}

/* =========================================================
   Vistas
   ========================================================= */
function irA(tab) {
  S.tab = tab;
  $$('#tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  render();
  window.scrollTo({ top: 0 });
}
function render() {
  const v = $('#vista');
  if (!v || $('#app').hidden) return;
  const vistas = { inicio: vistaInicio, viajes: vistaViajes, resumen: vistaResumen, clientes: vistaClientes, ajustes: vistaAjustes };
  v.innerHTML = (vistas[S.tab] || vistaInicio)();
  if (S.tab === 'viajes') pintarListaViajes();
  if (S.tab === 'clientes') pintarListaClientes();
}

function vistaInicio() {
  const h = hoyStr();
  const hora = new Date().getHours();
  const saludo = (hora >= 6 && hora < 12 ? 'Buen día' : hora >= 12 && hora < 20 ? 'Buenas tardes' : 'Buenas noches') + ', Estrella';
  const c = calcular([h, h]);
  const proximos = S.viajes.filter(v => v.estado !== 'realizado').sort((a, b) => (a.pickup || '9').localeCompare(b.pickup || '9'));
  const t = estadoTanque();
  return `
  <div class="page-head"><div><h1 class="h-page">${saludo}</h1><div class="h-sub">${diaLargo(h).replace(/^./, x => x.toUpperCase())}</div></div></div>
  <div class="grid2 mt2">
    <div class="card stat c-gold"><div class="lbl">Hoy</div><div class="val">${fmt(c.facturado)}<small>USD</small></div><div class="foot">${c.real.length} realizado${c.real.length === 1 ? '' : 's'}</div></div>
    <div class="card stat c-lila"><div class="lbl">Por hacer</div><div class="val">${proximos.length}<small>viaje${proximos.length === 1 ? '' : 's'}</small></div><div class="foot">${c.agend.length} hoy</div></div>
  </div>
  ${t ? `<div class="mt">${tarjetaTanque(t, true)}</div>` : ''}
  ${S.config.meta ? `<div class="mt">${tarjetaMeta()}</div>` : ''}
  <h3 class="h-sec">Próximos viajes</h3>
  ${proximos.length ? proximos.map(v => tarjetaViaje(v, true)).join('') : `<div class="card empty"><div class="brand-mark"></div>No hay viajes agendados.<br>Tocá <b class="gold-t">+</b> para registrar uno.</div>`}
  <div class="btn-row mt2">
    <button class="btn btn-gold" data-act="nuevo">Nuevo viaje</button>
    <button class="btn btn-ghost" data-act="combustible"><i class="ic ic-fuel"></i> Combustible</button>
  </div>`;
}

function vistaViajes() {
  return `
  <div class="page-head"><div><h1 class="h-page">Viajes</h1><div class="h-sub" id="viajes-sub"></div></div></div>
  ${chipsPeriodo(S.fViajes, 'viajes', ['hoy', 'semana', 'mes', 'todo', 'rango'])}
  <div class="search"><i class="ic ic-search"></i><input id="buscar-viajes" type="search" placeholder="Buscar cliente, lugar o nota" value="${esc(S.fViajes.q)}"></div>
  <div id="lista-viajes"></div>`;
}
function pintarListaViajes() {
  const r = rango(S.fViajes);
  const q = S.fViajes.q.trim().toLowerCase();
  let vs = S.viajes.filter(v => enRango(fechaViaje(v), r));
  if (q) vs = vs.filter(v => [v.cliente, v.origen, v.destino, v.notas, v.procDetalle].join(' ').toLowerCase().includes(q));
  vs.sort((a, b) => (b.pickup || '').localeCompare(a.pickup || ''));
  $('#viajes-sub').textContent = `${textoRango(r, S.fViajes.p)} · ${vs.length} viaje${vs.length === 1 ? '' : 's'} · ${money(sum(vs.filter(v => v.estado === 'realizado'), v => v.monto))}`;
  const grupos = {};
  vs.forEach(v => { const d = fechaViaje(v); (grupos[d] = grupos[d] || []).push(v); });
  $('#lista-viajes').innerHTML = vs.length ? Object.keys(grupos).map(d => `
    <div class="day-h"><span>${diaLargo(d).replace(/^./, x => x.toUpperCase())}</span><b>${money(sum(grupos[d].filter(v => v.estado === 'realizado'), v => v.monto))}</b></div>
    ${grupos[d].map(v => tarjetaViaje(v)).join('')}`).join('')
    : `<div class="card empty mt2"><div class="brand-mark"></div>No hay viajes en este período.</div>`;
}

function vistaResumen() {
  const r = rango(S.fResumen);
  const c = calcular(r);
  const t = estadoTanque();
  const maxProc = Math.max(1, ...Object.values(c.proc));
  const cot = S.config.cotUSD;
  const noCot = '<span class="muted" style="font-weight:500">sin cotización</span>';
  return `
  <div class="page-head"><div><h1 class="h-page">Resumen</h1><div class="h-sub">${textoRango(r, S.fResumen.p)}</div></div></div>
  ${chipsPeriodo(S.fResumen, 'resumen')}
  <div class="card gold hero mt">
    <div class="split"><div class="lbl">Total del período</div>
      <div class="seg" style="width:auto;padding:2px"><button class="${S.propinasEnTotal ? 'on' : ''}" style="padding:5px 10px;font-size:12px" data-act="propTotal" data-v="1">Con propinas</button><button class="${!S.propinasEnTotal ? 'on' : ''}" style="padding:5px 10px;font-size:12px" data-act="propTotal" data-v="0">Sin propinas</button></div></div>
    <div class="big"><small>USD</small>${fmt(c.total)}</div>
    <div class="sub">${c.real.length} viaje${c.real.length === 1 ? '' : 's'} realizado${c.real.length === 1 ? '' : 's'}${c.agend.length ? ` · ${c.agend.length} agendado${c.agend.length === 1 ? '' : 's'} (${money(c.previsto)} previstos)` : ''}</div>
    ${S.propinasEnTotal && c.propFalta ? '<div class="note mt">Hay propinas en ARS o EUR que no se suman porque falta la cotización (Ajustes).</div>' : ''}
  </div>
  <div class="grid2 mt">
    <div class="card stat c-azul"><div class="lbl">Cobrado</div><div class="val">${fmt(c.cobrado)}<small>USD</small></div></div>
    <div class="card stat c-lila" data-act="verPendientes" style="cursor:pointer"><div class="lbl">Pendiente</div><div class="val">${fmt(c.pendiente)}<small>USD</small></div>${c.pendiente ? '<div class="foot">Tocá para ver</div>' : ''}</div>
  </div>

  <h3 class="h-sec">Propinas</h3>
  <div class="card"><div class="rows">
    <div class="row"><span class="k">Dólares</span><span class="v">${money(c.prop.USD)}</span></div>
    <div class="row"><span class="k">Pesos</span><span class="v">${money(c.prop.ARS, 'ARS')}</span></div>
    <div class="row"><span class="k">Euros</span><span class="v">${money(c.prop.EUR, 'EUR')}</span></div>
    <div class="row total"><span class="k">Equivalente</span><span class="v">${money(c.propUSD)}</span></div>
  </div></div>

  <h3 class="h-sec">Gastos y ganancia</h3>
  <div class="card"><div class="rows">
    <div class="row"><span class="k">Peajes</span><span class="v">${money(c.peajesARS, 'ARS')}</span></div>
    <div class="row"><span class="k">Combustible</span><span class="v">${money(c.combARS, 'ARS')}</span></div>
    <div class="row"><span class="k">Gastos en dólares</span><span class="v">${cot || !(c.peajesARS || c.combARS) ? money(c.gastosUSD) : noCot}</span></div>
    <div class="row total"><span class="k">Ganancia neta</span><span class="v">${cot || !(c.peajesARS || c.combARS) ? money(c.neto) : '—'}</span></div>
  </div>
  ${!cot && (c.peajesARS || c.combARS) ? '<div class="note mt">Cargá la cotización del dólar en Ajustes para calcular la ganancia neta.</div>' : ''}
  </div>

  <h3 class="h-sec">Actividad</h3>
  <div class="grid3">
    <div class="card stat"><div class="lbl">Viajes</div><div class="val">${c.real.length}</div></div>
    <div class="card stat"><div class="lbl">Pasajeros</div><div class="val">${c.pasajeros}</div></div>
    <div class="card stat c-azul"><div class="lbl">Puntual</div><div class="val">${c.conDemora ? Math.round(c.aTiempo / c.conDemora * 100) + '%' : '—'}</div></div>
    <div class="card stat"><div class="lbl">Botellas</div><div class="val">${c.botellas}</div></div>
    <div class="card stat"><div class="lbl">Toallitas</div><div class="val">${c.toallitas}</div></div>
    <div class="card stat c-lila"><div class="lbl">Demora prom.</div><div class="val">${c.demoraProm === null ? '—' : Math.round(c.demoraProm)}<small>${c.demoraProm === null ? '' : 'min'}</small></div></div>
  </div>

  <h3 class="h-sec">Procedencia</h3>
  <div class="card"><div class="bars">
    ${[['Local', 'var(--azul)'], ['Otra provincia', 'var(--lila)'], ['Extranjero', 'var(--gold)']].map(([k, col]) => `
      <div class="bar-row"><span>${k}</span><div class="t"><span style="width:${c.proc[k] / maxProc * 100}%;background:${col}"></span></div><span class="n">${c.proc[k]}</span></div>`).join('')}
  </div></div>

  <h3 class="h-sec">Meta</h3>
  ${S.config.meta ? tarjetaMeta() : '<div class="card note">Todavía no fijaste una meta.</div>'}
  <button class="btn btn-ghost btn-block mt" data-act="metaDesdePeriodo">Fijar una meta para ${S.fResumen.p === 'rango' ? 'estas fechas' : 'este período'}</button>

  ${t ? `<h3 class="h-sec">Combustible</h3>${tarjetaTanque(t)}` : ''}`;
}

function rankingClientes() {
  const m = {};
  S.viajes.filter(v => v.cliente).forEach(v => {
    const k = v.cliente.trim().toLowerCase();
    const o = m[k] = m[k] || { nombre: v.cliente.trim(), n: 0, total: 0, ultimo: '', procTipo: '', procDetalle: '', viajes: [] };
    o.viajes.push(v);
    if (v.estado === 'realizado') { o.n++; o.total += v.monto || 0; }
    if ((v.pickup || '') >= o.ultimo) { o.ultimo = v.pickup || ''; o.procTipo = v.procTipo || o.procTipo; o.procDetalle = v.procDetalle || o.procDetalle; }
  });
  return Object.values(m).sort((a, b) => b.n - a.n || b.total - a.total);
}
function vistaClientes() {
  return `
  <div class="page-head"><div><h1 class="h-page">Clientes</h1><div class="h-sub" id="cli-sub"></div></div></div>
  <div class="search"><i class="ic ic-search"></i><input id="buscar-clientes" type="search" placeholder="Buscar cliente" value="${esc(S.qClientes)}"></div>
  <div id="lista-clientes" class="mt"></div>`;
}
function pintarListaClientes() {
  const todos = rankingClientes();
  const q = S.qClientes.trim().toLowerCase();
  const lista = q ? todos.filter(c => c.nombre.toLowerCase().includes(q)) : todos;
  $('#cli-sub').textContent = `${todos.length} cliente${todos.length === 1 ? '' : 's'} registrados`;
  const ini = n => n.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  $('#lista-clientes').innerHTML = lista.length ? `<div class="card list-card">${lista.map((c) => `
    <button class="cli" data-act="cliente" data-n="${esc(c.nombre)}">
      <span class="cli-rank">${todos.indexOf(c) + 1}</span>
      <span class="avatar">${esc(ini(c.nombre))}</span>
      <span class="cli-main"><span class="cli-name">${esc(c.nombre)}</span><span class="cli-sub">${esc(c.procDetalle || c.procTipo || '—')} · último ${ddmm(c.ultimo)}</span></span>
      <span class="cli-n"><b>${c.n}</b><span>${money(c.total)}</span></span>
    </button>`).join('')}</div>`
    : `<div class="card empty"><div class="brand-mark"></div>${q ? 'Sin resultados.' : 'Los clientes aparecen acá a medida que cargás viajes con nombre.'}</div>`;
}
function abrirCliente(nombre) {
  const c = rankingClientes().find(x => x.nombre === nombre);
  if (!c) return;
  const vs = c.viajes.slice().sort((a, b) => (b.pickup || '').localeCompare(a.pickup || ''));
  abrirSheet(`
    <div class="sheet-head"><h2>${esc(c.nombre)}</h2><button class="icon-btn" data-cerrar><i class="ic ic-close"></i></button></div>
    <div class="grid3">
      <div class="card stat c-gold"><div class="lbl">Viajes</div><div class="val">${c.n}</div></div>
      <div class="card stat"><div class="lbl">Total</div><div class="val">${fmt(c.total)}<small>USD</small></div></div>
      <div class="card stat c-lila"><div class="lbl">Propinas</div><div class="val">${vs.filter(v => v.propina).length}</div></div>
    </div>
    <div class="note mt">${esc(c.procTipo || '')}${c.procDetalle ? ' · ' + esc(c.procDetalle) : ''}</div>
    <h3 class="h-sec">Historial</h3>
    ${vs.map(v => tarjetaViaje(v)).join('')}`);
}

function vistaAjustes() {
  const cfg = S.config, cb = cfg.comb || {};
  const modo = LS.get('av_tema', 'auto');
  const t = estadoTanque();
  return `
  <div class="page-head"><div><h1 class="h-page">Ajustes</h1><div class="h-sub">Versión ${VERSION}</div></div></div>

  <h3 class="h-sec">Apariencia</h3>
  <div class="seg">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([k, n]) => `<button class="${modo === k ? 'on' : ''}" data-act="tema" data-v="${k}">${n}</button>`).join('')}</div>
  <div class="note mt">Automático: oscuro de 19 a 7 h, claro durante el día.</div>

  <h3 class="h-sec">Cotizaciones</h3>
  <div class="card">
    <div class="fpair">
      <label class="field"><span>Dólar (ARS por USD)</span><div class="money"><span class="cur">ARS</span><input id="cfg-cotusd" inputmode="decimal" value="${esc(cfg.cotUSD ?? '')}"></div></label>
      <label class="field"><span>Euro (ARS por EUR)</span><div class="money"><span class="cur">ARS</span><input id="cfg-coteur" inputmode="decimal" value="${esc(cfg.cotEUR ?? '')}"></div></label>
    </div>
    <div class="note" style="margin:-4px 0 12px">${cfg.cotFecha ? 'Actualizada el ' + ddmmyyyy(cfg.cotFecha) + '. ' : ''}Cada viaje guarda la cotización del día en que se carga.</div>
    <button class="btn btn-gold btn-block" data-act="guardarCot">Guardar cotización</button>
  </div>

  <h3 class="h-sec">Coordinador</h3>
  <div class="card">
    <label class="field"><span>WhatsApp del coordinador (con código de país)</span><input id="cfg-coord" inputmode="tel" value="${esc(cfg.coordinador)}"></label>
    <button class="btn btn-soft btn-block" data-act="guardarCoord">Guardar número</button>
  </div>

  <h3 class="h-sec">Tramos con tarifa fija</h3>
  <div class="card list-card">
    ${cfg.tramos.length ? cfg.tramos.map(tr => `
      <div class="tramo-item">
        <div><div class="r">${esc(tr.origen)} → ${esc(tr.destino)}</div><div class="s">${money(tr.monto)}${tr.km ? ' · ≈ ' + fmt(tr.km) + ' km' : ''}</div></div>
        <div style="display:flex;gap:6px"><button class="btn btn-soft btn-sm" data-act="editarTramo" data-id="${esc(tr.id)}">Editar</button></div>
      </div>`).join('') : '<div class="note" style="padding:12px">Sin tramos.</div>'}
  </div>
  <button class="btn btn-ghost btn-block mt" data-act="editarTramo">Agregar tramo</button>

  <h3 class="h-sec">Meta</h3>
  <div class="card">
    <label class="field"><span>Nombre</span><input id="meta-nombre" placeholder="Ej.: Fin de año" value="${esc(cfg.meta?.nombre || '')}"></label>
    <div class="fpair">
      <label class="field"><span>Desde</span><input id="meta-desde" type="date" value="${esc(cfg.meta?.desde || '')}"></label>
      <label class="field"><span>Hasta</span><input id="meta-hasta" type="date" value="${esc(cfg.meta?.hasta || '')}"></label>
    </div>
    <label class="field"><span>Monto a alcanzar</span><div class="money"><span class="cur">USD</span><input id="meta-monto" inputmode="decimal" value="${esc(cfg.meta?.monto ?? '')}"></div></label>
    <div class="btn-row"><button class="btn btn-gold" data-act="guardarMeta">Guardar meta</button>${cfg.meta ? '<button class="btn btn-soft" data-act="quitarMeta">Quitar</button>' : ''}</div>
  </div>

  <h3 class="h-sec">Combustible</h3>
  <div class="card">
    <span class="flabel">Indicador del tanque</span>
    <div class="seg" style="margin-bottom:14px"><button class="${cb.activo ? 'on' : ''}" data-act="combActivo" data-v="1">Activado</button><button class="${!cb.activo ? 'on' : ''}" data-act="combActivo" data-v="0">Desactivado</button></div>
    <div class="fpair">
      <label class="field"><span>Capacidad del tanque</span><div class="money"><span class="cur">L</span><input id="comb-cap" inputmode="decimal" value="${esc(cb.capacidad ?? '')}" placeholder="Ej.: 50"></div></label>
      <label class="field"><span>Autonomía con tanque lleno</span><div class="money"><span class="cur">KM</span><input id="comb-aut" inputmode="decimal" value="${esc(cb.autonomia ?? '')}" placeholder="Ej.: 600"></div></label>
    </div>
    <label class="field"><span>Km extra sin pasajero (ir a buscar, volver)</span>
      <select id="comb-factor">${[[1, 'Ninguno'], [1.25, '+25 %'], [1.5, '+50 %'], [1.75, '+75 %'], [2, '+100 % (ida y vuelta vacío)']].map(([v, n]) => `<option value="${v}" ${Number(cb.factor || 1.5) === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <small>Si anotás los km del tablero al cargar, la app aprende este valor sola.</small></label>
    ${t && !t.falta ? `<div class="note" style="margin:-2px 0 12px">Rendimiento ${t.aprendido ? 'medido' : 'estimado'}: <b>${fmt(t.rend)} km/l</b> · factor ${fmt(t.factor)}</div>` : ''}
    <button class="btn btn-soft btn-block" data-act="guardarComb">Guardar combustible</button>
  </div>

  <h3 class="h-sec">Conexión</h3>
  <div class="card"><div class="rows">
    <div class="row"><span class="k">Estado</span><span class="v">${S.demo ? 'Demostración' : S.online ? 'En línea' : 'Sin conexión'}</span></div>
    <div class="row"><span class="k">Pendientes de envío</span><span class="v">${S.cola.length}</span></div>
    <div class="row"><span class="k">Última sincronización</span><span class="v">${S.ultimaSync ? S.ultimaSync.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—'}</span></div>
    ${S.errorSync ? `<div class="row"><span class="k">Último error</span><span class="v" style="color:var(--danger)">${esc(S.errorSync)}</span></div>` : ''}
  </div>
  <button class="btn btn-soft btn-block mt" data-act="sync">Sincronizar ahora</button></div>

  <h3 class="h-sec">Seguridad</h3>
  <div class="card">
    <div class="note" style="margin-bottom:12px">Tus datos están en tu Google Drive. Sin la clave nadie puede verlos ni modificarlos. Si perdés el celular, cambiá la clave desde la hoja de cálculo: se cierran todas las sesiones.</div>
    <div class="btn-row"><button class="btn btn-lila" data-act="bloquear">${S.demo ? 'Salir de la demostración' : 'Bloquear ahora'}</button></div>
    ${!S.demo ? '<button class="btn btn-danger btn-block mt" data-act="olvidar">Olvidar este dispositivo</button>' : ''}
  </div>
  <div style="height:20px"></div>`;
}

/* =========================================================
   Hoja modal
   ========================================================= */
function abrirSheet(html) {
  $('#sheet').innerHTML = html;
  $('#sheet-wrap').hidden = false;
  $('#sheet').scrollTop = 0;
  document.body.style.overflow = 'hidden';
  S.sheetAbierta = true;
}
function cerrarSheet(forzar = false) {
  if (!forzar && S.draftDirty && !confirm('¿Descartar los cambios sin guardar?')) return;
  $('#sheet-wrap').hidden = true;
  $('#sheet').innerHTML = '';
  document.body.style.overflow = '';
  S.draft = null; S.draftDirty = false; S.cargaDraft = null; S.sheetAbierta = false;
  render();
}

/* ---------- Editor de viaje ---------- */
function nuevoViaje() {
  return {
    id: uid(), estado: 'agendado', conocimiento: nowLocal(), pickup: '', subio: '', finalizado: '',
    cliente: '', procTipo: '', procDetalle: '', pasajeros: 1, tramo: '', origen: '', destino: '', km: null,
    monto: null, pago: 'pendiente', propina: false, propinaMonto: null, propinaMoneda: 'USD',
    peaje: false, peajeMonto: null, combustible: false, agua: false, aguaCant: null, toallitas: false, toallitasCant: null,
    cotUSD: null, cotEUR: null, notas: '', creado: '', actualizado: ''
  };
}
function seg(name, opciones, valor, clase = '') {
  return `<div class="seg ${clase}" data-seg="${name}">${opciones.map(([v, t]) => `<button type="button" data-v="${esc(v)}" class="${String(valor) === String(v) ? 'on' : ''} ${v === 'true' ? 'si' : ''}">${t}</button>`).join('')}</div>`;
}
const YN = [['false', 'No'], ['true', 'Sí']];
function stepper(name, val, dis) {
  return `<div class="stepper ${dis ? 'dis' : ''}" data-step="${name}"><button type="button" data-d="-1">−</button><input data-f="${name}" inputmode="numeric" value="${esc(val ?? '')}"><button type="button" data-d="1">+</button></div>`;
}
function lugares() {
  const set = new Set();
  S.config.tramos.forEach(t => { set.add(t.origen); set.add(t.destino); });
  S.viajes.forEach(v => { if (v.origen) set.add(v.origen); if (v.destino) set.add(v.destino); });
  return [...set].sort();
}
function campoProcedencia(d) {
  if (d.procTipo === 'Otra provincia') return `<label class="field"><span>Provincia</span><select data-f="procDetalle"><option value="">Elegí…</option>${PROVINCIAS.filter(p => p !== 'Ciudad Autónoma de Buenos Aires').map(p => `<option ${d.procDetalle === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label>`;
  if (d.procTipo === 'Extranjero') return `<label class="field"><span>País</span><input data-f="procDetalle" list="dl-paises" value="${esc(d.procDetalle)}" placeholder="Ej.: Brasil"></label>`;
  return '';
}

function abrirEditor(id, finalizar = false) {
  const existente = id ? S.viajes.find(v => v.id === id) : null;
  S.draft = existente ? clone(existente) : nuevoViaje();
  S.draftDirty = false;
  const d = S.draft, nuevo = !existente;
  const clientes = [...new Set(S.viajes.map(v => (v.cliente || '').trim()).filter(Boolean))].sort();
  const tramoSel = d.tramo && S.config.tramos.some(t => t.id === d.tramo) ? d.tramo : (d.origen || d.destino ? 'otro' : '');
  d.tramo = tramoSel;
  abrirSheet(`
  <form id="form-viaje" autocomplete="off" onsubmit="return false">
    <div class="sheet-head"><h2>${nuevo ? 'Nuevo viaje' : d.estado === 'realizado' ? 'Viaje realizado' : 'Viaje agendado'}</h2><button type="button" class="icon-btn" data-cerrar><i class="ic ic-close"></i></button></div>

    <div class="fgroup">
      <div class="fgroup-t">Horarios</div>
      <label class="field"><span>Toma de conocimiento</span><input type="datetime-local" data-f="conocimiento" value="${esc(d.conocimiento)}"></label>
      <label class="field"><span>Pick up pactado</span><input type="datetime-local" data-f="pickup" value="${esc(d.pickup)}"></label>
      <label class="field"><span>Subió el pasajero</span>
        <div class="with-btn"><input type="datetime-local" data-f="subio" value="${esc(d.subio)}"><button type="button" class="btn btn-gold btn-sm" data-act="subioAhora">Ahora</button></div></label>
      <div class="delay" id="delay"></div>
    </div>

    <div class="fgroup">
      <div class="fgroup-t">Cliente</div>
      <label class="field"><span>A nombre de</span><input data-f="cliente" list="dl-clientes" value="${esc(d.cliente)}" placeholder="Nombre y apellido" autocapitalize="words"><small id="cli-info"></small></label>
      <span class="flabel">Procedencia</span>
      ${seg('procTipo', [['Local', 'Local'], ['Otra provincia', 'Provincia'], ['Extranjero', 'Extranjero']], d.procTipo)}
      <div id="proc-detalle" style="margin-top:12px">${campoProcedencia(d)}</div>
      <label class="field" style="margin-top:${d.procTipo === 'Local' || !d.procTipo ? '12px' : '0'}"><span>Cantidad de pasajeros</span>${stepper('pasajeros', d.pasajeros, false)}</label>
    </div>

    <div class="fgroup">
      <div class="fgroup-t">Recorrido</div>
      <label class="field"><span>Tramo</span><select data-f="tramo">
        <option value="">Elegí un tramo…</option>
        ${S.config.tramos.map(t => `<option value="${esc(t.id)}" ${tramoSel === t.id ? 'selected' : ''}>${esc(t.origen)} → ${esc(t.destino)} · USD ${fmt(t.monto)}</option>`).join('')}
        <option value="otro" ${tramoSel === 'otro' ? 'selected' : ''}>Otro tramo (a mano)</option>
      </select></label>
      <label class="field"><span>Desde</span><input data-f="origen" list="dl-lugares" value="${esc(d.origen)}" placeholder="Origen"></label>
      <label class="field"><span>Hasta</span><input data-f="destino" list="dl-lugares" value="${esc(d.destino)}" placeholder="Destino"></label>
      <label class="field"><span>Distancia aproximada</span><div class="money"><span class="cur">KM</span><input data-f="km" inputmode="decimal" value="${esc(d.km ?? '')}"></div><small>Sirve para estimar el combustible.</small></label>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-guardar-tramo" data-act="guardarComoTramo" style="margin:-4px 0 14px" ${tramoSel === 'otro' ? '' : 'hidden'}>Guardar como tramo fijo (ida y vuelta)</button>
    </div>

    <div class="fgroup">
      <div class="fgroup-t">Pago</div>
      <label class="field"><span>Monto del servicio</span><div class="money"><span class="cur">USD</span><input data-f="monto" inputmode="decimal" value="${esc(d.monto ?? '')}"></div></label>
      <span class="flabel">Estado</span>
      <div style="margin-bottom:14px">${seg('pago', [['pendiente', 'Pendiente'], ['cobrado', 'Cobrado']], d.pago, 'pago')}</div>
      <span class="flabel">Propina</span>
      <div class="yn-line">
        ${seg('propina', YN, String(d.propina), 'yn')}
        <div class="fpair" style="grid-template-columns:1fr 78px;gap:8px">
          <label class="field ${d.propina ? '' : 'off'}"><input data-f="propinaMonto" inputmode="decimal" placeholder="Monto" value="${esc(d.propinaMonto ?? '')}" ${d.propina ? '' : 'disabled'}></label>
          <label class="field ${d.propina ? '' : 'off'}"><select data-f="propinaMoneda" ${d.propina ? '' : 'disabled'}>${['USD', 'ARS', 'EUR'].map(m => `<option ${d.propinaMoneda === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
        </div>
      </div>
    </div>

    <div class="fgroup">
      <div class="fgroup-t">Gastos y consumo</div>
      <span class="flabel">Peaje</span>
      <div class="yn-line">${seg('peaje', YN, String(d.peaje), 'yn')}
        <label class="field ${d.peaje ? '' : 'off'}"><div class="money"><span class="cur">ARS</span><input data-f="peajeMonto" inputmode="decimal" placeholder="Monto" value="${esc(d.peajeMonto ?? '')}" ${d.peaje ? '' : 'disabled'}></div></label></div>
      <span class="flabel">Cargó combustible en este viaje</span>
      <div style="margin-bottom:14px">${seg('combustible', YN, String(d.combustible), 'yn')}</div>
      <span class="flabel">Agua mineral (botellas)</span>
      <div class="yn-line">${seg('agua', YN, String(d.agua), 'yn')}${stepper('aguaCant', d.aguaCant, !d.agua)}</div>
      <span class="flabel">Toallitas descartables</span>
      <div class="yn-line">${seg('toallitas', YN, String(d.toallitas), 'yn')}${stepper('toallitasCant', d.toallitasCant, !d.toallitas)}</div>
    </div>

    <div class="fgroup">
      <label class="field"><span>Notas</span><textarea data-f="notas" placeholder="Vuelo, equipaje, indicaciones…">${esc(d.notas)}</textarea></label>
    </div>

    <datalist id="dl-clientes">${clientes.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
    <datalist id="dl-lugares">${lugares().map(c => `<option value="${esc(c)}">`).join('')}</datalist>
    <datalist id="dl-paises">${PAISES.map(c => `<option value="${esc(c)}">`).join('')}</datalist>

    <div class="sheet-foot">
      ${d.estado === 'realizado'
      ? `<button type="button" class="btn btn-gold btn-block" data-act="guardarViaje">Guardar cambios</button>`
      : `<div class="btn-row"><button type="button" class="btn btn-ghost" data-act="guardarViaje">${nuevo ? 'Agendar' : 'Guardar'}</button><button type="button" class="btn btn-gold" data-act="finalizarViaje">Finalizar viaje</button></div>`}
      ${!nuevo ? `<div class="btn-row"><button type="button" class="btn btn-wa btn-sm" data-act="wa" data-id="${esc(d.id)}"><i class="ic ic-wa"></i> Enviar al coordinador</button><button type="button" class="btn btn-danger btn-sm" data-act="borrarViaje" style="flex:0 0 auto">Eliminar</button></div>` : ''}
    </div>
  </form>`);
  actualizarDemora();
  infoCliente();
  if (finalizar) setTimeout(() => $('.sheet-foot [data-act="finalizarViaje"]')?.scrollIntoView({ block: 'end' }), 50);
}

function actualizarDemora() {
  const el = $('#delay'); if (!el || !S.draft) return;
  const d = S.draft;
  el.innerHTML = d.pickup && d.subio ? `${badgeDemora(d)} <span class="note">pick up ${hm(d.pickup)} · subió ${hm(d.subio)}</span>` : '';
}
function infoCliente() {
  const el = $('#cli-info'); if (!el || !S.draft) return;
  const n = (S.draft.cliente || '').trim().toLowerCase();
  if (!n) { el.textContent = ''; return; }
  const previos = S.viajes.filter(v => v.id !== S.draft.id && (v.cliente || '').trim().toLowerCase() === n);
  el.innerHTML = previos.length ? `<span class="gold-t">Cliente frecuente · ${previos.length} viaje${previos.length > 1 ? 's' : ''} anterior${previos.length > 1 ? 'es' : ''}</span>` : 'Cliente nuevo';
}

function setCampo(name, val) {
  const el = $(`#sheet [data-f="${name}"]`);
  if (el) el.value = val ?? '';
  S.draft[name] = val;
}
function habilitar(names, on) {
  names.forEach(n => {
    const el = $(`#sheet [data-f="${n}"]`); if (!el) return;
    el.disabled = !on;
    el.closest('.field')?.classList.toggle('off', !on);
    el.closest('.stepper')?.classList.toggle('dis', !on);
  });
}

function onSegDraft(name, v) {
  const d = S.draft; if (!d) return;
  const val = v === 'true' ? true : v === 'false' ? false : v;
  d[name] = val; S.draftDirty = true;
  if (name === 'propina') { habilitar(['propinaMonto', 'propinaMoneda'], val); if (!val) setCampo('propinaMonto', null); else $('#sheet [data-f="propinaMonto"]').focus(); }
  if (name === 'peaje') { habilitar(['peajeMonto'], val); if (!val) setCampo('peajeMonto', null); else $('#sheet [data-f="peajeMonto"]').focus(); }
  if (name === 'agua') { habilitar(['aguaCant'], val); setCampo('aguaCant', val ? (d.aguaCant || 1) : null); }
  if (name === 'toallitas') { habilitar(['toallitasCant'], val); setCampo('toallitasCant', val ? (d.toallitasCant || 1) : null); }
  if (name === 'procTipo') {
    d.procDetalle = '';
    $('#proc-detalle').innerHTML = campoProcedencia(d);
  }
}

function onCampoDraft(el) {
  const name = el.dataset.f, d = S.draft; if (!d) return;
  const numericos = ['km', 'monto', 'propinaMonto', 'peajeMonto', 'pasajeros', 'aguaCant', 'toallitasCant'];
  d[name] = numericos.includes(name) ? num(el.value) : el.value;
  S.draftDirty = true;
  if (name === 'pickup' || name === 'subio') actualizarDemora();
  if (name === 'cliente') {
    infoCliente();
    const prev = S.viajes.filter(v => (v.cliente || '').trim().toLowerCase() === el.value.trim().toLowerCase()).sort((a, b) => (b.pickup || '').localeCompare(a.pickup || ''))[0];
    if (prev && !d.procTipo && prev.procTipo) {
      d.procTipo = prev.procTipo; d.procDetalle = prev.procDetalle;
      $$('#sheet [data-seg="procTipo"] button').forEach(b => b.classList.toggle('on', b.dataset.v === d.procTipo));
      $('#proc-detalle').innerHTML = campoProcedencia(d);
    }
  }
  if (name === 'tramo') {
    const t = S.config.tramos.find(x => x.id === el.value);
    if (t) { setCampo('origen', t.origen); setCampo('destino', t.destino); setCampo('km', t.km); setCampo('monto', t.monto); }
    $('#btn-guardar-tramo').hidden = el.value !== 'otro';
    if (el.value === 'otro') $('#sheet [data-f="origen"]').focus();
  }
  if ((name === 'origen' || name === 'destino') && d.tramo && d.tramo !== 'otro') {
    const t = S.config.tramos.find(x => x.id === d.tramo);
    if (t && (d.origen !== t.origen || d.destino !== t.destino)) { d.tramo = 'otro'; $('#sheet [data-f="tramo"]').value = 'otro'; $('#btn-guardar-tramo').hidden = false; }
  }
}

function guardarViaje(finalizar = false) {
  const d = S.draft; if (!d) return;
  // leer todos los campos por si algún evento no se disparó
  $$('#sheet [data-f]').forEach(el => { if (!el.disabled && el.dataset.f !== 'tramo') onCampoDraft(el); });
  if (!d.pickup) { toast('Completá el horario de pick up pactado'); $('#sheet [data-f="pickup"]').focus(); return; }
  if (finalizar) {
    if (!d.origen || !d.destino) { toast('Completá desde y hasta'); return; }
    if (!d.monto) { toast('Completá el monto del servicio'); $('#sheet [data-f="monto"]').focus(); return; }
    if (d.propina && !d.propinaMonto) { toast('Completá el monto de la propina'); return; }
    d.estado = 'realizado';
    d.finalizado = d.finalizado || nowLocal();
  }
  if (!d.propina) { d.propinaMonto = null; }
  if (!d.peaje) d.peajeMonto = null;
  if (!d.agua) d.aguaCant = null;
  if (!d.toallitas) d.toallitasCant = null;
  if (d.tramo === 'otro') d.tramo = '';
  d.demoraMin = d.pickup && d.subio ? minutosEntre(d.pickup, d.subio) : null;
  if (!d.cotUSD) d.cotUSD = S.config.cotUSD;
  if (!d.cotEUR) d.cotEUR = S.config.cotEUR;
  d.creado = d.creado || nowLocal();
  d.actualizado = nowLocal();
  d.cliente = (d.cliente || '').trim();
  const datos = clone(d);
  S.draftDirty = false;
  encolar({ tipo: 'guardarViaje', datos });
  if (finalizar) abrirFinalizado(datos);
  else { cerrarSheet(true); toast('Viaje guardado'); }
}

function abrirFinalizado(v) {
  S.draft = null;
  abrirSheet(`
    <div class="sheet-head"><h2>Viaje finalizado</h2><button class="icon-btn" data-cerrar><i class="ic ic-close"></i></button></div>
    <div class="card gold hero center">
      <div class="brand-mark lg" style="margin-bottom:8px"></div>
      <div class="lbl">${esc(v.origen)} → ${esc(v.destino)}</div>
      <div class="big"><small>USD</small>${fmt(v.monto)}</div>
      <div class="sub">${v.pago === 'cobrado' ? 'Cobrado' : 'Pago pendiente'}${v.propina ? ` · propina ${esc(v.propinaMoneda)} ${fmt(v.propinaMonto)}` : ''}</div>
    </div>
    <h3 class="h-sec">Mensaje para el coordinador</h3>
    <div class="card"><pre style="white-space:pre-wrap;font-family:var(--f-body);margin:0;font-size:14px">${esc(mensajeWA(v))}</pre></div>
    <div class="sheet-foot">
      <button class="btn btn-wa btn-block" data-act="wa" data-id="${esc(v.id)}"><i class="ic ic-wa"></i> Enviar por WhatsApp</button>
      <button class="btn btn-soft btn-block" data-cerrar>Listo</button>
    </div>`);
}

/* ---------- WhatsApp ---------- */
function mensajeWA(v) {
  const sn = (b, extra) => b ? `Sí${extra ? ` (${extra})` : ''}` : 'No';
  const l = [];
  l.push(v.estado === 'realizado' ? '✅ *Viaje realizado*' : '🗓️ *Viaje asignado*');
  if (v.pickup) l.push(`📅 ${diaLargo(v.pickup.slice(0, 10)).replace(/^./, x => x.toUpperCase())}`);
  l.push(`🕐 Pick up asignado: ${hm(v.pickup)} h`);
  if (v.subio) l.push(`🚘 Subió el pasajero: ${hm(v.subio)} h`);
  l.push(`📍 Desde: ${v.origen || '—'}`);
  l.push(`🏁 Hasta: ${v.destino || '—'}`);
  if (v.pasajeros) l.push(`👥 Pasajeros: ${v.pasajeros}`);
  l.push(`⛽ Combustible: ${sn(v.combustible)}`);
  l.push(`🛣️ Peaje: ${sn(v.peaje)}`);
  l.push(`💧 Agua: ${sn(v.agua, v.aguaCant ? `${v.aguaCant} botella${v.aguaCant > 1 ? 's' : ''}` : '')}`);
  l.push(`🧻 Toallitas: ${sn(v.toallitas, v.toallitasCant ? String(v.toallitasCant) : '')}`);
  return l.join('\n');
}
function enviarWA(id) {
  const v = (S.draft && S.draft.id === id) ? S.draft : S.viajes.find(x => x.id === id);
  if (!v) return;
  const n = String(S.config.coordinador || '').replace(/\D/g, '');
  const url = `https://wa.me/${n}?text=${encodeURIComponent(mensajeWA(v))}`;
  window.open(url, '_blank');
}

/* ---------- Combustible ---------- */
function abrirCombustible(cargaId) {
  const ex = cargaId ? S.cargas.find(c => c.id === cargaId) : null;
  S.cargaDraft = ex ? clone(ex) : { id: uid(), fecha: nowLocal(), litros: null, monto: null, odometro: null, lleno: true, notas: '', cotUSD: null };
  const c = S.cargaDraft;
  const t = estadoTanque();
  const hist = S.cargas.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, 15);
  abrirSheet(`
    <div class="sheet-head"><h2>Combustible</h2><button class="icon-btn" data-cerrar><i class="ic ic-close"></i></button></div>
    ${t ? tarjetaTanque(t) : `<div class="card note">El indicador del tanque está desactivado. Cuando tengas la capacidad y la autonomía, activalo en Ajustes › Combustible. Mientras tanto, registrá las cargas y la app va juntando historial.</div>`}
    <h3 class="h-sec">${ex ? 'Editar carga' : 'Registrar carga'}</h3>
    <div class="fgroup">
      <label class="field"><span>Fecha y hora</span><input type="datetime-local" data-c="fecha" value="${esc(c.fecha)}"></label>
      <div class="fpair">
        <label class="field"><span>Litros</span><div class="money"><span class="cur">L</span><input data-c="litros" inputmode="decimal" value="${esc(c.litros ?? '')}"></div></label>
        <label class="field"><span>Monto</span><div class="money"><span class="cur">ARS</span><input data-c="monto" inputmode="decimal" value="${esc(c.monto ?? '')}"></div></label>
      </div>
      <label class="field"><span>Km del tablero (odómetro)</span><div class="money"><span class="cur">KM</span><input data-c="odometro" inputmode="numeric" value="${esc(c.odometro ?? '')}"></div><small>Opcional, pero mejora mucho la estimación.</small></label>
      <span class="flabel">¿Llenaste el tanque?</span>
      <div style="margin-bottom:14px">${seg('lleno', YN, String(c.lleno), 'yn')}</div>
      <label class="field"><span>Notas</span><input data-c="notas" value="${esc(c.notas)}" placeholder="Estación, tipo de combustible…"></label>
    </div>
    <div class="btn-row"><button class="btn btn-gold" data-act="guardarCarga">${ex ? 'Guardar cambios' : 'Guardar carga'}</button>${ex ? '<button class="btn btn-danger" style="flex:0 0 auto" data-act="borrarCarga">Eliminar</button>' : ''}</div>
    <h3 class="h-sec">Últimas cargas</h3>
    ${hist.length ? `<div class="card list-card">${hist.map(h => `
      <button class="tramo-item" style="width:100%;text-align:left" data-act="editarCarga" data-id="${esc(h.id)}">
        <div><div class="r">${ddmmyyyy(h.fecha)} · ${hm(h.fecha)} h</div><div class="s">${h.litros ? fmt(h.litros) + ' L · ' : ''}${money(h.monto, 'ARS')}${h.odometro ? ' · ' + fmt(h.odometro) + ' km' : ''}</div></div>
        ${h.lleno ? '<span class="badge b-gold">Lleno</span>' : '<span class="badge b-muted">Parcial</span>'}
      </button>`).join('')}</div>` : '<div class="card note">Todavía no hay cargas.</div>'}
  `);
}
function guardarCarga() {
  const c = S.cargaDraft; if (!c) return;
  $$('#sheet [data-c]').forEach(el => { const k = el.dataset.c; c[k] = ['litros', 'monto', 'odometro'].includes(k) ? num(el.value) : el.value; });
  if (!c.fecha) { toast('Completá la fecha'); return; }
  if (!c.monto && !c.litros) { toast('Completá los litros o el monto'); return; }
  c.cotUSD = c.cotUSD || S.config.cotUSD;
  c.creado = c.creado || nowLocal(); c.actualizado = nowLocal();
  encolar({ tipo: 'guardarCarga', datos: clone(c) });
  toast('Carga registrada');
  S.sheetAbierta = false;
  abrirCombustible();
}

/* ---------- Tramos ---------- */
function abrirTramo(id) {
  const t = id ? S.config.tramos.find(x => x.id === id) : { id: uid(), origen: '', destino: '', monto: null, km: null };
  abrirSheet(`
    <div class="sheet-head"><h2>${id ? 'Editar tramo' : 'Nuevo tramo'}</h2><button class="icon-btn" data-cerrar><i class="ic ic-close"></i></button></div>
    <div class="fgroup">
      <label class="field"><span>Desde</span><input id="tr-o" list="dl-l2" value="${esc(t.origen)}"></label>
      <label class="field"><span>Hasta</span><input id="tr-d" list="dl-l2" value="${esc(t.destino)}"></label>
      <div class="fpair">
        <label class="field"><span>Tarifa</span><div class="money"><span class="cur">USD</span><input id="tr-m" inputmode="decimal" value="${esc(t.monto ?? '')}"></div></label>
        <label class="field"><span>Distancia</span><div class="money"><span class="cur">KM</span><input id="tr-k" inputmode="decimal" value="${esc(t.km ?? '')}"></div></label>
      </div>
      ${!id ? '<label class="check" style="margin-bottom:14px"><input type="checkbox" id="tr-v" checked><span>Agregar también la vuelta</span></label>' : ''}
    </div>
    <datalist id="dl-l2">${lugares().map(c => `<option value="${esc(c)}">`).join('')}</datalist>
    <div class="btn-row"><button class="btn btn-gold" data-act="guardarTramo" data-id="${id ? esc(id) : ''}">Guardar</button>${id ? `<button class="btn btn-danger" style="flex:0 0 auto" data-act="borrarTramo" data-id="${esc(id)}">Eliminar</button>` : ''}</div>`);
}
function guardarConfig(cambios) {
  const cfg = Object.assign(clone(S.config), cambios);
  encolar({ tipo: 'guardarConfig', config: cfg });
}

/* =========================================================
   Eventos
   ========================================================= */
const acciones = {
  nuevo: () => abrirEditor(),
  editar: el => abrirEditor(el.dataset.id, !!el.dataset.finalizar),
  subio: el => {
    const v = S.viajes.find(x => x.id === el.dataset.id); if (!v) return;
    const d = clone(v); d.subio = nowLocal(); d.demoraMin = d.pickup ? minutosEntre(d.pickup, d.subio) : null; d.actualizado = nowLocal();
    encolar({ tipo: 'guardarViaje', datos: d });
    const m = d.demoraMin;
    toast(m === null ? 'Hora registrada' : m > 0 ? `Subió ${hm(d.subio)} · demora ${m} min` : `Subió ${hm(d.subio)} · a tiempo`);
  },
  subioAhora: () => { setCampo('subio', nowLocal()); S.draftDirty = true; actualizarDemora(); },
  guardarViaje: () => guardarViaje(false),
  finalizarViaje: () => guardarViaje(true),
  borrarViaje: () => {
    if (!confirm('¿Eliminar este viaje? Se borra de la hoja y te llega un correo con el aviso.')) return;
    const id = S.draft.id; S.draftDirty = false;
    encolar({ tipo: 'borrarViaje', id }); cerrarSheet(true); toast('Viaje eliminado');
  },
  wa: el => enviarWA(el.dataset.id),
  guardarComoTramo: () => {
    const d = S.draft;
    $$('#sheet [data-f]').forEach(el => { if (!el.disabled && el.dataset.f !== 'tramo') onCampoDraft(el); });
    if (!d.origen || !d.destino || !d.monto) { toast('Completá desde, hasta y monto primero'); return; }
    const nuevos = tramoPar(d.origen.trim(), d.destino.trim(), d.monto, d.km);
    guardarConfig({ tramos: [...S.config.tramos, ...nuevos] });
    d.tramo = nuevos[0].id;
    const sel = $('#sheet [data-f="tramo"]');
    const opt = document.createElement('option'); opt.value = nuevos[0].id; opt.textContent = `${d.origen} → ${d.destino} · USD ${fmt(d.monto)}`;
    sel.insertBefore(opt, sel.querySelector('option[value="otro"]')); sel.value = nuevos[0].id;
    $('#btn-guardar-tramo').hidden = true;
    toast('Tramo guardado (ida y vuelta)');
  },
  periodo: el => {
    const f = el.dataset.g === 'viajes' ? S.fViajes : S.fResumen;
    f.p = el.dataset.p;
    if (f.p === 'rango' && !f.desde) { const r = rango({ p: 'mes' }); f.desde = hoyStr(); f.hasta = r[1]; }
    render();
  },
  propTotal: el => { S.propinasEnTotal = el.dataset.v === '1'; LS.set('av_prop_total', S.propinasEnTotal); render(); },
  verPendientes: () => { S.fViajes = Object.assign({}, S.fViajes, { p: S.fResumen.p, desde: S.fResumen.desde, hasta: S.fResumen.hasta, q: '' }); irA('viajes'); },
  metaDesdePeriodo: () => {
    const r = rango(S.fResumen);
    const monto = num(prompt(`Meta para ${textoRango(r, S.fResumen.p)}.\n¿Cuántos USD querés alcanzar?`, S.config.meta?.monto || ''));
    if (!monto) return;
    guardarConfig({ meta: { nombre: S.config.meta?.nombre || 'Meta', desde: r[0], hasta: r[1] === '9999-12-31' ? hoyStr() : r[1], monto } });
    toast('Meta guardada');
  },
  cliente: el => abrirCliente(el.dataset.n),
  combustible: () => abrirCombustible(),
  editarCarga: el => { S.sheetAbierta = false; abrirCombustible(el.dataset.id); },
  guardarCarga: () => guardarCarga(),
  borrarCarga: () => {
    if (!confirm('¿Eliminar esta carga?')) return;
    encolar({ tipo: 'borrarCarga', id: S.cargaDraft.id }); toast('Carga eliminada'); abrirCombustible();
  },
  tema: el => { LS.set('av_tema', el.dataset.v); aplicarTema(); render(); },
  guardarCot: () => {
    const u = num($('#cfg-cotusd').value), e = num($('#cfg-coteur').value);
    guardarConfig({ cotUSD: u, cotEUR: e, cotFecha: hoyStr() }); toast('Cotización guardada');
  },
  guardarCoord: () => {
    const n = $('#cfg-coord').value.replace(/\D/g, '');
    if (n.length < 10) { toast('Revisá el número (con 549 adelante)'); return; }
    guardarConfig({ coordinador: n }); toast('Número guardado');
  },
  editarTramo: el => abrirTramo(el.dataset.id),
  guardarTramo: el => {
    const o = $('#tr-o').value.trim(), d = $('#tr-d').value.trim(), m = num($('#tr-m').value), k = num($('#tr-k').value);
    if (!o || !d || !m) { toast('Completá desde, hasta y tarifa'); return; }
    let tramos = clone(S.config.tramos);
    if (el.dataset.id) tramos = tramos.map(t => t.id === el.dataset.id ? Object.assign(t, { origen: o, destino: d, monto: m, km: k }) : t);
    else tramos.push(...($('#tr-v')?.checked ? tramoPar(o, d, m, k) : [{ id: uid(), origen: o, destino: d, monto: m, km: k }]));
    guardarConfig({ tramos }); cerrarSheet(true); toast('Tramo guardado');
  },
  borrarTramo: el => {
    if (!confirm('¿Eliminar este tramo? Los viajes ya cargados no cambian.')) return;
    guardarConfig({ tramos: S.config.tramos.filter(t => t.id !== el.dataset.id) }); cerrarSheet(true);
  },
  guardarMeta: () => {
    const desde = $('#meta-desde').value, hasta = $('#meta-hasta').value, monto = num($('#meta-monto').value);
    if (!desde || !hasta || !monto) { toast('Completá desde, hasta y monto'); return; }
    if (hasta < desde) { toast('La fecha "hasta" es anterior a "desde"'); return; }
    guardarConfig({ meta: { nombre: $('#meta-nombre').value.trim() || 'Meta', desde, hasta, monto } }); toast('Meta guardada');
  },
  quitarMeta: () => { guardarConfig({ meta: null }); toast('Meta quitada'); },
  combActivo: el => { guardarConfig({ comb: Object.assign({}, S.config.comb, { activo: el.dataset.v === '1' }) }); },
  guardarComb: () => {
    guardarConfig({ comb: Object.assign({}, S.config.comb, { capacidad: num($('#comb-cap').value), autonomia: num($('#comb-aut').value), factor: Number($('#comb-factor').value) }) });
    toast('Datos de combustible guardados');
  },
  sync: () => sincronizar(true),
  bloquear: () => bloquear(),
  olvidar: async () => {
    if (S.cola.length) { toast('Primero esperá a que se envíen los pendientes'); return; }
    if (!confirm('Se borran la dirección del servidor, la sesión y los datos guardados en este celular. Tus datos en Google no se tocan. ¿Continuar?')) return;
    try { await api('logout'); } catch (e) { }
    ['av_url', 'av_token', 'av_datos', 'av_cola'].forEach(k => LS.del(k)); SS.del('av_token');
    location.reload();
  }
};

document.addEventListener('click', ev => {
  if (ev.target.closest('[data-cerrar]')) { cerrarSheet(); return; }
  const segBtn = ev.target.closest('.seg[data-seg] button');
  if (segBtn) {
    const g = segBtn.parentElement;
    $$('button', g).forEach(b => b.classList.toggle('on', b === segBtn));
    const name = g.dataset.seg, v = segBtn.dataset.v;
    if (S.cargaDraft && name === 'lleno') S.cargaDraft.lleno = v === 'true';
    else onSegDraft(name, v);
    return;
  }
  const st = ev.target.closest('.stepper button');
  if (st) {
    const inp = $('input', st.parentElement);
    const n = Math.max(0, (num(inp.value) || 0) + Number(st.dataset.d));
    inp.value = n; onCampoDraft(inp); return;
  }
  const a = ev.target.closest('[data-act]');
  if (a && acciones[a.dataset.act]) { ev.preventDefault(); acciones[a.dataset.act](a, ev); }
});
document.addEventListener('input', ev => {
  const el = ev.target;
  if (el.dataset.f && S.draft) onCampoDraft(el);
  if (el.id === 'buscar-viajes') { S.fViajes.q = el.value; pintarListaViajes(); }
  if (el.id === 'buscar-clientes') { S.qClientes = el.value; pintarListaClientes(); }
});
document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.dataset.f && S.draft) onCampoDraft(el);
  if (el.dataset.rango) {
    const f = el.dataset.rango === 'viajes' ? S.fViajes : S.fResumen;
    f[el.dataset.k] = el.value; render();
  }
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('#sheet-wrap').hidden) cerrarSheet(); });

$('#tabbar').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-tab]'); if (!b) return;
  if (b.dataset.tab === 'nuevo') abrirEditor(); else irA(b.dataset.tab);
});
$('#ajustes-btn').addEventListener('click', () => irA('ajustes'));
$('#tema-btn').addEventListener('click', ciclarTema);
$('#sync-btn').addEventListener('click', () => sincronizar(true));
$('#login-form').addEventListener('submit', onLogin);
$('#pw-eye').addEventListener('click', () => { const i = $('#login-clave'); i.type = i.type === 'password' ? 'text' : 'password'; });
$('#login-cambiar-url').addEventListener('click', () => { S.url = ''; LS.del('av_url'); mostrarLogin(); });
$('#login-demo').addEventListener('click', iniciarDemo);

window.addEventListener('online', () => { S.online = true; sincronizar(); });
window.addEventListener('offline', () => { S.online = false; pintarSync(); });
let ultimaVisible = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - ultimaVisible > 30000) {
    ultimaVisible = Date.now(); aplicarTema();
    if (!$('#app').hidden) { sincronizar(); if (!S.sheetAbierta) render(); }
  }
});
setInterval(() => { if (S.cola.length) flush(); }, 60000);
setInterval(() => { aplicarTema(); if (!$('#app').hidden && !S.sheetAbierta && S.tab === 'inicio') render(); }, 60000);

/* =========================================================
   Demostración
   ========================================================= */
function iniciarDemo() {
  S.demo = true;
  S.config = clone(CONFIG_DEF);
  S.config.cotUSD = 1450; S.config.cotEUR = 1680; S.config.cotFecha = hoyStr();
  S.config.comb = { activo: true, capacidad: 50, autonomia: 600, factor: 1.5 };
  const h = hoyStr();
  S.config.meta = { nombre: 'Quincena', desde: addDays(h, -10), hasta: addDays(h, 4), monto: 1500 };
  const cli = [['Martín Rossi', 'Otra provincia', 'Córdoba'], ['Laura Gómez', 'Local', ''], ['John Miller', 'Extranjero', 'Estados Unidos'], ['Ana Souza', 'Extranjero', 'Brasil'], ['Pierre Dubois', 'Extranjero', 'Francia'], ['Carla Méndez', 'Otra provincia', 'Mendoza'], ['Diego Paz', 'Local', '']];
  const tr = S.config.tramos;
  const viajes = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 26; i++) {
    const dia = addDays(h, -Math.floor(i * 0.8) - 1);
    const t = tr[Math.floor(rnd() * tr.length)];
    const c = cli[Math.floor(rnd() * cli.length)];
    const hora = String(6 + Math.floor(rnd() * 15)).padStart(2, '0') + ':' + ['00', '15', '30', '45'][Math.floor(rnd() * 4)];
    const pickup = `${dia}T${hora}`;
    const dem = Math.floor(rnd() * 22) - 6;
    const subio = new Date(toDate(pickup).getTime() + dem * 6e4);
    const propina = rnd() < 0.35;
    const moneda = ['USD', 'ARS', 'EUR', 'USD'][Math.floor(rnd() * 4)];
    viajes.push(normViaje({
      id: 'demo' + i, estado: 'realizado', conocimiento: `${addDays(dia, -1)}T18:00`, pickup, subio: dStr(subio) + 'T' + subio.toTimeString().slice(0, 5),
      cliente: c[0], procTipo: c[1], procDetalle: c[2], pasajeros: 1 + Math.floor(rnd() * 3), tramo: t.id, origen: t.origen, destino: t.destino, km: t.km,
      monto: t.monto, pago: i < 2 || rnd() < 0.1 ? 'pendiente' : 'cobrado', propina, propinaMonto: propina ? (moneda === 'ARS' ? 10000 : 5 + Math.floor(rnd() * 3) * 5) : null, propinaMoneda: moneda,
      peaje: t.km > 20, peajeMonto: t.km > 20 ? 2800 : null, combustible: false, agua: rnd() < 0.6, aguaCant: 1 + Math.floor(rnd() * 2), toallitas: rnd() < 0.4, toallitasCant: 1,
      cotUSD: 1450, cotEUR: 1680, creado: pickup, actualizado: pickup
    }));
  }
  const ahora = toDate(nowLocal());
  const en = m => { const d = new Date(ahora.getTime() + m * 6e4); return dStr(d) + 'T' + d.toTimeString().slice(0, 5); };
  viajes.push(normViaje({ id: 'demoA', estado: 'agendado', conocimiento: en(-300), pickup: en(95), cliente: 'John Miller', procTipo: 'Extranjero', procDetalle: 'Estados Unidos', pasajeros: 2, tramo: tr[0].id, origen: tr[0].origen, destino: tr[0].destino, km: tr[0].km, monto: tr[0].monto, pago: 'pendiente', notas: 'Vuelo AA 931' }));
  viajes.push(normViaje({ id: 'demoB', estado: 'agendado', conocimiento: en(-120), pickup: en(60 * 20), cliente: 'Ana Souza', procTipo: 'Extranjero', procDetalle: 'Brasil', pasajeros: 1, tramo: tr[4].id, origen: tr[4].origen, destino: tr[4].destino, km: tr[4].km, monto: tr[4].monto, pago: 'pendiente' }));
  S.viajes = viajes;
  S.cargas = [
    normCarga({ id: 'c1', fecha: `${addDays(h, -9)}T08:00`, litros: 45, monto: 58000, odometro: 41200, lleno: true, cotUSD: 1450 }),
    normCarga({ id: 'c2', fecha: `${addDays(h, -4)}T19:30`, litros: 42, monto: 54500, odometro: 41760, lleno: true, cotUSD: 1450 })
  ];
  S.cola = [];
  abrirApp();
}

/* =========================================================
   Inicio
   ========================================================= */
function init() {
  aplicarTema();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => { });
  }
  S.url = LS.get('av_url', '');
  S.token = LS.get('av_token') || SS.get('av_token') || '';
  cargarCache();
  if (S.url && S.token) { abrirApp(); sincronizar(); }
  else mostrarLogin();
}
init();
