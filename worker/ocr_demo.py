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


TESSERACT_CONFIG = "--oem 3 --psm 6 -l eng"


def _preprocess_image(img: Image.Image) -> Image.Image:
    # Normalize orientation, boost contrast, and improve OCR readability.
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass

    img = img.convert("L")
    img = ImageOps.autocontrast(img)

    # Scale up small images for better OCR, cap large images to avoid huge memory use.
    max_side = max(img.size)
    if max_side < 1000:
        scale = 1000 / max_side
        img = img.resize((int(img.size[0] * scale), int(img.size[1] * scale)), Image.BICUBIC)
    elif max_side > 3000:
        scale = 3000 / max_side
        img = img.resize((int(img.size[0] * scale), int(img.size[1] * scale)), Image.BICUBIC)

    img = img.filter(ImageFilter.SHARPEN)
    return img


def _ocr_image(img: Image.Image) -> str:
    img = _preprocess_image(img)
    text = pytesseract.image_to_string(img, config=TESSERACT_CONFIG)
    return text or ""


def _render_page_to_image(page) -> Image.Image:
    # Render PDF page to raster image for OCR fallback.
    pix = page.get_pixmap(dpi=200)
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
