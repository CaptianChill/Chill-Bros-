// Industry profiles. Each profile decides WHAT to look for, WHICH variables matter,
// HOW MUCH each one weighs, and WHAT pitch fits that kind of business.
// Every factor returns 0-100; the final score is the weighted sum (0-100).

// Chill Pros home base (15226 Preston Pass, 78247). Used for drive-distance scoring.
export const BASE = { lat: 29.5868, lon: -98.4231, label: "Chill Pros base (78247)" };

// Greater San Antonio search box (Leon Valley/Helotes to Schertz/Converse, Stone Oak to Brooks).
export const SA_BOX = { south: 29.27, west: -98.75, north: 29.72, east: -98.22 };

const rx = (words) => new RegExp(`\\b(${words.join("|")})\\b`, "i");

// National/regional chains. They buy web and equipment service through corporate,
// so they are either excluded or heavily discounted.
export const AUTO_CHAINS = rx([
  "midas", "meineke", "jiffy lube", "firestone", "pep boys", "take 5", "valvoline", "christian brothers",
  "caliber", "maaco", "gerber", "discount tire", "big o", "goodyear", "ntb", "mavis", "monro", "aamco",
  "precision tune", "grease monkey", "service king", "carstar", "fix auto", "les schwab", "walmart",
  "costco", "sam'?s club", "brakes plus", "sun devil", "tire pros", "express oil", "kwik kar", "lube ?stop",
  "safelite", "o'?reilly", "autozone", "advance auto", "napa auto", "carmax", "toyota", "honda", "ford",
  "chevrolet", "nissan", "hyundai", "kia", "bmw of", "mercedes-benz of", "lexus", "subaru", "mazda",
  "jeep", "dodge", "brake check", "h-?e-?b", "swiftwater", "champions car wash", "go car wash", "club car wash", "racer", "wash tub", "mister car wash", "quick quack", "tommy'?s express", "whistle express", "take 5 car wash", "caliber collision", "christian brothers", "firestone", "jiffy", "volkswagen", "cadillac", "buick", "gmc", "acura", "infiniti", "audi", "porsche", "tesla",
  "abra", "car-?mart", "u-?haul", "enterprise", "hertz", "avis", "penske", "ryder", "tire kingdom", "conn'?s",
]);

export const FOOD_CHAINS = rx([
  "mcdonald'?s", "burger king", "wendy'?s", "whataburger", "sonic", "taco bell", "taco cabana", "chick-fil-a",
  "popeyes", "kfc", "church'?s", "subway", "jersey mike'?s", "jimmy john'?s", "firehouse subs", "domino'?s",
  "pizza hut", "papa john'?s", "little caesars", "starbucks", "dunkin", "panera", "chipotle", "qdoba",
  "panda express", "raising cane'?s", "wingstop", "buffalo wild wings", "applebee'?s", "chili'?s", "ihop",
  "denny'?s", "olive garden", "red lobster", "texas roadhouse", "outback", "longhorn", "cracker barrel",
  "golden corral", "cheesecake factory", "pf chang'?s", "p\\.f\\. chang'?s", "olive garden", "dairy queen",
  "braum'?s", "jack in the box", "carl'?s jr", "arby'?s", "zaxby'?s", "bill miller", "jason'?s deli",
  "mcalister'?s", "potbelly", "schlotzsky'?s", "smoothie king", "tropical smoothie", "dutch bros", "shipley",
  "krispy kreme", "baskin", "cold stone", "marble slab", "bahama buck'?s", "kolache factory", "torchy'?s",
  "chuy'?s", "pappasito'?s", "pappadeaux", "pappas", "twin peaks", "hooters", "bj'?s", "dave & buster'?s",
  "topgolf", "h-?e-?b", "walmart", "target", "costco", "sam'?s club", "whole foods", "trader joe'?s", "aldi",
  "sprouts", "kroger", "7-?eleven", "circle k", "valero", "stripes", "shell", "exxon", "chevron", "murphy",
  "buc-?ee'?s", "walgreens", "cvs", "dollar general", "family dollar", "dollar tree", "marriott", "hilton",
  "hampton inn", "holiday inn", "la quinta", "best western", "comfort inn", "comfort suites", "motel 6",
  "red roof", "days inn", "super 8", "embassy suites", "drury", "courtyard", "fairfield", "residence inn",
  "springhill", "homewood", "home2", "tru by", "candlewood", "staybridge", "extended stay", "wyndham",
  "quality inn", "sleep inn", "americas best value", "hyatt", "sheraton", "westin", "omni", "doubletree",
  "crowne plaza", "spec'?s", "total wine", "chuck e\\.? cheese", "cinemark", "regal", "golden chick",
  "pollo tropical", "el pollo loco", "little caesar'?s", "pluckers", "bubba gump", "landry'?s", "perry'?s", "fish city grill", "russo'?s", "mash'?d", "rock & brews", "taco palenque", "kung fu saloon", "flying saucer", "smashin crab", "bras[aã]o", "avenida brazil", "fogo de ch[aã]o", "texas de brazil", "ruth'?s chris", "fleming'?s", "kona grill", "yard house", "bj'?s restaurant", "twin peaks", "bombshells", "saltgrass", "pappasito'?s", "la madeleine", "luby'?s", "freebirds", "taco john'?s", "church'?s chicken", "bill miller", "pei wei", "wahlburgers", "salata", "cava", "sweetgreen", "first watch", "snooze", "shipley", "rudy'?s", "dickey'?s", "black rifle", "scooter'?s", "7 brew", "swig", "sonic", "wingstop", "rudy'?s", "black bear diner", "ihop", "whataburger",
]);

