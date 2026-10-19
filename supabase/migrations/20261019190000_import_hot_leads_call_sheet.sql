-- Imports the 32 leads from the owner's "Hot Leads Call Sheet" (a separate
-- Claude artifact the owner worked from before this table existed) into Revenue
-- Radar's existing lead table. These are documented guest-review equipment
-- signals, not automated map-discovery matches, so they use the
-- 'equipment_failure' category (source_url points to a Google Maps search for
-- the business so the signal can be verified against a real, current listing).
-- Idempotent: re-running this file is a no-op once the rows exist, because
-- normalized_key is unique per business/city/category/source.
insert into public.chillbros_revenue_prospects (
  business_name, city, category, service_line, signal_summary, source_url, signal_observed_at, signal_verified, normalized_key, score, status, contact_name, contact_role, contact_email, contact_phone, email_subject, email_draft, business_address, priority, verification_status, created_by, updated_by
) values
  ('Best Western Plus Atrium Inn', 'Schertz', 'equipment_failure', 'hvac_r', 'A December 2025 guest said the room AC only worked half the time. Pitch repair of intermittent room units and a PM plan. Guest said: "AC didn''t work half the time". Best time to call: Typical for hotels: weekdays 9-11 AM, when the chief engineer/GM works day shift. Avoid 3-6 PM check-in rush. Imported from the Hot Leads Call Sheet (rank 31/32, warm priority, Hotel, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Best%20Western%20Plus%20Atrium%20Inn%2017401%20I-35%20North%2C%20Schertz%2C%20TX%2078154', '2026-10-19T12:24:28Z', false, 'best western plus atrium inn|schertz|equipment_failure|https://www.google.com/maps/search/?api=1&query=best%20western%20plus%20atrium%20inn%2017401%20i-35%20north%2c%20schertz%2c%20tx%2078154', 72, 'new', 'Yogesh Upadhyaya, General Manager', 'Chief engineer or general manager', '44683@hotel.bestwestern.com', '(210) 651-4100', 'Room AC repair and maintenance for Best Western Plus Atrium Inn', 'Hello Yogesh,

I''m with Chill Pros, a local San Antonio HVAC and refrigeration company. Hotels often have a few room AC units that work some of the time and then quit, usually from a failing capacitor, a dirty coil freezing up, or a bad control board. Those intermittent rooms are frustrating because they test fine until the next guest checks in.

We offer same-day repairs, can be your overflow or backup contractor when your maintenance team is busy, and run preventive maintenance plans for room units, ice machines and breakfast refrigeration.

We''d be glad to do a free walk-through and give you a written list of anything that needs attention. Would a morning next week work for a quick visit?

Chill Pros
chillprostx@gmail.com', '17401 I-35 North, Schertz, TX 78154', 'normal', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Best Western SeaWorld San Antonio', 'San Antonio', 'equipment_failure', 'hvac_r', 'A July 2026 guest reported the room AC not working right; a promised repair or room move never happened. Pitch backup repair service so room calls get closed out. Guest said: "they said they would send someone to fix it". Best time to call: Typical for hotels: weekdays 9-11 AM, when the chief engineer/GM works day shift. Avoid 3-6 PM check-in rush. Imported from the Hot Leads Call Sheet (rank 28/32, warm priority, Hotel, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Best%20Western%20SeaWorld%20San%20Antonio%201605%20W%20Loop%201604%20S%2C%20San%20Antonio%2C%20TX%2078245', '2026-10-19T12:24:28Z', false, 'best western seaworld san antonio|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=best%20western%20seaworld%20san%20antonio%201605%20w%20loop%201604%20s%2c%20san%20antonio%2c%20tx%2078245', 72, 'new', NULL, 'Chief engineer or general manager', NULL, '(210) 562-3065', 'Backup AC repair service for Best Western SeaWorld', 'Hello,

In busy summer months, hotel maintenance teams often can''t get to every room AC call the same day, and a guest who''s told someone is coming and nobody shows usually ends up writing about it.

Chill Pros is a local San Antonio HVAC and refrigeration company. We offer same-day repairs, can act as your overflow or backup contractor when your own team is stretched, and set up preventive maintenance plans that catch these problems before guests do.

We''d be glad to do a free walk-through of your units and give you a written list of anything that needs attention. Would a quick visit one morning next week work for you?

Chill Pros
chillprostx@gmail.com', '1605 W Loop 1604 S, San Antonio, TX 78245', 'normal', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('The Camaron Townhomes & Flats', 'San Antonio', 'equipment_failure', 'hvac_r', 'Resident says the unit hits 80°F+ in the afternoon because the AC can''t keep up. Ask who handles HVAC for Reep Residential''s San Antonio properties. Guest said: "At 2pm on a 90 degree day, it is 80 degrees plus in our apartment". Best time to call: Mon-Fri 9:30-11 AM. Leasing office is open Mon-Fri 8:30 AM-5:30 PM and closed weekends (per ForRent listing, which shows (726) 238-8243 for the office). Managed by: Reep Residential (per HAR.com listing). Alternate phone: (888) 560-7692. Imported from the Hot Leads Call Sheet (rank 9/32, hot priority, Apartments, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=The%20Camaron%20Townhomes%20%26%20Flats%206020%20Danny%20Kaye%20Dr%2C%20San%20Antonio%2C%20TX%2078240', '2026-10-13T00:00:00Z', false, 'the camaron townhomes flats|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=the%20camaron%20townhomes%20%26%20flats%206020%20danny%20kaye%20dr%2c%20san%20antonio%2c%20tx%2078240', 71, 'new', NULL, 'Property manager or maintenance supervisor', NULL, '(888) 469-0058', 'AC units that can''t keep up in the afternoon', 'Hello,

I''m with Chill Pros, a local HVAC company in San Antonio. When apartments run hot in the afternoon, the cause is usually low refrigerant, dirty coils, leaky ductwork or units that are undersized for the space, and it''s much cheaper to fix before next summer than during it.

We can run capacity checks on your problem units, handle overflow repairs at a flat rate, and quote replacements where they make sense.

Would you be open to a free walk-through this week?

Chill Pros
chillprostx@gmail.com', '6020 Danny Kaye Dr, San Antonio, TX 78240', 'high', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Comfort Suites San Antonio North - Stone Oak', 'San Antonio', 'equipment_failure', 'hvac_r', 'A March 2026 guest says the in-room AC unit is loud and leaves the room unevenly cooled. Pitch PTAC servicing and replacement of worn units. Guest said: "window AC unit is LOUD and creates a major temperature imbalance". Best time to call: Typical for hotels: weekdays 9-11 AM, when the GM and maintenance lead work day shift. Avoid 3-6 PM check-in rush. Imported from the Hot Leads Call Sheet (rank 21/32, warm priority, Hotel, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Comfort%20Suites%20San%20Antonio%20North%20-%20Stone%20Oak%201754%20N%20Loop%201604%20E%2C%20San%20Antonio%2C%20TX%2078232', '2026-10-14T02:05:00Z', false, 'comfort suites san antonio north stone oak|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=comfort%20suites%20san%20antonio%20north%20-%20stone%20oak%201754%20n%20loop%201604%20e%2c%20san%20antonio%2c%20tx%2078232', 65, 'new', 'Lajuan Williams, Sales Manager (per Northstar Meetings Group listing)', 'Chief engineer or general manager', NULL, '(210) 939-5586', 'In-room AC (PTAC) service for Comfort Suites Stone Oak', 'Hello,

I''m with Chill Pros, a local HVAC and refrigeration company. In-room PTAC units get loud as they age and often leave rooms cold by the unit and warm across the room, which shows up fast in guest reviews.

We service and replace PTACs for San Antonio hotels: cleaning coils, fixing fan and compressor noise, and swapping out units that can''t keep up. We do same-day repairs and can also be your backup contractor when your maintenance team is busy.

Would you be open to a free walk-through of a few rooms your staff has flagged?

Chill Pros
chillprostx@gmail.com', '1754 N Loop 1604 E, San Antonio, TX 78232', 'normal', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Days Inn by Wyndham San Antonio Northwest/SeaWorld', 'San Antonio', 'equipment_failure', 'hvac_r', 'An August 2026 guest found a pool of water next to the room AC unit. Pitch leak/drain-line repair and PM on room units. Guest said: "a pool of water next to the AC unit". Best time to call: Typical for hotels: weekdays 9-11 AM, when the chief engineer/GM works day shift. Avoid 3-6 PM check-in rush. Imported from the Hot Leads Call Sheet (rank 24/32, hot priority, Hotel, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Days%20Inn%20by%20Wyndham%20San%20Antonio%20Northwest%2FSeaWorld%206010%20NW%20Loop%20410%2C%20San%20Antonio%2C%20TX%2078238', '2026-10-19T12:24:28Z', false, 'days inn by wyndham san antonio northwest seaworld|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=days%20inn%20by%20wyndham%20san%20antonio%20northwest%2fseaworld%206010%20nw%20loop%20410%2c%20san%20antonio%2c%20tx%2078238', 78, 'new', NULL, 'Chief engineer or general manager', 'daysinnseaworld@gmail.com', '(210) 465-1250', 'Leaking room AC units? Local repair for Days Inn NW/SeaWorld (please forward to maintenance)', 'Hello,

Could you please forward this to your chief engineer or maintenance lead? Thank you!

One of the most common hotel calls we get is a room AC unit leaking water onto the floor, usually from a clogged drain line or a frozen coil. It damages carpet and drywall fast and is usually a quick fix.

Chill Pros is a local San Antonio HVAC and refrigeration company. We offer same-day repairs, can act as your overflow or backup contractor when your own team is stretched, and set up preventive maintenance plans that catch these problems before guests do.

We''d be glad to do a free walk-through of your units and give you a written list of anything that needs attention. Would a quick visit one morning next week work for you?

Chill Pros
chillprostx@gmail.com', '6010 NW Loop 410, San Antonio, TX 78238', 'high', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Days Inn by Wyndham San Antonio Near Fiesta Park', 'San Antonio', 'equipment_failure', 'refrigeration', 'Guest said the mini fridge barely kept drinks cold. Guest said: "Mini fridge barely kept our drinks cold". Best time to call: Typical for hotels: weekdays 9-11 AM, when the maintenance lead and GM work day shift. Avoid 3-6 PM check-in rush. Imported from the Hot Leads Call Sheet (rank 19/32, warm priority, Hotel, cold-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Days%20Inn%20by%20Wyndham%20San%20Antonio%20Near%20Fiesta%20Park%2011790%20I-10%2C%20San%20Antonio%2C%20TX%2078230', '2026-10-13T00:00:00Z', false, 'days inn by wyndham san antonio near fiesta park|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=days%20inn%20by%20wyndham%20san%20antonio%20near%20fiesta%20park%2011790%20i-10%2c%20san%20antonio%2c%20tx%2078230', 65, 'new', NULL, 'General manager', NULL, '(210) 853-5644', 'In-room fridge and AC maintenance for your hotel', 'Hello,

I''m with Chill Pros, a local HVAC and refrigeration company. Mini fridges and in-room AC units that barely keep up are usually dirty coils or worn parts, and a quick maintenance pass fixes most of them for a fraction of replacement cost.

I''d be glad to check a few rooms for free and give you a price for servicing the rest.

Would this week work for a quick visit?

Chill Pros
chillprostx@gmail.com', '11790 I-10, San Antonio, TX 78230', 'normal', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Embassy Suites by Hilton San Antonio Airport', 'San Antonio', 'equipment_failure', 'hvac_r', 'Guest says room AC was only lukewarm and maintenance blamed the chiller. Chiller work is a big-ticket job. Guest said: "The AC was only luke cool... the maintenance guy said the chiller was supposed to..". Best time to call: Typical for full-service hotels: Tue-Thu 9-11 AM, when the chief engineer works day shift. Avoid 3-6 PM check-in rush. Imported from the Hot Leads Call Sheet (rank 2/32, hot priority, Hotel, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Embassy%20Suites%20by%20Hilton%20San%20Antonio%20Airport%2010110%20US-281%2C%20San%20Antonio%2C%20TX%2078216', '2026-10-13T00:00:00Z', false, 'embassy suites by hilton san antonio airport|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=embassy%20suites%20by%20hilton%20san%20antonio%20airport%2010110%20us-281%2c%20san%20antonio%2c%20tx%2078216', 71, 'new', 'Cassandra Goodyear, Director of Sales & Marketing', 'Chief engineer or director of engineering', NULL, '(210) 525-9999', 'Backup chiller and HVAC support for Embassy Suites San Antonio Airport', 'Hello,

I''m with Chill Pros, a local commercial HVAC and refrigeration company. We support San Antonio hotels as a backup contractor when the engineering team needs extra hands, especially on chiller, air handler and in-room unit problems that leave guests with rooms that won''t cool.

We offer same-day response, overflow help during busy weekends, and preventive maintenance so cooling problems are caught before guests notice. We also service kitchen refrigeration and ice machines.

Could I schedule a free walk-through with your chief engineer this week? If this isn''t your area, I''d appreciate you forwarding it to them.

Chill Pros
chillprostx@gmail.com', '10110 US-281, San Antonio, TX 78216', 'high', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Extended Stay America Suites - San Antonio Airport', 'San Antonio', 'equipment_failure', 'refrigeration', 'Guest reported a rusty refrigerator and worn rooms. Extended stays have full kitchens in every room, which means lots of fridges to service. Guest said: "rusty refrigerator". Best time to call: Typical for extended-stay hotels: weekdays 9-11 AM. The general manager usually works weekday days; there is no full-time engineer. Imported from the Hot Leads Call Sheet (rank 17/32, warm priority, Hotel, cold-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Extended%20Stay%20America%20Suites%20-%20San%20Antonio%20Airport%201015%20Central%20Pkwy%20S%2C%20San%20Antonio%2C%20TX%2078232', '2026-10-13T00:00:00Z', false, 'extended stay america suites san antonio airport|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=extended%20stay%20america%20suites%20-%20san%20antonio%20airport%201015%20central%20pkwy%20s%2c%20san%20antonio%2c%20tx%2078232', 65, 'new', NULL, 'General manager', NULL, '(210) 491-9009', 'Refrigerator and AC service for your suites', 'Hello,

I''m with Chill Pros, a local HVAC and refrigeration company. Every suite at an extended-stay hotel has a full-size refrigerator and its own AC, which adds up to a lot of equipment to keep running. We repair and replace both, and offer maintenance plans that catch rusting or failing units early.

I''d be glad to do a free walk-through of the suites your team has flagged and send our rates.

Would this week work?

Chill Pros
chillprostx@gmail.com', '1015 Central Pkwy S, San Antonio, TX 78232', 'normal', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Everkleen Motel', 'San Antonio', 'equipment_failure', 'refrigeration', 'Independent motel. A guest said the fridge and microwave weren''t working. The owner makes the call directly. Guest said: "fridge, microwave not working". Best time to call: Typical for small motels: weekdays 10 AM-noon, after checkouts. The owner or manager is often on site. Imported from the Hot Leads Call Sheet (rank 18/32, warm priority, Hotel, cold-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Everkleen%20Motel%201306%20Roosevelt%20Ave%2C%20San%20Antonio%2C%20TX%2078210', '2026-10-13T00:00:00Z', false, 'everkleen motel|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=everkleen%20motel%201306%20roosevelt%20ave%2c%20san%20antonio%2c%20tx%2078210', 65, 'new', NULL, 'Owner', NULL, '(210) 281-4092', 'Affordable fridge and AC repairs for your motel', 'Hello,

I''m with Chill Pros, a local HVAC and refrigeration company here in San Antonio. We repair in-room refrigerators and AC units for small hotels and motels at fair, upfront prices, and we can often fix a unit for much less than replacing it.

I''d be glad to look at any units that aren''t working and give you a price on the spot.

When would be a good time to stop by?

Chill Pros
chillprostx@gmail.com', '1306 Roosevelt Ave, San Antonio, TX 78210', 'normal', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Hampton Inn & Suites San Antonio Lackland AFB SeaWorld', 'San Antonio', 'equipment_failure', 'refrigeration', 'An October 2025 guest found the in-room fridge dead and leaking and the room damp and humid. Pitch AC dehumidification check and refrigeration repair. Guest said: "The refrigerator didn''t work and leaked a little". Best time to call: Typical for hotels: weekdays 9-11 AM, when the chief engineer/GM works day shift. Avoid 3-6 PM check-in rush. Imported from the Hot Leads Call Sheet (rank 30/32, warm priority, Hotel, cold-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Hampton%20Inn%20%26%20Suites%20San%20Antonio%20Lackland%20AFB%20SeaWorld%201719%20Cable%20Ranch%20Rd%2C%20San%20Antonio%2C%20TX%2078245', '2026-10-19T12:24:28Z', false, 'hampton inn suites san antonio lackland afb seaworld|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=hampton%20inn%20%26%20suites%20san%20antonio%20lackland%20afb%20seaworld%201719%20cable%20ranch%20rd%2c%20san%20antonio%2c%20tx%2078245', 72, 'new', NULL, 'Chief engineer or general manager', 'SATLP_hampton_suites@hilton.com', '(210) 674-0700', 'Humid rooms and refrigeration repair for Hampton Inn Lackland (please forward to engineering)', 'Hello,

Could you please forward this to your chief engineer or maintenance lead? Thank you!

When guest rooms feel damp or humid, the AC usually isn''t pulling moisture out of the air, often from oversized or short-cycling units, dirty coils or drainage problems. Left alone it leads to musty smells and mold complaints.

Chill Pros is a local San Antonio HVAC and refrigeration company. We offer same-day repairs, can act as your overflow or backup contractor when your own team is stretched, and set up preventive maintenance plans that catch these problems before guests do. We also repair in-room refrigerators, ice machines and breakfast-area refrigeration.

We''d be glad to do a free walk-through of your units and give you a written list of anything that needs attention. Would a quick visit one morning next week work for you?

Chill Pros
chillprostx@gmail.com', '1719 Cable Ranch Rd, San Antonio, TX 78245', 'normal', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Hampton Inn & Suites Selma-San Antonio-Randolph AFB', 'Selma', 'equipment_failure', 'hvac_r', 'A December 2025 guest had no working room AC for two nights and staff wrote it off as a thermostat issue. Pitch diagnosis/repair of room units and backup service. Guest said: "the air conditioner in our room was not working". Best time to call: Typical for hotels: weekdays 9-11 AM, when the chief engineer/GM works day shift. Avoid 3-6 PM check-in rush. Imported from the Hot Leads Call Sheet (rank 25/32, hot priority, Hotel, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Hampton%20Inn%20%26%20Suites%20Selma-San%20Antonio-Randolph%20AFB%2014655%20IH-35N%20Access%20Road%2C%20Selma%2C%20TX%2078154', '2026-10-19T12:24:28Z', false, 'hampton inn suites selma san antonio randolph afb|selma|equipment_failure|https://www.google.com/maps/search/?api=1&query=hampton%20inn%20%26%20suites%20selma-san%20antonio-randolph%20afb%2014655%20ih-35n%20access%20road%2c%20selma%2c%20tx%2078154', 78, 'new', NULL, 'Chief engineer or general manager', 'SATLOH_hampton_suites@hilton.com', '(210) 590-3388', 'Room AC repair and backup HVAC service for Hampton Inn Selma (please forward to engineering)', 'Hello,

Could you please forward this to your chief engineer or maintenance lead? Thank you!

Hotels like yours sometimes have rooms where the AC won''t cool and it gets chalked up to the thermostat, when the real cause is a failing PTAC, low refrigerant or a bad sensor. Those rooms keep coming back as complaints until the unit is properly diagnosed.

Chill Pros is a local San Antonio HVAC and refrigeration company. We offer same-day repairs, can act as your overflow or backup contractor when your own team is stretched, and set up preventive maintenance plans that catch these problems before guests do.

We''d be glad to do a free walk-through of your units and give you a written list of anything that needs attention. Would a quick visit one morning next week work for you?

Chill Pros
chillprostx@gmail.com', '14655 IH-35N Access Road, Selma, TX 78154', 'high', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Hilton Garden Inn San Antonio Airport', 'San Antonio', 'equipment_failure', 'hvac_r', 'Lobby described as hot and stuffy with the AC apparently out, and room units are noisy. Guest said: "Lobby is hot and stuffy (I''m assuming the AC is out)... the AC in our room works but sounds like fried chicken". Best time to call: Typical for hotels: Tue-Thu 9-11 AM, when the chief engineer works day shift. Avoid 3-6 PM check-in rush. Imported from the Hot Leads Call Sheet (rank 3/32, hot priority, Hotel, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Hilton%20Garden%20Inn%20San%20Antonio%20Airport%2012828%20San%20Pedro%20Ave%2C%20San%20Antonio%2C%20TX%2078216', '2026-10-13T00:00:00Z', false, 'hilton garden inn san antonio airport|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=hilton%20garden%20inn%20san%20antonio%20airport%2012828%20san%20pedro%20ave%2c%20san%20antonio%2c%20tx%2078216', 71, 'new', NULL, 'Chief engineer or general manager', NULL, '(210) 494-7600', 'HVAC backup support for Hilton Garden Inn San Antonio Airport', 'Hello,

I''m with Chill Pros, a local HVAC and refrigeration company. We help San Antonio hotels keep lobbies and guest rooms comfortable by serving as their backup contractor: same-day repairs on rooftop units and in-room units, and preventive maintenance to catch noisy or failing units before guests complain.

I''d be glad to do a free walk-through of your lobby system and any rooms your team has flagged, and send you our rates.

Would your chief engineer have 20 minutes this week?

Chill Pros
chillprostx@gmail.com', '12828 San Pedro Ave, San Antonio, TX 78216', 'high', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Hilton Garden Inn San Antonio-Live Oak Conference Center', 'Live Oak', 'equipment_failure', 'hvac_r', 'A June 2026 guest found the room AC broken and the room at 87 degrees. Pitch same-day PTAC/room AC repair and a preventive maintenance plan. Guest said: "the AC was busted. 87 degrees in the room". Best time to call: Typical for hotels: weekdays 9-11 AM, when the chief engineer/GM works day shift. Avoid 3-6 PM check-in rush. Imported from the Hot Leads Call Sheet (rank 23/32, hot priority, Hotel, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Hilton%20Garden%20Inn%20San%20Antonio-Live%20Oak%20Conference%20Center%208101%20Pat%20Booker%20Rd%2C%20Live%20Oak%2C%20TX%2078233', '2026-10-19T12:24:28Z', false, 'hilton garden inn san antonio live oak conference center|live oak|equipment_failure|https://www.google.com/maps/search/?api=1&query=hilton%20garden%20inn%20san%20antonio-live%20oak%20conference%20center%208101%20pat%20booker%20rd%2c%20live%20oak%2c%20tx%2078233', 78, 'new', 'Sergio Cardenas, VP Sales', 'Chief engineer or general manager', 'SATLI_GM@hilton.com', '(210) 412-5923', 'Room AC repair and backup service for Hilton Garden Inn Live Oak (please forward to engineering)', 'Hello,

Could you please forward this to your chief engineer or maintenance lead? Thank you!

Hotels like yours often have a handful of rooms where the PTAC or split unit runs but can''t hold temperature, cycles off, or gets loud, and every one of those rooms becomes a comp or a bad night for a guest.

Chill Pros is a local San Antonio HVAC and refrigeration company. We offer same-day repairs, can act as your overflow or backup contractor when your own team is stretched, and set up preventive maintenance plans that catch these problems before guests do. We also service ice machines and kitchen refrigeration.

We''d be glad to do a free walk-through of your units and give you a written list of anything that needs attention. Would a quick visit one morning next week work for you?

Chill Pros
chillprostx@gmail.com', '8101 Pat Booker Rd, Live Oak, TX 78233', 'high', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Holiday Inn San Antonio N - Stone Oak Area', 'San Antonio', 'equipment_failure', 'refrigeration', 'An April 2026 guest says the ice machine wasn''t working and only one elevator ran. Pitch an ice machine repair plus a preventive maintenance plan for the ice machines and room AC units. Guest said: "ice machine not working". Best time to call: Typical for hotels: Tue-Thu 9-11 AM, when the chief engineer works day shift. Avoid 3-6 PM check-in rush. Imported from the Hot Leads Call Sheet (rank 20/32, hot priority, Hotel, cold-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Holiday%20Inn%20San%20Antonio%20N%20-%20Stone%20Oak%20Area%2019280%20Redland%20Rd%2C%20San%20Antonio%2C%20TX%2078259', '2026-10-14T02:05:00Z', false, 'holiday inn san antonio n stone oak area|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=holiday%20inn%20san%20antonio%20n%20-%20stone%20oak%20area%2019280%20redland%20rd%2c%20san%20antonio%2c%20tx%2078259', 71, 'new', NULL, 'Chief engineer or general manager', NULL, '(210) 298-8820', 'Ice machine and HVAC service for Holiday Inn Stone Oak', 'Hello,

I''m with Chill Pros, a local HVAC, refrigeration and ice machine company here in San Antonio. Hotels lean hard on their ice machines, and when one goes down on a busy weekend, guests notice fast.

We do same-day ice machine and AC repairs, and we can set up a simple preventive maintenance plan (cleaning, descaling, condenser checks) so your machines and room units stay ahead of problems. We''re also happy to act as your backup contractor when your team is stretched.

Could I stop by for a free walk-through of your ice machines and rooftop units this week?

Chill Pros
chillprostx@gmail.com', '19280 Redland Rd, San Antonio, TX 78259', 'high', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Hotel Gibbs Downtown San Antonio Riverwalk', 'San Antonio', 'equipment_failure', 'hvac_r', 'Guest says room AC airflow was weak unless you stood right next to it. Another guest praised the AC, so this may be one unit. Guest said: "Unless you were directly next to it you couldn''t feel it blowing". Best time to call: Typical for hotels: Tue-Thu 9-11 AM, when the chief engineer works day shift. Avoid Fri-Sun, the busiest downtown days. Imported from the Hot Leads Call Sheet (rank 16/32, warm priority, Hotel, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Hotel%20Gibbs%20Downtown%20San%20Antonio%20Riverwalk%20105%20N%20Alamo%20St%2C%20San%20Antonio%2C%20TX%2078205', '2026-10-13T00:00:00Z', false, 'hotel gibbs downtown san antonio riverwalk|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=hotel%20gibbs%20downtown%20san%20antonio%20riverwalk%20105%20n%20alamo%20st%2c%20san%20antonio%2c%20tx%2078205', 65, 'new', NULL, 'Chief engineer', 'info@hotelgibbs.com', '(210) 933-2000', 'Please forward to Engineering: HVAC backup support for Hotel Gibbs', 'Hello,

Could you please forward this to your chief engineer?

I''m with Chill Pros, a local HVAC and refrigeration company here in San Antonio. We support downtown hotels as a backup contractor, with same-day repairs, airflow balancing for rooms that don''t cool evenly, and preventive maintenance on rooftop and in-room equipment.

I''d welcome a free walk-through and the chance to share our rates. Thank you for passing this along.

Chill Pros
chillprostx@gmail.com', '105 N Alamo St, San Antonio, TX 78205', 'normal', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Hyatt Place San Antonio North/Stone Oak', 'San Antonio', 'equipment_failure', 'hvac_r', 'Guests in Nov 2025 and May 2026 both say the room AC was loud. Pitch room-unit maintenance and quiet replacements. Guest said: "The AC was really loud". Best time to call: Typical for hotels: weekdays 9-11 AM, when the GM and maintenance lead work day shift. Avoid 3-6 PM check-in rush. Imported from the Hot Leads Call Sheet (rank 22/32, warm priority, Hotel, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Hyatt%20Place%20San%20Antonio%20North%2FStone%20Oak%201610%20E%20Sonterra%20Blvd%2C%20San%20Antonio%2C%20TX%2078258', '2026-10-14T02:05:00Z', false, 'hyatt place san antonio north stone oak|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=hyatt%20place%20san%20antonio%20north%2fstone%20oak%201610%20e%20sonterra%20blvd%2c%20san%20antonio%2c%20tx%2078258', 65, 'new', 'Denise Mendoza, Director of Sales (per Successful Meetings listing)', 'Chief engineer or general manager', NULL, '(210) 545-2810', 'Room AC maintenance for Hyatt Place Stone Oak', 'Hello,

I''m with Chill Pros, a local HVAC and refrigeration company in San Antonio. Noisy room units are one of the most common things guests mention, and it usually means a worn fan motor, loose panels or a unit overdue for service.

We help hotels with preventive maintenance on room units and rooftop systems, same-day repairs, and backup support when the engineering team is stretched. We can also service ice machines and breakfast-area refrigeration.

Would your chief engineer have 20 minutes for a free walk-through this week?

Chill Pros
chillprostx@gmail.com', '1610 E Sonterra Blvd, San Antonio, TX 78258', 'normal', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('InTown Suites Extended Stay San Antonio West (SeaWorld)', 'San Antonio', 'equipment_failure', 'hvac_r', 'A January 2026 guest said the room AC either stays on or never comes back on and never reaches temperature. Pitch repair of room units and a PM plan for long-stay rooms. Guest said: "AC unit in the room does not work well". Best time to call: Typical for hotels: weekdays 9-11 AM, when the chief engineer/GM works day shift. Avoid 3-6 PM check-in rush. Imported from the Hot Leads Call Sheet (rank 26/32, hot priority, Hotel, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=InTown%20Suites%20Extended%20Stay%20San%20Antonio%20West%20(SeaWorld)%207490%20Culebra%20Rd%2C%20San%20Antonio%2C%20TX%2078251', '2026-10-19T12:24:28Z', false, 'intown suites extended stay san antonio west seaworld|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=intown%20suites%20extended%20stay%20san%20antonio%20west%20(seaworld)%207490%20culebra%20rd%2c%20san%20antonio%2c%20tx%2078251', 78, 'new', NULL, 'Chief engineer or general manager', NULL, '(210) 647-3784', 'Room AC repair for InTown Suites West', 'Hello,

Extended-stay properties put hard hours on room AC units, and the most common problem we see is a unit that won''t cycle properly: it runs nonstop or shuts off and never comes back on, so the room never reaches the set temperature. Long-stay guests notice fast.

Chill Pros is a local San Antonio HVAC and refrigeration company. We offer same-day repairs, can act as your overflow or backup contractor when your own team is stretched, and set up preventive maintenance plans that catch these problems before guests do.

We''d be glad to do a free walk-through of your units and give you a written list of anything that needs attention. Would a quick visit one morning next week work for you?

Chill Pros
chillprostx@gmail.com', '7490 Culebra Rd, San Antonio, TX 78251', 'high', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('La Quinta Inn & Suites by Wyndham Schertz', 'Schertz', 'equipment_failure', 'hvac_r', 'A December 2025 guest said the room AC only worked sometimes (possibly the same reviewer as the Best Western Atrium lead). Pitch repair of intermittent units. Guest said: "AC only worked sometimes". Best time to call: Typical for hotels: weekdays 9-11 AM, when the chief engineer/GM works day shift. Avoid 3-6 PM check-in rush. Imported from the Hot Leads Call Sheet (rank 32/32, warm priority, Hotel, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=La%20Quinta%20Inn%20%26%20Suites%20by%20Wyndham%20Schertz%2017650%20Four%20Oaks%20Ln%2C%20Schertz%2C%20TX%2078154', '2026-10-19T12:24:28Z', false, 'la quinta inn suites by wyndham schertz|schertz|equipment_failure|https://www.google.com/maps/search/?api=1&query=la%20quinta%20inn%20%26%20suites%20by%20wyndham%20schertz%2017650%20four%20oaks%20ln%2c%20schertz%2c%20tx%2078154', 72, 'new', NULL, 'Chief engineer or general manager', 'gm@lqschertz.com', '(210) 655-2700', 'Room AC repair and backup service for La Quinta Schertz', 'Hello,

Hotels often have a few room AC units that work some of the time and then quit, usually from a failing capacitor, a coil freezing up, or a worn control board. They test fine until the next guest checks in and the complaint comes back.

Chill Pros is a local San Antonio HVAC and refrigeration company. We offer same-day repairs, can act as your overflow or backup contractor when your own team is stretched, and set up preventive maintenance plans that catch these problems before guests do.

We''d be glad to do a free walk-through of your units and give you a written list of anything that needs attention. Would a quick visit one morning next week work for you?

Chill Pros
chillprostx@gmail.com', '17650 Four Oaks Ln, Schertz, TX 78154', 'normal', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('La Quinta Inn & Suites by Wyndham San Antonio Airport', 'San Antonio', 'equipment_failure', 'hvac_r', 'AC cover fell off and there was mold inside the unit. Pitch coil cleaning and PTAC maintenance. Guest said: "The cover for the AC fell off and there was mold in it". Best time to call: Typical for hotels: weekdays 9-11 AM, when the maintenance lead and GM work day shift. Avoid 3-6 PM check-in rush. Imported from the Hot Leads Call Sheet (rank 12/32, warm priority, Hotel, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=La%20Quinta%20Inn%20%26%20Suites%20by%20Wyndham%20San%20Antonio%20Airport%20850%20Halm%20Blvd%2C%20San%20Antonio%2C%20TX%2078216', '2026-10-13T00:00:00Z', false, 'la quinta inn suites by wyndham san antonio airport|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=la%20quinta%20inn%20%26%20suites%20by%20wyndham%20san%20antonio%20airport%20850%20halm%20blvd%2c%20san%20antonio%2c%20tx%2078216', 65, 'new', NULL, 'General manager', NULL, '(210) 342-3738', 'Coil cleaning and in-room AC maintenance', 'Hello,

I''m with Chill Pros, a local HVAC company. In-room AC units collect dirt and moisture, and over time that turns into musty smells, mold on the coils and weak cooling. A coil cleaning and maintenance program fixes that and helps units last longer.

We can clean and service your in-room units on a schedule that works around occupancy, and repair or replace any that are failing.

Could I stop by this week to look at a few rooms and give you a price?

Chill Pros
chillprostx@gmail.com', '850 Halm Blvd, San Antonio, TX 78216', 'normal', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('La Quinta Inn by Wyndham San Antonio Brooks City Base', 'San Antonio', 'equipment_failure', 'hvac_r', 'Guests say the hallway is very hot. Common-area cooling may be undersized or failing. Guest said: "Very hot in the hallway". Best time to call: Typical for hotels: weekdays 9-11 AM, when the maintenance lead and GM work day shift. Avoid 3-6 PM check-in rush. Imported from the Hot Leads Call Sheet (rank 13/32, warm priority, Hotel, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=La%20Quinta%20Inn%20by%20Wyndham%20San%20Antonio%20Brooks%20City%20Base%203180%20Goliad%20Rd%2C%20San%20Antonio%2C%20TX%2078223', '2026-10-13T00:00:00Z', false, 'la quinta inn by wyndham san antonio brooks city base|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=la%20quinta%20inn%20by%20wyndham%20san%20antonio%20brooks%20city%20base%203180%20goliad%20rd%2c%20san%20antonio%2c%20tx%2078223', 65, 'new', NULL, 'General manager', NULL, '(210) 337-7171', 'Cooling your hallways and common areas', 'Hello,

I''m with Chill Pros, a local HVAC company. Hot hallways and common areas are one of the first things guests notice, and the fix is often simpler than it looks: a failing unit, a bad thermostat, or ductwork that isn''t delivering air where it should.

I''d be glad to check your common-area system for free and tell you what it would take to keep those spaces comfortable.

Would this week work for a quick visit?

Chill Pros
chillprostx@gmail.com', '3180 Goliad Rd, San Antonio, TX 78223', 'normal', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('La Quinta Inn by Wyndham San Antonio I-35 N at Toepperwein', 'San Antonio', 'equipment_failure', 'hvac_r', 'One of two AC units in a room was broken with a smashed, unresponsive control panel. Guest said: "One of the two AC units did not work; the buttons were smashed in, and the panel was broken". Best time to call: Typical for hotels: weekdays 9-11 AM, when the maintenance lead and GM work day shift. Avoid 3-6 PM check-in rush. Imported from the Hot Leads Call Sheet (rank 7/32, hot priority, Hotel, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=La%20Quinta%20Inn%20by%20Wyndham%20San%20Antonio%20I-35%20N%20at%20Toepperwein%2012822%20I-35%2C%20San%20Antonio%2C%20TX%2078233', '2026-10-13T00:00:00Z', false, 'la quinta inn by wyndham san antonio i 35 n at toepperwein|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=la%20quinta%20inn%20by%20wyndham%20san%20antonio%20i-35%20n%20at%20toepperwein%2012822%20i-35%2c%20san%20antonio%2c%20tx%2078233', 71, 'new', NULL, 'General manager', NULL, '(210) 657-5500', 'In-room AC repair and replacement for your hotel', 'Hello,

I''m with Chill Pros, a local HVAC company in San Antonio. We repair and replace in-room AC units for hotels, including units with broken or damaged controls, and we can usually get a room back in service the same day.

I''d be glad to walk your property for free, list which units need repair or replacement, and send you one clear price. We also offer seasonal maintenance so fewer units fail during busy weeks.

Would this week work?

Chill Pros
chillprostx@gmail.com', '12822 I-35, San Antonio, TX 78233', 'high', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Medical Center Apartments', 'San Antonio', 'equipment_failure', 'hvac_r', 'Resident says the AC took five months to fix. Their maintenance team is clearly overloaded, so pitch overflow work. Guest said: "They took 5 months to fix ac". Best time to call: Tue-Thu 9:30-11 AM. Office hours: Mon-Fri 9 AM-6 PM, Sat 10 AM-5 PM, Sun 1-5 PM (per Adara Communities listing). Skip Mondays, which are busy with weekend work orders. Imported from the Hot Leads Call Sheet (rank 8/32, hot priority, Apartments, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Medical%20Center%20Apartments%205055%20Von%20Scheele%20Dr%2C%20San%20Antonio%2C%20TX%2078229', '2026-10-13T00:00:00Z', false, 'medical center apartments|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=medical%20center%20apartments%205055%20von%20scheele%20dr%2c%20san%20antonio%2c%20tx%2078229', 71, 'new', NULL, 'Property manager or maintenance supervisor', NULL, '(210) 504-2856', 'Help clearing your AC work orders', 'Hello,

I''m with Chill Pros, a local HVAC company here in San Antonio. We help apartment communities clear AC work orders when the in-house team is backed up, especially compressor, coil and full-system jobs that take a tech off the property for a day.

We take overflow calls at a flat rate, do make-ready HVAC checks between residents, and can quote replacements when a unit isn''t worth repairing.

Could I stop by this week and look at your open AC work orders?

Chill Pros
chillprostx@gmail.com', '5055 Von Scheele Dr, San Antonio, TX 78229', 'high', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Menger Hotel', 'San Antonio', 'equipment_failure', 'hvac_r', 'Historic downtown hotel. One guest''s room AC did not work over Labor Day weekend; another guest''s room fridge did not work. Guest said: "Unfortunately the ac was not working in our room". Best time to call: Typical for full-service hotels: Tue-Thu 9-11 AM, when the chief engineer works day shift. Avoid Fri-Sun, the busiest downtown days. Imported from the Hot Leads Call Sheet (rank 4/32, hot priority, Hotel, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Menger%20Hotel%20204%20Alamo%20Plaza%2C%20San%20Antonio%2C%20TX%2078205', '2026-10-13T00:00:00Z', false, 'menger hotel|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=menger%20hotel%20204%20alamo%20plaza%2c%20san%20antonio%2c%20tx%2078205', 71, 'new', 'Marcia Sheingold, Director of Sales & Marketing', 'Director of engineering', 'reservations@mengerhotel.com', '(210) 223-4361', 'Please forward to Engineering: backup HVAC and refrigeration support', 'Hello,

Could you please forward this to your director of engineering?

I''m with Chill Pros, a local HVAC and refrigeration company here in San Antonio. Historic buildings like the Menger often mix older equipment with newer in-room units, and we''re comfortable working on both. We can serve as your backup contractor for same-day repairs on guest-room AC, air handlers, kitchen refrigeration, walk-ins and ice machines, and help with preventive maintenance before peak seasons.

I''d welcome the chance to do a free walk-through and share our rates. Thank you for passing this along.

Chill Pros
chillprostx@gmail.com', '204 Alamo Plaza, San Antonio, TX 78205', 'high', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Motel 6 San Antonio - Fort Sam Houston', 'San Antonio', 'equipment_failure', 'hvac_r', 'Room AC leaking into a bucket that overflowed, and the AC/heater had issues. Likely clogged drains and failing PTACs. Guest said: "a bucket over flowing water directly underneath the air conditioner". Best time to call: Typical for motels: weekdays 10 AM-noon, after checkouts, when the general manager is on shift. Imported from the Hot Leads Call Sheet (rank 6/32, hot priority, Hotel, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Motel%206%20San%20Antonio%20-%20Fort%20Sam%20Houston%205522%20N%20PanAm%20Expy%2C%20San%20Antonio%2C%20TX%2078218', '2026-10-13T00:00:00Z', false, 'motel 6 san antonio fort sam houston|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=motel%206%20san%20antonio%20-%20fort%20sam%20houston%205522%20n%20panam%20expy%2c%20san%20antonio%2c%20tx%2078218', 71, 'new', NULL, 'General manager', NULL, '(210) 903-9639', 'Stop leaking room AC units before they cost you rooms', 'Hello,

I''m with Chill Pros, a local HVAC company. Leaking or weak in-room AC units are usually clogged drains, dirty coils or failing parts, and they''re cheaper to fix now than after they damage carpet and walls.

We offer flat-rate in-room unit service: drain cleaning, coil cleaning, repairs and replacements, plus heating checks before winter. I''d be glad to look at your problem rooms for free and send you a price.

When''s a good time to stop by?

Chill Pros
chillprostx@gmail.com', '5522 N PanAm Expy, San Antonio, TX 78218', 'high', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('The Quarry Townhomes', 'San Antonio', 'equipment_failure', 'hvac_r', 'Resident review complains of no AC and no maintenance being done. Confirm the current management company when you call. Guest said: "Be ready for stolen mail, no water, no ac, and no maintenance being done". Best time to call: Tue-Thu 9:30-11 AM. Office hours: Mon-Fri 9 AM-6 PM, Sat 10 AM-5 PM, closed Sun (per Mission Rock Residential site, office line 210-239-7391). Managed by: Mission Rock Residential (their property website, checked Oct 13, 2026). Alternate phone: (210) 239-7391. Contact form: https://www.missionrockresidential.com/apartments/tx/san-antonio/quarry-townhomes/contact-us. Imported from the Hot Leads Call Sheet (rank 10/32, hot priority, Apartments, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=The%20Quarry%20Townhomes%20250%20Treeline%20Park%2C%20San%20Antonio%2C%20TX%2078209', '2026-10-13T00:00:00Z', false, 'the quarry townhomes|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=the%20quarry%20townhomes%20250%20treeline%20park%2c%20san%20antonio%2c%20tx%2078209', 71, 'new', NULL, 'Property manager', NULL, '(833) 396-0230', 'HVAC overflow help for The Quarry Townhomes', 'Hello,

I''m with Chill Pros, a local HVAC company here in San Antonio. We help apartment communities stay on top of AC work orders when the maintenance team is stretched thin, with same-day overflow repairs at a flat rate and replacements when a unit isn''t worth fixing.

I''d be glad to stop by, look at your open AC work orders, and send our rates.

Who would be the best person to talk to about this?

Chill Pros
chillprostx@gmail.com', '250 Treeline Park, San Antonio, TX 78209', 'high', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Ramada by Wyndham San Antonio Near SeaWorld', 'San Antonio', 'equipment_failure', 'hvac_r', 'Guests reported room AC trouble twice in 2026, including a unit cutting off before reaching temperature (Jan). Pitch diagnosis of short-cycling units and PM after the room updates. Guest said: "a/c worked but cut off at a certain temperature". Best time to call: Typical for hotels: weekdays 9-11 AM, when the chief engineer/GM works day shift. Avoid 3-6 PM check-in rush. Imported from the Hot Leads Call Sheet (rank 29/32, warm priority, Hotel, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Ramada%20by%20Wyndham%20San%20Antonio%20Near%20SeaWorld%207043%20Culebra%20Rd%2C%20San%20Antonio%2C%20TX%2078238', '2026-10-19T12:24:28Z', false, 'ramada by wyndham san antonio near seaworld|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=ramada%20by%20wyndham%20san%20antonio%20near%20seaworld%207043%20culebra%20rd%2c%20san%20antonio%2c%20tx%2078238', 72, 'new', NULL, 'Chief engineer or general manager', 'ramadasanantonio@yahoo.com', '(210) 201-7786', 'Room AC repair and maintenance for Ramada Near SeaWorld (please forward to maintenance)', 'Hello,

Could you please forward this to your chief engineer or maintenance lead? Thank you!

After room renovations, hotels often find a few AC units that short-cycle, shut off before the room is cool, or were reinstalled missing parts. Those rooms keep generating complaints until each unit is checked properly.

Chill Pros is a local San Antonio HVAC and refrigeration company. We offer same-day repairs, can act as your overflow or backup contractor when your own team is stretched, and set up preventive maintenance plans that catch these problems before guests do.

We''d be glad to do a free walk-through of your units and give you a written list of anything that needs attention. Would a quick visit one morning next week work for you?

Chill Pros
chillprostx@gmail.com', '7043 Culebra Rd, San Antonio, TX 78238', 'normal', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Snow Island & What You Want Southern Foods', 'San Antonio', 'equipment_failure', 'hvac_r', 'Dining room stays hot even with a portable AC and a wall unit running. They need a real system sized for a cooking kitchen. Guest said: "it was hot in there... even with a portable AC and a wall AC". Best time to call: Hours not published. Try 2-4 PM on a weekday, between the lunch and dinner rush, and ask for the owner. Imported from the Hot Leads Call Sheet (rank 1/32, hot priority, Restaurant, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Snow%20Island%20%26%20What%20You%20Want%20Southern%20Foods%20102%20Springfield%20Rd%2C%20San%20Antonio%2C%20TX%2078219', '2026-10-13T00:00:00Z', false, 'snow island what you want southern foods|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=snow%20island%20%26%20what%20you%20want%20southern%20foods%20102%20springfield%20rd%2c%20san%20antonio%2c%20tx%2078219', 71, 'new', NULL, 'The owner', NULL, '(210) 354-7067', 'Keeping your dining room cool', 'Hello,

I''m with Chill Pros, a local HVAC and restaurant refrigeration company here in San Antonio. A busy kitchen puts out more heat than portable or window units can handle, so dining rooms often stay warm even with extra units running.

I''d be glad to stop by during a slow hour, look at your setup for free, and tell you what it would take to keep the dining room comfortable year-round. We also service walk-ins, reach-ins and ice machines, so one call covers all of it.

Would a quick visit this week work for you?

Chill Pros
chillprostx@gmail.com', '102 Springfield Rd, San Antonio, TX 78219', 'high', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Staybridge Suites San Antonio-Schertz', 'Schertz', 'equipment_failure', 'hvac_r', 'An April 2026 guest said the suite AC was loud and never got cold enough. Pitch tune-up/repair of noisy, under-cooling units and a PM plan. Guest said: "Our A/C was loud in and never really got cold enough". Best time to call: Typical for hotels: weekdays 9-11 AM, when the chief engineer/GM works day shift. Avoid 3-6 PM check-in rush. Imported from the Hot Leads Call Sheet (rank 27/32, warm priority, Hotel, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Staybridge%20Suites%20San%20Antonio-Schertz%205601%20Schertz%20Pkwy%2C%20Schertz%2C%20TX%2078154', '2026-10-19T12:24:28Z', false, 'staybridge suites san antonio schertz|schertz|equipment_failure|https://www.google.com/maps/search/?api=1&query=staybridge%20suites%20san%20antonio-schertz%205601%20schertz%20pkwy%2c%20schertz%2c%20tx%2078154', 72, 'new', 'Ashley Thurman, Regional Director (management company)', 'Chief engineer or general manager', 'ashley.thurman@qpmhotels.com', '(210) 469-0550', 'AC tune-ups and backup repair for Staybridge Suites Schertz', 'Hello Ashley,

I''m reaching out from Chill Pros, a local San Antonio HVAC and refrigeration company. Extended-stay suites run their AC units hard, and the usual early warning signs are units that get loud and stop cooling well, often from dirty coils, worn fan motors or low refrigerant. Caught early, those are inexpensive fixes; left alone, they turn into failed units in summer.

We offer same-day repairs, can serve as an overflow or backup contractor for your maintenance team, and run preventive maintenance plans for room units, ice machines and kitchen refrigeration.

We''d be happy to do a free walk-through at the Schertz property and leave a written list of anything that needs attention. Who would be the best person on site to set that up with?

Chill Pros
chillprostx@gmail.com', '5601 Schertz Pkwy, Schertz, TX 78154', 'normal', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Super 8 by Wyndham San Antonio Downtown NE', 'San Antonio', 'equipment_failure', 'hvac_r', 'Guest moved rooms three times: AC dead in two rooms and water under the fridge in one. Guest said: "first room water under fridge and ac didn''t work then 2nd room the dam ac didn''t work". Best time to call: Typical for motels: weekdays 10 AM-noon, after checkouts, when the general manager is on shift. Imported from the Hot Leads Call Sheet (rank 5/32, hot priority, Hotel, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Super%208%20by%20Wyndham%20San%20Antonio%20Downtown%20NE%203911%20N%20PanAm%20Expy%2C%20San%20Antonio%2C%20TX%2078219', '2026-10-13T00:00:00Z', false, 'super 8 by wyndham san antonio downtown ne|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=super%208%20by%20wyndham%20san%20antonio%20downtown%20ne%203911%20n%20panam%20expy%2c%20san%20antonio%2c%20tx%2078219', 71, 'new', NULL, 'General manager or owner', NULL, '(210) 951-2647', 'Fast in-room AC repairs for your hotel', 'Hello,

I''m with Chill Pros, a local HVAC company in San Antonio. When a room''s AC fails, it usually means a moved guest, a lost night or a bad review. We repair and replace in-room AC units quickly at flat rates, and we can check and clear drain lines so units stop leaking.

I''d be glad to do a free check of the rooms your staff has flagged and give you a price to get them all working.

Would this week work for a quick visit?

Chill Pros
chillprostx@gmail.com', '3911 N PanAm Expy, San Antonio, TX 78219', 'high', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Travelodge by Wyndham (N PanAm)', 'San Antonio', 'equipment_failure', 'refrigeration', 'Guest reported a broken fridge in their room. Guest said: "broken fridge". Best time to call: Typical for motels: weekdays 10 AM-noon, after checkouts, when the general manager is on shift. Imported from the Hot Leads Call Sheet (rank 15/32, warm priority, Hotel, cold-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Travelodge%20by%20Wyndham%20(N%20PanAm)%203821%20N%20PanAm%20Expy%2C%20San%20Antonio%2C%20TX%2078219', '2026-10-13T00:00:00Z', false, 'travelodge by wyndham n panam|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=travelodge%20by%20wyndham%20(n%20panam)%203821%20n%20panam%20expy%2c%20san%20antonio%2c%20tx%2078219', 65, 'new', NULL, 'General manager or owner', NULL, '(210) 224-5114', 'In-room fridge and AC service for your hotel', 'Hello,

I''m with Chill Pros, a local HVAC and refrigeration company in San Antonio. We service the in-room refrigerators and AC units hotels depend on, with repairs, replacements and simple maintenance plans so broken units don''t sit until a guest complains.

I''d be glad to check the rooms your staff has flagged for free and send you a price.

When''s a good time to stop by?

Chill Pros
chillprostx@gmail.com', '3821 N PanAm Expy, San Antonio, TX 78219', 'normal', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('Tru by Hilton San Antonio at the Rim', 'San Antonio', 'equipment_failure', 'hvac_r', 'A May 2026 guest reported a loud AC or mechanical unit above their room all night. A noisy rooftop unit often means a failing fan motor or bearing. Guest said: "an AC unit or other mechanical equipment directly above our room making loud, constant noise". Best time to call: Typical for hotels: weekdays 9-11 AM, when the GM and maintenance lead work day shift. Avoid 3-6 PM check-in rush. Imported from the Hot Leads Call Sheet (rank 14/32, warm priority, Hotel, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=Tru%20by%20Hilton%20San%20Antonio%20at%20the%20Rim%205639%20Rim%20Pass%2C%20San%20Antonio%2C%20TX%2078257', '2026-10-13T00:00:00Z', false, 'tru by hilton san antonio at the rim|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=tru%20by%20hilton%20san%20antonio%20at%20the%20rim%205639%20rim%20pass%2c%20san%20antonio%2c%20tx%2078257', 65, 'new', NULL, 'Chief engineer or general manager', NULL, '(210) 569-1101', 'Quieting a noisy rooftop unit', 'Hello,

I''m with Chill Pros, a local commercial HVAC company. A loud rooftop or mechanical unit is usually a worn fan motor, a failing bearing or loose panels, and it tends to get worse until the unit fails, often on a full night.

I''d be glad to inspect your rooftop equipment for free and tell you what needs attention before it turns into an outage. We also offer preventive maintenance plans for hotels.

Would your engineering team have time this week?

Chill Pros
chillprostx@gmail.com', '5639 Rim Pass, San Antonio, TX 78257', 'normal', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid),
  ('WoodSpring Suites San Antonio South', 'San Antonio', 'equipment_failure', 'hvac_r', 'Guest''s room AC didn''t work the first night; they had to switch rooms. Guest said: "our first night the ac in the room didn''t work". Best time to call: Typical for extended-stay hotels: weekdays 9-11 AM. The general manager usually works weekday days. Imported from the Hot Leads Call Sheet (rank 11/32, warm priority, Hotel, hvac-side equipment).', 'https://www.google.com/maps/search/?api=1&query=WoodSpring%20Suites%20San%20Antonio%20South%207958%20I-35%20Access%20Rd%2C%20San%20Antonio%2C%20TX%2078224', '2026-10-13T00:00:00Z', false, 'woodspring suites san antonio south|san antonio|equipment_failure|https://www.google.com/maps/search/?api=1&query=woodspring%20suites%20san%20antonio%20south%207958%20i-35%20access%20rd%2c%20san%20antonio%2c%20tx%2078224', 65, 'new', NULL, 'General manager', NULL, '(726) 233-5331', 'Fast AC repairs for your extended-stay rooms', 'Hello,

I''m with Chill Pros, a local HVAC and refrigeration company. Extended-stay guests feel an AC problem more than anyone, since they''re in the room for weeks. We do same-day in-room AC repairs and service the refrigerators in your kitchenettes, so one call covers both.

I''d be glad to do a free walk-through of any rooms your team has flagged and send you our rates.

Would this week work?

Chill Pros
chillprostx@gmail.com', '7958 I-35 Access Rd, San Antonio, TX 78224', 'normal', 'source_verified', '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid, '8c81f12a-ad86-4ceb-bca1-3924be1cbfec'::uuid)
on conflict (normalized_key) do nothing;
