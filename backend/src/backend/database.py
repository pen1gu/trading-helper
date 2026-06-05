import os
from urllib.parse import urlparse, urlunparse

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from .win_asyncio import apply_windows_asyncio_compat

apply_windows_asyncio_compat()
load_dotenv()


def _normalize_database_url(url: str) -> str:
    """localhost → 127.0.0.1 (Windows IPv6/asyncpg 이슈 완화)."""
    parsed = urlparse(url.replace("postgresql+asyncpg://", "postgresql://", 1))
    host = parsed.hostname or ""
    if host == "localhost":
        netloc = parsed.netloc.replace("localhost", "127.0.0.1", 1)
        parsed = parsed._replace(netloc=netloc)
        url = urlunparse(parsed).replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


# PostgreSQL URL: postgresql+asyncpg://user:password@host:port/dbname
DATABASE_URL = _normalize_database_url(
    os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/stockinsight",
    )
)

engine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("SQL_ECHO", "").lower() in ("1", "true", "yes"),
    connect_args={"ssl": False},
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
