from typing import Optional

from ....application.ports.repository import AnaliticaRepository
from ....domain.entities import EventoVista, RankingItem, Recomendacion, ResumenIngesta
from .db import Database


class PostgresAnaliticaRepository(AnaliticaRepository):
    """Persistencia sobre PostgreSQL usando vistas, funciones y procedimientos almacenados."""

    def __init__(self, db: Database) -> None:
        self._db = db

    # ---------------------------------------------------------------- consultas
    def clases_mas_vistas(self, semana: Optional[str], limite: int) -> tuple[str, list[RankingItem]]:
        conn = self._db.connection()
        try:
            with conn.cursor() as cur:
                if not semana:
                    cur.execute("SELECT fn_inicio_semana(NOW()::date)")
                    semana = cur.fetchone()[0]
                if hasattr(semana, "isoformat"):
                    semana = semana.isoformat()

                cur.execute(
                    "SELECT * FROM fn_clases_mas_vistas_semana(%s::date, %s::int)",
                    (semana, limite),
                )
                items = [self._row_a_ranking(fila) for fila in cur.fetchall()]
            return semana, items
        finally:
            self._db.putconn(conn)

    def tendencias_examenes(self, limite: int) -> list[RankingItem]:
        conn = self._db.connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        v.clase_id,
                        v.total_vistas,
                        COALESCE(ca.promedio_calificacion, 0) AS promedio_calificacion,
                        COALESCE(ca.total_calificaciones, 0) AS total_calificaciones,
                        v.ranking_posicion AS posicion
                    FROM vw_tendencias_examenes v
                    LEFT JOIN calificacion_agregada ca ON ca.clase_id = v.clase_id
                    ORDER BY v.total_vistas DESC
                    LIMIT %s::int
                    """,
                    (limite,),
                )
                return [self._row_a_ranking(fila) for fila in cur.fetchall()]
        finally:
            self._db.putconn(conn)

    def ranking_mejor_valoradas(self, limite: int) -> list[RankingItem]:
        conn = self._db.connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM vw_ranking_clases LIMIT %s::int",
                    (limite,),
                )
                return [self._row_a_ranking(fila) for fila in cur.fetchall()]
        finally:
            self._db.putconn(conn)

    def recomendaciones_estudiante(self, estudiante_id: str, limite: int) -> list[Recomendacion]:
        conn = self._db.connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM fn_recomendaciones_estudiante(%s::uuid, %s::int)",
                    (estudiante_id, limite),
                )
                return [
                    Recomendacion(
                        clase_id=fila[0],
                        porcentaje_recomendacion=float(fila[1]),
                        total_vistas=int(fila[2]),
                        promedio_calificacion=float(fila[3]),
                        fecha_calculo=fila[4].isoformat(),
                    )
                    for fila in cur.fetchall()
                ]
        finally:
            self._db.putconn(conn)

    # ---------------------------------------------------------------- ingesta
    def sincronizar_vista(self, clase_id: str, estudiante_id: str, duracion_vista: int) -> None:
        conn = self._db.connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "CALL sp_registrar_evento_vista(%s::uuid, %s::uuid, %s::int)",
                    (clase_id, estudiante_id, duracion_vista),
                )
            conn.commit()
        finally:
            self._db.putconn(conn)

    def sincronizar_calificacion(self, clase_id: str, estudiante_id: str, puntuacion: int) -> None:
        conn = self._db.connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "CALL sp_sincronizar_calificacion(%s::uuid, %s::uuid, %s::int)",
                    (clase_id, estudiante_id, puntuacion),
                )
            conn.commit()
        finally:
            self._db.putconn(conn)

    def ingesta_eventos_csv(self, eventos: list[EventoVista], reemplazar: bool) -> ResumenIngesta:
        conn = self._db.connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CALL sp_ingesta_eventos_csv(
                        %s::uuid[], %s::uuid[], %s::timestamptz[], %s::int[], %s
                    )
                    """,
                    (
                        [ev.clase_id for ev in eventos],
                        [ev.estudiante_id for ev in eventos],
                        [ev.fecha_evento for ev in eventos],
                        [ev.duracion_vista for ev in eventos],
                        reemplazar,
                    ),
                )
                cur.execute(
                    """
                    CALL sp_registrar_ingesta(%s, %s::int, %s::int, %s)
                    """,
                    ("carga-masiva-csv", len(eventos), 0, "api-gateway"),
                )
            conn.commit()
            return ResumenIngesta(registros_cargados=len(eventos), registros_omitidos=0)
        finally:
            self._db.putconn(conn)

    def recalcular_tendencias(self, semana: Optional[str]) -> str:
        conn = self._db.connection()
        try:
            with conn.cursor() as cur:
                if not semana:
                    cur.execute("SELECT fn_inicio_semana(NOW()::date)")
                    semana = cur.fetchone()[0]
                if hasattr(semana, "isoformat"):
                    semana = semana.isoformat()
                cur.execute("CALL sp_recalcular_tendencias(%s::date)", (semana,))
            conn.commit()
            return semana
        finally:
            self._db.putconn(conn)

    def health(self) -> bool:
        return self._db.ping()

    @staticmethod
    def _row_a_ranking(fila) -> RankingItem:
        return RankingItem(
            clase_id=fila[0],
            total_vistas=int(fila[1]),
            promedio_calificacion=float(fila[2] or 0),
            total_calificaciones=int(fila[3]),
            posicion=int(fila[4]),
        )
