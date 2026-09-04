export type TrainingModelSlug = "rtu" | "reach-in" | "ice-machine" | "fryer";

export type TrainingModelComponent = {
  id: string;
  label: string;
  aliases: string[];
  position: [number, number, number];
  normal?: [number, number, number];
  system: "Electrical" | "Refrigeration" | "Airflow" | "Drainage" | "Control";
  purpose: string;
  fieldChecks: string[];
  commonFailure: string;
  nextStep: string;
};

export type TrainingModelMeta = {
  slug: TrainingModelSlug;
  title: string;
  components: TrainingModelComponent[];
};

const rtuComponents: TrainingModelComponent[] = [
  {
    id: "contactor",
    label: "Contactor",
    aliases: ["Contactor", "Contactor coil"],
    position: [-0.25, -0.94, 0.62],
    system: "Electrical",
    purpose: "Uses the 24V control signal to switch line voltage to the compressor and condenser section.",
    fieldChecks: ["Measure directly A1 to A2 across the coil during a cooling call.", "Verify line voltage on the line side before condemning the contactor.", "With the contactor pulled in, confirm line voltage transfers to the load side."],
    commonFailure: "Burned contacts, open coil, weak mechanical pull-in, or no usable 24V difference across the coil.",
    nextStep: "If the coil does not have about 24 VAC across A1-A2, stay upstream in the low-voltage control and safety circuit before replacing the contactor.",
  },
  {
    id: "transformer",
    label: "24V Transformer",
    aliases: ["Transformer"],
    position: [-0.95, -0.94, 0.55],
    system: "Electrical",
    purpose: "Steps the unit supply voltage down to the low-voltage control circuit used by the thermostat, board, safeties, relays, and contactor coil.",
    fieldChecks: ["Verify rated primary voltage at the transformer input.", "Measure R to C on the secondary; a typical control circuit is about 24 VAC.", "Check the low-voltage fuse and downstream shorts if the transformer repeatedly fails."],
    commonFailure: "Open winding, shorted winding, overheated transformer, blown secondary protection, or downstream low-voltage short.",
    nextStep: "Primary voltage present with no secondary output points toward the transformer or its integral protection. No primary voltage means diagnose upstream power first.",
  },
  {
    id: "control-board",
    label: "Control Board",
    aliases: ["Control board"],
    position: [-1.62, -0.94, 0.48],
    system: "Control",
    purpose: "Receives thermostat inputs, applies timing and safeties, and commands relays or outputs for the unit sequence of operation.",
    fieldChecks: ["Verify R and C power to the board before judging board outputs.", "Confirm the thermostat call reaches the correct input terminal.", "Check each board output against the sequence of operation and OEM diagram."],
    commonFailure: "No output with correct power/input, burned relay contacts, failed sensor input, or damaged board from voltage faults.",
    nextStep: "Prove power, input, safeties, and load circuit before condemning a control board. Boards are expensive guesses.",
  },
  {
    id: "y-input",
    label: "Y / Cooling Input",
    aliases: ["Thermostat Y", "Y", "Cooling input"],
    position: [-1.96, -0.94, 0.86],
    system: "Control",
    purpose: "Carries the thermostat cooling request into the RTU control circuit.",
    fieldChecks: ["Measure Y to C during a cooling call.", "Verify the call remains present while tracing through safeties.", "Compare thermostat output with the unit terminal-strip input."],
    commonFailure: "Broken conductor, loose terminal, thermostat configuration/wiring issue, or lost common reference.",
    nextStep: "If Y is missing at the unit, work back toward thermostat wiring. If Y is present, continue through the unit safeties and control logic.",
  },
  {
    id: "high-pressure-switch",
    label: "High-Pressure Switch",
    aliases: ["High-pressure switch", "High pressure switch"],
    position: [1.75, -0.94, 0.28],
    system: "Refrigeration",
    purpose: "Opens the control circuit when discharge pressure rises beyond the approved safety limit.",
    fieldChecks: ["Check continuity only with power isolated when the OEM procedure permits.", "During an active fault, measure voltage across the switch to identify an open device.", "Correct condenser airflow, overcharge, restriction, or non-condensables before resetting/replacing a safety."],
    commonFailure: "Legitimate high-head trip, damaged switch, loose wiring, or repeated nuisance opening caused by an unresolved refrigeration/airflow problem.",
    nextStep: "Never bypass a pressure safety for normal operation. Determine why it opened before returning the unit to service.",
  },
  {
    id: "low-pressure-switch",
    label: "Low-Pressure Switch",
    aliases: ["Low-pressure switch", "Low pressure switch"],
    position: [0.92, -0.94, 0.15],
    system: "Refrigeration",
    purpose: "Protects the compressor/control sequence when suction pressure falls outside the designed operating range.",
    fieldChecks: ["Verify actual suction pressure with gauges before blaming the switch.", "Measure voltage across the switch during the failed call to see whether it is open.", "Check airflow, refrigerant charge, restriction, and evaporator condition."],
    commonFailure: "Low charge, restriction, iced/starved evaporator, airflow problem, failed switch, or wiring fault.",
    nextStep: "If suction pressure is genuinely low, diagnose the refrigeration cause rather than jumping the safety.",
  },
  {
    id: "compressor",
    label: "Compressor",
    aliases: ["Compressor"],
    position: [1.45, -0.92, -0.48],
    system: "Refrigeration",
    purpose: "Moves refrigerant vapor from the low side to the high side and creates the pressure difference that drives the refrigeration cycle.",
    fieldChecks: ["Verify correct line voltage at the compressor terminals under load.", "Measure operating amperage and compare with nameplate/RLA context.", "Check winding resistance to common and insulation to ground with power isolated."],
    commonFailure: "Electrical winding failure, locked rotor, overheating, mechanical damage, loss of lubrication, or failure caused by a system problem.",
    nextStep: "Before replacing a compressor, prove the controls, voltage, refrigerant circuit, airflow, and root cause that may have killed it.",
  },
  {
    id: "run-capacitor",
    label: "Run Capacitor",
    aliases: ["Run capacitor", "Capacitor"],
    position: [0.35, -0.94, 0.75],
    system: "Electrical",
    purpose: "Provides the designed phase shift for PSC compressor or fan-motor circuits where used.",
    fieldChecks: ["Isolate and discharge safely before capacitance testing.", "Compare measured µF with the capacitor rating and allowed tolerance.", "Inspect for swelling, leakage, burned terminals, and heat damage."],
    commonFailure: "Low capacitance, open capacitor, shorted capacitor, overheated terminals, or wrong replacement value.",
    nextStep: "Use the exact approved capacitance and voltage rating. A failed capacitor can be a symptom of a stressed motor, not always the root cause.",
  },
  {
    id: "condenser-fan",
    label: "Condenser Fan Motor",
    aliases: ["Condenser fan", "Condenser fan motor"],
    position: [1.35, 0.92, 0.75],
    normal: [0, 1, 0],
    system: "Airflow",
    purpose: "Moves outdoor air through the condenser coil so the refrigerant can reject heat and condense properly.",
    fieldChecks: ["Confirm correct supply voltage at the motor during a call.", "Verify capacitor value on PSC motors where applicable.", "Check rotation, amperage, blade condition, coil cleanliness, and motor temperature."],
    commonFailure: "Failed capacitor, open/overheated motor, wrong rotation, damaged blade, obstructed coil, or control failure.",
    nextStep: "High head pressure with poor condenser airflow should be corrected before adding refrigerant or condemning sealed-system parts.",
  },
  {
    id: "blower-motor",
    label: "Supply Blower Motor",
    aliases: ["Blower motor", "Supply blower"],
    position: [-1.55, 0.08, -0.82],
    system: "Airflow",
    purpose: "Moves conditioned air across the evaporator and into the building duct system.",
    fieldChecks: ["Verify command and correct voltage to the motor/control module.", "Inspect belt, wheel, bearings, rotation, and airflow restrictions where applicable.", "Measure motor amperage and static pressure when diagnosing airflow complaints."],
    commonFailure: "Failed motor/module, belt failure, seized bearings, dirty wheel/filters, incorrect speed command, or excessive static pressure.",
    nextStep: "Do not diagnose refrigerant charge until indoor airflow is known to be correct.",
  },
  {
    id: "evaporator",
    label: "Evaporator Coil",
    aliases: ["Evaporator", "Evaporator coil"],
    position: [-1.15, 0.84, -0.18],
    normal: [0, 1, 0],
    system: "Refrigeration",
    purpose: "Absorbs heat from the air stream as refrigerant boils inside the coil.",
    fieldChecks: ["Inspect coil cleanliness and airflow before using pressure readings diagnostically.", "Check temperature split only in the proper operating context.", "Look for uneven feeding, frosting patterns, or oil staining that may support a leak/restriction diagnosis."],
    commonFailure: "Dirty coil, low airflow, leak, restriction, icing, corrosion, or poor refrigerant distribution.",
    nextStep: "Correct airflow first, then evaluate superheat, suction pressure, and coil feeding pattern together.",
  },
  {
    id: "txv",
    label: "TXV / Metering Device",
    aliases: ["TXV", "Metering device"],
    position: [-0.1, -0.92, -0.42],
    system: "Refrigeration",
    purpose: "Meters refrigerant into the evaporator and helps maintain the designed evaporator superheat when a TXV is used.",
    fieldChecks: ["Verify airflow and refrigerant charge indicators before condemning the TXV.", "Measure superheat, subcooling, and line temperatures.", "Inspect bulb mounting/insulation and equalizer condition when applicable."],
    commonFailure: "Restriction, lost charge in power head, plugged inlet screen, poor bulb contact, moisture/contamination, or misdiagnosed low charge.",
    nextStep: "A starved evaporator does not automatically mean a bad TXV. Prove charge, drier condition, and airflow first.",
  },
  {
    id: "filter-drier",
    label: "Filter Drier",
    aliases: ["Filter drier", "Drier"],
    position: [0.48, -0.92, -0.28],
    system: "Refrigeration",
    purpose: "Filters debris and removes moisture from the liquid refrigerant line.",
    fieldChecks: ["Check for an abnormal temperature drop across the drier under stable operation.", "Inspect for frost or a distinct restriction point.", "Evaluate system contamination history and moisture exposure."],
    commonFailure: "Internal restriction from contamination, moisture loading, debris, or improper installation.",
    nextStep: "A restricted drier should be replaced during a proper sealed-system procedure with recovery, nitrogen practices, evacuation, and weighed charge as required.",
  },
  {
    id: "condenser-coil",
    label: "Condenser Coil",
    aliases: ["Condenser", "Condenser coil"],
    position: [1.35, 0.84, 0.08],
    normal: [0, 1, 0],
    system: "Refrigeration",
    purpose: "Rejects heat from the refrigerant to outdoor air and condenses high-pressure vapor into liquid.",
    fieldChecks: ["Inspect both sides of the coil for dirt, grease, cottonwood, and recirculation problems.", "Confirm condenser-fan operation and correct rotation.", "Use head pressure/subcooling only after airflow is corrected."],
    commonFailure: "Dirty/blocked coil, bent fins, poor fan airflow, recirculation, corrosion/leak, or overcharge symptoms amplified by bad heat rejection.",
    nextStep: "Clean and restore airflow before making refrigerant-charge decisions from high-side pressure.",
  },
  {
    id: "drain",
    label: "Condensate Drain / Trap",
    aliases: ["Drain", "Condensate drain", "Trap"],
    position: [-2.05, -0.45, -1.02],
    system: "Drainage",
    purpose: "Removes condensate from the evaporator drain pan while maintaining the pressure relationship required by the unit design.",
    fieldChecks: ["Inspect pan, drain outlet, trap, venting, slope, and blockage.", "Verify trap dimensions match the negative/positive pressure application.", "Check float or overflow safeties when present."],
    commonFailure: "Blocked drain, missing/incorrect trap, algae/sludge, cracked pan, poor slope, or open overflow safety.",
    nextStep: "Clear the drain and correct trap/slope issues, then confirm the safety circuit has reset and water flows under operating pressure.",
  },
];

export const trainingModelMeta: Record<TrainingModelSlug, TrainingModelMeta> = {
  rtu: { slug: "rtu", title: "Generic Commercial Package RTU", components: rtuComponents },
  "reach-in": { slug: "reach-in", title: "Generic Reach-In Refrigeration", components: [] },
  "ice-machine": { slug: "ice-machine", title: "Generic Commercial Ice Machine", components: [] },
  fryer: { slug: "fryer", title: "Generic Commercial Gas Fryer", components: [] },
};

export function getTrainingModelMeta(slug: TrainingModelSlug) {
  return trainingModelMeta[slug];
}

export function componentMatchesCase(component: TrainingModelComponent, caseComponents: string[]) {
  const normalized = caseComponents.map((item) => item.toLowerCase());
  return component.aliases.some((alias) => normalized.some((item) => item.includes(alias.toLowerCase()) || alias.toLowerCase().includes(item)));
}
