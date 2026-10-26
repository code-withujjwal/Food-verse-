"""Meal plan endpoint. Daily totals are computed here, not trusted from the model."""
from flask import Blueprint, request

from services import prompts
from services.gemini_service import GeminiServiceError, generate_json, get_model
from utils.responses import ok
from utils.validators import (DIETS, FOOD_PREFERENCES, ValidationError, clean_choice,
                              clean_int, clean_string_list, clean_text, get_json)

bp = Blueprint("meals", __name__)

# Food preference -> diet styles it contradicts.
CONFLICTS = {
    "Vegetarian": {"Pescatarian"},
    "Non-vegetarian": {"Vegan", "Vegetarian", "Eggetarian"},
}


def _number(value):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) else 0


def _check_constraints(request_data):
    """Reject contradictory inputs before spending an AI call."""
    pref, diet = request_data["food_preference"], request_data["dietary_preference"]
    if diet in CONFLICTS.get(pref, set()):
        raise ValidationError(f'"{pref}" and "{diet}" contradict each other. Choose compatible options.', "diet")
    liked = request_data["preferred_foods"].lower()
    for allergen in request_data["allergies"]:
        if allergen.lower() in liked:
            raise ValidationError(f'"{allergen}" is listed as both an allergy and a food you enjoy. Remove one.', "likes")


def _allergen_flags(meals, allergies):
    """Flag meals whose text mentions a listed allergen so the user checks them."""
    flags = []
    for meal in meals:
        text = " ".join(
            str(meal.get(k, "")) for k in ("name", "portion")
        ) + " " + " ".join(s for s in meal.get("substitutions", []) if isinstance(s, str))
        for allergen in allergies:
            if allergen.lower() in text.lower():
                flags.append({"allergen": allergen, "meal": str(meal.get("name", "Unnamed meal"))})
    return flags


@bp.post("/api/meals/plan")
def plan_meals():
    body = get_json(request)
    ai_request = {
        "dietary_preference": clean_choice(body, "diet", "Dietary preference", DIETS, "No preference"),
        "food_preference": clean_choice(body, "food_preference", "Food preference", FOOD_PREFERENCES),
        "preferred_foods": clean_text(body, "likes", "Preferred foods", 300),
        "avoided_foods": clean_text(body, "dislikes", "Avoided foods", 300),
        "allergies": clean_string_list(body, "allergies", "Allergies", 15, 60),
        "calorie_target": clean_int(body, "calorie_target", "Calorie target", 1000, 5000),
        "meals_per_day": clean_int(body, "meals_per_day", "Meals per day", 2, 6, 4),
    }
    _check_constraints(ai_request)
    data = generate_json(prompts.meal_plan_prompt(ai_request), required_keys=("meals",), temperature=0.7)
    meals = [m for m in data["meals"] if isinstance(m, dict)] if isinstance(data["meals"], list) else []
    if not meals:
        raise GeminiServiceError("Gemini did not return a meal plan. Try again.", 502, "bad_response")
    data["meals"] = meals
    data["totals"] = {
        "calories": round(sum(_number(m.get("calories")) for m in meals)),
        "protein_g": round(sum(_number(m.get("protein_g")) for m in meals)),
        "carbs_g": round(sum(_number(m.get("carbs_g")) for m in meals)),
        "fat_g": round(sum(_number(m.get("fat_g")) for m in meals)),
    }
    data["calorie_target"] = ai_request["calorie_target"]
    data["allergies"] = ai_request["allergies"]
    data["allergen_flags"] = _allergen_flags(meals, ai_request["allergies"])
    return ok(data, model=get_model())
