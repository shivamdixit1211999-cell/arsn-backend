import express from "express";
import cors from "cors";
import crypto from "crypto";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import Razorpay from "razorpay";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(helmet({ contentSecurityPolicy: false })); // CSP off — we serve inline HTML pages
app.use(cors());
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_KEY || ""
);

// ─── Startup env validation ───────────────────────────────────────────────────
const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "GROQ_API_KEY"];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(", ")}. Exiting.`);
  process.exit(1);
}

const GA4_ID     = process.env.GA4_MEASUREMENT_ID || "";
const PIXEL_ID   = process.env.META_PIXEL_ID || "";
const CLARITY_ID = process.env.CLARITY_PROJECT_ID || "";
const VALID_STATES = ["new", "engaged", "qualified", "converted", "lost"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sendWA(phoneId, token, to, body) {
  return fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
  });
}

// Express middleware — resolves Supabase JWT → sets req.tenantId + req.tenantPlan
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Invalid token" });
  const { data: member } = await supabase
    .from("tenant_members").select("tenant_id").eq("user_id", user.id).single();
  if (!member) return res.status(403).json({ error: "No tenant" });
  req.tenantId = member.tenant_id;
  const { data: tenant } = await supabase.from("tenants").select("plan").eq("id", req.tenantId).single();
  req.tenantPlan = tenant?.plan || "free";
  next();
}

// Plan enforcement middleware factory
function requirePlan(requiredPlan) {
  const tiers = ["free", "paid"];
  return (req, res, next) => {
    if (tiers.indexOf(req.tenantPlan) < tiers.indexOf(requiredPlan))
      return res.status(403).json({ error: `This feature requires the ${requiredPlan} plan` });
    next();
  };
}

// Log a lead activity (fire-and-forget)
function logActivity(tenantId, leadId, type, metadata = {}) {
  return supabase.from("lead_activities")
    .insert({ tenant_id: tenantId, lead_id: leadId, type, metadata })
    .then(() => {}).catch(e => console.error("activity log error:", e));
}

// ─── Landing page ─────────────────────────────────────────────────────────────

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
  <title>Dozeage — AI-Powered Sales on WhatsApp</title>
  ${ga4Script}${metaPixelScript}${clarityScript}
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
    .msg.ok{color:#25d366}.msg.err{color:#f66}
  </style>
</head>
<body>
  <div class="hero">
    <h1>Close more deals on <span>WhatsApp</span> — automatically.</h1>
    <p>Dozeage puts an AI sales agent in your WhatsApp inbox. It qualifies leads, answers questions, and pushes toward booking — 24/7, in any language.</p>
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
      btn.disabled = true; btn.textContent = 'Joining…';
      msg.className = 'msg'; msg.textContent = '';
      try {
        const r = await fetch('/api/waitlist', {
          method: 'POST', headers: {'Content-Type':'application/json'},
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
      } catch { msg.className = 'msg err'; msg.textContent = 'Network error. Try again.'; }
      btn.disabled = false; btn.textContent = 'Join the waitlist';
    });
  </script>
</body>
</html>`;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function buildDashboard() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Dozeage Dashboard</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#f5f5f5;min-height:100vh}
    /* Login */
    #login{display:flex;align-items:center;justify-content:center;min-height:100vh}
    .login-box{background:#141414;border:1px solid #222;border-radius:12px;padding:2rem;width:100%;max-width:380px;text-align:center}
    .login-box h2{margin-bottom:.5rem;font-size:1.4rem}
    .login-box p{color:#777;font-size:.85rem;margin-bottom:1.5rem}
    input[type=text],input[type=password]{width:100%;padding:.75rem 1rem;border-radius:8px;border:1px solid #333;background:#1a1a1a;color:#f5f5f5;font-size:.9rem;outline:none;margin-bottom:.75rem}
    input:focus{border-color:#25d366}
    .btn{width:100%;padding:.75rem;border-radius:8px;border:none;background:#25d366;color:#000;font-weight:600;font-size:1rem;cursor:pointer}
    .btn:hover{background:#1ebe5a}
    .err-msg{color:#f66;font-size:.85rem;margin-top:.5rem;min-height:1.2em}
    /* App shell */
    #app{display:none}
    header{background:#111;border-bottom:1px solid #1e1e1e;padding:.9rem 1.5rem;display:flex;align-items:center;justify-content:space-between}
    header h1{font-size:1.1rem;font-weight:700;color:#25d366}
    header button{background:transparent;border:1px solid #333;color:#aaa;padding:.4rem .9rem;border-radius:6px;cursor:pointer;font-size:.85rem}
    header button:hover{border-color:#555;color:#fff}
    main{padding:1.5rem;max-width:1200px;margin:0 auto}
    /* Stat cards */
    .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:2rem}
    .card{background:#141414;border:1px solid #1e1e1e;border-radius:10px;padding:1.2rem}
    .card .label{color:#666;font-size:.8rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem}
    .card .value{font-size:1.8rem;font-weight:700}
    .card .value.green{color:#25d366}
    /* Pipeline */
    .section-title{font-size:.95rem;font-weight:600;color:#aaa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.8rem}
    .pipeline{display:grid;grid-template-columns:repeat(5,1fr);gap:.75rem;margin-bottom:2rem}
    .pipe-col{background:#141414;border:1px solid #1e1e1e;border-radius:10px;padding:1rem;text-align:center}
    .pipe-col .pipe-label{font-size:.75rem;color:#666;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem}
    .pipe-col .pipe-count{font-size:1.6rem;font-weight:700}
    .pipe-col.new .pipe-count{color:#aaa}
    .pipe-col.engaged .pipe-count{color:#60a5fa}
    .pipe-col.qualified .pipe-count{color:#f59e0b}
    .pipe-col.converted .pipe-count{color:#25d366}
    .pipe-col.lost .pipe-count{color:#f87171}
    /* Conversations */
    .conv-list{background:#141414;border:1px solid #1e1e1e;border-radius:10px;overflow:hidden}
    .conv-item{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:1rem;padding:.9rem 1.2rem;border-bottom:1px solid #1a1a1a}
    .conv-item:last-child{border-bottom:none}
    .conv-item:hover{background:#181818}
    .conv-phone{font-weight:600;font-size:.9rem;white-space:nowrap}
    .conv-preview{color:#777;font-size:.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .conv-meta{text-align:right;white-space:nowrap}
    .badge{display:inline-block;padding:.2rem .55rem;border-radius:20px;font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
    .badge.ai-on{background:#0d3321;color:#25d366}
    .badge.ai-off{background:#2a1010;color:#f87171}
    .conv-time{color:#555;font-size:.75rem;margin-top:.25rem}
    .empty{color:#555;text-align:center;padding:2rem;font-size:.9rem}
    .loading{color:#444;text-align:center;padding:2rem;font-size:.9rem}
    @media(max-width:600px){.pipeline{grid-template-columns:repeat(3,1fr)}.conv-item{grid-template-columns:1fr auto}}
  </style>
</head>
<body>

<!-- Login screen -->
<div id="login">
  <div class="login-box">
    <h2>Dozeage Dashboard</h2>
    <p>Paste your Supabase JWT token to continue</p>
    <input type="text" id="token-input" placeholder="eyJ..." autocomplete="off"/>
    <button class="btn" id="login-btn">Sign in</button>
    <div class="err-msg" id="login-err"></div>
  </div>
</div>

<!-- App shell -->
<div id="app">
  <header>
    <h1>Dozeage</h1>
    <button id="logout-btn">Sign out</button>
  </header>
  <main>
    <div class="stats" id="stats"><div class="loading">Loading analytics…</div></div>
    <div class="section-title" style="margin-bottom:.8rem">Lead Pipeline</div>
    <div class="pipeline" id="pipeline"><div class="loading" style="grid-column:1/-1">Loading…</div></div>
    <div class="section-title" style="margin-bottom:.8rem">Recent Conversations</div>
    <div class="conv-list" id="convs"><div class="loading">Loading conversations…</div></div>
  </main>
</div>

<script>
  const KEY = 'dozeage_token';
  const api = (path, tok) => fetch(path, { headers: { Authorization: 'Bearer ' + tok } }).then(r => r.json());

  function timeAgo(iso) {
    if (!iso) return '';
    const s = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s/60) + 'm ago';
    if (s < 86400) return Math.floor(s/3600) + 'h ago';
    return Math.floor(s/86400) + 'd ago';
  }

  function renderStats(a) {
    document.getElementById('stats').innerHTML = [
      ['Total Leads', a.leads_total, ''],
      ['Conversion Rate', a.conversion_rate + '%', 'green'],
      ['Revenue', '₹' + (a.revenue_total/100).toLocaleString('en-IN'), 'green'],
      ['Avg Order', '₹' + (a.avg_order_value/100).toLocaleString('en-IN'), ''],
    ].map(([label, value, cls]) => \`
      <div class="card">
        <div class="label">\${label}</div>
        <div class="value \${cls}">\${value}</div>
      </div>\`).join('');
  }

  function renderPipeline(leads) {
    const counts = Object.fromEntries(['new','engaged','qualified','converted','lost'].map(s => [s, 0]));
    (leads || []).forEach(l => { if (counts[l.state] !== undefined) counts[l.state]++; });
    document.getElementById('pipeline').innerHTML = Object.entries(counts).map(([state, n]) => \`
      <div class="pipe-col \${state}">
        <div class="pipe-label">\${state}</div>
        <div class="pipe-count">\${n}</div>
      </div>\`).join('');
  }

  function renderConvs(convs) {
    if (!convs?.length) {
      document.getElementById('convs').innerHTML = '<div class="empty">No conversations yet</div>';
      return;
    }
    document.getElementById('convs').innerHTML = convs.slice(0, 20).map(c => \`
      <div class="conv-item">
        <div>
          <div class="conv-phone">\${c.lead?.phone || '—'}</div>
          <div class="conv-preview">\${c.last_message?.content || 'No messages yet'}</div>
        </div>
        <div class="conv-meta">
          <div><span class="badge \${c.is_ai_active ? 'ai-on' : 'ai-off'}">\${c.is_ai_active ? 'AI on' : 'Human'}</span></div>
          <div class="conv-time">\${timeAgo(c.last_message?.sent_at || c.created_at)}</div>
        </div>
      </div>\`).join('');
  }

  async function loadDashboard(tok) {
    try {
      const [analytics, leadsRes, convsRes] = await Promise.all([
        api('/api/analytics', tok),
        api('/api/leads?limit=500', tok),
        api('/api/conversations?limit=20', tok),
      ]);
      if (analytics.error) { logout(); return; }
      renderStats(analytics);
      renderPipeline(leadsRes.leads);
      renderConvs(convsRes.conversations);
    } catch(e) {
      document.getElementById('convs').innerHTML = '<div class="empty">Failed to load data</div>';
    }
  }

  function showApp(tok) {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    loadDashboard(tok);
  }

  function logout() {
    localStorage.removeItem(KEY);
    document.getElementById('login').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    document.getElementById('token-input').value = '';
  }

  document.getElementById('login-btn').addEventListener('click', async () => {
    const tok = document.getElementById('token-input').value.trim();
    if (!tok) return;
    const err = document.getElementById('login-err');
    err.textContent = 'Verifying…';
    const d = await api('/api/analytics', tok).catch(() => null);
    if (!d || d.error) { err.textContent = 'Invalid token — check and try again.'; return; }
    localStorage.setItem(KEY, tok);
    err.textContent = '';
    showApp(tok);
  });

  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('token-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-btn').click();
  });

  const saved = localStorage.getItem(KEY);
  if (saved) showApp(saved);
</script>
</body>
</html>`;
}

// ─── Public routes ────────────────────────────────────────────────────────────

app.get("/", (req, res) => { res.setHeader("Content-Type", "text/html"); res.send(buildHomepage()); });
app.get("/dashboard", (req, res) => { res.setHeader("Content-Type", "text/html"); res.send(buildDashboard()); });
app.get("/api/health", (req, res) => res.json({ status: "OK", ts: new Date().toISOString() }));

const waitlistLimiter = rateLimit({ windowMs: 3_600_000, max: 5, standardHeaders: true, legacyHeaders: false });
app.post("/api/waitlist", waitlistLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: "Valid email required" });
  const { error } = await supabase.from("waitlist").insert({ email: email.toLowerCase().trim() });
  if (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Already on the list!" });
    return res.status(500).json({ error: "Could not save email" });
  }
  res.json({ ok: true });
});

app.get("/api/webhook/whatsapp", (req, res) => {
  const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;
  if (mode === "subscribe" && token === process.env.WA_VERIFY_TOKEN) return res.send(challenge);
  res.status(403).send("Forbidden");
});

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
      const { data: nl } = await supabase.from("leads")
        .insert({ tenant_id: tenant.id, phone: from, state: "new", source: "whatsapp" }).select().single();
      lead = nl;
    }

    let { data: conv } = await supabase.from("conversations").select("*").eq("tenant_id", tenant.id).eq("lead_id", lead.id).single();
    if (!conv) {
      const { data: nc } = await supabase.from("conversations")
        .insert({ tenant_id: tenant.id, lead_id: lead.id, is_ai_active: true }).select().single();
      conv = nc;
    }

    await supabase.from("messages").insert({ tenant_id: tenant.id, conversation_id: conv.id, role: "user", content: text, wa_message_id: waMsg.id });
    await supabase.from("leads").update({ last_activity_at: new Date().toISOString(), state: lead.state === "new" ? "engaged" : lead.state }).eq("id", lead.id);

    if (!conv.is_ai_active) return;

    const { data: history } = await supabase.from("messages").select("role, content")
      .eq("conversation_id", conv.id).order("sent_at", { ascending: true }).limit(12);
    const aiMessages = (history || []).map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content }));

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", max_tokens: 250,
        messages: [
          { role: "system", content: tenant.ai_system_prompt || `You are a warm sales assistant for ${tenant.name}. Be friendly, concise, push toward booking. Max 60 words.` },
          ...aiMessages, { role: "user", content: text }
        ]
      })
    });
    const groqData = await groqRes.json();
    const reply = groqData.choices?.[0]?.message?.content;
    if (!reply) return;

    await supabase.from("messages").insert({ tenant_id: tenant.id, conversation_id: conv.id, role: "ai", content: reply });
    await sendWA(tenant.whatsapp_phone_id, tenant.whatsapp_token, from, reply);
  } catch (e) { console.error("WA webhook error:", e); }
});

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
      const { data: order } = await supabase.from("orders")
        .update({ status: "paid" }).eq("razorpay_payment_link_id", linkId)
        .select("id, lead_id").single();
      if (order?.lead_id) {
        await supabase.from("leads")
          .update({ state: "converted", last_activity_at: new Date().toISOString() })
          .eq("id", order.lead_id);
      }
    }
  }
  res.json({ ok: true });
});

app.post("/api/auth/onboard", async (req, res) => {
  const { user_id, name, niche, city, description, type } = req.body;
  if (!user_id || !name) return res.status(400).json({ error: "Missing fields" });
  const prompt = `You are a warm sales assistant for ${name}, a ${niche} in ${city || "India"}. ${description || ""} Be human, concise, friendly. Max 60 words per reply. Push toward booking.`;
  const { data: tenant, error } = await supabase
    .from("tenants").insert({ name, niche, city, description, type, owner_id: user_id, ai_system_prompt: prompt })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  await supabase.from("tenant_members").insert({ tenant_id: tenant.id, user_id, role: "owner" });
  res.json({ ok: true, tenant_id: tenant.id, tenant });
});

// ─── Authenticated routes ─────────────────────────────────────────────────────

// Leads — paginated, filterable
app.get("/api/leads", requireAuth, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const from = (page - 1) * limit;

  let query = supabase.from("leads").select("*", { count: "exact" }).eq("tenant_id", req.tenantId);
  if (req.query.state)  query = query.eq("state", req.query.state);
  if (req.query.source) query = query.eq("source", req.query.source);
  if (req.query.search) query = query.ilike("phone", `%${req.query.search}%`);

  const { data, error, count } = await query
    .order("last_activity_at", { ascending: false }).range(from, from + limit - 1);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ leads: data || [], total: count, page, limit });
});

app.get("/api/leads/:id", requireAuth, async (req, res) => {
  const { data: lead, error } = await supabase
    .from("leads").select("*").eq("id", req.params.id).eq("tenant_id", req.tenantId).single();
  if (error || !lead) return res.status(404).json({ error: "Lead not found" });
  const { data: conversations } = await supabase
    .from("conversations").select("id, is_ai_active, created_at")
    .eq("lead_id", lead.id).eq("tenant_id", req.tenantId).order("created_at", { ascending: false });
  res.json({ lead, conversations: conversations || [] });
});

app.patch("/api/leads/:id", requireAuth, async (req, res) => {
  const { state } = req.body;
  if (state && !VALID_STATES.includes(state))
    return res.status(400).json({ error: `state must be one of: ${VALID_STATES.join(", ")}` });
  const allowed = ["state", "name", "notes"];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  if (!Object.keys(updates).length) return res.status(400).json({ error: "Nothing to update" });
  updates.last_activity_at = new Date().toISOString();
  const { data, error } = await supabase
    .from("leads").update(updates).eq("id", req.params.id).eq("tenant_id", req.tenantId).select().single();
  if (error || !data) return res.status(404).json({ error: "Lead not found" });
  if (updates.state) logActivity(req.tenantId, data.id, "state_change", { state: updates.state });
  if (updates.notes) logActivity(req.tenantId, data.id, "note_added", { note: updates.notes.slice(0, 100) });
  res.json(data);
});

// Bulk lead import — paid plan only
app.post("/api/leads/import", requireAuth, requirePlan("paid"), async (req, res) => {
  const { leads } = req.body;
  if (!Array.isArray(leads) || !leads.length)
    return res.status(400).json({ error: "leads array required" });
  if (leads.length > 1000)
    return res.status(400).json({ error: "Max 1000 leads per import" });

  const rows = leads
    .filter(l => l.phone && String(l.phone).trim())
    .map(l => ({
      tenant_id: req.tenantId,
      phone: String(l.phone).trim(),
      name: l.name || null,
      source: l.source || "import",
      state: VALID_STATES.includes(l.state) ? l.state : "new",
    }));

  if (!rows.length) return res.status(400).json({ error: "No valid leads — phone required for each entry" });

  const { data, error } = await supabase
    .from("leads").upsert(rows, { onConflict: "tenant_id,phone", ignoreDuplicates: false }).select("id");
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, imported: data?.length || 0, total: rows.length });
});

// Schedule a follow-up WhatsApp message
app.post("/api/leads/:id/followup", requireAuth, async (req, res) => {
  const { message, delay_hours = 24 } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "message required" });
  if (isNaN(delay_hours) || Number(delay_hours) < 0)
    return res.status(400).json({ error: "delay_hours must be >= 0" });

  const { data: lead } = await supabase
    .from("leads").select("id").eq("id", req.params.id).eq("tenant_id", req.tenantId).single();
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  const send_at = new Date(Date.now() + Number(delay_hours) * 3_600_000).toISOString();
  const { data, error } = await supabase
    .from("followups")
    .insert({ tenant_id: req.tenantId, lead_id: lead.id, message: message.trim(), send_at, sent: false })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  logActivity(req.tenantId, lead.id, "followup_scheduled", { send_at, message: message.trim().slice(0, 100) });
  res.json({ ok: true, followup: data });
});

// Payment link
app.post("/api/leads/:id/payment-link", requireAuth, async (req, res) => {
  const { amount, description = "Payment", send_whatsapp = true } = req.body;
  if (!amount || isNaN(amount) || Number(amount) <= 0)
    return res.status(400).json({ error: "Valid amount (in ₹) required" });

  const { data: lead } = await supabase
    .from("leads").select("id, phone, name").eq("id", req.params.id).eq("tenant_id", req.tenantId).single();
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  const { data: tenant } = await supabase
    .from("tenants").select("name, razorpay_key_id, razorpay_secret, whatsapp_phone_id, whatsapp_token")
    .eq("id", req.tenantId).single();
  if (!tenant?.razorpay_key_id || !tenant?.razorpay_secret)
    return res.status(400).json({ error: "Razorpay credentials not configured — add them in Settings" });

  const rzp = new Razorpay({ key_id: tenant.razorpay_key_id, key_secret: tenant.razorpay_secret });
  let paymentLink;
  try {
    paymentLink = await rzp.paymentLink.create({
      amount: Math.round(Number(amount) * 100), currency: "INR", description,
      customer: { name: lead.name || "", contact: `+${lead.phone}` },
      notify: { sms: false, email: false }, reminder_enable: true,
    });
  } catch (e) {
    console.error("Razorpay error:", e);
    return res.status(502).json({ error: "Failed to create payment link" });
  }

  const { data: order } = await supabase.from("orders").insert({
    tenant_id: req.tenantId, lead_id: lead.id,
    amount: Math.round(Number(amount) * 100), status: "pending",
    razorpay_payment_link_id: paymentLink.id,
    razorpay_short_url: paymentLink.short_url, description,
  }).select().single();

  if (send_whatsapp && tenant.whatsapp_phone_id && tenant.whatsapp_token) {
    const msg = `Hi! Here's your payment link for *${description}*:\n\n${paymentLink.short_url}\n\nAmount: ₹${amount}`;
    await sendWA(tenant.whatsapp_phone_id, tenant.whatsapp_token, lead.phone, msg)
      .catch(e => console.error("WhatsApp send error:", e));
  }

  logActivity(req.tenantId, lead.id, "payment_link_sent", { amount, description, url: paymentLink.short_url });
  res.json({ ok: true, payment_link: paymentLink.short_url, order });
});

// Conversations — paginated, searchable by message content
app.get("/api/conversations", requireAuth, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const from = (page - 1) * limit;

  let convIds = null;
  if (req.query.search) {
    const { data: msgMatches } = await supabase
      .from("messages").select("conversation_id")
      .eq("tenant_id", req.tenantId)
      .ilike("content", `%${req.query.search}%`);
    convIds = [...new Set((msgMatches || []).map(m => m.conversation_id))];
    if (!convIds.length) return res.json({ conversations: [], total: 0, page, limit });
  }

  let query = supabase
    .from("conversations")
    .select("id, is_ai_active, created_at, lead:leads(id, phone, state, source, last_activity_at)", { count: "exact" })
    .eq("tenant_id", req.tenantId)
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);
  if (convIds) query = query.in("id", convIds);

  const { data: convs, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const withPreviews = await Promise.all((convs || []).map(async (c) => {
    const { data: msgs } = await supabase
      .from("messages").select("role, content, sent_at")
      .eq("conversation_id", c.id).order("sent_at", { ascending: false }).limit(1);
    return { ...c, last_message: msgs?.[0] || null };
  }));

  res.json({ conversations: withPreviews, total: count, page, limit });
});

app.get("/api/conversations/:id/messages", requireAuth, async (req, res) => {
  const { data: conv } = await supabase
    .from("conversations").select("id, is_ai_active, lead:leads(phone, state)")
    .eq("id", req.params.id).eq("tenant_id", req.tenantId).single();
  if (!conv) return res.status(404).json({ error: "Conversation not found" });

  const { data: messages } = await supabase
    .from("messages").select("id, role, content, sent_at, wa_message_id")
    .eq("conversation_id", conv.id).order("sent_at", { ascending: true });
  res.json({ conversation: conv, messages: messages || [] });
});

app.patch("/api/conversations/:id", requireAuth, async (req, res) => {
  const { is_ai_active } = req.body;
  if (typeof is_ai_active !== "boolean")
    return res.status(400).json({ error: "is_ai_active (boolean) required" });
  const { data, error } = await supabase
    .from("conversations").update({ is_ai_active })
    .eq("id", req.params.id).eq("tenant_id", req.tenantId).select("id, is_ai_active").single();
  if (error || !data) return res.status(404).json({ error: "Conversation not found" });
  res.json(data);
});

app.post("/api/conversations/:id/handoff", requireAuth, async (req, res) => {
  const handoffMessage = req.body?.message || "You're now connected with our team. They'll be with you shortly! 🙌";

  const { data: conv } = await supabase
    .from("conversations").select("id, is_ai_active, lead:leads(id, phone, state)")
    .eq("id", req.params.id).eq("tenant_id", req.tenantId).single();
  if (!conv) return res.status(404).json({ error: "Conversation not found" });

  await supabase.from("conversations").update({ is_ai_active: false }).eq("id", conv.id);

  if (["new", "engaged"].includes(conv.lead?.state)) {
    await supabase.from("leads")
      .update({ state: "qualified", last_activity_at: new Date().toISOString() })
      .eq("id", conv.lead.id);
  }

  const { data: tenant } = await supabase
    .from("tenants").select("whatsapp_phone_id, whatsapp_token").eq("id", req.tenantId).single();

  if (tenant?.whatsapp_phone_id && tenant?.whatsapp_token) {
    await sendWA(tenant.whatsapp_phone_id, tenant.whatsapp_token, conv.lead.phone, handoffMessage)
      .catch(e => console.error("WhatsApp handoff error:", e));
    await supabase.from("messages").insert({
      tenant_id: req.tenantId, conversation_id: conv.id, role: "ai", content: handoffMessage,
    });
  }

  logActivity(req.tenantId, conv.lead.id, "handoff", { message: handoffMessage.slice(0, 100) });
  res.json({ ok: true, is_ai_active: false, lead_state: "qualified" });
});

app.post("/api/conversations/:id/resume-ai", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("conversations").update({ is_ai_active: true })
    .eq("id", req.params.id).eq("tenant_id", req.tenantId).select("id, is_ai_active").single();
  if (error || !data) return res.status(404).json({ error: "Conversation not found" });
  res.json({ ok: true, ...data });
});

// Broadcast
const broadcastLimiter = rateLimit({ windowMs: 3_600_000, max: 10, standardHeaders: true, legacyHeaders: false });
app.post("/api/broadcast", broadcastLimiter, requireAuth, requirePlan("paid"), async (req, res) => {
  const { message, filter = {}, lead_ids } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "message is required" });

  const { data: tenant } = await supabase
    .from("tenants").select("whatsapp_phone_id, whatsapp_token").eq("id", req.tenantId).single();
  if (!tenant?.whatsapp_phone_id || !tenant?.whatsapp_token)
    return res.status(400).json({ error: "WhatsApp not configured — add credentials in Settings" });

  let leads;
  if (Array.isArray(lead_ids) && lead_ids.length) {
    const { data } = await supabase.from("leads").select("id, phone").eq("tenant_id", req.tenantId).in("id", lead_ids);
    leads = data;
  } else {
    let q = supabase.from("leads").select("id, phone").eq("tenant_id", req.tenantId);
    if (filter.state)  q = q.eq("state", filter.state);
    if (filter.source) q = q.eq("source", filter.source);
    const { data } = await q;
    leads = data;
  }

  if (!leads?.length) return res.status(400).json({ error: "No leads matched" });
  if (leads.length > 500) return res.status(400).json({ error: "Broadcast capped at 500 leads per call" });

  const results = { sent: 0, failed: 0, total: leads.length };
  const BATCH = 10;
  for (let i = 0; i < leads.length; i += BATCH) {
    await Promise.allSettled(leads.slice(i, i + BATCH).map(async (lead) => {
      try {
        const r = await sendWA(tenant.whatsapp_phone_id, tenant.whatsapp_token, lead.phone, message);
        r.ok ? results.sent++ : results.failed++;
      } catch { results.failed++; }
    }));
    if (i + BATCH < leads.length) await new Promise(r => setTimeout(r, 500));
  }

  res.json({ ok: true, ...results });
});

// Analytics
app.get("/api/analytics", requireAuth, async (req, res) => {
  const { data: leads } = await supabase.from("leads").select("state").eq("tenant_id", req.tenantId);
  const { data: orders } = await supabase.from("orders").select("amount").eq("tenant_id", req.tenantId).eq("status", "paid");
  const total = leads?.length || 0;
  const converted = leads?.filter(l => l.state === "converted").length || 0;
  const revenue = orders?.reduce((s, o) => s + o.amount, 0) || 0;
  res.json({
    leads_total: total,
    conversion_rate: total > 0 ? Math.round((converted / total) * 100) : 0,
    revenue_total: revenue,
    avg_order_value: converted > 0 ? Math.round(revenue / converted) : 0,
  });
});

// Send a WhatsApp message directly to a lead
app.post("/api/leads/:id/send", requireAuth, async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "message required" });

  const { data: lead } = await supabase
    .from("leads").select("id, phone").eq("id", req.params.id).eq("tenant_id", req.tenantId).single();
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  const { data: tenant } = await supabase
    .from("tenants").select("whatsapp_phone_id, whatsapp_token").eq("id", req.tenantId).single();
  if (!tenant?.whatsapp_phone_id || !tenant?.whatsapp_token)
    return res.status(400).json({ error: "WhatsApp not configured — add credentials in Settings" });

  const r = await sendWA(tenant.whatsapp_phone_id, tenant.whatsapp_token, lead.phone, message.trim());
  if (!r.ok) return res.status(502).json({ error: "Failed to send message" });

  // Log in conversation messages if a conversation exists
  const { data: conv } = await supabase
    .from("conversations").select("id").eq("lead_id", lead.id).eq("tenant_id", req.tenantId)
    .order("created_at", { ascending: false }).limit(1).single();
  if (conv) {
    await supabase.from("messages").insert({
      tenant_id: req.tenantId, conversation_id: conv.id, role: "ai", content: message.trim(),
    });
  }

  logActivity(req.tenantId, lead.id, "message_sent", { message: message.trim().slice(0, 100) });
  res.json({ ok: true });
});

