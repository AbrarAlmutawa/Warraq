import { JourneyTimeline } from "@/components/layout/JourneyTimeline";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { DemoManuscriptButton } from "@/components/upload/DemoManuscriptButton";
import { UploadDropzone } from "@/components/upload/UploadDropzone";

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="flex flex-1 flex-col gap-14 px-6 pt-12 lg:flex-row lg:gap-[88px] lg:px-[72px] lg:pt-[72px]">
        {/* Introduction with editorial margin */}
        <section className="relative flex w-full shrink-0 flex-col ps-7 lg:w-[560px]">
          <div aria-hidden="true" className="absolute top-1.5 right-0 h-[440px] w-px bg-rule" />
          <div aria-hidden="true" className="absolute top-1.5 -right-px h-[120px] w-[3px] bg-terracotta" />

          <p className="text-sm font-semibold text-terracotta-text">مساعدك من البحث المكتمل إلى التقديم</p>

          <h1 className="mt-3.5 text-[44px] leading-[1.2] font-bold lg:text-[60px]">
            البحث أقرب
            <br />
            إلى النشر
          </h1>

          <p className="mt-[22px] max-w-[500px] text-lg leading-[1.85] text-body">
            ارفع بحثك المكتمل، ونقترح لك المجلات الأنسب لنطاقه وميزانيتك، ثم نفحص مخطوطتك على متطلبات
            المجلة التي تختارها - مع مصدر كل متطلب.
          </p>

          <div className="mt-14">
            <JourneyTimeline current="manuscript" />
          </div>
        </section>

        {/* Upload */}
        <section aria-label="رفع البحث" className="flex flex-1 flex-col gap-[18px] pb-10 lg:pb-0">
          <UploadDropzone />

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-body">
            <p>
              ليس لديك بحث جاهز الآن؟ <DemoManuscriptButton />
            </p>
            <p className="text-[12.5px] text-muted"> </p>
          </div>
        </section>
      </main>

      <footer className="flex h-16 shrink-0 items-center justify-center text-[15px] text-body">
        كل فكرة <span className="mx-1.5 font-bold text-terracotta">..</span> ورّاقة
      </footer>
    </div>
  );
}