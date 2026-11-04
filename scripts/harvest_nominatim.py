import json, sys, time, urllib.request, urllib.parse, os
UA = "venue-research-script/1.0 (OnGoing virtual venue research)"
CITIES = {
  "riyadh":  dict(ar="الرياض", en="Riyadh",  box=(46.15,25.10,47.10,24.35)),
  "jeddah":  dict(ar="جدة",    en="Jeddah",  box=(38.95,21.95,39.45,21.25)),
  "eastern": dict(ar="الخبر والدمام والظهران", en="Khobar / Dammam / Dhahran", box=(49.85,26.65,50.30,26.05)),
}
KW = ["قاعة","قاعات","صالة","صالات","قصر أفراح","قصر","أفراح","احتفالات","مناسبات","فعاليات","معارض","مركز معارض","مركز مؤتمرات","مؤتمرات","استاد","ملعب","مسرح","مدينة ترفيهية","أرينا","بوليفارد","مركز ثقافي","مركز","دوم","مهرجان",
      "hall","ballroom","wedding","celebration","events","event","exhibition","convention","conference","arena","stadium","theatre","theater","auditorium","dome","pavilion","expo","forum","boulevard","cultural","opera","centre","center","sports city","park","resort"]
out_path = sys.argv[2]; city = sys.argv[1]; c = CITIES[city]
l,t,r,b = c["box"]; mx=(l+r)/2; my=(t+b)/2
tiles = [(l,t,r,b),(l,t,mx,my),(mx,t,r,my),(l,my,mx,b),(mx,my,r,b)]
seen = {}
if os.path.exists(out_path):
    for x in json.load(open(out_path)): seen[x["osm_type"]+str(x["osm_id"])] = x
log = open(out_path+".log","a")
def get(url, params):
    q = urllib.parse.urlencode(params)
    req = urllib.request.Request(url+"?"+q, headers={"User-Agent": UA})
    for i in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp: return json.load(resp)
        except Exception as e:
            log.write(f"ERR {e} {url} {q}\n"); log.flush(); time.sleep(25*(i+1) if '429' in str(e) else 5*(i+1))
    return []
for kw in KW:
    for tile in tiles:
        res = get("https://nominatim.openstreetmap.org/search", {"q":kw,"format":"jsonv2","limit":50,"viewbox":",".join(map(str,tile)),"bounded":1,"accept-language":"ar,en","extratags":1,"namedetails":1,"addressdetails":1})
        n=0
        for x in res or []:
            k = x["osm_type"]+str(x["osm_id"])
            if k in seen: continue
            n+=1
            seen[k] = {"osm_type":x["osm_type"],"osm_id":x["osm_id"],"name":x.get("name"),"namedetails":x.get("namedetails",{}),"category":x.get("category"),"type":x.get("type"),"lat":float(x["lat"]),"lon":float(x["lon"]),"display_name":x.get("display_name"),"address":x.get("address",{}),"extratags":x.get("extratags",{}),"kw":kw,"city":city}
        log.write(f"{kw} {tile} -> {len(res or [])} new {n}\n"); log.flush()
        json.dump(list(seen.values()), open(out_path,"w"), ensure_ascii=False, indent=0)
        time.sleep(2.5)
log.write("DONE\n"); log.close()
print("done", len(seen))
