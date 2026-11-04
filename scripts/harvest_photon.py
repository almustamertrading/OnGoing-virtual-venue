import json, sys, time, urllib.request, urllib.parse, os
CITIES = {
  "riyadh":  dict(box=(46.15,24.35,47.10,25.15)),   # minlon,minlat,maxlon,maxlat
  "jeddah":  dict(box=(38.95,21.25,39.45,21.95)),
  "eastern": dict(box=(49.85,26.05,50.30,26.65)),
}
KW = ["قاعة","قاعات","صالة","صالات","قصر أفراح","قصر","أفراح","احتفالات","مناسبات","فعاليات","معارض","مركز معارض","مركز مؤتمرات","مؤتمرات","استاد","ملعب","مسرح","مدينة ترفيهية","أرينا","بوليفارد","مركز ثقافي","مركز","دوم","مهرجان","استراحة","منتجع","شاليه","نادي","حديقة","متنزه",
      "hall","ballroom","wedding","celebration","events","event","exhibition","convention","conference","arena","stadium","theatre","theater","auditorium","dome","pavilion","expo","forum","boulevard","cultural","opera","centre","center","sports city","park","resort","club","venue","season","festival"]
city=sys.argv[1]; out=sys.argv[2];
if len(sys.argv)>4: KW=[l.strip() for l in open(sys.argv[4],encoding="utf-8") if l.strip()]  # KWFILE
minlon,minlat,maxlon,maxlat=CITIES[city]["box"]
tiles=[]
n=int(sys.argv[3]) if len(sys.argv)>3 else 6
for i in range(n):
    for j in range(n):
        tiles.append((minlon+(maxlon-minlon)*j/n, minlat+(maxlat-minlat)*i/n, minlon+(maxlon-minlon)*(j+1)/n, minlat+(maxlat-minlat)*(i+1)/n))
seen={}
if os.path.exists(out):
    for x in json.load(open(out)): seen[x["osm_type"]+str(x["osm_id"])]=x
log=open(out+".log","a")
def get(params):
    url="https://photon.komoot.io/api/?"+urllib.parse.urlencode(params)
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"venue-research-script/1.0"}),timeout=60) as r: return json.load(r)
        except Exception as e:
            log.write(f"ERR {e} {url}\n"); log.flush(); time.sleep(5*(i+1))
    return {"features":[]}
for kw in KW:
    for t in tiles:
        d=get({"q":kw,"limit":50,"bbox":",".join(f"{v:.4f}" for v in t)})
        new=0; tot=0
        for f in d.get("features",[]):
            p=f["properties"]; x,y=f["geometry"]["coordinates"]
            if not (minlon<=x<=maxlon and minlat<=y<=maxlat): continue
            tot+=1
            k=p.get("osm_type","")+str(p.get("osm_id"))
            if k in seen: continue
            new+=1
            seen[k]={"osm_type":p.get("osm_type"),"osm_id":p.get("osm_id"),"name":p.get("name"),"osm_key":p.get("osm_key"),"osm_value":p.get("osm_value"),"type":p.get("type"),"lat":y,"lon":x,"city_osm":p.get("city"),"district":p.get("district"),"street":p.get("street"),"state":p.get("state"),"kw":kw,"city":city,"src":"photon"}
        log.write(f"{kw} {t} -> {tot} new {new}\n"); log.flush()
        time.sleep(0.25)
    json.dump(list(seen.values()),open(out,"w"),ensure_ascii=False,indent=0)
log.write("DONE\n"); print("done",len(seen))
