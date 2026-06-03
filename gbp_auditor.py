#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GBP / Local SEO DEEP Auto-Auditor  —  local engine for the Local SEO Tools suite.

Free. No API key required for the core audit. Pure Python standard library.
Goes deep: crawls the client website + key pages, parses schema, auto-checks NAP
across the directories the business is actually listed on, discovers business
listings via search, checks local keyword visibility, reads the real Google
Business Profile panel (categories/rating/reviews/hours) when a headless browser
is available, and auto-fills the full audit checklist with evidence.

LAYERS (each degrades gracefully if blocked):
  1. Website deep crawl + schema  (reliable backbone, not rate-limited)
  2. Google PageSpeed Insights     (free, no key) -> mobile/perf/CWV
  3. Search discovery (Bing)        -> business listings / citations + rating
  4. NAP system                     -> fetch listing pages, compare NAP
  5. Keyword visibility             -> category+city / "near me"
  6. GBP panel (deep)               -> Playwright headless (GMB-Everywhere style)
     or Google Places API (--places-key) for exact fields.

USAGE
  Report:  python gbp_auditor.py --name "Acme Tire" --url acme.com --city Boston
  Deep:    python gbp_auditor.py --name "..." --url ... --city ... --deep
           (--deep reads the live GBP panel; auto-installs Playwright once)
  Server:  python gbp_auditor.py --serve         (gbp-audit.html auto-detects it)
  Places:  ... --places-key YOUR_GOOGLE_PLACES_KEY   (most accurate GBP fields)

