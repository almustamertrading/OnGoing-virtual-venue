import json,sys,re,math,csv,os,glob
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from curated import C; from overrides import O
OUT=sys.argv[1]; RAW=sys.argv[2] if len(sys.argv)>2 else os.path.join(OUT,"raw")
BOX={"riyadh":(46.15,24.35,47.10,25.15),"jeddah":(38.95,21.25,39.45,21.95),"eastern":(49.85,26.05,50.30,26.65)}
CITY_AR={"riyadh":"الرياض","jeddah":"جدة","dammam":"الدمام","khobar":"الخبر","dhahran":"الظهران","qatif":"القطيف"}
CAT_AR={"exhibition":"مركز معارض","conference":"مركز مؤتمرات","arena":"صالة/أرينا","stadium":"استاد/ملعب","theatre":"مسرح/مركز ثقافي","hall":"قاعة مناسبات","hotel":"فندق (قاعات)","entertainment":"وجهة ترفيهية","outdoor":"موقع مفتوح/حديقة"}
def dist(a,b,c,d):
    return math.hypot((a-c)*111.0,(b-d)*111.0*math.cos(math.radians(a)))*1000
def sub_city(lat,lon,key):
    if key!="eastern": return key
    pts={"dammam":(26.43,50.10),"khobar":(26.28,50.20),"dhahran":(26.30,50.13),"qatif":(26.56,50.00)}
    return min(pts,key=lambda k:dist(lat,lon,*pts[k]))
rows=[]
# 1. curated
for c in C:
    o=O.get(c["name_en"],"nokey")
    if o is None: continue
    if o=="nokey":
        if c["ll"]: lat,lon,prec=c["ll"][0],c["ll"][1],"exact"
        else: continue
    else: lat,lon,prec=o
    rows.append(dict(name_ar=c["name_ar"],name_en=c["name_en"],city=sub_city(lat,lon,c["city"]),category=c["category"],lat=round(lat,6),lon=round(lon,6),precision=prec,capacity=c.get("capacity"),note=c.get("note",""),source="curated",tier="major"))
# 2. wikidata stadiums etc
for f in ["stadium","arena","sports_venue","amusement_park2","concert_hall"]:
    p=os.path.join(RAW,f"wd_{f}.json")
    if not os.path.exists(p): continue
    try: b=json.load(open(p))["results"]["bindings"]
    except Exception: continue
    seen=set()
    for x in b:
        if x["item"]["value"] in seen: continue
        seen.add(x["item"]["value"])
        m=re.match(r"Point\(([-\d.]+) ([-\d.]+)\)",x["coord"]["value"]); lon,lat=float(m.group(1)),float(m.group(2))
        key=next((k for k,(a,bb,c2,d) in BOX.items() if a<=lon<=c2 and bb<=lat<=d),None)
        if not key: continue
        cat={"stadium":"stadium","arena":"arena","sports_venue":"arena","amusement_park2":"entertainment","concert_hall":"theatre"}[f]
        rows.append(dict(name_ar=x.get("ar",{}).get("value") or x.get("en",{}).get("value"),name_en=x.get("en",{}).get("value") or x.get("ar",{}).get("value"),city=sub_city(lat,lon,key),category=cat,lat=round(lat,6),lon=round(lon,6),precision="exact",capacity=int(float(x["capacity"]["value"])) if x.get("capacity") else None,note="",source="wikidata:"+x["item"]["value"].rsplit("/",1)[1],tier="major"))
