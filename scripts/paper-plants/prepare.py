"""Turn cut-out plant parts into game textures in public/assets/paper/plants/.

    python3 scripts/paper-plants/cut_sheet.py <sheet> <cut_dir> <name> 0.0005   (for each sheet)
    python3 scripts/paper-plants/prepare.py <cut_dir>

Sheets: paper-gen/plant-parts/<name>-parts.png on branch design-candidates,
painted by GPT (2026-11-04) from the owner's picks: clover 1, fern 2,
bloom 1 (violet), moss 3, grass 1, tree 2 (Calathea), lily 2, reed 2,
mushroom 3, fallen-leaf 2 (oak). cut_sheet numbers pieces in reading order;
`parts` below names them. Saved as WebP (alpha kept) to keep downloads small.
"""
import os
import sys
import numpy as np
from PIL import Image

out = 'public/assets/paper/plants'

# piece numbers from cut_sheet -> names in the game
parts = {
    'clover': {1: 'leaf-1', 2: 'leaf-2', 3: 'leaf-3', 6: 'flower'},
    'fern': {1: 'frond-1', 2: 'frond-2', 3: 'frond-3'},
    'bloom': {1: 'leaf-1', 2: 'leaf-2', 3: 'leaf-3', 4: 'flower-1', 5: 'flower-2', 6: 'flower-side'},
    'moss': {1: 'top', 2: 'side', 3: 'stalk-1', 4: 'stalk-2', 5: 'stalk-3'},
    'grass': {1: 'tuft-1', 2: 'tuft-2'},
    'tree': {1: 'leaf-1', 2: 'leaf-2', 3: 'leaf-3', 4: 'leaf-4', 5: 'base'},
    'lily': {1: 'pad-1', 2: 'pad-2', 3: 'pad-3', 4: 'flower-top', 5: 'flower-side'},
    'reed': {1: 'tuft-1', 2: 'tuft-2', 3: 'stalk-1', 4: 'stalk-2', 5: 'stalk-3'},
    'mushroom': {1: 'side-1', 2: 'side-2', 3: 'side-3', 4: 'cap-1', 5: 'cap-2'},
    'fallen-leaf': {1: 'oak-1', 2: 'oak-2', 3: 'oak-3', 4: 'oak-4', 5: 'oak-5'},
}


def fit(image, longest=384):
    scale = longest / max(image.size)
    return image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.LANCZOS) if scale < 1 else image


def thin(image):
    """Thin blades: the pale paper border between them reads as noise in 3D, so it is cut away."""
    pixels = np.array(image.convert('RGBA'))
    rgb = pixels[..., :3].astype(int)
    pale = (rgb.min(axis=2) > 196) & (rgb.max(axis=2) - rgb.min(axis=2) < 40)
    pixels[..., 3] = np.where(pale, 0, pixels[..., 3])
    return Image.fromarray(pixels)


def main(cut):
    total = 0
    for kind, names in parts.items():
        os.makedirs(f'{out}/{kind}', exist_ok=True)
        for number, name in names.items():
            image = Image.open(f'{cut}/{kind}-{number}.png').convert('RGBA')
            if kind in ('grass', 'reed'): image = thin(image)
            longest = 512 if kind in ('tree', 'fern', 'moss', 'lily') else 384
            path = f'{out}/{kind}/{name}.webp'
            fit(image, longest).save(path, 'WEBP', quality=86, method=6)
            total += os.path.getsize(path)
            print(path, Image.open(path).size, os.path.getsize(path))
    print('total', total)


if __name__ == '__main__':
    main(sys.argv[1])
