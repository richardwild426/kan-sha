import json, re, urllib.request, time
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
links = json.load(open("links.json"))
# reuse cached movies.json for title, refetch detail fields only
out=[]
for it in links:
    f=it["final"]; m=re.search(r"/(ss|ep)(\d+)$", f); kind,sid=m.group(1),m.group(2)
    q=f"season_id={sid}" if kind=="ss" else f"ep_id={sid}"
    req=urllib.request.Request(f"https://api.bilibili.com/pgc/view/web/season?{q}", headers={"User-Agent":UA,"Referer":"https://www.bilibili.com/"})
    try:
        d=json.loads(urllib.request.urlopen(req,timeout=15).read())["result"]
    except Exception as e:
        print(it["idx"],"ERR",e,flush=True); continue
    eps=d.get("episodes") or []
    ep=eps[0] if eps else {}
    out.append({"idx":it["idx"],"short":it["short"],"url":f,"title":d.get("title","").strip(),
      "orig":d.get("jp_title"),"season_id":d.get("season_id"),"media_id":d.get("media_id"),
      "type":d.get("season_type_name"),"styles":d.get("styles"),
      "areas":[a["name"] for a in d.get("areas",[])],
      "year":(d.get("publish") or {}).get("pub_time","")[:4],
      "air":(d.get("new_ep") or {}).get("desc"),
      "score":(d.get("rating") or {}).get("score"),"votes":(d.get("rating") or {}).get("count"),
      "cover":d.get("cover"),"banner":d.get("bkg_cover"),
      "synopsis":d.get("evaluate"),"alias":d.get("alias"),
      "actors":d.get("actors"),"staff":d.get("staff"),
      "ep_id":ep.get("ep_id"),"bvid":ep.get("bvid"),"aid":ep.get("aid"),
      "duration":ep.get("duration"),"badge":ep.get("badge"),
      "subtitle":d.get("subtitle"),"stat":d.get("stat"),
      "payment":d.get("payment")})
    print(it["idx"],out[-1]["title"],"|",out[-1]["badge"],"|",out[-1]["year"],"|",out[-1]["styles"],flush=True)
    time.sleep(0.3)
json.dump(out,open("movies_detail.json","w"),ensure_ascii=False,indent=1)
print("OK",len(out))
