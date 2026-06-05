import logging
import os
import sys
import time
from typing import Callable

from fastapi import Request, Response

api_logger = logging.getLogger("stockinsight.api")
task_logger = logging.getLogger("stockinsight.task")


def configure_logging() -> None:
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    root = logging.getLogger()
    if not root.handlers:
        logging.basicConfig(
            level=level,
            format="%(asctime)s %(levelname)s %(name)s: %(message)s",
            stream=sys.stdout,
        )
    else:
        root.setLevel(level)

    for name in ("stockinsight.api", "stockinsight.task"):
        logging.getLogger(name).setLevel(level)

    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def request_logging_middleware() -> Callable:
    async def middleware(request: Request, call_next) -> Response:
        if request.url.path in ("/", "/docs", "/openapi.json", "/redoc"):
            return await call_next(request)

        started = time.perf_counter()
        method = request.method
        path = request.url.path
        api_logger.info("%s %s started", method, path)

        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = (time.perf_counter() - started) * 1000
            api_logger.exception(
                "%s %s failed (%.0fms)", method, path, elapsed_ms
            )
            raise

        elapsed_ms = (time.perf_counter() - started) * 1000
        level = logging.WARNING if response.status_code >= 400 else logging.INFO
        api_logger.log(
            level,
            "%s %s -> %s (%.0fms)",
            method,
            path,
            response.status_code,
            elapsed_ms,
        )
        return response

    return middleware
