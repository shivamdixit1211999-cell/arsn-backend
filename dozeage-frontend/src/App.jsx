import { useState, useRef, useEffect, createContext, useContext, useCallback, useMemo } from "react";
import { fetchAllProducts, shopifyEnabled } from "./shopify.js";

// ─── TOKENS ──────────────────────────────────────────────────────────────────
// CRO-corrected ratio: ivory dominant (70%), emerald accent (20%), gold reward (10%)
const T = {
  ivory:      "#FAF7F2",
  ivoryAlt:   "#F3EFE8",
  ivoryDark:  "#EAE4DA",
  sand:       "#DDD5C8",
  white:      "#FFFFFF",
  emerald:    "#1B4332",
  emeraldMid: "#2D6A4F",
  emeraldLight:"#52B788",
  emeraldBg:  "#EBF5EE",
  gold:       "#B08D57",
  goldLight:  "#D4AF70",
  goldBg:     "#FAF3E0",
  text:       "#2C2C2A",
  textMid:    "#4A4740",
  textMuted:  "#8A847A",
  border:     "#E4DDD3",
  borderLight:"#EDE8E1",
  red:        "#C0392B",
  redBg:      "#FEF2F2",
  shadow:     "rgba(27,67,50,0.07)",
  shadowMd:   "rgba(27,67,50,0.13)",
};

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Jost:wght@300;400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{-webkit-font-smoothing:antialiased;scroll-behavior:smooth;}
body{background:#FAF7F2;color:#2C2C2A;font-family:'Jost',system-ui,sans-serif;overflow-x:hidden;font-size:14px;line-height:1.5;}
button,input,select,textarea{font-family:inherit;}
::selection{background:#1B4332;color:#fff;}
::-webkit-scrollbar{width:3px;height:3px;}
::-webkit-scrollbar-thumb{background:#DDD5C8;border-radius:2px;}
.hscroll{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:4px;}
.hscroll::-webkit-scrollbar{display:none;}
.hscroll>*{scroll-snap-align:start;flex-shrink:0;}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes dot{0%,80%,100%{opacity:.3;transform:scale(.65);}40%{opacity:1;transform:scale(1);}}
@keyframes slideDown{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);}}
@keyframes pulse{0%,100%{opacity:.6;}50%{opacity:1;}}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes marquee{0%{transform:translateX(0);}100%{transform:translateX(-50%);}}
:root{--bot-nav:56px;}
@supports(padding-bottom:env(safe-area-inset-bottom)){:root{--bot-nav:calc(56px + env(safe-area-inset-bottom));}}
`;

// ─── DATA ─────────────────────────────────────────────────────────────────────
const mk = (id,brand,name,sub,cat,concern,price,mrp,badge,sold,rating,reviews,bg,ingredients,desc) =>
  ({id,brand,name,sub,cat,concern,price,mrp,badge,sold,rating,reviews,bg,
    ingredients:ingredients||[],
    desc:desc||name+" by "+brand+"."});

const ALL = [
  mk(1,"The Ordinary","Niacinamide 10% + Zinc 1%","Serums","skin","acne",599,799,"BESTSELLER",2341,4.7,1823,"#EEF4EF"),
  mk(2,"Minimalist","Alpha Arbutin 2% + HA Serum","Serums","skin","pigmentation",499,599,"TRENDING",847,4.6,934,"#F4EFF8"),
  mk(3,"La Roche-Posay","Effaclar Duo+ SPF 30","Moisturisers","skin","acne",1299,1499,"DERM PICK",3100,4.8,2210,"#EDF2F8"),
  mk(4,"Dot & Key","Watermelon Hyaluronic Serum","Serums","skin","hydration",699,849,"",1102,4.5,688,"#F8EDF2"),
  mk(5,"Pilgrim","2% Salicylic Acid Face Wash","Cleansers","skin","acne",349,399,"BESTSELLER",4200,4.4,1540,"#F5F0E8"),
  mk(6,"Minimalist","Sunscreen SPF 50 PA++++","Sunscreen","skin","",399,449,"TRENDING",5100,4.7,3210,"#FDFBF0"),
  mk(7,"Paula's Choice","BHA 2% Liquid Exfoliant","Exfoliants","skin","pores",2999,3299,"DERM PICK",890,4.9,3410,"#F0F0F5"),
  mk(8,"COSRX","Advanced Snail 96 Mucin Essence","Serums","skin","hydration",1299,1499,"",2030,4.7,1870,"#EFF5EF"),
  mk(9,"Bioderma","Sensibio H2O Micellar Water 500ml","Cleansers","skin","sensitivity",899,999,"DERM PICK",6200,4.8,2670,"#EBF3FB"),
  mk(10,"Some By Mi","AHA BHA PHA 30 Days Toner","Toners","skin","acne",899,999,"",1430,4.5,980,"#FBF0F5"),
  mk(11,"Drunk Elephant","T.L.C. Framboos Glycolic Serum","Serums","skin","ageing",5499,5999,"PREMIUM",340,4.8,990,"#F5F0F8"),
  mk(12,"Minimalist","Retinol 0.3% in Squalane","Serums","skin","ageing",699,799,"TRENDING",1890,4.7,780,"#F8F4ED"),
  mk(13,"Cetaphil","Moisturising Lotion SPF 15 250ml","Moisturisers","skin","hydration",449,529,"BESTSELLER",8400,4.7,3200,"#EDF0F8"),
  mk(14,"Plum","Green Tea Pore Cleansing Wash","Cleansers","skin","pores",249,299,"",3800,4.3,1230,"#EEF8EE"),
  mk(15,"Mamaearth","Vitamin C Daily Glow Cream","Moisturisers","skin","glow",399,499,"TRENDING",4100,4.4,2100,"#FBF8ED"),
  mk(16,"SkinCeuticals","C E Ferulic Serum 30ml","Serums","skin","ageing",9500,9500,"PREMIUM",210,4.9,560,"#F0EEF8"),
  mk(17,"Minimalist","Biotin + Caffeine Hair Serum","Serums","hair","hairfall",699,849,"BESTSELLER",3210,4.6,1203,"#EDF3F8"),
  mk(18,"mCaffeine","Coffee Scalp Scrub 100g","Scalp Care","hair","dandruff",349,449,"",1800,4.4,760,"#F5EDE3"),
  mk(19,"Pilgrim","Redensyl 3% Anti Hair Loss Serum","Serums","hair","hairfall",599,699,"NEW",920,4.5,420,"#EBF5F0"),
  mk(20,"Plum","Gentle Micellar Shampoo 300ml","Shampoo","hair","",399,499,"",2100,4.3,870,"#EEF8F4"),
  mk(21,"WellDose","Collagen Builder + Vitamin C","Collagen","wellness","ageing",1299,1599,"NEW",680,4.5,320,"#FAF3E8"),
  mk(22,"WellDose","Ashwagandha KSM-66 600mg 60 Caps","Adaptogens","wellness","energy",599,699,"",920,4.5,445,"#F0F8EC"),
  mk(23,"WellDose","Biotin 10000mcg + Selenium","Vitamins","wellness","hairfall",399,499,"BESTSELLER",4100,4.6,1890,"#EEF5F8"),
  mk(24,"WellDose","Magnesium Glycinate 400mg Sleep","Minerals","wellness","sleep",799,999,"",560,4.7,340,"#EEF0F8"),
];


// Bundles
ALL.push(mk(25,"Dozeage","Acne Starter Kit","Bundles","skin","acne",899,1247,"BUNDLE",1240,4.8,445,"#EEF6EE",["Salicylic Acid 2%","Niacinamide 10%","SPF 50"],"Complete acne routine: cleanser + serum + sunscreen. Save ₹348."));
ALL.push(mk(26,"Dozeage","Glow Edit Kit","Bundles","skin","glow",1099,1547,"BUNDLE",890,4.7,312,"#FBF8EE",["Alpha Arbutin 2%","Hyaluronic Acid","Vitamin C"],"4-week brightening system. Save ₹448."));
ALL.push(mk(27,"Dozeage","Hairfall Protocol Kit","Bundles","hair","hairfall",1199,1648,"BUNDLE",670,4.6,228,"#EDF5F8",["Redensyl 3%","Biotin 10000mcg","Caffeine 0.5%"],"90-day hairfall solution. Save ₹449."));

const CONCERNS = [
  {id:"acne",       label:"Acne & Breakouts",    icon:"◎", accent:"#FEF2F2", border:"#FECACA"},
  {id:"pigmentation",label:"Pigmentation",        icon:"◑", accent:"#F5F3FF", border:"#DDD6FE"},
  {id:"ageing",     label:"Anti-Ageing",          icon:"◈", accent:"#FFF7ED", border:"#FED7AA"},
  {id:"hydration",  label:"Dry & Dehydrated",     icon:"◉", accent:"#EFF6FF", border:"#BFDBFE"},
  {id:"hairfall",   label:"Hairfall & Thinning",  icon:"≋", accent:"#F0FDF4", border:"#BBF7D0"},
  {id:"dandruff",   label:"Dandruff & Scalp",     icon:"⌇", accent:"#FFFBEB", border:"#FDE68A"},
  {id:"glow",       label:"Glow & Radiance",      icon:"✦", accent:"#FEFCE8", border:"#FEF08A"},
  {id:"sensitivity",label:"Sensitive Skin",       icon:"◌", accent:"#FFF1F2", border:"#FECDD3"},
  {id:"pores",      label:"Open Pores",           icon:"○", accent:"#F8FAFC", border:"#CBD5E1"},
  {id:"energy",     label:"Energy & Immunity",    icon:"◆", accent:"#F0FDF4", border:"#86EFAC"},
];

const ROUTINES = [
  {id:"morning",label:"Morning Routine",desc:"Cleanse → Treat → Protect",ids:[5,1,6,3]},
  {id:"night",label:"Night Ritual",desc:"Cleanse → Treat → Repair",ids:[9,12,7,8]},
  {id:"acne",label:"Acne Protocol",desc:"Clear skin in 4 weeks",ids:[5,1,10,3]},
  {id:"glow",label:"Glow Starter Kit",desc:"Visible results in 2 weeks",ids:[4,2,15,6]},
];

const BRANDS_LIST = [
  "The Ordinary","Minimalist","La Roche-Posay","Bioderma","Paula's Choice",
  "Drunk Elephant","Cetaphil","COSRX","Some By Mi","Dot & Key","Pilgrim",
  "Plum","Mamaearth","mCaffeine","SkinCeuticals","Tatcha","WellDose","Kiehl's",
];

const AI_DATA = [
  {t:["oily","acne","pimple","breakout"],r:"For oily, acne-prone skin start with a salicylic acid cleanser, layer niacinamide 10% for sebum control, and close with a non-comedogenic SPF. Consistency over 4 weeks beats any single product.",ps:[5,1,6]},
  {t:["dry","dehydrated","flaky","tight"],r:"Dry skin is a barrier problem. Hyaluronic acid draws water in, ceramide moisturiser seals it. Apply to damp skin always. Avoid anything with alcohol high in the ingredient list.",ps:[4,13,8]},
  {t:["hair","hairfall","thinning","shedding"],r:"Hairfall starts from within — biotin and zinc address the root cause. Pair with a caffeine scalp serum for circulation. Allow 90 days minimum.",ps:[17,18,23]},
  {t:["pigment","dark spot","uneven","melasma"],r:"Alpha Arbutin fades existing spots, Vitamin C prevents new UV damage, SPF protects both. Without daily SPF you're undoing every night's work.",ps:[2,15,6]},
  {t:["age","wrinkle","fine","anti"],r:"Retinol at night starting at 0.3%, SPF every morning without exception. Patience over 12 weeks — consistency beats intensity every time.",ps:[12,7,3]},
  {t:["glow","dull","bright","radiant"],r:"Chemical exfoliation clears surface buildup, hyaluronic acid plumps from within, Vitamin C corrects uneven tone. Morning and evening for two weeks.",ps:[10,8,15]},
];

// ─── CONTEXT ──────────────────────────────────────────────────────────────────

// ── SKIN PROFILE HELPERS ──────────────────────────────────────────────────────
const defaultProfile = () => ({
  name:"", email:"", phone:"",
  skinType:"", concern:"", budget:"", routine:"",
  createdAt: new Date().toISOString(),
  daysSince: 0,
  stage: 1,           // 1=starter 2=active 3=advanced
  milestones: [],     // [{id,title,completedAt}]
  checkIns: [],       // [{date,note,photoUrl}]
  beforePhoto: null,  // base64
  rxStatus: "none",   // none | pending | approved
  rxFile: null,
  notifEmail: "",
  notifConsented: false,
  appointments: [],   // [{date,derm,status}]
  routineProducts: [], // product ids in current routine
});

const MILESTONES = [
  {id:"quiz",     title:"Completed skin quiz",          pts:50,  icon:"✦"},
  {id:"photo",    title:"Uploaded before photo",        pts:100, icon:"📷"},
  {id:"first",    title:"First order placed",           pts:150, icon:"🛍"},
  {id:"day7",     title:"7-day streak",                 pts:100, icon:"🔥"},
  {id:"day30",    title:"30-day consistency",           pts:300, icon:"🌿"},
  {id:"day60",    title:"60-day transformation",        pts:500, icon:"⭐"},
  {id:"rx",       title:"Prescription unlocked",        pts:200, icon:"💊"},
  {id:"review",   title:"Left a product review",        pts:75,  icon:"💬"},
  {id:"refer",    title:"Referred a friend",            pts:250, icon:"🤝"},
];

const RX_PRODUCTS = [11,16]; // Drunk Elephant, SkinCeuticals — Rx-gated

// Delivery date: +3 days Mon–Fri, skip weekends
function getDeliveryDate() {
  const d = new Date(); let added = 0;
  while(added<3){ d.setDate(d.getDate()+1); if(d.getDay()!==0&&d.getDay()!==6) added++; }
  return d.toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});
}
const DELIVERY_DATE = getDeliveryDate(); // computed once at module load


// ─── ATOMS ────────────────────────────────────────────────────────────────────
function Btn({children,onClick,v="fill",sz="md",fw,style={}}) {
  const [h,sh] = useState(false);
  const sizes = {
    sm:{padding:"7px 18px",fontSize:11,letterSpacing:"0.08em"},
    md:{padding:"11px 26px",fontSize:12,letterSpacing:"0.08em"},
    lg:{padding:"14px 36px",fontSize:13,letterSpacing:"0.1em"},
  };
  const base = {cursor:"pointer",fontFamily:"inherit",fontWeight:600,textTransform:"uppercase",
    transition:"all .18s",display:"inline-flex",alignItems:"center",justifyContent:"center",
    gap:6,border:"none",width:fw?"100%":undefined,...sizes[sz]};
  const variants = {
    // CRO FIX: primary CTA is emerald (action), not gold (decorative)
    fill:   {background:h?T.emeraldMid:T.emerald,color:"#fff",boxShadow:h?`0 6px 20px ${T.shadow}`:"none"},
    outline:{background:"transparent",color:h?T.emeraldMid:T.emerald,border:`1.5px solid ${h?T.emeraldMid:T.emerald}`},
    ghost:  {background:"transparent",color:h?T.emerald:T.textMid,border:"none"},
    subtle: {background:h?T.ivoryDark:T.ivoryAlt,color:T.textMid,border:`1px solid ${T.border}`},
    white:  {background:h?"#f0f0ee":"#fff",color:T.emerald,border:"none"},
    // gold kept only for trust/reward UI elements
    gold:   {background:h?T.goldLight:T.gold,color:"#fff"},
  };
  return (
    <button style={{...base,...variants[v],...style}} onClick={onClick}
      onMouseEnter={()=>sh(true)} onMouseLeave={()=>sh(false)}>
      {children}
    </button>
  );
}

function Stars({r,n}) {
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10}}>
      {[1,2,3,4,5].map(i=>(
        <svg key={i} width="8" height="8" viewBox="0 0 24 24"
          fill={i<=Math.round(r)?"#C9956B":"#DDD5C8"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
      <span style={{color:T.textMuted}}>{r}</span>
      {n && <span style={{color:T.textMuted}}>({n>=1000?`${(n/1000).toFixed(1)}k`:n})</span>}
    </span>
  );
}

// Badge: DERM PICK is the high-trust signal for India
function BadgeChip({type,children}) {
  const map = {
    BESTSELLER:{bg:T.emeraldBg,c:T.emerald},
    TRENDING:  {bg:"#FFF7ED",c:"#C2410C"},
    "DERM PICK":{bg:"#EFF6FF",c:"#1D4ED8"},
    PREMIUM:   {bg:T.goldBg,c:T.gold},
    NEW:       {bg:"#F0FDF4",c:"#15803D"},
    "CULT PICK":{bg:T.goldBg,c:T.gold},
    BUNDLE:{bg:"#FDF4FF",c:"#7E22CE"},
  };
  const s = map[type] || map.BESTSELLER;
  return (
    <span style={{background:s.bg,color:s.c,fontSize:8,fontWeight:800,
      letterSpacing:"0.1em",padding:"3px 7px",textTransform:"uppercase",display:"inline-block"}}>
      {children||type}
    </span>
  );
}

// ─── PRODUCT CARD — CRO version ───────────────────────────────────────────────
// CRO fix: card width 160px on mobile (2.3 visible = scroll implied = engagement up)
function PCard({p,width}) {
  const {addCart,cart,setPage,toggleWish,wishlist} = useCtx();
  const [h,sh] = useState(false);
  const inCart = cart[p.id]>0;
  const disc = p.mrp>p.price ? Math.round((1-p.price/p.mrp)*100) : 0;
  const w = width||200;

  return (
    <div onMouseEnter={()=>sh(true)} onMouseLeave={()=>sh(false)}
      style={{width:w,background:T.white,border:`1px solid ${h?T.sand:T.borderLight}`,
        boxShadow:h?`0 8px 24px ${T.shadowMd}`:`0 1px 3px ${T.shadow}`,
        transition:"all .2s ease",transform:h?"translateY(-3px)":"none",
        flexShrink:0,display:"flex",flexDirection:"column",cursor:"pointer",position:"relative"}}>

      {/* Wishlist */}
      <button onClick={e=>{e.stopPropagation();toggleWish(p.id);}}
        style={{position:"absolute",top:8,right:8,zIndex:2,background:"rgba(255,255,255,.85)",
          border:"none",width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",
          cursor:"pointer",borderRadius:"50%",boxShadow:"0 1px 4px rgba(0,0,0,.1)"}}>
        <svg width="12" height="12" viewBox="0 0 24 24"
          fill={wishlist&&wishlist.includes(p.id)?"#C0392B":"none"} stroke="#8A847A" strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
        </svg>
      </button>
      {/* Image area */}
      <div onClick={()=>setPage("product/"+p.id)}
        style={{background:p.bg,height:172,position:"relative",overflow:"hidden",flexShrink:0,
          display:"flex",alignItems:"center",justifyContent:"center"}}>
        {/* Product silhouette */}
        <div style={{textAlign:"center",padding:14,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%"}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:52,fontWeight:600,
            color:"rgba(0,0,0,.1)",lineHeight:1,marginBottom:4,letterSpacing:"-0.02em"}}>
            {p.brand[0]}
          </div>
          <div style={{fontSize:8,fontWeight:700,color:"rgba(0,0,0,.18)",
            letterSpacing:"0.12em",textTransform:"uppercase"}}>{p.brand.split(" ")[0]}</div>
        </div>
        {p.badge && (
          <div style={{position:"absolute",top:8,left:8}}>
            <BadgeChip type={p.badge}/>
          </div>
        )}
        {disc>=10 && (
          <div style={{position:"absolute",top:8,right:8,background:T.red,color:"#fff",
            fontSize:8,fontWeight:800,padding:"3px 6px",letterSpacing:"0.06em"}}>
            {disc}% OFF
          </div>
        )}
        {/* Hover quick-view */}
        {h && (
          <div style={{position:"absolute",inset:0,background:"rgba(27,67,50,.05)",
            display:"flex",alignItems:"flex-end",padding:10,animation:"fadeIn .12s ease"}}>
            <button onClick={e=>{e.stopPropagation();setPage("product/"+p.id);}}
              style={{width:"100%",background:"rgba(255,255,255,.92)",color:T.emerald,
                border:"none",padding:"6px",fontSize:10,fontWeight:700,
                letterSpacing:"0.08em",textTransform:"uppercase",cursor:"pointer",fontFamily:"inherit"}}>
              Quick View
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{padding:"10px 11px 13px",flex:1,display:"flex",flexDirection:"column",gap:4}}>
        <div style={{fontSize:9,color:T.gold,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase"}}>{p.brand}</div>
        <div style={{fontSize:12,fontWeight:500,color:T.text,lineHeight:1.3,flex:1,
          display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
          {p.name}
        </div>
        <Stars r={p.rating} n={p.reviews}/>
        <div style={{fontSize:10,color:T.emeraldMid,fontWeight:600}}>
          {p.sold>=1000?`${(p.sold/1000).toFixed(1)}k`:`${p.sold}`} sold this week
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:3,gap:4}}>
          <div>
            <span style={{fontSize:14,fontWeight:700,letterSpacing:"-0.01em"}}>₹{p.price.toLocaleString()}</span>
            {p.mrp>p.price && (
              <span style={{fontSize:10,color:T.textMuted,textDecoration:"line-through",marginLeft:4}}>
                ₹{p.mrp}
              </span>
            )}
          </div>
          {/* CRO FIX: emerald Add button — action signal, not decoration */}
          <button onClick={e=>{e.stopPropagation();addCart(p.id);}}
            style={{background:inCart?T.emerald:T.emeraldBg,color:inCart?"#fff":T.emerald,
              border:"none",padding:"7px 12px",fontSize:10,fontWeight:700,
              letterSpacing:"0.04em",cursor:"pointer",transition:"all .15s",
              textTransform:"uppercase",fontFamily:"inherit",flexShrink:0}}>
            {inCart?"✓ Added":"Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SCROLL ROW with arrows ────────────────────────────────────────────────────
function ScrollRow({products,cardWidth,title,sub,cta,onCta}) {
  const rowRef = useRef();
  const scroll = dir => {
    if(rowRef.current) rowRef.current.scrollBy({left:dir*220,behavior:"smooth"});
  };
  return (
    <div>
      {title && (
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",
          marginBottom:16,gap:12}}>
          <div>
            {sub && <div style={{fontSize:10,fontWeight:600,color:T.emeraldMid,
              letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:5}}>{sub}</div>}
            <h2 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",
              fontSize:"clamp(18px,2.2vw,26px)",fontWeight:500,color:T.text,lineHeight:1.1}}>
              {title}
            </h2>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
            {cta && (
              <Btn v="ghost" sz="sm" onClick={onCta}
                style={{fontSize:11,padding:"6px 12px"}}>
                {cta} &#8594;
              </Btn>
            )}
            <button onClick={()=>scroll(-1)}
              style={{width:30,height:30,background:T.white,border:`1px solid ${T.border}`,
                cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:14,color:T.textMid,transition:"all .15s",fontFamily:"inherit"}}
              onMouseEnter={e=>{e.currentTarget.style.background=T.emerald;e.currentTarget.style.color="#fff";e.currentTarget.style.borderColor=T.emerald;}}
              onMouseLeave={e=>{e.currentTarget.style.background=T.white;e.currentTarget.style.color=T.textMid;e.currentTarget.style.borderColor=T.border;}}>
              ‹
            </button>
            <button onClick={()=>scroll(1)}
              style={{width:30,height:30,background:T.white,border:`1px solid ${T.border}`,
                cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:14,color:T.textMid,transition:"all .15s",fontFamily:"inherit"}}
              onMouseEnter={e=>{e.currentTarget.style.background=T.emerald;e.currentTarget.style.color="#fff";e.currentTarget.style.borderColor=T.emerald;}}
              onMouseLeave={e=>{e.currentTarget.style.background=T.white;e.currentTarget.style.color=T.textMid;e.currentTarget.style.borderColor=T.border;}}>
              &rsaquo;
            </button>
          </div>
        </div>
      )}
      <div ref={rowRef} className="hscroll">
        {products.map(p=><PCard key={p.id} p={p} width={cardWidth||200}/>)}
      </div>
    </div>
  );
}

// ─── NAV — CRO fix: collapse on scroll, 76px total when scrolled ──────────────
function Nav({page,setPage}) {
  const {cartCount,setCartOpen,setAiOpen,setProfileOpen,wishlist,setPage:navSetPage,user,setAuthOpen} = useCtx();
  const isMobile = useWindowWidth() < 768;
  const [scrolled,setScrolled] = useState(false);
  const [mega,setMega]         = useState(null);
  const [searchVal,setSearchVal] = useState("");
  const [searchFocus,setSF]    = useState(false);
  const [menuOpen,setMenuOpen] = useState(false);
  const timerRef = useRef(null);
  const searchRef = useRef();

  useEffect(()=>{
    const h = ()=>setScrolled(window.scrollY>40);
    window.addEventListener("scroll",h);
    return ()=>window.removeEventListener("scroll",h);
  },[]);

  const openMega  = id => { clearTimeout(timerRef.current); setMega(id); };
  const closeMega = ()  => { timerRef.current = setTimeout(()=>setMega(null),150); };

  const CATS = [
    {id:"skin",     label:"Skincare"},
    {id:"hair",     label:"Hair"},
    {id:"wellness", label:"Wellness"},
    {id:"makeup",   label:"Makeup"},
    {id:"body",     label:"Body"},
    {id:"mens",     label:"Men"},
    {id:"brands",   label:"Brands"},
  ];

  const MEGA_SUBS = {
    skin:["Serums","Moisturisers","Cleansers","Sunscreen","Toners","Eye Care","Exfoliants","Masks"],
    hair:["Shampoo","Conditioner","Serums","Scalp Care","Hair Oils","Masks","Supplements","Styling"],
    wellness:["Vitamins","Supplements","Collagen","Adaptogens","Probiotics","Protein","Sleep","Immunity"],
    makeup:["Foundation","Concealer","Lip","Eye","Blush","Setting","Primer","Highlighter"],
    body:["Body Wash","Scrubs","Lotion","SPF Body","Hand Care","Deodorant","Oils","Foot Care"],
    mens:["Face Wash","Moisturiser","Beard","Sunscreen","Body Wash","Hair","Supplements","Deodorant"],
  };

  // Inline search suggestions
  const suggestions = searchVal.length>1
    ? ALL.filter(p=>p.name.toLowerCase().includes(searchVal.toLowerCase())||p.brand.toLowerCase().includes(searchVal.toLowerCase())).slice(0,5)
    : [];

  return (
    <div style={{position:"fixed",top:0,left:0,right:0,zIndex:1000}}>
      {/* Utility bar — CRO fix: hidden on scroll, mobile-simplified */}
      <div style={{
        background:T.emerald,
        height: scrolled ? 0 : "auto",
        overflow: "hidden",
        transition:"height .25s ease",
      }}>
        <div style={{padding:`6px ${isMobile?"14px":"32px"}`,display:"flex",justifyContent:"space-between",
          alignItems:"center",fontSize:11,color:"rgba(255,255,255,.65)",letterSpacing:"0.05em"}}>
          <span style={{fontWeight:400,whiteSpace:"nowrap"}}>Free delivery above ₹499 &middot; Pan India</span>
          <div style={{display:"flex",gap:16,alignItems:"center"}}>
            {!isMobile && (
              <span onClick={()=>setPage("b2b")}
                style={{cursor:"pointer",transition:"color .15s",fontWeight:500,whiteSpace:"nowrap"}}
                onMouseEnter={e=>e.target.style.color="#fff"}
                onMouseLeave={e=>e.target.style.color="rgba(255,255,255,.65)"}>
                B2B / Wholesale
              </span>
            )}
            <span onClick={()=>user?setPage("account"):setAuthOpen(true)}
              style={{cursor:"pointer",transition:"color .15s",fontWeight:600,color:user?"#fff":"rgba(255,255,255,.65)",whiteSpace:"nowrap"}}
              onMouseEnter={e=>e.target.style.color="#fff"}
              onMouseLeave={e=>e.target.style.color=user?"#fff":"rgba(255,255,255,.65)"}>
              {user?`Hi, ${user.name.split(" ")[0]}`:"Sign In"}
            </span>
          </div>
        </div>
      </div>

      {/* Main bar — shrinks on scroll: 60px -&gt; 48px */}
      <div style={{
        background:T.ivory,
        borderBottom:`1px solid ${scrolled?T.border:"transparent"}`,
        padding:`0 ${isMobile?"12px":"32px"}`,
        height: scrolled ? 48 : 58,
        display:"flex",alignItems:"center",gap:16,
        transition:"all .22s ease",
        boxShadow: scrolled ? `0 1px 12px ${T.shadow}` : "none",
      }}>
        <div onClick={()=>setPage("home")}
          style={{fontFamily:"'Cormorant Garamond',serif",fontSize:scrolled?20:22,
            fontWeight:500,color:T.emerald,cursor:"pointer",flexShrink:0,
            userSelect:"none",letterSpacing:"0.06em",fontStyle:"italic",transition:"font-size .2s"}}>
          Dozeage
        </div>

        {/* CRO fix: real expanding search with inline suggestions */}
        {!isMobile && <div style={{flex:1,maxWidth:500,position:"relative"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,
            background:searchFocus?T.white:T.ivoryAlt,
            border:`1.5px solid ${searchFocus?T.emerald:T.border}`,
            padding:"8px 14px",transition:"all .15s"}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke={searchFocus?T.emerald:T.textMuted} strokeWidth="2.2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input ref={searchRef}
              value={searchVal}
              onChange={e=>setSearchVal(e.target.value)}
              onFocus={()=>setSF(true)}
              onBlur={()=>setTimeout(()=>setSF(false),200)}
              onKeyDown={e=>{if(e.key==="Enter"&&searchVal.trim()){setPage("search/"+searchVal);setSearchVal("");setSF(false);}}}
              placeholder="Search products, brands, ingredients…"
              style={{flex:1,background:"transparent",border:"none",outline:"none",
                fontSize:13,color:T.text,fontFamily:"inherit"}}/>
            {searchVal && (
              <button onClick={()=>setSearchVal("")}
                style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",
                  fontSize:14,lineHeight:1,padding:0,fontFamily:"inherit"}}>×</button>
            )}
          </div>
          {/* Inline suggestions dropdown */}
          {searchFocus && suggestions.length>0 && (
            <div style={{position:"absolute",top:"100%",left:0,right:0,background:T.white,
              border:`1px solid ${T.border}`,borderTop:"none",
              boxShadow:`0 8px 24px ${T.shadow}`,zIndex:10,animation:"fadeIn .1s ease"}}>
              {suggestions.map(p=>(
                <div key={p.id}
                  onClick={()=>{setPage("product/"+p.id);setSearchVal("");setSF(false);}}
                  style={{display:"flex",alignItems:"center",gap:12,
                    padding:"10px 14px",cursor:"pointer",transition:"background .12s",
                    borderBottom:`1px solid ${T.borderLight}`}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.ivoryAlt}
                  onMouseLeave={e=>e.currentTarget.style.background=T.white}>
                  <div style={{width:32,height:32,background:p.bg,flexShrink:0,border:`1px solid ${T.border}`}}/>
                  <div>
                    <div style={{fontSize:9,color:T.gold,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em"}}>{p.brand}</div>
                    <div style={{fontSize:12,color:T.text,fontWeight:500,lineHeight:1.3}}>{p.name}</div>
                  </div>
                  <span style={{marginLeft:"auto",fontSize:13,fontWeight:700,color:T.text,flexShrink:0}}>₹{p.price}</span>
                </div>
              ))}
            </div>
          )}
        </div>}

        <div style={{display:"flex",gap:8,alignItems:"center",marginLeft:"auto",flexShrink:0}}>
          {!isMobile && <Btn v="outline" sz="sm" onClick={()=>setPage("quiz")}>Find My Dose</Btn>}
          {isMobile && (
            <button onClick={()=>navSetPage("search")}
              style={{display:"flex",alignItems:"center",padding:"8px 10px",
                background:T.ivoryAlt,border:`1px solid ${T.border}`,cursor:"pointer",fontFamily:"inherit"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=T.emerald}
              onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="1.8">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>
          )}
          {/* Wishlist icon */}
          <button onClick={()=>navSetPage("wishlist")}
            style={{display:"flex",alignItems:"center",gap:5,padding:"8px 12px",
              background:T.ivoryAlt,border:`1px solid ${T.border}`,cursor:"pointer",
              position:"relative",fontFamily:"inherit",transition:"all .15s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=T.emerald}
            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="1.8">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
            {wishlist&&wishlist.length>0&&(
              <span style={{background:T.red,color:"#fff",borderRadius:"50%",
                width:15,height:15,fontSize:8,fontWeight:800,display:"flex",
                alignItems:"center",justifyContent:"center"}}>{wishlist.length}</span>
            )}
          </button>
          {/* Profile icon */}
          <button onClick={()=>setProfileOpen(true)}
            style={{display:"flex",alignItems:"center",gap:5,padding:"8px 12px",
              background:T.ivoryAlt,border:`1px solid ${T.border}`,cursor:"pointer",
              fontFamily:"inherit",transition:"all .15s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=T.emerald}
            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="1.8">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </button>
          <button onClick={()=>setCartOpen(true)}
            style={{display:"flex",alignItems:"center",gap:7,
              padding:"8px 14px",background:T.ivoryAlt,
              border:`1px solid ${T.border}`,cursor:"pointer",
              transition:"all .15s",position:"relative",fontFamily:"inherit"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=T.emerald;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={T.text} strokeWidth="1.8">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
            {!isMobile && <span style={{fontSize:12,fontWeight:600,color:T.text}}>Cart</span>}
            {cartCount>0 && (
              <span style={{background:T.emerald,color:"#fff",borderRadius:"50%",
                width:17,height:17,fontSize:9,fontWeight:800,display:"flex",
                alignItems:"center",justifyContent:"center"}}>
                {cartCount}
              </span>
            )}
          </button>
          {/* Hamburger — mobile only */}
          {isMobile && (
            <button onClick={()=>setMenuOpen(m=>!m)}
              style={{display:"flex",flexDirection:"column",justifyContent:"center",gap:4,
                padding:"9px 10px",background:menuOpen?T.emerald:T.ivoryAlt,
                border:`1px solid ${menuOpen?T.emerald:T.border}`,cursor:"pointer",fontFamily:"inherit",
                transition:"all .15s"}}>
              <span style={{display:"block",width:16,height:1.5,background:menuOpen?"#fff":T.text,transition:"all .2s"}}/>
              <span style={{display:"block",width:16,height:1.5,background:menuOpen?"#fff":T.text,transition:"all .2s"}}/>
              <span style={{display:"block",width:10,height:1.5,background:menuOpen?"#fff":T.text,transition:"all .2s"}}/>
            </button>
          )}
        </div>
      </div>

      {/* Category nav — compresses on scroll */}
      <div style={{position:"relative"}}>
      {isMobile && <div style={{position:"absolute",right:0,top:0,bottom:0,width:36,
        background:"linear-gradient(to right,transparent,"+T.ivory+")",pointerEvents:"none",zIndex:1}}/>}
      <div style={{
        background:T.ivory,
        borderBottom:`1px solid ${T.border}`,
        padding:`0 ${isMobile?"10px":"32px"}`,
        display:"flex",gap:0,overflowX:"auto",scrollbarWidth:"none",
        transition:"all .22s ease",
      }}>
        <div onClick={()=>setPage("home")}
          style={{padding:scrolled?"7px 14px":"9px 14px",fontSize:11,
            fontWeight:page==="home"?700:500,
            color:page==="home"?T.emerald:T.textMid,
            borderBottom:`2px solid ${page==="home"?T.emerald:"transparent"}`,
            cursor:"pointer",whiteSpace:"nowrap",letterSpacing:"0.06em",
            textTransform:"uppercase",transition:"all .18s",flexShrink:0}}>
          Home
        </div>
        {CATS.map(c=>{
          const isActive = page===c.id || page.startsWith(c.id+"/");
          return (
            <div key={c.id}
              onMouseEnter={()=>MEGA_SUBS[c.id]&&openMega(c.id)}
              onMouseLeave={closeMega}
              onClick={()=>{setPage(c.id);setMega(null);}}
              style={{padding:scrolled?"7px 14px":"9px 14px",fontSize:11,
                fontWeight:isActive?700:500,
                color:isActive?T.emerald:T.textMid,
                borderBottom:`2px solid ${isActive?T.emerald:"transparent"}`,
                cursor:"pointer",whiteSpace:"nowrap",letterSpacing:"0.06em",
                textTransform:"uppercase",transition:"all .18s",flexShrink:0}}>
              {c.label}
            </div>
          );
        })}
        <div onClick={()=>setPage("b2b")}
          style={{padding:scrolled?"7px 14px":"9px 14px",fontSize:11,fontWeight:500,
            color:T.gold,borderBottom:"2px solid transparent",cursor:"pointer",
            whiteSpace:"nowrap",letterSpacing:"0.06em",textTransform:"uppercase",flexShrink:0}}>
          B2B
        </div>
      </div>
      </div>

      {/* Mega menu */}
      {mega && MEGA_SUBS[mega] && !isMobile && (
        <div onMouseEnter={()=>openMega(mega)} onMouseLeave={closeMega}
          style={{background:T.white,borderBottom:`1px solid ${T.border}`,
            padding:"22px 32px",boxShadow:`0 8px 32px ${T.shadow}`,
            animation:"slideDown .14s ease",display:"grid",
            gridTemplateColumns:"1fr 1fr",gap:40,maxWidth:580}}>
          <div>
            <div style={{fontSize:9,fontWeight:700,color:T.textMuted,letterSpacing:"0.14em",
              textTransform:"uppercase",marginBottom:12}}>Categories</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:2}}>
              {MEGA_SUBS[mega].map(s=>(
                <div key={s}
                  onClick={()=>{setPage(mega+"/"+s.toLowerCase().replace(/ /g,"-"));setMega(null);}}
                  style={{fontSize:12,color:T.textMid,padding:"7px 10px",cursor:"pointer",transition:"all .12s"}}
                  onMouseEnter={e=>{e.currentTarget.style.color=T.emerald;e.currentTarget.style.background=T.emeraldBg;}}
                  onMouseLeave={e=>{e.currentTarget.style.color=T.textMid;e.currentTarget.style.background="transparent";}}>
                  {s}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:9,fontWeight:700,color:T.textMuted,letterSpacing:"0.14em",
              textTransform:"uppercase",marginBottom:12}}>By Concern</div>
            {CONCERNS.slice(0,6).map(c=>(
              <div key={c.id}
                onClick={()=>{setPage("concern/"+c.id);setMega(null);}}
                style={{fontSize:12,color:T.textMid,padding:"6px 10px",cursor:"pointer",transition:"all .12s"}}
                onMouseEnter={e=>{e.currentTarget.style.color=T.emerald;e.currentTarget.style.background=T.emeraldBg;}}
                onMouseLeave={e=>{e.currentTarget.style.color=T.textMid;e.currentTarget.style.background="transparent";}}>
                {c.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobile slide-out menu */}
      {menuOpen && (
        <>
          <div onClick={()=>setMenuOpen(false)}
            style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:1099,backdropFilter:"blur(2px)"}}/>
          <div style={{position:"fixed",top:0,left:0,bottom:0,width:282,background:T.white,
            zIndex:1100,overflowY:"auto",boxShadow:"4px 0 40px rgba(0,0,0,.18)",
            animation:"fadeIn .18s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"18px 20px 14px",borderBottom:`1px solid ${T.border}`}}>
              <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:21,fontWeight:500,
                color:T.emerald,fontStyle:"italic",letterSpacing:"0.04em"}}>Dozeage</span>
              <button onClick={()=>setMenuOpen(false)}
                style={{background:"none",border:"none",fontSize:24,color:T.textMuted,
                  cursor:"pointer",fontFamily:"inherit",lineHeight:1,padding:"0 2px"}}>×</button>
            </div>
            <div style={{padding:"8px 0"}}>
              {[
                ["home","Home"],["skin","Skincare"],["hair","Hair"],["wellness","Wellness"],
                ["makeup","Makeup"],["body","Body"],["mens","Men"],["brands","Brands"],
                ["quiz","Skin Quiz"],["myskin","My Skin"],["consult","Consult a Derm"],
                ["wishlist","Wishlist"],["b2b","B2B / Wholesale"],
              ].map(([pg,label])=>(
                <button key={pg} onClick={()=>{setPage(pg);setMenuOpen(false);}}
                  style={{display:"block",width:"100%",textAlign:"left",padding:"12px 20px",
                    background:"transparent",border:"none",fontSize:13,fontWeight:page===pg?700:500,
                    color:page===pg?T.emerald:T.text,cursor:"pointer",fontFamily:"inherit",
                    borderLeft:`3px solid ${page===pg?T.emerald:"transparent"}`,
                    transition:"background .1s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.ivoryAlt}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{margin:"8px 20px 0",paddingTop:16,borderTop:`1px solid ${T.border}`}}>
              {user ? (
                <div>
                  <div style={{fontSize:12,color:T.textMuted,marginBottom:8}}>
                    Signed in as <strong style={{color:T.text}}>{user.name.split(" ")[0]}</strong>
                  </div>
                  <Btn v="outline" sz="sm" onClick={()=>{setPage("account");setMenuOpen(false);}}>My Account</Btn>
                </div>
              ) : (
                <Btn onClick={()=>{setMenuOpen(false);setAuthOpen(true);}}>Sign In / Sign Up</Btn>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}


// ─── AOV PROGRESS BAR COMPONENT ──────────────────────────────────────────────
function AOVBar({subtotal}) {
  const FREE=499, D1=1500, D2=2500;
  const tiers=[
    {threshold:FREE, label:`Add ₹${FREE-subtotal} for free delivery`,      color:T.emerald},
    {threshold:D1,   label:`Add ₹${D1-subtotal} more to save ₹150`,   color:"#7C3AED"},
    {threshold:D2,   label:`Add ₹${D2-subtotal} more to save ₹300`,   color:"#B45309"},
  ];
  const next = tiers.find(t=>subtotal<t.threshold);
  if(!next) return (
    <div style={{padding:"10px 22px",background:T.emeraldBg,borderBottom:"1px solid "+T.borderLight}}>
      <div style={{fontSize:11,color:T.emerald,fontWeight:700}}>Maximum savings unlocked!</div>
    </div>
  );
  const prev = tiers[tiers.indexOf(next)-1];
  const base = prev?prev.threshold:0;
  const pct = Math.min(((subtotal-base)/(next.threshold-base))*100,100);
  return (
    <div style={{padding:"10px 22px",background:T.emeraldBg,borderBottom:"1px solid "+T.borderLight}}>
      <div style={{fontSize:11,color:next.color,fontWeight:600,marginBottom:6}}>{next.label}</div>
      <div style={{height:4,background:T.ivoryDark,borderRadius:2,overflow:"hidden"}}>
        <div style={{height:"100%",width:pct+"%",background:next.color,transition:"width .5s ease",borderRadius:2}}/>
      </div>
    </div>
  );
}

// ─── CART DRAWER ──────────────────────────────────────────────────────────────
function CartDrawer() {
  const {cart,setCart,cartOpen,setCartOpen,setPage:drawerSetPage} = useCtx();
  const items    = ALL.filter(p=>cart[p.id]>0);
  const subtotal = items.reduce((s,p)=>s+p.price*cart[p.id],0);
  const savings  = items.reduce((s,p)=>s+(p.mrp-p.price)*cart[p.id],0);
  return (
    <>
      {cartOpen && (
        <div onClick={()=>setCartOpen(false)}
          style={{position:"fixed",inset:0,background:"rgba(26,26,24,.4)",
            zIndex:1200,backdropFilter:"blur(3px)"}}/>
      )}
      <div style={{position:"fixed",top:0,right:0,bottom:0,width:"min(400px,100vw)",
        zIndex:1300,background:T.ivory,borderLeft:`1px solid ${T.border}`,
        transform:cartOpen?"translateX(0)":"translateX(100%)",
        transition:"transform .36s cubic-bezier(.16,1,.3,1)",
        display:"flex",flexDirection:"column",boxShadow:`-4px 0 28px ${T.shadowMd}`}}>
        <div style={{padding:"16px 22px",borderBottom:`1px solid ${T.border}`,
          display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,
            fontWeight:500,fontStyle:"italic",color:T.text}}>
            Your Bag ({items.length})
          </div>
          <button onClick={()=>setCartOpen(false)}
            style={{background:T.ivoryAlt,border:`1px solid ${T.border}`,
              width:30,height:30,fontSize:16,display:"flex",alignItems:"center",
              justifyContent:"center",color:T.textMid,cursor:"pointer",fontFamily:"inherit"}}>
            ×
          </button>
        </div>
        <AOVBar subtotal={subtotal}/>
        <div style={{flex:1,overflowY:"auto",padding:"0 22px"}}>
          {items.length===0 ? (
            <div style={{padding:"60px 0",textAlign:"center"}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,
                color:T.textMuted,marginBottom:8,fontStyle:"italic"}}>
                Your bag is empty
              </div>
              <div style={{fontSize:12,color:T.textMuted,marginBottom:20}}>Discover your skin's daily dose</div>
              <Btn v="outline" onClick={()=>setCartOpen(false)}>Continue Shopping</Btn>
            </div>
          ) : items.map(p=>(
            <div key={p.id} style={{display:"flex",gap:13,padding:"14px 0",
              borderBottom:`1px solid ${T.borderLight}`}}>
              <div style={{width:56,height:56,background:p.bg,flexShrink:0,border:`1px solid ${T.border}`}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:9,color:T.gold,fontWeight:700,letterSpacing:"0.1em",
                  textTransform:"uppercase",marginBottom:2}}>{p.brand}</div>
                <div style={{fontSize:12,fontWeight:500,color:T.text,lineHeight:1.3,marginBottom:6}}>{p.name}</div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{fontSize:14,fontWeight:700}}>₹{p.price.toLocaleString()}</span>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <button onClick={()=>setCart(prev=>({...prev,[p.id]:Math.max(0,(prev[p.id]||0)-1)}))}
                      style={{width:24,height:24,background:T.ivoryAlt,border:`1px solid ${T.border}`,
                        fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",
                        alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>−</button>
                    <span style={{fontSize:12,fontWeight:700,minWidth:14,textAlign:"center"}}>{cart[p.id]}</span>
                    <button onClick={()=>setCart(prev=>({...prev,[p.id]:(prev[p.id]||0)+1}))}
                      style={{width:24,height:24,background:T.ivoryAlt,border:`1px solid ${T.border}`,
                        fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",
                        alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>+</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {items.length>0 && (
          <div style={{padding:"16px 22px",borderTop:`1px solid ${T.border}`}}>
            {savings>0 && (
              <div style={{fontSize:11,color:T.emeraldMid,fontWeight:600,marginBottom:8}}>
                You save ₹{savings.toLocaleString()} on this order
              </div>
            )}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:14}}>
              <span style={{fontSize:11,color:T.textMuted,letterSpacing:"0.08em",textTransform:"uppercase"}}>Subtotal</span>
              <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600}}>₹{subtotal.toLocaleString()}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12,fontSize:12,color:T.emeraldMid,fontWeight:600}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.emeraldMid} strokeWidth="2">
                <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
              Get it by <strong style={{marginLeft:3}}>{DELIVERY_DATE}</strong>
            </div>
            <Btn fw sz="lg" onClick={()=>{setCartOpen(false);drawerSetPage("checkout");}}>Proceed to Checkout →</Btn>
            <div style={{display:"flex",justifyContent:"center",gap:16,marginTop:10}}>
              <button onClick={()=>setCartOpen(false)}
                style={{background:"none",border:"none",fontSize:11,color:T.textMuted,cursor:"pointer",
                  fontFamily:"inherit",letterSpacing:"0.04em",textDecoration:"underline",padding:0}}>
                Continue Shopping
              </button>
              <span style={{color:T.borderLight}}>·</span>
              <span style={{fontSize:11,color:T.textMuted}}>Free delivery above ₹499</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── AI BAR ───────────────────────────────────────────────────────────────────
function AIBar() {
  const {addCart,cart} = useCtx();
  const [open,setOpen]   = useState(false);
  const [inp,setInp]     = useState("");
  const [thinking,setTk] = useState(false);
  const [res,setRes]     = useState(null);
  const ref = useRef();
  useEffect(()=>{ if(open) setTimeout(()=>ref.current?.focus(),300); },[open]);

  const run = () => {
    if(!inp.trim()) return;
    setTk(true); setRes(null);
    setTimeout(()=>{
      const l = inp.toLowerCase();
      let m = AI_DATA[0];
      for(const s of AI_DATA){ if(s.t.some(t=>l.includes(t))){ m=s; break; } }
      setRes(m); setTk(false);
    },1600);
  };

  return (
    <>
      {!open && (
        <div onClick={()=>setOpen(true)}
          style={{position:"fixed",bottom:0,left:0,right:0,zIndex:900,
            background:T.emerald,padding:"12px 32px",
            display:"flex",alignItems:"center",justifyContent:"center",gap:12,
            cursor:"pointer",transition:"background .15s"}}
          onMouseEnter={e=>e.currentTarget.style.background=T.emeraldMid}
          onMouseLeave={e=>e.currentTarget.style.background=T.emerald}>
          <span style={{width:6,height:6,borderRadius:"50%",background:"#A8E6CF",animation:"pulse 2s infinite"}}/>
          <span style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,.9)",
            letterSpacing:"0.14em",textTransform:"uppercase"}}>
            AI Skin Advisor - Describe your concern
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="rgba(255,255,255,.5)" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>
      )}
      <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:950,
        background:T.ivory,borderTop:`2px solid ${T.emerald}`,
        boxShadow:`0 -8px 40px ${T.shadowMd}`,
        transform:open?"translateY(0)":"translateY(100%)",
        transition:"transform .38s cubic-bezier(.16,1,.3,1)",
        maxHeight:"68vh",overflowY:"auto"}}>
        <div style={{maxWidth:1100,margin:"0 auto",padding:"22px 32px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:T.emeraldLight}}/>
                <span style={{fontSize:9,fontWeight:700,color:T.emerald,
                  letterSpacing:"0.16em",textTransform:"uppercase"}}>AI Skin Advisor</span>
              </div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,
                fontWeight:500,fontStyle:"italic",color:T.text}}>
                Describe your concern. Get matched products.
              </div>
            </div>
            <button onClick={()=>{setOpen(false);setRes(null);setInp("");}}
              style={{background:T.ivoryAlt,border:`1px solid ${T.border}`,width:30,height:30,
                fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",
                color:T.textMid,cursor:"pointer",flexShrink:0,marginLeft:16,fontFamily:"inherit"}}>
              ×
            </button>
          </div>
          <div style={{display:"flex",gap:10,marginBottom:14}}>
            <input ref={ref} value={inp} onChange={e=>setInp(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&run()}
              placeholder="e.g. oily skin with acne and dark spots..."
              style={{flex:1,background:T.white,border:`1.5px solid ${T.border}`,
                padding:"11px 15px",fontSize:13,outline:"none",color:T.text,
                transition:"border-color .15s",fontFamily:"inherit"}}
              onFocus={e=>e.target.style.borderColor=T.emerald}
              onBlur={e=>e.target.style.borderColor=T.border}/>
            <Btn onClick={run} sz="md">Analyse -&gt;</Btn>
          </div>
          {!res && !thinking && (
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {["Oily + acne","Dry skin","Hairfall","Pigmentation","Anti-ageing","Glow"].map(s=>(
                <button key={s} onClick={()=>setInp(s)}
                  style={{background:T.white,border:`1px solid ${T.border}`,
                    padding:"5px 12px",fontSize:11,fontWeight:500,color:T.textMid,
                    cursor:"pointer",transition:"all .14s",fontFamily:"inherit"}}
                  onMouseEnter={e=>{e.currentTarget.style.background=T.emeraldBg;e.currentTarget.style.color=T.emerald;e.currentTarget.style.borderColor=T.emerald;}}
                  onMouseLeave={e=>{e.currentTarget.style.background=T.white;e.currentTarget.style.color=T.textMid;e.currentTarget.style.borderColor=T.border;}}>
                  {s}
                </button>
              ))}
            </div>
          )}
          {thinking && (
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"18px 0"}}>
              {[0,1,2].map(i=>(
                <span key={i} style={{width:8,height:8,borderRadius:"50%",background:T.emerald,
                  display:"inline-block",animation:`dot 1.4s ${i*.16}s infinite`}}/>
              ))}
              <span style={{fontSize:12,color:T.textMuted,fontWeight:500}}>Analysing your skin profile</span>
            </div>
          )}
          {res && (
            <div style={{display:"grid",gridTemplateColumns:"260px 1fr",gap:36,
              paddingTop:18,borderTop:`1px solid ${T.borderLight}`,animation:"fadeUp .28s ease"}}>
              <div>
                <div style={{fontSize:9,fontWeight:700,color:T.textMuted,
                  textTransform:"uppercase",letterSpacing:"0.14em",marginBottom:10}}>
                  Advisor's Note
                </div>
                <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,
                  color:T.text,lineHeight:1.9,marginBottom:14,fontWeight:400}}>
                  {res.r}
                </p>
                <button onClick={()=>{setRes(null);setInp("");}}
                  style={{background:"none",border:"none",color:T.textMuted,fontSize:11,
                    cursor:"pointer",textDecoration:"underline",letterSpacing:"0.06em",
                    fontFamily:"inherit"}}>
                  Try differently
                </button>
              </div>
              <div>
                <div style={{fontSize:9,fontWeight:700,color:T.textMuted,
                  textTransform:"uppercase",letterSpacing:"0.14em",marginBottom:10}}>
                  Matched for You
                </div>
                <div style={{display:"flex",gap:12}}>
                  {res.ps.map(id=>{
                    const p=ALL.find(x=>x.id===id);
                    return p ? <PCard key={p.id} p={p} width={180}/> : null;
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── PAGE: HOME ───────────────────────────────────────────────────────────────
// CRO fix: products-FIRST hero — 4 product cards visible above fold before any copy
function Home({setPage}) {
  const {addCart,cart,showNotif,profile} = useCtx();
  const isMobile = useWindowWidth() < 768;

  const ROWS = useMemo(()=>[
    {id:"trending",  title:"Trending This Week",       sub:"Most Loved",              prods:ALL.filter(p=>p.badge==="TRENDING"||p.badge==="BESTSELLER")},
    {id:"skin",      title:"Skincare Essentials",       sub:"Skin",                    prods:ALL.filter(p=>p.cat==="skin")},
    {id:"derm",      title:"Dermatologist Recommended", sub:"Expert picks",            prods:ALL.filter(p=>p.badge==="DERM PICK"||p.rating>=4.7)},
    {id:"under999",  title:"Under ₹999",                sub:"Budget-friendly",         prods:ALL.filter(p=>p.price<999)},
    {id:"hair",      title:"Hair & Scalp",              sub:"Hair",                    prods:ALL.filter(p=>p.cat==="hair")},
    {id:"wellness",  title:"Wellness & Supplements",    sub:"Wellness",                prods:ALL.filter(p=>p.cat==="wellness")},
    {id:"bundles",   title:"Curated Kits",              sub:"Save more",               prods:ALL.filter(p=>p.badge==="BUNDLE")},
    {id:"premium",   title:"Premium & Luxury",          sub:"Luxury",                  prods:ALL.filter(p=>p.badge==="PREMIUM"||p.price>=2000)},
  ],[]);

  return (
    <div style={{paddingBottom:80}}>

      {/* ── HERO: ivory base, products front-centre ─────────────────────── */}
      {/* CRO: products-first layout. Headline is secondary to product visibility */}
      <section style={{background:T.ivory,borderBottom:`1px solid ${T.border}`,
        padding:"32px 32px 0",overflow:"hidden"}}>
        <div style={{maxWidth:1140,margin:"0 auto"}}>

          {/* Hero: single left-aligned editorial block */}
          <div style={{marginBottom:28}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:8,
              background:T.emeraldBg,border:`1px solid ${T.emeraldLight}44`,
              padding:"5px 12px",marginBottom:14}}>
              <span style={{width:4,height:4,borderRadius:"50%",background:T.emeraldLight}}/>
              <span style={{fontSize:9,fontWeight:700,color:T.emerald,
                letterSpacing:"0.16em",textTransform:"uppercase"}}>
                India's Premium Wellness Platform
              </span>
            </div>
            <h1 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",
              fontSize:"clamp(32px,4.5vw,62px)",fontWeight:400,color:T.text,
              lineHeight:1.02,letterSpacing:"-0.01em",marginBottom:20,
              maxWidth:isMobile?"100%":580}}>
              Your skin.<br/>Your ritual.<br/>
              <span style={{fontStyle:"italic",color:T.emerald}}>Your daily dose.</span>
            </h1>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <Btn sz="lg" onClick={()=>setPage("skin")}>Shop Now →</Btn>
              <Btn sz="lg" v="outline" onClick={()=>setPage("quiz")}>Find My Dose</Btn>
            </div>
          </div>

          {/* CRO: 12 products in horizontal scroll — immediately visible */}
          <div className="hscroll" style={{paddingBottom:0,alignItems:"stretch"}}>
            {ALL.slice(0,12).map(p=>(
              <div key={p.id}
                style={{width:150,flexShrink:0,background:T.white,cursor:"pointer",
                  border:`1px solid ${T.borderLight}`,display:"flex",flexDirection:"column",
                  transition:"all .18s",boxShadow:`0 2px 8px ${T.shadow}`}}
                onClick={()=>setPage("product/"+p.id)}>
                <div style={{background:p.bg,height:130,flexShrink:0,display:"flex",alignItems:"center",
                  justifyContent:"center",position:"relative"}}>
                  <div style={{textAlign:"center",padding:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%"}}>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:44,fontWeight:600,
                      color:"rgba(0,0,0,.12)",lineHeight:1,marginBottom:4,letterSpacing:"-0.02em"}}>
                      {p.brand[0]}
                    </div>
                    <div style={{fontSize:7,fontWeight:700,color:"rgba(0,0,0,.2)",
                      letterSpacing:"0.12em",textTransform:"uppercase"}}>{p.brand.split(" ")[0]}</div>
                  </div>
                  {p.badge && (
                    <div style={{position:"absolute",top:6,left:6}}>
                      <BadgeChip type={p.badge}/>
                    </div>
                  )}
                </div>
                <div style={{padding:"9px 10px 11px",flex:1,display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontSize:8,color:T.gold,fontWeight:700,letterSpacing:"0.1em",
                      textTransform:"uppercase",marginBottom:3}}>{p.brand}</div>
                    <div style={{fontSize:11,fontWeight:500,color:T.text,lineHeight:1.3,
                      marginBottom:7,display:"-webkit-box",WebkitLineClamp:2,
                      WebkitBoxOrient:"vertical",overflow:"hidden",minHeight:28}}>
                      {p.name}
                    </div>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:13,fontWeight:700}}>&#8377;{p.price}</span>
                    <button onClick={e=>{e.stopPropagation();addCart(p.id);}}
                      style={{background:cart[p.id]?T.emerald:T.emeraldBg,
                        color:cart[p.id]?"#fff":T.emerald,
                        border:"none",padding:"5px 9px",fontSize:9,fontWeight:700,
                        cursor:"pointer",fontFamily:"inherit",textTransform:"uppercase"}}>
                      {cart[p.id]?"Added":"Add"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ─────────────────────────────────────────────────────── */}
      <div style={{background:T.white,borderBottom:`1px solid ${T.borderLight}`,overflow:"hidden"}}>
        {isMobile ? (
          /* Mobile: auto-scrolling marquee ticker */
          <div style={{position:"relative",overflow:"hidden",height:44}}>
            <div style={{display:"flex",animation:"marquee 18s linear infinite",width:"max-content",alignItems:"center",height:"100%"}}>
              {[...Array(2)].flatMap((_,ri)=>
                [
                  ["✦","100% Authentic","Direct from brands"],
                  ["✦","Dermatologist Curated","Expert-vetted"],
                  ["✦","10L+ Customers","Trusted & loved"],
                  ["✦","Free Delivery","Above ₹499"],
                  ["✦","Easy Returns","7-day hassle-free"],
                ].map(([dot,h,s],i)=>(
                  <div key={`${ri}-${i}`} style={{display:"flex",alignItems:"center",gap:6,padding:"0 22px",whiteSpace:"nowrap",borderRight:`1px solid ${T.borderLight}`}}>
                    <span style={{color:T.emerald,fontSize:8}}>✦</span>
                    <span style={{fontSize:11,fontWeight:700,color:T.text}}>{h}</span>
                    <span style={{fontSize:10,color:T.textMuted}}>— {s}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Desktop: 5-column grid */
          <div style={{maxWidth:1140,margin:"0 auto",display:"flex"}}>
            {[
              ["100% Authentic","Direct from brands"],
              ["Dermatologist Curated","Expert-vetted SKUs"],
              ["10L+ Customers","Trusted & loved"],
              ["Free Delivery","Orders above ₹499"],
              ["Easy Returns","7-day hassle-free"],
            ].map(([h,s],i)=>(
              <div key={h} style={{flex:1,padding:"13px 0",textAlign:"center",
                borderRight:i<4?`1px solid ${T.borderLight}`:"none",minWidth:0}}>
                <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:1,
                  whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",padding:"0 6px"}}>
                  {h}
                </div>
                <div style={{fontSize:10,color:T.textMuted,whiteSpace:"nowrap",
                  overflow:"hidden",textOverflow:"ellipsis",padding:"0 6px"}}>
                  {s}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <div style={{maxWidth:1140,margin:"0 auto",padding:"0 32px"}}>

        {/* Shop by Concern */}
        <section style={{padding:"40px 0 36px"}}>
          <div style={{display:"flex",justifyContent:"space-between",
            alignItems:"flex-end",marginBottom:18}}>
            <div>
              <div style={{fontSize:10,fontWeight:600,color:T.emeraldMid,
                letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:5}}>
                Personalised discovery
              </div>
              <h2 style={{fontFamily:"'Cormorant Garamond',serif",
                fontSize:"clamp(20px,2.2vw,28px)",fontWeight:500,color:T.text}}>
                Shop by Concern
              </h2>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:7}}>
            {CONCERNS.map(c=>(
              <div key={c.id} onClick={()=>setPage("concern/"+c.id)}
                style={{background:c.accent,border:`1.5px solid ${c.border}`,
                  padding:"12px 14px",cursor:"pointer",transition:"all .16s",display:"flex",alignItems:"center",gap:10}}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 6px 16px rgba(0,0,0,.08)`;}}
                onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
                <span style={{fontSize:16,flexShrink:0,opacity:0.7}}>{c.icon}</span>
                <div style={{fontSize:12,fontWeight:600,color:T.text,lineHeight:1.3}}>{c.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* All horizontal scroll sections — each separated by a light rule */}
        {ROWS.map((row,i)=>(
          <section key={row.id} style={{
            paddingBottom:40,
            borderTop:i===0?"none":`1px solid ${T.borderLight}`,
            paddingTop:i===0?0:40,
          }}>
            <ScrollRow
              products={row.prods}
              title={row.title}
              sub={row.sub}
              cta="View all"
              onCta={()=>setPage(
                row.id==="under999"||row.id==="derm"||row.id==="trending"?"all":row.id
              )}
              cardWidth={200}
            />
          </section>
        ))}

        {/* Routine Builder */}
        <section style={{paddingBottom:44,borderTop:`1px solid ${T.borderLight}`,paddingTop:40}}>
          <div style={{marginBottom:20}}>
            <div style={{fontSize:10,fontWeight:600,color:T.emeraldMid,
              letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:5}}>
              Guided shopping
            </div>
            <h2 style={{fontFamily:"'Cormorant Garamond',serif",
              fontSize:"clamp(20px,2.2vw,28px)",fontWeight:500,color:T.text}}>
              Build Your Routine
            </h2>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:12}}>
            {ROUTINES.map(r=>(
              <div key={r.id}
                onClick={()=>setPage("concern/"+r.id)}
                style={{background:T.white,border:`1px solid ${T.border}`,
                  padding:"22px 20px",cursor:"pointer",transition:"all .18s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=T.emerald;e.currentTarget.style.boxShadow=`0 4px 18px ${T.shadow}`;e.currentTarget.style.transform="translateY(-2px)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="none";}}>
                <div style={{display:"flex",gap:5,marginBottom:12}}>
                  {r.ids.slice(0,3).map(id=>{
                    const p=ALL.find(x=>x.id===id);
                    return p ? (
                      <div key={id} style={{width:34,height:34,background:p.bg,
                        border:`1px solid ${T.borderLight}`}}/>
                    ) : null;
                  })}
                  <div style={{width:34,height:34,background:T.ivoryAlt,
                    border:`1px solid ${T.borderLight}`,display:"flex",
                    alignItems:"center",justifyContent:"center",
                    fontSize:11,color:T.textMuted}}>
                    +{r.ids.length-3}
                  </div>
                </div>
                <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:3}}>{r.label}</div>
                <div style={{fontSize:11,color:T.textMuted,marginBottom:14}}>{r.desc}</div>
                <Btn v="outline" sz="sm">View Routine -&gt;</Btn>
              </div>
            ))}
          </div>
        </section>

        {/* Ingredient storytelling — emerald accent section */}
        <section style={{paddingBottom:44,borderTop:`1px solid ${T.borderLight}`,paddingTop:40}}>
          <div style={{background:T.emerald,padding:"36px 40px",
            display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:28}}>
            {[
              {ing:"Niacinamide",benefit:"Controls oil, minimises pores, fades dark spots in 4 weeks",n:"14 products"},
              {ing:"Hyaluronic Acid",benefit:"24-hour deep hydration at multiple skin levels",n:"11 products"},
              {ing:"Retinol",benefit:"Stimulates collagen, reduces fine lines, refines texture",n:"8 products"},
            ].map((item,i)=>(
              <div key={item.ing} style={{borderLeft:`2px solid rgba(255,255,255,.15)`,paddingLeft:22}}>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:19,fontWeight:500,
                  color:T.goldLight,marginBottom:8,fontStyle:"italic"}}>
                  {item.ing}
                </div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.6)",lineHeight:1.7,marginBottom:10}}>{item.benefit}</div>
                <div style={{fontSize:9,color:"rgba(255,255,255,.35)",letterSpacing:"0.1em",textTransform:"uppercase"}}>{item.n}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Brand Rail */}
        <section style={{paddingBottom:44,borderTop:`1px solid ${T.borderLight}`,paddingTop:40}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:18}}>
            <div>
              <div style={{fontSize:10,fontWeight:600,color:T.emeraldMid,
                letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:5}}>
                200+ brands
              </div>
              <h2 style={{fontFamily:"'Cormorant Garamond',serif",
                fontSize:"clamp(20px,2.2vw,28px)",fontWeight:500,color:T.text}}>
                Shop by Brand
              </h2>
            </div>
            <Btn v="ghost" sz="sm" onClick={()=>setPage("brands")}>All Brands -&gt;</Btn>
          </div>
          <div className="hscroll">
            {BRANDS_LIST.map(b=>(
              <div key={b}
                style={{flexShrink:0,background:T.white,border:`1px solid ${T.border}`,
                  padding:"10px 18px",cursor:"pointer",transition:"all .14s",
                  whiteSpace:"nowrap",fontSize:12,fontWeight:500,color:T.textMid}}
                onMouseEnter={e=>{e.currentTarget.style.background=T.emeraldBg;e.currentTarget.style.color=T.emerald;e.currentTarget.style.borderColor=T.emerald;}}
                onMouseLeave={e=>{e.currentTarget.style.background=T.white;e.currentTarget.style.color=T.textMid;e.currentTarget.style.borderColor=T.border;}}>
                {b}
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* B2B Banner — CRO fix: ivory bg NOT dark green (avoid double dark bookend) */}
      <section style={{background:T.ivoryDark,borderTop:`1px solid ${T.border}`,
        borderBottom:`1px solid ${T.border}`,padding:"44px 32px"}}>
        <div style={{maxWidth:1140,margin:"0 auto",display:"flex",
          alignItems:"center",justifyContent:"space-between",gap:40,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:9,fontWeight:700,color:T.textMuted,letterSpacing:"0.16em",
              textTransform:"uppercase",marginBottom:10}}>
              For professionals
            </div>
            <h2 style={{fontFamily:"'Cormorant Garamond',serif",
              fontSize:"clamp(20px,2.8vw,34px)",fontWeight:400,color:T.text,
              lineHeight:1.1,marginBottom:10}}>
              Wholesale for Clinics, Pharmacies & Salons.
            </h2>
            <p style={{fontSize:13,color:T.textMuted,lineHeight:1.65}}>
              Better pricing &middot; Private label &middot; Ordering panel &middot; 200+ brands
            </p>
          </div>
          <Btn sz="lg" onClick={()=>setPage("b2b")}>Apply for B2B Access -&gt;</Btn>
        </div>
      </section>

    </div>
  );
}

