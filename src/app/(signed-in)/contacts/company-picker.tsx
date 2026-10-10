"use client";

import { RecordPicker } from "@/components/record-picker";
import type { CompanyChoice } from "@/lib/companies";

type Props = { id: string; name: string; companies: CompanyChoice[]; defaultId: string; describedBy?: string; invalid?: boolean };

// Picks a company by typing; the contact form and the deal form use it.
export function CompanyPicker({ companies, ...rest }: Props) {
  return (
    <RecordPicker
      {...rest}
      choices={companies.map((c) => ({ id: c.id, name: c.name, detail: c.website }))}
      noneLabel="No company"
      listLabel="Companies"
      noMatch={(typed) => `No company matches “${typed}”. Add it under Companies first.`}
    />
  );
}
