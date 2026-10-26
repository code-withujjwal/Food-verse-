"""Image-based endpoints: food scanner, freshness screening, kitchen review."""
from flask import Blueprint, request

from services import prompts
from services.gemini_service import generate_json, get_model
from utils.responses import ok
from utils.validators import read_image

bp = Blueprint("food", __name__)


@bp.post("/api/food/analyze")
def analyze_food():
    image = read_image(request)
    data = generate_json(
        prompts.food_prompt(), image=image,
        required_keys=("is_food", "calories", "protein_g", "carbs_g", "fat_g", "summary"),
    )
    return ok(data, model=get_model())


@bp.post("/api/food/freshness")
def check_freshness():
    image = read_image(request)
    data = generate_json(
        prompts.freshness_prompt(), image=image,
        required_keys=("condition", "observations", "condition_summary"),
    )
    return ok(data, model=get_model())


@bp.post("/api/kitchen/analyze")
def analyze_kitchen():
    image = read_image(request)
    data = generate_json(
        prompts.kitchen_prompt(), image=image,
        required_keys=("is_kitchen", "observed_evidence", "summary", "checklist"),
    )
    return ok(data, model=get_model())
