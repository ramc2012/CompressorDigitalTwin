"""
GCS Digital Twin - FastAPI Backend
Enhanced with database, alarm engine, and integrated data flow.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.routes import dashboard, diagrams, auth, trends, config, alarms
from app.services.modbus_poller import init_modbus_poller, get_modbus_poller
from app.services.redis_cache import init_redis_cache, get_redis_cache
from app.services.influxdb_writer import get_influx_writer
from app.services.alarm_engine import get_alarm_engine, AlarmSetpoint

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
    
    # Initialize database (optional - graceful failure)
    try:
        from app.db.database import init_db, close_db
        from app.db.seed import seed_database
        await init_db()
        await seed_database()  # Seeds only if empty
        logger.info("   ✅ PostgreSQL connected")
    except Exception as e:
        logger.warning(f"   PostgreSQL not available: {e}")
    
    # Initialize Redis (optional)
    try:
        await init_redis_cache()
        logger.info("   ✅ Redis connected")
    except Exception as e:
        logger.warning(f"   Redis not available: {e}")
    
    # Initialize InfluxDB (optional)
    try:
        influx = get_influx_writer()
        influx.connect()
        logger.info("   ✅ InfluxDB connected")
    except Exception as e:
        logger.warning(f"   InfluxDB not available: {e}")
    
    # Initialize alarm engine with default setpoints
    try:
        alarm_engine = get_alarm_engine()
        default_alarms = [
            AlarmSetpoint("stg1_discharge_temp", h_value=300, hh_value=350, delay_seconds=10),
            AlarmSetpoint("stg2_discharge_temp", h_value=300, hh_value=350, delay_seconds=10),
            AlarmSetpoint("stg3_discharge_temp", h_value=300, hh_value=350, delay_seconds=10),
            AlarmSetpoint("oil_pressure", l_value=30, ll_value=20, is_shutdown=True),
            AlarmSetpoint("coolant_temp", h_value=200, hh_value=220, is_shutdown=True),
            AlarmSetpoint("engine_rpm", h_value=1100, hh_value=1200),
        ]
        alarm_engine.load_setpoints(default_alarms)
        logger.info("   ✅ Alarm engine initialized (6 setpoints)")
    except Exception as e:
        logger.warning(f"   Alarm engine initialization failed: {e}")
    
    # Initialize Modbus poller
    if settings.MODBUS_ENABLED:
        logger.info(f"   Connecting to Modbus: {settings.MODBUS_HOST}:{settings.MODBUS_PORT}")
        try:
            await init_modbus_poller()
            logger.info("   ✅ Modbus poller connected")
        except Exception as e:
            logger.warning(f"   Modbus connection failed: {e}")
    
    logger.info("✅ Backend ready")
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    
    if settings.MODBUS_ENABLED:
        try:
            poller = get_modbus_poller()
            await poller.disconnect()
        except:
            pass
    
    # Close database connections
    try:
        from app.db.database import close_db
        await close_db()
    except:
        pass


# Create FastAPI application
app = FastAPI(
    title="GCS Digital Twin API",
    description="Universal Digital Twin Platform for Gas Compressor Systems",
    version="2.0.0",
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

# Include routers
app.include_router(dashboard.router)
app.include_router(diagrams.router)
app.include_router(alarms.router)  # New alarms router
app.include_router(auth.router, prefix="/api")
app.include_router(trends.router, prefix="/api")
app.include_router(config.router, prefix="/api")


@app.get("/health")
async def health_check():
    """Health check endpoint with component status."""
    try:
        alarm_engine = get_alarm_engine()
        alarm_count = len(alarm_engine.active_alarms)
        shutdown = alarm_engine.get_shutdown_active()
    except:
        alarm_count = 0
        shutdown = False
    
    return {
        "status": "healthy",
        "service": "GCS Digital Twin Backend",
        "version": "2.0.0",
        "modbus_enabled": settings.MODBUS_ENABLED,
        "active_alarms": alarm_count,
        "shutdown_active": shutdown
    }


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "GCS Digital Twin API",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health",
        "features": [
            "PostgreSQL config persistence",
            "Redis live data caching",
            "InfluxDB trending",
            "Alarm engine with LL/L/H/HH",
            "Config templates",
            "CoolProp gas properties"
        ]
    }
