from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
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
    # 이미 존재하는지 확인
    existing = await db.execute(select(models.Watchlist).where(models.Watchlist.ticker == ticker))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Already in watchlist")
    
    new_item = models.Watchlist(ticker=ticker)
    db.add(new_item)
    await db.commit()
    await db.refresh(new_item)
    return new_item

@router.delete("/{ticker}")
async def remove_from_watchlist(ticker: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(delete(models.Watchlist).where(models.Watchlist.ticker == ticker))
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Not found in watchlist")
    return {"message": "Removed from watchlist"}
