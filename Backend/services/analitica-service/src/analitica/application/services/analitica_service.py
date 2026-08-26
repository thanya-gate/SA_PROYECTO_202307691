# import csv  # [INGESTA DESACTIVADA]
import json
# import uuid  # [INGESTA DESACTIVADA]
from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional

# from ...domain.entities import EventoVista, RankingItem, Recomendacion, ResumenIngesta  # [INGESTA DESACTIVADA: quitar EventoVista y ResumenIngesta]
from ...domain.entities import RankingItem, Recomendacion
from ...domain.errors import (
    ClaseRequeridaError,
    # CsvInvalidoError,  # [INGESTA DESACTIVADA]
    EstudianteRequeridoError,
    PuntuacionInvalidaError,
    SemanaInvalidaError,
)
from ..ports.repository import AnaliticaRepository, CacheRepository

LIMITE_DEFECTO_MAS_VISTAS = 20
LIMITE_DEFECTO_TENDENCIAS = 20
LIMITE_DEFECTO_RANKING = 20
LIMITE_DEFECTO_RECOMENDACIONES = 10
LIMITE_MAXIMO = 100

PREFIJO_MAS_VISTAS = "analitica:mas_vistas:"
PREFIJO_TENDENCIAS = "analitica:tendencias_examenes:"
PREFIJO_RANKING = "analitica:ranking:"
PREFIJO_RECOMENDACIONES = "analitica:recomendaciones:"


@dataclass(frozen=True)
class PoliticasTtl:
    mas_vistas: int = 300
    tendencias: int = 600
    ranking: int = 900
    recomendaciones: int = 600


def _limitar(valor: int, defecto: int) -> int:
    if valor <= 0:
        return defecto
    return min(valor, LIMITE_MAXIMO)


def _validar_semana(semana: Optional[str]) -> str:
    if not semana:
        return ""
    try:
        return date.fromisoformat(semana).isoformat()
    except ValueError as exc:
        raise SemanaInvalidaError(f"SEMANA_INVALIDA: '{semana}' no tiene formato YYYY-MM-DD") from exc


