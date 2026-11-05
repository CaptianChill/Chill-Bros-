"use server";

import { isOwner } from "@/lib/auth";
import { markCall } from "@/lib/db";

const STATUSES = new Set(["", "called", "callback", "interested", "sold", "not_interested", "wrong_number"]);

export async function saveCall(license: string, name: string, status: string, note = "") {
  if (!(await isOwner()) || !STATUSES.has(status) || !license) return false;
  return markCall(license, name, status, note);
}
