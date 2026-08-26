import asyncio
from app.db.session import AsyncSessionLocal
from app.db.models.user import User
from app.core.security import hash_password
from sqlalchemy import select

async def seed_users():
    async with AsyncSessionLocal() as db:
        # Standard User
        res_user = await db.execute(select(User).where(User.email == 'test@example.com'))
        user = res_user.scalar_one_or_none()
        if user:
            user.hashed_password = hash_password('password')
        else:
            user = User(email='test@example.com', hashed_password=hash_password('password'), role='USER')
            db.add(user)

        # Admin User
        res_admin = await db.execute(select(User).where(User.email == 'admin@example.com'))
        admin = res_admin.scalar_one_or_none()
        if admin:
            admin.hashed_password = hash_password('AdminPass123!')
            admin.role = 'ADMIN'
        else:
            admin = User(email='admin@example.com', hashed_password=hash_password('AdminPass123!'), role='ADMIN')
            db.add(admin)

        await db.commit()
        print("CREDENTIALS_SUCCESS")

if __name__ == "__main__":
    asyncio.run(seed_users())
