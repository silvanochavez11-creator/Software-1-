import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from "recharts";
import Papa from "papaparse";
import {
  Plus, Upload, TrendingUp, Wallet, Package, Trash2, Sparkles, Check, X, Loader2,
  AlertTriangle, ShoppingCart, Search, Pencil, Boxes, DollarSign, Receipt, BarChart3, Printer,
  LogOut, Store, ImagePlus, Shield, ArrowRight, LogIn, UserPlus, Users, Mail, Lock, Bell, ClipboardList
} from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(n || 0);
const fmt0 = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n || 0);

const PART_CATS = ["Motor", "Frenos", "Suspensión", "Eléctrico", "Transmisión", "Llantas y cámaras", "Aceites y lubricantes", "Carrocería", "Accesorios", "Otro"];
const EXPENSE_CATS = ["Compra a proveedor", "Renta", "Servicios (luz/agua/internet)", "Sueldos", "Publicidad", "Mantenimiento", "Impuestos", "Otro"];

const uid = () => crypto.randomUUID();
const todayStr = () => new Date().toISOString().slice(0, 10);

// Agrupación de fechas por periodo para las gráficas
const weekStart = (dateStr) => {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const diff = (dt.getUTCDay() + 6) % 7; // días desde el lunes
  dt.setUTCDate(dt.getUTCDate() - diff);
  return dt.toISOString().slice(0, 10);
};
const bucketOf = (dateStr, gran) => gran === "day" ? dateStr.slice(0, 10) : gran === "week" ? weekStart(dateStr) : dateStr.slice(0, 7);
const bucketLabel = (key, gran) => gran === "month" ? key : key.slice(5); // mes: 2026-06 · día/semana: MM-DD
const GRAN_KEEP = { day: 14, week: 12, month: 12 }; // cuántos periodos mostrar
const GranToggle = ({ gran, setGran }) => (
  <div style={{ display: "flex", gap: 4 }}>
    {[["day", "Día"], ["week", "Semana"], ["month", "Mes"]].map(([id, label]) => (
      <button key={id} onClick={() => setGran(id)} style={{
        padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 700,
        border: gran === id ? "1px solid var(--accent)" : "1px solid var(--border)",
        background: gran === id ? "var(--accent-soft)" : "transparent",
        color: gran === id ? "var(--accent)" : "var(--muted)",
      }}>{label}</button>
    ))}
  </div>
);

// Nivel de existencias de una pieza, para los avisos
const stockStatus = (p) => {
  const s = Number(p.stock) || 0, m = Number(p.minStock) || 0;
  if (s <= 0) return "agotado";
  if (s <= m) return "critico";
  if (s <= m + 3) return "porAgotarse";
  return "ok";
};
const STATUS_META = {
  agotado: { label: "Agotado", color: "#e25c5c", rank: 0 },
  critico: { label: "Crítico", color: "#e8a13a", rank: 1 },
  porAgotarse: { label: "Por agotarse", color: "#e8c468", rank: 2 },
  ok: { label: "Disponible", color: "#2ecc71", rank: 3 },
};
// Cuántas piezas sugerir comprar para volver a un colchón sano
const suggestQty = (p) => {
  const s = Number(p.stock) || 0, m = Number(p.minStock) || 0;
  const target = Math.max(m * 2, m + 2, 3);
  return Math.max(0, target - s);
};
const escapeHtml = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Almacenamiento local del navegador (sesión y config del ticket).
// Misma interfaz async que usaba store, pero sobre localStorage real.
const store = {
  get: async (k) => { try { const v = localStorage.getItem(k); return v != null ? { value: v } : null; } catch (e) { return null; } },
  set: async (k, v) => { try { if (v === "" || v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} },
};

// Favicon (ícono de la pestaña): engranaje dorado por defecto (admin/login),
// y el logo del negocio cuando se entra a una refaccionaria.
const GEAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0c1118"/><g transform="translate(8,8) scale(2)" fill="none" stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></g></svg>`;
const DEFAULT_FAVICON = `data:image/svg+xml,${encodeURIComponent(GEAR_SVG)}`;
function setFavicon(href) {
  try {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    link.setAttribute("href", href || DEFAULT_FAVICON);
  } catch (e) {}
}

const DEFAULT_ACCENT = "#d4af37";
const ACCENT_PRESETS = ["#d4af37", "#e2574c", "#2ecc71", "#3fa9f5", "#9b59b6", "#e8852b", "#1abc9c", "#ec4899"];
// Paleta clara (se aplica sobre el root de una refaccionaria con tema claro)
const THEME_LIGHT = {
  "--bg": "#f3f5f8", "--card": "#ffffff", "--surface": "#eceff4", "--border": "#d8dde6", "--border-soft": "#eaedf2",
  "--dashed": "#c4ccd8", "--text": "#1b2430", "--text-2": "#3c4658", "--muted": "#6b7480", "--muted-2": "#98a1ae",
};

// Convierte un archivo de imagen a un dataURL pequeño (máx 240px) para guardar el logo
function fileToLogo(file, cb) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const max = 240;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      try { cb(canvas.toDataURL("image/png")); } catch (err) { cb(e.target.result); }
    };
    img.onerror = () => cb(e.target.result);
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/* ============================================================================
   Conexión a Supabase (sin dependencias: usa fetch a la API REST + Auth)
   La llave 'publishable' es pública por diseño; la seguridad la dan las
   políticas RLS instaladas en la base de datos.
   ========================================================================== */
const SB_URL = "https://npxjpkcyfgxfbdvvlcrx.supabase.co";
const SB_KEY = "sb_publishable_kQ-u3skesem-ub6LQBBb5Q_q3WRyXX3";
const SESSION_KEY = "refa:session";

let _session = null; // { access_token, refresh_token, expires_at, user }

function saveSession(d) {
  if (!d || !d.access_token) return null;
  _session = {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: Date.now() + ((d.expires_in || 3600) * 1000),
    user: d.user,
  };
  try { store.set(SESSION_KEY, JSON.stringify(_session)); } catch (e) {}
  return _session;
}

async function sbAuth(path, body) {
  const res = await fetch(`${SB_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: SB_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || "Error de autenticación");
  return data;
}

async function signIn(email, password) {
  return saveSession(await sbAuth("token?grant_type=password", { email, password }));
}
async function signUp(email, password) {
  const d = await sbAuth("signup", { email, password });
  if (d.access_token) saveSession(d);
  return d; // si requiere confirmación de correo, no trae access_token
}
// Envía un correo con enlace para restablecer la contraseña
async function recoverPassword(email) {
  const res = await fetch(`${SB_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(window.location.origin)}`, {
    method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email }),
  });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.msg || d.message || "No se pudo enviar el correo"); }
  return true;
}
// Cambia la contraseña del usuario con sesión actual (usado tras el enlace de recuperación)
async function updatePassword(password) {
  const res = await fetch(`${SB_URL}/auth/v1/user`, {
    method: "PUT", headers: { apikey: SB_KEY, "Content-Type": "application/json", Authorization: `Bearer ${_session?.access_token}` },
    body: JSON.stringify({ password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.msg || data.message || data.error_description || "No se pudo cambiar la contraseña");
  if (_session) { _session.user = data; try { store.set(SESSION_KEY, JSON.stringify(_session)); } catch (e) {} }
  return data;
}
// Detecta el enlace de recuperación (tokens en el hash de la URL) y arranca sesión temporal
function consumeRecoveryHash() {
  try {
    const h = window.location.hash || "";
    if (h.indexOf("access_token") === -1) return false;
    const params = new URLSearchParams(h.replace(/^#/, ""));
    if (params.get("type") !== "recovery") return false;
    const access_token = params.get("access_token");
    if (!access_token) return false;
    saveSession({ access_token, refresh_token: params.get("refresh_token"), expires_in: parseInt(params.get("expires_in")) || 3600, user: null });
    try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch (e) {}
    return true;
  } catch (e) { return false; }
}
async function refreshSession() {
  if (!_session?.refresh_token) throw new Error("sin sesión");
  return saveSession(await sbAuth("token?grant_type=refresh_token", { refresh_token: _session.refresh_token }));
}
async function restoreSession() {
  try { const r = await store.get(SESSION_KEY); if (r && r.value) _session = JSON.parse(r.value); } catch (e) {}
  if (_session && _session.expires_at < Date.now() + 60000) {
    try { await refreshSession(); } catch (e) { _session = null; try { store.set(SESSION_KEY, ""); } catch (er) {} }
  }
  return _session;
}
async function signOut() {
  try { await fetch(`${SB_URL}/auth/v1/logout`, { method: "POST", headers: { apikey: SB_KEY, Authorization: `Bearer ${_session?.access_token}` } }); } catch (e) {}
  _session = null;
  try { store.set(SESSION_KEY, ""); } catch (e) {}
}

async function sbFetch(path, opts = {}) {
  if (_session && _session.expires_at < Date.now() + 60000 && _session.refresh_token) {
    try { await refreshSession(); } catch (e) {}
  }
  const headers = { apikey: SB_KEY, "Content-Type": "application/json", ...(opts.headers || {}) };
  if (_session?.access_token) headers.Authorization = `Bearer ${_session.access_token}`;
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { ...opts, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data && (data.message || data.hint)) || `Error ${res.status}`);
  return data;
}

const db = {
  select: (table, query = "") => sbFetch(`${table}?${query}`, { method: "GET" }),
  insert: (table, rows) => sbFetch(table, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(Array.isArray(rows) ? rows : [rows]) }),
  update: (table, id, patch) => sbFetch(`${table}?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) }),
  upsert: (table, rows) => sbFetch(`${table}?on_conflict=id`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) }),
  remove: (table, id) => sbFetch(`${table}?id=eq.${id}`, { method: "DELETE" }),
};

/* ---- Mapeo entre la forma de la app (camelCase) y las columnas de la BD ---- */
const orgFromDb = (r) => ({ id: r.id, name: r.name, logo: r.logo_url || "", accent: r.accent || DEFAULT_ACCENT, defaultMin: Number(r.default_min_stock) || 0, status: r.status || "active", theme: r.theme || "dark", createdAt: (r.created_at || "").slice(0, 10) });
const orgToDb = (o) => { const r = { name: o.name, logo_url: o.logo || null, accent: o.accent || DEFAULT_ACCENT }; if (o.defaultMin != null) r.default_min_stock = Number(o.defaultMin) || 0; if (o.theme != null) r.theme = o.theme; return r; };

const partFromDb = (r) => ({ id: r.id, sku: r.sku || "", name: r.name, brand: r.brand || "", category: r.category || "Otro", compat: r.compat || "", stock: Number(r.stock) || 0, minStock: Number(r.min_stock) || 0, cost: Number(r.cost) || 0, price: Number(r.price) || 0 });
const partToDb = (p, org_id) => ({ id: p.id, org_id, sku: p.sku || null, name: p.name, brand: p.brand || null, category: p.category || null, compat: p.compat || null, stock: Number(p.stock) || 0, min_stock: Number(p.minStock) || 0, cost: Number(p.cost) || 0, price: Number(p.price) || 0 });

const saleFromDb = (r) => ({ id: r.id, folio: r.folio, customer: r.customer || "", items: r.items || [], total: Number(r.total) || 0, cogs: Number(r.cogs) || 0, profit: Number(r.profit) || 0, date: r.sold_at, time: "" });
const saleToDb = (s, org_id) => ({ id: s.id, org_id, folio: s.folio || null, customer: s.customer || null, items: s.items || [], total: Number(s.total) || 0, cogs: Number(s.cogs) || 0, profit: Number(s.profit) || 0, sold_at: s.date });

const expenseFromDb = (r) => ({ id: r.id, category: r.category, amount: Number(r.amount) || 0, note: r.note || "", date: r.spent_at });
const expenseToDb = (e, org_id) => ({ id: e.id, org_id, category: e.category, amount: Number(e.amount) || 0, note: e.note || null, spent_at: e.date });

// Sincroniza un arreglo local con la tabla en Supabase: upsert de lo nuevo/cambiado, delete de lo quitado
async function syncTable(table, appRows, snapMap, toDb) {
  const curMap = new Map();
  for (const r of appRows) curMap.set(r.id, toDb(r));
  const toUpsert = [];
  for (const [id, row] of curMap) { if (snapMap.get(id) !== JSON.stringify(row)) toUpsert.push(row); }
  const toDelete = [];
  for (const id of snapMap.keys()) { if (!curMap.has(id)) toDelete.push(id); }
  if (toUpsert.length) await db.upsert(table, toUpsert);
  for (const id of toDelete) await db.remove(table, id);
  snapMap.clear();
  for (const [id, row] of curMap) snapMap.set(id, JSON.stringify(row));
}

