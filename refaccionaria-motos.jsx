import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from "recharts";
import Papa from "papaparse";
import {
  Plus, Upload, TrendingUp, Wallet, Package, Trash2, Sparkles, Check, X, Loader2,
  AlertTriangle, ShoppingCart, Search, Pencil, Boxes, DollarSign, Receipt, BarChart3, Printer
} from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(n || 0);
const fmt0 = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n || 0);

const PART_CATS = ["Motor", "Frenos", "Suspensión", "Eléctrico", "Transmisión", "Llantas y cámaras", "Aceites y lubricantes", "Carrocería", "Accesorios", "Otro"];
const EXPENSE_CATS = ["Compra a proveedor", "Renta", "Servicios (luz/agua/internet)", "Sueldos", "Publicidad", "Mantenimiento", "Impuestos", "Otro"];

const uid = () => crypto.randomUUID();
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function RefaccionariaApp() {
  const [tab, setTab] = useState("tablero");
  const [parts, setParts] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const [shop, setShop] = useState({ name: "Refaccionaria de Motos", phone: "", address: "", footer: "¡Gracias por su compra!" });
  const [ticketSale, setTicketSale] = useState(null);

  // --- Persistence ---
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("refa:parts");
        if (r && r.value) setParts(JSON.parse(r.value));
      } catch (e) {}
      try {
        const r = await window.storage.get("refa:sales");
        if (r && r.value) setSales(JSON.parse(r.value));
      } catch (e) {}
      try {
        const r = await window.storage.get("refa:expenses");
        if (r && r.value) setExpenses(JSON.parse(r.value));
      } catch (e) {}
      try {
        const r = await window.storage.get("refa:shop");
        if (r && r.value) setShop(prev => ({ ...prev, ...JSON.parse(r.value) }));
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) window.storage.set("refa:parts", JSON.stringify(parts)).catch(() => {}); }, [parts, loaded]);
  useEffect(() => { if (loaded) window.storage.set("refa:sales", JSON.stringify(sales)).catch(() => {}); }, [sales, loaded]);
  useEffect(() => { if (loaded) window.storage.set("refa:expenses", JSON.stringify(expenses)).catch(() => {}); }, [expenses, loaded]);
  useEffect(() => { if (loaded) window.storage.set("refa:shop", JSON.stringify(shop)).catch(() => {}); }, [shop, loaded]);

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

  const thisMonth = todayStr().slice(0, 7);
  const monthSales = useMemo(() => sales.filter(s => s.date.slice(0, 7) === thisMonth), [sales, thisMonth]);
  const monthExpenses = useMemo(() => expenses.filter(e => e.date.slice(0, 7) === thisMonth), [expenses, thisMonth]);

  const monthRevenue = monthSales.reduce((a, s) => a + s.total, 0);
  const monthCogs = monthSales.reduce((a, s) => a + s.cogs, 0);
  const monthOpex = monthExpenses.reduce((a, e) => a + e.amount, 0);
  const monthGross = monthRevenue - monthCogs;
  const monthNet = monthGross - monthOpex;

  return (
    <div style={{ minHeight: "100vh", background: "#0c1118", color: "#e9ecf1", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap');
        .sg { font-family: 'Space Grotesk', sans-serif; }
        * { box-sizing: border-box; }
        input, select { background:#161d29; border:1px solid #29323f; color:#e9ecf1; border-radius:8px; padding:9px 11px; font-size:14px; outline:none; }
        input:focus, select:focus { border-color:#d4af37; }
        button { cursor:pointer; }
        ::-webkit-scrollbar{width:6px;height:6px} ::-webkit-scrollbar-thumb{background:#29323f;border-radius:4px}
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        textarea { background:#161d29; border:1px solid #29323f; color:#e9ecf1; border-radius:8px; padding:10px 12px; font-size:13px; outline:none; }
        textarea:focus { border-color:#d4af37; }
        table { width:100%; border-collapse:collapse; }
        th { text-align:left; font-size:11px; color:#8a93a3; font-weight:600; padding:8px 8px; border-bottom:1px solid #29323f; }
        td { font-size:13px; padding:9px 8px; border-bottom:1px solid #20283480; }
        @media print {
          body * { visibility: hidden !important; }
          .ticket-print, .ticket-print * { visibility: visible !important; }
          .ticket-print { position: absolute; left: 0; top: 0; width: 80mm; margin: 0; padding: 4mm; color: #000; background: #fff; }
          .no-print { display: none !important; }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>

      {/* Header */}
      <div style={{ padding: "20px 20px 0", maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div className="sg" style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, display: "flex", alignItems: "center", gap: 8 }}>
              <Boxes size={22} color="#d4af37" /> Refaccionaria de Motos
            </div>
            <div style={{ fontSize: 13, color: "#8a93a3", marginTop: 2 }}>Inventario y contabilidad en un solo lugar</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <MiniStat label="Valor inventario" value={fmt0(inventoryValue)} color="#3fa9f5" />
            <MiniStat label="Utilidad del mes" value={fmt0(monthNet)} color={monthNet >= 0 ? "#2ecc71" : "#e25c5c"} />
            {lowStock.length > 0 && <MiniStat label="Bajo mínimo" value={`${lowStock.length} pza`} color="#e8a13a" />}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginTop: 18, borderBottom: "1px solid #20283480", flexWrap: "wrap" }}>
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
                color: tab === t.id ? "#d4af37" : "#8a93a3", borderBottom: tab === t.id ? "2px solid #d4af37" : "2px solid transparent",
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
          <Inventario parts={parts} setParts={setParts} showToast={showToast} />
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
          <Asistente parts={parts} setParts={setParts} showToast={showToast} />
        )}
      </div>

      {ticketSale && (
        <TicketModal sale={ticketSale} shop={shop} setShop={setShop} onClose={() => setTicketSale(null)} />
      )}

      {toast && (
        <div className="no-print" style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#1c2433", border: "1px solid #d4af37", color: "#e9ecf1", padding: "10px 18px",
          borderRadius: 10, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, zIndex: 50
        }}>
          <Check size={14} color="#d4af37" /> {toast}
        </div>
      )}
    </div>
  );
}

/* ---------- Shared bits ---------- */
function MiniStat({ label, value, color }) {
  return (
    <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: "8px 14px" }}>
      <div style={{ fontSize: 11, color: "#8a93a3", fontWeight: 600 }}>{label}</div>
      <div className="sg" style={{ fontSize: 16, fontWeight: 700, color: color || "#e9ecf1" }}>{value}</div>
    </div>
  );
}

function StatCard({ label, value, color, icon: Icon, sub }) {
  return (
    <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16, flex: 1, minWidth: 150 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#8a93a3", fontSize: 12, fontWeight: 600 }}>
        <Icon size={14} /> {label}
      </div>
      <div className="sg" style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: color || "#e9ecf1" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#5a6372", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ background: "#161d29", border: "1px dashed #29323f", borderRadius: 12, padding: 28, textAlign: "center", color: "#8a93a3", fontSize: 13 }}>
      {text}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ children, icon: Icon }) {
  return (
    <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
      {Icon && <Icon size={16} color="#d4af37" />} {children}
    </div>
  );
}

/* ---------- Tablero ---------- */
function Tablero({ inventoryValue, inventoryRetail, lowStock, monthRevenue, monthNet, monthGross, sales, expenses, parts, setTab }) {
  const monthly = useMemo(() => {
    const map = {};
    for (const s of sales) {
      const k = s.date.slice(0, 7);
      if (!map[k]) map[k] = { month: k, ventas: 0, gastos: 0, utilidad: 0 };
      map[k].ventas += s.total;
      map[k].utilidad += s.total - s.cogs;
    }
    for (const e of expenses) {
      const k = e.date.slice(0, 7);
      if (!map[k]) map[k] = { month: k, ventas: 0, gastos: 0, utilidad: 0 };
      map[k].gastos += e.amount;
      map[k].utilidad -= e.amount;
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  }, [sales, expenses]);

  const topProducts = useMemo(() => {
    const map = {};
    for (const s of sales) for (const it of s.items) {
      if (!map[it.name]) map[it.name] = { name: it.name, qty: 0, revenue: 0 };
      map[it.name].qty += it.qty;
      map[it.name].revenue += it.qty * it.price;
    }
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [sales]);

  const potentialMargin = inventoryRetail - inventoryValue;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <StatCard label="Valor de inventario (costo)" value={fmt0(inventoryValue)} color="#3fa9f5" icon={Boxes}
          sub={`Si se vende todo: +${fmt0(potentialMargin)} de utilidad`} />
        <StatCard label="Ventas del mes" value={fmt0(monthRevenue)} color="#2ecc71" icon={TrendingUp} />
        <StatCard label="Utilidad bruta del mes" value={fmt0(monthGross)} color="#d4af37" icon={DollarSign} />
        <StatCard label="Utilidad neta del mes" value={fmt0(monthNet)} color={monthNet >= 0 ? "#2ecc71" : "#e25c5c"} icon={Wallet}
          sub="Después de gastos del local" />
      </div>

      {lowStock.length > 0 && (
        <Card style={{ marginBottom: 18, border: "1px solid #e8a13a" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div className="sg" style={{ fontSize: 14, fontWeight: 700, color: "#e8a13a", display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={16} /> Piezas por reabastecer ({lowStock.length})
            </div>
            <button onClick={() => setTab("inventario")} style={{ background: "none", border: "1px solid #29323f", color: "#8a93a3", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600 }}>
              Ver inventario
            </button>
          </div>
          {lowStock.slice(0, 6).map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
              <span>{p.name} <span style={{ color: "#5a6372" }}>· {p.sku || "s/SKU"}</span></span>
              <span style={{ color: "#e8a13a", fontWeight: 600 }}>{p.stock} en stock (mín. {p.minStock})</span>
            </div>
          ))}
        </Card>
      )}

      {monthly.length > 0 ? (
        <Card style={{ marginBottom: 18 }}>
          <SectionTitle icon={BarChart3}>Ventas vs gastos por mes</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#29323f" />
              <XAxis dataKey="month" stroke="#8a93a3" fontSize={11} />
              <YAxis stroke="#8a93a3" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={{ background: "#1c2433", border: "1px solid #29323f", borderRadius: 8 }} formatter={(v) => fmt0(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="ventas" name="Ventas" fill="#2ecc71" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastos" name="Gastos" fill="#e25c5c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      ) : (
        <EmptyState text="Registra tu primera venta en 'Punto de venta' para ver el tablero cobrar vida." />
      )}

      {topProducts.length > 0 && (
        <Card>
          <SectionTitle icon={TrendingUp}>Más vendidos</SectionTitle>
          {topProducts.map(p => (
            <div key={p.name} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #20283480", fontSize: 13 }}>
              <span>{p.name}</span>
              <span style={{ color: "#8a93a3" }}>{p.qty} u · {fmt0(p.revenue)}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ---------- Inventario ---------- */
const emptyPart = () => ({ sku: "", name: "", brand: "", category: PART_CATS[0], compat: "", stock: "", minStock: "", cost: "", price: "" });

function Inventario({ parts, setParts, showToast }) {
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
      minStock: Math.max(0, parseInt(form.minStock) || 0),
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
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data;
        const added = [];
        for (const r of rows) {
          const name = (r.nombre || r.name || r.Nombre || "").toString().trim();
          if (!name) continue;
          added.push({
            id: uid(),
            sku: (r.sku || r.SKU || r.codigo || "").toString(),
            name,
            brand: (r.marca || r.brand || "").toString(),
            category: (r.categoria || r.category || PART_CATS[PART_CATS.length - 1]).toString(),
            compat: (r.compatibilidad || r.compat || r.modelo || "").toString(),
            stock: Math.max(0, parseInt(r.stock || r.cantidad || 0) || 0),
            minStock: Math.max(0, parseInt(r.minimo || r.minStock || r.min || 0) || 0),
            cost: Math.max(0, parseFloat(String(r.costo || r.cost || 0).replace(/[^0-9.-]/g, "")) || 0),
            price: Math.max(0, parseFloat(String(r.precio || r.price || 0).replace(/[^0-9.-]/g, "")) || 0),
          });
        }
        if (!added.length) return showToast("No reconocí columnas (usa: nombre, sku, marca, stock, costo, precio…)");
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
          <div><label style={lbl}>Stock mínimo</label><input type="number" placeholder="0" value={form.minStock} onChange={e => setForm(f => ({ ...f, minStock: e.target.value }))} style={{ width: "100%" }} /></div>
          <div><label style={lbl}>Costo unitario</label><input type="number" placeholder="0" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} style={{ width: "100%" }} /></div>
          <div><label style={lbl}>Precio de venta</label><input type="number" placeholder="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} style={{ width: "100%" }} /></div>
        </div>
        {form.cost && form.price && (
          <div style={{ fontSize: 12, color: "#8a93a3", marginBottom: 10 }}>
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
            <Search size={14} color="#5a6372" style={{ position: "absolute", left: 10, top: 11 }} />
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
              style={{ width: 380, maxWidth: "100%", background: "#161d29", border: "1px solid #e25c5c", borderRadius: 14, padding: 22 }}>
              <div className="sg" style={{ fontSize: 16, fontWeight: 700, color: "#e25c5c", display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <AlertTriangle size={18} /> {wipeStep === 1 ? "¿Eliminar todo el inventario?" : "Confirma de nuevo"}
              </div>
              <div style={{ fontSize: 13, color: "#c4ccd8", marginBottom: 18, lineHeight: 1.5 }}>
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
                  const low = (Number(p.stock) || 0) <= (Number(p.minStock) || 0);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: "#5a6372" }}>{[p.brand, p.sku].filter(Boolean).join(" · ") || "—"}</div>
                      </td>
                      <td style={{ color: "#8a93a3" }}>{p.category}</td>
                      <td style={{ color: "#8a93a3" }}>{p.compat || "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                          <button onClick={() => adjustStock(p.id, -1)} style={stepBtn}>−</button>
                          <span style={{ fontWeight: 700, minWidth: 28, textAlign: "center", color: low ? "#e8a13a" : "#e9ecf1" }}>{p.stock}</span>
                          <button onClick={() => adjustStock(p.id, +1)} style={stepBtn}>+</button>
                        </div>
                        {low && <div style={{ fontSize: 10, color: "#e8a13a" }}>mín {p.minStock}</div>}
                      </td>
                      <td style={{ textAlign: "right", color: "#8a93a3" }}>{fmt(p.cost)}</td>
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
    showToast(`Venta #${nextFolio} registrada: ${fmt(total)} (utilidad ${fmt(profit)})`);
    onTicket && onTicket(sale);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 18, alignItems: "start" }}>
      <Card>
        <SectionTitle icon={Search}>Buscar refacción</SectionTitle>
        <input autoFocus placeholder="Escribe nombre, SKU o modelo de moto…" value={q} onChange={e => setQ(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        {results.map(p => (
          <div key={p.id} onClick={() => addToCart(p)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 8px", borderRadius: 8, cursor: "pointer", borderBottom: "1px solid #20283480" }}
            onMouseEnter={e => e.currentTarget.style.background = "#1c2433"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: "#5a6372" }}>{[p.brand, p.compat].filter(Boolean).join(" · ") || p.sku || "—"} · {p.stock} en stock</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{fmt(p.price)}</span>
              <Plus size={16} color="#d4af37" />
            </div>
          </div>
        ))}
        {q && results.length === 0 && <div style={{ fontSize: 12, color: "#5a6372", padding: "8px 4px" }}>Sin coincidencias.</div>}

        <SectionTitle icon={ShoppingCart} >{""}</SectionTitle>
        <div className="sg" style={{ fontSize: 13, fontWeight: 700, margin: "8px 0", color: "#8a93a3" }}>Ventas recientes</div>
        {sales.length === 0 && <EmptyState text="Aún no hay ventas." />}
        <div style={{ maxHeight: 220, overflowY: "auto" }}>
          {sales.slice(0, 12).map(s => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #20283480", fontSize: 12 }}>
              <span style={{ color: "#8a93a3" }}>{s.folio ? `#${s.folio} · ` : ""}{s.date} · {s.items.reduce((a, i) => a + i.qty, 0)} pza{s.customer ? ` · ${s.customer}` : ""}</span>
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
              <div key={i.partId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #20283480" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.name}</div>
                  <div style={{ fontSize: 11, color: "#5a6372" }}>máx {i.maxStock}</div>
                </div>
                <input type="number" value={i.qty} onChange={e => setQty(i.partId, e.target.value)} style={{ width: 56 }} title="Cantidad" />
                <span style={{ color: "#5a6372" }}>×</span>
                <input type="number" value={i.price} onChange={e => setLinePrice(i.partId, e.target.value)} style={{ width: 84 }} title="Precio unitario" />
                <span style={{ fontWeight: 600, fontSize: 13, minWidth: 70, textAlign: "right" }}>{fmt0(i.qty * i.price)}</span>
                <button onClick={() => removeLine(i.partId)} style={iconBtn}><Trash2 size={14} /></button>
              </div>
            ))}
            <input placeholder="Cliente (opcional)" value={customer} onChange={e => setCustomer(e.target.value)} style={{ width: "100%", marginTop: 12 }} />
            <div style={{ marginTop: 12, padding: "12px 0", borderTop: "1px solid #29323f" }}>
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
      <span style={{ fontSize: big ? 14 : 12, color: muted ? "#5a6372" : "#8a93a3", fontWeight: big ? 700 : 500 }}>{label}</span>
      <span className={big ? "sg" : ""} style={{ fontSize: big ? 20 : 13, fontWeight: 700, color: color || (big ? "#e9ecf1" : "#e9ecf1") }}>{value}</span>
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
        <div style={{ fontSize: 12, color: "#8a93a3", marginBottom: 12 }}>
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
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #20283480" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{e.category}{e.note ? ` · ${e.note}` : ""}</div>
                <div style={{ fontSize: 11, color: "#5a6372" }}>{e.date}</div>
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

  const inPeriod = (dateStr) => period === "todo" || dateStr.slice(0, 7) === todayStr().slice(0, 7);
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
      const k = s.date.slice(0, 7);
      if (!map[k]) map[k] = { month: k, ingresos: 0, costo: 0, gastos: 0, utilidad: 0 };
      map[k].ingresos += s.total; map[k].costo += s.cogs; map[k].utilidad += s.total - s.cogs;
    }
    for (const e of expenses) {
      const k = e.date.slice(0, 7);
      if (!map[k]) map[k] = { month: k, ingresos: 0, costo: 0, gastos: 0, utilidad: 0 };
      map[k].gastos += e.amount; map[k].utilidad -= e.amount;
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  }, [sales, expenses]);

  const expenseByCat = useMemo(() => {
    const map = {};
    for (const e of pExpenses) map[e.category] = (map[e.category] || 0) + e.amount;
    return Object.entries(map).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }, [pExpenses]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["mes", "Este mes"], ["todo", "Histórico"]].map(([id, label]) => (
          <button key={id} onClick={() => setPeriod(id)} style={{
            padding: "8px 16px", borderRadius: 8, border: "1px solid #29323f",
            background: period === id ? "#d4af3722" : "transparent", color: period === id ? "#d4af37" : "#8a93a3",
            fontWeight: 700, fontSize: 13
          }}>{label}</button>
        ))}
      </div>

      <Card style={{ marginBottom: 18 }}>
        <SectionTitle icon={Wallet}>Estado de resultados {period === "mes" ? "(este mes)" : "(histórico)"}</SectionTitle>
        <Row label="Ventas (ingresos)" value={fmt(revenue)} big />
        <Row label="− Costo de mercancía vendida" value={fmt(cogs)} muted />
        <div style={{ borderTop: "1px solid #29323f", margin: "6px 0" }} />
        <Row label="= Utilidad bruta" value={fmt(gross)} color="#d4af37" />
        <Row label={`Margen bruto`} value={`${margin}%`} muted />
        <Row label="− Gastos del negocio" value={fmt(opex)} muted />
        <div style={{ borderTop: "1px solid #29323f", margin: "6px 0" }} />
        <Row label="= Utilidad neta" value={fmt(net)} big color={net >= 0 ? "#2ecc71" : "#e25c5c"} />
      </Card>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <StatCard label="Ticket promedio" value={fmt0(pSales.length ? revenue / pSales.length : 0)} color="#3fa9f5" icon={ShoppingCart} sub={`${pSales.length} ventas`} />
        <StatCard label="Piezas vendidas" value={pSales.reduce((a, s) => a + s.items.reduce((x, i) => x + i.qty, 0), 0)} color="#e9ecf1" icon={Package} />
        <StatCard label="Utilidad por venta" value={fmt0(pSales.length ? gross / pSales.length : 0)} color="#2ecc71" icon={DollarSign} />
      </div>

      {monthly.length > 0 && (
        <Card style={{ marginBottom: 18 }}>
          <SectionTitle icon={TrendingUp}>Utilidad neta por mes</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#29323f" />
              <XAxis dataKey="month" stroke="#8a93a3" fontSize={11} />
              <YAxis stroke="#8a93a3" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={{ background: "#1c2433", border: "1px solid #29323f", borderRadius: 8 }} formatter={(v) => fmt0(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="ingresos" name="Ingresos" stroke="#2ecc71" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="utilidad" name="Utilidad neta" stroke="#d4af37" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {expenseByCat.length > 0 && (
        <Card>
          <SectionTitle icon={Receipt}>Gastos por categoría</SectionTitle>
          {expenseByCat.map(e => (
            <div key={e.category} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #20283480", fontSize: 13 }}>
              <span style={{ color: "#8a93a3" }}>{e.category}</span>
              <span style={{ fontWeight: 600, color: "#e25c5c" }}>{fmt(e.amount)}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ---------- Asistente IA (alta masiva de inventario desde texto) ---------- */
function Asistente({ parts, setParts, showToast }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  const ask = async () => {
    if (!text.trim()) return;
    setLoading(true); setError(null); setPreview(null);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          system: "Eres asistente de una refaccionaria de motos. Extraes refacciones de un texto en español (por ejemplo, una factura o pedido de proveedor) para dar de alta o reabastecer inventario. Responde SOLO con un arreglo JSON, sin texto adicional, sin markdown, sin backticks. Cada elemento: {\"name\":string,\"brand\":string,\"category\":string,\"compat\":string,\"stock\":number,\"cost\":number,\"price\":number}. 'name' es el nombre de la pieza (ej. 'Balatas delanteras', 'Bujía NGK', 'Kit de arrastre'). 'category' debe ser una de: Motor, Frenos, Suspensión, Eléctrico, Transmisión, Llantas y cámaras, Aceites y lubricantes, Carrocería, Accesorios, Otro. 'compat' es el modelo de moto compatible si se menciona (ej. 'FT150', 'DM200'), si no, cadena vacía. 'stock' es la cantidad recibida. 'cost' es el costo unitario de compra. Si dan precio de venta úsalo en 'price'; si no, estima 'price' como el costo con ~40% de margen. Si falta el costo de una pieza, no la inventes.",
          messages: [{ role: "user", content: text }],
        }),
      });
      const data = await response.json();
      const raw = (data.content || []).map(b => b.text || "").join("\n");
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setError("No encontré refacciones claras. Intenta detallar nombre, cantidad y costo.");
      } else {
        setPreview(parsed.map(p => ({
          id: uid(), include: true,
          name: p.name || "Refacción",
          brand: p.brand || "",
          category: PART_CATS.includes(p.category) ? p.category : "Otro",
          compat: p.compat || "",
          stock: Math.max(0, parseInt(p.stock) || 0),
          cost: Math.max(0, Number(p.cost) || 0),
          price: Math.max(0, Number(p.price) || 0),
        })));
      }
    } catch (e) {
      setError("No pude procesar eso. Intenta de nuevo o sé más específico con cantidades y costos.");
    } finally {
      setLoading(false);
    }
  };

  const upd = (id, field, val) => setPreview(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
  const toggle = (id) => setPreview(prev => prev.map(p => p.id === id ? { ...p, include: !p.include } : p));

  const confirm = () => {
    const toAdd = preview.filter(p => p.include && p.name);
    let merged = 0, created = 0;
    setParts(prev => {
      const next = [...prev];
      for (const it of toAdd) {
        const match = next.findIndex(p =>
          (it.compat && p.compat && p.name.toLowerCase() === it.name.toLowerCase() && p.compat.toLowerCase() === it.compat.toLowerCase()) ||
          (!it.compat && p.name.toLowerCase() === it.name.toLowerCase() && (p.brand || "").toLowerCase() === (it.brand || "").toLowerCase())
        );
        if (match >= 0) {
          next[match] = {
            ...next[match],
            stock: (Number(next[match].stock) || 0) + it.stock,
            cost: it.cost || next[match].cost,
            price: it.price || next[match].price,
          };
          merged++;
        } else {
          next.unshift({ id: uid(), sku: "", minStock: 0, ...it });
          created++;
        }
      }
      return next;
    });
    setPreview(null); setText("");
    showToast(`${created} nuevas, ${merged} reabastecidas`);
  };

  return (
    <div>
      <Card style={{ marginBottom: 18 }}>
        <SectionTitle icon={Sparkles}>Alta rápida de inventario desde texto</SectionTitle>
        <div style={{ fontSize: 12, color: "#8a93a3", marginBottom: 12 }}>
          Pega o describe un pedido/factura del proveedor. La IA lo convierte en refacciones listas para revisar y agregar al inventario. Si una pieza ya existe, suma el stock.
        </div>
        <textarea
          value={text} onChange={e => setText(e.target.value)}
          placeholder="Ej: Llegó pedido: 10 balatas delanteras Italika FT150 a $80 c/u, las vendo en $130. 5 bujías NGK a $45, precio $75. 3 litros de aceite 20w50 a $90. 2 kits de arrastre DM200 a $350."
          rows={5}
          style={{ width: "100%", resize: "vertical", fontFamily: "inherit", marginBottom: 10 }}
        />
        <button onClick={ask} disabled={loading || !text.trim()} style={{ ...btnGold, background: loading ? "#29323f" : "#d4af37", color: loading ? "#8a93a3" : "#0c1118" }}>
          {loading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
          {loading ? "Analizando…" : "Procesar con IA"}
        </button>
        {error && <div style={{ color: "#e25c5c", fontSize: 12, marginTop: 10 }}>{error}</div>}
      </Card>

      {preview && (
        <Card style={{ marginBottom: 18, border: "1px solid #d4af37" }}>
          <SectionTitle icon={Check}>Esto entendí — revisa y ajusta</SectionTitle>
          <div style={{ fontSize: 12, color: "#8a93a3", marginBottom: 12 }}>Destilda lo que no quieras, o corrige cantidades y precios.</div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr><th></th><th>Refacción</th><th>Categoría</th><th>Moto</th><th style={{ textAlign: "right" }}>Cant.</th><th style={{ textAlign: "right" }}>Costo</th><th style={{ textAlign: "right" }}>Precio</th></tr>
              </thead>
              <tbody>
                {preview.map(p => (
                  <tr key={p.id} style={{ opacity: p.include ? 1 : 0.4 }}>
                    <td><input type="checkbox" checked={p.include} onChange={() => toggle(p.id)} style={{ width: 16, height: 16 }} /></td>
                    <td>
                      <input value={p.name} onChange={e => upd(p.id, "name", e.target.value)} style={{ width: 150, padding: "5px 7px" }} />
                      {p.brand && <div style={{ fontSize: 10, color: "#5a6372", marginTop: 2 }}>{p.brand}</div>}
                    </td>
                    <td style={{ color: "#8a93a3", fontSize: 12 }}>{p.category}</td>
                    <td><input value={p.compat} onChange={e => upd(p.id, "compat", e.target.value)} style={{ width: 70, padding: "5px 7px" }} /></td>
                    <td style={{ textAlign: "right" }}><input type="number" value={p.stock} onChange={e => upd(p.id, "stock", Math.max(0, parseInt(e.target.value) || 0))} style={{ width: 58, padding: "5px 7px" }} /></td>
                    <td style={{ textAlign: "right" }}><input type="number" value={p.cost} onChange={e => upd(p.id, "cost", Math.max(0, parseFloat(e.target.value) || 0))} style={{ width: 70, padding: "5px 7px" }} /></td>
                    <td style={{ textAlign: "right" }}><input type="number" value={p.price} onChange={e => upd(p.id, "price", Math.max(0, parseFloat(e.target.value) || 0))} style={{ width: 70, padding: "5px 7px" }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={confirm} style={{ ...btnGold, flex: 1, justifyContent: "center" }}><Check size={15} /> Agregar al inventario</button>
            <button onClick={() => setPreview(null)} style={{ ...btnGhost, flex: 1, justifyContent: "center" }}><X size={15} /> Cancelar</button>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle icon={Package}>Inventario actual ({parts.length})</SectionTitle>
        {parts.length === 0 ? <EmptyState text="Usa el asistente arriba para cargar tu inventario de golpe." /> :
          parts.slice(0, 10).map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #20283480", fontSize: 13 }}>
              <span>{p.name} <span style={{ color: "#5a6372" }}>{p.compat ? `· ${p.compat}` : ""}</span></span>
              <span style={{ color: "#8a93a3" }}>{p.stock} u · {fmt(p.price)}</span>
            </div>
          ))}
        {parts.length > 10 && <div style={{ fontSize: 12, color: "#5a6372", marginTop: 8 }}>…y {parts.length - 10} más. Mira todo en la pestaña Inventario.</div>}
      </Card>
    </div>
  );
}

/* ---------- Ticket imprimible ---------- */
function TicketModal({ sale, shop, setShop, onClose }) {
  const [editing, setEditing] = useState(false);
  const units = sale.items.reduce((a, i) => a + i.qty, 0);
  const upd = (field, val) => setShop(prev => ({ ...prev, [field]: val }));

  return (
    <div className="no-print" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 24, overflowY: "auto", zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 360, maxWidth: "100%" }}>
        {/* Controles (no se imprimen) */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, justifyContent: "space-between", alignItems: "center" }}>
          <div className="sg" style={{ fontSize: 14, fontWeight: 700, color: "#e9ecf1" }}>Ticket #{sale.folio}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setEditing(v => !v)} style={btnGhost}><Pencil size={14} /> Datos</button>
            <button onClick={() => window.print()} style={btnGold}><Printer size={15} /> Imprimir</button>
            <button onClick={onClose} style={btnGhost}><X size={15} /></button>
          </div>
        </div>

        {editing && (
          <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 14, marginBottom: 12, display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, color: "#8a93a3" }}>Datos del negocio (se guardan para los próximos tickets):</div>
            <input placeholder="Nombre del negocio" value={shop.name} onChange={e => upd("name", e.target.value)} />
            <input placeholder="Teléfono" value={shop.phone} onChange={e => upd("phone", e.target.value)} />
            <input placeholder="Dirección" value={shop.address} onChange={e => upd("address", e.target.value)} />
            <input placeholder="Mensaje al pie" value={shop.footer} onChange={e => upd("footer", e.target.value)} />
          </div>
        )}

        {/* Ticket imprimible */}
        <div className="ticket-print" style={{ background: "#fff", color: "#000", borderRadius: 8, padding: 18, fontFamily: "'Courier New', monospace", fontSize: 12, lineHeight: 1.5 }}>
          <div style={{ textAlign: "center", marginBottom: 8 }}>
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
const lbl = { fontSize: 11, color: "#8a93a3", display: "block", marginBottom: 4 };
const btnGold = { background: "#d4af37", color: "#0c1118", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 };
const btnGhost = { background: "transparent", border: "1px solid #29323f", color: "#8a93a3", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 };
const btnDanger = { background: "#e25c5c22", border: "1px solid #e25c5c", color: "#e25c5c", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 };
const iconBtn = { background: "none", border: "none", color: "#5a6372", padding: 4, marginLeft: 2 };
const stepBtn = { background: "#1c2433", border: "1px solid #29323f", color: "#e9ecf1", borderRadius: 6, width: 22, height: 22, fontSize: 14, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" };
