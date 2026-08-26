"""
app/core/rate_limit.py — Redis-backed rate limiting middleware
Restricts scanning requests to 10 requests per minute.
"""
import time
import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import redis.asyncio as aioredis
from app.core.config import settings

log = structlog.get_logger(__name__)

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, redis_url: str):
        super().__init__(app)
        self.redis = None
        try:
            self.redis = aioredis.from_url(redis_url, decode_responses=True)
            log.info("rate_limit.redis_connected", url=redis_url)
        except Exception as e:
            log.warning("rate_limit.redis_connection_failed", error=str(e))
            
        # In-memory fallback if Redis is offline
        self.local_cache = {}

    async def dispatch(self, request: Request, call_next):
        if not getattr(settings, "RATE_LIMIT_ENABLED", True):
            return await call_next(request)

        # Apply rate limiting exclusively to scan endpoints
        if request.url.path.startswith("/api/v1/scan"):
            # Determine rate limit key: extract JWT user id or fallback to IP
            user_key = "rate_limit:guest"
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
                try:
                    from app.core.security import get_subject_from_token
                    user_id = get_subject_from_token(token)
                    if user_id:
                        user_key = f"rate_limit:{user_id}"
                except Exception:
                    pass
            
            # If JWT not found, use client IP
            if user_key == "rate_limit:guest" and request.client:
                user_key = f"rate_limit:ip:{request.client.host}"
                
            now = int(time.time())
            window = 60
            limit = 10
            
            if self.redis:
                try:
                    current = await self.redis.get(user_key)
                    if current and int(current) >= limit:
                        log.warning("rate_limit.exceeded", key=user_key, limit=limit)
                        return Response(
                            content='{"detail": "Rate limit exceeded. Maximum 10 scans per minute."}',
                            status_code=429,
                            media_type="application/json"
                        )
                    
                    pipe = self.redis.pipeline()
                    pipe.incr(user_key)
                    pipe.expire(user_key, window)
                    await pipe.execute()
                except Exception as exc:
                    log.warning("rate_limit.redis_error", error=str(exc))
                    # Fallback to local dict rate limiting
                    self._check_local_rate_limit(user_key, now, window, limit)
            else:
                # Fallback to local dict rate limiting
                blocked = self._check_local_rate_limit(user_key, now, window, limit)
                if blocked:
                    return Response(
                        content='{"detail": "Rate limit exceeded. Maximum 10 scans per minute."}',
                        status_code=429,
                        media_type="application/json"
                    )
                    
        return await call_next(request)

    def _check_local_rate_limit(self, key: str, now: int, window: int, limit: int) -> bool:
        # Clean expired keys
        self.local_cache = {k: v for k, v in self.local_cache.items() if v[0] + window > now}
        
        if key in self.local_cache:
            timestamp, count = self.local_cache[key]
            if count >= limit:
                return True
            self.local_cache[key] = (timestamp, count + 1)
        else:
            self.local_cache[key] = (now, 1)
        return False