// Extrae texto de un archivo para mandárselo a la IA.
// PDF: usa pdfjs (carga diferida). CSV/XML/TXT: texto plano.
async function extractTextFromFile(file) {
  const name = (file.name || "").toLowerCase();
  const isPdf = name.endsWith(".pdf") || file.type === "application/pdf";
  if (isPdf) {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const data = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data }).promise;
    let out = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      out += tc.items.map(it => it.str).join(" ") + "\n";
      if (out.length > 30000) break;
    }
    return out;
  }
  return await file.text();
}

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap');
      :root {
        --bg:#0c1118; --card:#161d29; --surface:#1c2433; --border:#29323f; --border-soft:#20283480;
        --dashed:#3a4452; --text:#e9ecf1; --text-2:#c4ccd8; --muted:#8a93a3; --muted-2:#5a6372;
      }
      .sg { font-family: 'Space Grotesk', sans-serif; }
      * { box-sizing: border-box; }
      input, select { background:var(--card); border:1px solid var(--border); color:var(--text); border-radius:8px; padding:9px 11px; font-size:14px; outline:none; }
      input:focus, select:focus { border-color:var(--accent); }
      button { cursor:pointer; }
      ::-webkit-scrollbar{width:6px;height:6px} ::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
      .spin { animation: spin 1s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      textarea { background:var(--card); border:1px solid var(--border); color:var(--text); border-radius:8px; padding:10px 12px; font-size:13px; outline:none; }
      textarea:focus { border-color:var(--accent); }
      table { width:100%; border-collapse:collapse; }
      th { text-align:left; font-size:11px; color:var(--muted); font-weight:600; padding:8px 8px; border-bottom:1px solid var(--border); }
      td { font-size:13px; padding:9px 8px; border-bottom:1px solid var(--border-soft); }
      @media print {
        body * { visibility: hidden !important; }
        .ticket-print, .ticket-print * { visibility: visible !important; }
        .ticket-print { position: absolute; left: 0; top: 0; width: 80mm; margin: 0; padding: 4mm; color: #000; background: #fff; }
        .no-print { display: none !important; }
        @page { size: 80mm auto; margin: 0; }
      }
    `}</style>
  );
}

export default function RefaccionariaSaaS() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [activeOrgId, setActiveOrgId] = useState(null);
  const [screen, setScreen] = useState("home");
  const [recovery, setRecovery] = useState(false);
  // Sin sesión: null = web pública (landing) · "login"/"register" = pantalla de acceso
  const [authIntent, setAuthIntent] = useState(null);

  const loadMe = async () => {
    if (!_session?.user) return;
    const uidNow = _session.user.id;
    try {
      const prof = (await db.select("profiles", `select=*&id=eq.${uidNow}`))?.[0] || { id: uidNow, email: _session.user.email, is_admin: false };
      setProfile(prof);
      if (prof.is_admin) {
        const os = await db.select("organizations", "select=*&order=created_at.asc");
        setOrgs((os || []).map(orgFromDb));
      } else {
        const mem = await db.select("memberships", `select=org_id&user_id=eq.${uidNow}`);
        const ids = (mem || []).map(m => m.org_id);
        if (ids.length) {
          const os = await db.select("organizations", `select=*&id=in.(${ids.join(",")})`);
          setOrgs((os || []).map(orgFromDb));
        } else setOrgs([]);
      }
    } catch (e) { setProfile({ id: uidNow, email: _session.user.email, is_admin: false }); setOrgs([]); }
  };

  useEffect(() => {
    (async () => {
      // ¿Llegó por el enlace de recuperación de contraseña?
      if (consumeRecoveryHash()) { setRecovery(true); setBooting(false); return; }
      const s = await restoreSession();
      setSession(s);
      if (s) await loadMe();
      setBooting(false);
    })();
  }, []);

  const onAuthed = async () => { setSession(_session); await loadMe(); setScreen("home"); };
  const doSignOut = async () => { await signOut(); setSession(null); setProfile(null); setOrgs([]); setActiveOrgId(null); setScreen("home"); setRecovery(false); setAuthIntent(null); };

  if (booting) return <><GlobalStyles /><Splash /></>;
  if (recovery) return <><GlobalStyles /><ResetPasswordScreen onDone={async () => { setRecovery(false); setSession(_session); await loadMe(); setScreen("home"); }} onCancel={doSignOut} /></>;
  if (!session) {
    if (!authIntent) return <><GlobalStyles /><LandingPage onEnter={(mode) => setAuthIntent(mode || "login")} /></>;
    return <><GlobalStyles /><AuthScreen initialMode={authIntent} onAuthed={onAuthed} onBack={() => setAuthIntent(null)} /></>;
  }

  const isAdmin = !!profile?.is_admin;
  const activeOrg = orgs.find(o => o.id === activeOrgId);

  let body;
  if (screen === "shop" && activeOrg) {
    body = <ShopApp key={activeOrg.id} org={activeOrg} onExit={() => isAdmin ? setScreen("home") : doSignOut()} isAdmin={isAdmin} />;
  } else if (isAdmin) {
    body = <AdminPanel orgs={orgs} reload={loadMe} onEnter={(id) => { setActiveOrgId(id); setScreen("shop"); }} onSignOut={doSignOut} adminEmail={session.user?.email} />;
  } else if (orgs.length === 0) {
    body = <NoOrgScreen email={session.user?.email} onSignOut={doSignOut} onRetry={loadMe} />;
  } else {
    const accessible = orgs.filter(o => o.status !== "suspended");
    if (accessible.length === 0) {
      body = <SuspendedScreen onSignOut={doSignOut} onRetry={loadMe} />;
    } else if (accessible.length === 1) {
      body = <ShopApp key={accessible[0].id} org={accessible[0]} onExit={doSignOut} isAdmin={false} />;
    } else {
      body = <OrgChooser orgs={accessible} onPick={(id) => { setActiveOrgId(id); setScreen("shop"); }} onSignOut={doSignOut} />;
    }
  }
  return <><GlobalStyles />{body}</>;
}

function ScreenShell({ children, accent = DEFAULT_ACCENT }) {
  return (
    <div style={{ "--accent": accent, "--accent-soft": accent + "22", minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "'Inter', system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      {children}
    </div>
  );
}

function Splash() {
  return <ScreenShell><Loader2 size={28} className="spin" color="var(--accent)" /></ScreenShell>;
}

/* ============================================================================
   Web pública (landing) — lo que ve un visitante antes de iniciar sesión.
   Presenta el producto y lleva al registro / inicio de sesión.
============================================================================ */
function LandingPage({ onEnter }) {
  const features = [
    { icon: ShoppingCart, title: "Punto de venta", desc: "Cobra en segundos: descuenta el stock solo, calcula la utilidad de cada venta e imprime tickets con tu logo y folio." },
    { icon: Boxes, title: "Inventario completo", desc: "Altas, bajas, búsqueda por SKU, marca o compatibilidad. Importa y exporta tu inventario en CSV cuando quieras." },
    { icon: BarChart3, title: "Contabilidad clara", desc: "Estado de resultados por día, semana, mes o histórico, con gráficas de ventas, gastos y utilidad." },
    { icon: Sparkles, title: "Asistente con IA", desc: "Dile qué llegó y lo captura por ti. Importa facturas CSV, XML/CFDI o PDF y las convierte en inventario." },
    { icon: Bell, title: "Avisos de stock", desc: "Niveles por pieza (agotado, crítico, por agotarse), campana con pendientes y lista de reorden sugerida." },
    { icon: Store, title: "Varias sucursales", desc: "Cada refaccionaria con su logo, color y tema. Cada dueño ve solo su negocio; tú lo ves todo." },
    { icon: Shield, title: "Datos seguros en la nube", desc: "Tu información viaja cifrada y queda aislada por negocio. Entra desde cualquier computadora o celular." },
    { icon: Printer, title: "Tickets imprimibles", desc: "Tickets de 80 mm listos para tu impresora térmica, con folio, logo y datos de tu negocio." },
  ];
  const steps = [
    { n: "1", title: "Crea tu cuenta", desc: "Regístrate con tu correo en menos de un minuto. Sin instalar nada: todo funciona en el navegador." },
    { n: "2", title: "Carga tu inventario", desc: "Captúralo a mano, súbelo en CSV o deja que el asistente de IA lo lea desde tus facturas." },
    { n: "3", title: "Vende y controla", desc: "Cobra en el punto de venta y mira en el tablero cuánto vendes, cuánto gastas y cuánto ganas." },
  ];
  const plans = [
    { name: "Básico", price: "$349", per: "/mes por sucursal", hl: false, items: ["1 refaccionaria", "Inventario y punto de venta", "Contabilidad y gráficas", "Avisos de stock", "Soporte por correo"] },
    { name: "Profesional", price: "$549", per: "/mes por sucursal", hl: true, items: ["Todo lo del plan Básico", "Asistente con IA", "Importador de facturas (CSV/XML/PDF)", "Tickets con tu logo", "Soporte prioritario"] },
    { name: "Cadena", price: "A la medida", per: "", hl: false, items: ["Varias sucursales", "Tablero global del grupo", "Acompañamiento en la carga inicial", "Facturación consolidada"] },
  ];
  const faqs = [
    { q: "¿Necesito instalar algo?", a: "No. Funciona en el navegador de cualquier computadora, tablet o celular con internet. Tus datos se guardan en la nube y puedes entrar desde donde estés." },
    { q: "¿Sirve para refaccionarias que no son de motos?", a: "Sí. Las categorías de piezas son configurables y el flujo de inventario, ventas y gastos es el mismo para cualquier refaccionaria o negocio de mostrador." },
    { q: "¿Puedo pasar mi inventario actual?", a: "Sí. Puedes importar un archivo CSV con tus piezas, o subir tus facturas (CSV, XML/CFDI o PDF) y el asistente de IA las convierte en inventario por ti." },
    { q: "¿Qué pasa si tengo varias sucursales?", a: "Cada sucursal se maneja como un negocio aparte con su propio inventario, ventas y personalización, y tú puedes verlas todas desde un panel de administrador." },
    { q: "¿Mis datos están seguros?", a: "Sí. Cada negocio está aislado a nivel base de datos: un dueño solo puede ver y tocar la información de su refaccionaria." },
  ];
  const navLink = { background: "none", border: "none", color: "var(--muted)", fontSize: 13, fontWeight: 600, textDecoration: "none", padding: "6px 4px" };
  const sectionTitle = (kicker, title, sub) => (
    <div style={{ textAlign: "center", marginBottom: 36 }}>
      <div style={{ color: "var(--accent)", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>{kicker}</div>
      <div className="sg" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.2 }}>{title}</div>
      {sub && <div style={{ color: "var(--muted)", fontSize: 14, marginTop: 10, maxWidth: 560, margin: "10px auto 0" }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ "--accent": DEFAULT_ACCENT, "--accent-soft": DEFAULT_ACCENT + "22", minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        html { scroll-behavior: smooth; }
        .ld-wrap { max-width: 1080px; margin: 0 auto; padding: 0 20px; }
        .ld-hero { display: grid; grid-template-columns: 1.15fr 1fr; gap: 48px; align-items: center; padding: 72px 0 64px; }
        .ld-grid-feat { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px; }
        .ld-grid-steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
        .ld-grid-plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; align-items: stretch; }
        .ld-nav-links { display: flex; gap: 18px; align-items: center; }
        .ld-card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 20px; }
        .ld-card:hover { border-color: var(--accent); }
        details.ld-faq { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px 18px; margin-bottom: 10px; }
        details.ld-faq summary { cursor: pointer; font-weight: 600; font-size: 14px; list-style: none; display: flex; justify-content: space-between; align-items: center; }
        details.ld-faq summary::-webkit-details-marker { display: none; }
        details.ld-faq summary::after { content: "+"; color: var(--accent); font-size: 18px; font-weight: 700; }
        details.ld-faq[open] summary::after { content: "–"; }
        details.ld-faq p { color: var(--muted); font-size: 13px; line-height: 1.6; margin: 10px 0 2px; }
        @media (max-width: 860px) {
          .ld-hero { grid-template-columns: 1fr; padding: 40px 0 40px; gap: 32px; }
          .ld-nav-links { display: none; }
        }
      `}</style>

      {/* ---- Barra de navegación ---- */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#0c1118e6", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--border-soft)" }}>
        <div className="ld-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 62 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Boxes size={19} color="var(--accent)" />
            </div>
            <span className="sg" style={{ fontWeight: 700, fontSize: 16 }}>Refaccionaria<span style={{ color: "var(--accent)" }}>Cloud</span></span>
          </div>
          <div className="ld-nav-links">
            <a href="#funciones" style={navLink}>Funciones</a>
            <a href="#como-funciona" style={navLink}>Cómo funciona</a>
            <a href="#precios" style={navLink}>Precios</a>
            <a href="#faq" style={navLink}>Preguntas</a>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => onEnter("login")} style={{ ...btnGhost, padding: "8px 14px" }}><LogIn size={14} /> Entrar</button>
            <button onClick={() => onEnter("register")} style={{ ...btnGold, padding: "8px 14px" }}><UserPlus size={14} /> Crear cuenta</button>
          </div>
        </div>
      </div>

      {/* ---- Hero ---- */}
      <div className="ld-wrap">
        <div className="ld-hero">
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--accent-soft)", color: "var(--accent)", fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 999, marginBottom: 18 }}>
              <Sparkles size={13} /> Con asistente de inteligencia artificial
            </div>
            <h1 className="sg" style={{ fontSize: 42, lineHeight: 1.15, fontWeight: 700, margin: "0 0 16px" }}>
              El sistema completo para tu <span style={{ color: "var(--accent)" }}>refaccionaria</span>
            </h1>
            <p style={{ color: "var(--text-2)", fontSize: 16, lineHeight: 1.65, margin: "0 0 26px", maxWidth: 480 }}>
              Inventario, punto de venta y contabilidad en un solo lugar, desde cualquier dispositivo.
              Sabe qué tienes, qué vendes y cuánto ganas — sin hojas de cálculo ni libretas.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => onEnter("register")} style={{ ...btnGold, padding: "12px 22px", fontSize: 14 }}>
                Empezar ahora <ArrowRight size={15} />
              </button>
              <button onClick={() => onEnter("login")} style={{ ...btnGhost, padding: "12px 22px", fontSize: 14, color: "var(--text-2)" }}>
                Ya tengo cuenta
              </button>
            </div>
            <div style={{ display: "flex", gap: 18, marginTop: 26, flexWrap: "wrap" }}>
              {["Sin instalar nada", "Datos en la nube", "En español"].map(t => (
                <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                  <Check size={13} color="#2ecc71" /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Vista previa tipo tablero */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 18, boxShadow: "0 24px 60px #00000055" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}><Store size={16} color="var(--accent)" /></div>
              <div>
                <div className="sg" style={{ fontSize: 13, fontWeight: 700 }}>Moto Refacciones El Águila</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>Tablero · hoy</div>
              </div>
              <Bell size={15} color="var(--accent)" style={{ marginLeft: "auto" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
              {[
                { icon: DollarSign, label: "Ventas", value: "$8,450" },
                { icon: TrendingUp, label: "Utilidad", value: "$3,120" },
                { icon: Package, label: "Piezas", value: "1,284" },
              ].map(({ icon: I, label, value }) => (
                <div key={label} style={{ background: "var(--surface)", borderRadius: 10, padding: "10px 12px" }}>
                  <I size={13} color="var(--accent)" />
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{label}</div>
                  <div className="sg" style={{ fontSize: 15, fontWeight: 700 }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "var(--surface)", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 8 }}>Ventas de la semana</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 56 }}>
                {[34, 52, 41, 68, 47, 80, 62].map((h, i) => (
                  <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 4, background: i === 5 ? "var(--accent)" : "var(--accent-soft)" }} />
                ))}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#e8a13a18", border: "1px solid #e8a13a55", borderRadius: 10, padding: "8px 12px" }}>
              <AlertTriangle size={14} color="#e8a13a" />
              <span style={{ fontSize: 11, color: "var(--text-2)" }}>3 piezas por agotarse · revisa la lista de reorden</span>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Funciones ---- */}
      <div id="funciones" style={{ padding: "64px 0", borderTop: "1px solid var(--border-soft)" }}>
        <div className="ld-wrap">
          {sectionTitle("Funciones", "Todo lo que tu mostrador necesita", "Deja la libreta y las hojas de cálculo: administra inventario, ventas y dinero desde una sola pantalla.")}
          <div className="ld-grid-feat">
            {features.map(({ icon: I, title, desc }) => (
              <div key={title} className="ld-card">
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <I size={19} color="var(--accent)" />
                </div>
                <div className="sg" style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Cómo funciona ---- */}
      <div id="como-funciona" style={{ padding: "64px 0", borderTop: "1px solid var(--border-soft)", background: "var(--card)" }}>
        <div className="ld-wrap">
          {sectionTitle("Cómo funciona", "Empiezas a vender el mismo día")}
          <div className="ld-grid-steps">
            {steps.map(s => (
              <div key={s.n} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 14, padding: 22 }}>
                <div className="sg" style={{ fontSize: 26, fontWeight: 700, color: "var(--accent)", marginBottom: 10 }}>{s.n}</div>
                <div className="sg" style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Precios ---- */}
      <div id="precios" style={{ padding: "64px 0", borderTop: "1px solid var(--border-soft)" }}>
        <div className="ld-wrap">
          {sectionTitle("Precios", "Un plan para cada tamaño de negocio", "Precios en pesos mexicanos. Cancela cuando quieras, sin plazos forzosos.")}
          <div className="ld-grid-plans">
            {plans.map(p => (
              <div key={p.name} style={{
                background: "var(--card)", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column",
                border: p.hl ? "1px solid var(--accent)" : "1px solid var(--border)",
                boxShadow: p.hl ? "0 12px 40px #d4af3722" : "none", position: "relative",
              }}>
                {p.hl && <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: "var(--accent)", color: "#0c1118", fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: 999 }}>Recomendado</div>}
                <div className="sg" style={{ fontSize: 15, fontWeight: 700, color: p.hl ? "var(--accent)" : "var(--text)" }}>{p.name}</div>
                <div style={{ margin: "12px 0 16px" }}>
                  <span className="sg" style={{ fontSize: 32, fontWeight: 700 }}>{p.price}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}> {p.per}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 20 }}>
                  {p.items.map(it => (
                    <span key={it} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--text-2)" }}>
                      <Check size={14} color="#2ecc71" style={{ flexShrink: 0, marginTop: 2 }} /> {it}
                    </span>
                  ))}
                </div>
                <button onClick={() => onEnter("register")} style={{ ...(p.hl ? btnGold : btnGhost), width: "100%", justifyContent: "center", marginTop: "auto" }}>
                  {p.name === "Cadena" ? "Contáctanos" : "Empezar"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Preguntas frecuentes ---- */}
      <div id="faq" style={{ padding: "64px 0", borderTop: "1px solid var(--border-soft)" }}>
        <div className="ld-wrap" style={{ maxWidth: 720 }}>
          {sectionTitle("Preguntas frecuentes", "¿Dudas? Aquí las resolvemos")}
          {faqs.map(f => (
            <details key={f.q} className="ld-faq">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* ---- Llamado final ---- */}
      <div style={{ padding: "72px 0", borderTop: "1px solid var(--border-soft)", background: "var(--card)", textAlign: "center" }}>
        <div className="ld-wrap">
          <div className="sg" style={{ fontSize: 30, fontWeight: 700, marginBottom: 10 }}>Pon tu refaccionaria en orden hoy</div>
          <div style={{ color: "var(--muted)", fontSize: 14, marginBottom: 26 }}>Crea tu cuenta gratis y carga tu inventario en minutos.</div>
          <button onClick={() => onEnter("register")} style={{ ...btnGold, padding: "13px 26px", fontSize: 14, display: "inline-flex" }}>
            Crear mi cuenta <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* ---- Pie de página ---- */}
      <div style={{ borderTop: "1px solid var(--border-soft)", padding: "26px 0" }}>
        <div className="ld-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)" }}>
            <Boxes size={16} color="var(--accent)" />
            <span className="sg" style={{ fontWeight: 700, color: "var(--text)" }}>Refaccionaria<span style={{ color: "var(--accent)" }}>Cloud</span></span>
            <span>· Inventario, ventas y contabilidad para refaccionarias</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted-2)" }}>© {new Date().getFullYear()} Aivora · aivoraia.com</div>
        </div>
      </div>
    </div>
  );
}

