import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_KEY || ""
);

const GA4_ID = process.env.GA4_MEASUREMENT_ID || "";
const PIXEL_ID = process.env.META_PIXEL_ID || "";
const CLARITY_ID = process.env.CLARITY_PROJECT_ID || "";

function buildHomepage() {
  const ga4Script = GA4_ID ? `
    <!-- Google Analytics 4 -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${GA4_ID}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${GA4_ID}');
    </script>` : "";

  const metaPixelScript = PIXEL_ID ? `
    <!-- Meta Pixel -->
    <script>
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
      document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${PIXEL_ID}');
      fbq('track', 'PageView');
    </script>
    <noscript><img height="1" width="1" style="display:none"
      src="https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1"/></noscript>` : "";

  const clarityScript = CLARITY_ID ? `
    <!-- Microsoft Clarity -->
    <script type="text/javascript">
      (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,
      document,"clarity","script","${CLARITY_ID}");
    </script>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>ARSN — AI-Powered Sales on WhatsApp</title>
  ${ga4Script}
  ${metaPixelScript}
  ${clarityScript}
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#f5f5f5;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem}
    .hero{text-align:center;max-width:560px}
    h1{font-size:2.4rem;font-weight:700;line-height:1.2;margin-bottom:1rem}
    h1 span{color:#25d366}
    p{color:#aaa;font-size:1.1rem;line-height:1.6;margin-bottom:2rem}
    form{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center}
    input[type=email]{flex:1;min-width:220px;padding:.75rem 1rem;border-radius:8px;border:1px solid #333;background:#1a1a1a;color:#f5f5f5;font-size:1rem;outline:none}
    input[type=email]:focus{border-color:#25d366}
    button{padding:.75rem 1.5rem;border-radius:8px;border:none;background:#25d366;color:#000;font-weight:600;font-size:1rem;cursor:pointer;white-space:nowrap}
    button:hover{background:#1ebe5a}
    button:disabled{opacity:.6;cursor:not-allowed}
    .msg{margin-top:1rem;font-size:.9rem;min-height:1.2em}
    .msg.ok{color:#25d366}
    .msg.err{color:#f66}
  </style>
</head>
<body>
  <div class="hero">
    <h1>Close more deals on <span>WhatsApp</span> — automatically.</h1>
    <p>ARSN puts an AI sales agent in your WhatsApp inbox. It qualifies leads, answers questions, and pushes toward booking — 24/7, in any language.</p>
    <form id="wf">
      <input type="email" id="email" placeholder="Enter your email" required autocomplete="email"/>
      <button type="submit" id="btn">Join the waitlist</button>
    </form>
    <p class="msg" id="msg"></p>
  </div>
  <script>
    document.getElementById('wf').addEventListener('submit', async function(e) {
      e.preventDefault();
      const btn = document.getElementById('btn');
      const msg = document.getElementById('msg');
      const email = document.getElementById('email').value.trim();
      btn.disabled = true;
      btn.textContent = 'Joining…';
      msg.className = 'msg';
      msg.textContent = '';
      try {
        const r = await fetch('/api/waitlist', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({email})
        });
        const d = await r.json();
        if (r.ok) {
          msg.className = 'msg ok';
          msg.textContent = "You're on the list! We'll be in touch soon.";
          document.getElementById('email').value = '';
          if (typeof fbq !== 'undefined') fbq('track', 'Lead');
          if (typeof gtag !== 'undefined') gtag('event', 'sign_up', {method: 'waitlist'});
        } else {
          msg.className = 'msg err';
          msg.textContent = d.error || 'Something went wrong. Try again.';
        }
      } catch {
        msg.className = 'msg err';
        msg.textContent = 'Network error. Try again.';
      }
      btn.disabled = false;
      btn.textContent = 'Join the waitlist';
    });
  </script>
</body>
</html>`;
}

// Landing page
app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(buildHomepage());
});

// Health check (for monitoring / uptime probes)
app.get("/api/health", (req, res) => res.json({ status: "ARSN API running" }));

// Email waitlist
const waitlistLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
app.post("/api/waitlist", waitlistLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Valid email required" });
  }
  const { error } = await supabase.from("waitlist").insert({ email: email.toLowerCase().trim() });
  if (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Already on the list!" });
    console.error("Waitlist insert error:", error);
    return res.status(500).json({ error: "Could not save email" });
  }
  res.json({ ok: true });
});

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

// Conversations
async function getTenant(req, res) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) { res.status(401).json({ error: "No token" }); return null; }
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) { res.status(401).json({ error: "Invalid token" }); return null; }
  const { data: member } = await supabase.from("tenant_members").select("tenant_id").eq("user_id", user.id).single();
  if (!member) { res.status(403).json({ error: "No tenant" }); return null; }
  return member.tenant_id;
}

// List conversations with lead info + last message preview
app.get("/api/conversations", async (req, res) => {
  const tid = await getTenant(req, res);
  if (!tid) return;

  const { data: convs, error } = await supabase
    .from("conversations")
    .select("id, is_ai_active, created_at, lead:leads(id, phone, state, source, last_activity_at)")
    .eq("tenant_id", tid)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Fetch last message for each conversation
  const withPreviews = await Promise.all((convs || []).map(async (c) => {
    const { data: msgs } = await supabase
      .from("messages")
      .select("role, content, sent_at")
      .eq("conversation_id", c.id)
      .order("sent_at", { ascending: false })
      .limit(1);
    return { ...c, last_message: msgs?.[0] || null };
  }));

  res.json({ conversations: withPreviews });
});

// Get all messages in a conversation
app.get("/api/conversations/:id/messages", async (req, res) => {
  const tid = await getTenant(req, res);
  if (!tid) return;

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, is_ai_active, lead:leads(phone, state)")
    .eq("id", req.params.id)
    .eq("tenant_id", tid)
    .single();

  if (!conv) return res.status(404).json({ error: "Conversation not found" });

  const { data: messages } = await supabase
    .from("messages")
    .select("id, role, content, sent_at, wa_message_id")
    .eq("conversation_id", conv.id)
    .order("sent_at", { ascending: true });

  res.json({ conversation: conv, messages: messages || [] });
});

// Toggle AI on/off for a conversation
app.patch("/api/conversations/:id", async (req, res) => {
  const tid = await getTenant(req, res);
  if (!tid) return;

  const { is_ai_active } = req.body;
  if (typeof is_ai_active !== "boolean") return res.status(400).json({ error: "is_ai_active (boolean) required" });

  const { data, error } = await supabase
    .from("conversations")
    .update({ is_ai_active })
    .eq("id", req.params.id)
    .eq("tenant_id", tid)
    .select("id, is_ai_active")
    .single();

  if (error || !data) return res.status(404).json({ error: "Conversation not found" });
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
