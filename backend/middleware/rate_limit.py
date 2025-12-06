"""
Rate limiting middleware for API endpoints
Prevents abuse and ensures fair usage
"""

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, Tuple
import logging

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware using in-memory storage
    
    **Limits:**
    - /predict: 10 requests per minute per IP
    - /admin/*: 5 requests per minute per IP
    - Other endpoints: 30 requests per minute per IP
    
    **Implementation:**
    - Sliding window algorithm with timestamp tracking
    - IP-based identification (can be upgraded to user_id)
    - In-memory dict (production: use Redis for distributed rate limiting)
    
    **Defense Justification:**
    - Prevents DoS attacks on expensive ML inference endpoint
    - Protects Firebase quotas (Firestore reads/writes)
    - Ensures fair resource allocation across users
    - 10 req/min for predictions = 1 drawing every 6 seconds (reasonable UX)
    """
    
    def __init__(self, app):
        super().__init__(app)
        # Storage: {ip_address: [(timestamp, endpoint), ...]}
        self.request_history: Dict[str, list] = defaultdict(list)
        
        # Rate limits: (max_requests, time_window_seconds)
        self.limits = {
            "/predict": (10, 60),  # 10 predictions per minute
            "/admin": (5, 60),      # 5 admin actions per minute
            "default": (30, 60),    # 30 requests per minute for other endpoints
        }
    
    def get_client_ip(self, request: Request) -> str:
        """
        Extract client IP address
        Handles X-Forwarded-For header for proxied requests (Cloud Run, nginx)
        """
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"
    
    def get_rate_limit(self, path: str) -> Tuple[int, int]:
        """
        Get rate limit configuration for endpoint
        Returns: (max_requests, time_window_seconds)
        """
        # Check exact match first
        if path in self.limits:
            return self.limits[path]
        
        # Check prefix match for admin routes
        if path.startswith("/admin"):
            return self.limits["/admin"]
        
        # Default limit
        return self.limits["default"]
    
    def is_rate_limited(self, ip: str, path: str) -> Tuple[bool, int]:
        """
        Check if request should be rate limited
        
        Returns:
            (is_limited, remaining_requests)
        """
        max_requests, window_seconds = self.get_rate_limit(path)
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=window_seconds)
        
        # Get request history for this IP
        history = self.request_history[ip]
        
        # Remove old requests outside the time window
        history[:] = [
            (timestamp, endpoint) 
            for timestamp, endpoint in history 
            if timestamp > window_start
        ]
        
        # Count requests to this endpoint in the window
        endpoint_requests = sum(1 for _, endpoint in history if endpoint == path)
        
        # Check if limit exceeded
        is_limited = endpoint_requests >= max_requests
        remaining = max(0, max_requests - endpoint_requests - 1)
        
        return is_limited, remaining
    
    def record_request(self, ip: str, path: str):
        """Record a request in the history"""
        self.request_history[ip].append((datetime.utcnow(), path))
        
        # Cleanup: Remove IPs with no recent requests (older than 5 minutes)
        # Prevents memory leak from storing all IPs forever
        if len(self.request_history) > 1000:
            cutoff = datetime.utcnow() - timedelta(minutes=5)
            ips_to_remove = [
                ip for ip, history in self.request_history.items()
                if not history or max(ts for ts, _ in history) < cutoff
            ]
            for ip in ips_to_remove:
                del self.request_history[ip]
    
    async def dispatch(self, request: Request, call_next):
        """
        Middleware dispatch method
        Called for every request
        """
        # Skip rate limiting for health check
        if request.url.path == "/health":
            return await call_next(request)
        
        # Get client IP and endpoint
        ip = self.get_client_ip(request)
        path = request.url.path
        
        # Check rate limit
        is_limited, remaining = self.is_rate_limited(ip, path)
        
        if is_limited:
            max_requests, window_seconds = self.get_rate_limit(path)
            logger.warning(
                f"Rate limit exceeded: IP={ip}, endpoint={path}, "
                f"limit={max_requests}/{window_seconds}s"
            )
            
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "message": f"Maximum {max_requests} requests per {window_seconds} seconds",
                    "retry_after": window_seconds
                },
                headers={
                    "Retry-After": str(window_seconds),
                    "X-RateLimit-Limit": str(max_requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(window_seconds)
                }
            )
        
        # Record this request
        self.record_request(ip, path)
        
        # Add rate limit headers to response
        response = await call_next(request)
        max_requests, _ = self.get_rate_limit(path)
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        
        return response
