"""Privacy rule: public endpoints never expose private-domain fields.

Every operation in the OpenAPI document is called without a session; one that
does not answer 401 is public. Public operations must be listed below (adding
one is a deliberate, reviewed change), and none of their response schemas may
contain a field from the private domain (CLAUDE.md, Privacy and Access
Separation). Only FastAPI's public interfaces are used: the OpenAPI document
and real requests.
"""

from collections.abc import Iterator
from typing import Any

import pytest
from api_fakes import api_client
from fastapi.testclient import TestClient

PUBLIC_OPERATIONS = {
    ("get", "/api/v1/health"),
    ("get", "/api/v1/auth/google/login"),
    ("get", "/api/v1/auth/google/callback"),
    ("post", "/api/v1/auth/logout"),
}
PRIVATE_FIELDS = {
    "company",
    "company_name",
    "title",
    "role",
    "location",
    "sender",
    "posting_text",
    "posting_url",
    "evidence",
    "error_message",
}
SCHEMA_PREFIX = "#/components/schemas/"


@pytest.fixture(scope="module")
def visitor() -> Iterator[TestClient]:
    with api_client() as client:
        yield client


def operations(document: dict[str, Any]) -> Iterator[tuple[str, str, dict[str, Any]]]:
    for path, item in document["paths"].items():
        for method, operation in item.items():
            yield method, path, operation


def public_operations(
    client: TestClient, document: dict[str, Any]
) -> list[tuple[str, str, dict[str, Any]]]:
    return [
        (method, path, operation)
        for method, path, operation in operations(document)
        if client.request(method, path).status_code != 401
    ]


def field_names(node: Any, schemas: dict[str, Any], seen: set[str]) -> set[str]:
    """Every property name reachable from a schema node, following $refs."""
    if isinstance(node, list):
        return set().union(*(field_names(item, schemas, seen) for item in node))
    if not isinstance(node, dict):
        return set()
    names = set(node.get("properties", {}))
    ref = node.get("$ref", "")
    if ref.startswith(SCHEMA_PREFIX) and ref not in seen:
        seen.add(ref)
        names |= field_names(schemas[ref.removeprefix(SCHEMA_PREFIX)], schemas, seen)
    for value in node.values():
        names |= field_names(value, schemas, seen)
    return names


def response_fields(operation: dict[str, Any], schemas: dict[str, Any]) -> set[str]:
    return field_names(operation.get("responses", {}), schemas, set())


def test_every_public_operation_is_on_the_reviewed_list(visitor: TestClient) -> None:
    document = visitor.app.openapi()  # type: ignore[attr-defined]
    found = {(m, p) for m, p, _ in public_operations(visitor, document)}
    assert found == PUBLIC_OPERATIONS


def test_public_response_schemas_contain_no_private_field(visitor: TestClient) -> None:
    document = visitor.app.openapi()  # type: ignore[attr-defined]
    schemas = document["components"]["schemas"]
    for method, path, operation in public_operations(visitor, document):
        leaked = response_fields(operation, schemas) & PRIVATE_FIELDS
        assert not leaked, f"{method.upper()} {path} exposes {sorted(leaked)}"


def test_the_check_sees_private_fields_in_the_application_list(
    visitor: TestClient,
) -> None:
    document = visitor.app.openapi()  # type: ignore[attr-defined]
    operation = document["paths"]["/api/v1/applications"]["get"]
    assert visitor.get("/api/v1/applications").status_code == 401
    fields = response_fields(operation, document["components"]["schemas"])
    assert {"company", "title", "location"} <= fields
