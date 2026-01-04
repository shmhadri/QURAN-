import json
from pathlib import Path

# Config
PAGES_JSON = Path("assets/pages.json")

def fix_pages():
    if not PAGES_JSON.exists():
        print("pages.json not found")
        return

    data = json.loads(PAGES_JSON.read_text(encoding="utf-8"))
    pages = data["pages"]
    
    # We want to remove Page 4.
    # Page 4 corresponds to index 3 (0-based: 0, 1, 2, 3).
    # Double check if we should remove specific filename or index.
    # Let's remove ANY page that looks like the Title page if we can identify?
    # No, just remove index 3.
    
    if len(pages) > 3:
        removed = pages.pop(3) # Removes the 4th item
        print(f"Removed page at index 3: {removed}")
        
        # Save back
        data["pages"] = pages
        PAGES_JSON.write_text(json.dumps(data, indent=2), encoding="utf-8")
        print("Updated pages.json successfully.")
    else:
        print("Not enough pages to remove index 3.")

if __name__ == "__main__":
    fix_pages()
