"use client";

import { useAutoMigrate } from "@/lib/autoMigrate";

export function AutoMigrateWrapper() {
  useAutoMigrate();
  return null;
}
