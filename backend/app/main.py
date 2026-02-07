"""
GCS Digital Twin - FastAPI Backend
Main application entry point with all routes and services.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.routes import dashboard, diagrams, auth, trends, config
from app.services.modbus_poller import init_modbus_poller, get_modbus_poller
from app.services.redis_cache import init_redis_cache
from app.services.influxdb_writer import get_influx_writer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events for startup and shutdown."""
    
    # Startup
    logger.info("🚀 GCS Digital Twin Backend starting...")
    logger.info(f"   Modbus enabled: {settings.MODBUS_ENABLED}")
    logger.info(f"   Using simulator: {not settings.MODBUS_ENABLED}")
    
    # Initialize services
    if settings.MODBUS_ENABLED:
        logger.info(f"   Connecting to Modbus: {settings.MODBUS_HOST}:{settings.MODBUS_PORT}")
        await init_modbus_poller()
    
    # Try to connect to Redis (optional)
    try:
        await init_redis_cache()
    except Exception as e:
        logger.warning(f"   Redis not available: {e}")
    
    # Try to connect to InfluxDB (optional)
    try:
        influx = get_influx_writer()
        influx.connect()
    except Exception as e:
        logger.warning(f"   InfluxDB not available: {e}")
    
    logger.info("✅ Backend ready")
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    
    if settings.MODBUS_ENABLED:
        poller = get_modbus_poller()
        await poller.disconnect()


# Create FastAPI application
app = FastAPI(
    title="GCS Digital Twin API",
    description="Universal Digital Twin Platform for Gas Compressor Systems",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers - Note: dashboard and diagrams already have /api/units prefix
app.include_router(dashboard.router)
app.include_router(diagrams.router)
app.include_router(auth.router, prefix="/api")
app.include_router(trends.router, prefix="/api")
app.include_router(config.router, prefix="/api")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "GCS Digital Twin Backend",
        "modbus_enabled": settings.MODBUS_ENABLED
    }


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "GCS Digital Twin API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }
