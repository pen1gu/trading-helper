from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from ..database import get_db
from .. import models, schemas

router = APIRouter()

@router.get("/", response_model=List[schemas.News])
async def get_news(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.News).order_by(models.News.published_at.desc()))
    return result.scalars().all()
