import psycopg2
from psycopg2 import pool as pg_pool


class Database:
    """Pool de conexiones a la BD de analítica (Database per Microservice)."""

    def __init__(self, database_url: str) -> None:
        self._pool = pg_pool.SimpleConnectionPool(1, 10, dsn=database_url)

    def connection(self):
        return self._pool.getconn()

    def putconn(self, conn) -> None:
        self._pool.putconn(conn)

    def close(self) -> None:
        self._pool.closeall()

    def ping(self) -> bool:
        conn = self.connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
            return True
        except Exception:
            return False
        finally:
            self.putconn(conn)
