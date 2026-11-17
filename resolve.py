import json, re, urllib.request, time

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

links = """1 https://b23.tv/ep790571
2 https://b23.tv/ss45798
3 https://b23.tv/ss46655
4 https://b23.tv/ss47234
5 https://b23.tv/ss41878
6 https://b23.tv/ss273042
7 https://b23.tv/ss45799
8 https://b23.tv/ss39284
9 https://b23.tv/ss39286
10 https://b23.tv/ss39429
11 https://b23.tv/ss48710
12 https://b23.tv/ss41213
13 https://b23.tv/ss68473
14 https://b23.tv/ep1821134
15 https://b23.tv/ep376437
16 https://b23.tv/ss37998
17 https://b23.tv/ss38002
18 https://b23.tv/ss38003
19 https://b23.tv/ep385380
20 https://b23.tv/ep387153
21 https://b23.tv/ss39399
22 https://b23.tv/ss25979
23 https://b23.tv/ss42324
24 https://b23.tv/ss48504
25 https://b23.tv/ss89626
26 https://b23.tv/ss42015
27 https://b23.tv/ep1112126
28 https://b23.tv/ep3092456
29 https://b23.tv/ep747311
30 https://b23.tv/ss44576
31 https://b23.tv/ep3066720
32 https://b23.tv/ss213047
33 https://b23.tv/ep5389730"""

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.HTTPError(req.full_url, code, msg, headers, fp)

op = urllib.request.build_opener(NoRedirect)
out=[]
for line in links.strip().split("\n"):
    idx, url = line.split()
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        op.open(req)
        final = None
    except urllib.error.HTTPError as e:
        final = e.headers.get("Location")
    except Exception as e:
        final = "ERR:"+str(e)
    out.append({"idx": int(idx), "short": url, "final": final})
    print(idx, final, flush=True)

json.dump(out, open("links.json","w"), ensure_ascii=False, indent=1)
