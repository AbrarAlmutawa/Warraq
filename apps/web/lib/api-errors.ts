import { isApiError } from "@/lib/api-client";
import { DemoManuscriptUnavailableError } from "@/lib/demo-manuscript";
import { SessionUnavailableError } from "@/lib/manuscript-upload";

/*
 * Turns any failure into Arabic text for the existing Warraq error style.
 * Presentation only: the backend's own `detail` (English) is kept, unchanged, as `detail`
 * so the researcher and the team can see exactly what the server said.
 */

export type ErrorContext =
  /* POST /manuscripts/upload */
  | "upload"
  /* GET /manuscripts/{id} (recovering a stored manuscript) */
  | "manuscript"
  /* any other request */
  | "request";

export type ErrorPresentation = {
  title: string;
  message: string;
  /* Technical detail (usually English, from the backend); shown small and LTR. */
  detail: string | null;
  /* Whether repeating the same action could succeed. */
  retryable: boolean;
};

export function describeError(error: unknown, context: ErrorContext = "request"): ErrorPresentation {
  if (error instanceof DemoManuscriptUnavailableError) {
    return {
      title: "تعذّر تحميل البحث التجريبي",
      message: "لم نتمكن من فتح ملف البحث التجريبي في هذا التطبيق. أعد المحاولة، أو ارفع بحثك الخاص.",
      detail: error.message,
      retryable: true,
    };
  }

  if (error instanceof SessionUnavailableError) {
    return {
      title: "تعذّر حفظ جلسة العمل في المتصفح",
      message: "يحتاج وَرَّاق إلى تخزين الجلسة مؤقتًا في هذا المتصفح. أوقف وضع التصفح الخاص أو اسمح بالتخزين، ثم أعد المحاولة.",
      detail: error.message,
      retryable: true,
    };
  }

  if (!isApiError(error)) {
    return {
      title: "حدث خطأ غير متوقع",
      message: "أعد المحاولة. إذا تكرر الخطأ، ارجع إلى رفع البحث.",
      detail: error instanceof Error ? error.message : null,
      retryable: true,
    };
  }

  switch (error.kind) {
    case "network":
      return {
        title: "تعذّر الوصول إلى خادم وَرَّاق",
        message: "تأكد من تشغيل الخادم ومن اتصالك، ثم أعد المحاولة.",
        detail: error.detail,
        retryable: true,
      };
    case "timeout":
      return {
        title: "استغرق الطلب وقتًا أطول من المتوقع",
        message: "قد يكون الخادم مشغولًا. أعد المحاولة بعد قليل.",
        detail: error.detail,
        retryable: true,
      };
    case "invalid-response":
      return {
        title: "وصل رد غير متوقع من الخادم",
        message: "أعد المحاولة. إذا تكرر الخطأ، أبلغ فريق وَرَّاق.",
        detail: error.detail,
        retryable: true,
      };
    case "http":
      break;
  }

  const { status, detail } = error;

  if (status === 413) {
    return {
      title: "حجم الملف أكبر من المسموح",
      message: "اختر ملفًا أصغر ثم ارفعه من جديد.",
      detail,
      retryable: false,
    };
  }

  if (status === 400 && context === "upload") {
    return {
      title: "تعذّرت قراءة الملف",
      message: "تأكد أن الملف مستند Word بصيغة DOCX وأنه يُفتح بشكل سليم، ثم ارفعه من جديد.",
      detail,
      retryable: false,
    };
  }

  if (status === 404 && context === "manuscript") {
    return {
      title: "لم نعد نجد هذا البحث على الخادم",
      message: "ربما حُذفت بيانات الخادم المحلية. ارفع البحث من جديد لمتابعة التجهيز.",
      detail,
      retryable: false,
    };
  }

  if (status === 404) {
    return {
      title: "العنصر المطلوب غير موجود",
      message: "ارجع إلى الخطوة السابقة وحاول من جديد.",
      detail,
      retryable: false,
    };
  }

  if (status === 422 || status === 400) {
    return {
      title: "تعذّر تنفيذ الطلب",
      message: "لم يقبل الخادم البيانات المرسلة. ارجع إلى الخطوة السابقة وحاول من جديد.",
      detail,
      retryable: false,
    };
  }

  if (status === 503) {
    return {
      title: "الخدمة غير متاحة مؤقتًا",
      message: "أعد المحاولة بعد قليل.",
      detail,
      retryable: true,
    };
  }

  return {
    title: "حدث خطأ في الخادم",
    message: "أعد المحاولة بعد قليل.",
    detail,
    retryable: status >= 500,
  };
}