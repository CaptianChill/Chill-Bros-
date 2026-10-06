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

// Keep the historical ids so saved UI defaults remain compatible, while the
// customer-facing package names match the current Chill Pros sales program.
export const PLAN_STARTERS: PlanStarter[] = [
  {
    id: "basic",
    label: "Silver Essential",
    blurb: "Core coverage · 1 visit",
    title: "Silver Essential Service Plan",
    visitsPerMonth: 1,
    hoursPerVisit: 1.5,
    servicesIncluded: [
      "Scheduled preventive-maintenance visit and normal trip charge included",
      "HVAC / refrigeration visual inspection and operating checks",
      "Thermostat, controls, condensate, belt, coil, gasket, and electrical checks as applicable",
      "Written service report with recommendations",
      "Standard scheduling priority",
    ].join("\n"),
  },
  {
    id: "standard",
    label: "Gold Protection",
    blurb: "Priority value · 1 extended visit",
    title: "Gold Protection Service Plan",
    visitsPerMonth: 1,
    hoursPerVisit: 3,
    servicesIncluded: [
      "Everything included in Silver Essential",
      "Expanded HVAC, refrigeration, ice-machine, and kitchen-equipment checks as selected",
      "Scheduled preventive-maintenance visit and normal trip charge included",
      "Priority scheduling",
      "Detailed service reporting and equipment recommendations",
      "10% repair-labor discount on eligible work",
      "5% discount from standard service-plan parts selling price on eligible repairs",
    ].join("\n"),
  },
  {
    id: "premium",
    label: "Diamond Operations",
    blurb: "Maximum coverage · 2 visits",
    title: "Diamond Operations Service Plan",
    visitsPerMonth: 2,
    hoursPerVisit: 3,
    servicesIncluded: [
      "Everything included in Gold Protection",
      "Two scheduled preventive-maintenance visits per month with normal trip charges included",
      "Full equipment / asset-management focus",
      "Highest service-plan scheduling priority",
      "Detailed condition reporting and repair planning",
      "20% repair-labor discount on eligible work",
      "10% discount from standard service-plan parts selling price on eligible repairs",
    ].join("\n"),
  },
];

export const DEFAULT_PLAN_TERMS =
  "Monthly service is scheduled according to the days, visit frequency, hours, scope, and pricing shown in this agreement. Scheduled preventive-maintenance trips are included when stated in the package. Work outside the included scope, emergency service, specialty parts, or added equipment may be quoted separately. Schedule changes should be coordinated with Chill Pros in advance.";
