/** Spec accent — do not substitute theme.primary (#5B7FFF / #7C9AFF). */
export const NOTE_ACCENT = "#6B7FFF";
export const NOTE_ACCENT_BG = "#6B7FFF22";
export const NOTE_TOOLBAR_BG = "#13131e";

export interface TextSelection {
  start: number;
  end: number;
}

export interface ActiveFormats {
  bold: boolean;
  italic: boolean;
  bullet: boolean;
  numbered: boolean;
  heading: boolean;
}

export interface InlineSegment {
  type: "plain" | "bold" | "italic";
  text: string;
}

export interface PreviewBlock {
  type: "paragraph" | "heading" | "bullet" | "numbered" | "divider";
  segments: InlineSegment[];
  number?: string;
}

export function formatCharacterCount(count: number): string {
  return `${count} character${count === 1 ? "" : "s"}`;
}

export function getLineAtIndex(
  text: string,
  index: number,
): { lineStart: number; lineEnd: number; lineText: string } {
  const safeIndex = Math.max(0, Math.min(index, text.length));
  let lineStart = text.lastIndexOf("\n", safeIndex - 1) + 1;
  if (lineStart < 0) lineStart = 0;
  const nextNewline = text.indexOf("\n", safeIndex);
  const lineEnd = nextNewline === -1 ? text.length : nextNewline;
  return {
    lineStart,
    lineEnd,
    lineText: text.slice(lineStart, lineEnd),
  };
}

export function wrapWithMarkers(
  text: string,
  sel: TextSelection,
  open: string,
  close: string,
): { text: string; selection: TextSelection } {
  const { start, end } = sel;
  if (start < end) {
    const selected = text.slice(start, end);
    const newText =
      text.slice(0, start) + open + selected + close + text.slice(end);
    return {
      text: newText,
      selection: { start, end: end + open.length + close.length },
    };
  }
  const newText = text.slice(0, start) + open + close + text.slice(start);
  const cursor = start + open.length;
  return {
    text: newText,
    selection: { start: cursor, end: cursor },
  };
}

export function toggleLinePrefix(
  text: string,
  sel: TextSelection,
  prefix: string,
): { text: string; selection: TextSelection } {
  const { lineStart, lineEnd, lineText } = getLineAtIndex(text, sel.start);
  let newLine: string;
  let delta: number;

  if (lineText.startsWith(prefix)) {
    newLine = lineText.slice(prefix.length);
    delta = -prefix.length;
  } else {
    newLine = prefix + lineText;
    delta = prefix.length;
  }

  const newText = text.slice(0, lineStart) + newLine + text.slice(lineEnd);
  const newStart = Math.max(lineStart, sel.start + delta);
  const newEnd = Math.max(lineStart, sel.end + delta);

  return {
    text: newText,
    selection: { start: newStart, end: newEnd },
  };
}

export function insertNumberedPrefix(
  text: string,
  sel: TextSelection,
): { text: string; selection: TextSelection } {
  const { lineStart, lineEnd, lineText } = getLineAtIndex(text, sel.start);

  const numberedMatch = /^(\d+)\.\s/.exec(lineText);
  if (numberedMatch) {
    return { text, selection: sel };
  }

  let number = 1;
  if (lineStart > 0) {
    const prevNewline = text.lastIndexOf("\n", lineStart - 2);
    const prevStart = prevNewline === -1 ? 0 : prevNewline + 1;
    const prevLine = text.slice(prevStart, lineStart - 1);
    const prevMatch = /^(\d+)\.\s/.exec(prevLine);
    if (prevMatch) {
      number = parseInt(prevMatch[1], 10) + 1;
    }
  }

  const prefix = `${number}. `;
  const newLine = prefix + lineText;
  const newText = text.slice(0, lineStart) + newLine + text.slice(lineEnd);
  const delta = prefix.length;

  return {
    text: newText,
    selection: {
      start: sel.start + delta,
      end: sel.end + delta,
    },
  };
}

export function insertAtCursor(
  text: string,
  sel: TextSelection,
  insert: string,
): { text: string; selection: TextSelection } {
  const { start, end } = sel;
  const newText = text.slice(0, start) + insert + text.slice(end);
  const cursor = start + insert.length;
  return {
    text: newText,
    selection: { start: cursor, end: cursor },
  };
}

export function stripAllFormatting(text: string): string {
  const lines = text.split("\n");
  const stripped = lines.map((line) => {
    if (line.trim() === "---") return "";
    let result = line;
    if (result.startsWith("## ")) result = result.slice(3);
    if (result.startsWith("• ")) result = result.slice(2);
    result = result.replace(/^\d+\.\s/, "");
    result = result.replace(/\*\*([^*]+)\*\*/g, "$1");
    result = result.replace(/_([^_]+)_/g, "$1");
    return result;
  });
  return stripped.join("\n");
}

function parseInlineSegments(line: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const pattern = /(\*\*[^*]+\*\*|_[^_]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "plain",
        text: line.slice(lastIndex, match.index),
      });
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      segments.push({ type: "bold", text: token.slice(2, -2) });
    } else if (token.startsWith("_") && token.endsWith("_")) {
      segments.push({ type: "italic", text: token.slice(1, -1) });
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < line.length) {
    segments.push({ type: "plain", text: line.slice(lastIndex) });
  }

  if (segments.length === 0 && line.length > 0) {
    segments.push({ type: "plain", text: line });
  }

  return segments;
}

export function parseMarkdownPreview(text: string): PreviewBlock[] {
  if (!text) return [];

  const lines = text.split("\n");
  const blocks: PreviewBlock[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "---") {
      blocks.push({ type: "divider", segments: [] });
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({
        type: "heading",
        segments: parseInlineSegments(line.slice(3)),
      });
      continue;
    }
    if (line.startsWith("• ")) {
      blocks.push({
        type: "bullet",
        segments: parseInlineSegments(line.slice(2)),
      });
      continue;
    }
    const numberedMatch = /^(\d+)\.\s(.*)$/.exec(line);
    if (numberedMatch) {
      blocks.push({
        type: "numbered",
        number: numberedMatch[1],
        segments: parseInlineSegments(numberedMatch[2]),
      });
      continue;
    }
    blocks.push({
      type: "paragraph",
      segments: parseInlineSegments(line),
    });
  }

  return blocks;
}

function isInsideMarkers(
  text: string,
  index: number,
  open: string,
  close: string,
): boolean {
  const before = text.slice(0, index);
  const opens = (before.match(new RegExp(escapeRegex(open), "g")) || []).length;
  const closes = (before.match(new RegExp(escapeRegex(close), "g")) || [])
    .length;
  return opens > closes;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getActiveFormats(
  text: string,
  sel: TextSelection,
): ActiveFormats {
  const index = sel.start;
  const { lineText } = getLineAtIndex(text, index);

  return {
    bold: isInsideMarkers(text, index, "**", "**"),
    italic: isInsideMarkers(text, index, "_", "_"),
    bullet: lineText.startsWith("• "),
    numbered: /^\d+\.\s/.test(lineText),
    heading: lineText.startsWith("## "),
  };
}
