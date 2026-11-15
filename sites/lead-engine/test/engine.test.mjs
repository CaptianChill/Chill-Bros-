import assert from "node:assert";
import { scoreLead, normalize, auditHtml } from "../api/_engine.js";
import { PROFILES } from "../api/_profiles.js";
const auto = PROFILES.auto_web, chill = PROFILES.chill_commercial;
const L = (tags, lat=29.5, lon=-98.45) => normalize({ type: "node", id: Math.random()*1e6|0, lat, lon, tags });
// Auto: no-website collision shop beats a modern-site tire shop
const a1 = scoreLead(auto, L({ name: "Pena Auto Body", craft: "car_painter", phone: "1", "addr:street":"Grissom", opening_hours:"Mo-Fr 08:00-17:00" }), { listed: false });
const modern = auditHtml('<html><head><meta name="viewport"><title>x</title></head><form>Request a quote</form>© 2026'.padEnd(500,' '), "https://x.com", 900);
const a2 = scoreLead(auto, L({ name: "Joe Tires", shop: "tyres", phone: "1", website: "https://x.com" }), { listed: true, ...modern });
const a3 = scoreLead(auto, L({ name: "Midas", shop: "car_repair", phone: "1" }), { listed: false });
console.log(a1.score, a1.grade, a1.why, "\n", a2.score, a2.why, "\n", a3.score, a3.excluded);
assert(a1.score > a2.score + 25); assert(a3.excluded);
// Chill: independent sushi near base beats Whataburger far away; HEB excluded
const c1 = scoreLead(chill, L({ name: "Sushi Zushi Local", amenity: "restaurant", cuisine: "sushi", phone: "1", opening_hours: "Mo-Su 11:00-23:00" }, 29.58, -98.43), { listed: false });
const c2 = scoreLead(chill, L({ name: "Whataburger", amenity: "fast_food", brand: "Whataburger", opening_hours: "24/7" }, 29.30, -98.70), { listed: false });
const c3 = scoreLead(chill, L({ name: "H-E-B", shop: "supermarket" }), { listed: false });
console.log(c1.score, c1.type, c1.why, "\n", c2.score, c2.why, "\n", c3.score, c3.excluded);
assert(c1.score > c2.score + 20); assert(c3.excluded);
console.log("PITCH:", a1.pitch, "\nPITCH:", c1.pitch);
console.log("all tests passed");
