import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from "recharts";
import Papa from "papaparse";
import { Plus, Upload, TrendingUp, Wallet, Target, Trash2, ChevronRight, Award, Flame, Sparkles, Check, X, Loader2 } from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n || 0);

const CATS_INCOME = ["Salario", "Comisión", "Negocio", "Otro ingreso"];
const CATS_EXPENSE = ["Renta/Hipoteca", "Comida", "Transporte", "Deuda", "Gusto", "Servicios", "Otro gasto"];

const LEVELS = [
  { min: 0, name: "Empleado", color: "#8a8f98" },
  { min: 500, name: "Autoempleado", color: "#3fa9f5" },
  { min: 2000, name: "Inversionista junior", color: "#2ecc71" },
  { min: 6000, name: "Inversionista", color: "#d4af37" },
  { min: 15000, name: "Libre financiero", color: "#e8c468" },
];

function getLevel(netWorth) {
  let lvl = LEVELS[0];
  for (const l of LEVELS) if (netWorth >= l.min) lvl = l;
  return lvl;
}

export default function FinanceApp() {
  const [tab, setTab] = useState("dashboard");
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({ type: "expense", category: CATS_EXPENSE[0], amount: "", note: "", date: new Date().toISOString().slice(0, 10) });
  const [proj, setProj] = useState({ months: 12, target: "", monthlyContribution: "", rate: 0 });
  const [toast, setToast] = useState(null);
  const [fixedItems, setFixedItems] = useState([]);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPreview, setAiPreview] = useState(null);
  const [aiError, setAiError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("finanzas:entries");
        if (res && res.value) setEntries(JSON.parse(res.value));
      } catch (e) {}
      try {
        const res2 = await window.storage.get("finanzas:fixedItems");
        if (res2 && res2.value) setFixedItems(JSON.parse(res2.value));
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.storage.set("finanzas:entries", JSON.stringify(entries)).catch(() => {});
  }, [entries, loaded]);

  useEffect(() => {
    if (!loaded) return;
    window.storage.set("finanzas:fixedItems", JSON.stringify(fixedItems)).catch(() => {});
  }, [fixedItems, loaded]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    for (const e of entries) {
      if (e.type === "income") income += e.amount;
      else expense += e.amount;
    }
    return { income, expense, net: income - expense };
  }, [entries]);

  const monthly = useMemo(() => {
    const map = {};
    for (const e of entries) {
      const key = e.date.slice(0, 7);
      if (!map[key]) map[key] = { month: key, income: 0, expense: 0 };
      if (e.type === "income") map[key].income += e.amount;
      else map[key].expense += e.amount;
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [entries]);

  const avgMonthlySave = useMemo(() => {
    if (monthly.length === 0) return 0;
    const sum = monthly.reduce((acc, m) => acc + (m.income - m.expense), 0);
    return sum / monthly.length;
  }, [monthly]);

  const fixedNet = useMemo(() => {
    let income = 0, expense = 0;
    for (const f of fixedItems) {
      if (f.type === "income") income += f.amount; else expense += f.amount;
    }
    return { income, expense, net: income - expense };
  }, [fixedItems]);

  const askAI = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setAiPreview(null);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: "Extraes ingresos y gastos FIJOS (recurrentes mensuales) de una descripción en español. Responde SOLO con un arreglo JSON, sin texto adicional, sin markdown, sin backticks. Cada elemento: {\"type\":\"income\"|\"expense\",\"category\":string,\"amount\":number,\"note\":string}. Usa montos mensuales (si dan algo semanal o quincenal, conviértelo a mensual, dividiendo o multiplicando segun corresponda). Para 'category' usa una etiqueta corta y clara en español basada en lo que describe (ej. 'Salario', 'Renta', 'Comida', 'Deuda', 'Servicios', 'Transporte'). Si no hay info suficiente para un monto, no inventes esa entrada.",
          messages: [{ role: "user", content: aiText }],
        }),
      });
      const data = await response.json();
      const text = (data.content || []).map(b => b.text || "").join("\n");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setAiError("No encontré montos claros en tu descripción. Intenta ser más específico.");
      } else {
        setAiPreview(parsed.map(p => ({ ...p, id: crypto.randomUUID(), include: true, amount: Number(p.amount) || 0 })));
      }
    } catch (e) {
      setAiError("No pude procesar eso. Intenta de nuevo o sé más específico con los montos.");
    } finally {
      setAiLoading(false);
    }
  };

  const confirmAiPreview = () => {
    const toAdd = aiPreview.filter(p => p.include && p.amount > 0);
    setFixedItems(prev => [...prev, ...toAdd.map(({ include, ...rest }) => rest)]);
    const today = new Date().toISOString().slice(0, 10);
    setEntries(prev => [
      ...toAdd.map(({ include, ...rest }) => ({ ...rest, id: crypto.randomUUID(), date: today })),
      ...prev,
    ]);
    setAiPreview(null);
    setAiText("");
    showToast(`${toAdd.length} conceptos fijos agregados`);
  };

  const deleteFixedItem = (id) => setFixedItems(prev => prev.filter(f => f.id !== id));

  const level = getLevel(totals.net);
  const nextLevel = LEVELS[LEVELS.findIndex(l => l.name === level.name) + 1];
  const progressToNext = nextLevel ? Math.min(100, Math.max(0, ((totals.net - level.min) / (nextLevel.min - level.min)) * 100)) : 100;

  const addEntry = () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) return showToast("Pon un monto válido");
    const entry = { id: crypto.randomUUID(), ...form, amount };
    setEntries(prev => [entry, ...prev]);
    setForm(f => ({ ...f, amount: "", note: "" }));
    showToast(form.type === "income" ? "+XP: ingreso registrado" : "Gasto registrado");
  };

  const deleteEntry = (id) => setEntries(prev => prev.filter(e => e.id !== id));

  const handleCSV = (file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data;
        const parsed = [];
        for (const r of rows) {
          const amountRaw = r.amount ?? r.monto ?? r.Amount ?? r.Monto;
          const amount = parseFloat(String(amountRaw).replace(/[^0-9.-]/g, ""));
          if (!amount) continue;
          const type = (r.type || r.tipo || (amount < 0 ? "expense" : "income") || "").toString().toLowerCase().includes("ingreso") || (r.type || r.tipo || "").toLowerCase().includes("income") ? "income" : "expense";
          parsed.push({
            id: crypto.randomUUID(),
            type,
            category: r.category || r.categoria || (type === "income" ? "Otro ingreso" : "Otro gasto"),
            amount: Math.abs(amount),
            note: r.note || r.nota || r.description || r.descripcion || "",
            date: (r.date || r.fecha || new Date().toISOString().slice(0, 10)).slice(0, 10),
          });
        }
        if (parsed.length === 0) {
          showToast("No reconocí columnas (usa: date, type, category, amount, note)");
          return;
        }
        setEntries(prev => [...parsed, ...prev]);
        showToast(`${parsed.length} movimientos importados`);
      },
      error: () => showToast("No pude leer el archivo"),
    });
  };

  // --- Projections ---
  const months = Math.max(1, parseInt(proj.months) || 1);
  const baseContribution = proj.monthlyContribution !== "" ? parseFloat(proj.monthlyContribution) : (fixedItems.length > 0 ? fixedNet.net : avgMonthlySave);
  const monthlyRate = (parseFloat(proj.rate) || 0) / 100 / 12;
  const target = parseFloat(proj.target) || 0;

  const projectionData = useMemo(() => {
    let balance = totals.net;
    const data = [{ month: 0, balance: Math.round(balance) }];
    for (let i = 1; i <= months; i++) {
      balance = balance * (1 + monthlyRate) + baseContribution;
      data.push({ month: i, balance: Math.round(balance) });
    }
    return data;
  }, [totals.net, months, baseContribution, monthlyRate]);

  const monthsToTarget = useMemo(() => {
    if (!target || baseContribution <= 0) return null;
    let balance = totals.net;
    let m = 0;
    while (balance < target && m < 1200) {
      balance = balance * (1 + monthlyRate) + baseContribution;
      m++;
    }
    return balance >= target ? m : null;
  }, [target, baseContribution, totals.net, monthlyRate]);

  const finalBalance = projectionData[projectionData.length - 1]?.balance ?? 0;

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
      `}</style>

      {/* Header */}
      <div style={{ padding: "20px 20px 0", maxWidth: 920, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div className="sg" style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>Tu Ruta Financiera</div>
            <div style={{ fontSize: 13, color: "#8a93a3", marginTop: 2 }}>Como Rat Race, pero con tu dinero de verdad</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: "8px 14px" }}>
            <Award size={18} color={level.color} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: level.color }}>{level.name}</div>
              <div style={{ width: 110, height: 5, background: "#0c1118", borderRadius: 3, marginTop: 4, overflow: "hidden" }}>
                <div style={{ width: `${progressToNext}%`, height: "100%", background: level.color, transition: "width .4s" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginTop: 18, borderBottom: "1px solid #20283480" }}>
          {[
            { id: "dashboard", label: "Tablero", icon: Wallet },
            { id: "asistente", label: "Asistente IA", icon: Sparkles },
            { id: "movimientos", label: "Movimientos", icon: Plus },
            { id: "proyeccion", label: "Proyección", icon: TrendingUp },
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

      <div style={{ maxWidth: 920, margin: "0 auto", padding: "20px" }}>
        {tab === "dashboard" && (
          <Dashboard totals={totals} monthly={monthly} entries={entries} avgMonthlySave={avgMonthlySave} fixedItems={fixedItems} fixedNet={fixedNet} />
        )}

        {tab === "asistente" && (
          <Asistente aiText={aiText} setAiText={setAiText} askAI={askAI} aiLoading={aiLoading}
            aiPreview={aiPreview} setAiPreview={setAiPreview} aiError={aiError} confirmAiPreview={confirmAiPreview}
            fixedItems={fixedItems} deleteFixedItem={deleteFixedItem} fixedNet={fixedNet} />
        )}

        {tab === "movimientos" && (
          <Movimientos form={form} setForm={setForm} addEntry={addEntry} entries={entries} deleteEntry={deleteEntry} handleCSV={handleCSV} />
        )}

        {tab === "proyeccion" && (
          <Proyeccion proj={proj} setProj={setProj} avgMonthlySave={avgMonthlySave} projectionData={projectionData}
            monthsToTarget={monthsToTarget} finalBalance={finalBalance} netActual={totals.net} fixedItems={fixedItems} fixedNet={fixedNet} />
        )}
      </div>

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#1c2433", border: "1px solid #d4af37", color: "#e9ecf1", padding: "10px 18px",
          borderRadius: 10, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, zIndex: 50
        }}>
          <Flame size={14} color="#d4af37" /> {toast}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, icon: Icon }) {
  return (
    <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16, flex: 1, minWidth: 140 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#8a93a3", fontSize: 12, fontWeight: 600 }}>
        <Icon size={14} /> {label}
      </div>
      <div className="sg" style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: color || "#e9ecf1" }}>{fmt(value)}</div>
    </div>
  );
}

function Dashboard({ totals, monthly, entries, avgMonthlySave, fixedItems, fixedNet }) {
  return (
    <div>
      {fixedItems.length > 0 && (
        <div style={{ background: "#1c2433", border: "1px solid #d4af37", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#d4af37", display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={14} /> Tienes {fixedItems.length} conceptos fijos configurados · neto {fmt(fixedNet.net)}/mes
        </div>
      )}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <StatCard label="Ingresos totales" value={totals.income} color="#2ecc71" icon={TrendingUp} />
        <StatCard label="Gastos totales" value={totals.expense} color="#e25c5c" icon={Wallet} />
        <StatCard label="Patrimonio neto" value={totals.net} color="#d4af37" icon={Award} />
        <StatCard label="Ahorro promedio/mes" value={avgMonthlySave} color="#3fa9f5" icon={Target} />
      </div>

      {monthly.length > 0 ? (
        <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Ingresos vs gastos por mes</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#29323f" />
              <XAxis dataKey="month" stroke="#8a93a3" fontSize={11} />
              <YAxis stroke="#8a93a3" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={{ background: "#1c2433", border: "1px solid #29323f", borderRadius: 8 }} formatter={(v) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Ingresos" fill="#2ecc71" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Gastos" fill="#e25c5c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState text="Registra tu primer movimiento en la pestaña 'Movimientos' para ver tu tablero cobrar vida." />
      )}

      {entries.length > 0 && (
        <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16 }}>
          <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Últimos movimientos</div>
          {entries.slice(0, 5).map(e => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #20283480", fontSize: 13 }}>
              <span style={{ color: "#8a93a3" }}>{e.date} · {e.category}</span>
              <span style={{ fontWeight: 600, color: e.type === "income" ? "#2ecc71" : "#e25c5c" }}>
                {e.type === "income" ? "+" : "-"}{fmt(e.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
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

function Movimientos({ form, setForm, addEntry, entries, deleteEntry, handleCSV }) {
  const cats = form.type === "income" ? CATS_INCOME : CATS_EXPENSE;
  return (
    <div>
      <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Registrar movimiento</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {["expense", "income"].map(t => (
            <button key={t} onClick={() => setForm(f => ({ ...f, type: t, category: t === "income" ? CATS_INCOME[0] : CATS_EXPENSE[0] }))}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 8, border: "1px solid #29323f",
                background: form.type === t ? (t === "income" ? "#2ecc7122" : "#e25c5c22") : "transparent",
                color: form.type === t ? (t === "income" ? "#2ecc71" : "#e25c5c") : "#8a93a3",
                fontWeight: 700, fontSize: 13
              }}>
              {t === "income" ? "Ingreso" : "Gasto"}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {cats.map(c => <option key={c}>{c}</option>)}
          </select>
          <input type="number" placeholder="Monto" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          <input type="text" placeholder="Nota (opcional)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={addEntry} style={{ flex: 1, background: "#d4af37", color: "#0c1118", border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Plus size={15} /> Agregar
          </button>
          <label style={{ flex: 1, border: "1px solid #29323f", borderRadius: 8, padding: "10px 0", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#8a93a3" }}>
            <Upload size={15} /> Importar CSV
            <input type="file" accept=".csv" hidden onChange={e => e.target.files[0] && handleCSV(e.target.files[0])} />
          </label>
        </div>
        <div style={{ fontSize: 11, color: "#5a6372", marginTop: 8 }}>
          CSV con columnas: date, type (income/expense), category, amount, note
        </div>
      </div>

      <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16 }}>
        <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Historial ({entries.length})</div>
        {entries.length === 0 && <EmptyState text="Aún no hay movimientos." />}
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {entries.map(e => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #20283480" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{e.category}{e.note ? ` · ${e.note}` : ""}</div>
                <div style={{ fontSize: 11, color: "#5a6372" }}>{e.date}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: e.type === "income" ? "#2ecc71" : "#e25c5c" }}>
                  {e.type === "income" ? "+" : "-"}{fmt(e.amount)}
                </span>
                <button onClick={() => deleteEntry(e.id)} style={{ background: "none", border: "none", color: "#5a6372" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Asistente({ aiText, setAiText, askAI, aiLoading, aiPreview, setAiPreview, aiError, confirmAiPreview, fixedItems, deleteFixedItem, fixedNet }) {
  const toggleItem = (id) => {
    setAiPreview(prev => prev.map(p => p.id === id ? { ...p, include: !p.include } : p));
  };
  const updateAmount = (id, val) => {
    setAiPreview(prev => prev.map(p => p.id === id ? { ...p, amount: parseFloat(val) || 0 } : p));
  };

  return (
    <div>
      <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={16} color="#d4af37" /> Describe tu situación
        </div>
        <div style={{ fontSize: 12, color: "#8a93a3", marginBottom: 12 }}>
          Cuéntame en tus palabras tus ingresos y gastos fijos, como si le hablaras a un asesor. Yo lo convierto en datos.
        </div>
        <textarea
          value={aiText}
          onChange={e => setAiText(e.target.value)}
          placeholder="Ej: Trabajo en una empresa de IA, gano $7000 al mes fijo. Pago $3000 de gastos fijos: renta $1800, comida $800, transporte $400. También tengo una deuda de tarjeta de $500 al mes."
          rows={5}
          style={{ width: "100%", resize: "vertical", fontFamily: "inherit", marginBottom: 10 }}
        />
        <button onClick={askAI} disabled={aiLoading || !aiText.trim()}
          style={{
            background: aiLoading ? "#29323f" : "#d4af37", color: aiLoading ? "#8a93a3" : "#0c1118",
            border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 13,
            display: "flex", alignItems: "center", gap: 6
          }}>
          {aiLoading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
          {aiLoading ? "Analizando..." : "Llenar mis datos"}
        </button>
        {aiError && <div style={{ color: "#e25c5c", fontSize: 12, marginTop: 10 }}>{aiError}</div>}
      </div>

      {aiPreview && (
        <div style={{ background: "#161d29", border: "1px solid #d4af37", borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Esto entendí — revisa y ajusta</div>
          <div style={{ fontSize: 12, color: "#8a93a3", marginBottom: 12 }}>Destilda lo que no quieras guardar, o corrige el monto.</div>
          {aiPreview.map(item => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #20283480" }}>
              <input type="checkbox" checked={item.include} onChange={() => toggleItem(item.id)} style={{ width: 16, height: 16 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: item.type === "income" ? "#2ecc71" : "#e25c5c" }}>
                  {item.type === "income" ? "Ingreso" : "Gasto"} · {item.category}
                </div>
                {item.note && <div style={{ fontSize: 11, color: "#5a6372" }}>{item.note}</div>}
              </div>
              <input type="number" value={item.amount} onChange={e => updateAmount(item.id, e.target.value)} style={{ width: 100 }} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={confirmAiPreview} style={{ flex: 1, background: "#d4af37", color: "#0c1118", border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Check size={15} /> Guardar
            </button>
            <button onClick={() => setAiPreview(null)} style={{ flex: 1, background: "transparent", border: "1px solid #29323f", color: "#8a93a3", borderRadius: 8, padding: "10px 0", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <X size={15} /> Cancelar
            </button>
          </div>
        </div>
      )}

      <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16 }}>
        <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
          Tus conceptos fijos {fixedItems.length > 0 && `(neto ${fmt(fixedNet.net)}/mes)`}
        </div>
        {fixedItems.length === 0 && <EmptyState text="Cuando guardes conceptos, aquí queda tu plantilla mensual fija — la proyección la usa por default." />}
        {fixedItems.map(f => (
          <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #20283480" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{f.category}{f.note ? ` · ${f.note}` : ""}</div>
              <div style={{ fontSize: 11, color: "#5a6372" }}>{f.type === "income" ? "Ingreso fijo" : "Gasto fijo"} mensual</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: f.type === "income" ? "#2ecc71" : "#e25c5c" }}>
                {f.type === "income" ? "+" : "-"}{fmt(f.amount)}
              </span>
              <button onClick={() => deleteFixedItem(f.id)} style={{ background: "none", border: "none", color: "#5a6372" }}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Proyeccion({ proj, setProj, avgMonthlySave, projectionData, monthsToTarget, finalBalance, netActual, fixedItems, fixedNet }) {
  return (
    <div>
      <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Simulador de futuro</div>
        <div style={{ fontSize: 12, color: "#8a93a3", marginBottom: 14 }}>
          Como en Rat Race: proyecta a dónde te llevan tus números si sigues igual, o si quieres comprar algo grande.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: "#8a93a3" }}>Meses a proyectar</label>
            <input type="number" value={proj.months} onChange={e => setProj(p => ({ ...p, months: e.target.value }))} style={{ width: "100%", marginTop: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#8a93a3" }}>Aportación mensual ($)</label>
            <input type="number" placeholder={`Auto: ${fmt(avgMonthlySave)}`} value={proj.monthlyContribution}
              onChange={e => setProj(p => ({ ...p, monthlyContribution: e.target.value }))} style={{ width: "100%", marginTop: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#8a93a3" }}>Rendimiento anual % (opcional)</label>
            <input type="number" value={proj.rate} onChange={e => setProj(p => ({ ...p, rate: e.target.value }))} style={{ width: "100%", marginTop: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#8a93a3" }}>Meta / compra objetivo ($, opcional)</label>
            <input type="number" placeholder="Ej. 35000 para la moto" value={proj.target} onChange={e => setProj(p => ({ ...p, target: e.target.value }))} style={{ width: "100%", marginTop: 4 }} />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <StatCard label="Patrimonio actual" value={netActual} color="#e9ecf1" icon={Wallet} />
        <StatCard label={`En ${proj.months} meses`} value={finalBalance} color="#d4af37" icon={TrendingUp} />
        {monthsToTarget !== null && (
          <div style={{ background: "#161d29", border: "1px solid #2ecc71", borderRadius: 12, padding: 16, flex: 1, minWidth: 180 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#2ecc71", fontSize: 12, fontWeight: 600 }}>
              <Target size={14} /> Llegas a tu meta en
            </div>
            <div className="sg" style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: "#2ecc71" }}>
              {monthsToTarget} {monthsToTarget === 1 ? "mes" : "meses"}
            </div>
          </div>
        )}
        {proj.target && monthsToTarget === null && (
          <div style={{ background: "#161d29", border: "1px solid #e25c5c", borderRadius: 12, padding: 16, flex: 1, minWidth: 180 }}>
            <div style={{ color: "#e25c5c", fontSize: 12, fontWeight: 600 }}>Con este ritmo, no alcanzas la meta en 100 años</div>
            <div style={{ fontSize: 12, color: "#8a93a3", marginTop: 6 }}>Sube tu aportación mensual o baja la meta</div>
          </div>
        )}
      </div>

      <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16 }}>
        <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Tu ruta hacia la libertad</div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={projectionData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#29323f" />
            <XAxis dataKey="month" stroke="#8a93a3" fontSize={11} label={{ value: "meses", position: "insideBottom", offset: -3, fill: "#5a6372", fontSize: 11 }} />
            <YAxis stroke="#8a93a3" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip contentStyle={{ background: "#1c2433", border: "1px solid #29323f", borderRadius: 8 }} formatter={(v) => fmt(v)} labelFormatter={(l) => `Mes ${l}`} />
            <Line type="monotone" dataKey="balance" stroke="#d4af37" strokeWidth={2.5} dot={false} />
            {proj.target && <Line type="monotone" dataKey={() => parseFloat(proj.target)} stroke="#e25c5c" strokeDasharray="4 4" dot={false} name="Meta" />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
