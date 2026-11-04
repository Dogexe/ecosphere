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
from PIL import Image, ImageFilter

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


def shift(mask, dy, dx):
    out = np.zeros_like(mask)
    h, w = mask.shape
    out[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = mask[max(0, -dy):h + min(0, -dy), max(0, -dx):w + min(0, -dx)]
    return out


def dilate(mask):
    grown = mask.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)): grown |= shift(mask, dy, dx)
    return grown


def strip_border(image, reach=26, tolerance=14, line=0):
    """No paper border (owner, 2026-11-04: stylish, semi-real).

    The cream border is eaten inward from the transparent outside, through
    pixels close to the border's own colour, at most `reach` pixels deep, so
    pale parts inside a painting (lily petals, mushroom gills) stay. `line`
    first strips that many pixels of a thin dark line drawn outside the border
    (the mushroom sheet has one). The new
    edge is darkened a little, like a cut edge in shade, instead of a line.
    """
    pixels = np.array(image.convert('RGBA')).astype(int)
    alpha = pixels[..., 3]
    outside = alpha < 128
    for _ in range(line): outside = dilate(outside)
    rim = dilate(dilate(dilate(outside))) & ~outside
    if not rim.any(): return image
    colour = np.median(pixels[rim][:, :3], axis=0)
    close = (np.abs(pixels[..., :3] - colour).max(axis=2) < tolerance) | (alpha < 250) | (pixels[..., :3].min(axis=2) > 240)
    region = outside.copy()
    for _ in range(reach):
        grown = dilate(region) & close
        if (grown == region).all(): break
        region = grown
    keep = ~region
    if line:
        # Opening: the thin outer line drops away, the thick body stays.
        for _ in range(line): keep = ~dilate(~keep)
        for _ in range(line): keep = dilate(keep) & ~outside
    edge = keep & dilate(dilate(region))
    pixels[..., :3] = np.where(edge[..., None], pixels[..., :3] * 0.72, pixels[..., :3])
    soft = Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    out = Image.fromarray(pixels.clip(0, 255).astype(np.uint8))
    out.putalpha(Image.fromarray(np.minimum(np.array(soft), alpha.astype(np.uint8))))
    return out


def main(cut):
    total = 0
    for kind, names in parts.items():
        os.makedirs(f'{out}/{kind}', exist_ok=True)
        for number, name in names.items():
            image = Image.open(f'{cut}/{kind}-{number}.png').convert('RGBA')
            image = strip_border(image, line=5 if kind == 'mushroom' else 0)
            # Grass and reed blades, and the lily pad's notch, enclose paper and white the outside flood can't reach.
            if kind in ('grass', 'reed') or name.startswith('pad'): image = thin(image)
            longest = 512 if kind in ('tree', 'fern', 'moss', 'lily') else 384
            path = f'{out}/{kind}/{name}.webp'
            fit(image, longest).save(path, 'WEBP', quality=86, method=6)
            total += os.path.getsize(path)
            print(path, Image.open(path).size, os.path.getsize(path))
    print('total', total)


if __name__ == '__main__':
    main(sys.argv[1])
