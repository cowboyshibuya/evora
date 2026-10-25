import {
  CURRENCIES,
  FISCAL_MONTH_OPTIONS,
  COMPANY_INDUSTRIES,
} from "@/lib/company-options";
import { useState } from "react";
import { Building2, Check, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Field, Input } from "./ui/input";
import { Select } from "./ui/select";

export function CompanyDialog({
  onClose,
  onCreated,
  required = false,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
  required?: boolean;
}) {
  const [step, setStep] = useState(1),
    [name, setName] = useState(""),
    [industry, setIndustry] = useState("Design & technology"),
    [country, setCountry] = useState("Belgium"),
    [currency, setCurrency] = useState("EUR"),
    [email, setEmail] = useState(""),
    [taxId, setTaxId] = useState(""),
    [fiscalMonth, setFiscalMonth] = useState("1"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) return setStep(2);
    setBusy(true);
    setError("");
    try {
      const result = await api<{ id: string }>("companies", {
        method: "POST",
        body: JSON.stringify({
          name,
          industry,
          country,
          currency,
          email,
          taxId,
          fiscalMonth: Number(fiscalMonth),
        }),
      });
      toast.success(`${name} is ready. Welcome to your workspace.`);
      onCreated(result.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !required && onClose()}
      title={required ? "A home for your company" : "Add a company"}
      description="Keep everything together. Keep each company separate."
    >
      <form onSubmit={submit}>
        <div className="dialog-body">
          <div className="onboarding-steps">
            <span className={step >= 1 ? "active" : ""}>
              <i>{step > 1 ? <Check size={12} /> : "1"}</i>Company details
            </span>
            <div />
            <span className={step === 2 ? "active" : ""}>
              <i>2</i>Make it yours
            </span>
          </div>
          {step === 1 ? (
            <>
              <div className="onboarding-icon">
                <Building2 size={27} />
              </div>
              <Field label="Company name">
                <Input
                  autoFocus
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Studio North"
                />
              </Field>
              <Field label="Industry">
                <Select
                  label="Company industry"
                  value={industry}
                  onValueChange={setIndustry}
                  options={COMPANY_INDUSTRIES}
                />
              </Field>
              <div className="form-grid">
                <Field label="Country">
                  <Input
                    required
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </Field>
                <Field label="Currency">
                  <Select
                    label="Company currency"
                    value={currency}
                    onValueChange={setCurrency}
                    options={CURRENCIES}
                  />
                </Field>
              </div>
            </>
          ) : (
            <>
              <Field
                label="Company email"
                hint="Used on your invoices. You can add it later."
              >
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hello@yourcompany.com"
                />
              </Field>
              <Field label="VAT or tax number">
                <Input
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="e.g. BE 0123.456.789"
                />
              </Field>
              <Field label="Financial year starts in">
                <Select
                  label="Financial year start"
                  value={fiscalMonth}
                  onValueChange={setFiscalMonth}
                  options={FISCAL_MONTH_OPTIONS}
                />
              </Field>
              <div className="onboarding-summary">
                <Building2 size={20} />
                <div>
                  <strong>{name}</strong>
                  <p>
                    {industry} · {country} · {currency}
                  </p>
                </div>
                <Check size={18} />
              </div>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="dialog-footer">
          {step === 2 ? (
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
          ) : (
            !required && (
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )
          )}
          <Button type="submit" disabled={busy}>
            {busy ? (
              <Loader2 className="spin" size={16} />
            ) : step === 2 ? (
              <Check size={16} />
            ) : null}
            {step === 1 ? "Continue" : "Create company"}
            {step === 1 && <ChevronRight size={15} />}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
