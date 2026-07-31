from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.dialects.postgresql import insert
from typing import List
from ..database import get_db
from .. import models, schemas

router = APIRouter()

@router.get("/", response_model=List[schemas.Watchlist])
async def get_watchlist(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Watchlist))
    return result.scalars().all()

@router.post("/{ticker}", response_model=schemas.Watchlist)
async def add_to_watchlist(ticker: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        insert(models.Watchlist)
        .values(ticker=ticker)
        .on_conflict_do_nothing(index_elements=["ticker"])
        .returning(models.Watchlist)
    )
    result = await db.execute(stmt)
    item = result.scalars().first()
    if item is None:
        result = await db.execute(
            select(models.Watchlist).where(models.Watchlist.ticker == ticker)
        )
        item = result.scalars().one()
    await db.commit()
    return item

@router.delete("/{ticker}")
async def remove_from_watchlist(ticker: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(delete(models.Watchlist).where(models.Watchlist.ticker == ticker))
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Not found in watchlist")
    return {"message": "Removed from watchlist"}
