from typing import Optional

import redis

from ...application.ports.repository import CacheRepository


class RedisCache(CacheRepository):
    """Implementación de la capa de caché con Redis y expiración TTL."""

    def __init__(self, url: str) -> None:
        self._client = redis.Redis.from_url(url, decode_responses=True)

    def get(self, clave: str) -> Optional[str]:
        valor = self._client.get(clave)
        return valor if isinstance(valor, str) else None

    def set(self, clave: str, valor: str, ttl_segundos: int) -> None:
        self._client.set(clave, valor, ex=ttl_segundos)

    def delete(self, *claves: str) -> None:
        if claves:
            self._client.delete(*claves)

    def delete_por_prefijo(self, prefijo: str) -> None:
        for clave in self._client.scan_iter(match=f"{prefijo}*", count=500):
            self._client.delete(clave)

    def ping(self) -> bool:
        try:
            return bool(self._client.ping())
        except Exception:
            return False