// Lead activity timeline
app.get("/api/leads/:id/activity", requireAuth, async (req, res) => {
  const { data: lead } = await supabase
    .from("leads").select("id").eq("id", req.params.id).eq("tenant_id", req.tenantId).single();
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  const { data, error } = await supabase
    .from("lead_activities")
    .select("id, type, metadata, created_at")
    .eq("lead_id", lead.id)
    .eq("tenant_id", req.tenantId)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ activity: data || [] });
});

// Orders — list with optional ?status=pending|paid|failed
app.get("/api/orders", requireAuth, async (req, res) => {
  const page  = Math.max(1, Number(req.query.page)  || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const from  = (page - 1) * limit;

  let query = supabase
    .from("orders")
    .select("*, lead:leads(phone, name, state)", { count: "exact" })
    .eq("tenant_id", req.tenantId);
  if (req.query.status) query = query.eq("status", req.query.status);

  const { data, error, count } = await query
    .order("created_at", { ascending: false }).range(from, from + limit - 1);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ orders: data || [], total: count, page, limit });
});

// Followups — list scheduled and sent for a lead
app.get("/api/leads/:id/followups", requireAuth, async (req, res) => {
  const { data: lead } = await supabase
    .from("leads").select("id").eq("id", req.params.id).eq("tenant_id", req.tenantId).single();
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  const { data, error } = await supabase
    .from("followups")
    .select("id, message, send_at, sent, sent_at, created_at")
    .eq("lead_id", lead.id)
    .eq("tenant_id", req.tenantId)
    .order("send_at", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ followups: data || [] });
});

