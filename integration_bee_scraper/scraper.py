import os
import re
import json
import time
import requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import uuid

# Base directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOAD_DIR = os.path.join(BASE_DIR, 'downloads')
os.makedirs(DOWNLOAD_DIR, exist_ok=True)
METADATA_FILE = os.path.join(DOWNLOAD_DIR, 'metadata.json')

# Session to persist headers
session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
})

def safe_request(url):
    try:
        response = session.get(url, timeout=10)
        response.raise_for_status()
        return response
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def extract_metadata(url, filename):
    metadata = {
        'url': url,
        'filename': filename,
        'university_or_competition': 'Unknown',
        'year': 'Unknown',
        'type': 'Unknown'
    }

    url_lower = url.lower()
    filename_lower = filename.lower()
    combined = url_lower + " " + filename_lower

    # Guess University / Competition
    universities = {
        'mit': 'MIT',
        'berkeley': 'UC Berkeley',
        'ucla': 'UCLA',
        'uw': 'UW',
        'wisconsin': 'UW Madison',
        'purdue': 'Purdue',
        'caltech': 'Caltech',
        'stanford': 'Stanford',
        'harvard': 'Harvard',
        'princeton': 'Princeton',
        'yale': 'Yale',
        'cornell': 'Cornell',
        'columbia': 'Columbia',
        'penn': 'UPenn',
        'brown': 'Brown',
        'dartmouth': 'Dartmouth',
        'cambridge': 'Cambridge',
        'oxford': 'Oxford',
        'imperial': 'Imperial College London',
        'ucl': 'UCL',
        'toronto': 'University of Toronto',
        'waterloo': 'University of Waterloo',
        'mcgill': 'McGill',
        'ubc': 'UBC',
        'melbourne': 'University of Melbourne',
        'sydney': 'University of Sydney',
        'unsw': 'UNSW',
        'anu': 'ANU',
        'monash': 'Monash',
        'florida': 'University of Florida',
        'texas': 'UT Austin',
        'michigan': 'University of Michigan',
        'illinois': 'UIUC',
        'georgia': 'Georgia Tech',
        'calpoly': 'Cal Poly',
        'tamu': 'Texas A&M'
    }

    for key, name in universities.items():
        if key in combined:
            metadata['university_or_competition'] = name
            break

    if 'integration bee' in combined or 'integrationbee' in combined:
        if metadata['university_or_competition'] != 'Unknown':
            metadata['university_or_competition'] += ' Integration Bee'
        else:
            metadata['university_or_competition'] = 'Integration Bee'

    # Guess Year
    year_match = re.search(r'(20\d{2}|19\d{2})', combined)
    if year_match:
        metadata['year'] = year_match.group(1)

    # Guess Type
    if 'qual' in combined:
        metadata['type'] = 'Qualifier'
    elif 'final' in combined:
        metadata['type'] = 'Final'
    elif 'semifinal' in combined or 'semi' in combined:
        metadata['type'] = 'Semifinal'
    elif 'quarterfinal' in combined or 'quarter' in combined:
        metadata['type'] = 'Quarterfinal'
    elif 'solution' in combined or 'sol' in combined:
        metadata['type'] = 'Solution'
    elif 'problem' in combined or 'prob' in combined:
        metadata['type'] = 'Problem'

    return metadata

