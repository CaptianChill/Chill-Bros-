import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CustomerFrame, money, shortDate } from "@/components/customer-account/customer-frame";
import { CustomerSignOutButton } from "@/components/customer-account/sign-out-button";
import { getCustomerSession } from "@/lib/chillbros/customer-account";
import { getCustomerHome } from "@/lib/chillbros/customer-home-queries";

export async function AccountRecords({ section }: { section: "equipment" | "plans" | "billing" }) {
  const session = await getCustomerSession();
  if (!session) redirect("/my/sign-in");
  if (!session.customerIds.length) redirect("/my/welcome");
  const home = await getCustomerHome(session.customerIds);
  const title = { equipment: "Equipment & service history", plans: "Your monthly programs", billing: "Invoices & quotes" }[section];
  return <CustomerFrame accountName={home.locations[0]?.name ?? session.email} right={<CustomerSignOutButton />}>
    <h1 className="mb-5 text-3xl font-bold">{title}</h1>
    <div className="space-y-4">
      {section === "equipment" ? <>
        <Card title="Your equipment">{home.units.length ? <ul className="divide-y divide-[#D3E1F2]">{home.units.map((unit) => <li key={unit.id}><Link href={`/my/equipment/${unit.id}`} className="block py-4"><p className="font-bold text-[#1452C2]">{unit.name}{unit.tag ? ` · ${unit.tag}` : ""}</p><p>{unit.detail}</p><p className="text-sm text-[#3D5170]">{unit.customerName}{unit.lastService ? ` · Last service ${shortDate(unit.lastService)}` : ""}</p><p className="mt-1 text-sm font-semibold text-[#1452C2]">View unit history →</p></Link></li>)}</ul> : <p>No equipment has been added to your account yet.</p>}</Card>
        <Card title="Service history">{home.history.length ? <ul className="divide-y divide-[#D3E1F2]">{home.history.map((visit) => <li key={visit.id} className="py-3"><p className="font-semibold">{visit.title}</p><p className="text-sm text-[#3D5170]">{shortDate(visit.date)}{visit.unit ? ` · ${visit.unit}` : ""}</p></li>)}</ul> : <p>No completed service visits are recorded yet.</p>}</Card>
      </> : null}
      {section === "plans" ? <Card title="Custom service programs">{home.plans.length ? <ul className="divide-y divide-[#D3E1F2]">{home.plans.map((plan) => <li key={plan.id} className="py-4"><p className="font-bold">{plan.title}</p><p className="mt-1">{plan.detail}</p><p className="text-sm text-[#3D5170]">{plan.customerName} · {plan.status}</p>{plan.token ? <Link href={`/agreement/${plan.token}`} className="mt-3 inline-block rounded-xl bg-[#1F6FEB] px-4 py-2 font-semibold text-white">View schedule, pricing & terms</Link> : <p className="mt-2 text-sm">Contact Chill Pros for your program details.</p>}</li>)}</ul> : <p>No monthly program is assigned to your account yet. Contact Chill Pros to set up your custom program.</p>}</Card> : null}
      {section === "billing" ? <>
        <Card title="Open invoices & quotes">{home.due.length ? <ul className="divide-y divide-[#D3E1F2]">{home.due.map((document) => <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-bold">{document.kind} {document.number} · {money(document.amount)}</p><p className="text-sm text-[#3D5170]">{document.label}</p></div><Link href={`/portal/${document.token}`} className="rounded-xl bg-[#1F6FEB] px-4 py-3 font-semibold text-white">{document.action === "approve" ? "Review & approve" : document.action === "down_payment" ? "Pay deposit" : "Pay now"}</Link></li>)}</ul> : <p>You have no invoices or quotes requiring action.</p>}</Card>
        <Card title="Paid invoices">{home.paid.length ? <ul className="divide-y divide-[#D3E1F2]">{home.paid.map((document) => <li key={document.id}><Link href={`/portal/${document.token}`} className="block py-3 font-semibold text-[#1452C2]">{document.number} · {money(document.amount)}<span className="block text-sm font-normal text-[#3D5170]">Paid {shortDate(document.paidAt)} · View receipt</span></Link></li>)}</ul> : <p>No paid invoices are recorded yet.</p>}</Card>
      </> : null}
    </div>
  </CustomerFrame>;
}