# 3. OSM harvest (nominatim + photon)
EXCL_TYPES={"playground","pitch","fitness_centre","residential","living_street","primary","secondary","tertiary","trunk","motorway","service","unclassified","footway","village","hamlet","locality","suburb","neighbourhood","quarter","city","town","island","station","stop","platform","bus_stop","parking","restaurant","cafe","fast_food","school","kindergarten","hospital","clinic","pharmacy","doctors","dentist","hospice","car_repair","car","supermarket","convenience","bakery","houseware","department_store","clothes","bookmaker","fuel","bank","atm","place_of_worship","mosque","tower","artwork","ruins","quarry","construction","bay","beach","water","farmland","industrial","company","diplomatic","association","government","estate_agent","hairdresser","car_rental","car_wash","tyres","car_parts","furniture","electronics","mobile_phone","jewelry","perfumery","beauty","dormitory","apartments","house","residential","yes_road"}
KW_HALL=re.compile(r"قاعة|قاعات|صالة|صالات|احتفال|مناسب|أفراح|افراح|قصر الأفراح|قصر الافراح|ballroom|wedding|banquet|celebration|\bhall\b|\bhalls\b",re.I)
KW_EXPO=re.compile(r"معارض|معرض|exhibition|expo\b|exhibit",re.I)
KW_CONF=re.compile(r"مؤتمر|conference|convention|forum|منتدى",re.I)
KW_ARENA=re.compile(r"(^|[\s\-])(أرينا|ارينا|الأرينا|الارينا)([\s\-]|$)|\barenas?\b|superdome|سوبردوم|سوبر دوم",re.I)
KW_THEATRE=re.compile(r"مسرح|theat|auditorium|opera|أوبرا|ثقافي|cultural|arts cent|فنون",re.I)
KW_STAD=re.compile(r"استاد|إستاد|\bstadium|مدينة .* الرياضية|sports city|ملعب (نادي|الأمير|الملك|جامعة|مدينة|الشيخ)|الصالة الخضراء|green hall",re.I)
KW_EVENT=re.compile(r"فعاليات|events?\b|مهرجان|festival|season|موسم|بوليفارد|boulevard",re.I)
CAR=re.compile(r"سيارات|سياره|cars?\b|motor|auto|مركبات|شاحنات|أثاث|اثاث|furniture|مفروشات|عقار|real estate|محل|متجر|showroom",re.I)
HARD={"station","stop","platform","bus_stop","parking","transportation","playground","pitch","garden","school","kindergarten","college","university","hospital","clinic","hospice","car_repair","supermarket","convenience","bakery","houseware","department_store","clothes","bookmaker","fuel","bank","artwork","tower","ruins","quarry","construction","bay","beach","water","residential","apartments","house","dormitory","restaurant","cafe","fast_food","mosque","place_of_worship","motorway","primary","secondary","tertiary","trunk","service","footway","living_street","unclassified","village","hamlet","locality","suburb","neighbourhood","quarter","city","town","island","company","diplomatic","association","government","educational_institution"}
OUTDOOR_OK=re.compile(r"منتزه|متنزه|كورنيش|corniche|واجهة|front|الملك|الأمير|king|prince|national|وطني|بوليفارد|boulevard|season|موسم|مهرجان|فعاليات|زوو|zoo|حيوان",re.I)
def classify(name,key,val):
    n=name or ""
    if val in HARD and not (val=="school" and False): return None
    if val in ("stadium",) or KW_STAD.search(n): return "stadium"
    if val in ("events_venue","wedding_hall"): return "hall"
    if val=="exhibition_centre": return "exhibition"
    if val=="conference_centre": return "conference"
    if val in ("theatre","arts_centre","cinema") or KW_THEATRE.search(n): return "theatre"
    if KW_ARENA.search(n): return "arena"
    if KW_EXPO.search(n) and not CAR.search(n): return "exhibition"
    if KW_CONF.search(n): return "conference"
    if KW_HALL.search(n) and not CAR.search(n): return "hall"
    if val in ("theme_park","attraction","mall","zoo","water_park","amusement_arcade","resort") : return "entertainment"
    if val in ("park","garden","nature_reserve") and n: return "outdoor"
    if val in ("hotel",) and (KW_CONF.search(n) or KW_HALL.search(n)): return "hotel"
    if val in ("sports_centre","sports_hall") and re.search(r"صالة|hall|arena",n,re.I): return "arena"
    if val in ("community_centre","club","social_centre","community_center") and (KW_HALL.search(n) or KW_EVENT.search(n)): return "hall"
    if KW_EVENT.search(n) and val not in EXCL_TYPES: return "entertainment"
    return None
