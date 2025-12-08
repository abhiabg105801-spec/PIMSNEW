from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool

# ✅ 1. SQLite Database URL
DATABASE_URL = "sqlite+aiosqlite:///./pims1.db"

# ✅ 2. Async Engine
engine = create_async_engine(
    DATABASE_URL,
    echo=True,
    poolclass=NullPool,
    connect_args={"check_same_thread": False}
)

# ============================================================
# 🔥 MAIN SESSION MAKERS
# ============================================================

# Used by FastAPI endpoints (already used in your project)
AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# NEW session maker — used for scheduler / background jobs
async_session_maker = AsyncSessionLocal

# ============================================================
# Base class
# ============================================================

Base = declarative_base()

# ============================================================
# FastAPI dependency
# ============================================================

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session

# ============================================================
# Create tables (optional)
# ============================================================

async def create_tables():
    async with engine.begin() as conn:
        # await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
