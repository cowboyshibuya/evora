import { useEffect, useRef, useState } from "react";
import { Building2, Upload } from "lucide-react";
import {
  companyLogoError,
  companyLogoUrl,
  COMPANY_LOGO_ACCEPT,
} from "@/lib/company-logo";
import type { Company } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

export function CompanyAvatar({
  company,
  className,
}: {
  company?: Pick<Company, "id" | "name" | "logoKey"> | null;
  className?: string;
}) {
  const src = company && companyLogoUrl(company);
  return (
    <span className={cn("company-avatar", className)} aria-hidden="true">
      {src ? <img src={src} alt="" /> : <Building2 size={20} />}
    </span>
  );
}

export function CompanyLogoUpload({
  name,
  currentUrl,
  file,
  onChange,
  disabled,
}: {
  name: string;
  currentUrl?: string;
  file?: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const src = file === undefined ? currentUrl : preview;
  return (
    <div className="company-logo-upload">
      <span className="company-logo-preview">
        {src ? (
          <img src={src} alt={`${name || "Company"} logo`} />
        ) : (
          <Building2 size={27} aria-hidden="true" />
        )}
      </span>
      <div>
        <div className="company-logo-actions">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => input.current?.click()}
          >
            <Upload size={14} />
            {src ? "Change logo" : "Upload logo"}
          </Button>
          {(src || file) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => {
                setError("");
                onChange(null);
              }}
            >
              Remove logo
            </Button>
          )}
        </div>
        <p className="field-hint">PNG, JPEG, or WebP · Up to 2 MB</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-label="Upload company logo"
        accept={COMPANY_LOGO_ACCEPT}
        disabled={disabled}
        onChange={(event) => {
          const selected = event.target.files?.[0];
          event.target.value = "";
          if (!selected) return;
          const message = companyLogoError(selected);
          setError(message);
          if (!message) onChange(selected);
        }}
      />
    </div>
  );
}