class AnaliticaService:
    """Caso de uso de Analítica: consultas, caché Redis, ingesta CSV y sincronización."""

    def __init__(
        self,
        repo: AnaliticaRepository,
        cache: CacheRepository,
        ttl: Optional[PoliticasTtl] = None,
    ) -> None:
        self._repo = repo
        self._cache = cache
        self._ttl = ttl or PoliticasTtl()

    # ---------------------------------------------------------------- consultas
    def clases_mas_vistas(self, semana: Optional[str], limite: int) -> tuple[str, list[RankingItem]]:
        semana_validada = _validar_semana(semana)
        limite_efectivo = _limitar(limite, LIMITE_DEFECTO_MAS_VISTAS)
        clave_semana = semana_validada or "actual"
        clave = f"{PREFIJO_MAS_VISTAS}{clave_semana}:{limite_efectivo}"

        cacheado = self._cache.get(clave)
        if cacheado is not None:
            datos = json.loads(cacheado)
            items = [RankingItem(**item) for item in datos["items"]]
            return str(datos["semana"]), items

        semana_real, items = self._repo.clases_mas_vistas(semana_validada or None, limite_efectivo)
        self._cache.set(
            clave,
            json.dumps({"semana": semana_real, "items": [item.__dict__ for item in items]}),
            self._ttl.mas_vistas,
        )
        return semana_real, items

    def tendencias_examenes(self, limite: int, desde: Optional[str] = None, hasta: Optional[str] = None) -> tuple[str, list[RankingItem]]:
        desde_validada = _validar_semana(desde) or None
        hasta_validada = _validar_semana(hasta) or None
        if desde_validada and hasta_validada and hasta_validada < desde_validada:
            raise SemanaInvalidaError("SEMANA_INVALIDA: el final del rango no puede ser anterior al inicio")
        limite_efectivo = _limitar(limite, LIMITE_DEFECTO_TENDENCIAS)
        clave = f"{PREFIJO_TENDENCIAS}{limite_efectivo}:{desde_validada or 'auto'}:{hasta_validada or 'auto'}"

        cacheado = self._cache.get(clave)
        if cacheado is not None:
            data = json.loads(cacheado)
            return data.get('semana', ''), [RankingItem(**item) for item in data.get('items', [])]

        semana, items = self._repo.tendencias_examenes(limite_efectivo, desde_validada, hasta_validada)
        self._cache.set(clave, json.dumps({"semana": semana, "items": [item.__dict__ for item in items]}), self._ttl.tendencias)
        return semana, items

    def ranking_mejor_valoradas(self, limite: int) -> list[RankingItem]:
        limite_efectivo = _limitar(limite, LIMITE_DEFECTO_RANKING)
        clave = f"{PREFIJO_RANKING}{limite_efectivo}"

        cacheado = self._cache.get(clave)
        if cacheado is not None:
            return [RankingItem(**item) for item in json.loads(cacheado)]

        items = self._repo.ranking_mejor_valoradas(limite_efectivo)
        self._cache.set(clave, json.dumps([item.__dict__ for item in items]), self._ttl.ranking)
        return items

    def recomendaciones_estudiante(self, estudiante_id: str, limite: int) -> list[Recomendacion]:
        estudiante_id = estudiante_id.strip()
        if not estudiante_id:
            raise EstudianteRequeridoError("ESTUDIANTE_REQUERIDO: estudiante_id es obligatorio")

        limite_efectivo = _limitar(limite, LIMITE_DEFECTO_RECOMENDACIONES)
        clave = f"{PREFIJO_RECOMENDACIONES}{estudiante_id}:{limite_efectivo}"

        cacheado = self._cache.get(clave)
        if cacheado is not None:
            return [Recomendacion(**item) for item in json.loads(cacheado)]

        items = self._repo.recomendaciones_estudiante(estudiante_id, limite_efectivo)
        self._cache.set(
            clave,
            json.dumps([item.__dict__ for item in items]),
            self._ttl.recomendaciones,
        )
        return items

    # ---------------------------------------------------------------- sincronización
    def sincronizar_vista(self, clase_id: str, estudiante_id: str, duracion_vista: int) -> None:
        clase_id = clase_id.strip()
        estudiante_id = estudiante_id.strip()
        if not clase_id:
            raise ClaseRequeridaError("CLASE_REQUERIDA: clase_id es obligatorio")
        if not estudiante_id:
            raise EstudianteRequeridoError("ESTUDIANTE_REQUERIDO: estudiante_id es obligatorio")

        self._repo.sincronizar_vista(clase_id, estudiante_id, max(0, duracion_vista))
        self._invalidar_tendencias()

    def sincronizar_calificacion(self, clase_id: str, estudiante_id: str, puntuacion: int) -> None:
        clase_id = clase_id.strip()
        estudiante_id = estudiante_id.strip()
        if not clase_id:
            raise ClaseRequeridaError("CLASE_REQUERIDA: clase_id es obligatorio")
        if not estudiante_id:
            raise EstudianteRequeridoError("ESTUDIANTE_REQUERIDO: estudiante_id es obligatorio")
        if puntuacion < 1 or puntuacion > 5:
            raise PuntuacionInvalidaError("PUNTUACION_INVALIDA: la puntuación debe estar entre 1 y 5")

        self._repo.sincronizar_calificacion(clase_id, estudiante_id, puntuacion)
        self._cache.delete_por_prefijo(PREFIJO_RANKING)
        self._cache.delete_por_prefijo(f"{PREFIJO_RECOMENDACIONES}{estudiante_id}:")

    # [INGESTA DESACTIVADA] carga masiva CSV
    # def cargar_eventos_csv(self, contenido: str, reemplazar: bool) -> ResumenIngesta:
    #     if not contenido or not contenido.strip():
    #         raise CsvInvalidoError("CSV_INVALIDO: el contenido no puede estar vacío")
    #
    #     eventos, omitidos_parse = self._parsear_csv(contenido)
    #     if not eventos:
    #         raise CsvInvalidoError("CSV_INVALIDO: no se encontraron filas válidas para cargar")
    #
    #     resumen = self._repo.ingesta_eventos_csv(eventos, reemplazar)
    #     self._invalidar_tendencias()
    #     return ResumenIngesta(
    #         registros_cargados=resumen.registros_cargados,
    #         registros_omitidos=resumen.registros_omitidos + omitidos_parse,
    #     )

    def recalcular_tendencias(self, semana: Optional[str]) -> str:
        semana_validada = _validar_semana(semana)
        semana_real = self._repo.recalcular_tendencias(semana_validada or None)
        self._invalidar_tendencias()
        return semana_real

    # ---------------------------------------------------------------- helpers
    def _invalidar_tendencias(self) -> None:
        self._cache.delete_por_prefijo(PREFIJO_MAS_VISTAS)
        self._cache.delete_por_prefijo(PREFIJO_TENDENCIAS)
        self._cache.delete_por_prefijo(PREFIJO_RANKING)

    # [INGESTA DESACTIVADA] parseo de CSV
    # @staticmethod
    # def _parsear_csv(contenido: str) -> tuple[list[EventoVista], int]:
    #     eventos: list[EventoVista] = []
    #     omitidos = 0
    #
    #     for fila in csv.reader(contenido.splitlines()):
    #         if not fila or not any(campo.strip() for campo in fila):
    #             continue
    #
    #         primera = fila[0].strip().lower()
    #         if primera == "clase_id":
    #             continue  # encabezado
    #
    #         if len(fila) < 2:
    #             omitidos += 1
    #             continue
    #
    #         clase_id = fila[0].strip()
    #         estudiante_id = fila[1].strip()
    #         fecha_str = fila[2].strip() if len(fila) > 2 else ""
    #         duracion_str = fila[3].strip() if len(fila) > 3 else ""
    #
    #         try:
    #             uuid.UUID(clase_id)
    #             uuid.UUID(estudiante_id)
    #         except ValueError:
    #             omitidos += 1
    #             continue
    #
    #         fecha: Optional[datetime] = None
    #         if fecha_str:
    #             try:
    #                 fecha = datetime.fromisoformat(fecha_str.replace("Z", "+00:00"))
    #             except ValueError:
    #                 omitidos += 1
    #                 continue
    #
    #         try:
    #             duracion = int(duracion_str) if duracion_str else 0
    #         except ValueError:
    #             duracion = 0
    #
    #         eventos.append(
    #             EventoVista(
    #                 clase_id=clase_id,
    #                 estudiante_id=estudiante_id,
    #                 fecha_evento=fecha,
    #                 duracion_vista=duracion,
    #             )
    #         )
    #
    #     return eventos, omitidos
