import { abstractWordCount, countWords } from "@/lib/workspace/manuscript";
import type {
  DynamicRuleId,
  JournalWorkspaceRules,
  ManuscriptFormat,
  RequirementResult,
  WorkspaceManuscript,
} from "@/lib/workspace/types";

const DEFAULT_EXCERPT = "Listed as a requirement in the demo author guidelines.";

const FORMAT_LABEL: Record<ManuscriptFormat, string> = {
  docx: "Word (DOCX)",
  latex: "LaTeX",
};

function overBy(amount: number, one: string, two: string, few: string, many: string): string {
  if (amount === 1) return one;
  if (amount === 2) return two;
  if (amount <= 10) return `بـ ${amount} ${few}`;
  return `بـ ${amount.toLocaleString("en-US")} ${many}`;
}

const wordsOver = (amount: number) => overBy(amount, "بكلمة واحدة", "بكلمتين", "كلمات", "كلمة");
const referencesOver = (amount: number) => overBy(amount, "بمرجع واحد", "بمرجعين", "مراجع", "مرجعًا");

export function reviewKey(journalId: string, reviewId: string): string {
  return `${journalId}:${reviewId}`;
}

type DynamicFields = Omit<RequirementResult, "id" | "excerpt" | "confidence" | "confirmedByUser" | "isReviewRule">;