function AuthScreen({ onAuthed, initialMode = "login", onBack }) {
  const [mode, setMode] = useState(initialMode); // login | register | recover
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const submit = async () => {
    if (mode === "recover") {
      if (!email.trim()) return setError("Escribe tu correo.");
      setBusy(true); setError(null); setInfo(null);
      try {
        await recoverPassword(email.trim());
        setInfo("Te enviamos un enlace a tu correo para restablecer la contraseña. Revísalo (y la carpeta de spam).");
      } catch (e) { setError(e.message || "No se pudo enviar el correo."); }
      finally { setBusy(false); }
      return;
    }
    if (!email.trim() || !password) return setError("Escribe tu correo y contraseña.");
    setBusy(true); setError(null); setInfo(null);
    try {
      if (mode === "login") {
        await signIn(email.trim(), password);
        await onAuthed();
      } else {
        const d = await signUp(email.trim(), password);
        if (d.access_token) { await onAuthed(); }
        else { setInfo("Cuenta creada. Si te pide confirmar tu correo, revísalo; si no, ya puedes iniciar sesión."); setMode("login"); }
      }
    } catch (e) { setError(e.message || "No se pudo completar."); }
    finally { setBusy(false); }
  };

  const subtitle = mode === "login" ? "Inicia sesión para continuar" : mode === "register" ? "Crea tu cuenta" : "Recupera tu contraseña";

  return (
    <ScreenShell>
      <div style={{ width: 380, maxWidth: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--accent-soft)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
            <Boxes size={30} color="var(--accent)" />
          </div>
          <div className="sg" style={{ fontSize: 22, fontWeight: 700 }}>Refaccionaria de Motos</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{subtitle}</div>
        </div>
        <Card>
          <label style={lbl}>Correo</label>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Mail size={15} color="var(--muted-2)" style={{ position: "absolute", left: 11, top: 11 }} />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="tucorreo@ejemplo.com" style={{ width: "100%", paddingLeft: 34 }} />
          </div>
          {mode !== "recover" && (
            <>
              <label style={lbl}>Contraseña</label>
              <div style={{ position: "relative", marginBottom: 8 }}>
                <Lock size={15} color="var(--muted-2)" style={{ position: "absolute", left: 11, top: 11 }} />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="••••••••" style={{ width: "100%", paddingLeft: 34 }} />
              </div>
              {mode === "login" && (
                <div style={{ textAlign: "right", marginBottom: 12 }}>
                  <button onClick={() => { setMode("recover"); setError(null); setInfo(null); }} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 11 }}>¿Olvidaste tu contraseña?</button>
                </div>
              )}
            </>
          )}
          {error && <div style={{ color: "#e25c5c", fontSize: 12, marginBottom: 10 }}>{error}</div>}
          {info && <div style={{ color: "#2ecc71", fontSize: 12, marginBottom: 10 }}>{info}</div>}
          <button onClick={submit} disabled={busy} style={{ ...btnGold, width: "100%", justifyContent: "center" }}>
            {busy ? <Loader2 size={15} className="spin" /> : (mode === "login" ? <LogIn size={15} /> : mode === "register" ? <UserPlus size={15} /> : <Mail size={15} />)}
            {mode === "login" ? "Entrar" : mode === "register" ? "Crear cuenta" : "Enviar enlace"}
          </button>
          <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "var(--muted)" }}>
            {mode === "recover" ? (
              <button onClick={() => { setMode("login"); setError(null); setInfo(null); }} style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 700, fontSize: 12 }}>Volver a iniciar sesión</button>
            ) : (
              <>
                {mode === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
                <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); setInfo(null); }}
                  style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 700, fontSize: 12 }}>
                  {mode === "login" ? "Regístrate" : "Inicia sesión"}
                </button>
              </>
            )}
          </div>
          {onBack && (
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--muted-2)", fontSize: 11 }}>← Volver a la página principal</button>
            </div>
          )}
        </Card>
      </div>
    </ScreenShell>
  );
}

function ResetPasswordScreen({ onDone, onCancel }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    setBusy(true); setError(null);
    try {
      await updatePassword(password);
      await onDone();
    } catch (e) { setError(e.message || "No se pudo cambiar la contraseña. El enlace pudo expirar."); }
    finally { setBusy(false); }
  };

  return (
    <ScreenShell>
      <div style={{ width: 380, maxWidth: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--accent-soft)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
            <Lock size={28} color="var(--accent)" />
          </div>
          <div className="sg" style={{ fontSize: 22, fontWeight: 700 }}>Nueva contraseña</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>Escribe tu nueva contraseña</div>
        </div>
        <Card>
          <label style={lbl}>Nueva contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ width: "100%", marginBottom: 12 }} />
          <label style={lbl}>Repite la contraseña</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="••••••••" style={{ width: "100%", marginBottom: 14 }} />
          {error && <div style={{ color: "#e25c5c", fontSize: 12, marginBottom: 10 }}>{error}</div>}
          <button onClick={submit} disabled={busy} style={{ ...btnGold, width: "100%", justifyContent: "center" }}>
            {busy ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Guardar contraseña
          </button>
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button onClick={onCancel} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12 }}>Cancelar</button>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}

function NoOrgScreen({ email, onSignOut, onRetry }) {
  return (
    <ScreenShell>
      <div style={{ width: 420, maxWidth: "100%", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--accent-soft)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Store size={28} color="var(--accent)" />
        </div>
        <div className="sg" style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Tu cuenta aún no tiene refaccionaria</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20, lineHeight: 1.6 }}>
          Ya iniciaste sesión como <b style={{ color: "var(--text)" }}>{email}</b>, pero el administrador todavía no te ha asignado a un negocio. Pídele que te asigne y luego actualiza.
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={onRetry} style={btnGold}><ArrowRight size={15} /> Ya me asignó, actualizar</button>
          <button onClick={onSignOut} style={btnGhost}><LogOut size={15} /> Salir</button>
        </div>
      </div>
    </ScreenShell>
  );
}

function SuspendedScreen({ onSignOut, onRetry }) {
  return (
    <ScreenShell>
      <div style={{ width: 420, maxWidth: "100%", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: "#e25c5c22", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Lock size={28} color="#e25c5c" />
        </div>
        <div className="sg" style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Refaccionaria suspendida</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20, lineHeight: 1.6 }}>
          Tu refaccionaria está temporalmente suspendida. Contacta al administrador de la plataforma para reactivarla.
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={onRetry} style={btnGhost}><ArrowRight size={15} /> Reintentar</button>
          <button onClick={onSignOut} style={btnGhost}><LogOut size={15} /> Salir</button>
        </div>
      </div>
    </ScreenShell>
  );
}

function OrgChooser({ orgs, onPick, onSignOut }) {
  return (
    <ScreenShell>
      <div style={{ width: 460, maxWidth: "100%" }}>
        <div className="sg" style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, textAlign: "center" }}>Elige una refaccionaria</div>
        <div style={{ display: "grid", gap: 10 }}>
          {orgs.map(o => (
            <button key={o.id} onClick={() => onPick(o.id)} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, textAlign: "left", color: "var(--text)" }}>
              {o.logo ? <img src={o.logo} alt="" style={{ width: 38, height: 38, borderRadius: 9, objectFit: "cover" }} />
                : <div style={{ width: 38, height: 38, borderRadius: 9, background: (o.accent || DEFAULT_ACCENT) + "22", display: "flex", alignItems: "center", justifyContent: "center" }}><Boxes size={20} color={o.accent || DEFAULT_ACCENT} /></div>}
              <span className="sg" style={{ fontWeight: 700, flex: 1 }}>{o.name}</span>
              <ArrowRight size={16} color="var(--muted)" />
            </button>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button onClick={onSignOut} style={btnGhost}><LogOut size={15} /> Salir</button>
        </div>
      </div>
    </ScreenShell>
  );
}

