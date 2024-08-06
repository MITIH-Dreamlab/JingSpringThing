import json
import re
from bs4 import BeautifulSoup
from datetime import datetime
import dateutil.parser
import warnings
from dateutil.tz import gettz
import time
import random
import cloudscraper
import argparse
import os

# Suppress specific warnings
warnings.filterwarnings("ignore", category=UserWarning, module='bs4')

# Mapping for unknown timezones
tzinfos = {
    'EDT': gettz('America/New_York'),
    'EST': gettz('America/New_York'),
    'PST': gettz('America/Los_Angeles'),
    'PDT': gettz('America/Los_Angeles'),
    'IST': gettz('Asia/Kolkata'),
    'PT': gettz('America/Los_Angeles')
}

# List of user agents for rotation
user_agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/91.0.4472.80 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59'
]

def parse_date(date_str):
    """Parse a date string and return a formatted date."""
    try:
        return dateutil.parser.parse(date_str, fuzzy=True, tzinfos=tzinfos).strftime('%Y-%m-%d')
    except (ValueError, OverflowError, AttributeError) as e:
        print(f"Error parsing date '{date_str}': {e}")
        return None

def calculate_weight(published_date):
    """Calculate the weight of an article based on its publication date."""
    if not published_date:
        return 0.5
    
    try:
        date = datetime.strptime(published_date, '%Y-%m-%d')
        today = datetime.now()
        age = (today - date).days
        
        if age <= 30:
            return 1.0
        elif age <= 365:
            return 0.8
        elif age <= 3*365:
            return 0.6
        else:
            return 0.4
    except ValueError as e:
        print(f"Error calculating weight for date '{published_date}': {e}")
        return 0.5

def get_scraper():
    """Create a cloudscraper session with stealth mode."""
    return cloudscraper.create_scraper(
        browser={
            'browser': 'chrome',
            'platform': 'windows',
            'desktop': True
        }
    )

def get_random_user_agent():
    """Return a random user agent from the list."""
    return random.choice(user_agents)

def scrape_date(url, scraper):
    """Scrape the publication date from a given URL using stealth mode."""
    print(f"Scraping date for URL: {url}")  # Debug print
    try:
        headers = {
            'User-Agent': get_random_user_agent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://www.google.com/',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0',
        }
        response = scraper.get(url, timeout=30, headers=headers)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Look for common date meta tags
        meta_tags = [
            'article:published_time', 'pubdate', 'publishdate', 'og:published_time',
            'datePublished', 'dateModified', 'article:modified_time', 'og:updated_time'
        ]
        for tag in meta_tags:
            date = soup.find('meta', property=tag) or soup.find('meta', attrs={'name': tag})
            if date:
                print(f"Found date in meta tag: {date['content']}")  # Debug print
                return parse_date(date['content'])
        
        # If meta tags fail, look for date in the text
        text = soup.get_text()
        date_patterns = [
            r'\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}',
            r'(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}',
            r'\d{4}-\d{2}-\d{2}',  # ISO format dates
            r'\d{2}/\d{2}/\d{4}',  # US format dates
            r'\d{2}-\d{2}-\d{4}'   # EU format dates
        ]
        for pattern in date_patterns:
            date_match = re.search(pattern, text)
            if date_match:
                print(f"Found date in text: {date_match.group()}")  # Debug print
                return parse_date(date_match.group())
        
        print(f"No date found for URL: {url}")  # Debug print
        return None
    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return None

def main(input_file, output_file):
    print(f"Reading input file: {input_file}")  # Debug print
    try:
        with open(input_file, 'r') as file:
            data = json.load(file)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error reading input file: {e}")
        return

    print(f"Input data: {data}")  # Debug print

    scraper = get_scraper()
    results = []

    # Check for 'hyperlinks' key instead of 'urls'
    urls = data.get('hyperlinks', [])
    if not urls:
        print("No 'hyperlinks' found in the input JSON.")
        return

    for url in urls:
        time.sleep(random.uniform(2, 5))
        
        date = scrape_date(url, scraper)
        weight = calculate_weight(date)
        results.append({
            "url": url,
            "date": date,
            "weight": weight
        })

    print(f"Results: {results}")  # Debug print

    try:
        with open(output_file, 'w') as file:
            json.dump(results, file, indent=2)
        print(f"Results written to {output_file}")
    except IOError as e:
        print(f"Error writing output file: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape dates from URLs in a JSON file.")
    parser.add_argument("input_file", help="Path to the input JSON file")
    parser.add_argument("-o", "--output", help="Path to the output JSON file (default: output.json)", default="output.json")
    args = parser.parse_args()

    main(args.input_file, args.output)


