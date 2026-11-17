import json, re, urllib.request, time

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
links = json.load(open("links.json"))
res=[]
for it in links:
    f = it["final"] or ""
    m = re.search(r"/(ss|ep)(\d+)$", f)
    if not m: 
        res.append({**it, "err":"parse"}); continue
    kind, sid = m.group(1), m.group(2)
    q = f"season_id={sid}" if kind=="ss" else f"ep_id={sid}"
    url = f"https://api.bilibili.com/pgc/view/web/season?{q}"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://www.bilibili.com/"})
    try:
        d = json.loads(urllib.request.urlopen(req, timeout=15).read())
    except Exception as e:
        res.append({**it, "err":str(e)}); print(it["idx"], "ERR", e, flush=True); continue
    r = d.get("result") or {}
    res.append({**it, "code": d.get("code"),
        "title": r.get("title"), "season_id": r.get("season_id"),
        "type": r.get("season_type_name"), "areas": [a["name"] for a in r.get("areas",[])],
        "pub": r.get("publish",{}).get("pub_time"),
        "score": (r.get("rating") or {}).get("score"),
        "count": (r.get("rating") or {}).get("count"),
        "cover": r.get("cover"), "evaluate": (r.get("evaluate") or "")[:120],
        "badge": r.get("badge"), "rights": r.get("rights"),
        "total": r.get("total"), "new_ep": (r.get("new_ep") or {}).get("desc"),
        "eps": len(r.get("episodes") or [])})
    print(it["idx"], res[-1].get("title"), "|", res[-1].get("pub"), "| score", res[-1].get("score"), flush=True)
    time.sleep(0.35)
json.dump(res, open("movies.json","w"), ensure_ascii=False, indent=1)
