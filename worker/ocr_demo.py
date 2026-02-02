#!/usr/bin/env python3
import sys
import json
import fitz          # PyMuPDF
import pytesseract
import pillow_heif
from PIL import Image, ImageFile, ImageOps, ImageFilter
import io

# Prevent truncated-image crashes in Pillow
ImageFile.LOAD_TRUNCATED_IMAGES = True
pillow_heif.register_heif_opener()


TESSERACT_LANG = "eng"
TESSERACT_PSMS = [6, 11]  # 6=single uniform block, 11=sparse text
TESSERACT_OEM = 3


def _preprocess_image(img: Image.Image) -> Image.Image:
    # Normalize orientation, boost contrast, and improve OCR readability.
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass

    img = img.convert("L")
    img = ImageOps.autocontrast(img)
    img = img.filter(ImageFilter.MedianFilter(size=3))

    # Scale up small images for better OCR, cap large images to avoid huge memory use.
    max_side = max(img.size)
    if max_side < 1600:
        scale = 1600 / max_side
        img = img.resize((int(img.size[0] * scale), int(img.size[1] * scale)), Image.BICUBIC)
    elif max_side > 4000:
        scale = 4000 / max_side
        img = img.resize((int(img.size[0] * scale), int(img.size[1] * scale)), Image.BICUBIC)

    img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=150, threshold=3))
    return img


def _ocr_image(img: Image.Image) -> str:
    img = _preprocess_image(img)
    best_text = ""
    best_score = -1
    for psm in TESSERACT_PSMS:
        cfg = f"--oem {TESSERACT_OEM} --psm {psm} -l {TESSERACT_LANG}"
        text = pytesseract.image_to_string(img, config=cfg) or ""
        score = sum(ch.isalnum() for ch in text)
        if score > best_score:
            best_score = score
            best_text = text
    return best_text or ""


def _render_page_to_image(page) -> Image.Image:
    # Render PDF page to raster image for OCR fallback.
    pix = page.get_pixmap(dpi=300)
    mode = "RGB" if pix.alpha == 0 else "RGBA"
    return Image.frombytes(mode, [pix.width, pix.height], pix.samples)


def process_pdf(buffer: bytes) -> str:
    try:
        pdf = fitz.open(stream=buffer, filetype="pdf")
        text = ""
        for page in pdf:
            text += page.get_text() or ""
        if text.strip():
            return text

        # Fallback: render pages and OCR if no embedded text exists.
        for page in pdf:
            img = _render_page_to_image(page)
            text += _ocr_image(img)
        return text
    except Exception as e:
        # Output to stderr so Node can capture useful debugging info
        print(f"PDF processing error: {e}", file=sys.stderr)
        return ""


def process_image(buffer: bytes) -> str:
    try:
        img = Image.open(io.BytesIO(buffer))
        return _ocr_image(img)
    except Exception as e:
        print(f"Image processing error: {e}", file=sys.stderr)
        return ""


def main():
    # Read raw bytes from stdin (sent by Node)
    try:
        buffer = sys.stdin.buffer.read()
    except Exception as e:
        print(f"Failed reading stdin: {e}", file=sys.stderr)
        print(json.dumps({"text": ""}))
        return

    if not buffer:
        print(json.dumps({"text": ""}))
        return

    # Detect PDFs safely
    is_pdf = buffer.startswith(b"%PDF") or buffer[:4] == b"\x25\x50\x44\x46"

    error = ""
    try:
        if is_pdf:
            text = process_pdf(buffer)
        else:
            text = process_image(buffer)
    except Exception as e:
        error = str(e)
        text = ""

    # Always output valid JSON
    try:
        print(json.dumps({"text": text, "error": error}))
    except Exception as e:
        print(f"JSON output error: {e}", file=sys.stderr)
        print('{"text": "", "error": "json_output_error"}')


if __name__ == "__main__":
    main()
