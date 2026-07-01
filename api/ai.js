// Función serverless (Vercel): proxy seguro a OpenAI.
// La llave OPENAI_API_KEY vive como variable de entorno en Vercel, nunca en el navegador.

const SB_URL = process.env.SUPABASE_URL || "https://npxjpkcyfgxfbdvvlcrx.supabase.co";
const SB_ANON = process.env.SUPABASE_ANON_KEY || "sb_publishable_kQ-u3skesem-ub6LQBBb5Q_q3WRyXX3";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido" });
    return;
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    res.status(500).json({ error: "Falta configurar OPENAI_API_KEY en Vercel." });
    return;
  }

  // Body (Vercel ya lo parsea cuando es JSON)
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const { system, user, model, org_id } = body;
  if (!user) { res.status(400).json({ error: "Falta el contenido a procesar" }); return; }

  // Solo usuarios autenticados (evita que cualquiera gaste tu saldo de OpenAI)
  const auth = req.headers.authorization || "";
  try {
    if (!auth) { res.status(401).json({ error: "No autorizado" }); return; }
    const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: auth } });
    if (!u.ok) { res.status(401).json({ error: "Sesión no válida" }); return; }
  } catch (e) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }

  // Y solo negocios activos con plan Pro o Elite.
  // La consulta usa el token del usuario: RLS solo le deja ver SU negocio
  // (o todos si es admin), así que no puede pedir por el negocio de otro.
  try {
    if (!/^[0-9a-f-]{36}$/i.test(String(org_id || ""))) { res.status(403).json({ error: "Falta el negocio (org_id)" }); return; }
    const r = await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${org_id}&select=plan,status`, {
      headers: { apikey: SB_ANON, Authorization: auth },
    });
    const rows = r.ok ? await r.json() : [];
    if (!rows.length) { res.status(403).json({ error: "Sin acceso a este negocio" }); return; }
    const { plan, status } = rows[0];
    if (status === "suspended") { res.status(403).json({ error: "Este negocio está suspendido" }); return; }
    if (!["pro", "elite"].includes(plan || "basico")) {
      res.status(403).json({ error: "El Asistente IA está disponible desde el plan Pro. Contacta a Aivoraia para mejorar tu plan." });
      return;
    }
  } catch (e) {
    res.status(403).json({ error: "No se pudo verificar el plan del negocio" });
    return;
  }

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: model || "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: String(user) },
        ],
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      res.status(r.status).json({ error: (data.error && data.error.message) || "Error de OpenAI" });
      return;
    }
    const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: "Error llamando a la IA" });
  }
}