/* ---------- Panel de administrador (multi-refaccionaria) ---------- */
function AdminPanel({ orgs, reload, onEnter, onSignOut, adminEmail }) {
  const blank = { name: "", logo: "", accent: DEFAULT_ACCENT };
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [users, setUsers] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [stats, setStats] = useState({});
  const [q, setQ] = useState("");

  const accent = form.accent || DEFAULT_ACCENT;

  const loadUsers = async () => {
    try {
      const [us, ms] = await Promise.all([
        db.select("profiles", "select=id,email,is_admin&order=created_at.asc"),
        db.select("memberships", "select=id,user_id,org_id,role"),
      ]);
      setUsers(us || []); setMemberships(ms || []);
    } catch (e) {}
  };
  const loadStats = async () => {
    try {
      const monthStart = todayStr().slice(0, 7) + "-01";
      const [pp, ss] = await Promise.all([
        db.select("parts", "select=org_id,stock,min_stock,cost"),
        db.select("sales", `select=org_id,total&sold_at=gte.${monthStart}`),
      ]);
      const map = {};
      const ensure = (id) => (map[id] = map[id] || { parts: 0, value: 0, low: 0, salesMonth: 0 });
      for (const p of (pp || [])) {
        const m = ensure(p.org_id);
        const stock = Number(p.stock) || 0, min = Number(p.min_stock) || 0;
        m.parts += 1; m.value += stock * (Number(p.cost) || 0);
        if (stock <= min) m.low += 1;
      }
      for (const s of (ss || [])) ensure(s.org_id).salesMonth += Number(s.total) || 0;
      setStats(map);
    } catch (e) {}
  };
  useEffect(() => { loadUsers(); loadStats(); }, []);

  const toggleStatus = async (o) => {
    setErr(null);
    try { await db.update("organizations", o.id, { status: o.status === "suspended" ? "active" : "suspended" }); await reload(); }
    catch (e) { setErr(e.message || "No se pudo cambiar el estado"); }
  };

  const filteredOrgs = orgs.filter(o => o.name.toLowerCase().includes(q.trim().toLowerCase()));
  const totals = orgs.reduce((acc, o) => {
    const s = stats[o.id] || {};
    acc.value += s.value || 0; acc.salesMonth += s.salesMonth || 0; acc.low += s.low || 0;
    if (o.status !== "suspended") acc.active += 1;
    return acc;
  }, { value: 0, salesMonth: 0, low: 0, active: 0 });

  const save = async () => {
    if (!form.name.trim()) return;
    setBusy(true); setErr(null);
    try {
      if (editId) await db.update("organizations", editId, orgToDb({ name: form.name.trim(), logo: form.logo, accent }));
      else await db.insert("organizations", orgToDb({ name: form.name.trim(), logo: form.logo, accent }));
      setForm(blank); setEditId(null);
      await reload();
    } catch (e) { setErr(e.message || "No se pudo guardar"); }
    finally { setBusy(false); }
  };
  const edit = (o) => { setEditId(o.id); setForm({ name: o.name, logo: o.logo || "", accent: o.accent || DEFAULT_ACCENT }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const remove = async (id) => {
    setBusy(true); setErr(null);
    try { await db.remove("organizations", id); setDelId(null); if (editId === id) { setEditId(null); setForm(blank); } await reload(); await loadUsers(); }
    catch (e) { setErr(e.message || "No se pudo eliminar"); }
    finally { setBusy(false); }
  };
  const assign = async (userId, orgId) => {
    if (!orgId) return;
    try { await db.insert("memberships", { user_id: userId, org_id: orgId, role: "owner" }); await loadUsers(); }
    catch (e) { setErr(e.message || "No se pudo asignar"); }
  };
  const unassign = async (memId) => {
    try { await db.remove("memberships", memId); await loadUsers(); }
    catch (e) { setErr(e.message || "No se pudo quitar"); }
  };

  return (
    <div style={{ "--accent": accent, "--accent-soft": accent + "22", minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 20px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <Shield size={22} color="var(--accent)" />
              <div className="sg" style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>Panel de administrador</div>
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Crea y personaliza las refaccionarias de tu plataforma. Cada una tiene su nombre, logo, colores y datos por separado.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{adminEmail}</span>
            <button onClick={onSignOut} style={{ ...btnGhost, padding: "8px 12px" }}><LogOut size={15} /> Salir</button>
          </div>
        </div>
        {err && <div style={{ color: "#e25c5c", fontSize: 12, marginTop: 10 }}>{err}</div>}
        <div style={{ height: 22 }} />

        {/* Crear / editar */}
        <Card style={{ marginBottom: 22 }}>
          <SectionTitle icon={editId ? Pencil : Store}>{editId ? "Editar refaccionaria" : "Nueva refaccionaria"}</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 16, alignItems: "start" }}>
            {/* Logo */}
            <div style={{ textAlign: "center" }}>
              <label style={{ cursor: "pointer", display: "block" }}>
                <div style={{ width: 96, height: 96, borderRadius: 14, border: "1px dashed var(--dashed)", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {form.logo
                    ? <img src={form.logo} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ textAlign: "center", color: "var(--muted-2)" }}><ImagePlus size={22} /><div style={{ fontSize: 10, marginTop: 4 }}>Subir logo</div></div>}
                </div>
                <input type="file" accept="image/*" hidden onChange={e => e.target.files[0] && fileToLogo(e.target.files[0], (d) => setForm(f => ({ ...f, logo: d })))} />
              </label>
              {form.logo && <button onClick={() => setForm(f => ({ ...f, logo: "" }))} style={{ ...btnGhost, padding: "4px 10px", fontSize: 11, marginTop: 6 }}>Quitar</button>}
            </div>
            {/* Datos */}
            <div>
              <label style={lbl}>Nombre del negocio</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej. Refaccionaria El Pistón" style={{ width: "100%", marginBottom: 12 }} />
              <label style={lbl}>Color de la marca</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <input type="color" value={accent} onChange={e => setForm(f => ({ ...f, accent: e.target.value }))} style={{ width: 44, height: 36, padding: 2, cursor: "pointer" }} />
                <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "monospace" }}>{accent}</span>
                <div style={{ display: "flex", gap: 6, marginLeft: 6 }}>
                  {ACCENT_PRESETS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, accent: c }))} title={c}
                      style={{ width: 22, height: 22, borderRadius: 6, background: c, border: accent.toLowerCase() === c.toLowerCase() ? "2px solid #fff" : "1px solid var(--border)" }} />
                  ))}
                </div>
              </div>

              {/* Vista previa */}
              <div style={{ marginTop: 16 }}>
                <label style={lbl}>Vista previa</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
                  {form.logo
                    ? <img src={form.logo} alt="" style={{ width: 38, height: 38, borderRadius: 9, objectFit: "cover" }} />
                    : <div style={{ width: 38, height: 38, borderRadius: 9, background: accent + "22", display: "flex", alignItems: "center", justifyContent: "center" }}><Boxes size={20} color={accent} /></div>}
                  <div style={{ flex: 1 }}>
                    <div className="sg" style={{ fontSize: 15, fontWeight: 700 }}>{form.name || "Nombre del negocio"}</div>
                    <div style={{ height: 4, width: 90, background: accent, borderRadius: 3, marginTop: 5 }} />
                  </div>
                  <span style={{ background: accent, color: "#0c1118", fontWeight: 700, fontSize: 12, borderRadius: 8, padding: "7px 12px" }}>Botón</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button onClick={save} disabled={!form.name.trim() || busy} style={{ ...btnGold, opacity: form.name.trim() && !busy ? 1 : 0.5 }}>
                  {busy ? <Loader2 size={15} className="spin" /> : <Check size={15} />} {editId ? "Guardar cambios" : "Crear refaccionaria"}
                </button>
                {editId && <button onClick={() => { setEditId(null); setForm(blank); }} style={btnGhost}><X size={15} /> Cancelar</button>}
              </div>
            </div>
          </div>
        </Card>

        {/* Tablero global */}
        {orgs.length > 0 && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
            <StatCard label="Negocios activos" value={`${totals.active}/${orgs.length}`} color="var(--text)" icon={Store} />
            <StatCard label="Ventas del mes (global)" value={fmt0(totals.salesMonth)} color="#2ecc71" icon={TrendingUp} />
            <StatCard label="Valor inventario (global)" value={fmt0(totals.value)} color="#3fa9f5" icon={Boxes} />
            <StatCard label="Piezas bajo mínimo" value={`${totals.low}`} color={totals.low > 0 ? "#e8a13a" : "#2ecc71"} icon={AlertTriangle} />
          </div>
        )}

        {/* Listado */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <SectionTitle icon={Store}>Refaccionarias ({orgs.length})</SectionTitle>
          <div style={{ flex: 1 }} />
          {orgs.length > 0 && (
            <div style={{ position: "relative" }}>
              <Search size={14} color="var(--muted-2)" style={{ position: "absolute", left: 10, top: 11 }} />
              <input placeholder="Buscar refaccionaria…" value={q} onChange={e => setQ(e.target.value)} style={{ paddingLeft: 30, width: 220 }} />
            </div>
          )}
        </div>
        {orgs.length === 0 ? (
          <EmptyState text="Aún no hay refaccionarias. Crea la primera arriba." />
        ) : filteredOrgs.length === 0 ? (
          <EmptyState text="Sin resultados para tu búsqueda." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 14 }}>
            {filteredOrgs.map(o => {
              const s = stats[o.id] || { parts: 0, value: 0, low: 0, salesMonth: 0 };
              const suspended = o.status === "suspended";
              return (
                <div key={o.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, borderTop: `3px solid ${suspended ? "var(--muted-2)" : (o.accent || DEFAULT_ACCENT)}`, opacity: suspended ? 0.6 : 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    {o.logo
                      ? <img src={o.logo} alt="" style={{ width: 42, height: 42, borderRadius: 10, objectFit: "cover" }} />
                      : <div style={{ width: 42, height: 42, borderRadius: 10, background: (o.accent || DEFAULT_ACCENT) + "22", display: "flex", alignItems: "center", justifyContent: "center" }}><Boxes size={22} color={o.accent || DEFAULT_ACCENT} /></div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="sg" style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted-2)", display: "flex", alignItems: "center", gap: 5 }}>
                        {suspended
                          ? <span style={{ color: "#e25c5c", fontWeight: 700 }}>● Suspendida</span>
                          : <><span style={{ width: 10, height: 10, borderRadius: 3, background: o.accent || DEFAULT_ACCENT, display: "inline-block" }} />{o.createdAt || ""}</>}
                      </div>
                    </div>
                  </div>

                  {/* Resumen del negocio */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                    <MiniKPI label="Ventas del mes" value={fmt0(s.salesMonth)} color="#2ecc71" />
                    <MiniKPI label="Inventario" value={fmt0(s.value)} color="#3fa9f5" />
                    <MiniKPI label="Piezas" value={`${s.parts}`} color="var(--text)" />
                    <MiniKPI label="Bajo mínimo" value={`${s.low}`} color={s.low > 0 ? "#e8a13a" : "var(--muted-2)"} />
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => onEnter(o.id)} style={{ ...btnGold, flex: 1, justifyContent: "center", padding: "8px 0" }}>
                      Entrar <ArrowRight size={15} />
                    </button>
                    <button onClick={() => edit(o)} style={{ ...btnGhost, padding: "8px 10px" }} title="Editar"><Pencil size={14} /></button>
                    <button onClick={() => toggleStatus(o)} style={{ ...btnGhost, padding: "8px 10px" }} title={suspended ? "Reactivar" : "Suspender"}>
                      {suspended ? <Check size={14} /> : <Lock size={14} />}
                    </button>
                    <button onClick={() => setDelId(o.id)} style={{ ...btnDanger, padding: "8px 10px" }} title="Eliminar"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Cuentas de usuarios */}
        <div style={{ height: 26 }} />
        <SectionTitle icon={Users}>Cuentas de usuarios ({users.length})</SectionTitle>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
          Cuando un dueño se registra, aquí aparece su correo. Asígnalo a su refaccionaria para que pueda entrar y ver solo sus datos.
        </div>
        <Card>
          {users.length === 0 ? <EmptyState text="Aún no hay usuarios registrados." /> : users.map(u => {
            const mine = memberships.filter(m => m.user_id === u.id);
            const assignedIds = new Set(mine.map(m => m.org_id));
            const available = orgs.filter(o => !assignedIds.has(o.id));
            return (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border-soft)", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{u.email}{u.is_admin && <span style={{ fontSize: 10, color: "var(--accent)", border: "1px solid var(--accent)", borderRadius: 6, padding: "1px 6px", marginLeft: 8 }}>ADMIN</span>}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
                    {mine.length === 0 && !u.is_admin && <span style={{ fontSize: 11, color: "var(--muted-2)" }}>Sin refaccionaria asignada</span>}
                    {mine.map(m => {
                      const o = orgs.find(x => x.id === m.org_id);
                      return (
                        <span key={m.id} style={{ fontSize: 11, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "3px 6px 3px 10px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {o ? o.name : "—"}
                          <button onClick={() => unassign(m.id)} style={{ background: "none", border: "none", color: "var(--muted)", padding: 0, display: "flex" }} title="Quitar"><X size={12} /></button>
                        </span>
                      );
                    })}
                  </div>
                </div>
                {!u.is_admin && available.length > 0 && (
                  <select defaultValue="" onChange={e => { if (e.target.value) { assign(u.id, e.target.value); e.target.value = ""; } }} style={{ fontSize: 12 }}>
                    <option value="">Asignar a…</option>
                    {available.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                )}
              </div>
            );
          })}
        </Card>
      </div>

      {/* Confirmación de borrado */}
      {delId && (() => {
        const o = orgs.find(x => x.id === delId);
        return (
          <div onClick={() => setDelId(null)} style={{ position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 60 }}>
            <div onClick={e => e.stopPropagation()} style={{ width: 400, maxWidth: "100%", background: "var(--card)", border: "1px solid #e25c5c", borderRadius: 14, padding: 22 }}>
              <div className="sg" style={{ fontSize: 16, fontWeight: 700, color: "#e25c5c", display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <AlertTriangle size={18} /> ¿Eliminar "{o?.name}"?
              </div>
              <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 18, lineHeight: 1.5 }}>
                Se borrará la refaccionaria junto con todo su inventario, ventas y gastos. Esta acción no se puede deshacer.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setDelId(null)} style={{ ...btnGhost, flex: 1, justifyContent: "center" }}><X size={15} /> Cancelar</button>
                <button onClick={() => remove(delId)} style={{ ...btnDanger, flex: 1, justifyContent: "center" }}><Trash2 size={15} /> Sí, eliminar</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function ShopApp({ org: orgProp, onExit, isAdmin }) {
  const [org, setOrg] = useState(orgProp);
  const K = (k) => `refa:org:${org.id}:${k}`;
  const accent = org.accent || "#d4af37";
  const light = org.theme === "light";
  const [tab, setTab] = useState("tablero");
  const [parts, setParts] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const [shop, setShop] = useState({ name: org.name, phone: "", address: "", footer: "¡Gracias por su compra!" });
  const [ticketSale, setTicketSale] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showReorder, setShowReorder] = useState(false);

  const saveOrg = async (patch) => {
    const updated = { ...org, ...patch };
    await db.update("organizations", org.id, orgToDb(updated));
    setOrg(updated);
  };
  // Aplica un mínimo a las piezas que aún están en 0 (las cargadas sin mínimo)
  const applyMinToZero = (val) => {
    const v = Math.max(0, parseInt(val) || 0);
    setParts(prev => prev.map(p => (Number(p.minStock) || 0) === 0 ? { ...p, minStock: v } : p));
  };

  // Snapshots de lo último sincronizado a Supabase (para hacer diff)
  const partsSnap = useRef(new Map());
  const salesSnap = useRef(new Map());
  const expensesSnap = useRef(new Map());

  // --- Carga inicial desde Supabase ---
  useEffect(() => {
    (async () => {
      try {
        const [pp, ss, ee] = await Promise.all([
          db.select("parts", `select=*&org_id=eq.${org.id}&order=created_at.desc`),
          db.select("sales", `select=*&org_id=eq.${org.id}&order=created_at.desc`),
          db.select("expenses", `select=*&org_id=eq.${org.id}&order=created_at.desc`),
        ]);
        const P = (pp || []).map(partFromDb), S = (ss || []).map(saleFromDb), E = (ee || []).map(expenseFromDb);
        for (const p of P) partsSnap.current.set(p.id, JSON.stringify(partToDb(p, org.id)));
        for (const s of S) salesSnap.current.set(s.id, JSON.stringify(saleToDb(s, org.id)));
        for (const e of E) expensesSnap.current.set(e.id, JSON.stringify(expenseToDb(e, org.id)));
        setParts(P); setSales(S); setExpenses(E);
      } catch (e) { showToast("Error al cargar datos de la nube"); }
      try { const r = await store.get(K("shop")); if (r && r.value) setShop(prev => ({ ...prev, ...JSON.parse(r.value) })); } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  // --- Sincronización a Supabase (con pequeño retardo para agrupar cambios) ---
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => { syncTable("parts", parts, partsSnap.current, p => partToDb(p, org.id)).catch(() => showToast("Error al guardar inventario")); }, 400);
    return () => clearTimeout(t);
  }, [parts, loaded]);
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => { syncTable("sales", sales, salesSnap.current, s => saleToDb(s, org.id)).catch(() => showToast("Error al guardar ventas")); }, 400);
    return () => clearTimeout(t);
  }, [sales, loaded]);
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => { syncTable("expenses", expenses, expensesSnap.current, e => expenseToDb(e, org.id)).catch(() => showToast("Error al guardar gastos")); }, 400);
    return () => clearTimeout(t);
  }, [expenses, loaded]);

  // La config del ticket (nombre/teléfono/dirección) se guarda local por org (cosmético)
  useEffect(() => { if (loaded) store.set(K("shop"), JSON.stringify(shop)).catch(() => {}); }, [shop, loaded]);

  // El ícono de la pestaña muestra el logo del negocio (o el engranaje si no tiene logo)
  useEffect(() => {
    setFavicon(org.logo || DEFAULT_FAVICON);
    return () => setFavicon(DEFAULT_FAVICON);
  }, [org.logo]);

  // Tema claro/oscuro: pinta el fondo de la página acorde
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = light ? THEME_LIGHT["--bg"] : "#0c1118";
    return () => { document.body.style.background = prev; };
  }, [light]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2400); };

  // --- Derived metrics ---
  const inventoryValue = useMemo(
    () => parts.reduce((acc, p) => acc + (Number(p.stock) || 0) * (Number(p.cost) || 0), 0),
    [parts]
  );
  const inventoryRetail = useMemo(
    () => parts.reduce((acc, p) => acc + (Number(p.stock) || 0) * (Number(p.price) || 0), 0),
    [parts]
  );
  const lowStock = useMemo(
    () => parts.filter(p => (Number(p.stock) || 0) <= (Number(p.minStock) || 0)),
    [parts]
  );
  const alerts = useMemo(
    () => parts.map(p => ({ ...p, status: stockStatus(p) }))
      .filter(p => p.status !== "ok")
      .sort((a, b) => STATUS_META[a.status].rank - STATUS_META[b.status].rank || (Number(a.stock) || 0) - (Number(b.stock) || 0)),
    [parts]
  );
  const urgentCount = useMemo(() => alerts.filter(a => a.status === "agotado" || a.status === "critico").length, [alerts]);

  const thisMonth = todayStr().slice(0, 7);
  const monthSales = useMemo(() => sales.filter(s => s.date.slice(0, 7) === thisMonth), [sales, thisMonth]);
  const monthExpenses = useMemo(() => expenses.filter(e => e.date.slice(0, 7) === thisMonth), [expenses, thisMonth]);

  const monthRevenue = monthSales.reduce((a, s) => a + s.total, 0);
  const monthCogs = monthSales.reduce((a, s) => a + s.cogs, 0);
  const monthOpex = monthExpenses.reduce((a, e) => a + e.amount, 0);
  const monthGross = monthRevenue - monthCogs;
  const monthNet = monthGross - monthOpex;

  return (
    <div style={{ "--accent": accent, "--accent-soft": accent + "22", ...(light ? THEME_LIGHT : {}), minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 0", maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {org.logo
              ? <img src={org.logo} alt={org.name} style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", border: "1px solid var(--border)" }} />
              : <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}><Boxes size={24} color="var(--accent)" /></div>}
            <div>
              <div className="sg" style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>{org.name}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>Inventario y contabilidad en un solo lugar</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <MiniStat label="Valor inventario" value={fmt0(inventoryValue)} color="#3fa9f5" />
            <MiniStat label="Utilidad del mes" value={fmt0(monthNet)} color={monthNet >= 0 ? "#2ecc71" : "#e25c5c"} />
            {lowStock.length > 0 && <MiniStat label="Bajo mínimo" value={`${lowStock.length} pza`} color="#e8a13a" />}
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowAlerts(v => !v)} style={{ ...btnGhost, padding: "8px 10px", position: "relative" }} title="Alertas de inventario">
                <Bell size={16} />
                {urgentCount > 0 && (
                  <span style={{ position: "absolute", top: -5, right: -5, background: "#e25c5c", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 10, minWidth: 17, height: 17, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{urgentCount}</span>
                )}
              </button>
              {showAlerts && (
                <AlertsPanel alerts={alerts} onClose={() => setShowAlerts(false)}
                  onReorder={() => { setShowAlerts(false); setShowReorder(true); }}
                  onGoInventory={() => { setShowAlerts(false); setTab("inventario"); }} />
              )}
            </div>
            <button onClick={() => setShowSettings(true)} style={{ ...btnGhost, padding: "8px 12px" }} title="Editar nombre, logo y color del negocio">
              <Pencil size={15} /> Negocio
            </button>
            <button onClick={onExit} style={{ ...btnGhost, padding: "8px 12px" }} title={isAdmin ? "Volver al panel de administrador" : "Cerrar sesión"}>
              <LogOut size={15} /> {isAdmin ? "Panel" : "Salir"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginTop: 18, borderBottom: "1px solid var(--border-soft)", flexWrap: "wrap" }}>
          {[
            { id: "tablero", label: "Tablero", icon: BarChart3 },
            { id: "inventario", label: "Inventario", icon: Package },
            { id: "ventas", label: "Punto de venta", icon: ShoppingCart },
            { id: "gastos", label: "Gastos", icon: Receipt },
            { id: "contabilidad", label: "Contabilidad", icon: Wallet },
            { id: "asistente", label: "Asistente IA", icon: Sparkles },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                background: "none", border: "none", padding: "10px 14px", display: "flex", alignItems: "center", gap: 6,
                color: tab === t.id ? "var(--accent)" : "var(--muted)", borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
                fontSize: 13, fontWeight: 600, marginBottom: -1
              }}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "20px" }}>
        {tab === "tablero" && (
          <Tablero
            inventoryValue={inventoryValue} inventoryRetail={inventoryRetail} lowStock={lowStock}
            monthRevenue={monthRevenue} monthNet={monthNet} monthGross={monthGross}
            sales={sales} expenses={expenses} parts={parts} setTab={setTab}
          />
        )}
        {tab === "inventario" && (
          <Inventario parts={parts} setParts={setParts} showToast={showToast} defaultMin={org.defaultMin || 0} />
        )}
        {tab === "ventas" && (
          <PuntoDeVenta parts={parts} setParts={setParts} sales={sales} setSales={setSales} showToast={showToast} onTicket={setTicketSale} />
        )}
        {tab === "gastos" && (
          <Gastos expenses={expenses} setExpenses={setExpenses} showToast={showToast} />
        )}
        {tab === "contabilidad" && (
          <Contabilidad sales={sales} expenses={expenses} />
        )}
        {tab === "asistente" && (
          <Asistente parts={parts} setParts={setParts} showToast={showToast} defaultMin={org.defaultMin || 0} />
        )}
      </div>

      {ticketSale && (
        <TicketModal sale={ticketSale} shop={shop} setShop={setShop} logo={org.logo} onClose={() => setTicketSale(null)} />
      )}

      {showSettings && (
        <ShopSettings org={org} saveOrg={saveOrg} onClose={() => setShowSettings(false)} showToast={showToast} applyMinToZero={applyMinToZero} />
      )}

      {showReorder && (
        <ReorderModal alerts={alerts} org={org} onClose={() => setShowReorder(false)} />
      )}

      {toast && (
        <div className="no-print" style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "var(--surface)", border: "1px solid var(--accent)", color: "var(--text)", padding: "10px 18px",
          borderRadius: 10, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, zIndex: 50
        }}>
          <Check size={14} color="var(--accent)" /> {toast}
        </div>
      )}
    </div>
  );
}

