from .application.services.analitica_service import AnaliticaService, PoliticasTtl
from .config import Config, load_config
from .infrastructure.cache.redis_cache import RedisCache
from .infrastructure.persistence.postgres.db import Database
from .infrastructure.persistence.postgres.repository import PostgresAnaliticaRepository


class Contenedor:
    """Composición de dependencias del microservicio de Analítica."""

    def __init__(self, config: Config) -> None:
        self.config = config
        self.db = Database(config.database_url)
        self.cache = RedisCache(config.redis_url)
        self.repositorio = PostgresAnaliticaRepository(self.db)
        self.servicio = AnaliticaService(
            self.repositorio,
            self.cache,
            PoliticasTtl(
                mas_vistas=config.cache_ttl_mas_vistas,
                tendencias=config.cache_ttl_tendencias,
                ranking=config.cache_ttl_ranking,
                recomendaciones=config.cache_ttl_recomendaciones,
            ),
        )

    def cerrar(self) -> None:
        self.db.close()


def crear_contenedor() -> Contenedor:
    return Contenedor(load_config())
