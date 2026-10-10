"use client";

import {
  DndContext, DragOverlay, MouseSensor, pointerWithin, rectIntersection, TouchSensor, useDraggable, useDroppable,
  useSensor, useSensors, type Announcements, type CollisionDetection, type DragEndEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { startTransition, useEffect, useId, useOptimistic, useRef, useState } from "react";
import { DEAL_STAGES, type DealStage } from "@/lib/deal-stages";
import { formatMoney } from "@/lib/money";
import { pipelineColumns } from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import { StageName } from "../deals/stage-name";
import { moveDealAction } from "./actions";

export type Card = { id: string; title: string; stage: DealStage; value: string | null; companyName: string | null };

// The pointer decides the column; when it is between columns, whichever the card overlaps most.
const collision: CollisionDetection = (args) => {
  const under = pointerWithin(args);
  return under.length > 0 ? under : rectIntersection(args);
};

export function Board({ cards }: { cards: Card[] }) {
  // A moved card shows in its new column at once; the server's render replaces this when the save is done.
  const [shown, moveShown] = useOptimistic(cards, (state, { id, stage }: { id: string; stage: DealStage }) =>
    state.map((c) => (c.id === id ? { ...c, stage } : c)));
  const [dragging, setDragging] = useState<Card | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [said, setSaid] = useState("");

  // Mouse drags start after 5px, so a click still opens the deal. Touch waits for a short press, so a swipe still
  // scrolls the board. Keyboards use "Move to…".
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const titleOf = (id: unknown) => shown.find((c) => c.id === id)?.title ?? "the deal";
  // dnd-kit's own announcements read out the record's id; these use its title.
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${titleOf(active.id)} is over ${over.id}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `Moved ${titleOf(active.id)} to ${over.id}.` : `${titleOf(active.id)} was put back.`),
    onDragCancel: ({ active }) => `${titleOf(active.id)} was put back.`,
  };

  function move(card: Card, stage: DealStage) {
    if (card.stage === stage) return;
    startTransition(async () => {
      moveShown({ id: card.id, stage });
      await moveDealAction(card.id, stage);
    });
  }

  function moveFromMenu(card: Card, stage: DealStage) {
    setFocusId(card.id); // its card mounts again in the new column; focus follows it there
    setSaid(`Moved ${card.title} to ${stage}.`);
    move(card, stage);
  }

  function dropped({ active, over }: DragEndEvent) {
    setDragging(null);
    const card = shown.find((c) => c.id === active.id);
    const stage = DEAL_STAGES.find((s) => s === over?.id);
    if (card && stage) move(card, stage);
  }

  return (
    <DndContext
      id={useId()} // dnd-kit numbers its hidden nodes; a stable id keeps server and browser markup the same
      sensors={sensors}
      collisionDetection={collision}
      accessibility={{ announcements, screenReaderInstructions: { draggable: "" } }}
      onDragStart={({ active }) => { setFocusId(null); setDragging(shown.find((c) => c.id === active.id) ?? null); }}
      onDragEnd={dropped}
      onDragCancel={() => setDragging(null)}
    >
      <p role="status" className="sr-only">{said}</p>
      {/* On a phone, and whenever five columns don't fit, the board scrolls sideways inside this box; the page never does. */}
      <div role="region" aria-label="Pipeline board" tabIndex={0} className="mt-8 overflow-x-auto border-t border-rule pb-4 focus-visible:outline-2 focus-visible:outline-accent">
        <div className="flex w-max xl:w-full">
          {pipelineColumns(shown).map((column) => (
            <Column key={column.stage} stage={column.stage} count={column.count} total={column.total}>
              {column.deals.map((card) => (
                <DealCard key={card.id} card={card} focus={card.id === focusId} onMove={(stage) => moveFromMenu(card, stage)} />
              ))}
            </Column>
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>{dragging && <CardBody card={dragging} lifted />}</DragOverlay>
    </DndContext>
  );
}

function Column({ stage, count, total, children }: { stage: DealStage; count: number; total: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const heading = useId();
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={heading}
      className={cn("flex w-64 shrink-0 flex-col xl:w-auto xl:min-w-48 xl:flex-1 xl:shrink border-r border-rule px-3 pt-3 first:border-l", isOver && "bg-panel")}
    >
      <h2 id={heading} className="font-display text-xl"><StageName stage={stage} /></h2>
      <p className="mt-1 flex justify-between border-b border-rule pb-3 text-sm">
        <span className="text-muted">{count} {count === 1 ? "deal" : "deals"}</span>
        <span className="tabular-nums text-ink">{formatMoney(total)}</span>
      </p>
      <ul aria-label={`${stage} deals`} className={cn("flex min-h-24 flex-1 flex-col gap-2 py-3", isOver && "outline-1 outline-accent outline-dashed")}>
        {children}
      </ul>
    </section>
  );
}

function DealCard({ card, focus, onMove }: { card: Card; focus: boolean; onMove: (stage: DealStage) => void }) {
  // No dnd-kit attributes: they would make the whole card a button around the link and the menu.
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: card.id });
  return (
    <li ref={setNodeRef} {...listeners} className={cn("touch-manipulation", isDragging && "opacity-40")}>
      <CardBody card={card} focus={focus} onMove={onMove} />
    </li>
  );
}

