"use client";

import {
  BarChart3Icon,
  DatabaseBackupIcon,
  FileClockIcon,
  LogOutIcon,
  SearchIcon,
  TablePropertiesIcon,
  UploadCloudIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { logoutAction } from "@/lib/auth/actions";

const navigation = [
  { href: "/dashboard", label: "ภาพรวม", icon: BarChart3Icon },
  { href: "/reports", label: "รายงานรายได้", icon: TablePropertiesIcon },
  { href: "/explorer", label: "สำรวจรายได้", icon: SearchIcon },
  { href: "/upload", label: "นำเข้าไฟล์", icon: UploadCloudIcon },
  { href: "/imports", label: "ประวัติการนำเข้า", icon: FileClockIcon },
  { href: "/backup", label: "สำรองข้อมูล", icon: DatabaseBackupIcon },
] as const;

function getPageTitle(pathname: string) {
  if (pathname.startsWith("/reports")) return "รายงานรายได้";
  if (pathname.startsWith("/explorer")) return "สำรวจรายได้";
  if (pathname.startsWith("/upload")) return "นำเข้าไฟล์รายได้";
  if (pathname.startsWith("/imports")) return "ประวัติการนำเข้า";
  if (pathname.startsWith("/backup")) return "สำรองข้อมูล";
  return "ภาพรวมรายได้";
}

export function AppShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail: string;
}) {
  const pathname = usePathname();

  return (
    <SidebarProvider style={{ "--sidebar-width": "14rem" } as React.CSSProperties}>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="p-4">
          <Link href="/dashboard" className="flex items-center gap-3 rounded-md focus-ring">
            <div className="grid size-9 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <BarChart3Icon />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">ระบบสรุปรายได้</p>
              <p className="truncate text-xs text-sidebar-foreground/65">รายเดือนและรายได้สะสม</p>
            </div>
          </Link>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigation.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={isActive}
                        size="lg"
                        tooltip={item.label}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-3">
          <Separator className="bg-sidebar-border" />
          <div className="px-2 py-1">
            <p className="truncate text-xs font-medium">{userEmail}</p>
            <p className="text-xs text-sidebar-foreground/55">เจ้าของระบบ</p>
          </div>
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground"
            >
              <LogOutIcon data-icon="inline-start" />
              ออกจากระบบ
            </Button>
          </form>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <SidebarTrigger aria-label="เปิดหรือปิดเมนู" />
          <Separator orientation="vertical" className="h-5" />
          <p className="font-heading text-sm font-semibold sm:text-base">
            {getPageTitle(pathname)}
          </p>
          <p className="ml-auto hidden text-xs text-muted-foreground sm:block">
            ข้อมูลส่วนตัว · ไม่เผยแพร่สาธารณะ
          </p>
        </header>
        <div className="min-w-0 flex-1 p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
