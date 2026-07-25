import type { TabColumn } from "@/lib/types";
import { chordShapeCatalog, type ChordShape } from "./chords";
import {
  fingerShape,
  parseTabCell,
  tabSteps,
  type Fingering,
} from "./fingering";

/** Everything a tab fragment asks the fretting hand to do. */
export interface TabDemand {
  /** Distinct fretted notes, as "string:fret". */
  notes: { string: number; fret: number }[];
  /** Strings the tab plays open at least once. */
  open: number[];
  lowestFret: number;
  highestFret: number;
}

/** How well a hand shape fits what the tab needs. */
export interface ShapeCoverage {
  /** Fretted notes of the tab this grip already holds down. */
  covered: number;
  total: number;
  /** Notes the grip frets that the tab never plays. */
  extra: number;
  /** Strings the tab needs open that the grip blocks. */
  blocked: number;
}

/** A hand shape held against what the tab needs. */
export interface ShapeMatch extends ShapeCoverage {
  /** Chord name of the grip, e.g. "Em". */
  name: string;
  /** How it reads with its position, e.g. "Am (5fr)". */
  label: string;
  frets: [number, number, number, number, number, number];
  fingering: Fingering;
}

/** What the tab asks for, collapsed across all its columns. */
export function tabDemand(columns: readonly TabColumn[]): TabDemand {
  const seen = new Set<string>();
  const notes: { string: number; fret: number }[] = [];
  const open = new Set<number>();
  let lowestFret = Infinity;
  let highestFret = 0;

  for (const column of columns) {
    column.forEach((cell, string) => {
      const fret = parseTabCell(cell);
      if (fret === null || fret < 0) return;
      if (fret === 0) {
        open.add(string);
        return;
      }
      lowestFret = Math.min(lowestFret, fret);
      highestFret = Math.max(highestFret, fret);
      const key = `${string}:${fret}`;
      if (seen.has(key)) return;
      seen.add(key);
      notes.push({ string, fret });
    });
  }

  return {
    notes,
    open: [...open].sort((a, b) => a - b),
    lowestFret: Number.isFinite(lowestFret) ? lowestFret : 0,
    highestFret,
  };
}

/**
 * Grips that lean on open strings live at one place on the neck, so their name
 * is enough. Movable ones need to say where the hand goes.
 */
const shapeLabel = (name: string, shape: ChordShape) => {
  if (shape.frets.includes(0)) return name;
  const lowest = Math.min(...shape.frets.filter((f) => f > 0));
  return lowest > 1 ? `${name} (${lowest}fr)` : name;
};

/** Score one grip against a tab's demands. */
export function shapeCoverage(
  frets: readonly number[],
  demand: TabDemand
): ShapeCoverage {
  let covered = 0;
  for (const note of demand.notes) {
    if (frets[note.string] === note.fret) covered++;
  }

  let extra = 0;
  for (let s = 0; s < 6; s++) {
    const fret = frets[s];
    if (fret > 0 && !demand.notes.some((n) => n.string === s && n.fret === fret)) {
      extra++;
    }
  }

  return {
    covered,
    total: demand.notes.length,
    extra,
    blocked: demand.open.filter((s) => frets[s] > 0).length,
  };
}

function scoreShape(
  name: string,
  shape: ChordShape,
  demand: TabDemand
): ShapeMatch {
  return {
    name,
    label: shapeLabel(name, shape),
    frets: [...shape.frets] as ShapeMatch["frets"],
    fingering: fingerShape(shape.frets, { barre: shape.barre }),
    ...shapeCoverage(shape.frets, demand),
  };
}

/**
 * Find the hand shapes that hold as much of a tab as possible at once — the
 * answer to "where do I put my hand so I barely have to move it".
 *
 * A grip wins by covering more of the tab's notes; ties go to the one that asks
 * for the fewest fingers the tab never uses, doesn't block strings the tab
 * needs open, and sits lowest on the neck.
 */
export function suggestTabShapes(
  columns: readonly TabColumn[],
  limit = 6
): ShapeMatch[] {
  const demand = tabDemand(columns);
  if (demand.notes.length === 0) return [];

  const matches = chordShapeCatalog()
    .map(({ name, shape }) => scoreShape(name, shape, demand))
    // A grip that catches a couple of notes out of many isn't a hand position
    // worth recommending — that tab moves, and the position list says so
    // better. Ask for at least half the tab before offering a shape.
    .filter((m) => m.covered === m.total || (m.covered >= 2 && m.covered * 2 >= m.total))
    .sort(
      (a, b) =>
        b.covered - a.covered ||
        a.blocked - b.blocked ||
        a.extra - b.extra ||
        a.fingering.position - b.fingering.position ||
        a.name.length - b.name.length ||
        a.name.localeCompare(b.name)
    );

  // One grip per fret layout is enough; alternate names for the same fingering
  // would just repeat the same picture.
  const unique: ShapeMatch[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    const key = match.frets.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(match);
    if (unique.length >= limit) break;
  }
  return unique;
}

/** A stretch of the tab the hand can play without moving. */
export interface TabPosition {
  /** Fret the index finger sits at. */
  position: number;
  /** Column indices this stretch spans, inclusive. */
  fromColumn: number;
  toColumn: number;
  /** How many columns of the tab it covers. */
  columns: number;
}

/**
 * Split the tab into the hand positions it actually needs, so an author can see
 * at a glance whether a fragment stays put or drags the hand up the neck.
 */
export function tabPositions(columns: readonly TabColumn[]): TabPosition[] {
  const out: TabPosition[] = [];

  for (const step of tabSteps(columns)) {
    const { position } = step.fingering;
    if (position === 0) continue;
    const last = out[out.length - 1];
    if (last && last.position === position) {
      last.toColumn = step.column;
      last.columns++;
    } else {
      out.push({
        position,
        fromColumn: step.column,
        toColumn: step.column,
        columns: 1,
      });
    }
  }

  return out;
}
