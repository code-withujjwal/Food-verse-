"""Consistent JSON envelopes: {success, data} or {success, error:{code,message}}."""
from flask import jsonify


def ok(data, **extra):
    return jsonify({"success": True, "data": data, **extra})


def fail(code, message, status, field=None):
    error = {"code": code, "message": message}
    if field:
        error["field"] = field
    return jsonify({"success": False, "error": error}), status
