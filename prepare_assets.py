import os
import json
import wave
import random
import struct
import sys
from pathlib import Path

# Config
PDF_PATH = Path(r"..\quran3.pdf")
ASSETS_DIR = Path("assets")
PAGES_DIR = ASSETS_DIR / "pages"
PAGES_JSON = ASSETS_DIR / "pages.json"
AUDIO_FILE = ASSETS_DIR / "page.wav"

def ensure_dirs():
    PAGES_DIR.mkdir(parents=True, exist_ok=True)

def create_wav():
    print("Generating realistic page.wav...")
    # Generate 0.4s of noise with a specific envelope to mimic paper snap
    duration = 0.4
    rate = 44100
    frames = int(duration * rate)
    
    with wave.open(str(AUDIO_FILE), 'w') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(rate)
        
        data = bytearray()
        for i in range(frames):
            t = i / frames
            
            # White noise base
            noise = random.uniform(-1, 1)
            
            # Envelope: Sharp attack, quick decay (Snap)
            # Modeling a "p-shhh-k" sound
            if t < 0.1:
                env = t / 0.1  # Rise
            elif t < 0.3:
                env = 1.0 - ((t - 0.1) / 0.2) * 0.5 # Drop slightly
            else:
                env = 0.5 * (1.0 - (t - 0.3) / 0.7) # Fade out
            
            # Add some "crackle" (random spikes)
            if random.random() > 0.95:
                noise += random.uniform(-0.5, 0.5)

            # Frequency Low Pass filter sim (simple moving average would be better but simple scaling works for placeholder)
            # Actually, paper sound has high freq.
            
            value = int(noise * env * 24000)
            data.extend(struct.pack('<h', max(-32767, min(32767, value))))
            
        f.writeframes(data)

def create_placeholder_svgs(count=10):
    print("Generating placeholder SVGs...")
    generated_files = []
    for i in range(1, count + 1):
        filename = f"{i:03d}.svg"
        path = PAGES_DIR / filename
        
        # Simple SVG with page number
        content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900">
  <rect width="100%" height="100%" fill="#fdfae7"/>
  <rect x="20" y="20" width="560" height="860" fill="none" stroke="#665544" stroke-width="4"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="80" fill="#333">Page {i}</text>
  <text x="50%" y="90%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="30" fill="#888">PDF Conversion Failed/Skipped</text>
</svg>'''
        
        path.write_text(content, encoding="utf-8")
        generated_files.append(f"assets/pages/{filename}")
    return generated_files

def try_convert_pdf():
    if not PDF_PATH.exists():
        print(f"PDF not found at {PDF_PATH}")
        return None

    try:
        # Try importing libraries
        import fitz  # PyMuPDF
    except ImportError:
        print("PyMuPDF (fitz) not found.")
        return None

    print(f"Converting PDF: {PDF_PATH}")
    doc = fitz.open(PDF_PATH)
    generated_files = []
    
    # Convert all pages
    limit = len(doc)
    
    for i in range(limit):
        page = doc.load_page(i)
        # Increase resolution for clearer text (2.0 = 200% zoom level roughly)
        pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0))
        
        filename = f"{i+1:03d}.webp"
        output_path = PAGES_DIR / filename
        
        # Save as PNG first then maybe we can just rename? 
        # PyMuPDF saves based on extension.
        # fitz supports png, not directly webp in older versions without extras?
        # Let's save as jpg for safety
        filename = f"{i+1:03d}.jpg"
        output_path = PAGES_DIR / filename
        
        pix.save(output_path)
        generated_files.append(f"assets/pages/{filename}")
        print(f"Saved {filename}")
        
    return generated_files

def main():
    ensure_dirs()
    create_wav()
    
    pages = try_convert_pdf()
    
    if not pages:
        print("Falling back to placeholders.")
        pages = create_placeholder_svgs()
        
    # Write json
    data = {"pages": pages}
    PAGES_JSON.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"Created pages.json with {len(pages)} pages.")

if __name__ == "__main__":
    main()
