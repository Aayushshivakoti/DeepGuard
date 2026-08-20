if __name__ == "__main__":
    import sys
    sys.path.append("c:\\Users\\Acer\\Documents\\3rd\\3rd project\\DeepfakeandPhishingMediaVerificationsystem\\backend")
    import os
    os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///c:\\Users\\Acer\\Documents\\3rd\\3rd project\\DeepfakeandPhishingMediaVerificationsystem\\deepguard_db.sqlite"
    
    import asyncio
    from sqlalchemy import text
    from app.db.session import engine
    from app.db.base import Base
    from app.db.models.user import User
    from app.db.models.scan_record import ScanRecord
    from app.db.models.scan_result import ScanResult

    async def check():
        async with engine.connect() as conn:
            # Check tables
            result = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table';"))
            tables = result.scalars().all()
            print("Tables in DB:", tables)
            
            # Check users
            try:
                res = await conn.execute(text("SELECT COUNT(*) FROM users;"))
                count = res.scalar()
                print("Users count:", count)
            except Exception as e:
                print("Error checking users:", e)

    asyncio.run(check())
