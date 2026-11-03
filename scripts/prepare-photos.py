"""Make display copies; the exported Ricoh originals are never modified."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageOps

intake, destination = Path(sys.argv[1]), Path(sys.argv[2])
manifest = json.loads((intake / 'manifest.json').read_text())
destination.mkdir(parents=True, exist_ok=True)
metadata = []
for item in sorted(manifest['items'], key=lambda item: item['order']):
    stem = f"{item['order']:03}"
    with Image.open(intake / item['file']) as original:
        image = ImageOps.exif_transpose(original).convert('RGB')
        sizes = {}
        for label, width in [('small', 900), ('large', 1800), ('full', 3000)]:
            resized = image.copy()
            resized.thumbnail((width, width), Image.Resampling.LANCZOS)
            resized.save(destination / f'{stem}-{label}.jpg', quality=86, optimize=True, progressive=True)
            sizes[label] = {'width': resized.width, 'height': resized.height}
        metadata.append({'order': item['order'], **sizes})
print(json.dumps(metadata))
