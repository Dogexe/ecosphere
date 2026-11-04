"""Turn cut-out plant pieces into game textures in public/assets/paper/plants/.

    python3 scripts/paper-plants/prepare.py <cut_dir>

Expects the pieces cut by cut_sheet.py from the owner's picks (2026-11-04):
grass option 1 (paper border cut away), moss option 3, fallen-leaf option 2 (oak). The moss cushion
is split from its spore stalks (the stalks become their own cards), found by
opening its top outline so narrow peaks drop off.
"""
import os
import sys
import numpy as np
from PIL import Image

out = 'public/assets/paper/plants'


def fit(image, longest=512):
    scale = longest / max(image.size)
    return image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.LANCZOS) if scale < 1 else image


def split_moss(image):
    solid = np.array(image.getchannel('A')) > 128
    h, w = solid.shape
    raw = np.array([np.nonzero(solid[:, x])[0][0] if solid[:, x].any() else h for x in range(w)])
    # Morphological opening of the top line: narrow peaks (stalks) are cut, the wide dome stays.
    k = max(8, w // 14)
    lowest = np.array([raw[max(0, x - k):x + k + 1].max() for x in range(w)])
    top = np.array([lowest[max(0, x - k):x + k + 1].min() for x in range(w)])
    rows = np.arange(solid.shape[0])[:, None]
    body = rows >= top[None, :]
    cushion = np.array(image); stalks = np.array(image)
    cushion[..., 3] = np.where(body, cushion[..., 3], 0)
    stalks[..., 3] = np.where(body, 0, stalks[..., 3])
    c = Image.fromarray(cushion); s = Image.fromarray(stalks)
    return c.crop(c.getbbox()), s.crop(s.getbbox())


def main(cut):
    os.makedirs(out, exist_ok=True)
    # Thin blades: the pale paper border between them reads as noise in 3D, so it is cut away.
    grass = np.array(Image.open(f'{cut}/grass-2.png').convert('RGBA'))
    rgb = grass[..., :3].astype(int)
    pale = (rgb.min(axis=2) > 196) & (rgb.max(axis=2) - rgb.min(axis=2) < 40)
    grass[..., 3] = np.where(pale, 0, grass[..., 3])
    fit(Image.fromarray(grass)).save(f'{out}/grass-tuft.png')
    cushion, stalks = split_moss(Image.open(f'{cut}/moss-3.png').convert('RGBA'))
    fit(cushion).save(f'{out}/moss-cushion.png')
    fit(stalks, 256).save(f'{out}/moss-stalks.png')
    for index, name in enumerate(['fallen-leaf-2', 'fallen-leaf-5', 'fallen-leaf-8'], 1):
        fit(Image.open(f'{cut}/{name}.png'), 256).save(f'{out}/oak-leaf-{index}.png')
    for name in sorted(os.listdir(out)): print(name, Image.open(f'{out}/{name}').size, os.path.getsize(f'{out}/{name}'))


if __name__ == '__main__':
    main(sys.argv[1])
