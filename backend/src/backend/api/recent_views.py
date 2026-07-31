from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, desc, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models, schemas
from ..database import get_db

router = APIRouter()

MAX_RECENT_VIEWS = 20


async def _trim_recent_views(db: AsyncSession) -> None:
    result = await db.execute(
        select(models.RecentView.id)
        .order_by(desc(models.RecentView.viewed_at))
        .offset(MAX_RECENT_VIEWS)
    )
    stale_ids = [row[0] for row in result.all()]
    if stale_ids:
        await db.execute(delete(models.RecentView).where(models.RecentView.id.in_(stale_ids)))


@router.get("/", response_model=List[schemas.Stock])
async def get_recent_views(
    limit: Optional[int] = Query(None, ge=1, le=MAX_RECENT_VIEWS),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(models.Stock)
        .join(models.RecentView, models.Stock.ticker == models.RecentView.ticker)
        .order_by(desc(models.RecentView.viewed_at))
    )
    if limit is not None:
        query = query.limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/{ticker}", response_model=schemas.RecentView)
async def record_recent_view(ticker: str, db: AsyncSession = Depends(get_db)):
    stock_result = await db.execute(
        select(models.Stock).where(models.Stock.ticker == ticker)
    )
    if stock_result.scalars().first() is None:
        raise HTTPException(status_code=404, detail="Stock not found")

    now = datetime.now(timezone.utc)
    stmt = (
        insert(models.RecentView)
        .values(ticker=ticker, viewed_at=now)
        .on_conflict_do_update(
            index_elements=["ticker"],
            set_={"viewed_at": now},
        )
        .returning(models.RecentView)
    )
    result = await db.execute(stmt)
    item = result.scalars().one()
    await _trim_recent_views(db)
    await db.commit()
    return item
