import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_KEY || ""
);

// Health check
app.get("/", (req, res) => res.json({ status: "ARSN API running" }));

// WhatsApp webhook verification
app.get("/api/webhook/whatsapp", (req, res) => {
  const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;
  if (mode === "subscribe" && token === process.env.WA_VERIFY_TOKEN) return res.send(challenge);
  res.status(403).send("Forbidden");
});

// WhatsApp incoming messages
app.post("/api/webhook/whatsapp", async (req, res) => {
  res.status(200).send("OK");
  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    if (!value?.messages?.length) return;
    const waMsg = value.messages[0];
    const phoneId = value.metadata.phone_number_id;
    const from = waMsg.from;
    const text = waMsg.text?.body;
    if (!text) return;

    const { data: tenant } = await supabase.from("tenants").select("*").eq("whatsapp_phone_id", phoneId).single();
    if (!tenant) return;

    let { data: lead } = await supabase.from("leads").select("*").eq("tenant_id", tenant.id).eq("phone", from).single();
    if (!lead) {
      const { data: nl } = await supabase.from("leads").insert({ tenant_id: tenant.id, phone: from, state: "new", source: "whatsapp" }).select().single();
      lead = nl;
    }

    let { data: conv } = await supabase.from("conversations").select("*").eq("tenant_id", tenant.id).eq("lead_id", lead.id).single();
    if (!conv) {
      const { data: nc } = await supabase.from("conversations").insert({ tenant_id: tenant.id, lead_id: lead.id, is_ai_active: true }).select().single();
      conv = nc;
    }

    await supabase.from("messages").insert({ tenant_id: tenant.id, conversation_id: conv.id, role: "user", content: text, wa_message_id: waMsg.id });
    await supabase.from("leads").update({ last_activity_at: new Date().toISOString(), state: lead.state === "new" ? "engaged" : lead.state }).eq("id", lead.id);

    if (!conv.is_ai_active) return;

    const { data: history } = await supabase.from("messages").select("role, content").eq("conversation_id", conv.id).order("sent_at", { ascending: true }).limit(12);
    const aiMessages = (history || []).map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content }));

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", max_tokens: 250,
        messages: [
          { role: "system", content: tenant.ai_system_prompt || `You are a warm sales assistant for ${tenant.name}. Be friendly, concise, push toward booking. Max 60 words.` },
          ...aiMessages,
          { role: "user", content: text }
        ]
      })
    });
    const groqData = await groqRes.json();
    const reply = groqData.choices?.[0]?.message?.content;
    if (!reply) return;

    await supabase.from("messages").insert({ tenant_id: tenant.id, conversation_id: conv.id, role: "ai", content: reply });

    await fetch(`https://graph.facebook.com/v18.0/${tenant.whatsapp_phone_id}/messages`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${tenant.whatsapp_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: from, type: "text", text: { body: reply } })
    });
  } catch(e) { console.error(e); }
});

// Get leads
app.get("/api/leads", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return res.status(401).json({ error: "Invalid token" });
  const { data: member } = await supabase.from("tenant_members").select("tenant_id").eq("user_id", user.id).single();
  if (!member) return res.status(403).json({ error: "No tenant" });
  const { data } = await supabase.from("leads").select("*").eq("tenant_id", member.tenant_id).order("last_activity_at", { ascending: false });
  res.json({ leads: data || [] });
});

// Analytics
app.get("/api/analytics", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return res.status(401).json({ error: "Invalid" });
  const { data: member } = await supabase.from("tenant_members").select("tenant_id").eq("user_id", user.id).single();
  if (!member) return res.status(403).json({ error: "No tenant" });
  const tid = member.tenant_id;
  const { data: leads } = await supabase.from("leads").select("state").eq("tenant_id", tid);
  const { data: orders } = await supabase.from("orders").select("amount").eq("tenant_id", tid).eq("status", "paid");
  const total = leads?.length || 0;
  const converted = leads?.filter(l => l.state === "converted").length || 0;
  const revenue = orders?.reduce((s, o) => s + o.amount, 0) || 0;
  res.json({ leads_total: total, conversion_rate: total > 0 ? Math.round((converted/total)*100) : 0, revenue_total: revenue, avg_order_value: converted > 0 ? Math.round(revenue/converted) : 0 });
});

// Onboard tenant
app.post("/api/auth/onboard", async (req, res) => {
  const { user_id, name, niche, city, description, type } = req.body;
  if (!user_id || !name) return res.status(400).json({ error: "Missing fields" });
  const prompt = `You are a warm sales assistant for ${name}, a ${niche} in ${city||"India"}. ${description||""} Be human, concise, friendly. Max 60 words per reply. Push toward booking.`;
  const { data: tenant, error } = await supabase.from("tenants").insert({ name, niche, city, description, type, owner_id: user_id, ai_system_prompt: prompt }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  await supabase.from("tenant_members").insert({ tenant_id: tenant.id, user_id, role: "owner" });
  res.json({ ok: true, tenant_id: tenant.id, tenant });
});

// Settings
app.get("/api/settings", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);
  const { data: member } = await supabase.from("tenant_members").select("tenant_id").eq("user_id", user.id).single();
  const { data } = await supabase.from("tenants").select("name,niche,city,description,whatsapp_phone_id,ai_system_prompt,plan").eq("id", member.tenant_id).single();
  res.json(data);
});

app.patch("/api/settings", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);
  const { data: member } = await supabase.from("tenant_members").select("tenant_id").eq("user_id", user.id).single();
  const allowed = ["name","niche","city","description","whatsapp_phone_id","whatsapp_token","razorpay_key_id","razorpay_secret","ai_system_prompt"];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  const { data } = await supabase.from("tenants").update(updates).eq("id", member.tenant_id).select().single();
  res.json(data);
});

// Products
app.get("/api/products", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);
  const { data: member } = await supabase.from("tenant_members").select("tenant_id").eq("user_id", user.id).single();
  const { data } = await supabase.from("products").select("*").eq("tenant_id", member.tenant_id);
  res.json(data || []);
});

app.post("/api/products", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);
  const { data: member } = await supabase.from("tenant_members").select("tenant_id").eq("user_id", user.id).single();
  const { name, description, price, category } = req.body;
  const { data } = await supabase.from("products").insert({ tenant_id: member.tenant_id, name, description, price, category }).select().single();
  res.json(data);
});

// Admin
app.get("/api/admin/stats", async (req, res) => {
  const { data: tenants } = await supabase.from("tenants").select("id", { count: "exact" });
  const { data: leads } = await supabase.from("leads").select("id", { count: "exact" });
  const { data: orders } = await supabase.from("orders").select("amount").eq("status", "paid");
  res.json({ total_businesses: tenants?.length||0, total_leads: leads?.length||0, total_revenue: (orders||[]).reduce((s,o)=>s+o.amount,0) });
});

app.get("/api/admin/tenants", async (req, res) => {
  const { data } = await supabase.from("tenants").select("*").order("created_at", { ascending: false });
  res.json(data || []);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`ARSN API running on port ${PORT}`));
