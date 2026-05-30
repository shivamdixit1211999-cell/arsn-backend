import express from "express";
import cors from "cors";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import Razorpay from "razorpay";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
// Capture raw body for Razorpay webhook signature verification
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}));

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

const VALID_STATES = ["new", "engaged", "qualified", "converted", "lost"];

// List leads — supports ?state=engaged&source=whatsapp&search=phone
app.get("/api/leads", async (req, res) => {
  const tid = await getTenant(req, res);
  if (!tid) return;

  let query = supabase.from("leads").select("*").eq("tenant_id", tid);
  if (req.query.state) query = query.eq("state", req.query.state);
  if (req.query.source) query = query.eq("source", req.query.source);
  if (req.query.search) query = query.ilike("phone", `%${req.query.search}%`);
  query = query.order("last_activity_at", { ascending: false });

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ leads: data || [] });
});

// Get single lead with conversation summaries
app.get("/api/leads/:id", async (req, res) => {
  const tid = await getTenant(req, res);
  if (!tid) return;

  const { data: lead, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", req.params.id)
    .eq("tenant_id", tid)
    .single();

  if (error || !lead) return res.status(404).json({ error: "Lead not found" });

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, is_ai_active, created_at")
    .eq("lead_id", lead.id)
    .eq("tenant_id", tid)
    .order("created_at", { ascending: false });

  res.json({ lead, conversations: conversations || [] });
});

// Update lead — state, name, notes
app.patch("/api/leads/:id", async (req, res) => {
  const tid = await getTenant(req, res);
  if (!tid) return;

  const { state, name, notes } = req.body;
  if (state && !VALID_STATES.includes(state)) {
    return res.status(400).json({ error: `state must be one of: ${VALID_STATES.join(", ")}` });
  }

  const allowed = ["state", "name", "notes"];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  if (!Object.keys(updates).length) return res.status(400).json({ error: "Nothing to update" });
  updates.last_activity_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("leads")
    .update(updates)
    .eq("id", req.params.id)
    .eq("tenant_id", tid)
    .select()
    .single();

  if (error || !data) return res.status(404).json({ error: "Lead not found" });
  res.json(data);
});

// Generate Razorpay payment link and optionally send via WhatsApp
app.post("/api/leads/:id/payment-link", async (req, res) => {
  const tid = await getTenant(req, res);
  if (!tid) return;

  const { amount, description = "Payment", send_whatsapp = true } = req.body;
  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    return res.status(400).json({ error: "Valid amount (in ₹) required" });
  }

  const { data: lead } = await supabase
    .from("leads").select("id, phone, name").eq("id", req.params.id).eq("tenant_id", tid).single();
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, razorpay_key_id, razorpay_secret, whatsapp_phone_id, whatsapp_token")
    .eq("id", tid).single();

  if (!tenant?.razorpay_key_id || !tenant?.razorpay_secret) {
    return res.status(400).json({ error: "Razorpay credentials not configured — add them in Settings" });
  }

  const rzp = new Razorpay({ key_id: tenant.razorpay_key_id, key_secret: tenant.razorpay_secret });

  let paymentLink;
  try {
    paymentLink = await rzp.paymentLink.create({
      amount: Math.round(Number(amount) * 100),
      currency: "INR",
      description,
      customer: { name: lead.name || "", contact: `+${lead.phone}` },
      notify: { sms: false, email: false },
      reminder_enable: true,
    });
  } catch (e) {
    console.error("Razorpay error:", e);
    return res.status(502).json({ error: "Failed to create payment link" });
  }

  const { data: order } = await supabase
    .from("orders")
    .insert({
      tenant_id: tid,
      lead_id: lead.id,
      amount: Math.round(Number(amount) * 100),
      status: "pending",
      razorpay_payment_link_id: paymentLink.id,
      razorpay_short_url: paymentLink.short_url,
      description,
    })
    .select().single();

  if (send_whatsapp && tenant.whatsapp_phone_id && tenant.whatsapp_token) {
    const msg = `Hi! Here's your payment link for *${description}*:\n\n${paymentLink.short_url}\n\nAmount: ₹${amount}`;
    await fetch(`https://graph.facebook.com/v18.0/${tenant.whatsapp_phone_id}/messages`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${tenant.whatsapp_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: lead.phone, type: "text", text: { body: msg } }),
    }).catch(e => console.error("WhatsApp send error:", e));
  }

  res.json({ ok: true, payment_link: paymentLink.short_url, order });
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

// Broadcast — send a WhatsApp message to a filtered set of leads
const broadcastLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

app.post("/api/broadcast", broadcastLimiter, async (req, res) => {
  const tid = await getTenant(req, res);
  if (!tid) return;

  const { message, filter = {}, lead_ids } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "message is required" });

  const { data: tenant } = await supabase
    .from("tenants")
    .select("whatsapp_phone_id, whatsapp_token")
    .eq("id", tid).single();

  if (!tenant?.whatsapp_phone_id || !tenant?.whatsapp_token) {
    return res.status(400).json({ error: "WhatsApp not configured — add credentials in Settings" });
  }

  // Resolve target leads
  let leads;
  if (Array.isArray(lead_ids) && lead_ids.length) {
    const { data } = await supabase
      .from("leads").select("id, phone")
      .eq("tenant_id", tid).in("id", lead_ids);
    leads = data;
  } else {
    let query = supabase.from("leads").select("id, phone").eq("tenant_id", tid);
    if (filter.state) query = query.eq("state", filter.state);
    if (filter.source) query = query.eq("source", filter.source);
    const { data } = await query;
    leads = data;
  }

  if (!leads?.length) return res.status(400).json({ error: "No leads matched" });
  if (leads.length > 500) return res.status(400).json({ error: "Broadcast capped at 500 leads per call" });

  // Send in batches of 10 with a small pause to respect WA rate limits
  const results = { sent: 0, failed: 0, total: leads.length };
  const BATCH = 10;

  for (let i = 0; i < leads.length; i += BATCH) {
    const batch = leads.slice(i, i + BATCH);
    await Promise.allSettled(batch.map(async (lead) => {
      try {
        const r = await fetch(`https://graph.facebook.com/v18.0/${tenant.whatsapp_phone_id}/messages`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${tenant.whatsapp_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", to: lead.phone, type: "text", text: { body: message } }),
        });
        r.ok ? results.sent++ : results.failed++;
      } catch { results.failed++; }
    }));
    // Brief pause between batches
    if (i + BATCH < leads.length) await new Promise(r => setTimeout(r, 500));
  }

  res.json({ ok: true, ...results });
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

// Razorpay webhook — must be registered before the tenant-auth helpers
app.post("/api/webhook/razorpay", async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.headers["x-razorpay-signature"];
    const digest = crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex");
    if (sig !== digest) return res.status(400).json({ error: "Invalid signature" });
  }

  const event = req.body;
  if (event.event === "payment_link.paid") {
    const linkId = event.payload.payment_link?.entity?.id;
    if (linkId) {
      const { data: order } = await supabase
        .from("orders")
        .update({ status: "paid" })
        .eq("razorpay_payment_link_id", linkId)
        .select("id, lead_id")
        .single();
      if (order?.lead_id) {
        await supabase.from("leads")
          .update({ state: "converted", last_activity_at: new Date().toISOString() })
          .eq("id", order.lead_id);
      }
    }
  }

  res.json({ ok: true });
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
