import { z } from "zod";

import { createClient } from "@/lib/supabase/client";
import {
  organizationLevelSchema,
  revenueTargetAmountToBahtText,
  revenueTargetFormSchema,
  serviceLevelSchema,
  type RevenueTargetFormValues,
} from "@/lib/targets/revenue-targets";

const revenueTargetSchema = z.object({
  id: z.string().uuid(),
  targetYear: z.number().int(),
  organizationLevel: organizationLevelSchema,
  groupCode: z.string().nullable(),
  unitName: z.string().nullable(),
  sectionName: z.string().nullable(),
  organizationLabel: z.string(),
  serviceLevel: serviceLevelSchema,
  businessGroup: z.string().nullable(),
  serviceGroup: z.string().nullable(),
  serviceLabel: z.string(),
  targetAmountBaht: z.string(),
  targetAmountMillion: z.string(),
  actualRevenueBaht: z.string().nullable(),
  remainingAmountBaht: z.string().nullable(),
  achievementPercent: z.string().nullable(),
  dimensionAvailable: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const revenueTargetSetupSchema = z.object({
  targetYear: z.number().int(),
  hasYearData: z.boolean(),
  throughMonth: z.number().int().min(1).max(12).nullable(),
  optionsSourceYear: z.number().int().nullable(),
  yearOptions: z.array(z.number().int()),
  groups: z.array(z.object({ code: z.string(), name: z.string(), label: z.string() })),
  units: z.array(z.object({ name: z.string(), groupCode: z.string().nullable() })),
  sections: z.array(z.object({ unitName: z.string(), name: z.string() })),
  businessGroups: z.array(z.string()),
  serviceGroups: z.array(z.object({ businessGroup: z.string(), name: z.string() })),
  targets: z.array(revenueTargetSchema),
});

export type RevenueTarget = z.infer<typeof revenueTargetSchema>;
export type RevenueTargetSetup = z.infer<typeof revenueTargetSetupSchema>;

export async function fetchRevenueTargetSetup(
  year: number,
  signal?: AbortSignal
): Promise<RevenueTargetSetup> {
  const { data, error } = await createClient()
    .rpc("get_revenue_target_setup", { p_year: year })
    .abortSignal(signal ?? new AbortController().signal);

  if (error) throw new Error(error.message);
  return revenueTargetSetupSchema.parse(data);
}

export async function saveRevenueTarget(input: {
  id: string | null;
  targetYear: number;
  values: RevenueTargetFormValues;
}): Promise<void> {
  const values = revenueTargetFormSchema.parse(input.values);
  const { error } = await createClient().rpc("save_revenue_target", {
    p_target_id: input.id,
    p_target_year: input.targetYear,
    p_organization_level: values.organizationLevel,
    p_group_code: values.organizationLevel === "group" ? values.groupCode : null,
    p_unit_name: ["unit", "section"].includes(values.organizationLevel) ? values.unitName : null,
    p_section_name: values.organizationLevel === "section" ? values.sectionName : null,
    p_service_level: values.serviceLevel,
    p_business_group: ["business_group", "service_group"].includes(values.serviceLevel)
      ? values.businessGroup
      : null,
    p_service_group: values.serviceLevel === "service_group" ? values.serviceGroup : null,
    p_target_amount_text: revenueTargetAmountToBahtText(
      values.targetAmount,
      values.targetAmountUnit
    ),
  });

  if (error) throw new Error(error.message);
}

export async function deleteRevenueTarget(id: string): Promise<void> {
  const { error } = await createClient().rpc("delete_revenue_target", { p_target_id: id });
  if (error) throw new Error(error.message);
}
