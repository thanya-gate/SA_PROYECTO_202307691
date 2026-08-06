import os
from dataclasses import dataclass

from dotenv import load_dotenv


@dataclass(frozen=True)
class Config:
    grpc_port: str
    database_url: str
    redis_url: str
    version: str
    cache_ttl_mas_vistas: int
    cache_ttl_tendencias: int
    cache_ttl_ranking: int
    cache_ttl_recomendaciones: int


def load_config() -> Config:
    load_dotenv()

    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise ValueError("DATABASE_URL es obligatoria (Database per Microservice)")

    return Config(
        grpc_port=os.getenv("GRPC_PORT", "50054").strip(),
        database_url=database_url,
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379/0").strip(),
        version="0.3.0",
        cache_ttl_mas_vistas=int(os.getenv("CACHE_TTL_MAS_VISTAS", "300")),
        cache_ttl_tendencias=int(os.getenv("CACHE_TTL_TENDENCIAS", "600")),
        cache_ttl_ranking=int(os.getenv("CACHE_TTL_RANKING", "900")),
        cache_ttl_recomendaciones=int(os.getenv("CACHE_TTL_RECOMENDACIONES", "600")),
    )