// Cancel a scheduled followup
app.delete("/api/followups/:id", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("followups")
    .select("id, sent")
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId)
    .single();

  if (error || !data) return res.status(404).json({ error: "Followup not found" });
  if (data.sent) return res.status(400).json({ error: "Already sent — cannot cancel" });

  await supabase.from("followups").delete().eq("id", req.params.id);
  res.json({ ok: true });
});

// Settings
app.get("/api/settings", requireAuth, async (req, res) => {
  const { data } = await supabase
    .from("tenants").select("name,niche,city,description,whatsapp_phone_id,ai_system_prompt,plan")
    .eq("id", req.tenantId).single();
  res.json(data);
});

app.patch("/api/settings", requireAuth, async (req, res) => {
  const allowed = ["name", "niche", "city", "description", "whatsapp_phone_id", "whatsapp_token", "razorpay_key_id", "razorpay_secret", "ai_system_prompt"];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  const { data } = await supabase.from("tenants").update(updates).eq("id", req.tenantId).select().single();
  res.json(data);
});

// Products
app.get("/api/products", requireAuth, async (req, res) => {
  const { data } = await supabase.from("products").select("*").eq("tenant_id", req.tenantId);
  res.json(data || []);
});

app.post("/api/products", requireAuth, async (req, res) => {
  const { name, description, price, category } = req.body;
  const { data } = await supabase
    .from("products").insert({ tenant_id: req.tenantId, name, description, price, category })
    .select().single();
  res.json(data);
});

