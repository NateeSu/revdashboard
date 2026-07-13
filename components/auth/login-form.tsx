"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon, LogInIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.email("กรุณากรอกอีเมลให้ถูกต้อง"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<LoginValues>({
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "email" || field === "password")
          form.setError(field, { message: issue.message });
      }
      return;
    }
    try {
      const { error } = await createClient().auth.signInWithPassword(parsed.data);
      if (error) {
        form.setError("root", { message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
        return;
      }
      toast.success("เข้าสู่ระบบสำเร็จ");
      const next = searchParams.get("next");
      router.replace(next?.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch {
      form.setError("root", {
        message: "ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนได้ กรุณาตรวจสอบการตั้งค่าแล้วลองอีกครั้ง",
      });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(form.formState.errors.email)}>
          <FieldLabel htmlFor="email">อีเมล</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="owner@example.com"
            aria-invalid={Boolean(form.formState.errors.email)}
            {...form.register("email")}
          />
          <FieldError>{form.formState.errors.email?.message}</FieldError>
        </Field>
        <Field data-invalid={Boolean(form.formState.errors.password)}>
          <FieldLabel htmlFor="password">รหัสผ่าน</FieldLabel>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="pr-10"
              aria-invalid={Boolean(form.formState.errors.password)}
              {...form.register("password")}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1 -translate-y-1/2"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </Button>
          </div>
          <FieldError>{form.formState.errors.password?.message}</FieldError>
        </Field>
        <FieldError>{form.formState.errors.root?.message}</FieldError>
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <LogInIcon data-icon="inline-start" />
          )}
          {form.formState.isSubmitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </Button>
      </FieldGroup>
    </form>
  );
}
