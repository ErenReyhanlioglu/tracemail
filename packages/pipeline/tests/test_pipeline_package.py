"""Smoke test: the pipeline package is installed in the workspace."""

import importlib


def test_tracemail_pipeline_package_is_importable_with_docstring() -> None:
    module = importlib.import_module("tracemail_pipeline")
    assert module.__doc__
