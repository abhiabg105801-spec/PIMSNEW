# routers/kpi_admin.py
"""
KPI Configuration Management
Only Admin can modify
"""

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import UserDB
from auth import get_current_user
from constants.kpi_config import KPI_REGISTRY, AggregationType
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin/kpis")


class KPIConfigUpdate(BaseModel):
    day_aggregation: Optional[str] = None
    month_aggregation: Optional[str] = None
    year_aggregation: Optional[str] = None
    weight_by: Optional[str] = None
    decimals: Optional[int] = None


@router.get("/config")
async def get_all_kpi_configs(
    current_user: UserDB = Depends(get_current_user),
):
    """Get all KPI configurations"""
    
    configs = []
    
    for kpi_name, config in KPI_REGISTRY.items():
        configs.append({
            "name": config.name,
            "display_name": config.display_name,
            "unit": config.unit,
            "day_aggregation": config.day_aggregation.value,
            "month_aggregation": config.month_aggregation.value,
            "year_aggregation": config.year_aggregation.value,
            "weight_by": config.weight_by,
            "decimals": config.decimals,
        })
    
    return {"kpis": configs}


@router.get("/config/{kpi_name}")
async def get_kpi_config(
    kpi_name: str,
    current_user: UserDB = Depends(get_current_user),
):
    """Get configuration for a specific KPI"""
    
    config = KPI_REGISTRY.get(kpi_name)
    
    if not config:
        raise HTTPException(status_code=404, detail=f"KPI '{kpi_name}' not found")
    
    return {
        "name": config.name,
        "display_name": config.display_name,
        "unit": config.unit,
        "day_aggregation": config.day_aggregation.value,
        "month_aggregation": config.month_aggregation.value,
        "year_aggregation": config.year_aggregation.value,
        "weight_by": config.weight_by,
        "decimals": config.decimals,
    }


@router.get("/aggregation-types")
async def get_aggregation_types(
    current_user: UserDB = Depends(get_current_user),
):
    """Get available aggregation types"""
    
    return {
        "aggregation_types": [
            {"value": t.value, "label": t.value.replace("_", " ").title()}
            for t in AggregationType
        ]
    }