// Big boxes that never hire a local refrigeration contractor directly.
export const NEVER_FOOD = rx(["soap", "vape", "smoke shop", "tobacco", "pharmacy", "church", "ministry", "nail", "salon", "h-?e-?b", "walmart", "target", "costco", "sam'?s club", "whole foods", "trader joe'?s", "aldi", "kroger", "walgreens", "cvs", "dollar general", "family dollar", "dollar tree", "buc-?ee'?s"]);

// ---------------------------------------------------------------- AUTO: website services
export const autoWeb = {
  id: "auto_web",
  label: "Auto shops → website & lead-gen build (Brae web services)",
  offer: "Custom shop website + Google Business setup + quote form + lead alerts",
  overpass: (b) => `
    nwr["shop"~"^(car_repair|tyres|motorcycle_repair|car_parts)$"]["name"](${b});
    nwr["craft"~"^(car_repair|car_painter|upholsterer)$"]["name"](${b});
    nwr["amenity"="car_wash"]["name"](${b});`,
  tiles: 1,
  weights: { need: 0.30, value: 0.20, independence: 0.15, reach: 0.20, established: 0.10, proximity: 0.05 },
  excludeChains: true,
  chainRegex: AUTO_CHAINS,
  subtype(tags, name) {
    const s = `${name} ${tags.shop ?? ""} ${tags.craft ?? ""} ${tags.amenity ?? ""} ${tags.service ?? ""} ${Object.keys(tags).filter((k) => k.startsWith("service:vehicle:") && tags[k] === "yes").join(" ")}`.toLowerCase();
    if (/car_wash|car wash|wash\b|detail/.test(s)) return { kind: "Detailing / wash", value: 45, angle: "detail packages and memberships sell on photos and online booking" };
    if (/glass|windshield/.test(s)) return { kind: "Auto glass", value: 70, angle: "glass jobs are insurance-driven and booked online; a quote form wins them" };
    if (/collision|body|paint|car_painter|bodywork|hail|dent/.test(s)) return { kind: "Collision / body & paint", value: 100, angle: "insurance-claim and collision customers search 'body shop near me' and pick whoever has photos + a quote form" };
    if (/performance|custom|tuning|dyno|wrap|tint|ppf|vinyl|audio|lift|offroad|off-road|4x4|motorsport/.test(s)) return { kind: "Performance / custom / wrap", value: 100, angle: "build photos and video sell these jobs; a gallery site turns Instagram followers into booked builds" };
    if (/transmission|diesel|fleet|truck|heavy/.test(s)) return { kind: "Transmission / diesel / fleet", value: 90, angle: "big-ticket jobs and fleet accounts check you out online before they call" };
    if (/upholster|restoration|classic/.test(s)) return { kind: "Restoration / upholstery", value: 85, angle: "project customers want to see past restorations before trusting you with their car" };
    if (/motorcycle/.test(s)) return { kind: "Motorcycle repair", value: 75, angle: "riders research shops online; a site with services + booking wins the ride-in" };
    if (/tyre|tire|wheel/.test(s)) return { kind: "Tire & wheel", value: 60, angle: "tire shoppers compare price online; a site with a 'get a tire quote' form captures them" };
    if (/car_parts/.test(s)) return { kind: "Parts store", value: 35, angle: "local parts counter: a simple site with hours and inventory call-in" };
    if (/oil|lube|quick/.test(s)) return { kind: "Quick lube", value: 45, angle: "quick-service shops win on 'open now' searches and coupons" };
    return { kind: "General repair", value: 80, angle: "general repair lives on Google: a real site + review flow moves them up the map pack" };
  },
  // Need for the offer: the worse their web presence, the higher.
  need(web) {
    if (!web.listed) return { score: 88, notes: ["no website on its map listing (verify on Google)"] };
    if (web.socialOnly) return { score: 95, notes: [`"website" is only a ${web.socialOnly} page`] };
    if (!web.checked) return { score: 70, notes: ["website listed but not audited"] };
    if (!web.ok && web.error === "timed out") return { score: 60, notes: ["website slow/blocked our check (verify)"] };
    if (!web.ok) return { score: 95, notes: [`website is down/broken (${web.error ?? web.status})`] };
    let score = 15; const notes = [];
    if (!web.https) { score += 25; notes.push("no secure https"); }
    if (!web.mobile) { score += 30; notes.push("not mobile-friendly"); }
    if (web.copyrightYear && web.copyrightYear <= 2021) { score += 15; notes.push(`looks stale (© ${web.copyrightYear})`); }
    if (web.builder) { score += 10; notes.push(`DIY builder (${web.builder})`); }
    if (!web.leadCapture) { score += 15; notes.push("no quote/booking form"); }
    if (web.slowMs > 4000) { score += 10; notes.push(`slow (${(web.slowMs / 1000).toFixed(1)}s)`); }
    if (!notes.length) notes.push("has a decent modern site");
    return { score: Math.min(100, score), notes };
  },
};