/* ---------- Shared bits ---------- */
function MiniStat({ label, value, color }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "8px 14px" }}>
      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{label}</div>
      <div className="sg" style={{ fontSize: 16, fontWeight: 700, color: color || "var(--text)" }}>{value}</div>
    </div>
  );
}

function MiniKPI({ label, value, color }) {
  return (
    <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 9px" }}>
      <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>{label}</div>
      <div className="sg" style={{ fontSize: 14, fontWeight: 700, color: color || "var(--text)" }}>{value}</div>
    </div>
  );
}

function StatCard({ label, value, color, icon: Icon, sub }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, flex: 1, minWidth: 150 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)", fontSize: 12, fontWeight: 600 }}>
        <Icon size={14} /> {label}
      </div>
      <div className="sg" style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: color || "var(--text)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ background: "var(--card)", border: "1px dashed var(--border)", borderRadius: 12, padding: 28, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
      {text}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ children, icon: Icon }) {
  return (
    <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
      {Icon && <Icon size={16} color="var(--accent)" />} {children}
    </div>
  );
}

/* ---------- Tablero ---------- */
function Tablero({ inventoryValue, inventoryRetail, lowStock, monthRevenue, monthNet, monthGross, sales, expenses, parts, setTab }) {
  const [gran, setGran] = useState("month");
  const monthly = useMemo(() => {
    const map = {};
    for (const s of sales) {
      const k = bucketOf(s.date, gran);
      if (!map[k]) map[k] = { k, ventas: 0, gastos: 0, utilidad: 0 };
      map[k].ventas += s.total;
      map[k].utilidad += s.total - s.cogs;
    }
    for (const e of expenses) {
      const k = bucketOf(e.date, gran);
      if (!map[k]) map[k] = { k, ventas: 0, gastos: 0, utilidad: 0 };
      map[k].gastos += e.amount;
      map[k].utilidad -= e.amount;
    }
    return Object.values(map).sort((a, b) => a.k.localeCompare(b.k)).slice(-GRAN_KEEP[gran]);
  }, [sales, expenses, gran]);

  const potentialMargin = inventoryRetail - inventoryValue;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <StatCard label="Valor de inventario (costo)" value={fmt0(inventoryValue)} color="#3fa9f5" icon={Boxes}
          sub={`Si se vende todo: +${fmt0(potentialMargin)} de utilidad`} />
        <StatCard label="Ventas del mes" value={fmt0(monthRevenue)} color="#2ecc71" icon={TrendingUp} />
        <StatCard label="Utilidad bruta del mes" value={fmt0(monthGross)} color="var(--accent)" icon={DollarSign} />
        <StatCard label="Utilidad neta del mes" value={fmt0(monthNet)} color={monthNet >= 0 ? "#2ecc71" : "#e25c5c"} icon={Wallet}
          sub="Después de gastos del local" />
      </div>

      {lowStock.length > 0 && (
        <Card style={{ marginBottom: 18, border: "1px solid #e8a13a" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div className="sg" style={{ fontSize: 14, fontWeight: 700, color: "#e8a13a", display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={16} /> Piezas por reabastecer ({lowStock.length})
            </div>
            <button onClick={() => setTab("inventario")} style={{ background: "none", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600 }}>
              Ver inventario
            </button>
          </div>
          {lowStock.slice(0, 6).map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
              <span>{p.name} <span style={{ color: "var(--muted-2)" }}>· {p.sku || "s/SKU"}</span></span>
              <span style={{ color: "#e8a13a", fontWeight: 600 }}>{p.stock} en stock (mín. {p.minStock})</span>
            </div>
          ))}
        </Card>
      )}

      {monthly.length > 0 ? (
        <Card style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <SectionTitle icon={BarChart3}>Ventas vs gastos por {gran === "day" ? "día" : gran === "week" ? "semana" : "mes"}</SectionTitle>
            <GranToggle gran={gran} setGran={setGran} />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="k" stroke="var(--muted)" fontSize={11} tickFormatter={(v) => bucketLabel(v, gran)} />
              <YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v) => fmt0(v)} labelFormatter={(l) => bucketLabel(l, gran)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="ventas" name="Ventas" fill="#2ecc71" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastos" name="Gastos" fill="#e25c5c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      ) : (
        <EmptyState text="Registra tu primera venta en 'Punto de venta' para ver el tablero cobrar vida." />
      )}

      <TopVendidos sales={sales} />
    </div>
  );
}

