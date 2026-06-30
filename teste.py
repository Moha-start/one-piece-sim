import os
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from playwright.sync_api import sync_playwright

def download_all_images():
    url = "https://en.onepiece-cardgame.com/products/?subcategory=decks&page=3&view=normal"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    # Creating a new folder for the raw dump
    save_dir = "starter_deck_images_raw"
    os.makedirs(save_dir, exist_ok=True) 

    print("🚀 Booting up invisible browser (Brute Force Mode)...")
    with sync_playwright() as p:
        # We force a large screen size to help trigger images
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})
        page.goto(url)
        
        print("📜 Scrolling to trigger any lazy-loading scripts...")
        for _ in range(8):
            page.mouse.wheel(0, 1000)
            page.wait_for_timeout(500)
            
        page.wait_for_load_state("networkidle")
        html_content = page.content()
        browser.close()

    # Parse everything
    soup = BeautifulSoup(html_content, 'html.parser')
    images = soup.find_all('img')
    
    print(f"🔍 Found {len(images)} TOTAL images. Downloading EVERYTHING without filters...")

    download_count = 0

    for img in images:
        # Grab data-src if the site hides the real URL there, otherwise grab standard src
        src = img.get('data-src') or img.get('src')
        if not src:
            continue
            
        img_url = urljoin(url, src)
        
        # Clean the URL to ensure it has a valid extension (.png, .webp)
        parsed_url = urlparse(img_url)
        clean_path = parsed_url.path 
        filename = clean_path.split('/')[-1]
        
        if not filename:
            continue

        # Prevent file overwrites by adding a prefix number (e.g., "001_image.webp")
        base_name, ext = os.path.splitext(filename)
        final_filename = f"{download_count:03d}_{base_name}{ext}"
        filepath = os.path.join(save_dir, final_filename)

        try:
            img_data = requests.get(img_url, headers=headers).content
            with open(filepath, 'wb') as handler:
                handler.write(img_data)
            print(f"✅ Downloaded: {final_filename}")
            download_count += 1
        except Exception as e:
            print(f"⚠️ Failed to download {filename}: {e}")

    print(f"\n🗑️ Done! Dumped {download_count} images into the '{save_dir}' folder. Happy sorting!")

if __name__ == "__main__":
    download_all_images()