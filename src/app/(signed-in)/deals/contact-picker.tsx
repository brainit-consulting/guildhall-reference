"use client";

import { RecordPicker } from "@/components/record-picker";
import type { ContactChoice } from "@/lib/contacts";

type Props = { id: string; name: string; contacts: ContactChoice[]; defaultId: string; describedBy?: string; invalid?: boolean };

// Picks a contact by typing; their company tells two people of one name apart.
export function ContactPicker({ contacts, ...rest }: Props) {
  return (
    <RecordPicker
      {...rest}
      choices={contacts.map((c) => ({ id: c.id, name: c.name, detail: c.companyName }))}
      noneLabel="No contact"
      listLabel="Contacts"
      noMatch={(typed) => `No contact matches “${typed}”. Add them under Contacts first.`}
    />
  );
}
