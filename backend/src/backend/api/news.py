from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List
from ..database import get_db
from .. import models, schemas

router = APIRouter()


@router.get("/stock/{ticker}", response_model=List[schemas.News])
async def get_stock_news(
    ticker: str,
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    stock_result = await db.execute(
        select(models.Stock).where(models.Stock.ticker == ticker)
    )
    stock = stock_result.scalars().first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    result = await db.execute(
        select(models.News)
        .where(models.News.stock_id == stock.id)
        .order_by(desc(models.News.published_at))
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/", response_model=List[schemas.News])
async def get_news(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.News).order_by(models.News.published_at.desc()))
    return result.scalars().all()
