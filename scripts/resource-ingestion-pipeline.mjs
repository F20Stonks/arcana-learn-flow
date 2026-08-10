import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFParse } from 'pdf-parse';
import { translate } from '@vitalets/google-translate-api';
// Normally we'd use a postgres client here, but since this is a local script acting like the supabase ingestion functions,
// we will output a JSON file that can be seeded, or log SQL statements, to be safe without full Supabase credentials setup in this script.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '..', 'ingested_data');
const UNPROCESSABLE_LOG = path.join(OUTPUT_DIR, 'pending_vision_resources.csv');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

if (!fs.existsSync(UNPROCESSABLE_LOG)) {
  fs.writeFileSync(UNPROCESSABLE_LOG, 'URL,Track,Subject,Reason\n');
}

// Mock URLs for demo/testing - in a real thorough run this would be hundreds of fetched URLs from across the web.
const RESOURCES_TO_SCRAPE = [
    {
        url: 'https://www.admissionstesting.org/Images/47831-engaa-specimen-paper-section-1.pdf',
        track: 'ENGAA',
        subject: 'Engineering',
        type: 'past_paper',
        language: 'English',
        country: 'UK',
        year: 2016
    },
    {
        url: 'https://bmo.ukmathstrust.org.uk/downloads/bmo1-2023.pdf',
        track: 'BMO',
        subject: 'Mathematics',
        type: 'past_paper',
        language: 'English',
        country: 'UK',
        year: 2023
    },
    // Adding a mock french resource to test translation
    {
        url: 'https://example.com/french_olympiad_2022.pdf',
        track: 'Olympiad',
        subject: 'Mathematics',
        type: 'past_paper',
        language: 'French',
        country: 'France',
        year: 2022
    }
];


async function downloadPdf(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (e) {
        console.error(`Error downloading ${url}:`, e);
        return null;
    }
}

async function processPdf(buffer, metadata) {
    try {
        const parser = new PDFParse({ data: buffer });
        const data = await parser.getText().catch(() => ({ text: "" }));
        let text = data.text;

        // Very basic heuristic to check if pdf-parse garbled the math completely or found no text
        if (text.length < 50 || text.includes('')) {
             return { success: false, reason: 'unreadable_or_garbled_math' };
        }

        // If not english, attempt translation
        if (metadata.language !== 'English') {
            try {
                const res = await translate(text.substring(0, 5000), { to: 'en' }); // limit to 5000 chars for demo
                text = res.text;
            } catch(e) {
                 console.error('Translation failed', e);
                 return { success: false, reason: 'translation_failed' };
            }
        }

        return { success: true, text: text };
    } catch(e) {
        console.error(`Error processing PDF:`, e);
        return { success: false, reason: 'pdf_parse_error' };
    }
}

async function main() {
    console.log("Starting resource ingestion pipeline...");
    const ingestedData = [];

    for (const resource of RESOURCES_TO_SCRAPE) {
        console.log(`Processing: ${resource.url}`);

        // Skip mock urls in actual execution unless they are valid, handling fetch errors gracefully
        let pdfBuffer;
        if(resource.url.includes('example.com')) {
           console.log(`Mock URL skipped for download, adding to unprocessable log: ${resource.url}`);
           fs.appendFileSync(UNPROCESSABLE_LOG, `${resource.url},${resource.track},${resource.subject},mock_url_skipped\n`);
           continue;
        }

        pdfBuffer = await downloadPdf(resource.url);

        if (!pdfBuffer) {
             fs.appendFileSync(UNPROCESSABLE_LOG, `${resource.url},${resource.track},${resource.subject},download_failed\n`);
             continue;
        }

        const result = await processPdf(pdfBuffer, resource);

        if (result.success) {
            // In a real app we'd split the text into questions, but for this demo we'll save the raw text chunk
            // and assume it's one large reference document or we store the first 500 chars as a summary
            const record = {
                source_competition: resource.track,
                year: resource.year,
                subject: resource.subject,
                language: resource.language,
                source_country: resource.country,
                resource_type: resource.type,
                learning_track: resource.track,
                source_url: resource.url,
                question_text: result.text.substring(0, 2000) + '...', // Truncating for output file size
                has_diagram: true, // We assume true for all original PDFs so users can view them
                // We mock the storage path here. In reality, we'd upload `pdfBuffer` to Supabase Storage and get a path back.
                full_pdf_storage_path: `reference-papers/${resource.track}_${resource.year}.pdf`
            };
            ingestedData.push(record);
            console.log(`Successfully parsed and prepared data for: ${resource.url}`);
        } else {
            console.log(`Failed to process clean text for ${resource.url}. Reason: ${result.reason}`);
            fs.appendFileSync(UNPROCESSABLE_LOG, `${resource.url},${resource.track},${resource.subject},${result.reason}\n`);
        }
    }

    if (ingestedData.length > 0) {
        fs.writeFileSync(path.join(OUTPUT_DIR, 'ingested_resources.json'), JSON.stringify(ingestedData, null, 2));
        console.log(`Saved ${ingestedData.length} records to ingested_resources.json`);
    }

    console.log("Pipeline complete.");
}

main();
