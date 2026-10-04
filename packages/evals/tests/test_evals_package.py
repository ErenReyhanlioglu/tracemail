"""Smoke test: the evals package is installed in the workspace."""

import importlib


def test_tracemail_evals_package_is_importable_with_docstring() -> None:
    module = importlib.import_module("tracemail_evals")
    assert module.__doc__
