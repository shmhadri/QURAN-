import json
from pathlib import Path

# Config
ASSETS_DIR = Path("assets")
PAGES_DIR = ASSETS_DIR / "pages"
PAGES_JSON = ASSETS_DIR / "pages.json"

def update_json():
    # Find all jpgs
    imgs = sorted([p.name for p in PAGES_DIR.glob("*.jpg")])
    
    if not imgs:
        print("No JPGs found yet.")
        return

    pages_list = [f"assets/pages/{name}" for name in imgs]
    
    data = {"pages": pages_list}
    PAGES_JSON.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"Updated pages.json with {len(imgs)} pages.")

if __name__ == "__main__":
    update_json()
