"""Smoke test: the llm package is installed in the workspace."""

import importlib


def test_tracemail_llm_package_is_importable_with_docstring() -> None:
    module = importlib.import_module("tracemail_llm")
    assert module.__doc__
