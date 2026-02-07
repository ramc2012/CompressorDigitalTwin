"""
GCS Digital Twin Configuration
Environment-based settings for all services.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Application
    APP_NAME: str = "GCS Digital Twin"
    DEBUG: bool = False
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://gcs_user:gcs_password@localhost:5432/gcs_twin"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # InfluxDB
    INFLUX_URL: str = "http://localhost:8086"
    INFLUX_TOKEN: str = "gcs-digital-twin-token"
    INFLUX_ORG: str = "gcs"
    INFLUX_BUCKET_RAW: str = "gcs_raw"
    INFLUX_BUCKET_AGGREGATED: str = "gcs_aggregated"
    
    # Modbus
    MODBUS_ENABLED: bool = False
    MODBUS_HOST: str = "localhost"
    MODBUS_PORT: int = 5020
    MODBUS_SLAVE_ID: int = 1
    MODBUS_TIMEOUT: float = 3.0
    MODBUS_POLL_INTERVAL_MS: int = 1000
    
    # Authentication
    JWT_SECRET: str = "gcs-digital-twin-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60
    
    # Physics Engine
    DEFAULT_K_RATIO: float = 1.28  # Specific heat ratio for natural gas
    DEFAULT_Z_FACTOR: float = 0.95  # Compressibility factor
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