/* ---------- Top 5 piezas más vendidas (independiente, por día/semana/mes) ---------- */
function TopVendidos({ sales }) {
  const [period, setPeriod] = useState("mes"); // hoy | semana | mes
  const inPeriod = (dateStr) => {
    if (period === "hoy") return dateStr.slice(0, 10) === todayStr();
    if (period === "semana") return weekStart(dateStr) === weekStart(todayStr());
    return dateStr.slice(0, 7) === todayStr().slice(0, 7); // mes
  };
  const periodLabel = { hoy: "hoy", semana: "esta semana", mes: "este mes" }[period];

  const top = useMemo(() => {
    const map = {};
    for (const s of sales) {
      if (!inPeriod(s.date)) continue;
      for (const it of s.items) {
        if (!map[it.name]) map[it.name] = { name: it.name, qty: 0, revenue: 0 };
        map[it.name].qty += it.qty;
        map[it.name].revenue += it.qty * it.price;
      }
    }
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [sales, period]);

  const maxQty = top[0]?.qty || 1;
  const medal = ["#f2c94c", "#c8c8d0", "#cd8f52"]; // oro, plata, bronce

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <SectionTitle icon={TrendingUp}>Top 5 más vendidas ({periodLabel})</SectionTitle>
        <div style={{ display: "flex", gap: 6 }}>
          {[["hoy", "Hoy"], ["semana", "Semana"], ["mes", "Mes"]].map(([id, label]) => (
            <button key={id} onClick={() => setPeriod(id)} style={{
              padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)",
              background: period === id ? "var(--accent-soft)" : "transparent",
              color: period === id ? "var(--accent)" : "var(--muted)", fontWeight: 700, fontSize: 12
            }}>{label}</button>
          ))}
        </div>
      </div>
      {top.length > 0 ? top.map((p, i) => (
        <div key={p.name} style={{ padding: "9px 0", borderBottom: i < top.length - 1 ? "1px solid var(--border-soft)" : "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginBottom: 6, gap: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
              <span style={{
                flexShrink: 0, width: 20, height: 20, borderRadius: "50%", fontSize: 11, fontWeight: 800,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: i < 3 ? medal[i] : "var(--border-soft)", color: i < 3 ? "#1a1a1a" : "var(--muted)"
              }}>{i + 1}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
            </span>
            <span style={{ color: "var(--muted)", flexShrink: 0, fontWeight: 600 }}>{p.qty} u · {fmt0(p.revenue)}</span>
          </div>
          <div style={{ height: 6, background: "var(--border-soft)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${(p.qty / maxQty) * 100}%`, height: "100%", background: "var(--accent)", borderRadius: 4 }} />
          </div>
        </div>
      )) : <EmptyState text={`Sin ventas ${periodLabel}. Cambia de periodo o registra una venta.`} />}
    </Card>
  );
}

/* ---------- Inventario ---------- */
const emptyPart = () => ({ sku: "", name: "", brand: "", category: PART_CATS[0], compat: "", stock: "", minStock: "", cost: "", price: "" });

function Inventario({ parts, setParts, showToast, defaultMin = 0 }) {
  const [form, setForm] = useState(emptyPart());
  const [editId, setEditId] = useState(null);
  const [q, setQ] = useState("");
  const [wipeStep, setWipeStep] = useState(0); // 0 = oculto, 1 = primera confirmación, 2 = segunda confirmación

  const wipeAll = () => {
    setParts([]);
    setEditId(null);
    setForm(emptyPart());
    setWipeStep(0);
    showToast("Inventario vaciado");
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return parts;
    return parts.filter(p =>
      [p.name, p.sku, p.brand, p.category, p.compat].filter(Boolean).some(v => v.toLowerCase().includes(s))
    );
  }, [parts, q]);

  const save = () => {
    if (!form.name.trim()) return showToast("Ponle nombre a la refacción");
    const part = {
      ...form,
      name: form.name.trim(),
      stock: Math.max(0, parseInt(form.stock) || 0),
      minStock: String(form.minStock).trim() !== "" ? Math.max(0, parseInt(form.minStock) || 0) : defaultMin,
      cost: Math.max(0, parseFloat(form.cost) || 0),
      price: Math.max(0, parseFloat(form.price) || 0),
    };
    if (editId) {
      setParts(prev => prev.map(p => p.id === editId ? { ...p, ...part } : p));
      showToast("Refacción actualizada");
    } else {
      setParts(prev => [{ id: uid(), ...part }, ...prev]);
      showToast("Refacción agregada");
    }
    setForm(emptyPart());
    setEditId(null);
  };

  const startEdit = (p) => {
    setEditId(p.id);
    setForm({ sku: p.sku || "", name: p.name, brand: p.brand || "", category: p.category, compat: p.compat || "", stock: p.stock, minStock: p.minStock, cost: p.cost, price: p.price });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const del = (id) => { setParts(prev => prev.filter(p => p.id !== id)); if (editId === id) { setEditId(null); setForm(emptyPart()); } };

  const adjustStock = (id, delta) => setParts(prev => prev.map(p => p.id === id ? { ...p, stock: Math.max(0, (Number(p.stock) || 0) + delta) } : p));

  const exportCSV = () => {
    const csv = Papa.unparse(parts.map(p => ({
      sku: p.sku, nombre: p.name, marca: p.brand, categoria: p.category, compatibilidad: p.compat,
      stock: p.stock, minimo: p.minStock, costo: p.cost, precio: p.price
    })));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "inventario.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const importCSV = (file) => {
    // normaliza encabezados/valores: sin acentos, minúsculas, solo letras y números
    const norm = (s) => (s == null ? "" : s.toString()).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const parseNum = (v) => {
      let s = String(v == null ? "" : v).replace(/[^\d.,-]/g, "").trim();
      if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, "");   // 1,234.56 -> 1234.56
      else if (s.includes(",")) s = s.replace(",", ".");                  // 1234,56 -> 1234.56
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    };
    const SYN = {
      name: ["nombre", "name", "producto", "descripcion", "descripciondelproducto", "nombredelproducto", "nombreproducto", "refaccion", "pieza", "articulo", "item"],
      sku: ["sku", "codigo", "code", "clave", "noparte", "numeroparte", "partno", "nodeparte"],
      brand: ["marca", "brand", "fabricante"],
      category: ["categoria", "category", "tipo", "linea"],
      compat: ["compatibilidad", "compat", "modelo", "aplicacion", "moto", "compatible"],
      stock: ["stock", "cantidad", "existencia", "existencias", "qty", "piezas", "cant", "cantidaddisponible", "enexistencia"],
      minStock: ["minimo", "min", "stockminimo", "minstock", "minimostock"],
      cost: ["costo", "cost", "compra", "costounitario", "preciocompra", "preciodecompra", "costodecompra"],
      price: ["precio", "price", "venta", "precioventa", "preciodeventa", "pventa", "precioventaunitario", "pvp", "preciopublico"],
    };
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      delimitersToGuess: [",", ";", "\t", "|"],
      transformHeader: (h) => norm(h),
      complete: (res) => {
        const rows = res.data || [];
        const pick = (r, key) => { for (const c of SYN[key]) if (r[c] != null && r[c] !== "") return r[c]; return ""; };
        const added = [];
        for (const r of rows) {
          const name = pick(r, "name").toString().trim();
          if (!name) continue;
          const catRaw = pick(r, "category").toString().trim();
          const cat = PART_CATS.find(c => norm(c) === norm(catRaw)) || (catRaw ? "Otro" : PART_CATS[PART_CATS.length - 1]);
          const minRaw = pick(r, "minStock");
          added.push({
            id: uid(),
            sku: pick(r, "sku").toString(),
            name,
            brand: pick(r, "brand").toString(),
            category: cat,
            compat: pick(r, "compat").toString(),
            stock: Math.max(0, Math.round(parseNum(pick(r, "stock")))),
            minStock: minRaw !== "" ? Math.max(0, Math.round(parseNum(minRaw))) : defaultMin,
            cost: Math.max(0, parseNum(pick(r, "cost"))),
            price: Math.max(0, parseNum(pick(r, "price"))),
          });
        }
        if (!added.length) {
          const cols = Object.keys(rows[0] || {}).filter(Boolean).join(", ") || "ninguna";
          return showToast(`No encontré la columna de "nombre". Columnas detectadas: ${cols}`);
        }
        setParts(prev => [...added, ...prev]);
        showToast(`${added.length} refacciones importadas`);
      },
      error: () => showToast("No pude leer el archivo"),
    });
  };

  return (
    <div>
      <Card style={{ marginBottom: 18 }}>
        <SectionTitle icon={editId ? Pencil : Plus}>{editId ? "Editar refacción" : "Agregar refacción"}</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 8 }}>
          <input placeholder="Nombre *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input placeholder="SKU / código" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} />
          <input placeholder="Marca (ej. Italika)" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} />
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {PART_CATS.map(c => <option key={c}>{c}</option>)}
          </select>
          <input placeholder="Compatibilidad (ej. FT150, DM200)" value={form.compat} onChange={e => setForm(f => ({ ...f, compat: e.target.value }))} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 10 }}>
          <div><label style={lbl}>Stock</label><input type="number" placeholder="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} style={{ width: "100%" }} /></div>
          <div><label style={lbl}>Stock mínimo</label><input type="number" placeholder={`Por defecto: ${defaultMin}`} value={form.minStock} onChange={e => setForm(f => ({ ...f, minStock: e.target.value }))} style={{ width: "100%" }} /></div>
          <div><label style={lbl}>Costo unitario</label><input type="number" placeholder="0" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} style={{ width: "100%" }} /></div>
          <div><label style={lbl}>Precio de venta</label><input type="number" placeholder="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} style={{ width: "100%" }} /></div>
        </div>
        {form.cost && form.price && (
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
            Margen por pieza: <span style={{ color: "#2ecc71", fontWeight: 600 }}>{fmt(parseFloat(form.price) - parseFloat(form.cost))}</span>
            {parseFloat(form.price) > 0 && ` (${Math.round(((form.price - form.cost) / form.price) * 100)}%)`}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={save} style={btnGold}>
            <Check size={15} /> {editId ? "Guardar cambios" : "Agregar al inventario"}
          </button>
          {editId && <button onClick={() => { setEditId(null); setForm(emptyPart()); }} style={btnGhost}><X size={15} /> Cancelar</button>}
          <label style={{ ...btnGhost, cursor: "pointer" }}>
            <Upload size={15} /> Importar CSV
            <input type="file" accept=".csv" hidden onChange={e => e.target.files[0] && importCSV(e.target.files[0])} />
          </label>
          {parts.length > 0 && <button onClick={exportCSV} style={btnGhost}><Upload size={15} style={{ transform: "rotate(180deg)" }} /> Exportar CSV</button>}
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <SectionTitle icon={Package}>Inventario ({parts.length})</SectionTitle>
          <div style={{ flex: 1 }} />
          <div style={{ position: "relative" }}>
            <Search size={14} color="var(--muted-2)" style={{ position: "absolute", left: 10, top: 11 }} />
            <input placeholder="Buscar pieza, marca, moto…" value={q} onChange={e => setQ(e.target.value)} style={{ paddingLeft: 30, width: 240 }} />
          </div>
          {parts.length > 0 && (
            <button onClick={() => setWipeStep(1)} style={btnDanger} title="Eliminar todo el inventario">
              <Trash2 size={15} /> Vaciar inventario
            </button>
          )}
        </div>

        {wipeStep > 0 && (
          <div className="no-print" onClick={() => setWipeStep(0)}
            style={{ position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 60 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ width: 380, maxWidth: "100%", background: "var(--card)", border: "1px solid #e25c5c", borderRadius: 14, padding: 22 }}>
              <div className="sg" style={{ fontSize: 16, fontWeight: 700, color: "#e25c5c", display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <AlertTriangle size={18} /> {wipeStep === 1 ? "¿Eliminar todo el inventario?" : "Confirma de nuevo"}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 18, lineHeight: 1.5 }}>
                {wipeStep === 1
                  ? `Vas a borrar las ${parts.length} refacciones del inventario. Esta acción no se puede deshacer.`
                  : "Última oportunidad: pulsa \"Sí, borrar todo\" solo si de verdad quieres vaciar el inventario completo."}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setWipeStep(0)} style={{ ...btnGhost, flex: 1, justifyContent: "center" }}>
                  <X size={15} /> Cancelar
                </button>
                {wipeStep === 1 ? (
                  <button onClick={() => setWipeStep(2)} style={{ ...btnDanger, flex: 1, justifyContent: "center" }}>
                    Sí, continuar
                  </button>
                ) : (
                  <button onClick={wipeAll} style={{ ...btnDanger, flex: 1, justifyContent: "center" }}>
                    <Trash2 size={15} /> Sí, borrar todo
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {filtered.length === 0 ? (
          <EmptyState text={parts.length === 0 ? "Aún no hay refacciones. Agrega la primera arriba o importa un CSV." : "Sin resultados para tu búsqueda."} />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Refacción</th><th>Categoría</th><th>Compatibilidad</th>
                  <th style={{ textAlign: "right" }}>Stock</th><th style={{ textAlign: "right" }}>Costo</th>
                  <th style={{ textAlign: "right" }}>Precio</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const status = stockStatus(p);
                  const low = status !== "ok";
                  const stColor = STATUS_META[status].color;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: "var(--muted-2)" }}>{[p.brand, p.sku].filter(Boolean).join(" · ") || "—"}</div>
                      </td>
                      <td style={{ color: "var(--muted)" }}>{p.category}</td>
                      <td style={{ color: "var(--muted)" }}>{p.compat || "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                          <button onClick={() => adjustStock(p.id, -1)} style={stepBtn}>−</button>
                          <span style={{ fontWeight: 700, minWidth: 28, textAlign: "center", color: low ? stColor : "var(--text)" }}>{p.stock}</span>
                          <button onClick={() => adjustStock(p.id, +1)} style={stepBtn}>+</button>
                        </div>
                        {low && <div style={{ fontSize: 10, color: stColor }}>{STATUS_META[status].label} · mín {p.minStock}</div>}
                      </td>
                      <td style={{ textAlign: "right", color: "var(--muted)" }}>{fmt(p.cost)}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(p.price)}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button onClick={() => startEdit(p)} style={iconBtn}><Pencil size={14} /></button>
                        <button onClick={() => del(p.id)} style={iconBtn}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- Punto de venta ---------- */
function PuntoDeVenta({ parts, setParts, sales, setSales, showToast, onTicket }) {
  const [cart, setCart] = useState([]); // {partId, name, sku, qty, price, cost, maxStock}
  const [q, setQ] = useState("");
  const [customer, setCustomer] = useState("");

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return parts.filter(p =>
      [p.name, p.sku, p.brand, p.compat].filter(Boolean).some(v => v.toLowerCase().includes(s))
    ).slice(0, 8);
  }, [parts, q]);

  const addToCart = (p) => {
    if ((Number(p.stock) || 0) <= 0) return showToast("Sin stock de esa pieza");
    setCart(prev => {
      const ex = prev.find(i => i.partId === p.id);
      if (ex) {
        if (ex.qty >= p.stock) { showToast("No hay más stock"); return prev; }
        return prev.map(i => i.partId === p.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { partId: p.id, name: p.name, sku: p.sku, qty: 1, price: Number(p.price) || 0, cost: Number(p.cost) || 0, maxStock: Number(p.stock) || 0 }];
    });
    setQ("");
  };

  const setQty = (partId, qty) => setCart(prev => prev.map(i => i.partId === partId ? { ...i, qty: Math.max(1, Math.min(i.maxStock, parseInt(qty) || 1)) } : i));
  const setLinePrice = (partId, price) => setCart(prev => prev.map(i => i.partId === partId ? { ...i, price: Math.max(0, parseFloat(price) || 0) } : i));
  const removeLine = (partId) => setCart(prev => prev.filter(i => i.partId !== partId));

  const total = cart.reduce((a, i) => a + i.qty * i.price, 0);
  const cogs = cart.reduce((a, i) => a + i.qty * i.cost, 0);
  const profit = total - cogs;

  const checkout = () => {
    if (cart.length === 0) return showToast("Agrega piezas a la venta");
    // Validate stock still available
    for (const i of cart) {
      const p = parts.find(p => p.id === i.partId);
      if (!p || (Number(p.stock) || 0) < i.qty) return showToast(`Stock insuficiente de ${i.name}`);
    }
    const nextFolio = sales.reduce((m, s) => Math.max(m, s.folio || 0), 0) + 1;
    const sale = {
      id: uid(),
      folio: nextFolio,
      date: todayStr(),
      time: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
      customer: customer.trim(),
      items: cart.map(({ partId, name, sku, qty, price, cost }) => ({ partId, name, sku, qty, price, cost })),
      total, cogs, profit,
    };
    setSales(prev => [sale, ...prev]);
    setParts(prev => prev.map(p => {
      const line = cart.find(i => i.partId === p.id);
      return line ? { ...p, stock: Math.max(0, (Number(p.stock) || 0) - line.qty) } : p;
    }));
    setCart([]); setCustomer("");
    // Aviso si alguna pieza quedó en su mínimo (o agotada) tras esta venta
    const lowAfter = [];
    for (const i of cart) {
      const p = parts.find(p => p.id === i.partId);
      if (!p) continue;
      const after = (Number(p.stock) || 0) - i.qty;
      if (after <= (Number(p.minStock) || 0)) lowAfter.push(`${p.name} (${after})`);
    }
    const warn = lowAfter.length ? ` · ⚠️ En mínimo: ${lowAfter.slice(0, 2).join(", ")}${lowAfter.length > 2 ? ` +${lowAfter.length - 2}` : ""}` : "";
    showToast(`Venta #${nextFolio} registrada: ${fmt(total)} (utilidad ${fmt(profit)})${warn}`);
    onTicket && onTicket(sale);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 18, alignItems: "start" }}>
      <Card>
        <SectionTitle icon={Search}>Buscar refacción</SectionTitle>
        <input autoFocus placeholder="Escribe nombre, SKU o modelo de moto…" value={q} onChange={e => setQ(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        {results.map(p => (
          <div key={p.id} onClick={() => addToCart(p)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 8px", borderRadius: 8, cursor: "pointer", borderBottom: "1px solid var(--border-soft)" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: "var(--muted-2)" }}>{[p.brand, p.compat].filter(Boolean).join(" · ") || p.sku || "—"} · {p.stock} en stock</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{fmt(p.price)}</span>
              <Plus size={16} color="var(--accent)" />
            </div>
          </div>
        ))}
        {q && results.length === 0 && <div style={{ fontSize: 12, color: "var(--muted-2)", padding: "8px 4px" }}>Sin coincidencias.</div>}

        <SectionTitle icon={ShoppingCart} >{""}</SectionTitle>
        <div className="sg" style={{ fontSize: 13, fontWeight: 700, margin: "8px 0", color: "var(--muted)" }}>Ventas recientes</div>
        {sales.length === 0 && <EmptyState text="Aún no hay ventas." />}
        <div style={{ maxHeight: 220, overflowY: "auto" }}>
          {sales.slice(0, 12).map(s => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--border-soft)", fontSize: 12 }}>
              <span style={{ color: "var(--muted)" }}>{s.folio ? `#${s.folio} · ` : ""}{s.date} · {s.items.reduce((a, i) => a + i.qty, 0)} pza{s.customer ? ` · ${s.customer}` : ""}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 600 }}>{fmt(s.total)} <span style={{ color: "#2ecc71", fontWeight: 500 }}>(+{fmt0(s.profit)})</span></span>
                <button onClick={() => onTicket && onTicket(s)} style={iconBtn} title="Imprimir ticket"><Printer size={14} /></button>
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle icon={ShoppingCart}>Venta actual</SectionTitle>
        {cart.length === 0 ? (
          <EmptyState text="Busca y toca refacciones para agregarlas a la venta." />
        ) : (
          <>
            {cart.map(i => (
              <div key={i.partId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--border-soft)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-2)" }}>máx {i.maxStock}</div>
                </div>
                <input type="number" value={i.qty} onChange={e => setQty(i.partId, e.target.value)} style={{ width: 56 }} title="Cantidad" />
                <span style={{ color: "var(--muted-2)" }}>×</span>
                <input type="number" value={i.price} onChange={e => setLinePrice(i.partId, e.target.value)} style={{ width: 84 }} title="Precio unitario" />
                <span style={{ fontWeight: 600, fontSize: 13, minWidth: 70, textAlign: "right" }}>{fmt0(i.qty * i.price)}</span>
                <button onClick={() => removeLine(i.partId)} style={iconBtn}><Trash2 size={14} /></button>
              </div>
            ))}
            <input placeholder="Cliente (opcional)" value={customer} onChange={e => setCustomer(e.target.value)} style={{ width: "100%", marginTop: 12 }} />
            <div style={{ marginTop: 12, padding: "12px 0", borderTop: "1px solid var(--border)" }}>
              <Row label="Total" value={fmt(total)} big />
              <Row label="Costo de mercancía" value={fmt(cogs)} muted />
              <Row label="Utilidad de esta venta" value={fmt(profit)} color="#2ecc71" />
            </div>
            <button onClick={checkout} style={{ ...btnGold, width: "100%", justifyContent: "center", marginTop: 8 }}>
              <Check size={16} /> Cobrar y descontar de inventario
            </button>
          </>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value, big, muted, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "3px 0" }}>
      <span style={{ fontSize: big ? 14 : 12, color: muted ? "var(--muted-2)" : "var(--muted)", fontWeight: big ? 700 : 500 }}>{label}</span>
      <span className={big ? "sg" : ""} style={{ fontSize: big ? 20 : 13, fontWeight: 700, color: color || (big ? "var(--text)" : "var(--text)") }}>{value}</span>
    </div>
  );
}

/* ---------- Gastos ---------- */
function Gastos({ expenses, setExpenses, showToast }) {
  const [form, setForm] = useState({ category: EXPENSE_CATS[0], amount: "", note: "", date: todayStr() });

  const add = () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) return showToast("Pon un monto válido");
    setExpenses(prev => [{ id: uid(), ...form, amount }, ...prev]);
    setForm(f => ({ ...f, amount: "", note: "" }));
    showToast("Gasto registrado");
  };
  const del = (id) => setExpenses(prev => prev.filter(e => e.id !== id));

  return (
    <div>
      <Card style={{ marginBottom: 18 }}>
        <SectionTitle icon={Receipt}>Registrar gasto del negocio</SectionTitle>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
          Renta, luz, sueldos, compra de mercancía a proveedores, etc. (El costo de las piezas vendidas ya se calcula solo en cada venta.)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 10 }}>
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
          </select>
          <input type="number" placeholder="Monto" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          <input placeholder="Nota (opcional)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
        </div>
        <button onClick={add} style={btnGold}><Plus size={15} /> Agregar gasto</button>
      </Card>

      <Card>
        <SectionTitle icon={Wallet}>Historial de gastos ({expenses.length})</SectionTitle>
        {expenses.length === 0 && <EmptyState text="Aún no hay gastos registrados." />}
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {expenses.map(e => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid var(--border-soft)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{e.category}{e.note ? ` · ${e.note}` : ""}</div>
                <div style={{ fontSize: 11, color: "var(--muted-2)" }}>{e.date}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: "#e25c5c" }}>−{fmt(e.amount)}</span>
                <button onClick={() => del(e.id)} style={iconBtn}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------- Contabilidad ---------- */
function Contabilidad({ sales, expenses }) {
  const [period, setPeriod] = useState("mes"); // mes | todo
  const [gran, setGran] = useState("month"); // day | week | month

  const inPeriod = (dateStr) => {
    if (period === "todo") return true;
    if (period === "hoy") return dateStr.slice(0, 10) === todayStr();
    if (period === "semana") return weekStart(dateStr) === weekStart(todayStr());
    return dateStr.slice(0, 7) === todayStr().slice(0, 7); // mes
  };
  const periodLabel = { hoy: "hoy", semana: "esta semana", mes: "este mes", todo: "histórico" }[period];
  const pSales = useMemo(() => sales.filter(s => inPeriod(s.date)), [sales, period]);
  const pExpenses = useMemo(() => expenses.filter(e => inPeriod(e.date)), [expenses, period]);

  const revenue = pSales.reduce((a, s) => a + s.total, 0);
  const cogs = pSales.reduce((a, s) => a + s.cogs, 0);
  const gross = revenue - cogs;
  const opex = pExpenses.reduce((a, e) => a + e.amount, 0);
  const net = gross - opex;
  const margin = revenue > 0 ? Math.round((gross / revenue) * 100) : 0;

  const monthly = useMemo(() => {
    const map = {};
    for (const s of sales) {
      const k = bucketOf(s.date, gran);
      if (!map[k]) map[k] = { k, ingresos: 0, costo: 0, gastos: 0, utilidad: 0 };
      map[k].ingresos += s.total; map[k].costo += s.cogs; map[k].utilidad += s.total - s.cogs;
    }
    for (const e of expenses) {
      const k = bucketOf(e.date, gran);
      if (!map[k]) map[k] = { k, ingresos: 0, costo: 0, gastos: 0, utilidad: 0 };
      map[k].gastos += e.amount; map[k].utilidad -= e.amount;
    }
    return Object.values(map).sort((a, b) => a.k.localeCompare(b.k)).slice(-GRAN_KEEP[gran]);
  }, [sales, expenses, gran]);

  const expenseByCat = useMemo(() => {
    const map = {};
    for (const e of pExpenses) map[e.category] = (map[e.category] || 0) + e.amount;
    return Object.entries(map).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }, [pExpenses]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[["hoy", "Hoy"], ["semana", "Esta semana"], ["mes", "Este mes"], ["todo", "Histórico"]].map(([id, label]) => (
          <button key={id} onClick={() => setPeriod(id)} style={{
            padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)",
            background: period === id ? "var(--accent-soft)" : "transparent", color: period === id ? "var(--accent)" : "var(--muted)",
            fontWeight: 700, fontSize: 13
          }}>{label}</button>
        ))}
      </div>

      <Card style={{ marginBottom: 18 }}>
        <SectionTitle icon={Wallet}>Estado de resultados ({periodLabel})</SectionTitle>
        <Row label="Ventas (ingresos)" value={fmt(revenue)} big />
        <Row label="− Costo de mercancía vendida" value={fmt(cogs)} muted />
        <div style={{ borderTop: "1px solid var(--border)", margin: "6px 0" }} />
        <Row label="= Utilidad bruta" value={fmt(gross)} color="var(--accent)" />
        <Row label={`Margen bruto`} value={`${margin}%`} muted />
        <Row label="− Gastos del negocio" value={fmt(opex)} muted />
        <div style={{ borderTop: "1px solid var(--border)", margin: "6px 0" }} />
        <Row label="= Utilidad neta" value={fmt(net)} big color={net >= 0 ? "#2ecc71" : "#e25c5c"} />
      </Card>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <StatCard label="Ticket promedio" value={fmt0(pSales.length ? revenue / pSales.length : 0)} color="#3fa9f5" icon={ShoppingCart} sub={`${pSales.length} ventas`} />
        <StatCard label="Piezas vendidas" value={pSales.reduce((a, s) => a + s.items.reduce((x, i) => x + i.qty, 0), 0)} color="var(--text)" icon={Package} />
        <StatCard label="Utilidad por venta" value={fmt0(pSales.length ? gross / pSales.length : 0)} color="#2ecc71" icon={DollarSign} />
      </div>

      {monthly.length > 0 && (
        <Card style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <SectionTitle icon={TrendingUp}>Ingresos y utilidad por {gran === "day" ? "día" : gran === "week" ? "semana" : "mes"}</SectionTitle>
            <GranToggle gran={gran} setGran={setGran} />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="k" stroke="var(--muted)" fontSize={11} tickFormatter={(v) => bucketLabel(v, gran)} />
              <YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v) => fmt0(v)} labelFormatter={(l) => bucketLabel(l, gran)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="ingresos" name="Ingresos" stroke="#2ecc71" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="utilidad" name="Utilidad neta" stroke="var(--accent)" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {expenseByCat.length > 0 && (
        <Card>
          <SectionTitle icon={Receipt}>Gastos por categoría</SectionTitle>
          {expenseByCat.map(e => (
            <div key={e.category} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border-soft)", fontSize: 13 }}>
              <span style={{ color: "var(--muted)" }}>{e.category}</span>
              <span style={{ fontWeight: 600, color: "#e25c5c" }}>{fmt(e.amount)}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ---------- Asistente IA (alta masiva de inventario desde texto) ---------- */
const NUMERIC_FIELDS = ["stock", "minStock", "cost", "price"];
const FIELD_LABEL = { name: "nombre", brand: "marca", category: "categoría", compat: "compatibilidad", stock: "stock", minStock: "mínimo", cost: "costo", price: "precio" };
const MONEY_FIELDS = new Set(["cost", "price"]);
const sanitizeField = (field, val) =>
  NUMERIC_FIELDS.includes(field) ? Math.max(0, (field === "stock" || field === "minStock" ? parseInt(val) : parseFloat(val)) || 0) : String(val ?? "");
const showVal = (field, v) => MONEY_FIELDS.has(field) ? fmt(v) : String(v);

function Asistente({ parts, setParts, showToast, defaultMin = 0 }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [fileBusy, setFileBusy] = useState(false);

  const importFile = async (file) => {
    if (!file) return;
    setError(null); setPreview(null); setFileBusy(true);
    try {
      let content = (await extractTextFromFile(file) || "").trim();
      if (!content) {
        setError("No pude leer texto del archivo. Si es un PDF escaneado (imagen), no contiene texto.");
        return;
      }
      if (content.length > 24000) content = content.slice(0, 24000);
      const instruction = `Da de alta en el inventario las refacciones de este documento (puede ser una factura del proveedor, una lista, o un XML CFDI del SAT). Por cada concepto o renglón: usa la descripción como "name", la cantidad como "stock", y el valor/precio unitario como "cost". Si no hay precio de venta, estima "price" como el costo más 40%. Ignora subtotales, impuestos (IVA), totales y datos del emisor/receptor. Documento:\n\n${content}`;
      setText(`📄 Archivo: ${file.name}`);
      await ask(instruction);
    } catch (e) {
      setError("No pude procesar el archivo. Prueba con CSV, XML o un PDF con texto.");
    } finally {
      setFileBusy(false);
    }
  };

  const ask = async (override) => {
    const instruction = typeof override === "string" ? override : text;
    if (!instruction.trim()) return;
    setLoading(true); setError(null); setPreview(null);
    // Snapshot del inventario con un 'ref' para que la IA pueda apuntar a piezas existentes
    const refList = parts.map((p, i) => ({
      ref: i, name: p.name, brand: p.brand || "", compat: p.compat || "",
      category: p.category, stock: Number(p.stock) || 0, cost: Number(p.cost) || 0, price: Number(p.price) || 0,
    }));
    try {
      const SYSTEM = "Eres asistente del inventario de una refaccionaria de motos. Recibes (1) el INVENTARIO ACTUAL como arreglo JSON (cada pieza tiene 'ref' numérico, name, brand, compat, category, stock, cost, price) y (2) una INSTRUCCIÓN del usuario en español. Devuelve SOLO un objeto JSON con la forma {\"operations\": [ ... ]}, sin texto adicional, sin markdown. Cada elemento de 'operations' es una operación:\n- Crear pieza nueva: {\"op\":\"create\",\"name\":string,\"brand\":string,\"category\":string,\"compat\":string,\"stock\":number,\"cost\":number,\"price\":number}\n- Modificar una pieza existente: {\"op\":\"update\",\"ref\":number,\"set\":{campo:valor,...}} donde campo ∈ name,brand,category,compat,stock,minStock,cost,price. Incluye en 'set' SOLO los campos que cambian, con su valor FINAL ya calculado.\n- Reabastecer (sumar al stock): {\"op\":\"restock\",\"ref\":number,\"add\":number,\"cost\":number(opcional),\"price\":number(opcional)}\n- Eliminar pieza: {\"op\":\"delete\",\"ref\":number}\nReglas: 'category' debe ser una de: Motor, Frenos, Suspensión, Eléctrico, Transmisión, Llantas y cámaras, Aceites y lubricantes, Carrocería, Accesorios, Otro. Si el usuario pide algo relativo (ej. 'sube 10% el precio', 'baja 20 pesos', 'duplica el stock') CALCULA tú el número final usando el valor actual del inventario. Una instrucción puede afectar a varias piezas (ej. 'sube 10% todos los aceites' => varias operaciones update). Si llega mercancía de una pieza que YA existe, usa 'restock'; si es pieza nueva, 'create'; si solo cambian datos de una pieza existente, 'update'. Para identificar la pieza usa name/brand/compat del inventario. Si no estás seguro de a qué pieza se refiere, omítela en lugar de adivinar.";
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${_session?.access_token || ""}` },
        body: JSON.stringify({ system: SYSTEM, user: `INVENTARIO ACTUAL:\n${JSON.stringify(refList)}\n\nINSTRUCCIÓN:\n${instruction}` }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "No se pudo procesar. Revisa que la IA esté configurada en Vercel."); return; }
      const clean = (data.text || "").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const ops = Array.isArray(parsed) ? parsed : (parsed.operations || parsed.ops || parsed.items || []);
      if (!Array.isArray(ops) || ops.length === 0) {
        setError("No entendí ninguna acción clara. Sé más específico (qué pieza y qué cambio).");
        return;
      }
      const built = ops.map(o => {
        const base = { id: uid(), include: true, op: o.op };
        if (o.op === "create") {
          return {
            ...base, op: "create", target: null,
            fields: {
              name: (o.name || "Refacción").toString(),
              brand: (o.brand || "").toString(),
              category: PART_CATS.includes(o.category) ? o.category : "Otro",
              compat: (o.compat || "").toString(),
              stock: sanitizeField("stock", o.stock),
              cost: sanitizeField("cost", o.cost),
              price: sanitizeField("price", o.price),
            },
          };
        }
        const part = parts[o.ref];
        if (!part) return null;
        if (o.op === "delete") return { ...base, target: part, before: part };
        if (o.op === "restock") {
          const extra = {};
          if (o.cost != null) extra.cost = sanitizeField("cost", o.cost);
          if (o.price != null) extra.price = sanitizeField("price", o.price);
          return { ...base, target: part, before: part, add: Math.max(0, parseInt(o.add) || 0), extra };
        }
        if (o.op === "update") {
          const set = {};
          for (const [k, v] of Object.entries(o.set || {})) {
            if (!(k in FIELD_LABEL)) continue;
            if (k === "category" && !PART_CATS.includes(v)) continue;
            set[k] = sanitizeField(k, v);
          }
          if (Object.keys(set).length === 0) return null;
          return { ...base, target: part, before: part, set };
        }
        return null;
      }).filter(Boolean);
      if (built.length === 0) {
        setError("No pude relacionar la instrucción con tu inventario. Revisa el nombre de la pieza.");
        return;
      }
      setPreview(built);
    } catch (e) {
      setError("No pude procesar eso. Intenta de nuevo o sé más específico.");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id) => setPreview(prev => prev.map(p => p.id === id ? { ...p, include: !p.include } : p));
  const updField = (id, field, val) => setPreview(prev => prev.map(p => p.id === id ? { ...p, fields: { ...p.fields, [field]: sanitizeField(field, val) } } : p));
  const updSet = (id, field, val) => setPreview(prev => prev.map(p => p.id === id ? { ...p, set: { ...p.set, [field]: sanitizeField(field, val) } } : p));
  const updAdd = (id, val) => setPreview(prev => prev.map(p => p.id === id ? { ...p, add: Math.max(0, parseInt(val) || 0) } : p));

  const confirm = () => {
    const items = preview.filter(p => p.include);
    let created = 0, updated = 0, restocked = 0, deleted = 0;
    setParts(prev => {
      let next = [...prev];
      for (const it of items) {
        if (it.op === "create") { next.unshift({ id: uid(), sku: "", minStock: defaultMin, ...it.fields }); created++; }
        else if (it.op === "delete") { next = next.filter(p => p.id !== it.target.id); deleted++; }
        else if (it.op === "restock") { next = next.map(p => p.id === it.target.id ? { ...p, stock: (Number(p.stock) || 0) + (Number(it.add) || 0), ...it.extra } : p); restocked++; }
        else if (it.op === "update") { next = next.map(p => p.id === it.target.id ? { ...p, ...it.set } : p); updated++; }
      }
      return next;
    });
    setPreview(null); setText("");
    const parts2 = [];
    if (created) parts2.push(`${created} nueva${created > 1 ? "s" : ""}`);
    if (updated) parts2.push(`${updated} modificada${updated > 1 ? "s" : ""}`);
    if (restocked) parts2.push(`${restocked} reabastecida${restocked > 1 ? "s" : ""}`);
    if (deleted) parts2.push(`${deleted} eliminada${deleted > 1 ? "s" : ""}`);
    showToast(parts2.join(" · ") || "Sin cambios");
  };

  return (
    <div>
      <Card style={{ marginBottom: 18 }}>
        <SectionTitle icon={Sparkles}>Asistente de inventario</SectionTitle>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
          La IA ya conoce tu inventario actual ({parts.length} piezas). Pídele en español lo que necesites: dar de alta, reabastecer, cambiar precios/stock o eliminar. Siempre muestra una vista previa antes de aplicar.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {[
            "Llegaron 10 balatas FT150 a $80, las vendo en $130",
            "Sube 10% el precio de todos los aceites",
            "Cambia el stock de bujías NGK a 8",
            "Elimina los kits de arrastre DM200",
          ].map(ex => (
            <button key={ex} onClick={() => setText(ex)} style={{ ...chip }}>{ex}</button>
          ))}
        </div>
        <textarea
          value={text} onChange={e => setText(e.target.value)}
          placeholder="Ej: Sube 15 pesos a todas las balatas y baja el precio del aceite 20w50 a $85. También llegaron 5 bujías NGK a $45."
          rows={4}
          style={{ width: "100%", resize: "vertical", fontFamily: "inherit", marginBottom: 10 }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => ask()} disabled={loading || fileBusy || !text.trim()} style={{ ...btnGold, background: (loading || fileBusy) ? "var(--border)" : "var(--accent)", color: (loading || fileBusy) ? "var(--muted)" : "#0c1118" }}>
            {loading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
            {loading ? "Pensando…" : "Pedir a la IA"}
          </button>
          <span style={{ fontSize: 12, color: "var(--muted-2)" }}>o</span>
          <label style={{ ...btnGhost, cursor: (loading || fileBusy) ? "default" : "pointer", opacity: (loading || fileBusy) ? 0.6 : 1 }} title="Sube una factura, lista CSV, XML del SAT (CFDI) o PDF">
            {fileBusy ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
            {fileBusy ? "Leyendo archivo…" : "Importar factura / CSV / XML / PDF"}
            <input type="file" accept=".csv,.xml,.pdf,.txt,text/csv,text/xml,application/xml,application/pdf,text/plain" hidden disabled={loading || fileBusy}
              onChange={e => { const f = e.target.files[0]; e.target.value = ""; if (f) importFile(f); }} />
          </label>
        </div>
        <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 8 }}>
          El importador lee facturas de proveedor (incluyendo XML CFDI del SAT), listas CSV y PDFs con texto, y saca las refacciones para que las revises.
        </div>
        {error && <div style={{ color: "#e25c5c", fontSize: 12, marginTop: 10 }}>{error}</div>}
      </Card>

      {preview && (
        <Card style={{ marginBottom: 18, border: "1px solid var(--accent)" }}>
          <SectionTitle icon={Check}>Cambios propuestos — revisa y confirma</SectionTitle>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>Destilda lo que no quieras aplicar, o ajusta los valores.</div>
          {preview.map(it => (
            <div key={it.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border-soft)", opacity: it.include ? 1 : 0.45 }}>
              <input type="checkbox" checked={it.include} onChange={() => toggle(it.id)} style={{ width: 16, height: 16, marginTop: 3 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <OpBadge op={it.op} />
                {it.op === "create" && (
                  <div style={{ marginTop: 6 }}>
                    <input value={it.fields.name} onChange={e => updField(it.id, "name", e.target.value)} style={{ width: 180, padding: "5px 7px", marginRight: 6 }} />
                    <input value={it.fields.compat} placeholder="moto" onChange={e => updField(it.id, "compat", e.target.value)} style={{ width: 80, padding: "5px 7px", marginRight: 6 }} />
                    <span style={miniLbl}>cant.</span><input type="number" value={it.fields.stock} onChange={e => updField(it.id, "stock", e.target.value)} style={miniNum} />
                    <span style={miniLbl}>costo</span><input type="number" value={it.fields.cost} onChange={e => updField(it.id, "cost", e.target.value)} style={miniNum} />
                    <span style={miniLbl}>precio</span><input type="number" value={it.fields.price} onChange={e => updField(it.id, "price", e.target.value)} style={miniNum} />
                  </div>
                )}
                {it.op === "update" && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{it.before.name}{it.before.compat ? ` · ${it.before.compat}` : ""}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 4 }}>
                      {Object.entries(it.set).map(([f, v]) => (
                        <div key={f} style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
                          <span>{FIELD_LABEL[f]}:</span>
                          <span style={{ textDecoration: "line-through", color: "var(--muted-2)" }}>{showVal(f, it.before[f])}</span>
                          <span style={{ color: "var(--muted-2)" }}>→</span>
                          {NUMERIC_FIELDS.includes(f)
                            ? <input type="number" value={v} onChange={e => updSet(it.id, f, e.target.value)} style={{ ...miniNum, width: 74 }} />
                            : <input value={v} onChange={e => updSet(it.id, f, e.target.value)} style={{ width: 110, padding: "4px 6px" }} />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {it.op === "restock" && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{it.before.name}{it.before.compat ? ` · ${it.before.compat}` : ""}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                      stock {it.before.stock} <span style={{ color: "var(--muted-2)" }}>+</span>
                      <input type="number" value={it.add} onChange={e => updAdd(it.id, e.target.value)} style={{ ...miniNum, width: 64 }} />
                      <span style={{ color: "var(--muted-2)" }}>→</span> <span style={{ color: "#2ecc71", fontWeight: 600 }}>{(Number(it.before.stock) || 0) + (Number(it.add) || 0)}</span>
                      {it.extra && it.extra.cost != null && <span>· costo → {fmt(it.extra.cost)}</span>}
                      {it.extra && it.extra.price != null && <span>· precio → {fmt(it.extra.price)}</span>}
                    </div>
                  </div>
                )}
                {it.op === "delete" && (
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: "#e25c5c" }}>
                    {it.before.name}{it.before.compat ? ` · ${it.before.compat}` : ""} <span style={{ color: "var(--muted)", fontWeight: 400 }}>({it.before.stock} u)</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={confirm} style={{ ...btnGold, flex: 1, justifyContent: "center" }}><Check size={15} /> Aplicar cambios</button>
            <button onClick={() => setPreview(null)} style={{ ...btnGhost, flex: 1, justifyContent: "center" }}><X size={15} /> Cancelar</button>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle icon={Package}>Inventario actual ({parts.length})</SectionTitle>
        {parts.length === 0 ? <EmptyState text="Usa el asistente arriba para cargar tu inventario de golpe." /> :
          parts.slice(0, 10).map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border-soft)", fontSize: 13 }}>
              <span>{p.name} <span style={{ color: "var(--muted-2)" }}>{p.compat ? `· ${p.compat}` : ""}</span></span>
              <span style={{ color: "var(--muted)" }}>{p.stock} u · {fmt(p.price)}</span>
            </div>
          ))}
        {parts.length > 10 && <div style={{ fontSize: 12, color: "var(--muted-2)", marginTop: 8 }}>…y {parts.length - 10} más. Mira todo en la pestaña Inventario.</div>}
      </Card>
    </div>
  );
}

function OpBadge({ op }) {
  const map = {
    create: { label: "Nueva", color: "#2ecc71" },
    update: { label: "Modificar", color: "var(--accent)" },
    restock: { label: "Reabastecer", color: "#3fa9f5" },
    delete: { label: "Eliminar", color: "#e25c5c" },
  };
  const m = map[op] || map.update;
  return (
    <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, color: m.color, border: `1px solid ${m.color}`, borderRadius: 6, padding: "1px 7px", textTransform: "uppercase", letterSpacing: 0.4 }}>{m.label}</span>
  );
}

/* ---------- Ticket imprimible ---------- */
/* ---------- Panel de alertas (campana) ---------- */
function AlertsPanel({ alerts, onClose, onReorder, onGoInventory }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 58 }} />
      <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 340, maxWidth: "92vw", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 12px 30px #0008", zIndex: 59 }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <Bell size={15} color="var(--accent)" />
          <span className="sg" style={{ fontSize: 13, fontWeight: 700 }}>Alertas de inventario</span>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)" }}><X size={15} /></button>
        </div>
        <div style={{ maxHeight: 320, overflowY: "auto", padding: "4px 0" }}>
          {alerts.length === 0 ? (
            <div style={{ padding: 22, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Todo en orden ✅<div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 4 }}>Ninguna pieza por agotarse.</div></div>
          ) : alerts.map(p => {
            const m = STATUS_META[p.status];
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px" }}>
                <span style={{ width: 8, height: 8, borderRadius: 8, background: m.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}{p.compat ? ` · ${p.compat}` : ""}</div>
                  <div style={{ fontSize: 11, color: m.color, fontWeight: 600 }}>{m.label} — {p.stock} en stock (mín {p.minStock})</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid var(--border)" }}>
          <button onClick={onReorder} style={{ ...btnGold, flex: 1, justifyContent: "center", padding: "8px 0" }}><ClipboardList size={15} /> Lista de reorden</button>
          <button onClick={onGoInventory} style={{ ...btnGhost, padding: "8px 12px" }}>Inventario</button>
        </div>
      </div>
    </>
  );
}

/* ---------- Lista de reorden (imprimible / exportable) ---------- */
function ReorderModal({ alerts, org, onClose }) {
  const rows = alerts.map(p => ({ ...p, pedir: suggestQty(p) }));
  const exportCSV = () => {
    const csv = Papa.unparse(rows.map(p => ({ nombre: p.name, marca: p.brand, compatibilidad: p.compat, estado: STATUS_META[p.status].label, stock: p.stock, minimo: p.minStock, sugerido_pedir: p.pedir })));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "lista-reorden.csv"; a.click(); URL.revokeObjectURL(url);
  };
  const printList = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const rowsHtml = rows.map(p => `<tr><td>${escapeHtml(p.name)}${p.compat ? " · " + escapeHtml(p.compat) : ""}</td><td>${escapeHtml(STATUS_META[p.status].label)}</td><td style="text-align:right">${p.stock}</td><td style="text-align:right">${p.minStock}</td><td style="text-align:right"><b>${p.pedir}</b></td></tr>`).join("");
    w.document.write(`<html><head><title>Lista de reorden</title><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-size:18px;margin:0 0 2px}.sub{color:#666;font-size:12px;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}th{background:#f3f3f3}</style></head><body><h1>Lista de reorden — ${escapeHtml(org.name)}</h1><div class="sub">Generada el ${todayStr()}</div><table><thead><tr><th>Refacción</th><th>Estado</th><th>Stock</th><th>Mínimo</th><th>Pedir</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };
  return (
    <div className="no-print" onClick={onClose} style={{ position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 24, overflowY: "auto", zIndex: 61 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 620, maxWidth: "100%", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <ClipboardList size={18} color="var(--accent)" />
          <span className="sg" style={{ fontSize: 16, fontWeight: 700 }}>Lista de reorden</span>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)" }}><X size={16} /></button>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>Piezas por reabastecer y cuánto te sugiero pedir para tener colchón.</div>
        {rows.length === 0 ? <EmptyState text="No hay piezas por reabastecer. ✅" /> : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Refacción</th><th>Estado</th><th style={{ textAlign: "right" }}>Stock</th><th style={{ textAlign: "right" }}>Mínimo</th><th style={{ textAlign: "right" }}>Pedir</th></tr></thead>
              <tbody>
                {rows.map(p => (
                  <tr key={p.id}>
                    <td><div style={{ fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 11, color: "var(--muted-2)" }}>{[p.brand, p.compat].filter(Boolean).join(" · ") || "—"}</div></td>
                    <td><span style={{ fontSize: 11, fontWeight: 700, color: STATUS_META[p.status].color }}>{STATUS_META[p.status].label}</span></td>
                    <td style={{ textAlign: "right" }}>{p.stock}</td>
                    <td style={{ textAlign: "right", color: "var(--muted)" }}>{p.minStock}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "var(--accent)" }}>{p.pedir}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={printList} style={btnGold}><Printer size={15} /> Imprimir</button>
            <button onClick={exportCSV} style={btnGhost}><Upload size={15} style={{ transform: "rotate(180deg)" }} /> Exportar CSV</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Ajustes del negocio (editable por el dueño) ---------- */
function ShopSettings({ org, saveOrg, onClose, showToast, applyMinToZero }) {
  const [form, setForm] = useState({ name: org.name, logo: org.logo || "", accent: org.accent || DEFAULT_ACCENT, defaultMin: org.defaultMin || 0, theme: org.theme || "dark" });
  const [applyZero, setApplyZero] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const accent = form.accent || DEFAULT_ACCENT;

  const save = async () => {
    if (!form.name.trim()) return setErr("Ponle un nombre al negocio");
    setBusy(true); setErr(null);
    try {
      const defaultMin = Math.max(0, parseInt(form.defaultMin) || 0);
      await saveOrg({ name: form.name.trim(), logo: form.logo, accent, defaultMin, theme: form.theme });
      if (applyZero && applyMinToZero) applyMinToZero(defaultMin);
      showToast("Negocio actualizado");
      onClose();
    } catch (e) { setErr(e.message || "No se pudo guardar"); }
    finally { setBusy(false); }
  };

  return (
    <div className="no-print" onClick={onClose} style={{ position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 24, overflowY: "auto", zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 460, maxWidth: "100%", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
        <SectionTitle icon={Pencil}>Editar mi negocio</SectionTitle>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ textAlign: "center" }}>
            <label style={{ cursor: "pointer", display: "block" }}>
              <div style={{ width: 90, height: 90, borderRadius: 14, border: "1px dashed var(--dashed)", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {form.logo
                  ? <img src={form.logo} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ textAlign: "center", color: "var(--muted-2)" }}><ImagePlus size={20} /><div style={{ fontSize: 10, marginTop: 4 }}>Subir logo</div></div>}
              </div>
              <input type="file" accept="image/*" hidden onChange={e => e.target.files[0] && fileToLogo(e.target.files[0], d => setForm(f => ({ ...f, logo: d })))} />
            </label>
            {form.logo && <button onClick={() => setForm(f => ({ ...f, logo: "" }))} style={{ ...btnGhost, padding: "4px 10px", fontSize: 11, marginTop: 6 }}>Quitar</button>}
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Nombre del negocio</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ width: "100%", marginBottom: 12 }} />
            <label style={lbl}>Color de la marca</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <input type="color" value={accent} onChange={e => setForm(f => ({ ...f, accent: e.target.value }))} style={{ width: 44, height: 36, padding: 2, cursor: "pointer" }} />
              <div style={{ display: "flex", gap: 6 }}>
                {ACCENT_PRESETS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, accent: c }))} title={c}
                    style={{ width: 22, height: 22, borderRadius: 6, background: c, border: accent.toLowerCase() === c.toLowerCase() ? "2px solid #fff" : "1px solid var(--border)" }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border-soft)" }}>
          <label style={lbl}>Stock mínimo por defecto</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <input type="number" min={0} value={form.defaultMin} onChange={e => setForm(f => ({ ...f, defaultMin: e.target.value }))} style={{ width: 90 }} />
            <span style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 180 }}>
              Se usa cuando agregas piezas por <b>IA</b> o <b>CSV</b> sin indicar mínimo (avisa cuando el stock llega a este número).
            </span>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12, color: "var(--text-2)", cursor: "pointer" }}>
            <input type="checkbox" checked={applyZero} onChange={e => setApplyZero(e.target.checked)} style={{ width: 15, height: 15 }} />
            Aplicarlo también a las piezas que hoy están en mínimo 0
          </label>

          <div style={{ marginTop: 16 }}>
            <label style={lbl}>Tema de la interfaz</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[["dark", "🌙 Oscuro"], ["light", "☀️ Claro"]].map(([id, label]) => (
                <button key={id} onClick={() => setForm(f => ({ ...f, theme: id }))}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 8, fontWeight: 700, fontSize: 13,
                    border: form.theme === id ? "1px solid var(--accent)" : "1px solid var(--border)",
                    background: form.theme === id ? "var(--accent-soft)" : "transparent",
                    color: form.theme === id ? "var(--accent)" : "var(--muted)",
                  }}>{label}</button>
              ))}
            </div>
          </div>
        </div>

        {err && <div style={{ color: "#e25c5c", fontSize: 12, marginTop: 10 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={save} disabled={busy} style={{ ...btnGold, flex: 1, justifyContent: "center" }}>
            {busy ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Guardar cambios
          </button>
          <button onClick={onClose} style={{ ...btnGhost, flex: 1, justifyContent: "center" }}><X size={15} /> Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function TicketModal({ sale, shop, setShop, logo, onClose }) {
  const [editing, setEditing] = useState(false);
  const units = sale.items.reduce((a, i) => a + i.qty, 0);
  const upd = (field, val) => setShop(prev => ({ ...prev, [field]: val }));

  return (
    <div className="no-print" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 24, overflowY: "auto", zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 360, maxWidth: "100%" }}>
        {/* Controles (no se imprimen) */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, justifyContent: "space-between", alignItems: "center" }}>
          <div className="sg" style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Ticket #{sale.folio}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setEditing(v => !v)} style={btnGhost}><Pencil size={14} /> Datos</button>
            <button onClick={() => window.print()} style={btnGold}><Printer size={15} /> Imprimir</button>
            <button onClick={onClose} style={btnGhost}><X size={15} /></button>
          </div>
        </div>

        {editing && (
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 12, display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Datos del negocio (se guardan para los próximos tickets):</div>
            <input placeholder="Nombre del negocio" value={shop.name} onChange={e => upd("name", e.target.value)} />
            <input placeholder="Teléfono" value={shop.phone} onChange={e => upd("phone", e.target.value)} />
            <input placeholder="Dirección" value={shop.address} onChange={e => upd("address", e.target.value)} />
            <input placeholder="Mensaje al pie" value={shop.footer} onChange={e => upd("footer", e.target.value)} />
          </div>
        )}

        {/* Ticket imprimible */}
        <div className="ticket-print" style={{ background: "#fff", color: "#000", borderRadius: 8, padding: 18, fontFamily: "'Courier New', monospace", fontSize: 12, lineHeight: 1.5 }}>
          <div style={{ textAlign: "center", marginBottom: 8 }}>
            {logo && <img src={logo} alt="" style={{ maxWidth: 120, maxHeight: 60, objectFit: "contain", marginBottom: 4 }} />}
            <div style={{ fontWeight: 700, fontSize: 15, textTransform: "uppercase" }}>{shop.name || "Refaccionaria"}</div>
            {shop.address && <div>{shop.address}</div>}
            {shop.phone && <div>Tel. {shop.phone}</div>}
          </div>
          <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "6px 0", margin: "6px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Ticket:</span><span>#{sale.folio}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Fecha:</span><span>{sale.date} {sale.time || ""}</span></div>
            {sale.customer && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Cliente:</span><span>{sale.customer}</span></div>}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px dashed #000" }}>
                <th style={tkTh}>Cant</th><th style={{ ...tkTh, textAlign: "left" }}>Descripción</th><th style={{ ...tkTh, textAlign: "right" }}>Importe</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((i, idx) => (
                <tr key={idx}>
                  <td style={tkTd}>{i.qty}</td>
                  <td style={{ ...tkTd, textAlign: "left" }}>
                    {i.name}
                    <div style={{ fontSize: 10, color: "#444" }}>{fmt(i.price)} c/u</div>
                  </td>
                  <td style={{ ...tkTd, textAlign: "right" }}>{fmt(i.qty * i.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ borderTop: "1px dashed #000", marginTop: 6, paddingTop: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Artículos:</span><span>{units}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, marginTop: 2 }}><span>TOTAL:</span><span>{fmt(sale.total)}</span></div>
          </div>
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 12 }}>{shop.footer || "¡Gracias por su compra!"}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- styles ---------- */
const tkTh = { fontSize: 11, padding: "3px 2px", textAlign: "center", color: "#000", fontWeight: 700, borderBottom: "1px dashed #000" };
const tkTd = { fontSize: 12, padding: "3px 2px", textAlign: "center", color: "#000", verticalAlign: "top", borderBottom: "none" };
const lbl = { fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 };
const btnGold = { background: "var(--accent)", color: "#0c1118", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 };
const btnGhost = { background: "transparent", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 };
const btnDanger = { background: "#e25c5c22", border: "1px solid #e25c5c", color: "#e25c5c", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 };
const iconBtn = { background: "none", border: "none", color: "var(--muted-2)", padding: 4, marginLeft: 2 };
const chip = { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 16, padding: "5px 11px", fontSize: 11, fontWeight: 500 };
const miniLbl = { fontSize: 10, color: "var(--muted-2)", margin: "0 4px 0 8px" };
const miniNum = { width: 60, padding: "5px 7px" };
const stepBtn = { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 6, width: 22, height: 22, fontSize: 14, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" };
