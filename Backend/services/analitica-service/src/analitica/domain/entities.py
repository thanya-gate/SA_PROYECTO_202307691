from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass(frozen=True)
class RankingItem:
    clase_id: str
    total_vistas: int
    promedio_calificacion: float
    total_calificaciones: int
    posicion: int


@dataclass(frozen=True)
class Recomendacion:
    clase_id: str
    porcentaje_recomendacion: float
    total_vistas: int
    promedio_calificacion: float
    fecha_calculo: str


@dataclass(frozen=True)
class EventoVista:
    clase_id: str
    estudiante_id: str
    fecha_evento: Optional[datetime]
    duracion_vista: int


@dataclass(frozen=True)
class ResumenIngesta:
    registros_cargados: int = 0
    registros_omitidos: int = 0
