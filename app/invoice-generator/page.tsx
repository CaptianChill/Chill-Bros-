import { redirect } from "next/navigation";

export default function InvoiceGeneratorPage() {
  redirect("/invoices/new");
}
