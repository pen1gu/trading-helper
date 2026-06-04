from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List
from ..database import get_db
from .. import models, schemas

router = APIRouter()

@router.get("/", response_model=List[schemas.Stock])
async def get_stocks(db: AsyncSession = Depends(get_db)):
    # 모든 주식 데이터 반환 (관심종목 렌더링 용도)
    result = await db.execute(select(models.Stock))
    return result.scalars().all()

@router.get("/scan", response_model=List[schemas.Stock])
async def scan_stocks(db: AsyncSession = Depends(get_db)):
    # 등락률 내림차순 정렬하여 반환 (Discover 페이지 용도)
    result = await db.execute(
        select(models.Stock)
        .where(models.Stock.ai_recommendation.in_(['Long', 'Short']))
        .order_by(desc(models.Stock.change_rate))
    )
    return result.scalars().all()

@router.get("/{ticker}", response_model=schemas.Stock)
async def get_stock(ticker: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Stock).where(models.Stock.ticker == ticker))
    stock = result.scalars().first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    return stock
