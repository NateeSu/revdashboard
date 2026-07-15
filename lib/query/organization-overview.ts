import { z } from "zod";

import { createClient } from "@/lib/supabase/client";

const topSectionSchema = z.object({
  rank: z.number(),
  unitName: z.string(),
  sectionName: z.string(),
  revenue: z.string(),
});

const organizationGroupSchema = z.object({
  code: z.string(),
  name: z.string(),
  label: z.string(),
  currentYtdRevenue: z.string(),
  sharePercent: z.string().nullable(),
  currentComparisonRevenue: z.string(),
  previousComparisonRevenue: z.string(),
  difference: z.string(),
  differencePercent: z.string().nullable(),
  topSections: z.array(topSectionSchema),
});

const organizationOverviewSchema = z.object({
  reportYear: z.number(),
  previousYear: z.number(),
  throughMonth: z.number(),
  comparisonThroughMonth: z.number(),
  hasPreviousYear: z.boolean(),
  totalYtdRevenue: z.string(),
  mappedYtdRevenue: z.string(),
  groups: z.array(organizationGroupSchema),
  unmapped: z.object({
    currentYtdRevenue: z.string(),
    sharePercent: z.string().nullable(),
    sectionCount: z.number(),
    unitNames: z.array(z.string()),
  }),
});

export type OrganizationOverview = z.infer<typeof organizationOverviewSchema>;

export async function fetchOrganizationOverview(
  year: number,
  signal?: AbortSignal
): Promise<OrganizationOverview> {
  const { data, error } = await createClient()
    .rpc("get_organization_overview_report", { p_year: year })
    .abortSignal(signal ?? new AbortController().signal);

  if (error) throw new Error(error.message);
  return organizationOverviewSchema.parse(data);
}
