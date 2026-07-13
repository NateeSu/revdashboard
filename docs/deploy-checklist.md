# Supabase + Vercel deployment checklist

## Repository

- [ ] GitHub repository เป็น Private
- [ ] `git check-ignore revenue_report_202605.xlsx` แสดง path
- [ ] ไม่มี `.env.local`, keys, tokens หรือ source workbook ใน Git history
- [ ] CI ผ่าน format, lint, typecheck, unit tests และ build

## Supabase

- [ ] `supabase db push` สำเร็จทุก migration
- [ ] `source-files` เป็น private bucket
- [ ] RLS เปิดบน `import_batches`, `revenue_import_rows`, `active_datasets`
- [ ] สร้าง Owner user ผ่าน Dashboard
- [ ] ปิด public sign-up
- [ ] ตั้ง Site URL/Redirect URLs สำหรับ local, preview และ production
- [ ] ทดลอง User A ไม่เห็นข้อมูล User B ใน staging/local test
- [ ] ทดลอง publish, supersede และ republish แล้ว Active Dataset ถูกต้อง

## Vercel

- [ ] Runtime ใช้ Node.js 22
- [ ] ตั้ง `NEXT_PUBLIC_SUPABASE_URL`
- [ ] ตั้ง `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] ตั้ง `NEXT_PUBLIC_APP_NAME` และ `NEXT_PUBLIC_MAX_UPLOAD_MB`
- [ ] ถ้าเปิด cron: ตั้ง `SUPABASE_SERVICE_ROLE_KEY` และ `CRON_SECRET`
- [ ] แยก Preview/Production environment variables
- [ ] Deploy ผ่านและ login ได้
- [ ] ทดสอบ upload → save → publish → dashboard
- [ ] ทดสอบ signed source download และ Excel export 4 sheets
- [ ] ทดสอบ invalid cron authorization ได้ 401

## Final acceptance

- [ ] `pnpm test:sample` ผ่านทุกตัวเลขจาก workbook read-only
- [ ] Blank/zero/negative behavior ถูกต้อง
- [ ] Source file ไม่อยู่ใน `public/` หรือ deployment bundle
- [ ] Service role ไม่ปรากฏใน Browser bundle/network response
- [ ] Full Backup ZIP เปิดและมี manifest/counts ครบ
