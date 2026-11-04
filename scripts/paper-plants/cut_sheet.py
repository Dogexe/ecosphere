"""Cut a GPT sheet (pieces painted on white) into separate transparent PNGs.

The white background is whatever near-white region touches the sheet's edge,
so the pale paper border around each piece stays. Pieces are the large
connected shapes left over (number labels are too small and are dropped),
saved left to right, top to bottom as <out>/<prefix>-<n>.png.

    python3 scripts/paper-plants/cut_sheet.py sheet.png out_dir prefix [min_area_fraction]
"""
import sys
from collections import deque
import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def background(rgb):
    lo = rgb.min(axis=2).astype(int)
    spread = rgb.max(axis=2).astype(int) - lo
    white = ((lo > 236) & (spread < 14)).astype(np.uint8) * 255
    mask = Image.fromarray(white).copy()  # fromarray can share a read-only buffer
    h, w = white.shape
    # Flood from every edge pixel that is white, marking it 128.
    for x in range(0, w, 7):
        for y in (0, h - 1):
            if mask.getpixel((x, y)) == 255: ImageDraw.floodfill(mask, (x, y), 128)
    for y in range(0, h, 7):
        for x in (0, w - 1):
            if mask.getpixel((x, y)) == 255: ImageDraw.floodfill(mask, (x, y), 128)
    return np.array(mask) == 128


def components(solid, scale=4):
    small = solid[::scale, ::scale]
    h, w = small.shape
    label = np.zeros((h, w), int)
    boxes = []
    for y in range(h):
        for x in range(w):
            if not small[y, x] or label[y, x]: continue
            n = len(boxes) + 1
            queue = deque([(y, x)]); label[y, x] = n
            x0 = x1 = x; y0 = y1 = y; area = 0
            while queue:
                cy, cx = queue.popleft(); area += 1
                x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and small[ny, nx] and not label[ny, nx]:
                        label[ny, nx] = n; queue.append((ny, nx))
            boxes.append((area * scale * scale, x0 * scale, y0 * scale, (x1 + 1) * scale, (y1 + 1) * scale, n))
    return label, boxes, scale


def main(sheet, out, prefix, min_fraction=0.004):
    image = Image.open(sheet).convert('RGB')
    rgb = np.array(image)
    bg = background(rgb)
    alpha = Image.fromarray(((~bg) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    label, boxes, scale = components(~bg)
    total = rgb.shape[0] * rgb.shape[1]
    pieces = [b for b in boxes if b[0] > total * float(min_fraction)]
    pieces.sort(key=lambda b: (round(b[2] / (rgb.shape[0] / 3)), b[1]))
    rgba = image.copy(); rgba.putalpha(alpha)
    big = np.kron(label, np.ones((scale, scale), int))[:rgb.shape[0], :rgb.shape[1]]
    for index, (area, x0, y0, x1, y1, n) in enumerate(pieces, 1):
        pad = 6
        box = (max(0, x0 - pad), max(0, y0 - pad), min(rgb.shape[1], x1 + pad), min(rgb.shape[0], y1 + pad))
        piece = rgba.crop(box)
        # Keep only this component (neighbours can poke into the box).
        own = Image.fromarray(((big[box[1]:box[3], box[0]:box[2]] == n) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))
        a = np.minimum(np.array(piece.getchannel('A')), np.array(own))
        piece.putalpha(Image.fromarray(a))
        path = f'{out}/{prefix}-{index}.png'
        piece.save(path)
        print(path, box, area)


if __name__ == '__main__':
    main(*sys.argv[1:])
