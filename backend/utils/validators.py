"""Request validation helpers. Every failure raises ValidationError (HTTP 400)."""

import re

MAX_IMAGE_BYTES = 8 * 1024 * 1024  # 8 MB
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}

DIETS = ["No preference", "Vegetarian", "Vegan", "Eggetarian", "Pescatarian", "Gluten-free", "Dairy-free", "Low-carb", "High-protein"]
DIFFICULTIES = ["Easy", "Medium", "Hard"]
FOOD_PREFERENCES = ["Vegetarian", "Non-vegetarian"]


class ValidationError(Exception):
    def __init__(self, message, field=None):
        super().__init__(message)
        self.message = message
        self.field = field


def _detect_image_type(data):
    """Identify the image from its first bytes instead of trusting the filename."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def _looks_complete(data, mime):
    """Cheap structural check that catches truncated or corrupted uploads."""
    if mime == "image/png":
        return b"IEND" in data[-16:]
    if mime == "image/jpeg":
        return b"\xff\xd9" in data[-4096:]
    if mime == "image/webp":
        return int.from_bytes(data[4:8], "little") + 8 <= len(data)
    return False


def read_image(request, field="image"):
    """Return (bytes, mime_type) for an uploaded image, or raise ValidationError."""
    file = request.files.get(field)
    if file is None or not file.filename:
        raise ValidationError("Please upload an image to analyze.", field)
    extension = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if extension not in ALLOWED_EXTENSIONS:
        raise ValidationError("Unsupported file type. Upload a JPG, PNG, or WebP image.", field)
    data = file.read(MAX_IMAGE_BYTES + 1)
    if not data:
        raise ValidationError("The uploaded file is empty.", field)
    if len(data) > MAX_IMAGE_BYTES:
        raise ValidationError("The image is larger than 8 MB. Upload a smaller file.", field)
    mime = _detect_image_type(data)
    if mime is None:
        raise ValidationError("The file is not a valid JPG, PNG, or WebP image.", field)
    if not _looks_complete(data, mime):
        raise ValidationError("The image appears to be corrupted or incomplete. Try a different file.", field)
    return data, mime


def get_json(request):
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ValidationError("Send a JSON object in the request body.")
    return body


def clean_text(body, field, label, max_len=500, required=False):
    value = body.get(field, "")
    if value is None:
        value = ""
    if not isinstance(value, str):
        raise ValidationError(f"{label} must be text.", field)
    value = value.strip()
    if required and not value:
        raise ValidationError(f"{label} is required.", field)
    if len(value) > max_len:
        raise ValidationError(f"{label} must be {max_len} characters or fewer.", field)
    return value


def clean_choice(body, field, label, options, default=None):
    value = body.get(field, default)
    if value not in options:
        raise ValidationError(f"{label} must be one of: {', '.join(options)}.", field)
    return value


def clean_int(body, field, label, minimum, maximum, default=None):
    """Accept only whole numbers. Decimals are rejected, never silently truncated."""
    value = body.get(field, default)
    if isinstance(value, bool) or value is None:
        raise ValidationError(f"{label} must be a whole number.", field)
    if isinstance(value, float):
        if not value.is_integer():
            raise ValidationError(f"{label} must be a whole number, without decimals.", field)
        value = int(value)
    elif isinstance(value, str):
        text = value.strip()
        if not re.fullmatch(r"[+-]?\d+", text):
            raise ValidationError(f"{label} must be a whole number.", field)
        value = int(text)
    elif not isinstance(value, int):
        raise ValidationError(f"{label} must be a whole number.", field)
    number = value
    if not minimum <= number <= maximum:
        raise ValidationError(f"{label} must be between {minimum} and {maximum}.", field)
    return number


def clean_string_list(body, field, label, max_items=20, max_len=80):
    value = body.get(field, [])
    if not isinstance(value, list):
        raise ValidationError(f"{label} must be a list.", field)
    cleaned = []
    for item in value[:max_items]:
        if not isinstance(item, str):
            raise ValidationError(f"{label} must contain only text.", field)
        item = item.strip()[:max_len]
        if item:
            cleaned.append(item)
    return cleaned
