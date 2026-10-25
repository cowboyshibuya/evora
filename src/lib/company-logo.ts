import type { Company } from "./types";

export const COMPANY_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const COMPANY_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export const COMPANY_LOGO_ACCEPT = COMPANY_LOGO_TYPES.join(",");

export function companyLogoError(file: Pick<File, "size" | "type">) {
  if (!file.size) return "Choose an image to upload.";
  if (file.size > COMPANY_LOGO_MAX_BYTES)
    return "Choose a company logo smaller than 2 MB.";
  if (!(COMPANY_LOGO_TYPES as readonly string[]).includes(file.type))
    return "Choose a PNG, JPEG, or WebP image.";
  return "";
}

export function companyLogoUrl(company: Pick<Company, "id" | "logoKey">) {
  return company.logoKey
    ? `/api/company/logo?company=${encodeURIComponent(company.id)}&v=${encodeURIComponent(company.logoKey)}`
    : undefined;
}

/** undefined leaves an existing logo unchanged; null explicitly removes it. */
export function companyRequestBody(values: object, logo?: File | null) {
  if (logo === undefined) return JSON.stringify(values);
  const form = new FormData();
  form.set("company", JSON.stringify(values));
  if (logo) form.set("logo", logo);
  else form.set("removeLogo", "true");
  return form;
}
