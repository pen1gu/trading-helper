"""Windows에서 asyncpg/SQLAlchemy async 연결 안정화."""

import asyncio
import sys


def apply_windows_asyncio_compat() -> None:
    if sys.platform != "win32":
        return
    # Python 3.14 기본 Proactor 루프는 asyncpg와 충돌해 연결이 끊깁니다.
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
