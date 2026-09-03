import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";

export type EquipmentRecord = {
  id: string;
  customerId: string;
  customerName: string;
  equipmentType: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  refrigerant: string | null;
  notes: string | null;
};

export async function getEquipment(limit = 250): Promise<EquipmentRecord[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_equipment").select("id, customer_id, equipment_type, manufacturer, model, serial_number, refrigerant, notes, customer:chillbros_customers(name)").order("created_at", { ascending: false }).limit(limit);
  if (error || !data) return [];
  return data.map((row) => { const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer; return { id: row.id, customerId: row.customer_id, customerName: customer?.name ?? "Unknown customer", equipmentType: row.equipment_type, manufacturer: row.manufacturer, model: row.model, serialNumber: row.serial_number, refrigerant: row.refrigerant, notes: row.notes }; });
}

export async function getEquipmentByCustomer(customerId: string): Promise<EquipmentRecord[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_equipment").select("id, customer_id, equipment_type, manufacturer, model, serial_number, refrigerant, notes, customer:chillbros_customers(name)").eq("customer_id", customerId).order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => { const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer; return { id: row.id, customerId: row.customer_id, customerName: customer?.name ?? "Unknown customer", equipmentType: row.equipment_type, manufacturer: row.manufacturer, model: row.model, serialNumber: row.serial_number, refrigerant: row.refrigerant, notes: row.notes }; });
}
