"""Dependency health check endpoint.

Public, and it checks real dependencies: the marts dataset in BigQuery must
be reachable with the API's credentials. Bucket access joins the check when
the API starts writing to the raw zone (Phase 2 capture); until then its
service account has no bucket role. It never calls an LLM. The response
names only components and states, never an error message.
"""

import logging
from enum import StrEnum
from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from google.api_core.exceptions import GoogleAPIError
from google.auth.exceptions import GoogleAuthError
from pydantic import BaseModel

from tracemail_api.routes.deps import get_marts
from tracemail_api.warehouse import MartsReader

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["health"])


class State(StrEnum):
    """Whether a component is usable."""

    OK = "ok"
    UNAVAILABLE = "unavailable"


class Health(BaseModel):
    """Overall state and the state of each dependency."""

    status: State
    bigquery: State


@router.get(
    "/health", responses={status.HTTP_503_SERVICE_UNAVAILABLE: {"model": Health}}
)
async def health(marts: Annotated[MartsReader, Depends(get_marts)]) -> JSONResponse:
    """200 when every dependency answers, 503 otherwise."""
    try:
        await marts.check()
    except (GoogleAPIError, GoogleAuthError, OSError) as e:
        logger.warning("Health check: BigQuery unavailable (%s)", type(e).__name__)
        down = Health(status=State.UNAVAILABLE, bigquery=State.UNAVAILABLE)
        return JSONResponse(down.model_dump(), status.HTTP_503_SERVICE_UNAVAILABLE)
    up = Health(status=State.OK, bigquery=State.OK)
    return JSONResponse(up.model_dump(), status.HTTP_200_OK)
