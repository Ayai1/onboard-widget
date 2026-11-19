import type { StepId, WidgetConfig } from "./config";

export const messages = {
  en: {
    title: "Identity details",
    details: "Your details",
    id_capture: "Photograph your ID",
    selfie: "Take a selfie",
    review: "Review your information",
    fullName: "Full name",
    dateOfBirth: "Date of birth",
    country: "Country",
    email: "Email address",
    continue: "Continue",
    back: "Back",
    submit: "Submit",
    required: "This field is required.",
    invalidEmail: "Enter a valid email address.",
    invalidDate: "Enter a valid date that is not in the future.",
    selectCountry: "Select a country",
    startCamera: "Start camera",
    capture: "Capture photo",
    switchCamera: "Switch camera",
    uploadInstead: "Upload a photo instead",
    cameraPermission: "Camera permission was denied. Allow camera access in your browser settings, then try again.",
    noCamera: "No camera was found. Upload a photo instead.",
    cameraBusy: "The camera is in use by another app. Close it and try again, or upload a photo.",
    cameraConstraints: "This camera does not support the requested settings. Try another camera or upload a photo.",
    insecureContext: "Camera access requires a secure connection. Open settings help or upload a photo instead.",
    unsupportedBrowser: "Camera access is unavailable in this browser. Upload a photo instead.",
    tooDark: "The image looks dark. Consider improving the lighting.",
    tooBlurry: "The image looks blurry. Hold the camera steady and try again.",
    framing: "Align the document within the frame.",
    done: "Submission received",
    reference: "Reference ID",
    demoNotice: "Demo only - do not upload real documents",
    edit: "Edit",
    retake: "Retake",
    error: "Something went wrong. Please try again.",
  },
  ar: {
    title: "بيانات الهوية",
    details: "بياناتك",
    id_capture: "صوّر هويتك",
    selfie: "التقط صورة شخصية",
    review: "راجع معلوماتك",
    fullName: "الاسم الكامل",
    dateOfBirth: "تاريخ الميلاد",
    country: "البلد",
    email: "البريد الإلكتروني",
    continue: "متابعة",
    back: "رجوع",
    submit: "إرسال",
    required: "هذا الحقل مطلوب.",
    invalidEmail: "أدخل عنوان بريد إلكتروني صالحًا.",
    invalidDate: "أدخل تاريخًا صالحًا ليس في المستقبل.",
    selectCountry: "اختر بلدًا",
    startCamera: "تشغيل الكاميرا",
    capture: "التقط صورة",
    switchCamera: "تبديل الكاميرا",
    uploadInstead: "حمّل صورة بدلًا من ذلك",
    cameraPermission: "تم رفض إذن الكاميرا. اسمح بالوصول إلى الكاميرا في إعدادات المتصفح ثم حاول مرة أخرى.",
    noCamera: "لم يتم العثور على كاميرا. حمّل صورة بدلًا من ذلك.",
    cameraBusy: "الكاميرا مستخدمة في تطبيق آخر. أغلقه وحاول مرة أخرى أو حمّل صورة.",
    cameraConstraints: "الكاميرا لا تدعم الإعدادات المطلوبة. جرّب كاميرا أخرى أو حمّل صورة.",
    insecureContext: "يتطلب الوصول إلى الكاميرا اتصالًا آمنًا. افتح مساعدة الإعدادات أو حمّل صورة.",
    unsupportedBrowser: "الوصول إلى الكاميرا غير متاح في هذا المتصفح. حمّل صورة بدلًا من ذلك.",
    tooDark: "تبدو الصورة مظلمة. جرّب تحسين الإضاءة.",
    tooBlurry: "تبدو الصورة غير واضحة. ثبّت الكاميرا وحاول مرة أخرى.",
    framing: "ضع المستند داخل الإطار.",
    done: "تم استلام الإرسال",
    reference: "رقم المرجع",
    demoNotice: "للعرض فقط - لا تحمّل مستندات حقيقية",
    edit: "تعديل",
    retake: "إعادة التصوير",
    error: "حدث خطأ. حاول مرة أخرى.",
  },
} as const;

export type MessageKey = keyof (typeof messages)["en"];

export function translate(config: WidgetConfig, key: MessageKey | string): string {
  const override = config.strings?.[key];
  if (override) return override;
  const table = messages[config.locale] as Record<string, string>;
  return table[key] ?? key;
}

export function stepLabel(config: WidgetConfig, step: StepId): string {
  return translate(config, step);
}

export function textDirection(config: WidgetConfig): "ltr" | "rtl" {
  return config.locale === "ar" ? "rtl" : "ltr";
}
