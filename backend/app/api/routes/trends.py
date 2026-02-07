"""
Trends API Routes
Historical data queries from InfluxDB.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.services.influxdb_writer import get_influx_writer


router = APIRouter(prefix="/trends", tags=["Historical Trends"])


# Schemas
class TrendPoint(BaseModel):
    time: str
    value: float


class TrendResponse(BaseModel):
    unit_id: str
    measurement: str
    field: str
    start: str
    stop: str
    data: List[TrendPoint]


class MultiTrendRequest(BaseModel):
    unit_id: str
    measurements: List[dict]  # [{"measurement": "...", "field": "..."}]
    start: str = "-1h"
    aggregate_window: str = "1m"


# Routes
@router.get("/{unit_id}/{measurement}/{field}", response_model=TrendResponse)
async def get_trend(
    unit_id: str,
    measurement: str,
    field: str,
    start: str = Query("-1h", description="Start time (e.g., -1h, -24h, -7d)"),
    stop: str = Query("now()", description="End time"),
    aggregate: str = Query("1m", description="Aggregation window")
):
    """
    Get historical trend data for a specific measurement and field.
    
    Example measurements:
    - engine_vitals: rpm, oil_pressure, oil_temp, jacket_water_temp
    - compressor_vitals: oil_pressure, oil_temp, overall_ratio, total_bhp
    - stage_data (with stage tag): suction_press, discharge_press, suction_temp, discharge_temp
    - exhaust_temp (with cylinder tag): temperature
    - bearing_temp (with bearing tag): temperature
    """
    writer = get_influx_writer()
    
    if not writer.connected:
        # Return empty data if InfluxDB not connected
        return TrendResponse(
            unit_id=unit_id,
            measurement=measurement,
            field=field,
            start=start,
            stop=stop,
            data=[]
        )
    
    data = writer.query_trend(
        unit_id=unit_id,
        measurement=measurement,
        field=field,
        start=start,
        stop=stop,
        aggregate_window=aggregate
    )
    
    return TrendResponse(
        unit_id=unit_id,
        measurement=measurement,
        field=field,
        start=start,
        stop=stop,
        data=[TrendPoint(**p) for p in data]
    )


@router.post("/multi", response_model=dict)
async def get_multi_trends(request: MultiTrendRequest):
    """
    Get multiple trends in a single request.
    More efficient for dashboards displaying multiple charts.
    """
    writer = get_influx_writer()
    
    if not writer.connected:
        return {"error": "InfluxDB not connected", "data": {}}
    
    results = writer.query_multi_trend(
        unit_id=request.unit_id,
        measurements=request.measurements,
        start=request.start,
        aggregate_window=request.aggregate_window
    )
    
    return {"data": results}


@router.get("/{unit_id}/overview")
async def get_overview_trends(
    unit_id: str,
    start: str = Query("-6h", description="Start time")
):
    """
    Get commonly used trends for dashboard overview.
    Returns RPM, stage pressures, and temperatures in a single call.
    """
    writer = get_influx_writer()
    
    if not writer.connected:
        return {
            "unit_id": unit_id,
            "status": "InfluxDB not connected",
            "trends": {}
        }
    
    measurements = [
        {"measurement": "engine_vitals", "field": "rpm"},
        {"measurement": "engine_vitals", "field": "oil_pressure"},
        {"measurement": "compressor_vitals", "field": "overall_ratio"},
        {"measurement": "compressor_vitals", "field": "total_bhp"},
    ]
    
    results = writer.query_multi_trend(
        unit_id=unit_id,
        measurements=measurements,
        start=start,
        aggregate_window="5m"
    )
    
    return {
        "unit_id": unit_id,
        "status": "ok",
        "trends": results
    }
