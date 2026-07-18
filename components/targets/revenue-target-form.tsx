"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SaveIcon, XIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import {
  saveRevenueTarget,
  type RevenueTarget,
  type RevenueTargetSetup,
} from "@/lib/query/revenue-targets";
import { formatMoney } from "@/lib/revenue/formatters";
import {
  bahtTextToRevenueTargetInput,
  emptyRevenueTargetForm,
  getRevenueTargetErrorMessage,
  revenueTargetAmountToBahtText,
  revenueTargetFormSchema,
  targetToFormValues,
  type RevenueTargetFormValues,
} from "@/lib/targets/revenue-targets";

function optionWithCurrent(options: string[], current: string): string[] {
  return current && !options.includes(current) ? [current, ...options] : options;
}

const targetAmountUnitOptions = [
  { value: "million_baht", label: "ล้านบาท" },
  { value: "baht", label: "บาท" },
] as const;

export function RevenueTargetForm({
  setup,
  editingTarget,
  onFinished,
}: {
  setup: RevenueTargetSetup;
  editingTarget: RevenueTarget | null;
  onFinished: () => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<RevenueTargetFormValues>({
    defaultValues: emptyRevenueTargetForm,
  });

  useEffect(() => {
    form.reset(editingTarget ? targetToFormValues(editingTarget) : emptyRevenueTargetForm);
  }, [editingTarget, form]);

  const organizationLevel = useWatch({ control: form.control, name: "organizationLevel" });
  const unitName = useWatch({ control: form.control, name: "unitName" });
  const serviceLevel = useWatch({ control: form.control, name: "serviceLevel" });
  const businessGroup = useWatch({ control: form.control, name: "businessGroup" });
  const targetAmountUnit = useWatch({ control: form.control, name: "targetAmountUnit" });
  const targetAmount = useWatch({ control: form.control, name: "targetAmount" });

  const sections = useMemo(
    () => setup.sections.filter((item) => item.unitName === unitName).map((item) => item.name),
    [setup.sections, unitName]
  );
  const serviceGroups = useMemo(
    () =>
      setup.serviceGroups
        .filter((item) => item.businessGroup === businessGroup)
        .map((item) => item.name),
    [businessGroup, setup.serviceGroups]
  );

  const amountPreview = useMemo(() => {
    if (!targetAmount) return null;
    try {
      const amountBaht = revenueTargetAmountToBahtText(targetAmount, targetAmountUnit);
      if (targetAmountUnit === "million_baht") {
        return `เท่ากับ ${formatMoney(amountBaht)} บาท`;
      }
      return `เท่ากับ ${formatMoney(
        bahtTextToRevenueTargetInput(amountBaht, "million_baht")
      )} ล้านบาท`;
    } catch {
      return null;
    }
  }, [targetAmount, targetAmountUnit]);

  const targetAmountUnitLabel = targetAmountUnit === "million_baht" ? "ล้านบาท" : "บาท";

  const mutation = useMutation({
    mutationFn: (values: RevenueTargetFormValues) =>
      saveRevenueTarget({
        id: editingTarget?.id ?? null,
        targetYear: setup.targetYear,
        values,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["revenue-targets", setup.targetYear] });
      toast.success(editingTarget ? "แก้ไขเป้าหมายแล้ว" : "บันทึกเป้าหมายแล้ว");
      form.reset(emptyRevenueTargetForm);
      onFinished();
    },
    onError: (error) =>
      toast.error("บันทึกเป้าหมายไม่สำเร็จ", {
        description: getRevenueTargetErrorMessage(error.message),
      }),
  });

  const currentUnit = form.getValues("unitName");
  const currentSection = form.getValues("sectionName");
  const currentBusinessGroup = form.getValues("businessGroup");
  const currentServiceGroup = form.getValues("serviceGroup");

  function submit(values: RevenueTargetFormValues) {
    form.clearErrors();
    const result = revenueTargetFormSchema.safeParse(values);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const fieldName = issue.path[0];
        if (
          typeof fieldName === "string" &&
          Object.prototype.hasOwnProperty.call(emptyRevenueTargetForm, fieldName)
        ) {
          form.setError(fieldName as keyof RevenueTargetFormValues, {
            type: "validate",
            message: issue.message,
          });
        }
      }
      return;
    }
    mutation.mutate(result.data);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editingTarget ? "แก้ไขเป้าหมาย" : "เพิ่มเป้าหมาย"}</CardTitle>
        <CardDescription>
          เลือกขอบเขตที่ต้องการตั้งเป้าหมาย ไม่จำเป็นต้องกำหนดให้ครบทุกหน่วยงานหรือทุกบริการ
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(submit)} noValidate>
          <FieldGroup>
            <Controller
              control={form.control}
              name="organizationLevel"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="target-organization-level">ระดับส่วนงาน</FieldLabel>
                  <NativeSelect
                    id="target-organization-level"
                    className="w-full"
                    value={field.value}
                    aria-invalid={fieldState.invalid}
                    onChange={(event) => {
                      field.onChange(event.target.value);
                      form.setValue("groupCode", "");
                      form.setValue("unitName", "");
                      form.setValue("sectionName", "");
                    }}
                  >
                    <NativeSelectOption value="group">กลุ่ม</NativeSelectOption>
                    <NativeSelectOption value="unit">ฝ่าย</NativeSelectOption>
                    <NativeSelectOption value="section">ส่วนงาน</NativeSelectOption>
                  </NativeSelect>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            {organizationLevel === "group" ? (
              <Controller
                control={form.control}
                name="groupCode"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="target-group">กลุ่ม</FieldLabel>
                    <NativeSelect
                      id="target-group"
                      className="w-full"
                      {...field}
                      aria-invalid={fieldState.invalid}
                    >
                      <NativeSelectOption value="" disabled>
                        เลือกกลุ่ม
                      </NativeSelectOption>
                      {setup.groups.map((group) => (
                        <NativeSelectOption key={group.code} value={group.code}>
                          {group.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            ) : (
              <Controller
                control={form.control}
                name="unitName"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="target-unit">ฝ่าย</FieldLabel>
                    <NativeSelect
                      id="target-unit"
                      className="w-full"
                      value={field.value}
                      aria-invalid={fieldState.invalid}
                      onChange={(event) => {
                        field.onChange(event.target.value);
                        form.setValue("sectionName", "");
                      }}
                    >
                      <NativeSelectOption value="" disabled>
                        เลือกฝ่าย
                      </NativeSelectOption>
                      {optionWithCurrent(
                        setup.units.map((unit) => unit.name),
                        currentUnit
                      ).map((unit) => (
                        <NativeSelectOption key={unit} value={unit}>
                          {unit}
                          {setup.units.some((item) => item.name === unit)
                            ? ""
                            : " (ไม่อยู่ในข้อมูลอ้างอิง)"}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            )}

            {organizationLevel === "section" ? (
              <Controller
                control={form.control}
                name="sectionName"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="target-section">ส่วนงาน</FieldLabel>
                    <NativeSelect
                      id="target-section"
                      className="w-full"
                      {...field}
                      disabled={!unitName}
                      aria-invalid={fieldState.invalid}
                    >
                      <NativeSelectOption value="" disabled>
                        {unitName ? "เลือกส่วนงาน" : "เลือกฝ่ายก่อน"}
                      </NativeSelectOption>
                      {optionWithCurrent(sections, currentSection).map((section) => (
                        <NativeSelectOption key={section} value={section}>
                          {section}
                          {sections.includes(section) ? "" : " (ไม่อยู่ในข้อมูลอ้างอิง)"}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            ) : null}

            <Controller
              control={form.control}
              name="serviceLevel"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="target-service-level">ขอบเขตบริการ</FieldLabel>
                  <NativeSelect
                    id="target-service-level"
                    className="w-full"
                    value={field.value}
                    aria-invalid={fieldState.invalid}
                    onChange={(event) => {
                      field.onChange(event.target.value);
                      form.setValue("businessGroup", "");
                      form.setValue("serviceGroup", "");
                    }}
                  >
                    <NativeSelectOption value="all">ทุกบริการรวมกัน</NativeSelectOption>
                    <NativeSelectOption value="business_group">กลุ่มธุรกิจ</NativeSelectOption>
                    <NativeSelectOption value="service_group">กลุ่มบริการ</NativeSelectOption>
                  </NativeSelect>
                  <FieldDescription>
                    “ทุกบริการรวมกัน” คือเป้าหมายรวมทุกบริการของส่วนงานที่เลือก
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            {serviceLevel !== "all" ? (
              <Controller
                control={form.control}
                name="businessGroup"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="target-business-group">กลุ่มธุรกิจ</FieldLabel>
                    <NativeSelect
                      id="target-business-group"
                      className="w-full"
                      value={field.value}
                      aria-invalid={fieldState.invalid}
                      onChange={(event) => {
                        field.onChange(event.target.value);
                        form.setValue("serviceGroup", "");
                      }}
                    >
                      <NativeSelectOption value="" disabled>
                        เลือกกลุ่มธุรกิจ
                      </NativeSelectOption>
                      {optionWithCurrent(setup.businessGroups, currentBusinessGroup).map(
                        (group) => (
                          <NativeSelectOption key={group} value={group}>
                            {group}
                            {setup.businessGroups.includes(group)
                              ? ""
                              : " (ไม่อยู่ในข้อมูลอ้างอิง)"}
                          </NativeSelectOption>
                        )
                      )}
                    </NativeSelect>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            ) : null}

            {serviceLevel === "service_group" ? (
              <Controller
                control={form.control}
                name="serviceGroup"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="target-service-group">กลุ่มบริการ</FieldLabel>
                    <NativeSelect
                      id="target-service-group"
                      className="w-full"
                      {...field}
                      disabled={!businessGroup}
                      aria-invalid={fieldState.invalid}
                    >
                      <NativeSelectOption value="" disabled>
                        {businessGroup ? "เลือกกลุ่มบริการ" : "เลือกกลุ่มธุรกิจก่อน"}
                      </NativeSelectOption>
                      {optionWithCurrent(serviceGroups, currentServiceGroup).map((group) => (
                        <NativeSelectOption key={group} value={group}>
                          {group}
                          {serviceGroups.includes(group) ? "" : " (ไม่อยู่ในข้อมูลอ้างอิง)"}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            ) : null}

            <Controller
              control={form.control}
              name="targetAmountUnit"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldTitle>หน่วยที่กรอกเป้าหมาย</FieldTitle>
                  <div
                    role="radiogroup"
                    aria-label="หน่วยที่กรอกเป้าหมาย"
                    className="grid grid-cols-2 gap-2"
                  >
                    {targetAmountUnitOptions.map((unit) => (
                      <label
                        key={unit.value}
                        className="relative flex min-h-10 cursor-pointer items-center justify-center rounded-lg border border-input px-3 py-2 text-sm font-medium transition-colors has-checked:border-primary has-checked:bg-primary/10 has-checked:text-primary hover:bg-muted/60"
                      >
                        <input
                          ref={unit.value === "million_baht" ? field.ref : undefined}
                          type="radio"
                          className="sr-only"
                          name={field.name}
                          value={unit.value}
                          checked={field.value === unit.value}
                          onBlur={field.onBlur}
                          onChange={() => {
                            if (field.value === unit.value) return;
                            field.onChange(unit.value);
                            form.setValue("targetAmount", "", {
                              shouldDirty: true,
                              shouldValidate: false,
                            });
                            form.clearErrors("targetAmount");
                          }}
                        />
                        {unit.label}
                      </label>
                    ))}
                  </div>
                  <FieldDescription>
                    หากเปลี่ยนหน่วย ระบบจะล้างจำนวนเงินที่กรอกไว้เพื่อป้องกันการบันทึกผิดหน่วย
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="targetAmount"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="target-amount">
                    เป้าหมายรายได้ทั้งปี ({targetAmountUnitLabel})
                  </FieldLabel>
                  <div className="relative">
                    <Input
                      id="target-amount"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder={
                        targetAmountUnit === "million_baht" ? "เช่น 26.36" : "เช่น 26,360,000"
                      }
                      className="pr-24 text-right font-mono tabular-nums"
                      {...field}
                      aria-invalid={fieldState.invalid}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
                      {targetAmountUnitLabel}
                    </span>
                  </div>
                  <FieldDescription>
                    {amountPreview ?? `กรอกเป็นหน่วย${targetAmountUnitLabel}`}
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <div className="flex flex-wrap justify-end gap-2">
              {editingTarget ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={onFinished}
                >
                  <XIcon data-icon="inline-start" />
                  ยกเลิกแก้ไข
                </Button>
              ) : null}
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <SaveIcon data-icon="inline-start" />
                )}
                {editingTarget ? "บันทึกการแก้ไข" : "เพิ่มเป้าหมาย"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
