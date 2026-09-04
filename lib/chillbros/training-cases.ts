export type TrainingCase = {
  id: string;
  title: string;
  category: "HVAC" | "Refrigeration" | "Ice Machine" | "Cooking Equipment";
  equipment: string;
  symptoms: string[];
  readings: string[];
  diagnosis: string;
  likelyCauses: string[];
  steps: string[];
  components: string[];
  tags: string[];
  safety: string;
};

export const trainingCases: TrainingCase[] = [
  {
    id: "hvac-contactor-zero-across-coil",
    title: "24V to ground on both contactor coil terminals, 0V across coil",
    category: "HVAC",
    equipment: "Split system / package unit low-voltage control circuit",
    symptoms: ["Thermostat calling but contactor will not pull in", "24V indicated from each coil terminal to common/ground reference", "0V measured directly across contactor coil"],
    readings: ["A1 to A2: 0 VAC", "A1 to common: about 24 VAC", "A2 to common: about 24 VAC"],
    diagnosis: "The coil does not have a usable voltage difference across it. Both terminals are sitting at essentially the same potential, so the problem is upstream in the control/safety path or reference point rather than proof of a failed contactor coil.",
    likelyCauses: ["Open or miswired low-voltage return path", "Safety or pressure-switch circuit issue", "Thermostat/control-board wiring error", "Backfeed causing misleading readings to ground/common"],
    steps: ["Verify transformer R-to-C voltage first", "Measure directly across the contactor coil, not only each side to ground", "Trace the call from Y through every safety and control device", "Measure voltage across each safety; voltage across an open device identifies the break", "Correct the open/miswire, then recheck 24V across the contactor coil"],
    components: ["Transformer", "Thermostat Y", "Control board", "High-pressure switch", "Low-pressure switch", "Contactor coil"],
    tags: ["24v", "contactor", "no cooling", "low voltage", "thermostat"],
    safety: "Confirm meter reference and de-energize equipment before moving conductors. Line voltage remains present at the contactor even when the coil is not energized.",
  },
  {
    id: "refrigeration-restriction",
    title: "Restricted refrigeration circuit / starved evaporator pattern",
    category: "Refrigeration",
    equipment: "Commercial reach-in cooler or freezer",
    symptoms: ["Poor cooling", "Low suction pressure", "Evaporator not feeding evenly", "Possible temperature drop across restriction"],
    readings: ["Verify superheat and subcooling", "Check temperature before and after filter drier / metering device", "Confirm condenser airflow before condemning sealed-system parts"],
    diagnosis: "A restriction can starve the evaporator and mimic low charge. Confirm airflow and charge indicators before opening the sealed system.",
    likelyCauses: ["Restricted filter drier", "Restricted capillary tube", "TXV restriction", "Contamination or moisture in system"],
    steps: ["Verify condenser and evaporator airflow", "Record pressures, superheat, subcooling, and line temperatures", "Look for a temperature drop or frost point at the restriction", "Recover refrigerant if sealed-system repair is required", "Replace restricted component/drier, evacuate deeply, and weigh in charge"],
    components: ["Compressor", "Condenser", "Filter drier", "Metering device", "Evaporator"],
    tags: ["restriction", "low suction", "capillary", "txv", "filter drier"],
    safety: "Follow refrigerant recovery requirements and verify system refrigerant before service. Do not use pressure alone to identify charge or restriction.",
  },
  {
    id: "ice-machine-e1-sensor",
    title: "Ice machine temperature-probe / E1 style diagnostic",
    category: "Ice Machine",
    equipment: "Commercial ice machine with NTC temperature sensing",
    symptoms: ["E1 or sensor-related fault", "Machine stops cycle or behaves erratically", "Temperature reading does not match actual condition"],
    readings: ["Disconnect probe and compare resistance to manufacturer temperature/resistance chart", "Inspect connector and harness for corrosion or broken conductors"],
    diagnosis: "A sensor code should be proven with resistance and wiring checks before replacing the controller.",
    likelyCauses: ["Failed NTC probe", "Open/shorted sensor wiring", "Wet or corroded connector", "Control-board input fault"],
    steps: ["Power down equipment", "Inspect probe and wiring", "Measure probe resistance", "Compare reading with expected value at measured temperature", "Substitute a known-good probe when appropriate before condemning board"],
    components: ["Temperature probe", "Sensor harness", "Control board", "Evaporator"],
    tags: ["e1", "probe", "sensor", "ntc", "ice machine"],
    safety: "Disconnect power before unplugging board or sensor connectors and follow manufacturer procedures for live-voltage checks.",
  },
  {
    id: "cooking-gas-ignition",
    title: "Commercial fryer / oven will not ignite",
    category: "Cooking Equipment",
    equipment: "Commercial gas fryer, oven, range, or griddle",
    symptoms: ["Call for heat but no main burner", "Pilot may be present or intermittent", "Ignition sequence stops before flame"],
    readings: ["Verify correct supply voltage where applicable", "Verify gas supply and inlet pressure per manufacturer", "Check flame-safety / thermocouple / ignition signal"],
    diagnosis: "Treat no-ignition as a sequence-of-operation problem. Identify the exact step where the sequence stops instead of replacing the gas valve by guesswork.",
    likelyCauses: ["Igniter or pilot issue", "Thermocouple / flame-safety fault", "High-limit open", "Gas valve not receiving command", "Control or thermostat fault"],
    steps: ["Confirm gas supply and safe operating conditions", "Identify ignition type and sequence", "Verify thermostat/call for heat", "Check high limit and safeties", "Verify ignition source", "Verify command to gas valve before condemning valve"],
    components: ["Thermostat", "High limit", "Igniter / pilot", "Flame safety", "Gas valve", "Burner"],
    tags: ["fryer", "oven", "gas valve", "ignition", "no heat"],
    safety: "Gas equipment requires leak checks and manufacturer combustion procedures. Stop if gas odor, unsafe combustion, or damaged safety controls are present.",
  },
];
