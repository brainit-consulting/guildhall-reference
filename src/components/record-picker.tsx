"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";

// One record to pick: its name, and a detail (a website, a company) to tell two of one name apart.
export type Choice = { id: string; name: string; detail: string | null };

type Props = {
  id: string;
  name: string;
  choices: Choice[];
  defaultId: string;
  noneLabel: string; // "No company"
  listLabel: string; // "Companies"
  noMatch: (typed: string) => string; // what to say when nothing matches
  describedBy?: string;
  invalid?: boolean;
};

// A combobox (WAI-ARIA 1.2 pattern): type to narrow the list, pick with the mouse or the arrow keys and Enter.
// The chosen record's id goes in a hidden field; the text box only ever shows names.
export function RecordPicker({ id, name, choices, defaultId, noneLabel, listLabel, noMatch, describedBy, invalid }: Props) {
  const listId = useId();
  const NONE: Choice = { id: "", name: noneLabel, detail: null };
  const nameOf = (choiceId: string) => choices.find((c) => c.id === choiceId)?.name ?? "";
  const [chosen, setChosen] = useState(defaultId && nameOf(defaultId) ? defaultId : "");
  const [text, setText] = useState(nameOf(chosen));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // While the text is the chosen name, show every choice; once it is edited, only those whose name contains it.
  const query = text.trim().toLowerCase();
  const filtering = query !== "" && text !== nameOf(chosen);
  const options = [NONE, ...(filtering ? choices.filter((c) => c.name.toLowerCase().includes(query)) : choices)];

  function choose(option: Choice) {
    setChosen(option.id);
    setText(option.id ? option.name : "");
    setOpen(false);
  }

  // Leaving the box without picking: an exact name counts as picking it, a cleared box as none, anything else goes
  // back to what was chosen, so the box never shows a record that won't be saved.
  function settle() {
    setOpen(false);
    if (!text.trim()) return choose(NONE);
    const exact = choices.filter((c) => c.name.toLowerCase() === query);
    if (exact.length === 1) return choose(exact[0]);
    setText(nameOf(chosen));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(Math.max(0, options.findIndex((o) => o.id === chosen)));
        return;
      }
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + options.length) % options.length);
    } else if (e.key === "Enter" && open) {
      e.preventDefault(); // pick, don't submit the form
      choose(options[Math.min(active, options.length - 1)]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      setText(nameOf(chosen));
    }
  }

  const activeIndex = Math.min(active, options.length - 1);
  return (
    <div className="relative">
      <input type="hidden" name={name} value={chosen} />
      <Input
        id={id}
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        placeholder={noneLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(e.target.value.trim() ? 1 : 0); // the first match, ahead of none
        }}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        onBlur={settle}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label={listLabel}
        hidden={!open}
        className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-sm border border-rule bg-panel py-1"
      >
        {options.map((o, i) => (
          <li
            key={o.id || "none"}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={o.id === chosen}
            // mousedown, not click: the pick has to land before the box loses focus and settles
            onMouseDown={(e) => { e.preventDefault(); choose(o); }}
            onMouseMove={() => setActive(i)}
            className={`cursor-pointer px-3 py-2 text-sm wrap-anywhere ${i === activeIndex ? "bg-accent text-paper" : "text-ink"} ${o.id ? "" : "border-b border-rule"}`}
          >
            {o.name}
            {o.detail && <span className={i === activeIndex ? "opacity-80" : "text-muted"}> · {o.detail}</span>}
          </li>
        ))}
        {filtering && options.length === 1 && (
          <li role="presentation" className="px-3 py-2 text-sm text-muted">{noMatch(text.trim())}</li>
        )}
      </ul>
    </div>
  );
}