Author:
"""
import argparse, json, re, ssl, sys, time, subprocess, urllib.request, urllib.parse, html as _html
from datetime import datetime, timezone

for _s in ("stdout", "stderr"):
    try: getattr(sys, _s).reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/121.0 Safari/537.36")
_CTX = ssl.create_default_context(); _CTX.check_hostname = False; _CTX.verify_mode = ssl.CERT_NONE
VERBOSE = True
def log(msg):
    if VERBOSE:
        print("  " + msg, file=sys.stderr, flush=True)

DIRECTORIES = [
    ("Google Business Profile","google.com/maps"),("Yelp","yelp.com"),("Facebook","facebook.com"),
    ("Apple Maps","maps.apple.com"),("Bing Places","bing.com/maps"),("Better Business Bureau","bbb.org"),
    ("YellowPages","yellowpages.com"),("MapQuest","mapquest.com"),("Foursquare","foursquare.com"),
    ("Nextdoor","nextdoor.com"),("Tripadvisor","tripadvisor.com"),("Angi","angi.com"),
    ("Thumbtack","thumbtack.com"),("Houzz","houzz.com"),("Healthgrades","healthgrades.com"),
    ("Avvo","avvo.com"),("Chamber of Commerce","chamberofcommerce.com"),("Manta","manta.com"),
    ("Hotfrog","hotfrog.com"),("Cylex","cylex"),("Yellowbook","yellowbook"),("Superpages","superpages.com"),
]
CORE_DIRS = ["Yelp","Facebook","Apple Maps","Bing Places","Better Business Bureau","YellowPages"]

# ---------------------------------------------------------------- net helpers
def http_get(url, timeout=20, headers=None):
    h = {"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9",
         "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
         "Cookie": "CONSENT=YES+1"}
    if headers: h.update(headers)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=timeout, context=_CTX) as r:
        raw = r.read(); enc = r.headers.get_content_charset() or "utf-8"
        return {"status": r.status, "final_url": r.geturl(),
                "text": raw.decode(enc, "ignore"), "headers": dict(r.headers)}

def get_json(url, timeout=40, headers=None):
    return json.loads(http_get(url, timeout, headers)["text"])

def norm_url(u):
    u = (u or "").strip()
    if not u: return ""
    if not re.match(r"^https?://", u, re.I): u = "https://" + u
    return u

def digits(s): return re.sub(r"[^0-9]", "", s or "")
def base_of(u):
    p = urllib.parse.urlparse(norm_url(u)); return f"{p.scheme}://{p.netloc}"
def domain_of(u):
    try: return urllib.parse.urlparse(norm_url(u)).netloc.lower().replace("www.", "")
    except Exception: return ""
def strip_tags(h):
    h = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", h)
    return re.sub(r"\s+", " ", _html.unescape(re.sub(r"(?s)<[^>]+>", " ", h))).strip()
def norm_name(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", (s or "").lower())).strip()
PHONE_RE = re.compile(r"(\+?\d[\d\s().\-]{7,}\d)")
def find_phones(text):
    out = []
    for m in PHONE_RE.findall(text or ""):
        d = digits(m)
        if len(d) == 11 and d[0] == "1": d = d[1:]   # strip US country code
        if len(d) == 10: out.append(d)               # normalize to 10-digit, drop noisy runs
    return list(dict.fromkeys(out))

# ---------------------------------------------------------- 1) website crawl
SUBPAGES = ["contact", "contact-us", "about", "about-us", "locations", "location", "services", "service-areas"]
def fetch_page(url, timeout=18):
    try: return http_get(url, timeout)
    except Exception:
        try: return http_get(re.sub(r"^https", "http", url), timeout)
        except Exception: return None

def parse_schema(html):
    types, local = [], None
    for block in re.findall(r'(?is)<script[^>]+application/ld\+json[^>]*>(.*?)</script>', html):
        try: data = json.loads(block.strip())
        except Exception:
            try: data = json.loads(re.sub(r",\s*([}\]])", r"\1", block.strip()))
            except Exception: continue
        nodes = data.get("@graph") if isinstance(data, dict) and "@graph" in data else data
        nodes = nodes if isinstance(nodes, list) else [nodes]
        for n in nodes:
            if not isinstance(n, dict): continue
            t = n.get("@type"); ts = t if isinstance(t, list) else [t]
            for x in ts:
                if x: types.append(str(x))
            if any(re.search(r"LocalBusiness|Restaurant|Store|Dentist|Attorney|Physician|Lawyer|"
                             r"HomeAndConstruction|ProfessionalService|AutoRepair|MedicalBusiness|Organization",
                             str(x), re.I) for x in ts):
                local = local or n
    return sorted(set(types)), local

def analyze_site(raw_url, biz):
    url = norm_url(raw_url)
    ev = {"input_url": url, "reached": False, "https": url.lower().startswith("https"),
          "pages_crawled": [], "schema_types": [], "local_schema": None, "checks": {}}
    if not url:
        ev["error"] = "no url"; return ev
    log(f"[site] fetching homepage {url}")
    res = fetch_page(url)
    if not res:
        ev["error"] = "homepage unreachable"; return ev
    html = res["text"]; ev["reached"] = True; ev["final_url"] = res["final_url"]
    ev["https"] = res["final_url"].lower().startswith("https"); ev["status"] = res["status"]
    ev["pages_crawled"].append(res["final_url"])
    low = html.lower(); text = strip_tags(html); ltext = text.lower()

    m = re.search(r"(?is)<title[^>]*>(.*?)</title>", html); ev["title"] = _html.unescape(m.group(1)).strip() if m else ""
    m = re.search(r'(?is)<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']', html)
    ev["meta_desc"] = _html.unescape(m.group(1)).strip() if m else ""
    h1s = re.findall(r"(?is)<h1[^>]*>(.*?)</h1>", html)
    ev["h1"] = strip_tags(h1s[0]) if h1s else ""; ev["h1_count"] = len(h1s)
    ev["viewport"] = bool(re.search(r'(?i)<meta[^>]+name=["\']viewport["\']', html))
    ev["word_count"] = len(ltext.split())

    ev["schema_types"], ev["local_schema"] = parse_schema(html)
    a = ev["local_schema"] or {}
    ev["schema_address"] = a.get("address") if isinstance(a.get("address"), (dict, str)) else None
    ev["schema_hours"] = a.get("openingHours") or a.get("openingHoursSpecification")
    ev["schema_geo"] = a.get("geo")
    ev["schema_sameas"] = a.get("sameAs")

    tel = re.findall(r'(?i)href=["\']tel:([^"\']+)["\']', html)
    ev["tel_links"] = [t.strip() for t in tel]; ev["click_to_call"] = len(tel) > 0
    bp = digits(biz.get("phone"))
    site_phones = find_phones(text) + [digits(t) for t in tel]
    ev["site_phones"] = list(dict.fromkeys([p for p in site_phones if p]))
    ev["phone_on_site"] = bool(bp and any(bp in p or p in bp for p in ev["site_phones"])) if bp else (len(ev["site_phones"]) > 0)

    ev["maps_embed"] = bool(re.search(r'(?i)<iframe[^>]+(google\.com/maps|maps\.google)', html))
    gbp = (biz.get("gbp") or "").strip()
    ev["gbp_linked"] = bool(gbp and gbp.replace("https://", "").replace("http://", "") in html)
    ev["maps_link"] = ev["maps_embed"] or ev["gbp_linked"] or bool(re.search(r"(?i)maps\.google|g\.page|goo\.gl/maps", html))

    nm = norm_name(biz.get("name")); ntext = norm_name(text)
    ev["name_on_site"] = (nm and " ".join(nm.split()[:3]) in ntext) if nm else None
    ev["city_on_site"] = (biz.get("city") and biz["city"].lower() in ltext) if biz.get("city") else None

    ev["social"] = sorted(set(re.findall(r'(?i)https?://[^"\']*(?:facebook|instagram|linkedin|twitter|x\.com|youtube|yelp|tiktok)[^"\']*', html)))[:14]
    links = [l.lower() for l in re.findall(r'(?i)href=["\']([^"\']+)["\']', html)]
    ev["has_contact_page"] = any("contact" in l for l in links)
    ev["has_location_page"] = any(re.search(r"location|areas?-we-serve|service-area", l) for l in links)
    ev["has_services"] = any("service" in l for l in links) or bool(a.get("makesOffer") or a.get("hasOfferCatalog"))
    imgs = re.findall(r"(?is)<img\b[^>]*>", html)
    ev["img_count"] = len(imgs)
    ev["img_missing_alt"] = sum(1 for i in imgs if not re.search(r'(?i)\balt\s*=\s*["\'][^"\']', i))

    # crawl a few key subpages for NAP/hours/services
    bse = base_of(res["final_url"])
    for slug in SUBPAGES:
        if len([p for p in ev["pages_crawled"] if p != res["final_url"]]) >= 4: break
        if not any(slug in l for l in links): continue
        sub = fetch_page(bse + "/" + slug, 12)
        if sub and sub["status"] == 200:
            ev["pages_crawled"].append(sub["final_url"])
            st = strip_tags(sub["text"])
            for p in find_phones(st):
                if p not in ev["site_phones"]: ev["site_phones"].append(p)
            if not ev["local_schema"]:
                t2, l2 = parse_schema(sub["text"])
                if l2: ev["local_schema"] = l2; ev["schema_types"] = sorted(set(ev["schema_types"]+t2))
            log(f"[site] crawled {slug} -> {sub['final_url']}")

    try:
        rb = http_get(bse + "/robots.txt", 10); ev["robots"] = rb["status"] == 200
        ev["sitemap_in_robots"] = "sitemap" in rb["text"].lower()
    except Exception: ev["robots"] = ev["sitemap_in_robots"] = False
    try:
        sm = http_get(bse + "/sitemap.xml", 10); ev["sitemap"] = sm["status"] == 200 and "<" in sm["text"]
    except Exception: ev["sitemap"] = False
    log(f"[site] done. schema={ev['schema_types'] or 'none'} phones={ev['site_phones']} pages={len(ev['pages_crawled'])}")
    return ev

# ----------------------------------------------------- 2) PageSpeed Insights
def pagespeed(url):
    if not url: return None
    try:
        log("[psi] querying Google PageSpeed Insights (mobile)…")
        j = get_json("https://www.googleapis.com/pagespeedonline/v5/runPagespeed?strategy=mobile&category=performance&url=" + urllib.parse.quote(norm_url(url)), 45)
        lh = j.get("lighthouseResult", {}); au = lh.get("audits", {})
        def num(k):
            try: return au.get(k, {}).get("numericValue")
            except Exception: return None
        return {"perf": (lh.get("categories", {}).get("performance", {}) or {}).get("score"),
                "lcp": num("largest-contentful-paint"), "cls": num("cumulative-layout-shift"),
                "tbt": num("total-blocking-time")}
    except Exception as e:
        log(f"[psi] unavailable ({str(e)[:60]}) — skipping"); return None

# ------------------------------------------------- 3) search discovery (Bing)
def bing(query, count=20, retries=2):
    u = "https://www.bing.com/search?q=" + urllib.parse.quote(query) + f"&count={count}&setlang=en&mkt=en-US"
    for i in range(retries + 1):
        try:
            t = http_get(u, 18)["text"]
            if len(t) > 4000 and "captcha" not in t.lower(): return t
        except Exception: pass
        time.sleep(1.2)
    return ""

def bing_urls(html):
    out = []
    for h in re.findall(r'<a[^>]+href="(https?://[^"]+)"', html):
        if any(b in h for b in ["bing.com","microsoft","msn.","go.micro","live.com","cc.bingj","aka.ms"]): continue
        out.append(h)
    return list(dict.fromkeys(out))

def discover_listings(biz):
    name, city = biz.get("name") or "", biz.get("city") or ""
    out = {"found": [], "missing": [], "urls": {}, "rating": None, "review_count": None, "serp_ok": False, "indexed": None}
    if not name: return out
    log(f"[serp] searching listings for: {name} {city}")
    html = bing(f'{name} {city}'.strip(), 30)
    if not html:
        out["missing"] = [d[0] for d in DIRECTORIES]; log("[serp] brand search blocked/empty"); return out
    out["serp_ok"] = True; low = html.lower()
    for label, dom in DIRECTORIES:
        (out["found"] if dom.lower() in low else out["missing"]).append(label)
    for u in bing_urls(html):
        for label, dom in DIRECTORIES:
            if dom.lower() in u.lower() and label not in out["urls"]:
                out["urls"][label] = u
    m = re.search(r"([0-5](?:\.\d)?)\s*(?:out of 5|stars?|/\s*5)", low)
    if m:
        try: out["rating"] = float(m.group(1))
        except Exception: pass
    m = re.search(r"\(?\b(\d{1,5})\)?\s*(?:reviews?|ratings?)\b", low)
    if m:
        try: out["review_count"] = int(m.group(1))
        except Exception: pass
    own = domain_of(biz.get("web")); out["indexed"] = bool(own and own in low)
    # targeted site: queries for the core directories missing a URL (gets exact listing links)
    for label in CORE_DIRS:
        dom = dict(DIRECTORIES)[label]
        if label in out["urls"]: continue
        time.sleep(1.0)
        h2 = bing(f'site:{dom} {name} {city}'.strip(), 10, retries=1)
        if h2:
            for u in bing_urls(h2):
                if dom.split("/")[0] in u.lower():
                    out["urls"][label] = u
                    if label in out["missing"]: out["missing"].remove(label); out["found"].append(label)
                    break
    log(f"[serp] found on: {', '.join(out['found']) or 'none'} | rating={out['rating']} reviews={out['review_count']}")
    return out

# ---------------------------------------------------------- 4) NAP system
def nap_system(biz, listings, site):
    canonical_phone = digits(biz.get("phone")) or (site.get("site_phones") or [""])[0]
    canonical = {"name": biz.get("name", ""), "phone": canonical_phone,
                 "address": _addr_str(site.get("schema_address")) or biz.get("city", "")}
    sources, issues = [], []
    # website as a source
    if site.get("reached"):
        sources.append({"source": "Website", "url": site.get("final_url"),
                        "phone": (site.get("site_phones") or [""])[0],
                        "phone_match": bool(canonical_phone and canonical_phone in (site.get("site_phones") or [])),
                        "name_match": site.get("name_on_site") is not False, "reached": True})
    # each reachable listing
    nm = norm_name(biz.get("name"))
    for label, url in list(listings.get("urls", {}).items())[:6]:
        time.sleep(0.4)
        log(f"[nap] checking listing: {label}")
        r = fetch_page(url, 14)
        if not r or r["status"] >= 400:
            sources.append({"source": label, "url": url, "reached": False, "phone": "", "phone_match": None, "name_match": None}); continue
        txt = strip_tags(r["text"]); phones = find_phones(txt)
        pm = bool(canonical_phone and any(canonical_phone in p or p in canonical_phone for p in phones))
        nmatch = bool(nm and " ".join(nm.split()[:3]) in norm_name(txt))
        sources.append({"source": label, "url": url, "reached": True,
                        "phone": phones[0] if phones else "", "phone_match": pm, "name_match": nmatch})
        if canonical_phone and phones and not pm:
            issues.append(f"{label} shows a different phone ({phones[0]}) than your canonical ({canonical_phone})")
    reachable = [s for s in sources if s.get("reached")]
    consistent = bool(reachable) and all(s.get("phone_match") in (True, None) for s in reachable) and not issues
    return {"canonical": canonical, "sources": sources, "issues": issues,
            "consistent": consistent, "reachable_count": len(reachable)}

def _addr_str(a):
    if isinstance(a, str): return a
    if isinstance(a, dict):
        return ", ".join(str(a.get(k, "")) for k in ("streetAddress", "addressLocality", "addressRegion", "postalCode") if a.get(k))
    return ""

# ------------------------------------------------ 5) keyword visibility
def keyword_visibility(biz):
    name, city, cat = biz.get("name", ""), biz.get("city", ""), biz.get("cat", "")
    out = []
    if not (cat and name): return out
    kws = [f"{cat} {city}".strip(), f"{cat} near me", f"best {cat} {city}".strip()]
    nm = norm_name(name)
    for kw in kws[:3]:
        time.sleep(1.0)
        html = bing(kw, 30, retries=1)
        pos, found = None, False
        if html:
            urls = bing_urls(html); own = domain_of(biz.get("web"))
            low = html.lower()
            found = bool(nm and " ".join(nm.split()[:3]) in norm_name(strip_tags(html)))
            if own:
                for i, u in enumerate(urls):
                    if own in u.lower(): pos = i + 1; found = True; break
        out.append({"keyword": kw, "found": found, "position": pos, "serp_ok": bool(html)})
        log(f"[rank] '{kw}' -> found={found} pos={pos}")
    return out

# --------------------------------------- 6) GBP panel (deep / Places API)
def ensure_playwright(auto=True):
    try:
        import playwright  # noqa
        return True
    except Exception:
        if not auto: return False
        log("[gbp] Playwright not installed — installing (one-time)…")
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "playwright"], check=True)
            subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
            import importlib; importlib.invalidate_caches(); import playwright  # noqa
            return True
        except Exception as e:
            log(f"[gbp] auto-install failed: {str(e)[:80]}"); return False

def gbp_via_playwright(biz, auto_install=True):
    if not ensure_playwright(auto_install):
        return {"source": "none", "found": False, "note": "Playwright unavailable; run: pip install playwright && playwright install chromium"}
    from playwright.sync_api import sync_playwright
    name, city, gbp = biz.get("name", ""), biz.get("city", ""), (biz.get("gbp") or "").strip()
    target = gbp if gbp.startswith("http") else "https://www.google.com/maps/search/" + urllib.parse.quote(f"{name} {city}".strip())
    prof = {"source": "playwright", "found": False}
    log(f"[gbp] opening Maps via headless browser: {target}")
    try:
        with sync_playwright() as pw:
            br = pw.chromium.launch(args=["--no-sandbox"])
            pg = br.new_page(user_agent=UA, locale="en-US")
            pg.goto(target, wait_until="domcontentloaded", timeout=45000)
            # consent
            for sel in ['button:has-text("Accept all")', 'button:has-text("Reject all")', 'button[aria-label*="Accept"]']:
                try:
                    if pg.locator(sel).first.is_visible(timeout=1500): pg.locator(sel).first.click(); break
                except Exception: pass
            pg.wait_for_timeout(2500)
            # if a results list, open first place
            try:
                if pg.locator("a.hfpxzc").first.is_visible(timeout=2500):
                    pg.locator("a.hfpxzc").first.click(); pg.wait_for_timeout(2500)
            except Exception: pass
            def txt(sel):
                try:
                    el = pg.locator(sel).first
                    if el.is_visible(timeout=1200): return (el.inner_text() or "").strip()
                except Exception: pass
                return ""
            def attr(sel, a):
                try: return (pg.locator(sel).first.get_attribute(a) or "").strip()
                except Exception: return ""
            prof["name"] = txt("h1.DUwDvf") or txt("h1")
            prof["category"] = txt("button.DkEaL") or txt("button[jsaction*='category']")
            rating = txt("div.F7nice span[aria-hidden='true']")
            prof["rating"] = float(rating) if re.match(r"^[0-5](\.\d)?$", rating or "") else None
            rc = txt("div.F7nice") + " " + (attr("div.F7nice span[aria-label*='review']", "aria-label") or "") + " " + (attr("button[jsaction*='reviewChart']", "aria-label") or "")
            mrc = re.search(r"\(([\d,]+)\)", rc) or re.search(r"([\d,]+)\s*reviews?", rc.lower())
            if not mrc:
                mrc = re.search(r'([\d,]{2,})\s*reviews?', pg.content().lower())
            prof["review_count"] = int(mrc.group(1).replace(",", "")) if mrc else None
            prof["address"] = (attr("button[data-item-id='address']", "aria-label") or txt("button[data-item-id='address']")).replace("Address: ", "")
            ph = attr("button[data-item-id^='phone']", "aria-label") or txt("button[data-item-id^='phone']")
            prof["phone"] = ph.replace("Phone: ", "")
            prof["website"] = attr("a[data-item-id='authority']", "href")
            prof["hours_present"] = bool(txt("div[jsaction*='openhours']") or attr("img[aria-label*='hours']", "aria-label") or txt(".t39EBf"))
            body = pg.content().lower()
            prof["business_status"] = ("permanently_closed" if "permanently closed" in body else
                                       "temporarily_closed" if "temporarily closed" in body else "open")
            prof["claimed"] = not ("claim this business" in body or "own this business" in body)
            # secondary categories from embedded data (GMB-Everywhere style, best effort)
            cats = re.findall(r'"([A-Z][A-Za-z&/ -]{3,40})","/g/[0-9a-z]+"', pg.content())
            prof["secondary"] = list(dict.fromkeys([c for c in cats if c.lower() != (prof.get("category") or "").lower()]))[:8]
            prof["found"] = bool(prof.get("name"))
            br.close()
        log(f"[gbp] read profile: cat={prof.get('category')} rating={prof.get('rating')} reviews={prof.get('review_count')} claimed={prof.get('claimed')}")
    except Exception as e:
        prof["note"] = f"GBP read error: {str(e)[:120]}"; log("[gbp] " + prof["note"])
    return prof

def gbp_via_places(biz, key):
    try:
        log("[gbp] Google Places API lookup…")
        q = urllib.parse.quote(f"{biz.get('name','')} {biz.get('city','')}".strip())
        f = get_json(f"https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input={q}&inputtype=textquery&fields=place_id&key={key}")
        cands = f.get("candidates") or []
        if not cands: return {"source": "places", "found": False, "note": "not found in Places"}
        pid = cands[0]["place_id"]
        d = get_json(f"https://maps.googleapis.com/maps/api/place/details/json?place_id={pid}&fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,opening_hours,types,business_status,url&key={key}")
        r = d.get("result", {})
        return {"source": "places", "found": True, "name": r.get("name"), "address": r.get("formatted_address"),
                "phone": r.get("formatted_phone_number"), "website": r.get("website"), "rating": r.get("rating"),
                "review_count": r.get("user_ratings_total"), "category": (r.get("types") or [None])[0],
                "secondary": r.get("types", [])[1:6], "hours_present": bool(r.get("opening_hours")),
                "business_status": (r.get("business_status") or "").lower(), "claimed": True}
    except Exception as e:
        return {"source": "places", "found": False, "note": str(e)[:120]}

# --------------------------------------------- map ALL checks + areas
GENERIC_CATS = {"service","business","store","shop","company","contractor","agency"}
def cv(v, why, src, fix=""):
    return {"verdict": v, "evidence": why, "source": src, "fix": fix}

def map_checks(biz, site, disc, nap, prof, ranks):
    V = {}
    # website / on-site (site)
    if site.get("reached"):
        V["we5"] = cv("pass" if site["https"] and site["viewport"] else "fail",
                      f"HTTPS={site['https']}, mobile viewport={site['viewport']}", "site",
                      "Serve over HTTPS and add a responsive viewport meta tag")
        if site.get("local_schema"):
            a = site["local_schema"]; ok = bool(a.get("name") and (a.get("telephone") or a.get("address")))
            V["we1"] = cv("pass" if ok else "fail", f"LocalBusiness schema ({', '.join(site['schema_types'])})" + ("" if ok else " missing NAP fields"), "site", "Add full NAP to LocalBusiness JSON-LD")
        else:
            V["we1"] = cv("fail", "No LocalBusiness JSON-LD on the site", "site", "Add LocalBusiness schema (use Schema Generator)")
        if site.get("name_on_site") is not None:
            ok = (site["name_on_site"] is not False) and (site.get("phone_on_site") is not False)
            V["we2"] = cv("pass" if ok else "fail", f"name on site={site['name_on_site']}, phone on site={site['phone_on_site']}", "site", "Show identical NAP on the site (footer + contact)")
        V["we3"] = cv("pass" if site["maps_link"] else "fail", "Maps embed/GBP link present" if site["maps_link"] else "No Google Maps embed or GBP link", "site", "Embed your Google Map and link the GBP")
        V["we4"] = cv("pass" if site.get("has_location_page") else "fail", "Location/service-area page found" if site.get("has_location_page") else "No dedicated location/service-area page", "site", "Add indexed location pages with unique NAP + map")
    bp = digits(biz.get("phone")) or (prof.get("phone") and digits(prof["phone"])) or ""
    if bp:
        toll = bool(re.match(r"^(1)?(800|888|877|866|855|844|833|822)", bp))
        V["na2"] = cv("fail" if toll else "pass", "Toll-free/tracking number" if toll else "Local-style number", "site", "Use a local-area-code number as primary")
    # name keyword stuffing (na1/av1)
    nm = norm_name(biz.get("name")); catw = norm_name(biz.get("cat"))
    stuffed = bool(catw and catw.split() and catw.split()[0] in nm.split()) or (biz.get("city") and biz["city"].lower() in nm) or len(nm.split()) > 6
    V["na1"] = cv("fail" if stuffed else "pass", "Business name may contain keywords/city (stuffing risk)" if stuffed else "Name looks like a clean brand name", "rule", "Use only the real-world business name in GBP")
    V["av1"] = dict(V["na1"])
    # NAP consistency (na3 / ci4)
    if nap and nap.get("reachable_count"):
        V["na3"] = cv("pass" if nap["consistent"] else "fail",
                      "NAP consistent across reachable listings" if nap["consistent"] else "; ".join(nap["issues"]) or "NAP differs across listings", "search",
                      "Standardize one canonical NAP across all listings")
        V["ci4"] = cv("pass" if nap["consistent"] else "fail", "No conflicting listings detected" if nap["consistent"] else "Conflicting NAP found — possible duplicates", "search", "Find & merge/remove duplicate listings")
    # citations (search)
    if disc.get("serp_ok"):
        core_ok = [c for c in CORE_DIRS if c in disc["found"]]
        V["ci1"] = cv("pass" if len(core_ok) >= 3 else "fail", f"Top-tier listings: {', '.join(core_ok) or 'none'}", "search", "Claim Yelp, Apple, Bing Places, BBB, YellowPages")
        ind = [c for c in ["Tripadvisor","Healthgrades","Avvo","Houzz","Angi","Thumbtack"] if c in disc["found"]]
        V["ci2"] = cv("pass" if ind else "fail", f"Industry directories: {', '.join(ind) or 'none detected'}", "search", "Claim industry-specific directories for your vertical")
        V["ci3"] = cv("pass" if len(disc["found"]) >= 8 else "fail", f"~{len(disc['found'])} directories detected", "search", "Build toward 30+ consistent citations")
    # reviews (profile/search)
    rc = (prof.get("review_count") if prof.get("review_count") is not None else disc.get("review_count"))
    rt = (prof.get("rating") if prof.get("rating") is not None else disc.get("rating"))
    if rc is not None:
        V["rv1"] = cv("pass" if rc >= 25 else "fail", f"~{rc} reviews", prof.get("source") if prof.get("review_count") is not None else "search", "Build a steady review-generation system")
    if rt is not None:
        V["rv2"] = cv("pass" if rt >= 4.3 else "fail", f"Rating {rt}★", prof.get("source") if prof.get("rating") is not None else "search", "Improve service + responses to lift rating")
    # GBP panel (profile)
    if prof.get("found"):
        c = (prof.get("category") or "").lower()
        if c:
            generic = any(g == c or g in c.split() for g in GENERIC_CATS)
            V["ca1"] = cv("fail" if generic else "pass", f"Primary category: {prof.get('category')}", "profile", "Pick the most specific accurate primary category")
        if prof.get("secondary") is not None:
            n = len(prof.get("secondary") or [])
            V["ca2"] = cv("pass" if n >= 3 else "fail", f"{n} secondary categories detected", "profile", "Add 3-9 relevant secondary categories")
        if prof.get("hours_present") is not None:
            V["ho1"] = cv("pass" if prof["hours_present"] else "fail", "Hours set on GBP" if prof["hours_present"] else "No hours detected on GBP", "profile", "Set regular business hours")
        if prof.get("claimed") is not None:
            V["id1"] = cv("pass" if prof["claimed"] else "fail", "Profile appears claimed" if prof["claimed"] else "Profile may be UNCLAIMED ('claim this business' shown)", "profile", "Claim & verify the profile")
        if prof.get("business_status"):
            V["id4"] = cv("fail" if "closed" in prof["business_status"] else "pass", f"Business status: {prof['business_status']}", "profile", "Ensure the profile is not marked closed")
        if biz.get("type") == "sab" and prof.get("address"):
            V["av4"] = cv("fail", "Address is visible for a service-area business", "profile", "Hide the address in GBP settings for SABs")
    elif site.get("schema_hours"):
        V["ho1"] = cv("pass", "Opening hours found in website schema", "site", "")
    # services from site
    if site.get("reached"):
        V["ca4"] = cv("pass" if site.get("has_services") else "fail", "Services page/schema found" if site.get("has_services") else "No services list detected", "site", "List services with name/description/price")
    return V

def clamp(n): return max(0, min(100, int(round(n))))
def build_areas(biz, site, disc, nap, prof, ranks, psi):
    A = []
    # On-site
    s, f, r = 100, [], []
    if not site.get("reached"): s = 30; f.append("Website could not be fetched")
    else:
        if not site["https"]: s-=20; f.append("Not served over HTTPS"); r.append("Install SSL + force HTTPS")
        if not site["viewport"]: s-=15; f.append("No mobile viewport meta"); r.append("Add responsive viewport meta")
        if not site.get("local_schema"): s-=18; f.append("No LocalBusiness schema"); r.append("Add LocalBusiness JSON-LD with NAP")
        if not site.get("click_to_call"): s-=8; f.append("No click-to-call link"); r.append("Make phone a tap-to-call link")
        if not site["maps_link"]: s-=8; f.append("No map embed / GBP link"); r.append("Embed map + link GBP")
        if len(site.get("meta_desc","")) < 80: s-=6; f.append("Meta description short/missing"); r.append("Write 140-160 char meta description")
        if site.get("h1_count",0) != 1: s-=5; f.append(f"H1 count={site.get('h1_count',0)}"); r.append("Use exactly one H1")
        if site.get("img_missing_alt",0) > 0: s-=4; f.append(f"{site['img_missing_alt']} images missing alt"); r.append("Add descriptive alt text")
        if not site.get("sitemap"): s-=3; f.append("No sitemap.xml"); r.append("Publish sitemap.xml")
    if psi and psi.get("perf") is not None:
        f.append(f"PageSpeed mobile score: {int(psi['perf']*100)}/100")
        if psi["perf"] < 0.5: s-=10; r.append("Improve mobile page speed (Core Web Vitals)")
    A.append({"key":"onsite","label":"On-Site & Website","score":clamp(s),"findings":f,"recommendations":r})
    # NAP
    s, f, r = 100, [], []
    if site.get("reached"):
        if site.get("name_on_site") is False: s-=25; f.append("Business name not found on site")
        if site.get("phone_on_site") is False: s-=25; f.append("Phone not found on site")
        if site.get("city_on_site") is False: s-=12; f.append("City not clearly present")
    if nap and nap.get("issues"):
        s -= 18*len(nap["issues"]); f += nap["issues"]
    if nap and nap.get("reachable_count"):
        f.append(f"Checked NAP on {nap['reachable_count']} live listing(s)")
    r = ["Use ONE identical NAP everywhere (run NAP Checker)"]
    A.append({"key":"nap","label":"NAP Consistency","score":clamp(s),"findings":f,"recommendations":r})
    # Citations
    found, missing = disc.get("found", []), disc.get("missing", [])
    core_missing = [c for c in CORE_DIRS if c in missing]
    s = clamp(40 + min(60, len(found)*6)); f = []
    if core_missing: f.append("Not found on: " + ", ".join(core_missing))
    if not disc.get("serp_ok"): f.append("Live search blocked — verify listings manually")
    A.append({"key":"citations","label":"Citations & Business Listings","score":s,
              "findings":f or [f"Listed on {len(found)} directories"],
              "recommendations":[f"Claim: {', '.join((core_missing+['industry directories'])[:6])}","Target 30+ consistent citations"],
              "detail":{"found":found,"missing":missing}})
    # Backlinks
    s, f = 55, []
    if site.get("reached") and len(site.get("social",[])) < 2: s-=10; f.append("Few social profiles linked")
    f.append("Backlink index needs a dedicated tool — estimated from on-page signals")
    A.append({"key":"backlinks","label":"Backlinks & Authority","score":clamp(s),"findings":f,
              "recommendations":["Pursue local sponsorships, supplier & press links","Run Backlink Profile for a full audit"]})
    # Reviews
    s, f = 60, []
    rc = prof.get("review_count") if prof.get("review_count") is not None else disc.get("review_count")
    rt = prof.get("rating") if prof.get("rating") is not None else disc.get("rating")
    if rc is not None:
        s = 85 if rc>=25 else 65 if rc>=10 else 40
        f.append(f"~{rc} reviews" + (" — push past 25" if rc<25 else ""))
    else: f.append("Review volume not detected — verify on GBP")
    if rt is not None:
        f.append(f"Average rating {rt}★");  s -= 15 if rt<4.0 else 0
    A.append({"key":"reviews","label":"Reviews & Reputation","score":clamp(s),"findings":f,
              "recommendations":["Respond to every review within 24h","Add a post-service review-ask flow"]})
    # GBP
    s, f, r = 70, [], []
    if prof.get("found"):
        f.append(f"Primary category: {prof.get('category') or 'unknown'}")
        if prof.get("secondary") is not None: f.append(f"{len(prof.get('secondary') or [])} secondary categories")
        if prof.get("claimed") is False: s-=25; f.append("Profile appears UNCLAIMED")
        if prof.get("business_status") and "closed" in prof.get("business_status",""): s-=20; f.append("Marked "+prof["business_status"])
        if prof.get("hours_present") is False: s-=10; f.append("No hours set")
    else:
        f.append("GBP panel not read (run with --deep, or items need a logged-in check)")
    r = ["Most specific primary category + 3-9 secondaries","Full 750-char description; weekly posts; 10+ photos","Keep hours current incl. holidays"]
    A.append({"key":"gbp","label":"GBP Profile Optimization","score":clamp(s),"findings":f,"recommendations":r})
    return A

def grade_for(s): return "A" if s>=90 else "B" if s>=75 else "C" if s>=60 else "D" if s>=45 else "F"

def run_audit(biz, opr_key=None, deep=False, places_key=None, auto_install=True):
    log(f"=== Deep audit: {biz.get('name','?')} ({biz.get('web') or 'no site'}) ===")
    site = analyze_site(biz.get("web"), biz)
    psi = pagespeed(biz.get("web")) if site.get("reached") else None
    disc = discover_listings(biz)
    nap = nap_system(biz, disc, site)
    ranks = keyword_visibility(biz)
    prof = {"source": "none", "found": False}
    if places_key: prof = gbp_via_places(biz, places_key)
    if not prof.get("found") and deep: prof = gbp_via_playwright(biz, auto_install)
    areas = build_areas(biz, site, disc, nap, prof, ranks, psi)
    checks = map_checks(biz, site, disc, nap, prof, ranks)
    overall = clamp(sum(a["score"] for a in areas)/len(areas)) if areas else 0
    weak = min(areas, key=lambda a: a["score"]); strong = max(areas, key=lambda a: a["score"])
    summary = (f"{biz.get('name','This business')} scores {overall}/100. Strongest: {strong['label']} ({strong['score']}). "
               f"Biggest opportunity: {weak['label']} ({weak['score']}) — {(weak['findings'][0] if weak['findings'] else 'optimize this area')}. "
               f"{len(checks)} checks auto-verified from {'the live GBP panel, ' if prof.get('found') else ''}your website and search.")
    log(f"=== Done. grade {grade_for(overall)} ({overall}/100), {len(checks)} checks scored ===")
    return {"business": biz, "ranAt": datetime.now(timezone.utc).isoformat(), "engine": "python-local-v2",
            "overall": overall, "grade": grade_for(overall), "summary": summary, "areas": areas,
            "verdicts": checks, "evidence": site, "discovery": disc, "nap": nap, "profile": prof,
            "rankings": ranks, "pagespeed": psi}

# --------------------------------------------------------------- report
def report_html(R):
    b = R["business"]; e = R["evidence"]; d = R["discovery"]; nap = R["nap"]; prof = R["profile"]
    def esc(s): return _html.escape(str(s if s is not None else ""))
    gc = {"A":"#16a34a","B":"#2563eb","C":"#d97706","D":"#ea580c","F":"#dc2626"}[R["grade"]]
    bar = lambda sc: "#16a34a" if sc>=80 else "#2563eb" if sc>=60 else "#d97706" if sc>=40 else "#dc2626"
    areas = "".join(f"""<div class="area"><div class="ah"><div class="an">{esc(a['label'])}</div><div class="as" style="color:{bar(a['score'])}">{a['score']}</div></div>
      <div class="pbar"><div style="width:{a['score']}%;background:{bar(a['score'])}"></div></div>
      {('<div class=h>Issues</div><ul class=find>'+''.join('<li>'+esc(x)+'</li>' for x in a['findings'])+'</ul>') if a.get('findings') else ''}
      {('<div class=h>Recommendations</div><ul class=rec>'+''.join('<li>'+esc(x)+'</li>' for x in a['recommendations'])+'</ul>') if a.get('recommendations') else ''}</div>""" for a in R["areas"])
    prof_html = ""
    if prof.get("found"):
        prof_html = f"""<div class="area"><div class="an" style="margin-bottom:8px">GBP Profile (read from {esc(prof.get('source'))})</div><div class="kv">
        <div class=kvi><b>Primary category</b>{esc(prof.get('category') or '—')}</div>
        <div class=kvi><b>Secondary</b>{esc(', '.join(prof.get('secondary') or []) or '—')}</div>
        <div class=kvi><b>Rating</b>{esc(prof.get('rating'))} ★ ({esc(prof.get('review_count'))} reviews)</div>
        <div class=kvi><b>Phone</b>{esc(prof.get('phone') or '—')}</div>
        <div class=kvi><b>Address</b>{esc(prof.get('address') or '—')}</div>
        <div class=kvi><b>Claimed</b>{esc(prof.get('claimed'))} · {esc(prof.get('business_status') or '')}</div></div></div>"""
    nap_rows = "".join(f"<tr><td>{esc(s['source'])}</td><td>{esc(s.get('phone') or '—')}</td><td>{'✓' if s.get('phone_match') else ('—' if s.get('phone_match') is None else '✕')}</td><td>{'reached' if s.get('reached') else 'blocked'}</td></tr>" for s in nap.get("sources", []))
    return f"""<!DOCTYPE html><html><head><meta charset=utf-8><title>Deep Local SEO Audit — {esc(b.get('name'))}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap" rel=stylesheet>
