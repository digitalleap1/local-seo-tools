/* ==========================================================================
 * GLOBAL NAVIGATION — Local SEO Tools Suite
 * Shared mega-menu injected into every tool. Single source of truth for the
 * tool registry. Categories, search, custom-tool registration, theme-aware.
 *
 * USAGE: Add <script src="global-nav.js"></script> to any tool's <body>.
 *
 * EXTENDING: Add new tools to the GN_TOOLS object below — they appear in the
 * menu and dashboard automatically. Users can also register custom tools at
 * runtime via:  window.GlobalNav.registerTool({id, url, name, category, ...})
 * Custom registrations persist in localStorage (key: gn_custom_tools_v1).
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__globalNavLoaded){ return; }
  window.__globalNavLoaded = true;

  /* ---------- GLOBAL THEME (single source of truth across all 70 tools) ---------- */
  const GN_THEME_KEY = 'seohub_theme_v1';
  function gnGetTheme(){ try{ return localStorage.getItem(GN_THEME_KEY); }catch(e){ return null; } }
  function gnStoreTheme(v){ try{ localStorage.setItem(GN_THEME_KEY, v); }catch(e){} }
  function gnApplyTheme(v){ if(v) document.documentElement.setAttribute('data-theme', v); }
  function gnCurrentTheme(){ return document.documentElement.getAttribute('data-theme')==='dark' ? 'dark' : 'light'; }
  // Re-apply the stored theme ASAP so every page agrees, even if a tool defaulted differently.
  (function(){ const t = gnGetTheme(); if(t) gnApplyTheme(t); })();
  function gnToggleTheme(){
    // Prefer the page's own toggle (keeps that tool's label/icon in sync); fall back to a plain flip.
    if(typeof window.toggleTheme === 'function'){ try{ window.toggleTheme(); }catch(e){ gnFlipTheme(); } }
    else { gnFlipTheme(); }
    gnStoreTheme(gnCurrentTheme());
    gnSyncThemeUI();
  }
  function gnFlipTheme(){ const next = gnCurrentTheme()==='dark'?'light':'dark'; gnApplyTheme(next); gnStoreTheme(next); }
  function gnSyncThemeUI(){
    const dark = gnCurrentTheme()==='dark';
    document.querySelectorAll('.gn-theme-lbl').forEach(el=> el.textContent = dark?'Dark':'Light');
    document.querySelectorAll('[data-gn-theme-icon]').forEach(el=> el.innerHTML = dark ? GN_ICON_MOON : GN_ICON_SUN);
  }
  const GN_ICON_SUN  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  const GN_ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  // Persist any theme change made by a tool's own toggle, and sync chrome UI.
  try {
    const _mo = new MutationObserver(()=>{ gnStoreTheme(gnCurrentTheme()); gnSyncThemeUI(); });
    _mo.observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
  } catch(e){}
  // Cross-tab: react when another tab changes the theme.
  window.addEventListener('storage', e=>{ if(e.key===GN_THEME_KEY && e.newValue){ gnApplyTheme(e.newValue); gnSyncThemeUI(); } });

  /* ---------- CATEGORIES ---------- */
  const GN_CATS = [
    {id:'citations', name:'Citations & Listings',   sub:'NAP, directories, niche, aggregators',    color:'#0d9488', tools:['cf','nap','cg','ml','agg','sam','nc']},
    {id:'gbp',       name:'Google Business Profile', sub:'GBP audit, categories, services, holidays',color:'#4285f4', tools:['gbp','gbpcat','gbpsv','ps','qa','gp','gpi','sr','ssen','gbpp','hol']},
    {id:'reviews',   name:'Reviews & Reputation',   sub:'Replies, sentiment, brand SERP, KP, press',color:'#db2777', tools:['rev','sm','bs','bm','kp','press']},
    {id:'rankings',  name:'Rankings & SERP',        sub:'Geo-grid, pack, CTR, forecast, SERP, GSC',color:'#7c3aed', tools:['gg','pt','sr2','ctr','snip','fc','gsc']},
    {id:'content',   name:'Content & Keywords',     sub:'Keywords, briefs, FAQ, mapping, headings',color:'#ea580c', tools:['kw','cb','vf','aiw','aiss','cc','ha','km']},
    {id:'technical', name:'Technical SEO',          sub:'Schema, audits, crawl, mobile, redirects', color:'#0891b2', tools:['sch','sa','pa','sc','rs','iseo','il','mux','bsch','ba','hl','rd']},
    {id:'backlinks', name:'Backlinks & Outreach',   sub:'Profile, outreach, anchors, velocity',    color:'#9333ea', tools:['bl','lo','dis','at','bv']},
    {id:'visual',    name:'Visual & Media',         sub:'Geotag, image SEO, photos',               color:'#16a34a', tools:['gt']},
    {id:'ai',        name:'AI Search & Strategy',   sub:'AI, GEO/AEO, strategy, workspace, glossary', color:'#2563eb', tools:['ai','sg','roi','geo','wlr','cp','lcl','hm','ob','gl','ws']},
  ];

  /* ---------- TOOL REGISTRY (master) ---------- */
  const GN_TOOLS = {
    // Hub
    dashboard: {url:'dashboard.html',          name:'Command Center',          code:'HUB',color:'#2563eb', key:null,           desc:'Unified dashboard'},
    tools:     {url:'tools.html',              name:'Tools Hub',               code:'IDX',color:'#2563eb', key:null,           desc:'Original tools index'},
    guide:     {url:'guide.html',              name:'Guides & How-To',         code:'?',  color:'#2563eb', key:null,           desc:'Step-by-step guide for every tool'},

    // Citations & Listings
    cf:  {url:'citation-finder.html',    name:'Citation Finder Pro',    code:'CF', color:'#0d9488', key:'cf_state_v1',  desc:'Find/scan citations across 100+ directories'},
    nap: {url:'nap-checker.html',        name:'NAP Checker',            code:'NAP',color:'#0d9488', key:'nap_state_v1', desc:'NAP consistency auditor with fuzzy matching'},
    cg:  {url:'competitor-gap.html',     name:'Competitor Citation Gap',code:'CG', color:'#0d9488', key:'cg_state_v1',  desc:'Citations competitors have that you don\'t'},
    ml:  {url:'multi-location.html',     name:'Multi-Location Manager', code:'ML', color:'#0d9488', key:'ml_state_v1',  desc:'Manage NAP across multiple locations'},
    agg: {url:'aggregator-tracker.html', name:'Aggregator Tracker',     code:'AGG',color:'#0d9488', key:'agg_state_v1', desc:'Data Axle / Foursquare / Neustar / Acxiom'},

    // GBP
    gbp: {url:'gbp-audit.html',          name:'GBP Local Audit',        code:'GBP',color:'#4285f4', key:'gbp_state_v1', desc:'150+ GBP optimization checks'},
    ps:  {url:'post-scheduler.html',     name:'GBP Post Scheduler',     code:'PS', color:'#4285f4', key:'ps_state_v1',  desc:'AI-generated GBP posts with scheduling'},
    qa:  {url:'gbp-qa.html',             name:'GBP Q&A Manager',        code:'QA', color:'#4285f4', key:'qa_state_v1',  desc:'Bulk Q&A drafting with AI answers'},
    gp:  {url:'gbp-performance.html',    name:'GBP Performance',        code:'GP', color:'#4285f4', key:'gp_state_v1',  desc:'Import & analyze GBP Insights CSVs'},
    sr:  {url:'suspension-risk.html',    name:'Suspension Risk Calc',   code:'SR', color:'#4285f4', key:'sr_state_v1',  desc:'GBP suspension risk scorecard'},

    // Reviews & Reputation
    rev: {url:'review-reply.html',       name:'Review Replies',         code:'RR', color:'#db2777', key:'rr_state_v1',  desc:'AI-drafted review responses'},
    sm:  {url:'sentiment-monitor.html',  name:'Sentiment Monitor',      code:'SM', color:'#db2777', key:'sm_state_v1',  desc:'Review sentiment + fake-flag detection'},
    bs:  {url:'brand-serp.html',         name:'Brand SERP Auditor',     code:'BS', color:'#db2777', key:'bs_state_v1',  desc:'Knowledge panel, sitelinks, brand SERP'},

    // Rankings
    gg:  {url:'geo-grid-tracker.html',   name:'Geo-Grid Tracker',       code:'GG', color:'#7c3aed', key:'gg_state_v1',  desc:'Geo-grid rank tracking with SoLV'},
    pt:  {url:'pack-tracker.html',       name:'Pack Tracker',           code:'PT', color:'#7c3aed', key:'pt_state_v1',  desc:'Local pack position monitoring'},
    sr2: {url:'serp-ranker.html',        name:'SERP Ranker',            code:'SRP',color:'#7c3aed', key:'sr2_state_v1', desc:'SERP feature & ranking analyzer'},
    ctr: {url:'ctr-title-lab.html',      name:'CTR Title Lab',          code:'CTR',color:'#7c3aed', key:'ctr_state_v1', desc:'Title/meta variants + CTR prediction'},

    // Content
    kw:  {url:'keyword-research.html',   name:'Keyword Research',       code:'KW', color:'#ea580c', key:'kw_state_v1',  desc:'Local keyword discovery & clustering'},
    cb:  {url:'content-brief.html',      name:'Content Brief Builder',  code:'CB', color:'#ea580c', key:'cb_state_v1',  desc:'SERP-driven content briefs'},
    vf:  {url:'voice-faq.html',          name:'Voice & FAQ',            code:'VF', color:'#ea580c', key:'vf_state_v1',  desc:'Voice search optimization + FAQ schema'},
    aiw: {url:'ai-content-writer.html',  name:'AI Content Writer',      code:'AIW',color:'#ea580c', key:'aiw_state_v1', desc:'AI-powered local content generation'},
    aiss:{url:'ai-seo-scanner.html',     name:'AI SEO Scanner',         code:'AIS',color:'#ea580c', key:'aiss_state_v1',desc:'AI-driven on-page SEO scan'},
    cc:  {url:'content-calendar.html',   name:'Content Calendar',       code:'CC', color:'#ea580c', key:'cc_state_v1',  desc:'Editorial calendar for local content', isNew:true},

    // Technical
    sch: {url:'schema-generator.html',   name:'Schema Generator',       code:'SCH',color:'#0891b2', key:'sch_state_v1', desc:'LocalBusiness JSON-LD generator'},
    sa:  {url:'schema-auditor.html',     name:'Schema Auditor',         code:'SA', color:'#0891b2', key:'sa_state_v1',  desc:'Validate live schema markup'},
    pa:  {url:'page-auditor.html',       name:'Page Auditor',           code:'PA', color:'#0891b2', key:'pa_state_v1',  desc:'On-page local SEO audit'},
    sc:  {url:'site-crawler.html',       name:'Site Crawler',           code:'SC', color:'#0891b2', key:'sc_state_v1',  desc:'Full-site technical crawler'},
    rs:  {url:'robots-sitemap.html',     name:'Robots/Sitemap',         code:'RS', color:'#0891b2', key:'rs_state_v1',  desc:'robots.txt + sitemap.xml builder'},
    iseo:{url:'image-seo.html',          name:'Image SEO Auditor',      code:'IMG',color:'#0891b2', key:'iseo_state_v1',desc:'Alt text, file names, image SEO scan', isNew:true},

    // Backlinks
    bl:  {url:'backlink-profile.html',   name:'Backlink Profile',       code:'BL', color:'#9333ea', key:'bl_state_v1',  desc:'Link profile + toxicity analyzer'},
    lo:  {url:'link-outreach.html',      name:'Link Outreach Tracker',  code:'LO', color:'#9333ea', key:'lo_state_v1',  desc:'Local link building campaign manager', isNew:true},

    // Visual
    gt:  {url:'geotag-pro.html',         name:'GeoTag Studio',          code:'GT', color:'#16a34a', key:'gt_state_v1',  desc:'Photo/video geotagging + image SEO'},

    // AI, Strategy, ROI, GEO
    ai:  {url:'ai-assistant.html',       name:'AI Assistant',           code:'AI', color:'#2563eb', key:'ai_state_v1',  desc:'Chat with AI grounded in all your data'},
    sg:  {url:'strategy-generator.html', name:'Strategy Generator',     code:'SG', color:'#2563eb', key:'sg_state_v1',  desc:'AI-generated 12-phase local SEO plan'},
    roi: {url:'roi-calculator.html',     name:'ROI Calculator',         code:'ROI',color:'#2563eb', key:'roi_state_v1', desc:'Convert metrics → dollar projections'},
    geo: {url:'geo-optimizer.html',      name:'GEO / AEO Optimizer',    code:'GEO',color:'#2563eb', key:'geo_state_v1', desc:'AI search optimization (ChatGPT, Perplexity, Google AI)'},
    wlr: {url:'white-label-report.html', name:'White-Label Report',     code:'RPT',color:'#2563eb', key:'wlr_state_v1', desc:'Comprehensive client report builder (30+ sections)', isNew:true},

    // Phase 9 additions
    il:  {url:'internal-links.html',     name:'Internal Link Optimizer',code:'IL', color:'#0891b2', key:'il_state_v1',  desc:'Map link graph, find orphans, suggest internal links'},
    snip:{url:'snippet-optimizer.html',  name:'SERP Snippet Lab',       code:'SNP',color:'#7c3aed', key:'snip_state_v1',desc:'Title + meta description CTR optimizer'},
    ssen:{url:'spam-sentinel.html',      name:'Spam Sentinel',          code:'SPM',color:'#dc2626', key:'ss_state_v1',  desc:'Detect competitor GBP spam + listing hijacks'},

    // Phase 10 additions
    sam: {url:'service-area-mapper.html',name:'Service Area Mapper',    code:'SAM',color:'#0d9488', key:'sam_state_v1', desc:'Plan GBP service areas with map visualization'},
    mux: {url:'mobile-ux.html',          name:'Mobile UX Auditor',      code:'MUX',color:'#7c3aed', key:'mux_state_v1', desc:'Mobile UX, tap targets, click-to-call audit'},
    fc:  {url:'forecast.html',           name:'Position Forecaster',    code:'FC', color:'#0891b2', key:'fc_state_v1',  desc:'90-day position + revenue forecast with scenarios'},
    gbpp:{url:'gbp-photos.html',         name:'GBP Photo Strategy',     code:'PH', color:'#4285f4', key:'gbpp_state_v1',desc:'Plan + AI-grade GBP photos by category'},

    // Phase 11 additions
    ha:  {url:'heading-audit.html',      name:'Heading Hierarchy',      code:'HA', color:'#0891b2', key:'ha_state_v1',  desc:'H1-H6 structure audit for SEO + a11y'},
    dis: {url:'disavow-builder.html',    name:'Disavow Builder',        code:'DIS',color:'#9333ea', key:'dis_state_v1', desc:'Generate disavow.txt from toxic backlinks'},
    nc:  {url:'niche-citations.html',    name:'Niche Citation Finder',  code:'NC', color:'#0d9488', key:'nc_state_v1',  desc:'Industry-specific directories (medical, legal, etc.)'},
    bm:  {url:'brand-mentions.html',     name:'Brand Mention Tracker',  code:'BM', color:'#db2777', key:'bm_state_v1',  desc:'Find unlinked brand mentions → outreach for links'},

    // Phase 12 additions
    lcl: {url:'local-checklist.html',    name:'Local SEO Checklist',    code:'CHK',color:'#16a34a', key:'lc_state_v1',  desc:'100-point tactical checklist with cadence'},
    cp:  {url:'conversion-paths.html',   name:'Conversion Paths',       code:'CP', color:'#7c3aed', key:'cp_state_v1',  desc:'GBP → site → conversion funnel + UTM builder'},
    bsch:{url:'bulk-schema.html',        name:'Bulk Schema',            code:'BS', color:'#0891b2', key:'bsch_state_v1',desc:'Generate JSON-LD for many URLs from CSV'},
    km:  {url:'keyword-mapper.html',     name:'Keyword Mapper',         code:'KM', color:'#ea580c', key:'km_state_v1',  desc:'Map keywords to URLs, detect cannibalization'},

    // Phase 13 additions
    hm:  {url:'health-monitor.html',     name:'Health Monitor',         code:'HM', color:'#16a34a', key:'hm_state_v1',  desc:'Score snapshots, trends, regression alerts'},
    gpi: {url:'gbp-insights.html',       name:'GBP Insights Analyzer',  code:'GPI',color:'#4285f4', key:'gpi_state_v1', desc:'Visual analytics for GBP Performance data'},
    ob:  {url:'onboarding.html',         name:'Onboarding Wizard',      code:'OB', color:'#2563eb', key:'ob_state_v1',  desc:'12-step guided setup for new local businesses'},
    ba:  {url:'bulk-audit.html',         name:'Multi-Page Audit',       code:'BA', color:'#0891b2', key:'ba_state_v1',  desc:'On-page audit across up to 50 URLs at once'},

    // Phase 14 additions
    at:  {url:'anchor-text.html',        name:'Anchor Text Analyzer',   code:'AT', color:'#9333ea', key:'at_state_v1',  desc:'Backlink anchor profile + Penguin-risk detection'},
    hl:  {url:'hreflang.html',           name:'Hreflang Generator',     code:'HL', color:'#0d9488', key:'hl_state_v1',  desc:'Multi-region/language hreflang audit + generator'},
    gl:  {url:'glossary.html',           name:'Local SEO Glossary',     code:'GL', color:'#7c3aed', key:null,           desc:'Searchable reference of 100+ local SEO terms'},
    bv:  {url:'backlink-velocity.html',  name:'Backlink Velocity',      code:'BV', color:'#9333ea', key:'bv_state_v1',  desc:'Track new/lost backlinks over time with alerts'},

    // Phase 15 additions
    ws:  {url:'workspace.html',          name:'Workspace Manager',      code:'WS', color:'#2563eb', key:null,           desc:'Multi-client workspace switcher for agencies'},
    kp:  {url:'knowledge-panel.html',    name:'Knowledge Panel',        code:'KP', color:'#4285f4', key:'kp_state_v1',  desc:'Entity signals + KP optimization'},
    press:{url:'press-pitch.html',       name:'Press Pitch Generator',  code:'PR', color:'#db2777', key:'press_state_v1',desc:'AI press releases + journalist pitches'},
    hol: {url:'holidays.html',           name:'Holiday Hours Manager',  code:'HOL',color:'#ea580c', key:'holidays_state_v1',desc:'GBP holiday hours + seasonal campaigns'},

    // Phase 16 additions
    gbpcat:{url:'gbp-categories.html',   name:'GBP Categories',         code:'CAT',color:'#4285f4', key:'gbpcat_state_v1',desc:'200+ category database with primary/secondary picker', isNew:true},
    gbpsv:{url:'gbp-services.html',      name:'GBP Services Manager',   code:'SV', color:'#4285f4', key:'gbpsv_state_v1',desc:'Build the structured Services list for GBP', isNew:true},
    rd:  {url:'redirects.html',          name:'301 Redirect Mapper',    code:'RD', color:'#7c3aed', key:'rd_state_v1',  desc:'Plan, validate, and export server-config for migrations', isNew:true},
    gsc: {url:'gsc-analyzer.html',       name:'GSC Analyzer',           code:'GSC',color:'#16a34a', key:'gsc_state_v1', desc:'Mine GSC exports: striking-distance + low-CTR + local intent', isNew:true},
  };

  /* ---------- CUSTOM TOOLS (user-added) ---------- */
  function getCustomTools(){
    try { return JSON.parse(localStorage.getItem('gn_custom_tools_v1') || '[]'); } catch(e){ return []; }
  }
  function saveCustomTools(list){
    try { localStorage.setItem('gn_custom_tools_v1', JSON.stringify(list)); } catch(e){}
  }
  function getAllTools(){
    const all = Object.assign({}, GN_TOOLS);
    getCustomTools().forEach(t=>{ all[t.id] = t; });
    return all;
  }
  function getAllCats(){
    const cats = JSON.parse(JSON.stringify(GN_CATS));
    // Add a "Custom" category if user has registered tools
    const customs = getCustomTools();
    if(customs.length){
      const byCat = {};
      customs.forEach(t=>{
        const c = t.category || 'custom';
        if(!byCat[c]) byCat[c] = [];
        byCat[c].push(t.id);
        // Also merge into existing cat if matches
        const existing = cats.find(x=>x.id===c);
        if(existing && !existing.tools.includes(t.id)) existing.tools.push(t.id);
      });
      // Custom items not in any existing cat → push to a "Custom" cat
      const uncategorized = customs.filter(t=>!cats.find(c=>c.id===t.category));
      if(uncategorized.length){
        cats.push({id:'custom', name:'Custom Tools', sub:'User-added', color:'#64748b', tools:uncategorized.map(t=>t.id)});
      }
    }
    return cats;
  }

  /* ---------- HAS-DATA CHECK ---------- */
  function toolHasData(tool){
    if(!tool || !tool.key) return false;
    try {
      const d = JSON.parse(localStorage.getItem(tool.key) || 'null');
      if(!d) return false;
      // Heuristic — any reasonable non-empty signal
      if(Array.isArray(d.businesses) && d.businesses.length) return true;
      if(Array.isArray(d.citations) && d.citations.length) return true;
      if(Array.isArray(d.reviews) && d.reviews.length) return true;
      if(Array.isArray(d.posts) && d.posts.length) return true;
      if(Array.isArray(d.keywords) && d.keywords.length) return true;
      if(Array.isArray(d.questions) && d.questions.length) return true;
      if(Array.isArray(d.locations) && d.locations.length) return true;
      if(Array.isArray(d.backlinks) && d.backlinks.length) return true;
      if(Array.isArray(d.variants) && d.variants.length) return true;
      if(Array.isArray(d.imports) && d.imports.length) return true;
      if(d.results && Object.keys(d.results).length) return true;
      if(d.pages && Object.keys(d.pages).length) return true;
      if(d.submissions && Object.keys(d.submissions).length) return true;
      if(d.name || d.url || d.biz?.name || d.brand?.name || d.you?.name || d.inputs?.name || d.inputs?.budget || d.strategy || d.brief) return true;
      if(d.schemas && d.schemas.length) return true;
      if(d.checks && d.checks.length) return true;
      if(d.campaigns && d.campaigns.length) return true;
      if(d.events && d.events.length) return true;
      return false;
    } catch(e){ return false; }
  }

  /* ---------- CURRENT PAGE DETECT ---------- */
  function currentPage(){
    const path = location.pathname.split('/').pop() || 'dashboard.html';
    return path;
  }
  function isActive(toolUrl){
    const p = currentPage();
    if(p === toolUrl) return true;
    if(!p && toolUrl === 'dashboard.html') return true;
    return false;
  }

  /* ---------- STYLES ---------- */
  const STYLE_ID = 'global-nav-styles';
  function injectStyles(){
    if(document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
#gn-bar{height:40px;background:var(--bg2,#fff);border-bottom:1px solid var(--border,#d1d9e8);display:flex;align-items:center;gap:4px;padding:0 12px;flex-shrink:0;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:12.5px;position:relative;z-index:9000;box-shadow:0 1px 2px rgba(15,26,46,.04)}
#gn-bar.gn-hidden{display:none !important}
.gn-home{display:flex;align-items:center;gap:5px;padding:5px 9px;border-radius:6px;color:var(--text,#0f1a2e);font-weight:700;text-decoration:none;font-size:12px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff !important}
.gn-home:hover{filter:brightness(1.1)}
.gn-home svg{width:14px;height:14px}
.gn-sep{width:1px;height:18px;background:var(--border,#d1d9e8);margin:0 4px}
.gn-cat{position:relative}
.gn-cat-btn{padding:6px 10px;border-radius:6px;font-weight:600;color:var(--text2,#5b6b88);background:transparent;border:none;font-size:12px;display:flex;align-items:center;gap:5px;cursor:pointer;white-space:nowrap;font-family:inherit}
.gn-cat-btn:hover{background:var(--bg3,#e9eef7);color:var(--text,#0f1a2e)}
.gn-cat-btn.active{background:rgba(37,99,235,.1);color:#2563eb}
.gn-cat-btn .gn-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.gn-cat-btn .gn-arr{font-size:9px;color:var(--text3,#8a9ab5);margin-left:1px}
.gn-cat.open .gn-cat-btn{background:var(--bg3,#e9eef7);color:var(--text,#0f1a2e)}
.gn-panel{position:absolute;top:calc(100% + 6px);left:0;background:var(--bg2,#fff);border:1px solid var(--border,#d1d9e8);border-radius:10px;box-shadow:0 10px 30px rgba(15,26,46,.14);padding:8px;min-width:340px;max-width:420px;display:none;z-index:9100}
.gn-cat.open .gn-panel{display:block}
.gn-panel-hdr{padding:6px 10px 8px;border-bottom:1px solid var(--border,#d1d9e8);margin-bottom:6px;display:flex;align-items:center;gap:8px}
.gn-panel-hdr .gn-pi{width:24px;height:24px;border-radius:6px;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;font-family:'JetBrains Mono',monospace}
.gn-panel-hdr .gn-pn{font-size:12.5px;font-weight:800;color:var(--text,#0f1a2e);line-height:1.2}
.gn-panel-hdr .gn-ps{font-size:10.5px;color:var(--text3,#8a9ab5);font-family:'JetBrains Mono',monospace;margin-top:1px}
.gn-tools{display:flex;flex-direction:column;gap:1px;max-height:380px;overflow-y:auto}
.gn-tool{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:6px;color:var(--text,#0f1a2e);text-decoration:none;transition:background .12s;position:relative}
.gn-tool:hover{background:var(--bg3,#e9eef7)}
.gn-tool.active{background:rgba(37,99,235,.12);color:#2563eb}
.gn-tool.active::before{content:'';position:absolute;left:0;top:6px;bottom:6px;width:3px;background:#2563eb;border-radius:0 3px 3px 0}
.gn-tool .gn-tcode{width:22px;height:22px;border-radius:5px;color:#fff;display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:800;font-family:'JetBrains Mono',monospace;flex-shrink:0}
.gn-tool .gn-tinfo{flex:1;min-width:0}
.gn-tool .gn-tname{font-size:11.5px;font-weight:700;line-height:1.2;display:flex;align-items:center;gap:5px}
.gn-tool .gn-tdesc{font-size:10px;color:var(--text2,#5b6b88);font-family:'JetBrains Mono',monospace;margin-top:1px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gn-tool .gn-new{font-size:8px;font-family:'JetBrains Mono',monospace;font-weight:800;color:#fff;background:#7c3aed;padding:1px 3px;border-radius:3px;letter-spacing:.3px}
.gn-tool .gn-status{width:7px;height:7px;border-radius:50%;background:var(--border2,#c2cde0);flex-shrink:0}
.gn-tool .gn-status.live{background:#16a34a;box-shadow:0 0 0 2px rgba(22,163,74,.18)}
.gn-spacer{flex:1}
.gn-search-box{position:relative;width:200px}
.gn-search-box input{width:100%;background:var(--bg3,#e9eef7);border:1px solid var(--border,#d1d9e8);border-radius:7px;padding:5px 8px 5px 28px;font-size:11.5px;color:var(--text,#0f1a2e);font-family:inherit;outline:none}
.gn-search-box input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.1)}
.gn-search-box svg{position:absolute;left:8px;top:50%;transform:translateY(-50%);width:12px;height:12px;color:var(--text3,#8a9ab5)}
.gn-search-results{position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--bg2,#fff);border:1px solid var(--border,#d1d9e8);border-radius:8px;box-shadow:0 10px 30px rgba(15,26,46,.14);padding:6px;max-height:380px;overflow-y:auto;display:none;z-index:9200}
.gn-search-results.show{display:block}
.gn-sr-empty{padding:20px;text-align:center;color:var(--text3,#8a9ab5);font-size:11.5px}
.gn-icon-btn{padding:5px 8px;border-radius:6px;background:transparent;border:none;color:var(--text2,#5b6b88);font-size:14px;display:flex;align-items:center;gap:4px;cursor:pointer;font-family:inherit}
.gn-icon-btn:hover{background:var(--bg3,#e9eef7);color:var(--text,#0f1a2e)}
.gn-icon-btn svg{width:14px;height:14px}
.gn-icon-btn .gn-lbl{font-size:11px;font-weight:700;display:inline}
.gn-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center;z-index:9500;padding:14px}
.gn-overlay.show{display:flex}
.gn-modal{background:var(--bg2,#fff);border:1px solid var(--border,#d1d9e8);border-radius:14px;max-width:480px;width:100%;max-height:88vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,.4)}
.gn-modal h3{padding:14px 18px;border-bottom:1px solid var(--border,#d1d9e8);font-size:13px;font-weight:800;color:var(--text,#0f1a2e);display:flex;align-items:center;gap:10px;background:var(--bg3,#e9eef7)}
.gn-modal h3 .gn-x{margin-left:auto;background:var(--bg2,#fff);border:1px solid var(--border,#d1d9e8);border-radius:6px;padding:5px 9px;font-size:12px;cursor:pointer;color:var(--text,#0f1a2e);font-weight:700}
.gn-mbody{padding:14px 18px;overflow-y:auto;display:flex;flex-direction:column;gap:10px}
.gn-mfoot{padding:12px 18px;border-top:1px solid var(--border,#d1d9e8);display:flex;gap:8px;justify-content:flex-end}
.gn-mf{display:flex;flex-direction:column;gap:3px}
.gn-mf label{font-size:10px;font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--text2,#5b6b88);text-transform:uppercase;letter-spacing:.5px}
.gn-mf input,.gn-mf select,.gn-mf textarea{background:var(--bg,#f3f6fb);border:1px solid var(--border,#d1d9e8);border-radius:6px;padding:7px 9px;font-size:11.5px;color:var(--text,#0f1a2e);font-family:'JetBrains Mono',monospace;outline:none}
.gn-mf input:focus,.gn-mf select:focus,.gn-mf textarea:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.1)}
.gn-mbtn{padding:7px 13px;border-radius:6px;font-size:11.5px;font-weight:700;cursor:pointer;border:1px solid var(--border,#d1d9e8);background:var(--bg3,#e9eef7);color:var(--text,#0f1a2e);font-family:inherit}
.gn-mbtn.primary{background:#2563eb;color:#fff;border-color:#2563eb}
.gn-mbtn:hover{transform:translateY(-1px)}
.gn-ctrow{display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg,#f3f6fb);border-radius:6px;border:1px solid var(--border,#d1d9e8)}
.gn-ctrow .gn-tcode{width:22px;height:22px;border-radius:5px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800;font-family:'JetBrains Mono',monospace}
.gn-ctrow .gn-cti{flex:1;min-width:0}
.gn-ctrow .gn-ctn{font-size:11.5px;font-weight:700;color:var(--text,#0f1a2e)}
.gn-ctrow .gn-ctu{font-size:10px;color:var(--text3,#8a9ab5);font-family:'JetBrains Mono',monospace}
.gn-ctrow button{background:none;border:none;color:var(--text3,#8a9ab5);font-size:14px;cursor:pointer;padding:3px 6px;font-weight:700}
.gn-ctrow button:hover{color:#dc2626}
.gn-toast{position:fixed;bottom:50px;left:50%;transform:translateX(-50%) translateY(80px);background:var(--bg2,#fff);border:1px solid #16a34a;color:#16a34a;padding:8px 14px;border-radius:8px;font-size:11.5px;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,.4);z-index:9999;opacity:0;transition:transform .3s,opacity .3s;font-family:'Inter',sans-serif}
.gn-toast.show{transform:translateX(-50%) translateY(0);opacity:1}
@media (max-width:980px){
  #gn-bar{overflow-x:auto;padding:0 6px}
  #gn-bar::-webkit-scrollbar{display:none}
  .gn-search-box{width:140px}
  .gn-icon-btn .gn-lbl{display:none}
  .gn-home span{display:none}
}
@media (max-width:680px){
  .gn-cat-btn{padding:5px 7px;font-size:11px}
  .gn-panel{min-width:280px;left:auto;right:0}
}
/* ---- breadcrumb (current tool) ---- */
.gn-crumb{display:flex;align-items:center;gap:6px;padding:4px 9px;border-radius:6px;background:var(--bg3,#e9eef7);font-size:11.5px;font-weight:700;color:var(--text,#0f1a2e);white-space:nowrap;max-width:230px;overflow:hidden;text-overflow:ellipsis}
.gn-crumb .gn-cb{width:16px;height:16px;border-radius:4px;color:#fff;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;font-family:'JetBrains Mono',monospace;flex-shrink:0}
@media (max-width:980px){ .gn-crumb{display:none} }
/* ---- menu (hamburger) button ---- */
.gn-menu-btn{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:6px;background:transparent;border:none;color:var(--text2,#5b6b88);cursor:pointer;flex-shrink:0}
.gn-menu-btn:hover{background:var(--bg3,#e9eef7);color:var(--text,#0f1a2e)}
.gn-menu-btn svg{width:16px;height:16px}
/* ---- sidebar drawer ---- */
.gn-drawer-ov{position:fixed;inset:0;background:rgba(8,14,28,.5);backdrop-filter:blur(3px);z-index:9400;opacity:0;visibility:hidden;transition:opacity .22s,visibility .22s}
.gn-drawer-ov.open{opacity:1;visibility:visible}
.gn-drawer{position:fixed;top:0;left:0;bottom:0;width:320px;max-width:86vw;background:var(--bg2,#fff);border-right:1px solid var(--border,#d1d9e8);box-shadow:6px 0 40px rgba(8,14,28,.28);z-index:9450;display:flex;flex-direction:column;transform:translateX(-104%);transition:transform .26s cubic-bezier(.4,0,.2,1);font-family:'Inter',system-ui,sans-serif}
.gn-drawer.open{transform:translateX(0)}
.gn-dr-hdr{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border,#d1d9e8);flex-shrink:0}
.gn-dr-logo{width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,#2563eb,#7c3aed);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.gn-dr-logo svg{width:18px;height:18px;color:#fff}
.gn-dr-ttl{font-size:14px;font-weight:800;color:var(--text,#0f1a2e);line-height:1.1}
.gn-dr-sub{font-size:9.5px;font-family:'JetBrains Mono',monospace;color:var(--text3,#8a9ab5);font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:2px}
.gn-dr-x{margin-left:auto;background:var(--bg3,#e9eef7);border:none;border-radius:6px;width:28px;height:28px;font-size:14px;color:var(--text,#0f1a2e);cursor:pointer;font-weight:700;display:flex;align-items:center;justify-content:center}
.gn-dr-x:hover{background:var(--bg4,#dde4f0)}
.gn-dr-search{padding:10px 14px;border-bottom:1px solid var(--border,#d1d9e8);position:relative;flex-shrink:0}
.gn-dr-search input{width:100%;background:var(--bg,#f3f6fb);border:1px solid var(--border,#d1d9e8);border-radius:7px;padding:8px 10px 8px 30px;font-size:12px;color:var(--text,#0f1a2e);font-family:inherit;outline:none}
.gn-dr-search input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.1)}
.gn-dr-search svg{position:absolute;left:22px;top:50%;transform:translateY(-50%);width:13px;height:13px;color:var(--text3,#8a9ab5)}
.gn-dr-body{flex:1;overflow-y:auto;padding:8px 8px 16px}
.gn-dr-cat{margin-bottom:4px}
.gn-dr-ch{display:flex;align-items:center;gap:7px;padding:9px 10px 5px;font-size:9.5px;font-family:'JetBrains Mono',monospace;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--text3,#8a9ab5)}
.gn-dr-ch .gn-dc{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.gn-dr-ch .gn-dn{margin-left:auto;background:var(--bg3,#e9eef7);color:var(--text3,#8a9ab5);font-size:9px;padding:1px 6px;border-radius:8px}
.gn-dr-item{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:7px;text-decoration:none;color:var(--text2,#5b6b88);transition:background .12s;position:relative}
.gn-dr-item:hover{background:var(--bg3,#e9eef7);color:var(--text,#0f1a2e)}
.gn-dr-item.active{background:rgba(37,99,235,.12);color:#2563eb;font-weight:700}
.gn-dr-item.active::before{content:'';position:absolute;left:0;top:7px;bottom:7px;width:3px;background:#2563eb;border-radius:0 3px 3px 0}
.gn-dr-item .gn-di{width:22px;height:22px;border-radius:6px;color:#fff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;font-family:'JetBrains Mono',monospace;flex-shrink:0}
.gn-dr-item .gn-dnm{flex:1;min-width:0;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gn-dr-item .gn-dst{width:7px;height:7px;border-radius:50%;background:var(--border2,#c2cde0);flex-shrink:0}
.gn-dr-item .gn-dst.live{background:#16a34a;box-shadow:0 0 0 2px rgba(22,163,74,.18)}
/* ---- global footer ---- */
#gn-foot{flex-shrink:0;background:var(--bg2,#fff);border-top:1px solid var(--border,#d1d9e8);font-family:'Inter',system-ui,sans-serif;font-size:11.5px;color:var(--text2,#5b6b88);z-index:8000}
#gn-foot.gn-hidden{display:none !important}
.gn-foot-in{display:flex;align-items:center;gap:14px;padding:9px 16px;flex-wrap:wrap}
.gn-foot-brand{display:flex;align-items:center;gap:8px;font-weight:700;color:var(--text,#0f1a2e)}
.gn-foot-brand .gn-fl{width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,#2563eb,#7c3aed);display:flex;align-items:center;justify-content:center}
.gn-foot-brand .gn-fl svg{width:13px;height:13px;color:#fff}
.gn-foot-links{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.gn-foot-links a{padding:4px 9px;border-radius:6px;color:var(--text2,#5b6b88);text-decoration:none;font-weight:600;font-size:11.5px}
.gn-foot-links a:hover{background:var(--bg3,#e9eef7);color:var(--text,#0f1a2e)}
.gn-foot-sp{flex:1;min-width:10px}
.gn-foot-meta{font-size:10.5px;font-family:'JetBrains Mono',monospace;color:var(--text3,#8a9ab5)}
.gn-foot-meta a{color:#2563eb;text-decoration:none}
.gn-foot-theme{display:flex;align-items:center;gap:5px;padding:5px 10px;border:1px solid var(--border,#d1d9e8);border-radius:20px;background:var(--bg3,#e9eef7);color:var(--text2,#5b6b88);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit}
.gn-foot-theme:hover{color:var(--text,#0f1a2e);border-color:#2563eb}
.gn-foot-theme svg{width:13px;height:13px}
@media (max-width:680px){ .gn-foot-in{padding:9px 10px;gap:8px} .gn-foot-meta{display:none} }
`;
    document.head.appendChild(s);
  }

  /* ---------- BUILD MENU ---------- */
  function buildBar(){
    const bar = document.createElement('div');
    bar.id = 'gn-bar';
    if(localStorage.getItem('gn_hidden')==='1') bar.classList.add('gn-hidden');
    const here = currentPage();
    const cur = Object.values(getAllTools()).find(t=>t.url===here);
    const crumb = (cur && cur.url!=='dashboard.html')
      ? `<span class="gn-crumb" title="${escapeAttr(cur.desc||cur.name)}"><span class="gn-cb" style="background:${cur.color||'#64748b'}">${escapeHtml(cur.code||'?')}</span>${escapeHtml(cur.name)}</span>`
      : '';
    bar.innerHTML = `
      <button class="gn-menu-btn" id="gn-menu-btn" title="Browse all tools (drawer)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <a class="gn-home" href="dashboard.html" title="Command Center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
        <span>SEO Hub</span>
      </a>
      ${crumb}
      <span class="gn-sep"></span>
      <div id="gn-cats"></div>
      <span class="gn-sep"></span>
      <a class="gn-icon-btn" href="guide.html" title="Guides &amp; How-To for every tool">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        <span class="gn-lbl">Guides</span>
      </a>
      <a class="gn-icon-btn" href="ai-assistant.html" title="AI Assistant">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        <span class="gn-lbl">AI</span>
      </a>
      <div class="gn-spacer"></div>
      <div class="gn-search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="gn-search-inp" placeholder="Search tools…" autocomplete="off">
        <div class="gn-search-results" id="gn-search-results"></div>
      </div>
      <button class="gn-icon-btn" id="gn-theme-btn" title="Toggle light / dark (global)">
        <span data-gn-theme-icon></span>
        <span class="gn-lbl gn-theme-lbl">Light</span>
      </button>
      <button class="gn-icon-btn" id="gn-add-btn" title="Register a new tool">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span class="gn-lbl">Add</span>
      </button>
      <button class="gn-icon-btn" id="gn-hide-btn" title="Hide chrome (Alt+M to show again)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    return bar;
  }

  function buildCats(bar){
    const cats = getAllCats();
    const wrap = bar.querySelector('#gn-cats');
    wrap.style.display = 'flex';
    wrap.style.gap = '2px';
    const here = currentPage();
    wrap.innerHTML = cats.map(cat=>{
      const tools = cat.tools.map(id=>getAllTools()[id]).filter(Boolean);
      const activeHere = tools.some(t=>t.url===here);
      return `<div class="gn-cat" data-cat="${cat.id}">
        <button class="gn-cat-btn ${activeHere?'active':''}" type="button">
          <span class="gn-dot" style="background:${cat.color}"></span>
          <span>${escapeHtml(cat.name)}</span>
          <span class="gn-arr">▼</span>
        </button>
        <div class="gn-panel">
          <div class="gn-panel-hdr">
            <div class="gn-pi" style="background:${cat.color}">${cat.name.charAt(0)}</div>
            <div><div class="gn-pn">${escapeHtml(cat.name)}</div><div class="gn-ps">${escapeHtml(cat.sub||'')} · ${tools.length} tools</div></div>
          </div>
          <div class="gn-tools">${tools.map(t=>renderToolRow(t, here)).join('')}</div>
        </div>
      </div>`;
    }).join('');
  }

  function renderToolRow(t, here){
    const hasData = toolHasData(t);
    const active = t.url === here;
    return `<a class="gn-tool ${active?'active':''}" href="${t.url}" title="${escapeAttr(t.desc||'')}">
      <span class="gn-tcode" style="background:${t.color||'#64748b'}">${escapeHtml(t.code||'?')}</span>
      <span class="gn-tinfo"><span class="gn-tname">${escapeHtml(t.name)}${t.isNew?'<span class="gn-new">NEW</span>':''}</span><span class="gn-tdesc">${escapeHtml(t.desc||'')}</span></span>
      <span class="gn-status ${hasData?'live':''}" title="${hasData?'Has data':'No data'}"></span>
    </a>`;
  }

  function escapeHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
  function escapeAttr(s){return escapeHtml(s)}

  /* ---------- INTERACTIONS ---------- */
  function attachInteractions(bar){
    // Category dropdowns
    bar.addEventListener('click', e=>{
      const btn = e.target.closest('.gn-cat-btn');
      if(btn){
        const cat = btn.closest('.gn-cat');
        const wasOpen = cat.classList.contains('open');
        bar.querySelectorAll('.gn-cat.open').forEach(c=>c.classList.remove('open'));
        if(!wasOpen) cat.classList.add('open');
        e.stopPropagation();
        return;
      }
    });
    // Close on outside click
    document.addEventListener('click', e=>{
      if(!e.target.closest('#gn-bar .gn-cat')){
        bar.querySelectorAll('.gn-cat.open').forEach(c=>c.classList.remove('open'));
      }
      if(!e.target.closest('#gn-bar .gn-search-box')){
        document.getElementById('gn-search-results')?.classList.remove('show');
      }
    });
    // Search
    const sinp = bar.querySelector('#gn-search-inp');
    const sres = bar.querySelector('#gn-search-results');
    sinp.addEventListener('input', e=>{
      const q = e.target.value.toLowerCase().trim();
      if(!q){ sres.classList.remove('show'); return; }
      const all = getAllTools();
      const matches = Object.values(all).filter(t=>(t.name+' '+(t.desc||'')+' '+(t.code||'')).toLowerCase().includes(q)).slice(0,12);
      if(matches.length){
        sres.innerHTML = matches.map(t=>renderToolRow(t, currentPage())).join('');
        sres.classList.add('show');
      } else {
        sres.innerHTML = `<div class="gn-sr-empty">No tools match "${escapeHtml(e.target.value)}"</div>`;
        sres.classList.add('show');
      }
    });
    sinp.addEventListener('focus', ()=>{ if(sinp.value) sres.classList.add('show'); });
    sinp.addEventListener('keydown', e=>{
      if(e.key==='Enter'){
        const first = sres.querySelector('.gn-tool');
        if(first){ location.href = first.getAttribute('href'); }
      } else if(e.key==='Escape'){
        sres.classList.remove('show'); sinp.value=''; sinp.blur();
      }
    });
    // Menu (drawer)
    bar.querySelector('#gn-menu-btn').addEventListener('click', openDrawer);
    // Global theme toggle
    bar.querySelector('#gn-theme-btn').addEventListener('click', gnToggleTheme);
    // Add tool
    bar.querySelector('#gn-add-btn').addEventListener('click', openAddTool);
    // Hide chrome (bar + footer)
    bar.querySelector('#gn-hide-btn').addEventListener('click', ()=>{
      setChromeHidden(true);
      gnToast('Chrome hidden — press Alt+M to show');
    });
    // Alt+M hotkey + Esc closes drawer
    document.addEventListener('keydown', e=>{
      if(e.altKey && (e.key==='m' || e.key==='M')){
        e.preventDefault();
        setChromeHidden(!bar.classList.contains('gn-hidden'));
      }
      if((e.ctrlKey || e.metaKey) && e.key==='k'){
        e.preventDefault();
        sinp.focus(); sinp.select();
      }
      if(e.key==='Escape') closeDrawer();
    });
  }

  function setChromeHidden(hidden){
    if(_bar) _bar.classList.toggle('gn-hidden', hidden);
    if(_foot) _foot.classList.toggle('gn-hidden', hidden);
    try { localStorage.setItem('gn_hidden', hidden?'1':'0'); } catch(e){}
  }

  /* ---------- ADD TOOL MODAL ---------- */
  function openAddTool(){
    const overlay = document.createElement('div');
    overlay.className = 'gn-overlay show';
    const customs = getCustomTools();
    overlay.innerHTML = `
      <div class="gn-modal">
        <h3>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:18px;height:18px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Custom Tool
          <button class="gn-x" id="gn-close-add">✕</button>
        </h3>
        <div class="gn-mbody">
          <div style="font-size:11.5px;color:var(--text2,#5b6b88);line-height:1.55;background:var(--bg3,#e9eef7);padding:10px 12px;border-radius:7px">Register a custom tool (your own HTML file or external link) to the menu. Future tools shipped in this suite are added automatically — use this for your <em>personal</em> additions.</div>
          <div class="gn-mf"><label>Tool name *</label><input id="gn-add-name" placeholder="e.g. Internal Link Auditor"></div>
          <div class="gn-mf"><label>URL / file path *</label><input id="gn-add-url" placeholder="e.g. my-tool.html or https://..."></div>
          <div class="gn-mf"><label>Short code (2-3 letters)</label><input id="gn-add-code" placeholder="ILA" maxlength="4"></div>
          <div class="gn-mf"><label>Description</label><input id="gn-add-desc" placeholder="One-line description"></div>
          <div class="gn-mf"><label>Category</label><select id="gn-add-cat">
            ${GN_CATS.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
            <option value="custom">Custom Tools</option>
          </select></div>
          <div class="gn-mf"><label>Color (hex)</label><input id="gn-add-color" placeholder="#2563eb" value="#64748b"></div>
          ${customs.length?`<div style="margin-top:14px"><div style="font-size:10.5px;font-weight:800;color:var(--text2,#5b6b88);text-transform:uppercase;font-family:'JetBrains Mono',monospace;letter-spacing:.5px;margin-bottom:7px">Your Custom Tools (${customs.length})</div><div style="display:flex;flex-direction:column;gap:5px">${customs.map(t=>`<div class="gn-ctrow"><span class="gn-tcode" style="background:${t.color||'#64748b'}">${escapeHtml(t.code||'?')}</span><div class="gn-cti"><div class="gn-ctn">${escapeHtml(t.name)}</div><div class="gn-ctu">${escapeHtml(t.url)}</div></div><button data-rm="${escapeAttr(t.id)}" title="Remove">✕</button></div>`).join('')}</div></div>`:''}
        </div>
        <div class="gn-mfoot">
          <button class="gn-mbtn" id="gn-cancel-add">Cancel</button>
          <button class="gn-mbtn primary" id="gn-save-add">Save Tool</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = ()=>overlay.remove();
    overlay.querySelector('#gn-close-add').onclick = close;
    overlay.querySelector('#gn-cancel-add').onclick = close;
    overlay.addEventListener('click', e=>{ if(e.target===overlay) close(); });
    overlay.querySelectorAll('[data-rm]').forEach(b=>{
      b.onclick = ()=>{
        const id = b.getAttribute('data-rm');
        const updated = getCustomTools().filter(t=>t.id!==id);
        saveCustomTools(updated);
        refresh();
        close(); openAddTool();
        gnToast('Removed');
      };
    });
    overlay.querySelector('#gn-save-add').onclick = ()=>{
      const name = overlay.querySelector('#gn-add-name').value.trim();
      const url = overlay.querySelector('#gn-add-url').value.trim();
      if(!name || !url){ gnToast('Name and URL required'); return; }
      const id = 'custom_' + (name.toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,20)) + '_' + Math.random().toString(36).slice(2,6);
      const tool = {
        id,
        name,
        url,
        code: overlay.querySelector('#gn-add-code').value.trim().toUpperCase() || name.substring(0,3).toUpperCase(),
        desc: overlay.querySelector('#gn-add-desc').value.trim(),
        category: overlay.querySelector('#gn-add-cat').value,
        color: overlay.querySelector('#gn-add-color').value.trim() || '#64748b',
        key: null,
        custom: true,
      };
      const list = getCustomTools();
      list.push(tool);
      saveCustomTools(list);
      refresh();
      close();
      gnToast(`Added "${name}"`);
    };
  }

  /* ---------- TOAST ---------- */
  function gnToast(msg){
    const t = document.createElement('div');
    t.className = 'gn-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(()=>t.classList.add('show'), 10);
    setTimeout(()=>{t.classList.remove('show'); setTimeout(()=>t.remove(),300);}, 2500);
  }

  /* ---------- SIDEBAR DRAWER (off-canvas launcher) ---------- */
  let _drawer = null, _drawerOv = null;
  function buildDrawer(){
    const ov = document.createElement('div');
    ov.className = 'gn-drawer-ov';
    ov.id = 'gn-drawer-ov';
    const dr = document.createElement('aside');
    dr.className = 'gn-drawer';
    dr.id = 'gn-drawer';
    dr.innerHTML = `
      <div class="gn-dr-hdr">
        <div class="gn-dr-logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg></div>
        <div><div class="gn-dr-ttl">SEO Hub</div><div class="gn-dr-sub">Local SEO Tools</div></div>
        <button class="gn-dr-x" id="gn-dr-close" title="Close">✕</button>
      </div>
      <div class="gn-dr-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="gn-dr-search-inp" placeholder="Search all tools…" autocomplete="off">
      </div>
      <div class="gn-dr-body" id="gn-dr-body"></div>
    `;
    document.body.appendChild(ov);
    document.body.appendChild(dr);
    renderDrawer('');
    // interactions
    ov.addEventListener('click', closeDrawer);
    dr.querySelector('#gn-dr-close').addEventListener('click', closeDrawer);
    const di = dr.querySelector('#gn-dr-search-inp');
    di.addEventListener('input', e=> renderDrawer(e.target.value.toLowerCase().trim()));
    _drawer = dr; _drawerOv = ov;
  }
  function renderDrawer(q){
    const body = document.getElementById('gn-dr-body'); if(!body) return;
    const here = currentPage();
    const allTools = getAllTools();
    const cats = getAllCats();
    const quick = ['dashboard','tools','guide'].map(id=>allTools[id]).filter(Boolean);
    let html = '';
    // quick links row
    if(!q){
      html += `<div class="gn-dr-cat"><div class="gn-dr-ch"><span class="gn-dc" style="background:#2563eb"></span>Hub</div>`;
      quick.forEach(t=> html += drawerItem(t, here));
      html += `</div>`;
    }
    cats.forEach(cat=>{
      let tools = cat.tools.map(id=>allTools[id]).filter(Boolean);
      if(q) tools = tools.filter(t=>(t.name+' '+(t.desc||'')+' '+(t.code||'')).toLowerCase().includes(q));
      if(!tools.length) return;
      html += `<div class="gn-dr-cat"><div class="gn-dr-ch"><span class="gn-dc" style="background:${cat.color}"></span>${escapeHtml(cat.name)}<span class="gn-dn">${tools.length}</span></div>`;
      tools.forEach(t=> html += drawerItem(t, here));
      html += `</div>`;
    });
    body.innerHTML = html || `<div style="padding:24px;text-align:center;color:var(--text3,#8a9ab5);font-size:12px">No tools match “${escapeHtml(q)}”</div>`;
  }
  function drawerItem(t, here){
    const active = t.url===here, live = toolHasData(t);
    return `<a class="gn-dr-item ${active?'active':''}" href="${t.url}" title="${escapeAttr(t.desc||'')}">
      <span class="gn-di" style="background:${t.color||'#64748b'}">${escapeHtml(t.code||'?')}</span>
      <span class="gn-dnm">${escapeHtml(t.name)}</span>
      <span class="gn-dst ${live?'live':''}"></span>
    </a>`;
  }
  function openDrawer(){ if(!_drawer) buildDrawer(); requestAnimationFrame(()=>{ _drawerOv.classList.add('open'); _drawer.classList.add('open'); document.getElementById('gn-dr-search-inp')?.focus(); }); }
  function closeDrawer(){ if(_drawer){ _drawer.classList.remove('open'); _drawerOv.classList.remove('open'); } }

  /* ---------- GLOBAL FOOTER ---------- */
  let _foot = null;
  function buildFooter(){
    const f = document.createElement('footer');
    f.id = 'gn-foot';
    if(localStorage.getItem('gn_hidden')==='1') f.classList.add('gn-hidden');
    const n = Object.keys(GN_TOOLS).filter(k=>!['dashboard','tools','guide'].includes(k)).length;
    f.innerHTML = `
      <div class="gn-foot-in">
        <span class="gn-foot-brand"><span class="gn-fl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg></span>SEO Hub</span>
        <span class="gn-foot-links">
          <a href="dashboard.html">Dashboard</a>
          <a href="tools.html">All Tools</a>
          <a href="guide.html">Guides</a>
          <a href="ai-assistant.html">AI Assistant</a>
          <a href="glossary.html">Glossary</a>
        </span>
        <span class="gn-foot-sp"></span>
        <span class="gn-foot-meta">${n} tools · Local SEO Suite · <a href="mailto:techie1418@gmail.com">Mukesh&nbsp;Kr</a></span>
        <button class="gn-foot-theme" id="gn-foot-theme" title="Toggle light / dark (global)"><span data-gn-theme-icon></span><span class="gn-theme-lbl">Light</span></button>
      </div>
    `;
    document.body.appendChild(f);
    f.querySelector('#gn-foot-theme').addEventListener('click', gnToggleTheme);
    _foot = f;
  }

  /* ---------- MAIN INJECT ---------- */
  let _bar = null;
  function inject(){
    if(_bar && document.body.contains(_bar)) return;
    injectStyles();
    _bar = buildBar();
    buildCats(_bar);
    attachInteractions(_bar);
    // Insert at very top of body
    if(document.body.firstChild){
      document.body.insertBefore(_bar, document.body.firstChild);
    } else {
      document.body.appendChild(_bar);
    }
    buildFooter();
    gnSyncThemeUI();
  }

  function refresh(){
    if(!_bar) return;
    buildCats(_bar);
    if(_drawer) renderDrawer(document.getElementById('gn-dr-search-inp')?.value.toLowerCase().trim()||'');
  }

  /* ---------- PUBLIC API ---------- */
  window.GlobalNav = {
    registerTool: function(tool){
      if(!tool || !tool.name || !tool.url){ throw new Error('GlobalNav.registerTool requires {name, url}'); }
      const list = getCustomTools();
      const id = tool.id || ('custom_' + tool.name.toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,20));
      const idx = list.findIndex(t=>t.id===id);
      const entry = Object.assign({id, code:'?', color:'#64748b', category:'custom', key:null, custom:true}, tool);
      if(idx>=0) list[idx] = entry; else list.push(entry);
      saveCustomTools(list);
      refresh();
      return entry;
    },
    unregisterTool: function(id){
      saveCustomTools(getCustomTools().filter(t=>t.id!==id));
      refresh();
    },
    listTools: function(){ return getAllTools(); },
    listCategories: function(){ return getAllCats(); },
    refresh,
    show: function(){ setChromeHidden(false); },
    hide: function(){ setChromeHidden(true); },
    toggle: function(){ setChromeHidden(!(_bar && _bar.classList.contains('gn-hidden'))); },
    openDrawer, closeDrawer,
    setTheme: function(v){ gnApplyTheme(v); gnStoreTheme(v); gnSyncThemeUI(); },
    toggleTheme: gnToggleTheme,
  };

  /* ---------- AUTO INIT ---------- */
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
