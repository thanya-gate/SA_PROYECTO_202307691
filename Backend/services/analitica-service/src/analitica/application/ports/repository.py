from abc import ABC, abstractmethod
from typing import Optional

# from ...domain.entities import EventoVista, RankingItem, Recomendacion, ResumenIngesta  # [INGESTA DESACTIVADA]
from ...domain.entities import RankingItem, Recomendacion


class CacheRepository(ABC):
    """Puerto de la capa de caché (Redis) con políticas TTL."""

    @abstractmethod
    def get(self, clave: str) -> Optional[str]: ...

    @abstractmethod
    def set(self, clave: str, valor: str, ttl_segundos: int) -> None: ...

    @abstractmethod
    def delete(self, *claves: str) -> None: ...

    @abstractmethod
    def delete_por_prefijo(self, prefijo: str) -> None: ...

    @abstractmethod
    def ping(self) -> bool: ...


class AnaliticaRepository(ABC):
    """Puerto de persistencia de la BD de analítica (Database per Microservice)."""

    @abstractmethod
    def clases_mas_vistas(self, semana: Optional[str], limite: int) -> tuple[str, list[RankingItem]]: ...

    @abstractmethod
    def tendencias_examenes(self, limite: int) -> list[RankingItem]: ...

    @abstractmethod
    def ranking_mejor_valoradas(self, limite: int) -> list[RankingItem]: ...

    @abstractmethod
    def recomendaciones_estudiante(self, estudiante_id: str, limite: int) -> list[Recomendacion]: ...

    @abstractmethod
    def sincronizar_vista(self, clase_id: str, estudiante_id: str, duracion_vista: int) -> None: ...

    @abstractmethod
    def sincronizar_calificacion(self, clase_id: str, estudiante_id: str, puntuacion: int) -> None: ...

    # [INGESTA DESACTIVADA] carga masiva CSV
    # @abstractmethod
    # def ingesta_eventos_csv(self, eventos: list[EventoVista], reemplazar: bool) -> ResumenIngesta: ...

    @abstractmethod
    def recalcular_tendencias(self, semana: Optional[str]) -> str: ...

    @abstractmethod
    def health(self) -> bool: ...
