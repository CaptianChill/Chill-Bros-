// Common HVAC/R note lines a tech can drop into Tech notes with one tap.
// "___" marks a blank for the tech to fill in.
export const TECH_NOTE_PICKS: { group: string; notes: string[] }[] = [
  {
    group: "Inspection",
    notes: [
      "Checked thermostat operation and settings.",
      "Checked electrical connections and tightened as needed.",
      "Inspected blower motor and belt.",
      "Checked condensate drain line and pan.",
      "Inspected ductwork and visible insulation.",
    ],
  },
  {
    group: "Readings",
    notes: [
      "Suction ___ psi / discharge ___ psi.",
      "Superheat ___°F / subcooling ___°F.",
      "Supply air ___°F / return air ___°F.",
      "Compressor amps ___ A / condenser fan amps ___ A.",
      "Capacitor tested ___ µF (rated ___ µF).",
    ],
  },
  {
    group: "Work performed",
    notes: [
      "Replaced air filter.",
      "Cleaned condenser coil.",
      "Cleaned evaporator coil.",
      "Flushed and cleared condensate drain line.",
      "Replaced capacitor.",
      "Replaced contactor.",
      "Replaced ___.",
    ],
  },
  {
    group: "Refrigeration",
    notes: [
      "Found refrigerant leak at ___.",
      "Added ___ lbs of ___ refrigerant.",
      "Checked door gaskets and defrost cycle.",
      "Box temperature ___°F on arrival / ___°F on departure.",
      "Ice machine cleaned and sanitized.",
    ],
  },
  {
    group: "Wrap-up",
    notes: [
      "System operating normally on departure.",
      "Recommend repair: ___.",
      "Recommend replacement. Unit is near the end of its service life.",
      "Parts ordered; return visit needed.",
      "Customer informed of findings and recommendations.",
    ],
  },
];

/** Add a picked line to the end of the notes on its own line. */
export function appendNote(current: string, line: string) {
  const trimmed = current.replace(/\s+$/, "");
  return trimmed ? `${trimmed}\n${line}` : line;
}
