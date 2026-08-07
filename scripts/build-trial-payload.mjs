import { PDFParse } from "pdf-parse";
import fs from "node:fs/promises";

const src = "C:/Users/lenovo/Desktop/uni math/STEP/step-resources-master/1994-2018/2007/STEP 2 2007.pdf";
const bytes = await fs.readFile(src);
const parser = new PDFParse({ data: bytes });
// Page 2 has real content (questions 1-3); page 1 is just the cover sheet.
const screenshot = await parser.getScreenshot({ first: 2, last: 2, scale: 1.3, imageBuffer: true });
const text = await parser.getText({ first: 2, last: 2 }).catch(() => ({ text: "" }));
await parser.destroy();

const payload = {
  source_competition: "STEP II",
  year: 2007,
  subject: "Mathematics",
  source_url: "file://STEP-II-2007-page2-trial",
  raw_text: text.text || "",
  page_images: [Buffer.from(screenshot.pages[0].data).toString("base64")],
  license_note: "Publicly available past paper; non-proprietary (one-page pilot trial)",
};

await fs.writeFile("scripts/.trial-payload.json", JSON.stringify(payload));
console.log("wrote payload,", JSON.stringify(payload).length, "bytes");
