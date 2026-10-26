"""Recipe generation endpoint."""
from flask import Blueprint, request

from services import prompts
from services.gemini_service import GeminiServiceError, generate_json, get_model
from utils.responses import ok
from utils.validators import (DIETS, DIFFICULTIES, clean_choice, clean_int,
                              clean_string_list, clean_text, get_json)

bp = Blueprint("cooking", __name__)


@bp.post("/api/cooking/recipes")
def generate_recipes():
    body = get_json(request)
    ai_request = {
        "available_ingredients": clean_text(body, "ingredients", "Ingredients", 800, required=True),
        "preferred_cuisine": clean_text(body, "cuisine", "Cuisine", 60) or "any",
        "dietary_preference": clean_choice(body, "diet", "Dietary preference", DIETS, "No preference"),
        "max_prep_time_minutes": clean_int(body, "max_time", "Maximum time", 5, 240, 30),
        "difficulty": clean_choice(body, "difficulty", "Difficulty", DIFFICULTIES, "Easy"),
        "do_not_repeat_recipes": clean_string_list(body, "exclude", "Excluded recipes", 12, 100),
    }
    data = generate_json(prompts.recipes_prompt(ai_request), required_keys=("recipes",), temperature=0.8)
    if not isinstance(data["recipes"], list) or not data["recipes"]:
        raise GeminiServiceError("Gemini did not return any recipes. Try again.", 502, "bad_response")
    return ok(data, model=get_model())