// Admin
app.get("/api/admin/stats", async (req, res) => {
  const { data: tenants } = await supabase.from("tenants").select("id", { count: "exact" });
  const { data: leads } = await supabase.from("leads").select("id", { count: "exact" });
  const { data: orders } = await supabase.from("orders").select("amount").eq("status", "paid");
  res.json({
    total_businesses: tenants?.length || 0,
    total_leads: leads?.length || 0,
    total_revenue: (orders || []).reduce((s, o) => s + o.amount, 0),
  });
});

app.get("/api/admin/tenants", async (req, res) => {
  const { data } = await supabase.from("tenants").select("*").order("created_at", { ascending: false });
  res.json(data || []);
});

// ─── Follow-up scheduler (runs every 60s) ────────────────────────────────────

setInterval(async () => {
  try {
    const { data: due } = await supabase
      .from("followups")
      .select("id, message, lead:leads(phone), tenant:tenants(whatsapp_phone_id, whatsapp_token)")
      .eq("sent", false)
      .lte("send_at", new Date().toISOString())
      .limit(50);

    for (const f of due || []) {
      try {
        if (f.tenant?.whatsapp_phone_id && f.tenant?.whatsapp_token && f.lead?.phone) {
          await sendWA(f.tenant.whatsapp_phone_id, f.tenant.whatsapp_token, f.lead.phone, f.message);
        }
        await supabase.from("followups")
          .update({ sent: true, sent_at: new Date().toISOString() }).eq("id", f.id);
      } catch (e) { console.error(`Followup ${f.id} failed:`, e); }
    }
  } catch (e) { console.error("Followup scheduler error:", e); }
}, 60_000);

// ─── Global error handler ─────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Dozeage API running on port ${PORT}`));
