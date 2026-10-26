"""Food Verse AI - Flask backend entry point.

Run from the backend/ folder:  python app.py
Debug mode is OFF unless FLASK_DEBUG=1 is set (never enable it on a shared network).
"""
import logging
import os

from dotenv import load_dotenv
from flask import Flask, request
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix

load_dotenv()

from routes import cooking_routes, food_routes, meal_routes  # noqa: E402
from services.gemini_service import (GeminiConfigError, GeminiServiceError,  # noqa: E402
                                     get_model, get_timeout_seconds, is_configured, sdk_installed)
from utils.rate_limit import RateLimiter  # noqa: E402
from utils.responses import fail, ok  # noqa: E402
from utils.validators import MAX_IMAGE_BYTES, ValidationError  # noqa: E402


def _env_int(name, default):
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def create_app():
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = MAX_IMAGE_BYTES + 1024 * 1024
    logging.basicConfig(level=logging.INFO)

    # Only trust X-Forwarded-For when you run behind that many known proxies.
    proxies = _env_int("TRUSTED_PROXY_COUNT", 0)
    if proxies > 0:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=proxies)

    origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
    CORS(app, resources={r"/api/*": {"origins": origins}})

    for module in (food_routes, cooking_routes, meal_routes):
        app.register_blueprint(module.bp)

    limiter = RateLimiter(_env_int("RATE_LIMIT_PER_MINUTE", 10))

    @app.before_request
    def throttle_ai_requests():
        if request.method == "POST" and request.path.startswith("/api/"):
            allowed, retry_after = limiter.check(request.remote_addr or "unknown")
            if not allowed:
                response, status = fail("rate_limited", f"Too many requests. Wait {retry_after} seconds and try again.", 429)
                response.headers["Retry-After"] = str(retry_after)
                return response, status
        return None

    @app.get("/api/health")
    def health():
        # Reports configuration only. It never calls Gemini, so it is free and fast.
        return ok({
            "status": "ok",
            "gemini_configured": is_configured(),
            "sdk_installed": sdk_installed(),
            "model": get_model(),
            "timeout_seconds": get_timeout_seconds(),
        })

    @app.errorhandler(ValidationError)
    def on_validation(err):
        return fail("validation_error", err.message, 400, err.field)

    @app.errorhandler(GeminiConfigError)
    def on_config(err):
        return fail("ai_not_configured", str(err), 503)

    @app.errorhandler(GeminiServiceError)
    def on_ai_error(err):
        return fail(err.code, err.message, err.status)

    @app.errorhandler(413)
    def on_too_large(_):
        return fail("file_too_large", "The upload is too large. Images must be 8 MB or smaller.", 413)

    @app.errorhandler(Exception)
    def on_unexpected(err):
        if isinstance(err, HTTPException):
            return fail(err.name.lower().replace(" ", "_"), err.description, err.code)
        app.logger.exception("Unhandled error: %s", type(err).__name__)
        return fail("server_error", "Something went wrong on the server. Please try again.", 500)

    return app


app = create_app()

if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(host=os.getenv("HOST", "127.0.0.1"), port=_env_int("PORT", 5000), debug=debug)