// ─── PAGE: CATALOG ────────────────────────────────────────────────────────────
function Catalog({cat}) {
  const {addCart,cart} = useCtx();
  const isMobile = useWindowWidth() < 768;
  const [filters,setFilters] = useState({sort:"default",sub:"all",price:"all"});
  const [search,setSearch]   = useState("");
  const [filterOpen,setFilterOpen] = useState(false);
  const setF = (k,v) => setFilters(p=>({...p,[k]:v}));

  const catId   = cat ? cat.split("/")[0] : "all";
  const subSlug = cat ? cat.split("/")[1] : null;
  const isConcern = cat && cat.startsWith("concern/");
  const concernId = isConcern ? cat.split("/")[1] : null;

  let prods = [...ALL]
    .filter(p => isConcern ? p.concern===concernId : (catId==="all" ? true : p.cat===catId))
    .filter(p => !subSlug||!isConcern ? (filters.sub==="all"||p.sub===filters.sub) : true)
    .filter(p => filters.price==="all"
      ||(filters.price==="u500"&&p.price<500)
      ||(filters.price==="500-1500"&&p.price>=500&&p.price<1500)
      ||(filters.price==="1500+"&&p.price>=1500))
    .filter(p => !search||p.name.toLowerCase().includes(search.toLowerCase())||p.brand.toLowerCase().includes(search.toLowerCase()));

  if(filters.sort==="popular") prods=[...prods].sort((a,b)=>b.reviews-a.reviews);
  if(filters.sort==="rating")  prods=[...prods].sort((a,b)=>b.rating-a.rating);
  if(filters.sort==="p-asc")   prods=[...prods].sort((a,b)=>a.price-b.price);
  if(filters.sort==="p-desc")  prods=[...prods].sort((a,b)=>b.price-a.price);

  const subs = [...new Set(ALL.filter(p=>catId==="all"||p.cat===catId).map(p=>p.sub))];
  const concernLabel = concernId ? CONCERNS.find(c=>c.id===concernId)?.label : null;
  const title = concernLabel || (catId==="all"?"All Products":catId.charAt(0).toUpperCase()+catId.slice(1));

  return (
    <div style={{paddingBottom:100,background:T.ivory}}>
      <div style={{background:T.white,borderBottom:`1px solid ${T.border}`,padding:"18px 32px 16px"}}>
        <div style={{fontSize:11,color:T.textMuted,marginBottom:8}}>Home / {title}</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
          <div>
            <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(24px,3vw,40px)",fontWeight:400,color:T.text,lineHeight:1,fontStyle:"italic"}}>{title}</h1>
            <div style={{fontSize:12,color:T.textMuted,marginTop:5}}>{prods.length} products</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {isMobile && (
              <button onClick={()=>setFilterOpen(true)}
                style={{display:"flex",alignItems:"center",gap:5,padding:"9px 13px",
                  background:T.ivoryAlt,border:`1px solid ${T.border}`,cursor:"pointer",
                  fontSize:12,fontWeight:600,color:T.text,fontFamily:"inherit",flexShrink:0,
                  letterSpacing:"0.04em"}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2">
                  <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/>
                  <line x1="11" y1="18" x2="13" y2="18"/>
                </svg>
                Filter & Sort
              </button>
            )}
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..."
              style={{background:T.ivoryAlt,border:`1px solid ${T.border}`,padding:"9px 13px",fontSize:12,outline:"none",color:T.text,width:isMobile?120:200,fontFamily:"inherit",transition:"border-color .15s"}}
              onFocus={e=>e.target.style.borderColor=T.emerald}
              onBlur={e=>e.target.style.borderColor=T.border}/>
          </div>
        </div>
        {!isConcern && (
          <div style={{display:"flex",gap:6,marginTop:12,flexWrap:"wrap"}}>
            <button onClick={()=>setF("sub","all")}
              style={{background:filters.sub==="all"?T.emerald:T.ivoryAlt,color:filters.sub==="all"?"#fff":T.textMid,border:`1px solid ${filters.sub==="all"?T.emerald:T.border}`,padding:"5px 13px",fontSize:11,fontWeight:600,cursor:"pointer",letterSpacing:"0.04em",fontFamily:"inherit",transition:"all .14s"}}>
              All
            </button>
            {subs.map(s=>(
              <button key={s} onClick={()=>setF("sub",filters.sub===s?"all":s)}
                style={{background:filters.sub===s?T.emerald:T.ivoryAlt,color:filters.sub===s?"#fff":T.textMid,border:`1px solid ${filters.sub===s?T.emerald:T.border}`,padding:"5px 13px",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit",transition:"all .14s"}}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"190px 1fr"}}>
        {/* Sidebar — desktop only */}
        {!isMobile && <div style={{background:T.white,borderRight:`1px solid ${T.border}`,padding:"22px 18px",position:"sticky",top:108,height:"calc(100vh - 108px)",overflowY:"auto",alignSelf:"start"}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:500,color:T.text,marginBottom:18,paddingBottom:10,borderBottom:`1px solid ${T.borderLight}`,fontStyle:"italic"}}>Refine</div>
          {[
            {label:"Sort By",key:"sort",opts:[["default","Relevance"],["popular","Most Popular"],["rating","Top Rated"],["p-asc","Price ↑"],["p-desc","Price ↓"]]},
            {label:"Price",key:"price",opts:[["all","All Prices"],["u500","Under ₹500"],["500-1500","₹500–₹1,500"],["1500+","₹1,500+"]]},
          ].map(({label,key,opts})=>(
            <div key={key} style={{marginBottom:20}}>
              <div style={{fontSize:9,fontWeight:700,color:T.textMuted,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:8}}>{label}</div>
              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                {opts.map(([v,l])=>(
                  <button key={v} onClick={()=>setF(key,v)}
                    style={{background:filters[key]===v?T.emeraldBg:"transparent",color:filters[key]===v?T.emerald:T.textMid,border:"none",padding:"7px 10px",fontSize:12,fontWeight:filters[key]===v?600:400,textAlign:"left",cursor:"pointer",transition:"all .12s",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}
                    onMouseEnter={e=>{if(filters[key]!==v)e.currentTarget.style.background=T.ivoryAlt;}}
                    onMouseLeave={e=>{if(filters[key]!==v)e.currentTarget.style.background="transparent";}}>
                    {filters[key]===v && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={T.emerald} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    {l}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>}
        {/* Grid */}
        <div style={{padding:isMobile?"16px 14px":"22px 22px"}}>
          {prods.length===0 ? (
            <div style={{padding:"80px 0",textAlign:"center"}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:T.textMuted,marginBottom:8,fontStyle:"italic"}}>No products found</div>
              <Btn v="subtle" sz="sm" onClick={()=>setFilters({sort:"default",sub:"all",price:"all"})}>Clear filters</Btn>
            </div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(auto-fill,minmax(190px,1fr))",gap:isMobile?10:14}}>
              {prods.map(p=><PCard key={p.id} p={p} width={isMobile?undefined:undefined}/>)}
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {filterOpen && (
        <>
          <div onClick={()=>setFilterOpen(false)}
            style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:1099,backdropFilter:"blur(2px)"}}/>
          <div style={{position:"fixed",bottom:0,left:0,right:0,background:T.white,zIndex:1100,
            borderRadius:"16px 16px 0 0",padding:"20px 0 40px",
            boxShadow:"0 -8px 40px rgba(0,0,0,.18)",animation:"fadeUp .2s ease",maxHeight:"80vh",overflowY:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0 20px 16px",borderBottom:`1px solid ${T.border}`}}>
              <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:500,color:T.text,fontStyle:"italic"}}>Filter & Sort</span>
              <button onClick={()=>setFilterOpen(false)}
                style={{background:"none",border:"none",fontSize:22,color:T.textMuted,cursor:"pointer",fontFamily:"inherit",lineHeight:1}}>×</button>
            </div>
            <div style={{padding:"16px 20px"}}>
              {[
                {label:"Sort By",key:"sort",opts:[["default","Relevance"],["popular","Most Popular"],["rating","Top Rated"],["p-asc","Price ↑"],["p-desc","Price ↓"]]},
                {label:"Price",key:"price",opts:[["all","All Prices"],["u500","Under ₹500"],["500-1500","₹500–₹1,500"],["1500+","₹1,500+"]]},
              ].map(({label,key,opts})=>(
                <div key={key} style={{marginBottom:22}}>
                  <div style={{fontSize:9,fontWeight:700,color:T.textMuted,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:10}}>{label}</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {opts.map(([v,l])=>(
                      <button key={v} onClick={()=>setF(key,v)}
                        style={{background:filters[key]===v?T.emerald:T.ivoryAlt,color:filters[key]===v?"#fff":T.textMid,border:`1px solid ${filters[key]===v?T.emerald:T.border}`,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all .12s"}}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <Btn onClick={()=>setFilterOpen(false)} style={{width:"100%",marginTop:8}}>Apply</Btn>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── PAGE: PRODUCT DETAIL ─────────────────────────────────────────────────────
function ProductDetail({id,setPage}) {
  const {addCart,cart,toggleWish,wishlist} = useCtx();
  const isMobile = useWindowWidth() < 768;
  const p = ALL.find(x=>x.id===parseInt(id));
  if(!p) return <div style={{paddingTop:160,textAlign:"center",color:T.textMuted,fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontStyle:"italic"}}>Product not found</div>;
  const related = ALL.filter(x=>x.cat===p.cat&&x.id!==p.id).slice(0,8);
  const disc = p.mrp>p.price ? Math.round((1-p.price/p.mrp)*100) : 0;
  const inCart = cart[p.id]>0;
  return (
    <div style={{paddingBottom:isMobile?100:100,background:T.ivory}}>
      <div style={{borderBottom:`1px solid ${T.border}`,padding:isMobile?"10px 16px":"12px 32px",fontSize:11,color:T.textMuted,background:T.white}}>
        <span onClick={()=>setPage("home")} style={{cursor:"pointer"}} onMouseEnter={e=>e.target.style.color=T.emerald} onMouseLeave={e=>e.target.style.color=T.textMuted}>Home</span>
        {" / "}
        <span onClick={()=>setPage(p.cat)} style={{cursor:"pointer",textTransform:"capitalize"}} onMouseEnter={e=>e.target.style.color=T.emerald} onMouseLeave={e=>e.target.style.color=T.textMuted}>{p.cat}</span>
        {!isMobile && <>{" / "}{p.name}</>}
      </div>
      <div style={{maxWidth:1100,margin:"0 auto",padding:isMobile?"0":"36px 32px",display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:isMobile?0:56,alignItems:"start"}}>
        <div style={{background:p.bg,aspectRatio:"1/1",display:"flex",alignItems:"center",justifyContent:"center",position:isMobile?"relative":"sticky",top:isMobile?undefined:120,border:`1px solid ${T.border}`,maxHeight:isMobile?260:undefined,overflow:"hidden"}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:10,color:"rgba(0,0,0,.22)",fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:14}}>{p.brand}</div>
            <div style={{width:110,height:150,background:"rgba(255,255,255,.6)",margin:"0 auto",border:"1px solid rgba(255,255,255,.8)",borderRadius:2}}/>
          </div>
        </div>
        <div style={{padding:isMobile?"20px 16px 0":undefined}}>
          <div style={{fontSize:9,fontWeight:700,color:T.gold,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:10}}>{p.brand} - {p.sub}</div>
          <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(20px,2.5vw,30px)",fontWeight:400,lineHeight:1.2,marginBottom:14,color:T.text}}>{p.name}</h1>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <Stars r={p.rating} n={p.reviews}/>
            <span style={{fontSize:11,color:T.emeraldMid,fontWeight:600}}>{p.sold.toLocaleString()} sold this week</span>
          </div>
          {p.badge && <div style={{marginBottom:16}}><BadgeChip type={p.badge}/></div>}
          <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:26}}>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:30,fontWeight:600,color:T.text}}>₹{p.price.toLocaleString()}</span>
            {p.mrp>p.price && <><span style={{fontSize:14,color:T.textMuted,textDecoration:"line-through"}}>₹{p.mrp}</span><span style={{fontSize:12,color:T.red,fontWeight:700}}>{disc}% OFF</span></>}
          </div>
          {!isMobile && (
            <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap"}}>
              <Btn sz="lg" v={inCart?"subtle":"fill"} style={inCart?{border:`1.5px solid ${T.emerald}`,color:T.emerald}:{}} onClick={()=>addCart(p.id)}>
                {inCart?"Added to Bag":"Add to Bag"}
              </Btn>
              <button onClick={e=>{e.stopPropagation();toggleWish(p.id);}}
                style={{padding:"14px 16px",background:wishlist&&wishlist.includes(p.id)?T.redBg:T.ivoryAlt,
                  border:`1.5px solid ${wishlist&&wishlist.includes(p.id)?"#C0392B":T.border}`,
                  cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontFamily:"inherit",
                  fontSize:11,fontWeight:600,color:wishlist&&wishlist.includes(p.id)?"#C0392B":T.textMid,
                  letterSpacing:"0.04em",textTransform:"uppercase",transition:"all .15s"}}>
                <svg width="13" height="13" viewBox="0 0 24 24"
                  fill={wishlist&&wishlist.includes(p.id)?"#C0392B":"none"} stroke="currentColor" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                </svg>
                {wishlist&&wishlist.includes(p.id)?"Saved":"Wishlist"}
              </button>
            </div>
          )}
          {!isMobile && (
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:24,fontSize:12,color:T.emeraldMid,fontWeight:600}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.emeraldMid} strokeWidth="2">
                <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
              Get it by <strong style={{color:T.emerald,marginLeft:3}}>{DELIVERY_DATE}</strong>
              <span style={{color:T.textMuted,fontWeight:400,marginLeft:4}}>· Order before 5PM</span>
            </div>
          )}
          <div style={{borderTop:`1px solid ${T.borderLight}`,paddingTop:18,display:"flex",flexDirection:"column",gap:11}}>
            {[["Brand",p.brand],["Category",p.sub],["Concern",p.concern||"General"],["Rating",`${p.rating} (${p.reviews.toLocaleString()} reviews)`]].map(([k,v])=>(
              <div key={k} style={{display:"flex",gap:14,alignItems:"baseline"}}>
                <span style={{fontSize:9,fontWeight:700,color:T.textMuted,letterSpacing:"0.1em",textTransform:"uppercase",width:80,flexShrink:0}}>{k}</span>
                <span style={{fontSize:13,color:T.textMid,fontWeight:500}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Reviews section */}
      <div style={{maxWidth:1100,margin:"0 auto",padding:isMobile?"0 16px 48px":"0 32px 48px",borderTop:`1px solid ${T.borderLight}`}}>
        <div style={{padding:"32px 0 20px",display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:8}}>
          <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:400,color:T.text,fontStyle:"italic"}}>Customer Reviews</h2>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Stars r={p.rating} n={p.reviews}/>
            <span style={{fontSize:12,color:T.textMuted}}>{p.reviews.toLocaleString()} reviews</span>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {[
            {name:"Priya M.", days:12, rating:5, text:"Absolutely love this product. Noticed a visible difference in my skin within 2 weeks. Will repurchase."},
            {name:"Rahul S.", days:28, rating:4, text:"Good product, consistent results. Packaging could be better but the formula is excellent."},
            {name:"Ananya K.", days:45, rating:5, text:"This is a staple in my routine now. Dermatologist-recommended and it shows — my skin looks clearer than ever."},
          ].map((rv,i)=>(
            <div key={i} style={{background:T.white,border:`1px solid ${T.borderLight}`,padding:"18px 20px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:T.emeraldBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:T.emerald}}>{rv.name[0]}</div>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:T.text}}>{rv.name}</div>
                    <div style={{fontSize:10,color:T.textMuted}}>{rv.days} days ago · Verified Purchase</div>
                  </div>
                </div>
                <Stars r={rv.rating}/>
              </div>
              <p style={{fontSize:13,color:T.textMid,lineHeight:1.7,margin:0}}>{rv.text}</p>
            </div>
          ))}
        </div>
      </div>
      {related.length>0 && (
        <div style={{maxWidth:1100,margin:"0 auto",padding:isMobile?"0 16px 48px":"0 32px 48px",borderTop:`1px solid ${T.borderLight}`}}>
          <div style={{padding:"32px 0 20px"}}>
            <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:400,color:T.text,fontStyle:"italic"}}>Related Products</h2>
          </div>
          <div className="hscroll">
            {related.map(rp=><PCard key={rp.id} p={rp} width={isMobile?160:190}/>)}
          </div>
        </div>
      )}

      {/* Mobile sticky Add-to-Bag bar */}
      {isMobile && (
        <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:600,
          background:T.white,borderTop:`1px solid ${T.border}`,
          padding:"10px 16px 12px",display:"flex",gap:12,alignItems:"center",
          boxShadow:"0 -4px 20px rgba(27,67,50,.1)"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:10,color:T.textMuted,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div>
            <div style={{fontSize:16,fontWeight:700,color:T.text,letterSpacing:"-0.01em"}}>₹{p.price.toLocaleString()}</div>
            <div style={{fontSize:10,color:T.emeraldMid,fontWeight:600}}>By {DELIVERY_DATE}</div>
          </div>
          <Btn sz="lg" v={inCart?"subtle":"fill"}
            style={inCart?{border:`1.5px solid ${T.emerald}`,color:T.emerald,flexShrink:0}:{flexShrink:0}}
            onClick={()=>addCart(p.id)}>
            {inCart?"✓ Added to Bag":"Add to Bag"}
          </Btn>
        </div>
      )}
    </div>
  );
}

// ─── PAGE: QUIZ ───────────────────────────────────────────────────────────────
const QUIZ_CONCERN_MAP = {
  "Acne and Oiliness":"acne","Dryness and Dehydration":"hydration",
  "Pigmentation":"pigmentation","Ageing and Fine Lines":"ageing",
  "Dullness":"glow","Hairfall":"hairfall",
};
const QUIZ_BUDGET_MAP = {
  "Under ₹500":500,"₹500–₹1,500":1500,
  "₹1,500–₹5,000":5000,"No limit":Infinity,
};

function Quiz({setPage}) {
  const {addCart,cart,unlockMilestone} = useCtx();
  const [step,setStep]       = useState(0);
  const [done,setDone]       = useState(false);
  const [answers,setAnswers] = useState([]);
  const STEPS = [
    {q:"What is your primary concern?",     opts:["Acne and Oiliness","Dryness and Dehydration","Pigmentation","Ageing and Fine Lines","Dullness","Hairfall"]},
    {q:"How would you describe your skin?", opts:["Oily","Dry","Combination","Sensitive","Normal"]},
    {q:"Steps per routine?",                opts:["2-3 (minimal)","4-5 (standard)","6+ (full ritual)"]},
    {q:"Monthly budget for skin?",          opts:["Under ₹500","₹500–₹1,500","₹1,500–₹5,000","No limit"]},
  ];
  const answer = opt => {
    const next = [...answers, opt];
    setAnswers(next);
    if(step<STEPS.length-1) setStep(step+1); else { setDone(true); unlockMilestone("quiz"); }
  };
  const concern   = QUIZ_CONCERN_MAP[answers[0]];
  const maxBudget = QUIZ_BUDGET_MAP[answers[3]];
  let rProds = ALL
    .filter(p=>!concern||p.concern===concern)
    .filter(p=>!maxBudget||p.price<=maxBudget)
    .slice(0,4);
  if(rProds.length<2) rProds = ALL.filter((_,i)=>[0,2,5,11].includes(i));
  return (
    <div style={{paddingBottom:100,background:T.ivory,minHeight:"100vh"}}>
      <div style={{background:T.white,borderBottom:`1px solid ${T.border}`,padding:"18px 32px"}}>
        <div style={{fontSize:10,fontWeight:600,color:T.emeraldMid,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:4}}>Personalised matching</div>
        <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(22px,3vw,36px)",fontWeight:400,color:T.text,fontStyle:"italic"}}>Find Your Dose</h1>
      </div>
      <div style={{maxWidth:560,margin:"0 auto",padding:"44px 32px"}}>
        {!done ? (
          <>
            <div style={{display:"flex",gap:5,marginBottom:40}}>
              {STEPS.map((_,i)=><div key={i} style={{flex:1,height:2,background:i<=step?T.emerald:T.sand,transition:"background .3s"}}/>)}
            </div>
            <div style={{fontSize:9,fontWeight:700,color:T.textMuted,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:12}}>Step {step+1} of {STEPS.length}</div>
            <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(18px,2.5vw,26px)",fontWeight:400,marginBottom:28,color:T.text,lineHeight:1.2,fontStyle:"italic"}}>{STEPS[step].q}</h2>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {STEPS[step].opts.map(opt=>(
                <button key={opt} onClick={()=>answer(opt)}
                  style={{background:T.white,border:`1.5px solid ${T.border}`,padding:"14px 18px",fontSize:13,fontWeight:400,color:T.textMid,cursor:"pointer",textAlign:"left",transition:"all .15s",display:"flex",justifyContent:"space-between",alignItems:"center",fontFamily:"inherit"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=T.emerald;e.currentTarget.style.background=T.emeraldBg;e.currentTarget.style.color=T.emerald;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.white;e.currentTarget.style.color=T.textMid;}}>
                  {opt}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{animation:"fadeUp .35s ease"}}>
            <div style={{background:T.emeraldBg,border:`1px solid rgba(82,183,136,0.3)`,padding:"13px 16px",marginBottom:32,display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:13,fontWeight:500,color:T.emerald}}>Your personalised dose is ready.</span>
            </div>
            <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:400,color:T.text,marginBottom:24,fontStyle:"italic"}}>Recommended for You</h2>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24}}>
              {rProds.map(p=><PCard key={p.id} p={p}/>)}
            </div>
            <button onClick={()=>{setStep(0);setDone(false);setAnswers([]);}} style={{background:"none",border:"none",color:T.textMuted,fontSize:11,cursor:"pointer",textDecoration:"underline",fontFamily:"inherit"}}>Retake quiz</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PAGE: BRANDS ─────────────────────────────────────────────────────────────
function Brands({setPage}) {
  const {addCart,cart} = useCtx();
  const [sel,setSel]   = useState(null);
  const [filter,setFi] = useState("all");
  const INT = ["The Ordinary","La Roche-Posay","Bioderma","Paula's Choice","Drunk Elephant","Cetaphil","COSRX","Some By Mi","SkinCeuticals","Tatcha","Kiehl's"];
  const IND = ["Minimalist","Dot & Key","Pilgrim","Plum","Mamaearth","mCaffeine","WellDose"];
  const list = filter==="INT" ? INT : filter==="IND" ? IND : [...INT,...IND];
  const bp   = sel ? ALL.filter(p=>p.brand===sel) : [];
  return (
    <div style={{paddingBottom:100,background:T.ivory}}>
      <div style={{background:T.white,borderBottom:`1px solid ${T.border}`,padding:"18px 32px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
          <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(24px,3vw,40px)",fontWeight:400,color:T.text,fontStyle:"italic"}}>All Brands</h1>
          <div style={{display:"flex",gap:6}}>
            {[["all","All"],["IND","Indian"],["INT","International"]].map(([v,l])=>(
              <button key={v} onClick={()=>setFi(v)} style={{background:filter===v?T.emerald:T.ivoryAlt,color:filter===v?"#fff":T.textMid,border:`1px solid ${filter===v?T.emerald:T.border}`,padding:"7px 16px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all .14s"}}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{maxWidth:1140,margin:"0 auto",padding:"28px 32px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:7,marginBottom:sel?36:0}}>
          {list.map(b=>(
            <div key={b} onClick={()=>setSel(sel===b?null:b)}
              style={{background:sel===b?T.emerald:T.white,color:sel===b?"#fff":T.text,border:`1px solid ${sel===b?T.emerald:T.border}`,padding:"14px 12px",cursor:"pointer",transition:"all .14s",textAlign:"center"}}
              onMouseEnter={e=>{if(sel!==b){e.currentTarget.style.borderColor=T.emerald;e.currentTarget.style.background=T.emeraldBg;}}}
              onMouseLeave={e=>{if(sel!==b){e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.white;}}}>
              <div style={{fontSize:12,fontWeight:600,lineHeight:1.2}}>{b}</div>
            </div>
          ))}
        </div>
        {sel && (
          <div style={{borderTop:`1px solid ${T.border}`,paddingTop:28}}>
            <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:400,color:T.text,marginBottom:22,fontStyle:"italic"}}>{sel}</h2>
            {bp.length>0 ? (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:12}}>
                {bp.map(p=><PCard key={p.id} p={p}/>)}
              </div>
            ) : <div style={{fontSize:14,color:T.textMuted,padding:"20px 0",fontStyle:"italic"}}>More {sel} products coming soon.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PAGE: B2B ────────────────────────────────────────────────────────────────
function B2B() {
  const {showNotif} = useCtx();
  const [form,setForm] = useState({name:"",biz:"",type:"",email:"",phone:"",city:""});
  const [sub,setSub]   = useState(false);
  const f = k => e => setForm(p=>({...p,[k]:e.target.value}));
  const inp = {background:T.white,border:`1.5px solid ${T.border}`,padding:"11px 13px",fontSize:13,outline:"none",color:T.text,fontFamily:"inherit",width:"100%",transition:"border-color .15s"};
  return (
    <div style={{paddingBottom:100}}>
      <div style={{background:T.emerald,padding:"56px 32px"}}>
        <div style={{maxWidth:680}}>
          <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.35)",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:14}}>B2B / Wholesale</div>
          <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(32px,5vw,56px)",fontWeight:400,color:"#fff",lineHeight:1.0,marginBottom:16,fontStyle:"italic"}}>For Clinics, Pharmacies and Salons.</h1>
          <p style={{fontSize:14,color:"rgba(255,255,255,.5)",lineHeight:1.75,maxWidth:460}}>Wholesale pricing, private label manufacturing, and a dedicated ordering panel for wellness professionals across India.</p>
        </div>
      </div>
      <div style={{background:T.ivoryAlt,borderBottom:`1px solid ${T.border}`}}>
        <div style={{maxWidth:1140,margin:"0 auto",display:"flex",overflow:"hidden"}}>
          {[["500+","B2B Partners"],["48hr","Delivery SLA"],["12-22%","Better Margin"],["500 units","Min Private Label"]].map(([n,l],i)=>(
            <div key={l} style={{flex:1,padding:"18px 0",textAlign:"center",borderRight:i<3?`1px solid ${T.border}`:"none"}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(20px,2.5vw,28px)",fontWeight:600,color:T.emerald,marginBottom:2}}>{n}</div>
              <div style={{fontSize:11,color:T.textMuted,fontWeight:500}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{maxWidth:1140,margin:"0 auto",padding:"48px 32px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:56}}>
        <div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:500,color:T.text,marginBottom:22,fontStyle:"italic"}}>What We Offer</div>
          {[["Bulk Supply","Wholesale access to 200+ brands. Min order ₹5,000. 48-hour pan-India delivery."],["Private Label","Your brand, our formulations. From 500 units. 60-70% gross margin."],["Ordering Panel","WhatsApp-first or web panel. Monthly credit for established partners."],["Demand Intelligence","Trending SKUs by pin code, pre-shared before your next order."],["Marketing Support","Co-branded materials, routine cards, upsell kits included."]].map(([t,d])=>(
            <div key={t} style={{borderBottom:`1px solid ${T.borderLight}`,paddingBottom:14,paddingTop:14}}>
              <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:3}}>{t}</div>
              <div style={{fontSize:12,color:T.textMuted,lineHeight:1.65}}>{d}</div>
            </div>
          ))}
        </div>
        <div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:500,color:T.text,marginBottom:7,fontStyle:"italic"}}>Apply for Access</div>
          <div style={{fontSize:12,color:T.textMuted,marginBottom:26}}>Reviewed personally within 24 hours.</div>
          {sub ? (
            <div style={{background:T.emeraldBg,border:`1px solid rgba(82,183,136,0.3)`,padding:"32px 24px",textAlign:"center"}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:500,color:T.emerald,marginBottom:7,fontStyle:"italic"}}>Application Received</div>
              <div style={{fontSize:13,color:T.textMuted}}>Our B2B team will reach out within 24 hours.</div>
            </div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
              {[["name","Full name","text"],["biz","Business name","text"],["email","Email","email"],["phone","Phone","tel"],["city","City","text"]].map(([k,ph,t])=>(
                <input key={k} value={form[k]} onChange={f(k)} placeholder={ph} type={t} style={inp}
                  onFocus={e=>e.target.style.borderColor=T.emerald}
                  onBlur={e=>e.target.style.borderColor=T.border}/>
              ))}
              <select value={form.type} onChange={f("type")} style={{...inp,color:form.type?T.text:T.textMuted,cursor:"pointer",gridColumn:"1/-1"}}>
                <option value="">Business type</option>
                {["Dermatologist / Clinic","Salon / Spa","Pharmacy","Online Reseller","Corporate Wellness","Other"].map(o=><option key={o}>{o}</option>)}
              </select>
              <div style={{gridColumn:"1/-1"}}>
                <Btn fw sz="lg" onClick={()=>{if(form.name&&form.email){setSub(true);showNotif({title:"Application Submitted",msg:"Our B2B team will reach out within 24 hours."});}}}>Submit Application</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PAGE: SEARCH ─────────────────────────────────────────────────────────────
function Search({query}) {
  const {addCart,cart} = useCtx();
  const [q,setQ] = useState(query||"");
  const ref = useRef();
  useEffect(()=>{ setTimeout(()=>ref.current?.focus(),150); },[]);
  const results = q.trim().length>1
    ? ALL.filter(p=>p.name.toLowerCase().includes(q.toLowerCase())||p.brand.toLowerCase().includes(q.toLowerCase())||p.concern?.toLowerCase().includes(q.toLowerCase())||p.sub.toLowerCase().includes(q.toLowerCase()))
    : [];
  return (
    <div style={{paddingBottom:100,background:T.ivory,minHeight:"100vh"}}>
      <div style={{background:T.white,borderBottom:`1px solid ${T.border}`,padding:"18px 32px"}}>
        <input ref={ref} value={q} onChange={e=>setQ(e.target.value)}
          placeholder="Search products, brands, ingredients, concerns..."
          style={{width:"100%",background:T.ivoryAlt,border:`1.5px solid ${T.border}`,padding:"13px 17px",fontSize:15,outline:"none",color:T.text,fontFamily:"inherit",transition:"border-color .15s"}}
          onFocus={e=>e.target.style.borderColor=T.emerald}
          onBlur={e=>e.target.style.borderColor=T.border}/>
      </div>
      <div style={{maxWidth:1140,margin:"0 auto",padding:"22px 32px"}}>
        {q.length>1 && <div style={{fontSize:11,color:T.textMuted,marginBottom:18}}>{results.length} result{results.length!==1?"s":""} for "{q}"</div>}
        {results.length>0 && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13}}>
            {results.map(p=><PCard key={p.id} p={p}/>)}
          </div>
        )}
        {q.length<=1 && (
          <>
            <div style={{fontSize:9,fontWeight:700,color:T.textMuted,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:12}}>Popular Searches</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:32}}>
              {["Niacinamide","Salicylic Acid","Vitamin C","Biotin","Retinol","SPF 50","Hyaluronic Acid","The Ordinary","Minimalist"].map(s=>(
                <button key={s} onClick={()=>setQ(s)} style={{background:T.white,border:`1px solid ${T.border}`,padding:"6px 13px",fontSize:11,fontWeight:500,color:T.textMid,cursor:"pointer",transition:"all .13s",fontFamily:"inherit"}}
                  onMouseEnter={e=>{e.currentTarget.style.background=T.emeraldBg;e.currentTarget.style.color=T.emerald;e.currentTarget.style.borderColor=T.emerald;}}
                  onMouseLeave={e=>{e.currentTarget.style.background=T.white;e.currentTarget.style.color=T.textMid;e.currentTarget.style.borderColor=T.border;}}>{s}</button>
              ))}
            </div>
            <div style={{fontSize:9,fontWeight:700,color:T.textMuted,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:12}}>Browse by Concern</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(138px,1fr))",gap:6,maxWidth:840}}>
              {CONCERNS.map(c=>(
                <div key={c.id} style={{background:T.white,border:`1px solid ${T.border}`,padding:"11px 13px",cursor:"pointer",fontSize:12,fontWeight:500,color:T.textMid,transition:"all .13s"}}
                  onMouseEnter={e=>{e.currentTarget.style.background=T.emeraldBg;e.currentTarget.style.color=T.emerald;e.currentTarget.style.borderColor=T.emerald;}}
                  onMouseLeave={e=>{e.currentTarget.style.background=T.white;e.currentTarget.style.color=T.textMid;e.currentTarget.style.borderColor=T.border;}}>
                  {c.label}
                </div>
              ))}
            </div>
          </>
        )}
        {q.length>1&&results.length===0&&(
          <div style={{padding:"60px 0",textAlign:"center"}}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:T.textMuted,fontStyle:"italic"}}>No results for "{q}"</div>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── NOTIF BANNER ─────────────────────────────────────────────────────────────
function NotifBanner() {
  const {notifBanner} = useCtx();
  if(!notifBanner) return null;
  return (
    <div style={{position:"fixed",top:20,right:20,zIndex:2000,
      background:T.emerald,color:"#fff",padding:"14px 20px",
      boxShadow:`0 8px 24px ${T.shadowMd}`,maxWidth:320,animation:"fadeUp .3s ease"}}>
      <div style={{fontSize:13,fontWeight:700,marginBottom:3}}>{notifBanner.title}</div>
      <div style={{fontSize:12,color:"rgba(255,255,255,.75)"}}>{notifBanner.msg}</div>
    </div>
  );
}

// ─── PROFILE DRAWER (quick access) ───────────────────────────────────────────
function ProfileDrawer({setPage}) {
  const {profile:rawProfile,profileOpen,setProfileOpen,updateProfile,unlockMilestone} = useCtx();
  const profile = rawProfile || defaultProfile();
  const totalPts = profile.milestones.reduce((s,m)=>s+m.pts,0);
  const stage = profile.stage || 1;
  const stageLabel = ["","Starter","Active","Advanced"][stage];
  const daysActive = profile.createdAt
    ? Math.floor((Date.now()-new Date(profile.createdAt).getTime())/86400000)
    : 0;

  return (
    <>
      {profileOpen&&<div onClick={()=>setProfileOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:1200,backdropFilter:"blur(3px)"}}/>}
      <div style={{position:"fixed",top:0,right:0,bottom:0,width:"min(380px,100vw)",zIndex:1300,
        background:T.ivory,borderLeft:`1px solid ${T.border}`,
        transform:profileOpen?"translateX(0)":"translateX(100%)",
        transition:"transform .36s cubic-bezier(.16,1,.3,1)",
        display:"flex",flexDirection:"column",boxShadow:`-4px 0 28px ${T.shadowMd}`}}>
        <div style={{padding:"16px 22px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:T.emerald}}>
          <div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:500,fontStyle:"italic",color:"#fff"}}>
              {profile.name||"Your Skin Profile"}
            </div>
            <div style={{fontSize:10,color:"rgba(255,255,255,.6)",marginTop:2,letterSpacing:"0.1em",textTransform:"uppercase"}}>
              Stage {stage} — {stageLabel} &#183; Day {daysActive}
            </div>
          </div>
          <button onClick={()=>setProfileOpen(false)} style={{background:"rgba(255,255,255,.15)",border:"none",width:30,height:30,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>&#215;</button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"0"}}>
          {/* Stage progress */}
          <div style={{padding:"16px 22px",borderBottom:`1px solid ${T.borderLight}`,background:T.white}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:11,fontWeight:600,color:T.text}}>Skin Journey Progress</span>
              <span style={{fontSize:11,fontWeight:700,color:T.gold}}>{totalPts} pts</span>
            </div>
            <div style={{display:"flex",gap:4,marginBottom:8}}>
              {[1,2,3].map(s=>(
                <div key={s} style={{flex:1,height:6,background:s<=stage?T.emerald:T.border,borderRadius:2,transition:"background .3s"}}/>
              ))}
            </div>
            <div style={{fontSize:10,color:T.textMuted}}>
              {stage===1?"Start your routine to reach Active stage":stage===2?"30 days consistency unlocks Advanced":"You have reached the highest stage — Advanced"}
            </div>
          </div>

          {/* Before photo */}
          <div style={{padding:"16px 22px",borderBottom:`1px solid ${T.borderLight}`}}>
            <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:10}}>Before Photo</div>
            {profile.beforePhoto?(
              <div style={{position:"relative"}}>
                <img src={profile.beforePhoto} alt="Before" style={{width:"100%",height:140,objectFit:"cover",border:`1px solid ${T.border}`}}/>
                <div style={{position:"absolute",bottom:6,left:6,background:"rgba(0,0,0,.6)",color:"#fff",fontSize:9,padding:"3px 8px",letterSpacing:"0.08em",textTransform:"uppercase"}}>
                  Day 1 — {new Date(profile.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}
                </div>
              </div>
            ):(
              <div onClick={()=>setPage("checkin")}
                style={{height:100,background:T.ivoryAlt,border:`2px dashed ${T.border}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",gap:8,transition:"all .15s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=T.emerald;e.currentTarget.style.background=T.emeraldBg;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.ivoryAlt;}}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.emerald} strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <div style={{fontSize:11,color:T.emerald,fontWeight:600}}>Upload your before photo</div>
                <div style={{fontSize:10,color:T.textMuted}}>+100 points</div>
              </div>
            )}
          </div>

          {/* Milestones */}
          <div style={{padding:"16px 22px",borderBottom:`1px solid ${T.borderLight}`}}>
            <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:12}}>Milestones</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {MILESTONES.map(m=>{
                const done = profile.milestones.find(x=>x.id===m.id);
                return (
                  <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:done?T.emeraldBg:T.white,border:`1px solid ${done?T.emeraldLight+"44":T.borderLight}`,transition:"all .2s"}}>
                    <span style={{fontSize:14,opacity:done?1:.35}}>{m.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,fontWeight:done?600:400,color:done?T.emerald:T.textMuted}}>{m.title}</div>
                    </div>
                    <div style={{fontSize:10,fontWeight:700,color:done?T.emerald:T.textMuted}}>+{m.pts}</div>
                    {done&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.emerald} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rx status */}
          <div style={{padding:"16px 22px",borderBottom:`1px solid ${T.borderLight}`}}>
            <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:8}}>Prescription Status</div>
            {profile.rxStatus==="approved"?(
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:T.emeraldBg,border:`1px solid ${T.emeraldLight}44`}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill={T.emerald}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:T.emerald}}>Prescription Verified</div>
                  <div style={{fontSize:10,color:T.textMuted}}>Rx-gated products unlocked</div>
                </div>
              </div>
            ):profile.rxStatus==="pending"?(
              <div style={{padding:"10px 12px",background:"#FFF7ED",border:"1px solid #FED7AA"}}>
                <div style={{fontSize:12,fontWeight:600,color:"#C2410C"}}>Under review</div>
                <div style={{fontSize:10,color:T.textMuted}}>Usually reviewed within 24 hours</div>
              </div>
            ):(
              <div onClick={()=>{setProfileOpen(false);setPage("consult");}}
                style={{padding:"10px 12px",background:T.white,border:`1px solid ${T.border}`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all .15s"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=T.emerald}
                onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:T.text}}>Get a Prescription</div>
                  <div style={{fontSize:10,color:T.textMuted}}>Book a consult or upload existing Rx</div>
                </div>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.emerald} strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </div>
            )}
          </div>

          {/* Notification consent */}
          <div style={{padding:"16px 22px"}}>
            <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:10}}>Skin Reminders</div>
            {!profile.notifConsented?(
              <div style={{background:T.white,border:`1px solid ${T.border}`,padding:"14px"}}>
                <div style={{fontSize:12,color:T.textMid,lineHeight:1.65,marginBottom:12}}>Get 30-day check-in reminders, routine nudges, and milestone alerts.</div>
                <input value={profile.notifEmail} onChange={e=>updateProfile({notifEmail:e.target.value})}
                  placeholder="your@email.com"
                  style={{width:"100%",background:T.ivoryAlt,border:`1px solid ${T.border}`,padding:"9px 12px",fontSize:12,outline:"none",marginBottom:8,fontFamily:"inherit",color:T.text}}/>
                <button onClick={()=>{if(profile.notifEmail.includes("@"))updateProfile({notifConsented:true});}}
                  style={{width:"100%",background:T.emerald,color:"#fff",border:"none",padding:"9px",fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"inherit"}}>
                  Enable Reminders
                </button>
              </div>
            ):(
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:T.emeraldBg,border:`1px solid ${T.emeraldLight}44`}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill={T.emerald}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <div style={{fontSize:11,color:T.emerald,fontWeight:600}}>Reminders active &#183; {profile.notifEmail}</div>
              </div>
            )}
          </div>
        </div>

        {/* Footer CTAs */}
        <div style={{padding:"14px 22px",borderTop:`1px solid ${T.border}`,display:"flex",gap:8}}>
          <button onClick={()=>{setProfileOpen(false);setPage("myskin");}}
            style={{flex:1,background:T.emerald,color:"#fff",border:"none",padding:"11px",fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"inherit"}}>
            Full Profile
          </button>
          <button onClick={()=>{setProfileOpen(false);setPage("checkin");}}
            style={{flex:1,background:T.ivoryAlt,color:T.text,border:`1px solid ${T.border}`,padding:"11px",fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"inherit"}}>
            Check In Today
          </button>
        </div>
      </div>
    </>
  );
}

// ─── PAGE: MY SKIN (full dashboard) ──────────────────────────────────────────
function MySkinPage({setPage}) {
  const {profile:rawP,updateProfile,unlockMilestone,addCart,cart,showNotif} = useCtx();
  const profile = rawP || defaultProfile();
  const daysActive = profile.createdAt
    ? Math.floor((Date.now()-new Date(profile.createdAt).getTime())/86400000)
    : 0;
  const totalPts = profile.milestones.reduce((s,m)=>s+m.pts,0);
  const stage = profile.stage||1;
  const stageLabel = ["","Starter","Active","Advanced"][stage];

  // Stage-based next product recommendation
  const stageRecs = {
    1:[1,5,6],   // Starter: niacinamide + cleanser + SPF
    2:[7,12,8],  // Active: add exfoliant + retinol + essence
    3:[11,16,21] // Advanced: premium serums + collagen
  };
  const nextProds = ALL.filter(p=>stageRecs[stage]?.includes(p.id));

  // "Indian skin" editorial insights
  const insights = [
    {title:"Why Indian skin needs higher SPF",body:"India's UV index peaks at 11+ between March–October. Standard SPF 30 provides only 97% protection. SPF 50+ with PA++++ is the minimum standard for Indian skin year-round."},
    {title:"Humidity and your sebum production",body:"India's monsoon season triggers 40% higher sebum production in oily skin types. Lightweight, gel-based formulas outperform cream moisturisers June–September."},
    {title:"Melanin-rich skin and pigmentation",body:"Higher melanin concentration makes Indian skin more prone to post-inflammatory hyperpigmentation. Alpha Arbutin fades existing marks; SPF prevents new UV-triggered ones."},
  ];

  return (
    <div style={{paddingBottom:120,background:T.ivory,minHeight:"100vh"}}>
      {/* Header */}
      <div style={{background:T.emerald,padding:"36px 32px"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:"0.18em",textTransform:"uppercase",marginBottom:8}}>Your Skin OS</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:16}}>
            <div>
              <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(28px,4vw,48px)",fontWeight:400,color:"#fff",fontStyle:"italic",marginBottom:6}}>
                {profile.name?profile.name+"'s Skin Profile":"My Skin Profile"}
              </h1>
              <div style={{fontSize:13,color:"rgba(255,255,255,.6)"}}>Stage {stage} — {stageLabel} &#183; Day {daysActive} of your journey &#183; {totalPts} points earned</div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setPage("checkin")}
                style={{background:"rgba(255,255,255,.15)",color:"#fff",border:"1px solid rgba(255,255,255,.3)",padding:"10px 20px",fontSize:11,fontWeight:700,cursor:"pointer",letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:"inherit"}}>
                Check In Today
              </button>
              <button onClick={()=>setPage("consult")}
                style={{background:"#fff",color:T.emerald,border:"none",padding:"10px 20px",fontSize:11,fontWeight:700,cursor:"pointer",letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:"inherit"}}>
                Book Consult
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1100,margin:"0 auto",padding:"32px 32px"}}>
        {/* GRID: Photo + Journey + Stats */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:28}}>

          {/* Before photo card */}
          <div style={{background:T.white,border:`1px solid ${T.border}`,padding:"20px"}}>
            <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:12}}>Before Photo</div>
            {profile.beforePhoto?(
              <div style={{position:"relative",marginBottom:10}}>
                <img src={profile.beforePhoto} alt="Before" style={{width:"100%",height:160,objectFit:"cover",border:`1px solid ${T.border}`}}/>
                <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent,rgba(0,0,0,.5))",padding:"20px 10px 8px"}}>
                  <div style={{fontSize:10,color:"#fff",fontWeight:600}}>Day 1 — {new Date(profile.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"long"})}</div>
                </div>
              </div>
            ):(
              <div onClick={()=>setPage("checkin")} style={{height:120,background:T.ivoryAlt,border:`2px dashed ${T.border}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,cursor:"pointer",marginBottom:10,transition:"all .15s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=T.emerald;e.currentTarget.style.background=T.emeraldBg;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.ivoryAlt;}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.emerald} strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <div style={{fontSize:11,color:T.emerald,fontWeight:600}}>Add before photo</div>
              </div>
            )}
            <div style={{fontSize:11,color:T.textMuted,lineHeight:1.6}}>Your starting point. Check in every 30 days to track visible progress.</div>
          </div>

          {/* Stage journey */}
          <div style={{background:T.white,border:`1px solid ${T.border}`,padding:"20px"}}>
            <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:12}}>Your Journey</div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {[
                {s:1,label:"Starter",desc:"Build your core routine",days:"Days 1–30"},
                {s:2,label:"Active",desc:"Introduce actives",days:"Days 31–60"},
                {s:3,label:"Advanced",desc:"Target and optimise",days:"Days 61+"},
              ].map(({s,label,desc,days})=>(
                <div key={s} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:s<=stage?T.emerald:T.ivoryAlt,border:`2px solid ${s<=stage?T.emerald:T.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .3s"}}>
                    {s<stage?(
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    ):(
                      <span style={{fontSize:10,fontWeight:700,color:s===stage?"#fff":T.textMuted}}>{s}</span>
                    )}
                  </div>
                  <div>
                    <div style={{fontSize:12,fontWeight:s===stage?700:500,color:s===stage?T.emerald:T.textMid}}>{label}</div>
                    <div style={{fontSize:10,color:T.textMuted}}>{desc}</div>
                    <div style={{fontSize:9,color:T.textMuted,letterSpacing:"0.06em"}}>{days}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div style={{background:T.white,border:`1px solid ${T.border}`,padding:"20px"}}>
            <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:12}}>Quick Stats</div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {[
                ["Day",daysActive.toString(),"Active"],
                ["Points",totalPts.toString(),"Earned"],
                ["Milestones",profile.milestones.length+"/"+MILESTONES.length,"Unlocked"],
                ["Check-ins",profile.checkIns.length.toString(),"Completed"],
              ].map(([l,v,u])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",paddingBottom:8,borderBottom:`1px solid ${T.borderLight}`}}>
                  <span style={{fontSize:11,color:T.textMuted}}>{l}</span>
                  <div style={{textAlign:"right"}}>
                    <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600,color:T.text}}>{v}</span>
                    <div style={{fontSize:9,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.08em"}}>{u}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* WHAT TO ADD NEXT (outcome memory + collaborative filtering) */}
        <div style={{background:T.white,border:`1px solid ${T.border}`,padding:"24px",marginBottom:24}}>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,fontWeight:600,color:T.emeraldMid,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:4}}>Personalised recommendation</div>
            <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:400,color:T.text,fontStyle:"italic"}}>
              {stage===1?"Start here — your Stage 1 routine":stage===2?"You're ready — add these to your Stage 2 routine":"Advanced picks — based on your journey so far"}
            </h2>
            <p style={{fontSize:13,color:T.textMuted,lineHeight:1.65,marginTop:6}}>
              {stage===1?"Users with your skin profile who started with these 3 products saw visible results in 28 days on average.":stage===2?"Users at Day 30+ who added a chemical exfoliant and retinol saw 62% improvement in texture within 4 weeks.":"Users at your stage who introduced clinical-grade Vitamin C and collagen supplements reported the most visible improvements after 90 days."}
            </p>
          </div>
          <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
            {nextProds.map(p=>(
              <div key={p.id} style={{display:"flex",gap:12,padding:"14px",background:T.ivoryAlt,border:`1px solid ${T.border}`,flex:1,minWidth:200}}>
                <div style={{width:52,height:52,background:p.bg,flexShrink:0,border:`1px solid ${T.border}`}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:9,color:T.gold,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:2}}>{p.brand}</div>
                  <div style={{fontSize:12,fontWeight:600,color:T.text,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:13,fontWeight:700}}>&#8377;{p.price}</span>
                    <button onClick={()=>addCart(p.id)} style={{background:cart[p.id]?T.emerald:T.emeraldBg,color:cart[p.id]?"#fff":T.emerald,border:"none",padding:"5px 10px",fontSize:9,fontWeight:700,cursor:"pointer",textTransform:"uppercase",fontFamily:"inherit"}}>
                      {cart[p.id]?"Added":"Add"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CHECK-IN HISTORY */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>
          <div style={{background:T.white,border:`1px solid ${T.border}`,padding:"24px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:700,color:T.text}}>Check-in Log</div>
              <button onClick={()=>setPage("checkin")}
                style={{background:T.emerald,color:"#fff",border:"none",padding:"7px 14px",fontSize:10,fontWeight:700,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"inherit"}}>
                Check In
              </button>
            </div>
            {profile.checkIns.length===0?(
              <div style={{textAlign:"center",padding:"32px 0",color:T.textMuted}}>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,fontStyle:"italic",marginBottom:6}}>No check-ins yet</div>
                <div style={{fontSize:12}}>Your first 30-day check-in builds the foundation of your skin timeline.</div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {profile.checkIns.slice(-4).reverse().map((c,i)=>(
                  <div key={i} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:`1px solid ${T.borderLight}`}}>
                    {c.photoUrl&&<img src={c.photoUrl} alt="" style={{width:40,height:40,objectFit:"cover",flexShrink:0,border:`1px solid ${T.border}`}}/>}
                    <div>
                      <div style={{fontSize:10,color:T.textMuted,marginBottom:2}}>{new Date(c.date).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</div>
                      <div style={{fontSize:12,color:T.text}}>{c.note||"Check-in logged"}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Milestones */}
          <div style={{background:T.white,border:`1px solid ${T.border}`,padding:"24px"}}>
            <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:16}}>
              Milestones ({profile.milestones.length}/{MILESTONES.length})
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {MILESTONES.map(m=>{
                const done=profile.milestones.find(x=>x.id===m.id);
                return (
                  <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:done?T.emeraldBg:T.white,border:`1px solid ${done?T.emeraldLight+"44":T.borderLight}`,opacity:done?1:.7}}>
                    <span style={{fontSize:14}}>{m.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,fontWeight:done?600:400,color:done?T.emerald:T.textMuted}}>{m.title}</div>
                    </div>
                    <span style={{fontSize:10,fontWeight:700,color:done?T.emerald:T.textMuted}}>+{m.pts}</span>
                    {done&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.emerald} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Indian Skin Editorial Insights */}
        <div style={{marginBottom:24}}>
          <div style={{fontSize:10,fontWeight:600,color:T.emeraldMid,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:6}}>Expert knowledge</div>
          <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:400,color:T.text,fontStyle:"italic",marginBottom:16}}>Understanding Indian Skin</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
            {insights.map((ins,i)=>(
              <div key={i} style={{background:T.white,border:`1px solid ${T.border}`,padding:"20px"}}>
                <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:8,lineHeight:1.35}}>{ins.title}</div>
                <div style={{fontSize:12,color:T.textMid,lineHeight:1.75}}>{ins.body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Ritual subscription upsell */}
        <div style={{background:T.emerald,padding:"32px",display:"grid",gridTemplateColumns:"1fr auto",gap:32,alignItems:"center"}}>
          <div>
            <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:"0.18em",textTransform:"uppercase",marginBottom:8}}>Monthly ritual</div>
            <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(18px,2vw,26px)",fontWeight:400,color:"#fff",marginBottom:8,fontStyle:"italic"}}>Your Monthly Dose Box — Stage {stage}</h3>
            <p style={{fontSize:13,color:"rgba(255,255,255,.6)",lineHeight:1.65}}>
              {stage===1?"3 products sequenced for your first 30 days. A card explaining exactly why each product, in what order, at what step.":stage===2?"Your Stage 2 upgrade: a chemical exfoliant, retinol starter, and a barrier moisturiser. Delivered before your current supply runs out.":"Your Advanced protocol: clinical-grade actives, a collagen supplement, and a premium serum. Curated for where you are today."}
            </p>
          </div>
          <div style={{flexShrink:0}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginBottom:4,textAlign:"center"}}>Subscribe from</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:600,color:T.goldLight,textAlign:"center"}}>&#8377;{[0,799,1299,2299][stage]}/mo</div>
            <button onClick={()=>showNotif({title:"Ritual Added",msg:`Your Stage ${stage} ritual box has been queued.`})}
              style={{background:"#fff",color:T.emerald,border:"none",padding:"10px 24px",fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"inherit",marginTop:10,width:"100%"}}>
              Start My Ritual
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE: CHECK-IN (before photo + daily log) ────────────────────────────────
function CheckInPage({setPage}) {
  const {profile:rawCP,updateProfile,unlockMilestone} = useCtx();
  const profile = rawCP || defaultProfile();
  const [note,setNote] = useState("");
  const [photoPreview,setPhotoPreview] = useState(null);
  const [saved,setSaved] = useState(false);
  const fileRef = useRef();

  const handleFile = e => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const save = () => {
    const isFirst = !profile.beforePhoto;
    const entry = {date:new Date().toISOString(),note,photoUrl:photoPreview};
    const updates = {checkIns:[...profile.checkIns,entry]};
    if(isFirst && photoPreview) {
      updates.beforePhoto = photoPreview;
      unlockMilestone("photo");
    }
    updateProfile(updates);
    setSaved(true);
    setTimeout(()=>setPage("myskin"),2000);
  };

  return (
    <div style={{paddingBottom:120,background:T.ivory,minHeight:"100vh"}}>
      <div style={{background:T.white,borderBottom:`1px solid ${T.border}`,padding:"18px 32px"}}>
        <div style={{fontSize:11,color:T.textMuted,marginBottom:4}}>My Skin &#47; Check-in</div>
        <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(22px,3vw,36px)",fontWeight:400,color:T.text,fontStyle:"italic"}}>Today's Check-in</h1>
      </div>
      <div style={{maxWidth:560,margin:"0 auto",padding:"44px 32px"}}>
        {saved?(
          <div style={{textAlign:"center",padding:"60px 0",animation:"fadeUp .4s ease"}}>
            <div style={{width:56,height:56,borderRadius:"50%",background:T.emeraldBg,border:`2px solid ${T.emeraldLight}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.emerald} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T.emerald,fontStyle:"italic",marginBottom:8}}>Check-in saved</div>
            <div style={{fontSize:13,color:T.textMuted}}>Returning to your skin profile...</div>
          </div>
        ):(
          <>
            {/* Photo capture */}
            <div style={{marginBottom:28}}>
              <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:4}}>
                {!profile.beforePhoto?"Upload your before photo (Day 1)":"Add today's photo"}
              </div>
              <div style={{fontSize:12,color:T.textMuted,lineHeight:1.65,marginBottom:14}}>
                {!profile.beforePhoto
                  ?"This is your starting point. Take a photo in natural light, same angle, no filter."
                  :"Same conditions as your before photo — natural light, same angle, no filter."}
              </div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment"
                onChange={handleFile} style={{display:"none"}}/>
              {photoPreview?(
                <div style={{position:"relative",marginBottom:10}}>
                  <img src={photoPreview} alt="Preview" style={{width:"100%",height:200,objectFit:"cover",border:`1px solid ${T.border}`}}/>
                  <button onClick={()=>setPhotoPreview(null)}
                    style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,.5)",border:"none",color:"#fff",width:28,height:28,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>
                    &#215;
                  </button>
                </div>
              ):(
                <div onClick={()=>fileRef.current?.click()}
                  style={{height:160,background:T.ivoryAlt,border:`2px dashed ${T.border}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,cursor:"pointer",marginBottom:10,transition:"all .15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=T.emerald;e.currentTarget.style.background=T.emeraldBg;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.ivoryAlt;}}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={T.emerald} strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  <div style={{fontSize:12,color:T.emerald,fontWeight:600}}>Tap to take or upload photo</div>
                  <div style={{fontSize:10,color:T.textMuted}}>Supports JPG, PNG — max 10MB</div>
                </div>
              )}
            </div>

            {/* Note */}
            <div style={{marginBottom:28}}>
              <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:8}}>How is your skin today?</div>
              <textarea value={note} onChange={e=>setNote(e.target.value)} rows={4}
                placeholder="Any changes you've noticed? Breakouts, texture, hydration levels, how your skin feels..."
                style={{width:"100%",background:T.white,border:`1.5px solid ${T.border}`,padding:"12px 14px",fontSize:13,outline:"none",color:T.text,resize:"none",fontFamily:"inherit",lineHeight:1.65,transition:"border-color .15s"}}
                onFocus={e=>e.target.style.borderColor=T.emerald}
                onBlur={e=>e.target.style.borderColor=T.border}/>
            </div>

            <button onClick={save}
              style={{width:"100%",background:T.emerald,color:"#fff",border:"none",padding:"14px",fontSize:12,fontWeight:700,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.1em",fontFamily:"inherit"}}>
              Save Check-in
            </button>
            <button onClick={()=>setPage("myskin")}
              style={{display:"block",margin:"12px auto 0",background:"none",border:"none",color:T.textMuted,fontSize:11,cursor:"pointer",textDecoration:"underline",fontFamily:"inherit"}}>
              Skip for now
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── PAGE: CONSULT + Rx ────────────────────────────────────────────────────────
function ConsultPage({setPage}) {
  const {profile:rawConsult,updateProfile,unlockMilestone,showNotif} = useCtx();
  const profile = rawConsult || defaultProfile();
  const [tab,setTab] = useState("book"); // book | upload
  const [form,setForm] = useState({name:profile.name||"",phone:profile.phone||"",date:"",slot:"",concern:profile.concern||""});
  const [rxFile,setRxFile] = useState(null);
  const [submitted,setSubmitted] = useState(false);
  const [rxSubmitted,setRxSubmitted] = useState(false);
  const fileRef = useRef();
  const fSet = k => e => setForm(p=>({...p,[k]:e.target.value}));

  const DERMS = [
    {name:"Dr. Priya Sharma",spec:"Dermatologist",exp:"12 years",loc:"Mumbai (Online)",slots:["10:00 AM","11:30 AM","3:00 PM","5:00 PM"]},
    {name:"Dr. Rahul Mehta",spec:"Cosmetologist",exp:"9 years",loc:"Delhi (Online)",slots:["9:00 AM","12:00 PM","4:00 PM","6:00 PM"]},
    {name:"Dr. Ananya Krishnan",spec:"Dermatologist",exp:"15 years",loc:"Bangalore (Online)",slots:["10:30 AM","1:00 PM","3:30 PM","5:30 PM"]},
  ];
  const [selDerm,setSelDerm] = useState(0);
  const [selSlot,setSelSlot] = useState("");

  const bookConsult = () => {
    updateProfile({appointments:[...profile.appointments,{date:form.date,slot:selSlot,derm:DERMS[selDerm].name,status:"confirmed"}]});
    setSubmitted(true);
    showNotif({title:"Consultation Booked",msg:`${DERMS[selDerm].name} · ${form.date} at ${selSlot}. Payment via Razorpay.`});
  };

  const uploadRx = () => {
    updateProfile({rxStatus:"pending",rxFile:rxFile});
    setRxSubmitted(true);
    showNotif({title:"Prescription Submitted",msg:"Our team will review within 24 hours."});
  };

  const handleRxFile = e => {
    const file = e.target.files[0];
    if(file) setRxFile(file.name);
  };

  const inp = {background:"#fff",border:`1.5px solid ${T.border}`,padding:"11px 13px",fontSize:13,outline:"none",color:T.text,fontFamily:"inherit",width:"100%",transition:"border-color .15s"};

  return (
    <div style={{paddingBottom:120,background:T.ivory,minHeight:"100vh"}}>
      <div style={{background:T.white,borderBottom:`1px solid ${T.border}`,padding:"18px 32px"}}>
        <div style={{fontSize:11,color:T.textMuted,marginBottom:4}}>My Skin &#47; Prescription</div>
        <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(22px,3vw,36px)",fontWeight:400,color:T.text,fontStyle:"italic"}}>Prescription Access</h1>
      </div>

      <div style={{maxWidth:900,margin:"0 auto",padding:"36px 32px"}}>

        {/* Rx-gated products preview */}
        <div style={{background:T.ivoryAlt,border:`1px solid ${T.border}`,padding:"20px 22px",marginBottom:32}}>
          <div style={{fontSize:10,fontWeight:700,color:T.textMuted,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:10}}>Rx-gated products — unlock with a valid prescription</div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            {ALL.filter(p=>RX_PRODUCTS.includes(p.id)).map(p=>(
              <div key={p.id} style={{display:"flex",gap:10,background:T.white,border:`1px solid ${T.border}`,padding:"12px 14px",flex:1,minWidth:200,position:"relative",overflow:"hidden"}}>
                {profile.rxStatus!=="approved"&&(
                  <div style={{position:"absolute",inset:0,background:"rgba(250,247,242,.7)",backdropFilter:"blur(2px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1}}>
                    <div style={{textAlign:"center"}}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" style={{display:"block",margin:"0 auto 4px"}}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                      <div style={{fontSize:10,color:T.textMuted,fontWeight:600}}>Rx Required</div>
                    </div>
                  </div>
                )}
                <div style={{width:44,height:44,background:p.bg,flexShrink:0,border:`1px solid ${T.border}`}}/>
                <div>
                  <div style={{fontSize:9,color:T.gold,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em"}}>{p.brand}</div>
                  <div style={{fontSize:12,fontWeight:600,color:T.text}}>{p.name}</div>
                  <div style={{fontSize:12,fontWeight:700,color:T.text}}>&#8377;{p.price}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {profile.rxStatus==="approved"?(
          <div style={{background:T.emeraldBg,border:`1px solid ${T.emeraldLight}44`,padding:"24px",textAlign:"center",marginBottom:32}}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill={T.emerald} style={{display:"block",margin:"0 auto 10px"}}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:500,color:T.emerald,fontStyle:"italic",marginBottom:6}}>Prescription Verified</div>
            <div style={{fontSize:13,color:T.textMuted}}>All Rx-gated products are now unlocked in your account.</div>
          </div>
        ):profile.rxStatus==="pending"?(
          <div style={{background:"#FFF7ED",border:"1px solid #FED7AA",padding:"20px",marginBottom:32,textAlign:"center"}}>
            <div style={{fontSize:14,fontWeight:700,color:"#C2410C",marginBottom:4}}>Prescription Under Review</div>
            <div style={{fontSize:13,color:"#92400E"}}>Our team reviews prescriptions within 24 hours. You will be notified by email.</div>
          </div>
        ):(
          <>
            {/* Tabs */}
            <div style={{display:"flex",gap:0,borderBottom:`1px solid ${T.border}`,marginBottom:28}}>
              {[["book","Book a Consultation"],["upload","Upload Existing Rx"]].map(([v,l])=>(
                <button key={v} onClick={()=>setTab(v)}
                  style={{background:"none",border:"none",padding:"11px 20px",fontSize:12,fontWeight:tab===v?700:500,color:tab===v?T.emerald:T.textMid,borderBottom:`2px solid ${tab===v?T.emerald:"transparent"}`,cursor:"pointer",letterSpacing:"0.06em",textTransform:"uppercase",transition:"all .12s",fontFamily:"inherit",marginBottom:-1}}>
                  {l}
                </button>
              ))}
            </div>

            {tab==="book"&&(
              submitted?(
                <div style={{textAlign:"center",padding:"48px 0",animation:"fadeUp .4s ease"}}>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,color:T.emerald,fontStyle:"italic",marginBottom:8}}>Consultation Booked</div>
                  <div style={{fontSize:13,color:T.textMuted,marginBottom:4}}>{DERMS[selDerm].name} &#183; {form.date} at {selSlot}</div>
                  <div style={{fontSize:12,color:T.textMuted}}>You will receive a confirmation on {form.phone||"your phone"}. A prescription will be issued post-consult if medically appropriate.</div>
                </div>
              ):(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:14}}>Select Dermatologist</div>
                    <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
                      {DERMS.map((d,i)=>(
                        <div key={i} onClick={()=>setSelDerm(i)}
                          style={{background:selDerm===i?T.emeraldBg:T.white,border:`1.5px solid ${selDerm===i?T.emerald:T.border}`,padding:"14px 16px",cursor:"pointer",transition:"all .15s"}}>
                          <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:2}}>{d.name}</div>
                          <div style={{fontSize:11,color:T.textMuted}}>{d.spec} &#183; {d.exp} experience</div>
                          <div style={{fontSize:11,color:T.textMuted}}>{d.loc}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:8}}>Preferred Date</div>
                    <input type="date" value={form.date} onChange={fSet("date")} style={{...inp,marginBottom:14}}/>
                    <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:8}}>Select Time Slot</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {DERMS[selDerm].slots.map(s=>(
                        <button key={s} onClick={()=>setSelSlot(s)}
                          style={{background:selSlot===s?T.emerald:"#fff",color:selSlot===s?"#fff":T.textMid,border:`1px solid ${selSlot===s?T.emerald:T.border}`,padding:"7px 14px",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit",transition:"all .14s"}}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:14}}>Your Details</div>
                    <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
                      {[["name","Full name","text"],["phone","Phone number","tel"]].map(([k,ph,t])=>(
                        <input key={k} value={form[k]} onChange={fSet(k)} placeholder={ph} type={t} style={inp}
                          onFocus={e=>e.target.style.borderColor=T.emerald}
                          onBlur={e=>e.target.style.borderColor=T.border}/>
                      ))}
                      <select value={form.concern} onChange={fSet("concern")} style={{...inp,color:form.concern?T.text:T.textMuted,cursor:"pointer"}}>
                        <option value="">Primary skin concern</option>
                        {["Acne","Pigmentation","Ageing","Hairfall","Rosacea","Eczema","Other"].map(o=><option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div style={{background:T.ivoryAlt,border:`1px solid ${T.border}`,padding:"14px",marginBottom:16,fontSize:12,color:T.textMid,lineHeight:1.65}}>
                      <b style={{color:T.text}}>Consultation fee:</b> ₹299 · 20-minute video call · Prescription issued post-consult if appropriate · Valid for Rx-gated products on Dozeage
                      <div style={{marginTop:6,display:"flex",alignItems:"center",gap:6}}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.emerald} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        <span style={{color:T.emeraldMid,fontWeight:600}}>Secure payment via Razorpay</span>
                      </div>
                    </div>
                    <button onClick={bookConsult}
                      style={{width:"100%",background:T.emerald,color:"#fff",border:"none",padding:"13px",fontSize:12,fontWeight:700,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"inherit"}}>
                      Confirm Booking — &#8377;299
                    </button>
                  </div>
                </div>
              )
            )}

            {tab==="upload"&&(
              rxSubmitted?(
                <div style={{textAlign:"center",padding:"48px 0",animation:"fadeUp .4s ease"}}>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,color:T.emerald,fontStyle:"italic",marginBottom:8}}>Prescription Submitted</div>
                  <div style={{fontSize:13,color:T.textMuted}}>Under review. Usually approved within 24 hours.</div>
                </div>
              ):(
                <div style={{maxWidth:480}}>
                  <div style={{fontSize:13,color:T.textMid,lineHeight:1.7,marginBottom:24}}>Have an existing prescription from a dermatologist? Upload it here. Our team verifies all prescriptions within 24 hours.</div>
                  <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleRxFile} style={{display:"none"}}/>
                  <div onClick={()=>fileRef.current?.click()}
                    style={{height:120,background:T.ivoryAlt,border:`2px dashed ${T.border}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer",marginBottom:16,transition:"all .15s"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=T.emerald;e.currentTarget.style.background=T.emeraldBg;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.ivoryAlt;}}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.emerald} strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <div style={{fontSize:12,color:T.emerald,fontWeight:600}}>{rxFile?"File selected: "+rxFile:"Upload prescription (JPG, PNG, PDF)"}</div>
                  </div>
                  <div style={{fontSize:11,color:T.textMuted,lineHeight:1.65,marginBottom:20}}>Accepted: prescriptions issued by a licensed dermatologist or physician. Must include doctor name, registration number, and product/ingredient name.</div>
                  <button onClick={uploadRx} disabled={!rxFile}
                    style={{width:"100%",background:rxFile?T.emerald:"#ccc",color:"#fff",border:"none",padding:"13px",fontSize:12,fontWeight:700,cursor:rxFile?"pointer":"not-allowed",textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"inherit"}}>
                    Submit Prescription
                  </button>
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────
const FOOTER_NAV = {
  "Skincare":"skin","Hair":"hair","Wellness":"wellness","Vitamins":"wellness",
  "Makeup":"makeup","Men":"mens","Brands":"brands","Skin Quiz":"quiz",
  "Shop by Concern":"concern/acne","Bestsellers":"all","Under ₹500":"all",
  "New Arrivals":"all","About":"home","B2B / Wholesale":"b2b",
  "Track Order":"home","Returns":"home","Contact":"home",
};

function Footer({setPage}) {
  return (
    <footer style={{background:T.ivoryDark,borderTop:`1px solid ${T.border}`,marginBottom:50}}>
      <div style={{maxWidth:1140,margin:"0 auto",padding:"48px 32px 0",display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr",gap:40}}>
        <div>
          <div onClick={()=>setPage("home")} style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:400,color:T.emerald,marginBottom:10,fontStyle:"italic",letterSpacing:"0.04em",cursor:"pointer"}}>Dozeage</div>
          <div style={{fontSize:12,color:T.textMuted,lineHeight:1.8,marginBottom:16}}>India's premium marketplace for skin, hair, wellness and vitamins.</div>
          <div style={{fontSize:11,color:T.textMuted}}>support@dozeage.in</div>
        </div>
        {[
          {h:"Shop",l:["Skincare","Hair","Wellness","Vitamins","Makeup","Men","Brands"]},
          {h:"Discover",l:["Skin Quiz","Shop by Concern","Bestsellers","Under ₹500","New Arrivals"]},
          {h:"Company",l:["About","B2B / Wholesale","Track Order","Returns","Contact"]},
        ].map(({h,l})=>(
          <div key={h}>
            <div style={{fontSize:9,fontWeight:700,color:T.textMuted,letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:14}}>{h}</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {l.map(x=>(
                <span key={x} onClick={()=>FOOTER_NAV[x]&&setPage(FOOTER_NAV[x])}
                  style={{fontSize:12,color:T.textMid,cursor:"pointer",transition:"color .13s"}}
                  onMouseEnter={e=>e.target.style.color=T.emerald}
                  onMouseLeave={e=>e.target.style.color=T.textMid}>{x}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{maxWidth:1140,margin:"0 auto",padding:"28px 32px",borderTop:`1px solid ${T.border}`,marginTop:40,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <span style={{fontSize:11,color:T.textMuted}}>2025 Dozeage. All rights reserved.</span>
        <span style={{fontSize:11,color:T.textMuted}}>Made for Indian skin.</span>
      </div>
    </footer>
  );
}


// ─── AUTH MODAL ───────────────────────────────────────────────────────────────
function AuthModal() {
  const {authOpen,setAuthOpen,setUser,showNotif,updateProfile} = useCtx();
  const [tab,setTab] = useState("signin");
  const [form,setForm] = useState({name:"",email:"",password:"",phone:""});
  const f = k => e => setForm(p=>({...p,[k]:e.target.value}));
  const inp = {background:T.white,border:`1.5px solid ${T.border}`,padding:"11px 13px",
    fontSize:13,outline:"none",color:T.text,fontFamily:"inherit",width:"100%",transition:"border-color .15s"};
  const submit = () => {
    if(!form.email||!form.password) return;
    const u = {name:form.name||form.email.split("@")[0],email:form.email,phone:form.phone,joinedAt:new Date().toISOString()};
    setUser(u); updateProfile({name:u.name,email:u.email,phone:u.phone});
    setAuthOpen(false); setForm({name:"",email:"",password:"",phone:""});
    showNotif({title:tab==="signup"?"Account Created!":"Welcome back!",msg:`Signed in as ${u.name}`});
  };
  if(!authOpen) return null;
  return (
    <>
      <div onClick={()=>setAuthOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1500,backdropFilter:"blur(4px)"}}/>
      <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
        zIndex:1600,background:T.ivory,width:"min(440px,95vw)",boxShadow:`0 24px 64px ${T.shadowMd}`,
        animation:"fadeUp .25s ease"}}>
        <div style={{padding:"22px 28px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:500,fontStyle:"italic",color:T.text}}>
            {tab==="signin"?"Welcome Back":"Create Account"}
          </div>
          <button onClick={()=>setAuthOpen(false)} style={{background:"none",border:"none",fontSize:22,color:T.textMuted,cursor:"pointer",fontFamily:"inherit",lineHeight:1}}>×</button>
        </div>
        <div style={{display:"flex",borderBottom:`1px solid ${T.border}`}}>
          {[["signin","Sign In"],["signup","New Account"]].map(([v,l])=>(
            <button key={v} onClick={()=>setTab(v)} style={{flex:1,background:"none",border:"none",padding:"12px",fontSize:11,fontWeight:tab===v?700:500,color:tab===v?T.emerald:T.textMid,borderBottom:`2px solid ${tab===v?T.emerald:"transparent"}`,cursor:"pointer",letterSpacing:"0.08em",textTransform:"uppercase",transition:"all .12s",fontFamily:"inherit",marginBottom:-1}}>{l}</button>
          ))}
        </div>
        <div style={{padding:"22px 28px",display:"flex",flexDirection:"column",gap:11}}>
          {tab==="signup"&&<input value={form.name} onChange={f("name")} placeholder="Full name" style={inp} onFocus={e=>e.target.style.borderColor=T.emerald} onBlur={e=>e.target.style.borderColor=T.border}/>}
          <input value={form.email} onChange={f("email")} placeholder="Email address" type="email" style={inp} onFocus={e=>e.target.style.borderColor=T.emerald} onBlur={e=>e.target.style.borderColor=T.border}/>
          {tab==="signup"&&<input value={form.phone} onChange={f("phone")} placeholder="Phone number" type="tel" style={inp} onFocus={e=>e.target.style.borderColor=T.emerald} onBlur={e=>e.target.style.borderColor=T.border}/>}
          <input value={form.password} onChange={f("password")} placeholder="Password" type="password" style={inp} onFocus={e=>e.target.style.borderColor=T.emerald} onBlur={e=>e.target.style.borderColor=T.border}/>
          {tab==="signin"&&<div style={{textAlign:"right"}}><span style={{fontSize:11,color:T.emeraldMid,cursor:"pointer",fontWeight:600}}>Forgot password?</span></div>}
          <Btn fw sz="lg" onClick={submit}>{tab==="signin"?"Sign In →":"Create Account →"}</Btn>
          <div style={{display:"flex",alignItems:"center",gap:12,margin:"2px 0"}}>
            <div style={{flex:1,height:1,background:T.border}}/><span style={{fontSize:11,color:T.textMuted,whiteSpace:"nowrap"}}>or continue with</span><div style={{flex:1,height:1,background:T.border}}/>
          </div>
          <button onClick={submit} style={{width:"100%",background:T.white,border:`1.5px solid ${T.border}`,padding:"11px",fontSize:12,fontWeight:600,color:T.textMid,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"inherit",transition:"all .14s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=T.emerald} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>
          <div style={{textAlign:"center",fontSize:10,color:T.textMuted}}>By continuing you agree to our Terms &amp; Privacy Policy</div>
        </div>
      </div>
    </>
  );
}

// ─── ACCOUNT PAGE ─────────────────────────────────────────────────────────────
function AccountPage({setPage}) {
  const {user,setUser,profile,showNotif} = useCtx();
  if(!user) { return null; }
  const signOut = () => {
    setUser(null);
    try{localStorage.removeItem("dz_user");}catch(_){}
    showNotif({title:"Signed out",msg:"See you soon!"});
    setPage("home");
  };
  const totalPts = profile?.milestones?.reduce((s,m)=>s+m.pts,0)||0;
  return (
    <div style={{paddingBottom:120,background:T.ivory,minHeight:"100vh"}}>
      <div style={{background:T.emerald,padding:"36px 32px"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16}}>
          <div>
            <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:"0.18em",textTransform:"uppercase",marginBottom:8}}>My Account</div>
            <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(24px,4vw,40px)",fontWeight:400,color:"#fff",fontStyle:"italic"}}>{user.name}</h1>
            <div style={{fontSize:13,color:"rgba(255,255,255,.6)",marginTop:4}}>{user.email}{user.phone&&` · ${user.phone}`}</div>
          </div>
          <button onClick={signOut} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.3)",color:"#fff",padding:"10px 20px",fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"inherit"}}>Sign Out</button>
        </div>
      </div>
      <div style={{maxWidth:1100,margin:"0 auto",padding:"32px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14,marginBottom:28}}>
          {[["Orders","0","All time"],["Wishlist",profile?.milestones?.length||0,"milestones"],["Points",totalPts,"earned"]].map(([l,v,u])=>(
            <div key={l} style={{background:T.white,border:`1px solid ${T.border}`,padding:"22px"}}>
              <div style={{fontSize:9,color:T.textMuted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>{l}</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:600,color:T.text}}>{v}</div>
              <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{u}</div>
            </div>
          ))}
        </div>
        <div style={{background:T.white,border:`1px solid ${T.border}`,padding:"24px",marginBottom:20}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:400,color:T.text,fontStyle:"italic",marginBottom:16}}>Order History</div>
          <div style={{padding:"40px 0",textAlign:"center"}}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:T.textMuted,fontStyle:"italic",marginBottom:8}}>No orders yet</div>
            <div style={{fontSize:12,color:T.textMuted,marginBottom:18}}>Your order history will appear here after your first purchase</div>
            <Btn onClick={()=>setPage("skin")}>Start Shopping</Btn>
          </div>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Btn v="outline" onClick={()=>setPage("myskin")}>Skin Profile →</Btn>
          <Btn v="outline" onClick={()=>setPage("wishlist")}>Wishlist →</Btn>
          <Btn v="outline" onClick={()=>setPage("consult")}>Book Consult →</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── CHECKOUT PAGE ────────────────────────────────────────────────────────────
function CheckoutPage({setPage}) {
  const {cart,setCart,profile,user,showNotif} = useCtx();
  const isMobile = useWindowWidth() < 768;
  const [step,setStep] = useState("summary");
  const [addr,setAddr] = useState({name:profile?.name||user?.name||"",phone:profile?.phone||user?.phone||"",line1:"",line2:"",city:"",state:"",pin:""});
  useEffect(()=>{
    if(user) setAddr(p=>({...p,name:p.name||user.name||"",phone:p.phone||user.phone||""}));
  },[user]);
  const [coupon,setCoupon] = useState("");
  const [couponApplied,setCouponApplied] = useState(null);
  const [payMethod,setPayMethod] = useState("razorpay");
  const COUPONS = {WELCOME10:{pct:10,label:"10% off — Welcome offer"},DERM20:{pct:20,label:"20% off — Derm Special"},DOZEAGE:{pct:15,label:"15% off"}};
  const applyCoupon = () => {
    const c = COUPONS[coupon.trim().toUpperCase()];
    if(c){ setCouponApplied(c); showNotif({title:"Coupon applied!",msg:c.label}); }
    else showNotif({title:"Invalid code",msg:"Try WELCOME10, DERM20, or DOZEAGE"});
  };
  const items = ALL.filter(p=>cart[p.id]>0);
  const subtotal = items.reduce((s,p)=>s+p.price*cart[p.id],0);
  const delivery = subtotal>=499?0:49;
  const total = subtotal+delivery;
  const savings = items.reduce((s,p)=>s+(p.mrp-p.price)*cart[p.id],0);
  const af = k => e => setAddr(p=>({...p,[k]:e.target.value}));
  const inp = {background:T.white,border:`1.5px solid ${T.border}`,padding:"11px 13px",fontSize:13,outline:"none",color:T.text,fontFamily:"inherit",width:"100%",transition:"border-color .15s"};
  const STEPS = ["summary","address","payment"];
  const stepLabel = {summary:"Order Summary",address:"Delivery Address",payment:"Payment"};
  const discount = couponApplied ? Math.round(subtotal*couponApplied.pct/100) : 0;
  const total2 = subtotal + delivery - discount;
  const placeOrder = () => {
    try{localStorage.setItem("dz_last_pay",payMethod);}catch(_){}
    try{localStorage.removeItem("dz_cart");}catch(_){}
    setCart({}); setPage("order-confirm");
  };

  if(items.length===0&&step==="summary") return (
    <div style={{paddingTop:160,textAlign:"center",paddingBottom:120}}>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T.textMuted,fontStyle:"italic",marginBottom:16}}>Your bag is empty</div>
      <Btn onClick={()=>setPage("home")}>Continue Shopping</Btn>
    </div>
  );

  return (
    <div style={{paddingBottom:120,background:T.ivory,minHeight:"100vh"}}>
      {/* Promo banner */}
      <div style={{background:T.emerald,padding:`10px ${isMobile?"14px":"32px"}`,textAlign:"center"}}>
        <span style={{fontSize:12,fontWeight:600,color:"#fff",letterSpacing:"0.04em"}}>
          {delivery===0?"✓ Free delivery on this order · ":"Add ₹"+(499-subtotal)+" more for free delivery · "}
          {savings>0?`You're saving ₹${savings.toLocaleString()} on this order`:"100% Authentic Products"}
        </span>
      </div>
      {/* Step indicator */}
      <div style={{background:T.white,borderBottom:`1px solid ${T.border}`,padding:`14px ${isMobile?"14px":"32px"}`}}>
        <div style={{maxWidth:860,margin:"0 auto",display:"flex",alignItems:"center"}}>
          {STEPS.map((s,i)=>(
            <div key={s} style={{display:"flex",alignItems:"center",flex:i<STEPS.length-1?1:undefined}}>
              <div style={{display:"flex",alignItems:"center",gap:8,cursor:i<STEPS.indexOf(step)?"pointer":"default"}}
                onClick={()=>i<STEPS.indexOf(step)&&setStep(s)}>
                <div style={{width:24,height:24,borderRadius:"50%",flexShrink:0,background:STEPS.indexOf(step)>=i?T.emerald:T.ivoryDark,color:STEPS.indexOf(step)>=i?"#fff":T.textMuted,fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{i+1}</div>
                <span style={{fontSize:11,fontWeight:step===s?700:500,color:step===s?T.emerald:T.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",whiteSpace:"nowrap"}}>{stepLabel[s]}</span>
              </div>
              {i<STEPS.length-1&&<div style={{flex:1,height:1,background:T.border,margin:"0 10px"}}/>}
            </div>
          ))}
        </div>
      </div>
      <div style={{maxWidth:860,margin:"0 auto",padding:isMobile?"16px 14px":"28px 32px",display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 300px",gap:isMobile?16:24,alignItems:"start"}}>
        <div>
          {/* Summary */}
          {step==="summary"&&(
            <div style={{background:T.white,border:`1px solid ${T.border}`,padding:"24px"}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:400,color:T.text,fontStyle:"italic",marginBottom:18}}>Your Order ({items.length} item{items.length!==1?"s":""})</div>
              {items.map(p=>(
                <div key={p.id} style={{display:"flex",gap:14,padding:"14px 0",borderBottom:`1px solid ${T.borderLight}`}}>
                  <div style={{width:60,height:60,background:p.bg,flexShrink:0,border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <div style={{width:24,height:36,background:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.9)"}}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:9,color:T.gold,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:2}}>{p.brand}</div>
                    <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:3}}>{p.name}</div>
                    <div style={{fontSize:10,color:T.textMuted,letterSpacing:"0.05em",marginBottom:4}}>SKU: DZ-{String(p.id).padStart(4,"0")} &nbsp;·&nbsp; {p.sub} &nbsp;·&nbsp; Qty: {cart[p.id]}</div>
                    {p.mrp>p.price&&<span style={{fontSize:10,color:T.emeraldMid,fontWeight:600}}>Save ₹{((p.mrp-p.price)*cart[p.id]).toLocaleString()}</span>}
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:15,fontWeight:700}}>₹{(p.price*cart[p.id]).toLocaleString()}</div>
                    {p.mrp>p.price&&<div style={{fontSize:11,color:T.textMuted,textDecoration:"line-through"}}>₹{(p.mrp*cart[p.id]).toLocaleString()}</div>}
                  </div>
                </div>
              ))}
              {/* Coupon code */}
              <div style={{marginTop:18,display:"flex",gap:8}}>
                <input value={coupon} onChange={e=>setCoupon(e.target.value.toUpperCase())}
                  onKeyDown={e=>e.key==="Enter"&&applyCoupon()}
                  placeholder="Coupon code (e.g. WELCOME10)"
                  style={{flex:1,background:couponApplied?T.emeraldBg:T.white,border:`1.5px solid ${couponApplied?T.emerald:T.border}`,padding:"10px 13px",fontSize:12,outline:"none",color:T.text,fontFamily:"inherit",transition:"border-color .15s",letterSpacing:"0.05em"}}
                  onFocus={e=>e.target.style.borderColor=T.emerald}
                  onBlur={e=>e.target.style.borderColor=couponApplied?T.emerald:T.border}/>
                <Btn v={couponApplied?"subtle":"outline"} sz="sm" onClick={applyCoupon}
                  style={couponApplied?{border:`1.5px solid ${T.emerald}`,color:T.emerald}:{}}>
                  {couponApplied?"✓ Applied":"Apply"}
                </Btn>
              </div>
              {couponApplied&&<div style={{fontSize:11,color:T.emeraldMid,fontWeight:600,marginTop:6}}>{couponApplied.label}</div>}
              <div style={{marginTop:14}}><Btn fw sz="lg" onClick={()=>setStep("address")}>Continue to Delivery →</Btn></div>
            </div>
          )}
          {/* Address */}
          {step==="address"&&(
            <div style={{background:T.white,border:`1px solid ${T.border}`,padding:"24px"}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:400,color:T.text,fontStyle:"italic",marginBottom:18}}>Delivery Address</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[["name","Full name","text"],["phone","Phone number","tel"],["line1","Address line 1","text"],["line2","Apartment, area (optional)","text"],["city","City","text"],["state","State","text"]].map(([k,ph,t])=>(
                  <input key={k} value={addr[k]} onChange={af(k)} placeholder={ph} type={t} style={{...inp,gridColumn:k==="line1"||k==="line2"?"1/-1":undefined}}
                    onFocus={e=>e.target.style.borderColor=T.emerald} onBlur={e=>e.target.style.borderColor=T.border}/>
                ))}
                <input value={addr.pin} onChange={af("pin")} placeholder="PIN code" maxLength={6} style={inp}
                  onFocus={e=>e.target.style.borderColor=T.emerald} onBlur={e=>e.target.style.borderColor=T.border}/>
              </div>
              <div style={{marginTop:16}}><Btn fw sz="lg" onClick={()=>{if(addr.name&&addr.line1&&addr.city&&addr.pin)setStep("payment");else showNotif({title:"Incomplete address",msg:"Please fill all required fields"});}}>Continue to Payment →</Btn></div>
            </div>
          )}
          {/* Payment */}
          {step==="payment"&&(
            <div style={{background:T.white,border:`1px solid ${T.border}`,padding:"24px"}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:400,color:T.text,fontStyle:"italic",marginBottom:18}}>Payment Method</div>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
                {[
                ["razorpay","Pay via Razorpay","UPI · Cards · NetBanking · Wallets"],
                ["cod","Cash on Delivery","No payment now · Pay when delivered"],
              ].map(([id,label,sub])=>{
                const sel = payMethod===id;
                return (
                  <div key={id} onClick={()=>setPayMethod(id)}
                    style={{background:sel?T.emeraldBg:T.ivoryAlt,border:`1.5px solid ${sel?T.emerald:T.border}`,
                      padding:"16px",display:"flex",gap:12,alignItems:"center",cursor:"pointer",transition:"all .15s"}}>
                    <div style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${sel?T.emerald:T.border}`,
                      background:sel?T.emerald:"transparent",flexShrink:0,display:"flex",
                      alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
                      {sel&&<div style={{width:6,height:6,borderRadius:"50%",background:"#fff"}}/>}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:T.text}}>{label}</div>
                      <div style={{fontSize:11,color:T.textMuted}}>{sub}</div>
                    </div>
                  </div>
                );
              })}
              </div>
              <div style={{background:T.emeraldBg,border:`1px solid ${T.emeraldLight}44`,padding:"11px 14px",marginBottom:18,display:"flex",alignItems:"center",gap:8}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.emerald} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span style={{fontSize:11,color:T.emeraldMid,fontWeight:600}}>100% secure · SSL encrypted · Powered by Razorpay</span>
              </div>
              <Btn fw sz="lg" onClick={placeOrder}>{payMethod==="cod"?"Place Order — Pay on Delivery →":`Pay ₹${total2.toLocaleString()} →`}</Btn>
            </div>
          )}
        </div>
        {/* Order sidebar */}
        <div style={{background:T.white,border:`1px solid ${T.border}`,padding:"20px",position:"sticky",top:150}}>
          <div style={{fontSize:10,fontWeight:700,color:T.textMuted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:14}}>Order Summary</div>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${T.borderLight}`}}>
            {items.map(p=>(
              <div key={p.id} style={{display:"flex",gap:8,alignItems:"center"}}>
                <div style={{width:30,height:30,background:p.bg,flexShrink:0,border:`1px solid ${T.border}`}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                  <div style={{fontSize:10,color:T.textMuted}}>×{cart[p.id]}</div>
                </div>
                <span style={{fontSize:12,fontWeight:700,flexShrink:0}}>₹{(p.price*cart[p.id]).toLocaleString()}</span>
              </div>
            ))}
          </div>
          {[
            ["Subtotal",`₹${subtotal.toLocaleString()}`],
            ["Delivery",delivery===0?"FREE ✓":`₹${delivery}`],
            savings>0?["Product savings",`-₹${savings.toLocaleString()}`]:null,
            couponApplied?["Coupon",`-₹${discount.toLocaleString()}`]:null,
          ].filter(Boolean).map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
              <span style={{fontSize:12,color:T.textMuted}}>{l}</span>
              <span style={{fontSize:12,fontWeight:600,color:(l==="Product savings"||l==="Coupon")?T.emeraldMid:l==="Delivery"&&delivery===0?T.emeraldMid:T.text}}>{v}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",marginTop:12,paddingTop:12,borderTop:`1px solid ${T.border}`}}>
            <span style={{fontSize:13,fontWeight:700}}>Total</span>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600}}>₹{total2.toLocaleString()}</span>
          </div>
          {(savings+discount)>0&&<div style={{background:T.emeraldBg,padding:"8px 10px",marginTop:10,fontSize:11,color:T.emeraldMid,fontWeight:700,textAlign:"center"}}>You save ₹{(savings+discount).toLocaleString()} 🎉</div>}
        </div>
      </div>
    </div>
  );
}

// ─── ORDER CONFIRM PAGE ───────────────────────────────────────────────────────
function OrderConfirmPage({setPage}) {
  const {profile,user} = useCtx();
  const orderNum = useMemo(()=>"DZ"+Date.now().toString().slice(-6),[]);
  const name = profile?.name||user?.name||"there";
  const expectedDate = getDeliveryDate();
  const payLabel = (()=>{ try{const v=localStorage.getItem("dz_last_pay");return v==="cod"?"Cash on Delivery":"Razorpay · Confirmed";}catch{return "Confirmed";} })();
  return (
    <div style={{paddingBottom:120,background:T.ivory,minHeight:"100vh"}}>
      <div style={{maxWidth:580,margin:"0 auto",padding:"64px 32px",textAlign:"center"}}>
        <div style={{width:72,height:72,borderRadius:"50%",background:T.emeraldBg,border:`2px solid ${T.emeraldLight}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 24px"}}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={T.emerald} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(28px,4vw,42px)",fontWeight:400,color:T.text,fontStyle:"italic",marginBottom:8}}>Order Placed!</div>
        <div style={{fontSize:14,color:T.textMuted,marginBottom:28,lineHeight:1.7}}>Thank you, <b style={{color:T.text}}>{name}</b>. Your order <b style={{color:T.text}}>#{orderNum}</b> is confirmed and being prepared.</div>
        <div style={{background:T.white,border:`1px solid ${T.border}`,padding:"20px 24px",marginBottom:28,display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,textAlign:"left"}}>
          {[["Order ID","#"+orderNum],["Expected Delivery",expectedDate],["Payment",payLabel],["Status","Being Prepared ✓"]].map(([l,v])=>(
            <div key={l}>
              <div style={{fontSize:9,fontWeight:700,color:T.textMuted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:4}}>{l}</div>
              <div style={{fontSize:13,fontWeight:600,color:T.text}}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{fontSize:12,color:T.textMuted,marginBottom:24}}>You'll receive a confirmation on WhatsApp &amp; email shortly.</div>
        <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
          <Btn onClick={()=>setPage("home")}>Continue Shopping</Btn>
          <Btn v="outline" onClick={()=>setPage("account")}>My Orders</Btn>
        </div>
      </div>
    </div>
  );
}

function WishlistPage({setPage}) {
  const {wishlist,addCart,cart} = useCtx();
  const items = ALL.filter(p=>wishlist.includes(p.id));
  return (
    <div style={{paddingBottom:120,background:T.ivory,minHeight:"100vh"}}>
      <div style={{background:T.white,borderBottom:"1px solid "+T.border,padding:"18px 32px"}}>
        <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(22px,3vw,36px)",fontWeight:400,color:T.text,fontStyle:"italic"}}>Saved Items ({items.length})</h1>
      </div>
      <div style={{maxWidth:1140,margin:"0 auto",padding:"32px"}}>
        {items.length===0?(
          <div style={{padding:"80px 0",textAlign:"center"}}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T.textMuted,marginBottom:8,fontStyle:"italic"}}>Nothing saved yet</div>
            <div style={{fontSize:13,color:T.textMuted,marginBottom:20}}>Heart any product to save it here</div>
            <Btn onClick={()=>setPage("skin")}>Browse Skincare</Btn>
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14}}>
            {items.map(p=><PCard key={p.id} p={p}/>)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MOBILE HOOK ─────────────────────────────────────────────────────────────
function useWindowWidth() {
  const [w,setW] = useState(()=>typeof window!=="undefined"?window.innerWidth:1200);
  useEffect(()=>{
    const h = ()=>setW(window.innerWidth);
    window.addEventListener("resize",h);
    return ()=>window.removeEventListener("resize",h);
  },[]);
  return w;
}

// ─── CONTEXT ─────────────────────────────────────────────────────────────────
const Ctx = createContext(null);
const useCtx = () => useContext(Ctx);

// ─── ROOT ─────────────────────────────────────────────────────────────────────
// Module-level products list — starts as the local mock catalog.
// When VITE_USE_SHOPIFY=true this gets replaced by the Storefront API response.
let PRODUCTS = ALL;

// ─── MOBILE BOTTOM NAV ───────────────────────────────────────────────────────
function MobileBottomNav({page,setPage}) {
  const {cartCount,wishlist,setAuthOpen,user,setCartOpen} = useCtx();
  const cur = p => {
    if(p==="home"&&(page==="home"||page===""))return true;
    if(p==="cats"&&(page==="skin"||page==="hair"||page==="wellness"||page==="makeup"))return true;
    if(p==="search"&&(page==="search"||page.startsWith("search/")))return true;
    if(p==="wishlist"&&page==="wishlist")return true;
    if(p==="account"&&(page==="account"||page==="myskin"))return true;
    return false;
  };
  const tabs = [
    {id:"home",   label:"Home",       page:"home",
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>},
    {id:"cats",   label:"Categories", page:"skin",
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>},
    {id:"search", label:"Search",     page:"search",
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>},
    {id:"wishlist",label:"Wishlist",  page:"wishlist",
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>},
    {id:"account",label:"Account",   page:"account",
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>},
  ];
  return (
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:1400,
      background:"#fff",borderTop:"1px solid #E8E4DE",
      display:"flex",height:56,paddingBottom:"env(safe-area-inset-bottom)"}}>
      {tabs.map(t=>{
        const active = cur(t.id);
        return (
          <button key={t.id}
            onClick={()=>t.id==="account"&&!user ? setAuthOpen(true) : setPage(t.page)}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",
              justifyContent:"center",gap:2,border:"none",background:"none",cursor:"pointer",
              color:active?T.emerald:T.textMuted,fontFamily:"inherit",
              transition:"color .15s",padding:"4px 0",position:"relative"}}>
            {t.id==="wishlist"&&wishlist.length>0&&(
              <span style={{position:"absolute",top:4,right:"calc(50% - 18px)",
                background:T.red,color:"#fff",fontSize:7,fontWeight:800,
                minWidth:14,height:14,borderRadius:7,display:"flex",alignItems:"center",
                justifyContent:"center",padding:"0 3px"}}>{wishlist.length}</span>
            )}
            <span style={{display:"flex"}}>{t.icon}</span>
            <span style={{fontSize:9,fontWeight:active?700:500,letterSpacing:"0.04em",
              textTransform:"uppercase"}}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function App() {
  const [page,setPage]               = useState("home");
  const [productsReady,setProductsReady] = useState(!shopifyEnabled);
  const isMobile = useWindowWidth() < 768;

  // Lazy init: read from localStorage on first render — no flash, no race condition
  const [cart,setCart]               = useState(()=>{ try{return JSON.parse(localStorage.getItem("dz_cart")||"{}");}catch{return {};} });
  const [cartOpen,setCartOpen]       = useState(false);
  const [aiOpen,setAiOpen]           = useState(false);
  const [wishlist,setWishlist]       = useState(()=>{ try{return JSON.parse(localStorage.getItem("dz_wish")||"[]");}catch{return [];} });
  const [profile,setProfile]         = useState(()=>{ try{const v=localStorage.getItem("dz_profile");return v?JSON.parse(v):defaultProfile();}catch{return defaultProfile();} });
  const [profileOpen,setProfileOpen] = useState(false);
  const [notifBanner,setNotifBanner] = useState(null);
  const [user,setUser]               = useState(()=>{ try{const v=localStorage.getItem("dz_user");return v?JSON.parse(v):null;}catch{return null;} });
  const [authOpen,setAuthOpen]       = useState(false);

  // Bootstrap Shopify products when env flag is on
  useEffect(()=>{
    if(!shopifyEnabled) return;
    fetchAllProducts().then(data=>{ if(data){ PRODUCTS=data; } setProductsReady(true); }).catch(()=>setProductsReady(true));
  },[]);

  // Persist on change
  useEffect(()=>{ try{localStorage.setItem("dz_cart",JSON.stringify(cart));}catch(_){} },[cart]);
  useEffect(()=>{ try{localStorage.setItem("dz_wish",JSON.stringify(wishlist));}catch(_){} },[wishlist]);
  useEffect(()=>{ try{localStorage.setItem("dz_profile",JSON.stringify(profile));}catch(_){} },[profile]);
  useEffect(()=>{ try{localStorage.setItem("dz_user",JSON.stringify(user));}catch(_){} },[user]);

  const cartCount = Object.values(cart).reduce((s,v)=>s+(v||0),0);

  const addCart = useCallback(
    id => setCart(p=>({...p,[id]:(p[id]||0)+1})),
    []
  );
  const toggleWish = useCallback(
    id => setWishlist(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]),
    []
  );
  const updateProfile = useCallback(
    patch => setProfile(p=>({...p,...patch})),
    []
  );
  const unlockMilestone = useCallback(id => {
    setProfile(p=>{
      if(p.milestones.find(m=>m.id===id)) return p;
      const m = MILESTONES.find(x=>x.id===id);
      if(!m) return p;
      return {...p, milestones:[...p.milestones,{...m,completedAt:new Date().toISOString()}]};
    });
  },[]);
  const showNotif = useCallback(notif => {
    setNotifBanner(notif);
    setTimeout(()=>setNotifBanner(null),3500);
  },[]);

  const render = () => {
    if(!productsReady) return (
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh",flexDirection:"column",gap:16}}>
        <div style={{width:36,height:36,border:`3px solid #E5E0D8`,borderTop:`3px solid #1B4332`,borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,color:"#8A847A",fontStyle:"italic"}}>Loading your wellness store…</div>
      </div>
    );
    if(page==="home")     return <Home setPage={setPage}/>;
    if(page==="quiz")     return <Quiz setPage={setPage}/>;
    if(page==="brands")   return <Brands setPage={setPage}/>;
    if(page==="b2b")      return <B2B/>;
    if(page==="search")   return <Search/>;
    if(page==="myskin")   return <MySkinPage setPage={setPage}/>;
    if(page==="checkin")  return <CheckInPage setPage={setPage}/>;
    if(page==="consult")  return <ConsultPage setPage={setPage}/>;
    if(page==="wishlist")      return <WishlistPage setPage={setPage}/>;
    if(page==="account")       return <AccountPage setPage={setPage}/>;
    if(page==="checkout")      return <CheckoutPage setPage={setPage}/>;
    if(page==="order-confirm") return <OrderConfirmPage setPage={setPage}/>;
    if(page.startsWith("search/"))  return <Search query={page.split("/").slice(1).join("/")} />;
    if(page.startsWith("product/")) return <ProductDetail id={page.split("/")[1]} setPage={setPage}/>;
    return <Catalog cat={page}/>;
  };

  return (
    <Ctx.Provider value={{
      cart,setCart,addCart,cartCount,cartOpen,setCartOpen,aiOpen,setAiOpen,
      wishlist,toggleWish,profile,updateProfile,profileOpen,setProfileOpen,
      unlockMilestone,notifBanner,showNotif,setPage,
      user,setUser,authOpen,setAuthOpen,
    }}>
      <style>{GLOBAL_CSS}</style>
      <Nav page={page} setPage={setPage}/>
      <div style={{paddingTop:132}}>{render()}</div>
      <Footer setPage={setPage}/>
      <CartDrawer/>
      <AIBar/>
      <NotifBanner/>
      <ProfileDrawer setPage={setPage}/>
      <AuthModal/>
      <a href="https://wa.me/919876543210" target="_blank" rel="noreferrer"
        style={{position:"fixed",right:20,bottom:72,zIndex:699,background:"#25D366",
          color:"#fff",width:46,height:46,borderRadius:"50%",display:"flex",
          alignItems:"center",justifyContent:"center",
          boxShadow:"0 4px 16px rgba(37,211,102,.4)",textDecoration:"none"}}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>
    </Ctx.Provider>
  );
}