def download_pdf(url, metadata_list, downloaded_urls):
    if url in downloaded_urls:
        return False

    print(f"Attempting to download: {url}")
    response = safe_request(url)

    if not response:
        return False

    content_type = response.headers.get('Content-Type', '').lower()

    # Sometimes PDFs don't have the exact content type, so we also check extension or if it starts with %PDF
    is_pdf = 'application/pdf' in content_type or url.lower().endswith('.pdf') or response.content.startswith(b'%PDF')

    if is_pdf:
        # Determine filename
        filename = os.path.basename(urlparse(url).path)
        if not filename or not filename.lower().endswith('.pdf'):
            filename = f"integration_bee_{uuid.uuid4().hex[:8]}.pdf"

        # Ensure unique filename
        base_name, ext = os.path.splitext(filename)
        counter = 1
        while os.path.exists(os.path.join(DOWNLOAD_DIR, filename)):
            filename = f"{base_name}_{counter}{ext}"
            counter += 1

        filepath = os.path.join(DOWNLOAD_DIR, filename)

        with open(filepath, 'wb') as f:
            f.write(response.content)

        metadata = extract_metadata(url, filename)
        metadata_list.append(metadata)
        downloaded_urls.add(url)

        print(f"Successfully downloaded: {filename}")

        # Save metadata incrementally
        with open(METADATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(metadata_list, f, indent=4)

        return True

    return False

def search_duckduckgo_html(query):
    """Fallback search using duckduckgo html version since api is restricted."""
    search_url = 'https://html.duckduckgo.com/html/'
    data = {'q': query}

    print(f"Searching DuckDuckGo for: {query}")
    try:
        response = session.post(search_url, data=data, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')

        links = []
        for a in soup.find_all('a', class_='result__snippet'):
            href = a.get('href')
            if href:
                links.append(href)

        # also try normal a tags if class changes
        if not links:
            for a in soup.find_all('a', class_='result__url'):
                href = a.get('href')
                if href:
                    links.append(href)

        return links
    except Exception as e:
        print(f"DuckDuckGo search error: {e}")
        return []

def search_direct_sources():
    """Directly crawl known potential sources for integration bees."""
    sources = [
        "https://math.mit.edu/~yyao1/integrationbee.html",
        "http://math.mit.edu/~yyao1/integrationbee.html",
        "https://integrationbee.org/",
        "https://math.berkeley.edu/~jason_m/integration_bee.html",
        "https://www.math.ucla.edu/ugrad/integration-bee",
        "https://math.washington.edu/integration-bee",
        "https://integration-bee.github.io/"
    ]

    links = []
    for source in sources:
        print(f"Crawling source: {source}")
        response = safe_request(source)
        if response:
            soup = BeautifulSoup(response.text, 'html.parser')
            for a in soup.find_all('a'):
                href = a.get('href')
                if href:
                    full_url = urljoin(source, href)
                    if full_url.lower().endswith('.pdf'):
                        links.append(full_url)
    return links

def main():
    print("Starting Integration Bee PDF Scraper...")

    metadata_list = []
    if os.path.exists(METADATA_FILE):
        with open(METADATA_FILE, 'r') as f:
            try:
                metadata_list = json.load(f)
            except json.JSONDecodeError:
                metadata_list = []

    downloaded_urls = {m['url'] for m in metadata_list}

    search_queries = [
        '"integration bee" filetype:pdf',
        '"integration bee" qualifier pdf',
        '"integration bee" solutions pdf',
        '"integration bee" past papers pdf',
        'site:mit.edu "integration bee" filetype:pdf',
        'site:edu "integration bee" filetype:pdf',
        'site:ac.uk "integration bee" filetype:pdf',
        'math "integration bee" problems pdf',
        'calculus "integration bee" pdf'
    ]

    universities = ['MIT', 'Berkeley', 'UCLA', 'Wisconsin', 'Cambridge', 'Oxford', 'Florida', 'Texas', 'Michigan', 'Stanford', 'Harvard', 'Princeton', 'Yale', 'Cornell', 'Columbia', 'Penn', 'Brown', 'Dartmouth', 'Imperial', 'UCL', 'Toronto', 'Waterloo', 'McGill', 'UBC', 'Melbourne', 'Sydney', 'UNSW', 'ANU', 'Monash', 'Cal Poly', 'Texas A&M']

    years = [str(y) for y in range(2010, 2025)]

    for uni in universities[:5]: # Add top 5 universities explicitly
        search_queries.append(f'"{uni} integration bee" filetype:pdf')
        for year in years[-3:]: # Add last 3 years
            search_queries.append(f'"{uni} integration bee" {year} filetype:pdf')

    consecutive_no_new = 0
    max_loops_no_new = 3
    loop_count = 0

    # Phase 1: Direct Crawling
    print("--- Phase 1: Direct Crawling Known Sources ---")
    direct_links = search_direct_sources()
    new_found = 0
    for link in direct_links:
        if download_pdf(link, metadata_list, downloaded_urls):
            new_found += 1
            time.sleep(1) # Polite delay

    print(f"Direct crawling found {new_found} new PDFs.")

    # Phase 2: Search Engine Loop
    print("--- Phase 2: Search Engine Loop ---")

    while consecutive_no_new < max_loops_no_new and loop_count < len(search_queries):
        query = search_queries[loop_count]
        print(f"Loop {loop_count + 1}: Searching for '{query}'")

        links = search_duckduckgo_html(query)
        new_found_this_loop = 0

        # Try to resolve duckduckgo redirect URLs
        resolved_links = []
        for link in links:
            if 'uddg=' in link:
                try:
                    from urllib.parse import unquote
                    actual_url = unquote(link.split('uddg=')[1].split('&')[0])
                    resolved_links.append(actual_url)
                except:
                    resolved_links.append(link)
            else:
                resolved_links.append(link)

        for link in resolved_links:
            if link.lower().endswith('.pdf'):
                if download_pdf(link, metadata_list, downloaded_urls):
                    new_found_this_loop += 1
                    time.sleep(1.5) # Polite delay
            elif any(domain in link for domain in ['.edu', '.ac.uk', '.org']):
                # It might be a page containing PDFs
                try:
                    res = safe_request(link)
                    if res:
                        soup = BeautifulSoup(res.text, 'html.parser')
                        for a in soup.find_all('a'):
                            href = a.get('href')
                            if href:
                                full_url = urljoin(link, href)
                                if full_url.lower().endswith('.pdf'):
                                    if download_pdf(full_url, metadata_list, downloaded_urls):
                                        new_found_this_loop += 1
                                        time.sleep(1.5)
                except Exception as e:
                    pass

        if new_found_this_loop == 0:
            consecutive_no_new += 1
            print(f"No new PDFs found this loop. Consecutive no new: {consecutive_no_new}")
        else:
            consecutive_no_new = 0
            print(f"Found {new_found_this_loop} new PDFs this loop.")

        loop_count += 1
        time.sleep(3) # Delay between searches to avoid IP ban

    print(f"Scraping finished. Total unique PDFs downloaded: {len(metadata_list)}")

if __name__ == "__main__":
    main()
