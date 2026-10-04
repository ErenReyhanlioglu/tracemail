"""Smoke test: the api package is installed in the workspace."""

import importlib


def test_tracemail_api_package_is_importable_with_docstring() -> None:
    module = importlib.import_module("tracemail_api")
    assert module.__doc__