/* Deterministic: the same manuscript + the same rules always give the same results. */
export function evaluateManuscript(
  manuscript: WorkspaceManuscript,
  rules: JournalWorkspaceRules,
  confirmedReviewIds: string[],
): RequirementResult[] {
  const results: RequirementResult[] = [];

  const push = (rule: DynamicRuleId, fields: DynamicFields) => {
    results.push({
      ...fields,
      id: rule,
      excerpt: rules.excerpts[rule] ?? DEFAULT_EXCERPT,
      confidence: rules.defaultConfidence,
      confirmedByUser: false,
      isReviewRule: false,
    });
  };

  // Title
  const titleWords = countWords(manuscript.title);
  const titleOk = titleWords <= rules.maxTitleWords;
  push("title-length", {
    field: "title",
    label: "عدد كلمات العنوان",
    requirement: `≤ ${rules.maxTitleWords} كلمة`,
    measured: `${titleWords} كلمة`,
    status: titleOk ? "passed" : "failed",
    message: titleOk
      ? "العنوان ضمن الحد المسموح"
      : `العنوان يتجاوز الحد المسموح ${wordsOver(titleWords - rules.maxTitleWords)}`,
    anchor: "title",
    fix: titleOk ? undefined : { kind: "shorten-title", label: "تطبيق نموذج مختصر", simulated: true },
  });

  // Abstract
  const abstractWords = abstractWordCount(manuscript);
  const abstractOk = abstractWords <= rules.maxAbstractWords;
  push("abstract-length", {
    field: "abstract",
    label: "طول الملخص",
    requirement: `≤ ${rules.maxAbstractWords} كلمة`,
    measured: `${abstractWords} كلمة`,
    status: abstractOk ? "passed" : "failed",
    message: abstractOk
      ? "الملخص ضمن الحد المسموح"
      : `الملخص يتجاوز الحد المسموح ${wordsOver(abstractWords - rules.maxAbstractWords)}`,
    note: abstractOk ? undefined : "يتطلب اختصارًا منك في نص الملخص.",
    anchor: "abstract",
  });

  // Total length
  if (rules.maxWords !== undefined) {
    const lengthOk = manuscript.wordCount <= rules.maxWords;
    push("word-count", {
      field: "length",
      label: "طول البحث",
      requirement: `≤ ${rules.maxWords.toLocaleString("en-US")} كلمة`,
      measured: `${manuscript.wordCount.toLocaleString("en-US")} كلمة`,
      status: lengthOk ? "passed" : "failed",
      message: lengthOk
        ? "طول البحث ضمن الحد المسموح"
        : `طول البحث يتجاوز الحد المسموح ${wordsOver(manuscript.wordCount - rules.maxWords)}`,
      note: lengthOk ? undefined : "يتطلب اختصار البحث منك - لا يُحاكى في هذا النموذج.",
    });
  }

  // References
  const { min, max } = rules.references;
  const referenceCount = manuscript.referenceCount;
  const referenceRequirement =
    min !== undefined && max !== undefined
      ? `${min}–${max} مرجعًا`
      : max !== undefined
        ? `≤ ${max} مرجعًا`
        : `≥ ${min ?? 0} مرجعًا`;
  let referenceMessage = "عدد المراجع ضمن النطاق المطلوب";
  let referencesOk = true;
  if (max !== undefined && referenceCount > max) {
    referencesOk = false;
    referenceMessage = `عدد المراجع يتجاوز الحد ${referencesOver(referenceCount - max)}`;
  } else if (min !== undefined && referenceCount < min) {
    referencesOk = false;
    referenceMessage = `عدد المراجع أقل من الحد الأدنى ${referencesOver(min - referenceCount)}`;
  }
  push("reference-count", {
    field: "references",
    label: "عدد المراجع",
    requirement: referenceRequirement,
    measured: `${referenceCount} مرجعًا`,
    status: referencesOk ? "passed" : "failed",
    message: referenceMessage,
    note: referencesOk ? undefined : "يتطلب تعديل قائمة المراجع منك.",
    anchor: "references",
  });

  // Citation style — always evaluated against the CURRENT manuscript style
  const requiredStyle = rules.requiredCitationStyle;
  const styleOk = manuscript.citationStyle === requiredStyle;
  push("citation-style", {
    field: "citations",
    label: "أسلوب الاستشهاد",
    requirement: requiredStyle,
    measured: manuscript.citationStyle,
    status: styleOk ? "passed" : "failed",
    message: styleOk
      ? `الاستشهادات بأسلوب ${requiredStyle}`
      : `أسلوب الاستشهاد في البحث ${manuscript.citationStyle} والمجلة تشترط ${requiredStyle}`,
    anchor: "citations",
    fix: styleOk
      ? undefined
      : {
          kind: "convert-citations",
          label: `تحويل إلى ${requiredStyle}`,
          simulated: true,
          citationStyle: requiredStyle,
        },
  });

  // Highlights
  if (rules.highlights) {
    const { min: highlightsMin, max: highlightsMax } = rules.highlights;
    const block = manuscript.highlights;
    const requirement = `مطلوب · ${highlightsMin}–${highlightsMax} نقاط`;
    if (!block) {
      push("highlights", {
        field: "highlights",
        label: "قسم Highlights",
        requirement,
        measured: "غير موجود",
        status: "failed",
        message: "قسم Highlights مطلوب وغير موجود في المخطوطة",
        anchor: "highlights",
        fix: { kind: "insert-highlights", label: "إدراج القسم", simulated: false },
      });
    } else if (block.isDraft) {
      push("highlights", {
        field: "highlights",
        label: "قسم Highlights",
        requirement,
        measured: "مسودة فارغة",
        status: "failed",
        message: "أُدرج قسم Highlights لكنه ما زال مسودة - أكمل النقاط",
        anchor: "highlights",
        fix: { kind: "complete-highlights", label: "إكمال نموذج تجريبي", simulated: true },
      });
    } else {
      const bulletCount = block.content.length;
      const countOk = bulletCount >= highlightsMin && bulletCount <= highlightsMax;
      push("highlights", {
        field: "highlights",
        label: "قسم Highlights",
        requirement,
        measured: `${bulletCount} نقاط`,
        status: countOk ? "passed" : "failed",
        message: countOk
          ? "قسم Highlights مكتمل"
          : `عدد نقاط Highlights ${bulletCount}، والمطلوب ${highlightsMin}–${highlightsMax}`,
        anchor: "highlights",
      });
    }
  }

  // Data availability
  if (rules.requiresDataAvailability) {
    const block = manuscript.dataAvailability;
    if (!block) {
      push("data-availability", {
        field: "data-availability",
        label: "بيان إتاحة البيانات",
        requirement: "مطلوب",
        measured: "غير موجود",
        status: "failed",
        message: "بيان إتاحة البيانات مطلوب وغير موجود في المخطوطة",
        anchor: "data-availability",
        fix: { kind: "insert-data-availability", label: "إدراج القسم", simulated: false },
      });
    } else if (block.isDraft) {
      push("data-availability", {
        field: "data-availability",
        label: "بيان إتاحة البيانات",
        requirement: "مطلوب",
        measured: "مسودة فارغة",
        status: "failed",
        message: "أُدرج بيان إتاحة البيانات لكنه ما زال مسودة",
        anchor: "data-availability",
        fix: { kind: "complete-data-availability", label: "إكمال نموذج تجريبي", simulated: true },
      });
    } else {
      push("data-availability", {
        field: "data-availability",
        label: "بيان إتاحة البيانات",
        requirement: "مطلوب",
        measured: "موجود",
        status: "passed",
        message: "بيان إتاحة البيانات موجود",
        anchor: "data-availability",
      });
    }
  }

  // Template
  if (rules.requiredFormat) {
    const requiredFormat = rules.requiredFormat;
    const formatOk = manuscript.format === requiredFormat;
    push("template", {
      field: "template",
      label: "قالب التقديم",
      requirement: `قالب ${FORMAT_LABEL[requiredFormat]}`,
      measured: FORMAT_LABEL[manuscript.format],
      status: formatOk ? "passed" : "failed",
      message: formatOk
        ? `المخطوطة بقالب ${FORMAT_LABEL[requiredFormat]}`
        : `المجلة تشترط قالب ${FORMAT_LABEL[requiredFormat]}، والمخطوطة بصيغة ${FORMAT_LABEL[manuscript.format]}`,
      fix: formatOk
        ? undefined
        : { kind: "export-latex", label: "نموذج: تصدير إلى قالب LaTeX", simulated: true },
    });
  }

  // Review items (uncertain extraction) — cleared only by the researcher
  for (const item of rules.reviewItems) {
    const confirmed = confirmedReviewIds.includes(reviewKey(rules.journalId, item.id));
    results.push({
      id: item.id,
      field: item.field,
      label: item.label,
      requirement: item.requirement,
      measured: confirmed ? "أكّدته أنت" : undefined,
      status: confirmed ? "passed" : "review",
      message: confirmed ? "أكّدت هذا البند يدويًا" : item.message,
      note: item.note,
      anchor: item.anchor,
      fix: confirmed ? undefined : { kind: "confirm-review", label: "تحققت بنفسي", simulated: false },
      confidence: item.confidence,
      excerpt: item.excerpt,
      confirmedByUser: confirmed,
      isReviewRule: true,
    });
  }

  // Static requirements met by the demo manuscript
  for (const requirement of rules.staticRequirements) {
    results.push({
      id: requirement.id,
      field: "general",
      label: requirement.label,
      requirement: requirement.requirement,
      status: "passed",
      message: `${requirement.label}: ${requirement.requirement}`,
      confidence: rules.defaultConfidence,
      excerpt: requirement.excerpt,
      confirmedByUser: false,
      isReviewRule: false,
    });
  }

  return results;
}