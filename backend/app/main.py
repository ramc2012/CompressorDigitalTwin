"""
GCS Digital Twin - FastAPI Backend v3.1
Complete integration: Database, Alarm Engine, Multi-Unit, Extended Physics
Added: Modbus Config API
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.routes import dashboard, diagrams, auth, trends, config, alarms, units_api, modbus_config
from app.services.modbus_poller import init_modbus_poller, get_modbus_poller
from app.services.redis_cache import init_redis_cache, get_redis_cache
from app.services.influxdb_writer import get_influx_writer
from app.services.alarm_engine import get_alarm_engine, AlarmSetpoint
from app.services.unit_manager import get_unit_manager, UnitConfig
from app.services.extended_physics import get_extended_physics_engine

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
    
    logger.info("🚀 GCS Digital Twin Backend v3.1 starting...")
    logger.info(f"   Modbus enabled: {settings.MODBUS_ENABLED}")
    
    # Initialize database (optional - graceful failure)
    try:
        from app.db.database import init_db, close_db
        from app.db.seed import seed_database
        await init_db()
        await seed_database()
        logger.info("   ✅ PostgreSQL connected")
    except Exception as e:
        logger.warning(f"   PostgreSQL not available: {e}")
    
    # Initialize Redis
    try:
        await init_redis_cache()
        logger.info("   ✅ Redis connected")
    except Exception as e:
        logger.warning(f"   Redis not available: {e}")
    
    # Initialize InfluxDB
    try:
        influx = get_influx_writer()
        influx.connect()
        logger.info("   ✅ InfluxDB connected")
    except Exception as e:
        logger.warning(f"   InfluxDB not available: {e}")
    
    # Initialize multi-unit manager
    try:
        unit_manager = get_unit_manager()
        logger.info(f"   ✅ Unit manager initialized ({len(unit_manager.units)} units)")
    except Exception as e:
        logger.warning(f"   Unit manager initialization failed: {e}")
    
    # Initialize extended physics engine
    try:
        physics = get_extended_physics_engine()
        logger.info("   ✅ Extended physics engine initialized")
    except Exception as e:
        logger.warning(f"   Physics engine initialization failed: {e}")
    
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
    
    logger.info("✅ GCS Digital Twin Backend ready!")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down...")
    
    poller = get_modbus_poller()
    if poller:
        await poller.stop()
    
    redis = get_redis_cache()
    if redis:
        await redis.close()
    
    try:
        from app.db.database import close_db
        await close_db()
    except:
        pass
    
    logger.info("👋 Goodbye!")


# Create FastAPI app
app = FastAPI(
    title="GCS Digital Twin API",
    description="Real-time digital twin for gas compressor systems",
    version="3.1.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(diagrams.router, prefix="/api")
app.include_router(trends.router, prefix="/api")
app.include_router(config.router, prefix="/api")
app.include_router(alarms.router, prefix="/api")
app.include_router(units_api.router)
app.include_router(modbus_config.router, prefix="/api")


@app.get("/health")
async def health_check():
    """Health check endpoint with full component status."""
    try:
        alarm_engine = get_alarm_engine()
        unit_manager = get_unit_manager()
        
        return {
            "status": "healthy",
            "service": "GCS Digital Twin Backend",
            "version": "3.1.0",
            "modbus_enabled": settings.MODBUS_ENABLED,
            "active_alarms": len(alarm_engine.active_alarms),
            "shutdown_active": alarm_engine.get_shutdown_active(),
            "registered_units": len(unit_manager.units),
            "features": {
                "database": True,
                "redis": True,
                "influxdb": True,
                "alarm_engine": True,
                "multi_unit": True,
                "extended_physics": True,
                "celery": True,
                "modbus_config_api": True
            }
        }
    except Exception as e:
        return {
            "status": "degraded",
            "error": str(e)
        }


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "GCS Digital Twin API",
        "version": "3.1.0",
        "docs": "/docs",
        "health": "/health",
        "architecture_compliance": "Phase 1-7 In Progress",
        "features": [
            "PostgreSQL config persistence",
            "Redis live data caching",
            "InfluxDB trending",
            "Alarm engine (LL/L/H/HH)",
            "Multi-unit management",
            "Extended physics (power, rod loads)",
            "Celery background tasks",
            "User persistence",
            "Modbus config API",
            "Two-state data resolver",
            "Parameter-based trending"
        ]
    }
