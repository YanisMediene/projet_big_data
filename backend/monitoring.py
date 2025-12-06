"""
Monitoring and Analytics Configuration
Integrates Firebase Analytics, Sentry error tracking, and custom metrics
"""

import os
import logging
from functools import wraps
from datetime import datetime
from typing import Optional, Dict, Any
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Sentry configuration (optional - only if SENTRY_DSN is set)
try:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration
    
    SENTRY_DSN = os.getenv("SENTRY_DSN")
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
    
    if SENTRY_DSN:
        sentry_logging = LoggingIntegration(
            level=logging.INFO,  # Capture info and above as breadcrumbs
            event_level=logging.ERROR  # Send errors as events
        )
        
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=ENVIRONMENT,
            traces_sample_rate=0.1,  # Sample 10% of transactions for performance monitoring
            profiles_sample_rate=0.1,  # Sample 10% of profiling data
            integrations=[
                FastApiIntegration(),
                sentry_logging,
            ],
            # Filter out health check spam
            before_send=lambda event, hint: None if '/health' in event.get('request', {}).get('url', '') else event
        )
        logger.info(f"✅ Sentry initialized for environment: {ENVIRONMENT}")
    else:
        logger.info("⚠️  Sentry DSN not configured - error tracking disabled")
        
except ImportError:
    logger.warning("⚠️  Sentry SDK not installed - error tracking disabled")


class MetricsCollector:
    """
    Collects application metrics for monitoring
    
    In production, these should be sent to Cloud Monitoring / Prometheus
    For now, we log them and could export to Cloud Logging
    """
    
    def __init__(self):
        self.metrics = {
            "predictions": {
                "total": 0,
                "success": 0,
                "errors": 0,
                "latency_ms": []
            },
            "corrections": {
                "total": 0,
                "by_category": {}
            },
            "games": {
                "created": 0,
                "completed": 0,
                "active": 0
            },
            "retraining": {
                "triggered": 0,
                "success": 0,
                "failures": 0
            }
        }
    
    def record_prediction(self, success: bool, latency_ms: float, category: Optional[str] = None):
        """Record a prediction event"""
        self.metrics["predictions"]["total"] += 1
        if success:
            self.metrics["predictions"]["success"] += 1
        else:
            self.metrics["predictions"]["errors"] += 1
        
        self.metrics["predictions"]["latency_ms"].append(latency_ms)
        
        # Keep only last 1000 latencies to avoid memory issues
        if len(self.metrics["predictions"]["latency_ms"]) > 1000:
            self.metrics["predictions"]["latency_ms"] = self.metrics["predictions"]["latency_ms"][-1000:]
        
        # Log high latency warnings
        if latency_ms > 1000:  # > 1 second
            logger.warning(f"High prediction latency: {latency_ms}ms")
    
    def record_correction(self, category: str):
        """Record a user correction"""
        self.metrics["corrections"]["total"] += 1
        if category not in self.metrics["corrections"]["by_category"]:
            self.metrics["corrections"]["by_category"][category] = 0
        self.metrics["corrections"]["by_category"][category] += 1
    
    def record_game_created(self):
        """Record game creation"""
        self.metrics["games"]["created"] += 1
        self.metrics["games"]["active"] += 1
    
    def record_game_completed(self):
        """Record game completion"""
        self.metrics["games"]["completed"] += 1
        self.metrics["games"]["active"] = max(0, self.metrics["games"]["active"] - 1)
    
    def record_retraining(self, success: bool):
        """Record retraining event"""
        self.metrics["retraining"]["triggered"] += 1
        if success:
            self.metrics["retraining"]["success"] += 1
        else:
            self.metrics["retraining"]["failures"] += 1
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics snapshot"""
        metrics = self.metrics.copy()
        
        # Calculate latency percentiles
        if metrics["predictions"]["latency_ms"]:
            latencies = sorted(metrics["predictions"]["latency_ms"])
            n = len(latencies)
            metrics["predictions"]["latency_p50"] = latencies[int(n * 0.5)]
            metrics["predictions"]["latency_p95"] = latencies[int(n * 0.95)]
            metrics["predictions"]["latency_p99"] = latencies[int(n * 0.99)]
            metrics["predictions"]["latency_avg"] = sum(latencies) / n
        
        return metrics
    
    def log_metrics(self):
        """Log current metrics (called periodically)"""
        metrics = self.get_metrics()
        logger.info("=== Application Metrics ===")
        logger.info(f"Predictions: {metrics['predictions']['total']} total, "
                   f"{metrics['predictions']['success']} success, "
                   f"{metrics['predictions']['errors']} errors")
        
        if "latency_p95" in metrics["predictions"]:
            logger.info(f"Latency: P50={metrics['predictions']['latency_p50']:.0f}ms, "
                       f"P95={metrics['predictions']['latency_p95']:.0f}ms, "
                       f"P99={metrics['predictions']['latency_p99']:.0f}ms")
        
        logger.info(f"Corrections: {metrics['corrections']['total']} total")
        logger.info(f"Games: {metrics['games']['created']} created, "
                   f"{metrics['games']['active']} active, "
                   f"{metrics['games']['completed']} completed")
        logger.info(f"Retraining: {metrics['retraining']['triggered']} triggered, "
                   f"{metrics['retraining']['success']} success, "
                   f"{metrics['retraining']['failures']} failures")


# Global metrics collector instance
metrics_collector = MetricsCollector()


def track_latency(metric_name: str):
    """
    Decorator to track endpoint latency
    
    Usage:
        @track_latency("predict")
        async def predict_endpoint():
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            success = True
            
            try:
                result = await func(*args, **kwargs)
                return result
            except Exception as e:
                success = False
                # Re-raise to let FastAPI handle it
                raise
            finally:
                latency_ms = (time.time() - start_time) * 1000
                
                if metric_name == "predict":
                    metrics_collector.record_prediction(success, latency_ms)
                
                # Log slow requests
                if latency_ms > 500:
                    logger.warning(f"Slow request: {metric_name} took {latency_ms:.0f}ms")
        
        return wrapper
    return decorator


def log_event(event_name: str, properties: Optional[Dict] = None):
    """
    Log custom analytics event
    
    In production, this would send to Firebase Analytics / Cloud Logging
    For now, we just log it
    """
    logger.info(f"Analytics Event: {event_name}", extra={
        "event": event_name,
        "properties": properties or {},
        "timestamp": datetime.utcnow().isoformat()
    })


# Export metrics endpoint data structure
def get_metrics_for_export():
    """Get metrics in a format suitable for Cloud Monitoring export"""
    metrics = metrics_collector.get_metrics()
    
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "metrics": metrics,
        "environment": os.getenv("ENVIRONMENT", "development"),
        "service": "ai-pictionary-backend"
    }
