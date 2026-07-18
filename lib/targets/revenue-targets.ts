import Decimal from "decimal.js";
import { z } from "zod";

export const organizationLevelSchema = z.enum(["group", "unit", "section"]);
export const serviceLevelSchema = z.enum(["all", "business_group", "service_group"]);
export const targetAmountUnitSchema = z.enum(["million_baht", "baht"]);

export const revenueTargetFormSchema = z
  .object({
    organizationLevel: organizationLevelSchema,
    groupCode: z.string(),
    unitName: z.string(),
    sectionName: z.string(),
    serviceLevel: serviceLevelSchema,
    businessGroup: z.string(),
    serviceGroup: z.string(),
    targetAmountUnit: targetAmountUnitSchema,
    targetAmount: z.string().trim().min(1, "กรุณาระบุเป้าหมายรายได้"),
  })
  .superRefine((value, context) => {
    if (value.organizationLevel === "group" && !value.groupCode) {
      context.addIssue({ code: "custom", path: ["groupCode"], message: "กรุณาเลือกกลุ่ม" });
    }
    if (["unit", "section"].includes(value.organizationLevel) && !value.unitName) {
      context.addIssue({ code: "custom", path: ["unitName"], message: "กรุณาเลือกฝ่าย" });
    }
    if (value.organizationLevel === "section" && !value.sectionName) {
      context.addIssue({ code: "custom", path: ["sectionName"], message: "กรุณาเลือกส่วนงาน" });
    }
    if (["business_group", "service_group"].includes(value.serviceLevel) && !value.businessGroup) {
      context.addIssue({
        code: "custom",
        path: ["businessGroup"],
        message: "กรุณาเลือกกลุ่มธุรกิจ",
      });
    }
    if (value.serviceLevel === "service_group" && !value.serviceGroup) {
      context.addIssue({
        code: "custom",
        path: ["serviceGroup"],
        message: "กรุณาเลือกกลุ่มบริการ",
      });
    }

    try {
      revenueTargetAmountToBahtText(value.targetAmount, value.targetAmountUnit);
    } catch {
      context.addIssue({
        code: "custom",
        path: ["targetAmount"],
        message: value.targetAmount.trim()
          ? "เป้าหมายต้องเป็นจำนวนเงินที่ถูกต้องและมากกว่า 0"
          : "กรุณาระบุเป้าหมายรายได้",
      });
    }
  });

export type RevenueTargetFormValues = z.infer<typeof revenueTargetFormSchema>;

export const emptyRevenueTargetForm: RevenueTargetFormValues = {
  organizationLevel: "group",
  groupCode: "",
  unitName: "",
  sectionName: "",
  serviceLevel: "all",
  businessGroup: "",
  serviceGroup: "",
  targetAmountUnit: "million_baht",
  targetAmount: "",
};

function normalizeDecimalInput(value: string): string {
  return value.trim().replaceAll(",", "");
}

export function revenueTargetAmountToBahtText(
  value: string,
  unit: RevenueTargetFormValues["targetAmountUnit"]
): string {
  const amount = new Decimal(normalizeDecimalInput(value));
  if (!amount.isFinite() || amount.lte(0)) {
    throw new Error("TARGET_AMOUNT_MUST_BE_POSITIVE");
  }
  const amountBaht = unit === "million_baht" ? amount.mul(1_000_000) : amount;
  return amountBaht.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function bahtTextToRevenueTargetInput(
  value: string,
  unit: RevenueTargetFormValues["targetAmountUnit"]
): string {
  const amountBaht = new Decimal(normalizeDecimalInput(value));
  if (!amountBaht.isFinite() || amountBaht.lte(0)) {
    throw new Error("TARGET_AMOUNT_MUST_BE_POSITIVE");
  }
  const amount = unit === "million_baht" ? amountBaht.div(1_000_000) : amountBaht;
  return amount.toFixed(amount.decimalPlaces());
}

export function targetToFormValues(target: {
  organizationLevel: RevenueTargetFormValues["organizationLevel"];
  groupCode: string | null;
  unitName: string | null;
  sectionName: string | null;
  serviceLevel: RevenueTargetFormValues["serviceLevel"];
  businessGroup: string | null;
  serviceGroup: string | null;
  targetAmountBaht: string;
}): RevenueTargetFormValues {
  return {
    organizationLevel: target.organizationLevel,
    groupCode: target.groupCode ?? "",
    unitName: target.unitName ?? "",
    sectionName: target.sectionName ?? "",
    serviceLevel: target.serviceLevel,
    businessGroup: target.businessGroup ?? "",
    serviceGroup: target.serviceGroup ?? "",
    targetAmountUnit: "million_baht",
    targetAmount: bahtTextToRevenueTargetInput(target.targetAmountBaht, "million_baht"),
  };
}

const targetErrorMessages: Record<string, string> = {
  WRITE_ACCESS_REQUIRED: "บัญชีนี้ไม่มีสิทธิ์แก้ไขเป้าหมายรายได้",
  INVALID_TARGET_YEAR: "ปีเป้าหมายไม่ถูกต้อง",
  INVALID_TARGET_AMOUNT: "จำนวนเงินเป้าหมายไม่ถูกต้อง",
  TARGET_AMOUNT_MUST_BE_POSITIVE: "เป้าหมายต้องมากกว่า 0",
  GROUP_REQUIRED: "กรุณาเลือกกลุ่ม",
  UNIT_REQUIRED: "กรุณาเลือกฝ่าย",
  SECTION_REQUIRED: "กรุณาเลือกส่วนงาน",
  BUSINESS_GROUP_REQUIRED: "กรุณาเลือกกลุ่มธุรกิจ",
  SERVICE_GROUP_REQUIRED: "กรุณาเลือกกลุ่มบริการ",
  GROUP_NOT_FOUND: "ไม่พบกลุ่มที่เลือก",
  UNIT_NOT_FOUND: "ไม่พบฝ่ายที่เลือกในชุดข้อมูลอ้างอิง",
  SECTION_NOT_FOUND: "ไม่พบส่วนงานที่เลือกในชุดข้อมูลอ้างอิง",
  BUSINESS_GROUP_NOT_FOUND: "ไม่พบกลุ่มธุรกิจที่เลือกในชุดข้อมูลอ้างอิง",
  SERVICE_GROUP_NOT_FOUND: "ไม่พบกลุ่มบริการที่เลือกในชุดข้อมูลอ้างอิง",
  TARGET_NOT_FOUND: "ไม่พบเป้าหมายที่ต้องการแก้ไข",
  TARGET_SCOPE_ALREADY_EXISTS: "มีเป้าหมายของขอบเขตนี้อยู่แล้ว",
};

export function getRevenueTargetErrorMessage(message: string): string {
  const code = Object.keys(targetErrorMessages).find((key) => message.includes(key));
  return code ? targetErrorMessages[code] : message;
}
