export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD", "AUD"] as const;
export const COMPANY_INDUSTRIES = [
  "Design & technology",
  "Consulting",
  "Retail & commerce",
  "Professional services",
  "Hospitality",
  "Construction",
  "Other",
];
export const FISCAL_MONTH_OPTIONS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
].map((label, index) => ({ label, value: String(index + 1) }));