// ---------------------------------------------------------------- CHILL PROS: commercial refrigeration & kitchen
export const chillCommercial = {
  id: "chill_commercial",
  label: "Chill Pros → walk-ins, freezers, ice machines, cooking equipment",
  offer: "Commercial refrigeration, ice machine and cooking-equipment repair + preventive maintenance plans",
  overpass: (b) => `
    nwr["amenity"~"^(restaurant|fast_food|cafe|bar|pub|biergarten|ice_cream|food_court|nursing_home)$"]["name"](${b});
    nwr["amenity"="social_facility"]["social_facility"~"^(nursing_home|assisted_living|group_home)$"]["name"](${b});
    nwr["shop"~"^(supermarket|convenience|butcher|seafood|deli|bakery|alcohol|beverages|frozen_food|greengrocer|florist|pastry|confectionery)$"]["name"](${b});
    nwr["tourism"~"^(hotel|motel)$"]["name"](${b});
    nwr["craft"~"^(brewery|winery|caterer)$"]["name"](${b});`,
  tiles: 2,
  weights: { load: 0.30, independence: 0.25, runtime: 0.15, proximity: 0.15, reach: 0.10, size: 0.05 },
  excludeChains: false, // franchisees sometimes pick local vendors; discount instead
  chainRegex: FOOD_CHAINS,
  neverRegex: NEVER_FOOD,
  subtype(tags, name) {
    const a = tags.amenity ?? "", s = tags.shop ?? "", t = tags.tourism ?? "", c = tags.craft ?? "";
    const cuisine = `${tags.cuisine ?? ""} ${name}`.toLowerCase();
    const eq = (kind, value, equipment, angle) => ({ kind, value, equipment, angle });
    if (s === "supermarket") return eq("Grocery / supermarket", 100, "walk-in coolers & freezers, display cases, rack systems, ice", "case and walk-in failures cost them inventory by the hour; sell a PM plan + 24/7 emergency line");
    if (s === "butcher" || s === "seafood" || s === "frozen_food") return eq("Meat / seafood market", 95, "walk-in cooler & freezer, display cases, ice machine (flake ice)", "product loss is their nightmare; offer walk-in temp checks and a flake-ice machine PM");
    if (c === "brewery" || c === "winery") return eq("Brewery / winery", 90, "glycol chillers, walk-in cold room, ice machine", "glycol and cold-room downtime ruins batches; offer chiller PM");
    if (c === "caterer") return eq("Caterer / commissary", 90, "walk-ins, reach-ins, ovens, steamers, holding cabinets", "commissary kitchens run hard; offer combined refrigeration + cooking-line PM");
    if (a === "nursing_home" || a === "social_facility") return eq("Senior living / care kitchen", 90, "walk-in cooler & freezer, ice machines, ovens, dish machine", "regulated kitchens can't go down; sell a quarterly PM with documented temps");
    if (a === "ice_cream" || /ice cream|paleteria|raspa|gelato|frozen yogurt|yogurt/.test(cuisine)) return eq("Ice cream / paletería", 85, "dipping cabinets, freezers, walk-in freezer, soft-serve", "freezer failures melt the whole product line; sell freezer PM + fast response");
    if (/sushi|seafood|fish|poke|oyster|crawfish|cajun/.test(cuisine)) return eq("Seafood / sushi restaurant", 95, "ice machines, walk-in, sushi cases, reach-ins", "they burn through ice and cold storage; open with an ice machine cleaning + walk-in check");
    if (/bbq|barbecue|steak|smokehouse|brisket/.test(cuisine)) return eq("BBQ / steakhouse", 92, "walk-in cooler & freezer, smokers, ranges, ice machine", "meat inventory lives in the walk-in; offer walk-in PM + smoker/range service");
    if (a === "bar" || a === "pub" || a === "biergarten" || /cantina|icehouse|(?<!espresso |coffee |juice |salad )bar\b|tavern|saloon|pub\b/.test(cuisine)) return eq("Bar / icehouse", 88, "ice machines, bar coolers, keg walk-in, glass froster", "no ice = no sales on a Friday; lead with ice machine cleaning + emergency service");
    if (/mexican|tex-mex|tex_mex|taco|taqueria|latin|salvador|cuban|peruvian|seafood/.test(cuisine)) return eq("Mexican / Tex-Mex restaurant", 86, "ice machine (margaritas/drinks), walk-in, flat-tops, fryers, steam tables", "busy lines + margarita ice; offer an ice machine & walk-in PM package");
    if (s === "bakery" || s === "pastry" || s === "confectionery" || /bakery|panaderia|donut|kolache/.test(cuisine)) return eq("Bakery / panadería", 80, "deck/convection ovens, proofers, walk-in, reach-ins", "oven and proofer downtime kills the morning bake; offer oven + walk-in service");
    if (s === "deli") return eq("Deli", 78, "deli cases, walk-in, slicers' refrigerated prep", "case temps are inspected; offer case + walk-in PM");
    if (a === "restaurant" || a === "food_court") return eq("Full-service restaurant", 82, "walk-in cooler & freezer, ice machine, reach-ins, ranges, fryers, ovens", "full kitchens have every piece we fix; offer a full-kitchen PM walk-through");
    if (t === "hotel") return eq("Hotel", 75, "ice machines on each floor, kitchen/breakfast refrigeration, PTAC/HVAC", "every floor has an ice machine; sell a property-wide ice machine PM contract");
    if (a === "fast_food") return eq("Fast food / quick-serve", 72, "fryers, flat-tops, reach-ins, walk-in, ice machine", "quick-serve lines can't stop; offer emergency fryer/refrigeration service");
    if (s === "alcohol" || s === "beverages") return eq("Liquor / beverage store", 72, "walk-in beer cave, reach-in doors, ice merchandiser", "the beer cave is the money-maker; offer walk-in PM before summer");
    if (s === "convenience") return eq("Convenience store", 66, "walk-in beer cave, reach-in doors, ice merchandiser, roller grill", "walk-in coolers and ice boxes run 24/7; offer a beer-cave PM");
    if (t === "motel") return eq("Motel", 55, "ice machines, PTAC units", "ice machines + room units; offer a property PM");
    if (a === "cafe") return eq("Café / coffee shop", 58, "ice machine, reach-ins, espresso area refrigeration, ovens", "iced drinks need a healthy ice machine; offer cleaning + reach-in service");
    if (s === "greengrocer") return eq("Produce market", 75, "walk-in cooler, produce cases", "produce lives in the walk-in; offer walk-in PM");
    if (s === "florist") return eq("Florist", 55, "floral walk-in cooler, display coolers", "flowers die when the cooler does; offer floral cooler PM");
    return eq("Food business", 60, "refrigeration / kitchen equipment", "offer a free equipment walk-through");
  },
};

export const PROFILES = { auto_web: autoWeb, chill_commercial: chillCommercial };
