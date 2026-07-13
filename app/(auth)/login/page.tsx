import { BarChart3Icon } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="grid min-h-svh bg-muted/30 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <BarChart3Icon />
          </div>
          <div>
            <p className="font-heading text-lg font-semibold">ระบบสรุปรายได้</p>
            <p className="text-sm text-sidebar-foreground/70">รายเดือนและรายได้สะสม</p>
          </div>
        </div>
        <div className="max-w-lg">
          <h1 className="font-heading text-4xl leading-tight font-semibold">
            มองเห็นรายได้ทุกมิติ
            <br />
            ด้วยข้อมูลเวอร์ชันที่ตรวจสอบได้
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-sidebar-foreground/70">
            นำเข้าไฟล์รายเดือน ตรวจสอบความถูกต้อง และติดตามแนวโน้มได้ในที่เดียว
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">Revenue Dashboard · Private workspace</p>
      </section>
      <section className="grid place-items-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">เข้าสู่ระบบ</CardTitle>
            <CardDescription>ใช้บัญชี Owner ที่สร้างไว้ใน Supabase Dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
