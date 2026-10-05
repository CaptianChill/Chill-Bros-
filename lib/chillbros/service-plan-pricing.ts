// Shared, pure pricing + starter packages for custom monthly service plans.
// Used by both the builder screen and the server actions so the total the
// office sees is always the total that gets saved.

export type PlanPricingInput = {
  calculationMode: "hourly" | "flat";
  visitsPerMonth: number | string;
  hoursPerVisit: number | string;
  hourlyRate: number | string;
  monthlyFlatRate: number | string;
  discountType: "percent" | "dollar" | null | "none";
  discountValue: number | string;
};

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculatePlanPricing(input: PlanPricingInput) {
  const visits = Math.max(1, Math.min(31, Math.floor(Number(input.visitsPerMonth) || 1)));
  const hours = Math.max(0, Math.min(24, Number(input.hoursPerVisit) || 0));
  const hourlyRate = Math.max(0, Number(input.hourlyRate) || 0);
  const flat = Math.max(0, Number(input.monthlyFlatRate) || 0);
  const monthlySubtotal = round(input.calculationMode === "flat" ? flat : visits * hours * hourlyRate);
  const rawDiscount = Math.max(0, Number(input.discountValue) || 0);
  const discountAmount = input.discountType === "percent"
    ? round(Math.min(monthlySubtotal, (monthlySubtotal * Math.min(rawDiscount, 100)) / 100))
    : input.discountType === "dollar"
      ? round(Math.min(monthlySubtotal, rawDiscount))
      : 0;
  return { monthlySubtotal, discountAmount, monthlyTotal: round(Math.max(0, monthlySubtotal - discountAmount)) };
}

export type PlanStarter = {
  id: string;
  label: string;
  blurb: string;
  title: string;
  visitsPerMonth: number;
  hoursPerVisit: number;
  servicesIncluded: string;
};

// Starting points only — every field stays editable before saving.
export const PLAN_STARTERS: PlanStarter[] = [
  {
    id: "basic",
    label: "Basic",
    blurb: "1 visit · 1.5 hr",
    title: "Basic Monthly Maintenance Plan",
    visitsPerMonth: 1,
    hoursPerVisit: 1.5,
    servicesIncluded: [
      "Filter check / replacement (filters billed at cost unless included)",
      "Thermostat and controls check",
      "Condensate drain line check",
      "Visual inspection of coils, belts, and electrical connections",
      "Written visit report",
    ].join("\n"),
  },
  {
    id: "standard",
    label: "Standard",
    blurb: "1 visit · 3 hr",
    title: "Standard Monthly Maintenance Plan",
    visitsPerMonth: 1,
    hoursPerVisit: 3,
    servicesIncluded: [
      "Everything in Basic",
      "Refrigerant pressure / temperature checks",
      "Condenser coil cleaning as needed",
      "Walk-in / reach-in cooler and freezer checks",
      "Ice machine inspection",
      "Written visit report with recommendations",
    ].join("\n"),
  },
  {
    id: "premium",
    label: "Premium",
    blurb: "2 visits · 3 hr",
    title: "Premium Monthly Maintenance Plan",
    visitsPerMonth: 2,
    hoursPerVisit: 3,
    servicesIncluded: [
      "Everything in Standard",
      "Twice-monthly visits",
      "Evaporator and condenser coil cleaning",
      "Door gasket, hinge, and seal checks",
      "Kitchen equipment checks",
      "Written visit report with recommendations",
    ].join("\n"),
  },
];

export const DEFAULT_PLAN_TERMS =
  "Monthly service is scheduled according to the days, visit frequency, hours, scope, and pricing shown in this agreement. Work outside the included scope may be quoted separately. Schedule changes should be coordinated with Chill Pros in advance.";