function CardBody({ card, lifted, focus, onMove }: { card: Card; lifted?: boolean; focus?: boolean; onMove?: (stage: DealStage) => void }) {
  const link = useRef<HTMLAnchorElement>(null);
  useEffect(() => { if (focus) link.current?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- on mount only
  const titleId = useId();
  return (
    <div className={cn("relative rounded-sm border bg-panel p-3", lifted ? "cursor-grabbing border-accent" : "cursor-grab border-rule hover:border-ink")}>
      {/* The link's ::after covers the card, so a click anywhere on it opens the deal. */}
      <Link
        ref={link}
        id={titleId}
        href={`/deals/${card.id}`}
        draggable={false}
        className="block font-medium text-accent underline-offset-4 wrap-anywhere after:absolute after:inset-0 hover:underline"
      >
        {card.title}
      </Link>
      {card.companyName && <p className="mt-1 text-sm text-ink wrap-anywhere">{card.companyName}</p>}
      <p className={cn("mt-1 text-sm tabular-nums", card.value ? "text-ink" : "text-muted")}>
        {card.value ? formatMoney(card.value) : "No value"}
      </p>
      {onMove && <MoveMenu current={card.stage} describedBy={titleId} onMove={onMove} />}
    </div>
  );
}

// "Move to…": a small menu of the other four stages, for keyboards and touch screens. It opens inside the card,
// pushing it taller, because the board scrolls sideways and would clip anything that hangs below it.
function MoveMenu({ current, describedBy, onMove }: { current: DealStage; describedBy: string; onMove: (stage: DealStage) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const stages = DEAL_STAGES.filter((s) => s !== current);

  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const outside = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function keys(e: React.KeyboardEvent) {
    const items = [...(box.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => { e.preventDefault(); items[(i + items.length) % items.length]?.focus(); };
    if (e.key === "ArrowDown") go(at + 1);
    else if (e.key === "ArrowUp") go(at - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") { e.preventDefault(); button.current?.focus(); }
      setOpen(false);
    }
  }

  return (
    // relative z-10 lifts the menu above the card's covering link; the sensors listen for mouse and touch downs, which
    // stop here so pressing the menu never starts a drag
    <div ref={box} className="relative z-10 mt-2" onKeyDown={keys} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-describedby={describedBy}
        onClick={() => setOpen((o) => !o)}
        className="h-8 rounded-sm border border-rule bg-paper px-2 text-sm text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Move to…
      </button>
      {open && (
        <ul id={menuId} role="menu" aria-label="Move to" className="mt-1 rounded-sm border border-ink bg-paper py-1">
          {stages.map((stage) => (
            <li key={stage} role="none">
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => { setOpen(false); onMove(stage); }}
                className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-panel focus:bg-panel focus:outline-none"
              >
                Move to {stage}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
