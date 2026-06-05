import asyncio
import time

from .win_asyncio import apply_windows_asyncio_compat

apply_windows_asyncio_compat()

from .celery_app import celery_app
from .logging_config import configure_logging, task_logger
from .services.report_pipeline import ReportPipeline
from .database import AsyncSessionLocal

configure_logging()


@celery_app.task(name="collect_stock_data_task")
def collect_stock_data_task():
    started = time.perf_counter()
    task_logger.info("celery.collect_stock_data_task started")
    try:
        outcome = asyncio.run(_run_report_pipeline())
        task_logger.info(
            "celery.collect_stock_data_task finished (%.1fs): %s",
            time.perf_counter() - started,
            outcome,
        )
        return outcome
    except Exception:
        task_logger.exception(
            "celery.collect_stock_data_task failed (%.1fs)",
            time.perf_counter() - started,
        )
        raise


async def _run_report_pipeline():
    pipeline = ReportPipeline()
    if not pipeline.gemini_configured:
        task_logger.warning("celery.pipeline skipped: Gemini API key not configured")
        return "Gemini API key not configured — skipping pipeline"

    async with AsyncSessionLocal() as db:
        result = await pipeline.run(db)
        if result.get("error"):
            task_logger.error("celery.pipeline error: %s", result["error"])
            return f"Pipeline error: {result['error']}"
    return "Full collection, news analysis, and AI scoring completed."
