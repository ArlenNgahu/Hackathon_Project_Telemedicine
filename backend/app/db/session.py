"""
Async SQLAlchemy engine + session management.

This is the single source of truth for how the API talks to Postgres.
Everything else (security.py, main.py, service layers) should depend on
`get_db` rather than constructing its own engine/session.
"""

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from backend.app.core.config import settings

# A single, process-wide async engine. SQLAlchemy pools connections for us,
# so this should be created once and reused rather than per-request.
engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DATABASE_ECHO,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_pre_ping=True,  # avoids handing out dead connections after DB restarts
)

# `expire_on_commit=False` so objects returned from a request handler can
# still be serialized by FastAPI/Pydantic after the session closes.
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that yields a request-scoped AsyncSession and
    guarantees it is closed (and rolled back on error) afterwards.

    Usage:
        @app.get("/something")
        async def handler(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
