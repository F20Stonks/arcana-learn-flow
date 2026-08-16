import type { PDFDocumentProxy } from "@/lib/pdf";

/**
 * Turn a PDF's own outline into a course structure.
 *
 * WHY THE OUTLINE AND NOT AI: a textbook already ships the exact hierarchy a track wants — chapters,
 * sections, and the page each starts on — embedded as PDF bookmarks. Asking a model to re-derive that
 * from extracted text costs money, takes minutes on a 400-page book, and is *worse*, because the model
 * guesses page numbers while the outline knows them. Verified on a real analysis textbook: 418 pages,
 * 25 top-level entries, chapters carrying 3-7 sections, every destination resolving to a page.
 *
 * Books without an outline (short booklets, scans) return null, and the caller falls back to asking the
 * student — an honest empty result beats a hallucinated table of contents.
 */

export interface BookSection {
  title: string;
  pageStart: number;
  pageEnd: number;
}

export interface BookChapter {
  title: string;
  pageStart: number;
  pageEnd: number;
  sections: BookSection[];
}

/**
 * Outline entries that are not course content. Matched on the WHOLE title, so a legitimate section
 * called "Index Notation" or "The Reference Angle" is not dropped for containing "index"/"reference".
 */
const FRONT_BACK_MATTER =
  /^(cover|title\s*page|copyright|contents?|table\s+of\s+contents|preface|foreword|acknowledgement?s|dedication|about\s+the\s+authors?|index|bibliography|references|glossary|colophon|back\s*cover|endpapers?)$/i;

/**
 * Strips "CHAPTER 3" / "3.1" / "§3" leaders so a topic reads as its subject, not its numbering.
 *
 * The trailing \s+ is load-bearing. Without it, "1.1 Sets and Functions" backtracks into matching just
 * "1." and yields "1 Sets and Functions" — the section number half-eaten, which looks like a typo rather
 * than a formatting choice.
 */
function cleanTitle(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(chapter|section|part|unit|appendix)\s+[\dIVXLC]+[.:—–-]*\s*/i, "")
    .replace(/^[\dIVXLC]+(\.\d+)*[.:)—–-]*\s+/, "")
    .trim();
}

interface RawItem {
  title: string;
  items?: RawItem[];
  dest: unknown;
}

export async function extractBookStructure(pdf: PDFDocumentProxy): Promise<BookChapter[] | null> {
  const outline = (await pdf.getOutline()) as RawItem[] | null;
  if (!outline?.length) return null;

  async function pageOf(item: RawItem): Promise<number | null> {
    try {
      let dest = item.dest;
      // A named destination is a string that has to be looked up; an explicit one is already an array.
      if (typeof dest === "string") dest = await pdf.getDestination(dest);
      if (!Array.isArray(dest) || !dest[0]) return null;
      return (await pdf.getPageIndex(dest[0] as never)) + 1;
    } catch {
      return null;
    }
  }

  // Flatten to (title, page, depth) first. Page ranges can only be computed once every start page is
  // known, because a section ends where the NEXT heading begins — not at any page it stores itself.
  let flat: { title: string; page: number; depth: number }[] = [];
  async function visit(items: RawItem[], depth: number) {
    for (const item of items) {
      const title = String(item.title ?? "").trim();
      const page = await pageOf(item);
      if (page && title && !FRONT_BACK_MATTER.test(title.replace(/\s+/g, " ").trim())) {
        flat.push({ title, page, depth });
      }
      // Recurse even through a skipped parent: real books nest content under an unhelpful wrapper.
      if (item.items?.length) await visit(item.items, depth + 1);
    }
  }
  await visit(outline, 0);

  if (!flat.length) return null;

  // WHICH DEPTHS ARE THE COURSE. A maths textbook's outline usually runs deeper than its teaching
  // structure: the analysis book tested here lists every numbered Definition, Theorem and Example as its
  // own depth-2 entry, so taking "everything below a chapter" produced 579 subtopics across 15 chapters
  // — a track of individual theorems, which is not how anyone studies. Meanwhile some books wrap
  // everything in one or two "Part" entries at depth 0, so hard-coding depth 0 as the chapter is wrong
  // in the other direction.
  //
  // So pick the shallowest depth that has enough entries to plausibly BE the chapter list, and take the
  // single level below it as sections. Everything deeper is detail within a section.
  const perDepth = new Map<number, number>();
  for (const f of flat) perDepth.set(f.depth, (perDepth.get(f.depth) ?? 0) + 1);
  const depths = [...perDepth.keys()].sort((a, b) => a - b);
  const chapterDepth = depths.find((d) => (perDepth.get(d) ?? 0) >= 3) ?? depths[0];
  const sectionDepth = chapterDepth + 1;

  // Filter BEFORE computing ranges. A section runs until the next section or chapter — not until the
  // first Definition nested inside it, which would have ended "1.1 Sets and Functions" on its own
  // opening page.
  flat = flat.filter((f) => f.depth === chapterDepth || f.depth === sectionDepth);

  // Outlines are usually in reading order, but a malformed one is not, and non-monotonic pages would
  // produce negative-length ranges.
  flat.sort((a, b) => a.page - b.page || a.depth - b.depth);

  const endFor = (i: number) => {
    for (let j = i + 1; j < flat.length; j++) {
      if (flat[j].page > flat[i].page) return flat[j].page - 1;
    }
    return pdf.numPages;
  };

  const chapters: BookChapter[] = [];
  for (let i = 0; i < flat.length; i++) {
    const entry = flat[i];
    const title = cleanTitle(entry.title) || entry.title;
    const pageEnd = endFor(i);

    // Depth 0 opens a chapter; anything deeper is a section of the chapter currently open. A book whose
    // outline is entirely flat therefore yields chapters with no sections, which the caller handles by
    // promoting each chapter to a single-subtopic topic.
    if (entry.depth === chapterDepth || chapters.length === 0) {
      chapters.push({ title, pageStart: entry.page, pageEnd, sections: [] });
    } else {
      const chapter = chapters[chapters.length - 1];
      chapter.sections.push({ title, pageStart: entry.page, pageEnd });
      chapter.pageEnd = Math.max(chapter.pageEnd, pageEnd);
    }
  }

  // A "chapter" covering two pages with no sections is a heading, not a unit of study. Requiring either
  // real length or real substructure keeps a 40-entry outline from becoming a 40-topic track of stubs.
  const meaningful = chapters.filter((c) => c.sections.length > 0 || c.pageEnd - c.pageStart >= 3);
  return meaningful.length ? meaningful : chapters;
}
