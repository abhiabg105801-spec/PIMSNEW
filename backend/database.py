# backend/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool

# ✅ 1. Define the SQLite database URL
# This will create a file named "pims.db" in your backend directory.
DATABASE_URL = "sqlite+aiosqlite:///./pims1.db"

# ✅ 2. Create the async engine for SQLite
# connect_args={"check_same_thread": False} is needed for SQLite to be accessed by FastAPI's threads.
engine = create_async_engine(
    DATABASE_URL, 
    echo=True, # echo=True logs SQL
    poolclass=NullPool,
    connect_args={"check_same_thread": False} 
)

# Create a configured "Session" class
AsyncSessionLocal = sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)

# Base class for our models to inherit from
Base = declarative_base()

# Dependency to get DB session in path operations
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session

# Function to create tables (optional, call once at startup or use Alembic)
async def create_tables():
     async with engine.begin() as conn:
         # await conn.run_sync(Base.metadata.drop_all) # Use drop_all cautiously
         await conn.run_sync(Base.metadata.create_all)