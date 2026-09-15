#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

const sourceFiles = [];
for (const root of ["app", "lib"]) walk(root);

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if ([".ts", ".tsx"].includes(extname(path))) sourceFiles.push(path);
  }
}

const violations = [];
for (const path of sourceFiles) {
  const source = readFileSync(path, "utf8");
  if (source.includes("tech:chillbros_profiles(full_name)")) {
    violations.push(`${path}: ambiguous technician relationship`);
  }
  if (source.includes("supabase.auth.admin")) {
    violations.push(`${path}: legacy Supabase Auth admin call`);
  }
}

const technicianQueue = readFileSync("lib/chillbros/technician-assignment.ts", "utf8");
if (!technicianQueue.includes('.eq("assigned_tech_id",profile.id)')) {
  violations.push("technician assignment must use the canonical staff profile id");
}
for (const forbidden of ["candidateIds", "aliases=", "normalize(profile.email)"]) {
  if (technicianQueue.includes(forbidden)) {
    violations.push(`technician assignment contains legacy identity fallback: ${forbidden}`);
  }
}

const operations = readFileSync("lib/chillbros/operations-queries.ts", "utf8");
if (operations.includes("reconcileTechnicianAssignmentsAndNotifications")) {
  violations.push("read path must not mutate or reconcile technician assignments");
}

const recovery = readFileSync("app/forgot-password/page.tsx", "utf8");
for (const forbidden of ["auth.signUp.email", "OWNER_EMAIL", "createOwnerPassword"]) {
  if (recovery.includes(forbidden)) {
    violations.push(`public recovery page contains unsafe owner bootstrap: ${forbidden}`);
  }
}

if (violations.length) {
  console.error("Identity contract check failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Identity contract check passed across ${sourceFiles.length} application files.`);
