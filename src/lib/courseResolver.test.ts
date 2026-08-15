import { describe, it, expect } from "vitest";
import { extractDocumentLinks } from "../../supabase/functions/_shared/courseResolver";

/**
 * Link enumeration is the deterministic half of course resolution — the part that replaces "ask a
 * search API for six relevant hits" with "read the archive index and take everything on it". It runs
 * against real-world index-page markup, so the tests are about messy HTML, not the happy path.
 */
describe("extractDocumentLinks", () => {
  const BASE = "https://www.maths.cam.ac.uk/undergrad/pastpapers/";

  it("resolves relative, root-relative and absolute hrefs", () => {
    const html = `
      <a href="2023/paper1.pdf">Paper 1, 2023</a>
      <a href="/undergrad/pastpapers/2022/paper2.pdf">Paper 2, 2022</a>
      <a href="https://example.ac.uk/archive/paper3.pdf">Paper 3</a>
    `;
    const links = extractDocumentLinks(html, BASE);
    expect(links.map((l) => l.url)).toEqual([
      "https://www.maths.cam.ac.uk/undergrad/pastpapers/2023/paper1.pdf",
      "https://www.maths.cam.ac.uk/undergrad/pastpapers/2022/paper2.pdf",
      "https://example.ac.uk/archive/paper3.pdf",
    ]);
  });

  it("keeps only document links, not navigation chrome", () => {
    const html = `
      <a href="/about">About the faculty</a>
      <a href="index.html">Index</a>
      <a href="notes.pdf">Lecture notes</a>
      <a href="mailto:someone@cam.ac.uk">Email</a>
      <a href="#top">Back to top</a>
      <a href="javascript:void(0)">Menu</a>
    `;
    const links = extractDocumentLinks(html, BASE);
    expect(links).toHaveLength(1);
    expect(links[0].url).toContain("notes.pdf");
  });

  it("dedupes a document linked more than once", () => {
    const html = `
      <a href="paper1.pdf">Paper 1</a>
      <a href="paper1.pdf">Paper 1 (mirror)</a>
    `;
    expect(extractDocumentLinks(html, BASE)).toHaveLength(1);
  });

  it("uses the link text as the title and strips nested markup", () => {
    const html = `<a href="sheet1.pdf"><span>Example</span> <em>Sheet 1</em></a>`;
    expect(extractDocumentLinks(html, BASE)[0].title).toBe("Example Sheet 1");
  });

  it("falls back to the filename when the link has no text", () => {
    const html = `<a href="2019/paper4.pdf"><img src="pdf-icon.png"></a>`;
    expect(extractDocumentLinks(html, BASE)[0].title).toBe("paper4.pdf");
  });

  it("survives attributes in any order and single quotes", () => {
    const html = `<a class="doc" href='2018/paper5.pdf' target="_blank" data-x='1'>Paper 5</a>`;
    const links = extractDocumentLinks(html, BASE);
    expect(links).toHaveLength(1);
    expect(links[0].title).toBe("Paper 5");
  });

  it("accepts query strings on the document url", () => {
    const html = `<a href="download.pdf?id=77">Paper 7</a>`;
    expect(extractDocumentLinks(html, BASE)[0].url).toContain("download.pdf?id=77");
  });

  it("returns nothing for a page with no documents rather than guessing", () => {
    expect(extractDocumentLinks(`<a href="/courses">Courses</a>`, BASE)).toEqual([]);
  });

  it("ignores an unparseable href instead of throwing", () => {
    const html = `<a href="ht!tp://[bad">Broken</a><a href="ok.pdf">Fine</a>`;
    const links = extractDocumentLinks(html, BASE);
    expect(links).toHaveLength(1);
    expect(links[0].title).toBe("Fine");
  });
});
