"""BigQuery schemas generated from the Pydantic record models (ADR-0019).

The record model is the single source of truth: a field added to a model
becomes a column, with no hand-written schema file to keep in sync. A
``schema_version`` fingerprint of the generated schema is stored with every
run record, so a structural change is visible in the data (ADR-0020).
"""

import hashlib
import json
import types
from datetime import date, datetime
from enum import Enum
from typing import Any, Union, get_args, get_origin

from google.cloud import bigquery
from pydantic import BaseModel
from pydantic.fields import FieldInfo

SCALAR_TYPES: dict[type, str] = {
    str: "STRING",
    int: "INT64",
    float: "FLOAT64",
    bool: "BOOL",
    date: "DATE",
    datetime: "TIMESTAMP",
}
JSON_TYPE = "JSON"
NULLABLE, REPEATED = "NULLABLE", "REPEATED"
SCHEMA_VERSION_LENGTH = 12


class UnsupportedFieldTypeError(TypeError):
    """A model field has a type with no BigQuery mapping defined here."""


def schema_for(model: type[BaseModel]) -> list[bigquery.SchemaField]:
    """Return the BigQuery schema for a record model, in field order."""
    return [_field(name, info) for name, info in model.model_fields.items()]


def schema_version(model: type[BaseModel]) -> str:
    """Return a short fingerprint of the model's generated schema."""
    described = [field.to_api_repr() for field in schema_for(model)]
    encoded = json.dumps(described, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()[:SCHEMA_VERSION_LENGTH]


def _field(name: str, info: FieldInfo) -> bigquery.SchemaField:
    """Map one field. Scalars are always NULLABLE in BigQuery: required-ness is
    enforced by Pydantic when records are written and by dbt tests when they
    are read, which keeps every future column addition possible."""
    annotation, _ = _unwrap_optional(info.annotation)
    if get_origin(annotation) is list:
        (item,) = get_args(annotation)
        return bigquery.SchemaField(name, _scalar(item), mode=REPEATED)
    return bigquery.SchemaField(name, _scalar(annotation), mode=NULLABLE)


def _unwrap_optional(annotation: Any) -> tuple[Any, bool]:
    if get_origin(annotation) in (Union, types.UnionType):
        members = [arg for arg in get_args(annotation) if arg is not type(None)]
        if len(members) == 1:
            return members[0], True
    return annotation, False


def _scalar(annotation: Any) -> str:
    if get_origin(annotation) is dict:
        return JSON_TYPE
    if isinstance(annotation, type) and issubclass(annotation, Enum):
        return SCALAR_TYPES[str]
    for python_type, bigquery_type in SCALAR_TYPES.items():
        if annotation is python_type:
            return bigquery_type
    raise UnsupportedFieldTypeError(f"No BigQuery type for {annotation!r}")
