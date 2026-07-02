// Agente IA de ventas del catálogo público (plan Elite).
// Atiende al público SIN login: valida que el catálogo sea válido (Elite,
// activo, encendido), respeta un tope diario de mensajes por negocio, y
// responde como vendedor usando ÚNICAMENTE el inventario publicable.

const SB_URL = process.env.SUPABASE_URL || "https://npxjpkcyfgxfbdvvlcrx.supabase.co";
const SB_ANON = process.env.SUPABASE_ANON_KEY || "sb_publishable_kQ-u3skesem-ub6LQBBb5Q_q3WRyXX3";

async function rpc(fn, args) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SB_ANON, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`rpc ${fn}`);
  return r.json();
}

// Normalización de modelos (igual que en la app) para filtrar piezas relevantes
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const words = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3);

function relevantParts(parts, query, cap = 80) {
  const ws = words(query);
  const nq = norm(query);
  const score = (p) => {
    const hay = `${p.name} ${p.brand || ""} ${p.category || ""} ${p.compat || ""} ${p.color || ""}`.toLowerCase();
    let s = 0;
    for (const w of ws) if (hay.includes(w)) s += 2;
    const toks = String(p.compat || "").split(/[,;/|]+/).map(t => norm(t)).filter(t => t.length >= 3);
    if (nq.length >= 3 && toks.some(t => t.includes(nq) || nq.includes(t))) s += 5;
    if (/univers|varios|todas|todos/i.test(p.compat || "")) s += 0.5;
    if (p.in_stock) s += 0.25;
    return s;
  };
  const scored = parts.map(p => [score(p), p]).sort((a, b) => b[0] - a[0]);
  const hits = scored.filter(([s]) => s > 0).map(([, p]) => p);
  if (hits.length) return hits.slice(0, cap);
  // Sin coincidencias: manda una muestra (primero lo disponible)
  return parts.slice(0, cap);
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Método no permitido" }); return; }
  const key = process.env.OPENAI_API_KEY;
  if (!key) { res.status(500).json({ error: "Falta configurar OPENAI_API_KEY en Vercel." }); return; }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const { slug, messages } = body;
  if (!/^[a-z0-9-]{2,60}$/.test(String(slug || ""))) { res.status(400).json({ error: "Catálogo no válido" }); return; }
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 16) { res.status(400).json({ error: "Conversación no válida" }); return; }
  const chat = messages.slice(-8).map(m => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content || "").slice(0, 500),
  }));

  try {
    // 1) ¿El catálogo es válido? (Elite, activo, encendido)
    const infoRows = await rpc("catalog_info", { slug_in: slug });
    const info = infoRows && infoRows[0];
    if (!info) { res.status(403).json({ error: "Catálogo no disponible" }); return; }

    // 2) Tope diario de mensajes por negocio (control de gasto)
    const allowed = await rpc("catalog_chat_tick", { slug_in: slug });
    if (allowed === false) {
      res.status(429).json({ error: "Por hoy alcanzamos el límite del asistente. Escríbenos por WhatsApp y te atendemos al momento. 🙌" });
      return;
    }

    // 3) Inventario publicable, filtrado a lo relevante para la pregunta
    const parts = await rpc("catalog_parts", { slug_in: slug });
    const lastUser = [...chat].reverse().find(m => m.role === "user")?.content || "";
    const rel = relevantParts(parts || [], lastUser);
    const inv = rel.map(p => ({
      pieza: p.name, marca: p.brand || undefined, compat: p.compat || undefined,
      color: p.color || undefined, ...(info.show_prices ? { precio: Number(p.price) || 0 } : {}),
      disponible: !!p.in_stock,
    }));

    const wa = String(info.whatsapp || "").replace(/\D/g, "");
    const SYSTEM = `Eres el vendedor virtual de la refaccionaria "${info.name}" (refacciones para motos). Atiendes al público por chat en el catálogo en línea.
REGLAS ESTRICTAS:
- Responde SOLO con base en el INVENTARIO adjunto (JSON). NUNCA inventes piezas, precios ni existencias. Si algo no está en el inventario, di que no lo manejas por ahora y sugiere lo más parecido que SÍ esté (por compatibilidad o categoría).
- ${info.show_prices ? "Da los precios tal como vienen en 'precio' (pesos mexicanos, formato $1,234)." : "NO des precios (el negocio no los publica): invita a preguntar el precio por WhatsApp."}
- Si 'disponible' es false, dilo y ofrece alternativas disponibles.
- Sé amable, mexicano y BREVE: máximo 3-4 frases o una lista corta. Una pregunta aclaratoria a la vez (ej. ¿para qué modelo de moto es?).
- Cuando el cliente muestre intención de compra, invita a cerrar el pedido por WhatsApp${wa ? "" : " del negocio"} diciéndole que ahí lo apartan.
- Solo hablas de las piezas y del negocio. Si te preguntan otra cosa, redirige amablemente al tema.
INVENTARIO (${inv.length} de ${parts.length} piezas, las más relevantes a la pregunta):
${JSON.stringify(inv)}`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 400,
        messages: [{ role: "system", content: SYSTEM }, ...chat],
      }),
    });
    const data = await r.json();
    if (!r.ok) { res.status(502).json({ error: "El asistente no está disponible en este momento." }); return; }
    const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: "El asistente no está disponible en este momento." });
  }
}