<style>*{{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',sans-serif}}body{{background:#f3f6fb;color:#0f1a2e;padding:28px;font-size:14px;line-height:1.55}}
.wrap{{max-width:1000px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 6px 24px rgba(15,26,46,.1);padding:34px}}
.hdr{{display:flex;align-items:center;gap:16px;border-bottom:2px solid #e9eef7;padding-bottom:20px;margin-bottom:22px}}
.gr{{width:64px;height:64px;border-radius:14px;background:{gc};color:#fff;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900}}
h1{{font-size:22px}}.sub{{color:#5b6b88;font-size:12.5px;margin-top:3px}}.ov{{margin-left:auto;text-align:right}}.ov .n{{font-size:40px;font-weight:900;font-family:'JetBrains Mono',monospace;color:{gc}}}
.sum{{background:linear-gradient(135deg,rgba(124,58,237,.07),rgba(37,99,235,.05));border:1px solid #e9eef7;border-radius:12px;padding:16px 18px;margin-bottom:20px;line-height:1.7}}
.area{{border:1px solid #e9eef7;border-radius:12px;padding:16px 18px;margin-bottom:13px}}.ah{{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px}}.an{{font-size:15px;font-weight:800}}.as{{font-size:22px;font-weight:900;font-family:'JetBrains Mono',monospace}}
.pbar{{height:7px;background:#eef2f8;border-radius:4px;overflow:hidden;margin-bottom:12px}}.pbar div{{height:100%}}
.h{{font-size:10px;font-family:'JetBrains Mono',monospace;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#8a9ab5;margin:10px 0 6px}}
ul{{list-style:none;display:flex;flex-direction:column;gap:6px}}li{{position:relative;padding-left:20px;font-size:12.5px;color:#5b6b88}}
ul.find li::before{{content:'!';position:absolute;left:0;top:0;width:14px;height:14px;border-radius:50%;background:#fee2e2;color:#dc2626;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center}}
ul.rec li::before{{content:'';position:absolute;left:3px;top:6px;width:7px;height:7px;border-radius:2px;background:#16a34a}}
.kv{{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}}.kvi{{background:#f8fafc;border:1px solid #e9eef7;border-radius:9px;padding:10px 12px;font-size:12px}}.kvi b{{display:block;font-size:10px;color:#8a9ab5;text-transform:uppercase;font-family:'JetBrains Mono',monospace;margin-bottom:3px}}
table{{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}}th,td{{text-align:left;padding:6px 8px;border-bottom:1px solid #eef2f8}}th{{font-size:10px;text-transform:uppercase;color:#8a9ab5;font-family:'JetBrains Mono',monospace}}
.foot{{margin-top:26px;padding-top:14px;border-top:1px solid #e9eef7;text-align:center;color:#8a9ab5;font-size:11px}}@media print{{body{{background:#fff;padding:0}}.wrap{{box-shadow:none}}}}</style></head>
<body><div class=wrap><div class=hdr><div class=gr>{R['grade']}</div><div><h1>Deep Local SEO Audit — {esc(b.get('name'))}</h1>
<div class=sub>{esc(b.get('web'))} · {esc(b.get('city'))} · {esc(b.get('cat'))} · {datetime.now().strftime('%Y-%m-%d %H:%M')}</div></div>
<div class=ov><div class=n>{R['overall']}</div><div class=sub>/ 100</div></div></div>
<div class=sum>{esc(R['summary'])}</div>
<div class=kv style=margin-bottom:20px>
 <div class=kvi><b>Website</b>{'reached' if e.get('reached') else 'NOT reached'} · {len(e.get('pages_crawled',[]))} pages · HTTPS {('yes' if e.get('https') else 'no')}</div>
 <div class=kvi><b>Schema</b>{esc(', '.join(e.get('schema_types',[])) or 'none')}</div>
 <div class=kvi><b>Listings found</b>{esc(', '.join(d.get('found',[])) or 'none')}</div>
 <div class=kvi><b>NAP listings checked</b>{nap.get('reachable_count',0)} · {'consistent' if nap.get('consistent') else 'issues'}</div>
 <div class=kvi><b>Reviews</b>{esc((prof.get('review_count') if prof.get('review_count') is not None else d.get('review_count')))} · {esc((prof.get('rating') if prof.get('rating') is not None else d.get('rating')))}★</div>
 <div class=kvi><b>Checks auto-scored</b>{len(R['verdicts'])}</div></div>
{prof_html}
{('<div class=area><div class=an style=margin-bottom:6px>NAP across listings</div><table><tr><th>Source</th><th>Phone</th><th>Match</th><th>Status</th></tr>'+nap_rows+'</table>'+(''.join('<div class=h>Issues</div><ul class=find>'+''.join('<li>'+esc(i)+'</li>' for i in nap['issues'])+'</ul>' for _ in [0]) if nap.get('issues') else '')+'</div>') if nap.get('sources') else ''}
{areas}
<div class=foot>Generated by GBP/Local SEO Deep Auto-Auditor (python-local-v2) · {datetime.now().strftime('%Y-%m-%d %H:%M')}</div></div></body></html>"""

# ----------------------------------------------- geo-grid live scan (Places)
def grid_scan(q):
    import math
    biz = q.get("biz", ""); kw = q.get("kw", ""); key = q.get("key", "")
    if not key: raise Exception("Google Places API key required for live mode")
    if not kw: raise Exception("keyword required")
    lat = float(q.get("lat")); lng = float(q.get("lng"))
    n = int(q.get("grid", 7)); radius = float(q.get("radius", 2)); unit = q.get("unit", "mi")
    miles = radius * 0.621371 if unit == "km" else radius
    half = (n - 1) / 2 or 1
    lat_step = (miles / 69) / half
    lng_step = (miles / (69 * math.cos(math.radians(lat)) or 1)) / half
    radius_m = int(max(miles / half, 0.3) * 1609 * 1.5)
    nm = norm_name(biz); key3 = " ".join(nm.split()[:3])
    log(f"[grid] live scan '{kw}' {n}x{n} around {lat},{lng}")
    results = []
    for r in range(n):
        for c in range(n):
            plat = lat + ((n - 1) / 2 - r) * lat_step
            plng = lng + (c - (n - 1) / 2) * lng_step
            res = []
            try:
                j = get_json("https://maps.googleapis.com/maps/api/place/textsearch/json?query=" +
                             urllib.parse.quote(kw) + f"&location={plat},{plng}&radius={radius_m}&key={key}", 20)
                if j.get("status") not in ("OK", "ZERO_RESULTS"):
                    raise Exception("Places: " + j.get("status", "") + " " + (j.get("error_message", "") or ""))
                res = j.get("results", [])
            except Exception as e:
                if "Places:" in str(e) and "ZERO" not in str(e): raise
            rank, top = 0, []
            for i, item in enumerate(res):
                name = item.get("name", "")
                if i < 3: top.append(name)
                if nm and key3 in norm_name(name) and rank == 0: rank = i + 1
            if rank > 20: rank = 0
            results.append({"r": r, "c": c, "lat": plat, "lng": plng, "rank": rank, "top": top})
            time.sleep(0.12)
    log(f"[grid] done — {len(results)} points")
    return {"results": results, "comps": []}

# --------------------------------------------------------------- server
def serve(port, opr_key, places_key, auto_install):
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    class H(BaseHTTPRequestHandler):
        def _cors(self):
            self.send_header("Access-Control-Allow-Origin", "*"); self.send_header("Access-Control-Allow-Headers", "Content-Type")
        def log_message(self, *a): pass
        def do_OPTIONS(self): self.send_response(204); self._cors(); self.end_headers()
        def do_GET(self):
            u = urllib.parse.urlparse(self.path)
            if u.path in ("/", "/ping"):
                self.send_response(200); self._cors(); self.send_header("Content-Type","application/json"); self.end_headers()
                self.wfile.write(json.dumps({"engine":"python-local-v2","ok":True,"deep_available":True}).encode()); return
            if u.path == "/audit":
                q = {k:(v[0] if v else "") for k,v in urllib.parse.parse_qs(u.query).items()}
                biz = {"name":q.get("name",""),"web":q.get("url",""),"gbp":q.get("gbp",""),"phone":q.get("phone",""),
                       "city":q.get("city",""),"country":q.get("country","US"),"cat":q.get("cat",""),"type":q.get("type","brick")}
                deep = q.get("deep","") in ("1","true","yes")
                try:
                    R = run_audit(biz, opr_key, deep=deep, places_key=places_key, auto_install=auto_install)
                    body = json.dumps(R).encode(); self.send_response(200)
                except Exception as ex:
                    body = json.dumps({"error":str(ex)}).encode(); self.send_response(500)
                self._cors(); self.send_header("Content-Type","application/json"); self.end_headers(); self.wfile.write(body); return
            if u.path == "/grid":
                q = {k:(v[0] if v else "") for k,v in urllib.parse.parse_qs(u.query).items()}
                if not q.get("key") and places_key: q["key"] = places_key
                try:
                    body = json.dumps(grid_scan(q)).encode(); self.send_response(200)
                except Exception as ex:
                    body = json.dumps({"error":str(ex)}).encode(); self.send_response(500)
                self._cors(); self.send_header("Content-Type","application/json"); self.end_headers(); self.wfile.write(body); return
            self.send_response(404); self._cors(); self.end_headers()
    srv = ThreadingHTTPServer(("127.0.0.1", port), H)
    print(f"GBP Deep Auto-Audit engine running -> http://127.0.0.1:{port}")
    print("Deep GBP panel read: append &deep=1 (auto-installs Playwright once). Ctrl+C to stop.")
    try: srv.serve_forever()
    except KeyboardInterrupt: print("\nstopped.")

# --------------------------------------------------------------- CLI
def main():
    ap = argparse.ArgumentParser(description="Free local DEEP GBP / Local SEO auto-auditor.")
    for a in ("name","url","gbp","phone","city","cat"): ap.add_argument("--"+a, default="")
    ap.add_argument("--country", default="US"); ap.add_argument("--type", default="brick")
    ap.add_argument("--deep", action="store_true", help="read the live GBP panel via headless browser (auto-installs Playwright)")
    ap.add_argument("--places-key", default="", help="Google Places API key for exact GBP fields")
    ap.add_argument("--opr-key", default=""); ap.add_argument("--no-auto-install", action="store_true")
    ap.add_argument("--serve", action="store_true"); ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    if a.serve: return serve(a.port, a.opr_key or None, a.places_key or None, not a.no_auto_install)
    if not a.name: ap.error("--name is required (or use --serve)")
    biz = {"name":a.name,"web":a.url,"gbp":a.gbp,"phone":a.phone,"city":a.city,"country":a.country,"cat":a.cat,"type":a.type}
    R = run_audit(biz, a.opr_key or None, deep=a.deep, places_key=a.places_key or None, auto_install=not a.no_auto_install)
    if a.json: print(json.dumps(R, indent=2)); return
    with open("gbp-report.json","w",encoding="utf-8") as f: json.dump(R,f,indent=2)
    with open("gbp-report.html","w",encoding="utf-8") as f: f.write(report_html(R))
    print(f"\n  {biz['name']} — Grade {R['grade']} ({R['overall']}/100)\n  {R['summary']}\n")
    for ar in R["areas"]: print(f"    {ar['score']:>3}  {ar['label']}")
    print(f"\n  {len(R['verdicts'])} checks auto-scored · listings found: {len(R['discovery'].get('found',[]))} · NAP listings checked: {R['nap'].get('reachable_count',0)}")
    print("  -> gbp-report.html + gbp-report.json written.\n")

if __name__ == "__main__":
    main()