osm=[]
for f in glob.glob(os.path.join(RAW,"*_osm.json"))+glob.glob(os.path.join(RAW,"*_photon.json")):
    key=os.path.basename(f).split("_")[0]
    for x in json.load(open(f)):
        val=x.get("type") or x.get("osm_value"); k=x.get("category") or x.get("osm_key")
        if val in EXCL_TYPES and not (x.get("name") and (KW_HALL.search(x["name"]) or KW_EXPO.search(x["name"]) or KW_STAD.search(x["name"]) or KW_ARENA.search(x["name"]))): continue
        if k in ("highway","railway","place","natural","landuse","man_made","boundary","waterway","power") and val not in ("commercial","retail","raceway"): 
            if not (x.get("name") and (KW_HALL.search(x["name"]) or KW_EXPO.search(x["name"]))) : continue
        if k=="highway" and val!="raceway": continue
        if k=="place": continue
        name=x.get("name")
        if not name: continue
        cat=classify(name,k,val)
        if not cat: continue
        if cat=="outdoor" and (not OUTDOOR_OK.search(name) or re.search(r"حديقة حي|حديقة الحي",name)): continue
        if cat=="stadium" and re.search(r"أطفال|اطفال|children|kids|مواقف|parking",name,re.I): continue
        nd=x.get("namedetails") or {}
        osm.append(dict(name_ar=nd.get("name:ar") or name,name_en=nd.get("name:en") or ("" if re.search(r"[؀-ۿ]",name) else name),city=sub_city(x["lat"],x["lon"],key),category=cat,lat=round(x["lat"],6),lon=round(x["lon"],6),precision="exact",capacity=None,note=(x.get("address",{}) or {}).get("suburb") or (x.get("address",{}) or {}).get("neighbourhood") or x.get("district") or "",source=f"osm:{x['osm_type'][0] if len(x['osm_type'])>1 else x['osm_type']}{x['osm_id']}",tier="osm",osm_tag=f"{k}={val}"))
# dedupe OSM by ref and against curated by proximity+name similarity
def norm(s): return re.sub(r"[^\w؀-ۿ]+","",(s or "").lower())
seen=set(); out=list(rows)
for o in osm:
    if o["source"] in seen: continue
    seen.add(o["source"])
    dup=False
    for r in rows:
        d=dist(o["lat"],o["lon"],r["lat"],r["lon"])
        if d<60: dup=True;break
        if d<400 and (norm(o["name_ar"]) and (norm(o["name_ar"]) in norm(r["name_ar"]) or norm(r["name_ar"]) in norm(o["name_ar"]) or (o["name_en"] and (norm(o["name_en"]) in norm(r["name_en"]) or norm(r["name_en"]) in norm(o["name_en"]))))): dup=True;break
    if not dup: out.append(o)
# also dedupe osm vs osm by same name within 100m
final=[]
for o in out:
    if o["tier"]=="osm" and any(f["tier"]=="osm" and norm(f["name_ar"])==norm(o["name_ar"]) and dist(o["lat"],o["lon"],f["lat"],f["lon"])<150 for f in final): continue
    final.append(o)
for i,r in enumerate(final,1):
    r["id"]=i; r["city_ar"]=CITY_AR.get(r["city"],r["city"]); r["category_ar"]=CAT_AR[r["category"]]
    r["maps"]=f"https://www.google.com/maps/search/?api=1&query={r['lat']},{r['lon']}"
    if r["source"].startswith("osm:"):
        t={"n":"node","w":"way","r":"relation","N":"node","W":"way","R":"relation"}[r["source"][4]]; r["ref_url"]=f"https://www.openstreetmap.org/{t}/{r['source'][5:]}"
    elif r["source"].startswith("wikidata:"): r["ref_url"]=f"https://www.wikidata.org/wiki/{r['source'][9:]}"
    else: r["ref_url"]=""
os.makedirs(OUT,exist_ok=True)
json.dump(final,open(f"{OUT}/venues.json","w"),ensure_ascii=False,indent=1)
open(f"{OUT}/venues.js","w").write("window.VENUES="+json.dumps(final,ensure_ascii=False)+";")
gj={"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[r["lon"],r["lat"]]},"properties":{k:v for k,v in r.items() if k not in("lat","lon")}} for r in final]}
json.dump(gj,open(f"{OUT}/venues.geojson","w"),ensure_ascii=False)
with open(f"{OUT}/venues.csv","w",newline="",encoding="utf-8-sig") as fh:
    w=csv.DictWriter(fh,fieldnames=["id","name_ar","name_en","city","city_ar","category","category_ar","lat","lon","precision","capacity","note","tier","source","ref_url","maps"],extrasaction="ignore"); w.writeheader(); [w.writerow(r) for r in final]
from collections import Counter
print("total",len(final)); print(Counter(r["city"] for r in final)); print(Counter(r["category"] for r in final)); print(Counter(r["tier"] for r in final))
