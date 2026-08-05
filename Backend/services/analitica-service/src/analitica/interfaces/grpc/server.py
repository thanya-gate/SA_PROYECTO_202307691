import logging
from concurrent import futures
from typing import Optional

import grpc

from analitica_pb2 import (
    CargarEventosCSVRequest,
    CargarEventosCSVResponse,
    ClasesMasVistasRequest,
    ClasesMasVistasResponse,
    HealthRequest,
    HealthResponse,
    RankingItem,
    RankingMejorValoradasRequest,
    RankingMejorValoradasResponse,
    RecomendacionItem,
    RecomendacionesEstudianteRequest,
    RecomendacionesEstudianteResponse,
    RecalcularTendenciasRequest,
    RecalcularTendenciasResponse,
    SincronizarCalificacionRequest,
    SincronizarCalificacionResponse,
    SincronizarVistaRequest,
    SincronizarVistaResponse,
    TendenciasExamenesRequest,
    TendenciasExamenesResponse,
)
from analitica_pb2_grpc import AnaliticaServiceServicer, add_AnaliticaServiceServicer_to_server

from ...application.services.analitica_service import AnaliticaService
from ...domain.errors import DomainError

logger = logging.getLogger("analitica.grpc")


class AnaliticaServicer(AnaliticaServiceServicer):
    """Adaptador gRPC: traduce el contrato del .proto al caso de uso de Analítica."""

    def __init__(self, servicio: AnaliticaService, version: str) -> None:
        self._servicio = servicio
        self._version = version

    # ---------------------------------------------------------------- health
    def Health(self, request: HealthRequest, context) -> HealthResponse:
        return HealthResponse(status="OK", service="analitica-service", version=self._version)

    # ---------------------------------------------------------------- consultas
    def ClasesMasVistas(self, request: ClasesMasVistasRequest, context) -> ClasesMasVistasResponse:
        def ejecutar() -> ClasesMasVistasResponse:
            semana, items = self._servicio.clases_mas_vistas(
                request.semana or None,
                request.limite,
            )
            return ClasesMasVistasResponse(
                semana=semana,
                items=[_a_ranking_item(item) for item in items],
            )

        return _manejar(context, ejecutar)

    def TendenciasExamenes(
        self, request: TendenciasExamenesRequest, context
    ) -> TendenciasExamenesResponse:
        def ejecutar() -> TendenciasExamenesResponse:
            items = self._servicio.tendencias_examenes(request.limite)
            return TendenciasExamenesResponse(items=[_a_ranking_item(item) for item in items])

        return _manejar(context, ejecutar)

    def RankingMejorValoradas(
        self, request: RankingMejorValoradasRequest, context
    ) -> RankingMejorValoradasResponse:
        def ejecutar() -> RankingMejorValoradasResponse:
            items = self._servicio.ranking_mejor_valoradas(request.limite)
            return RankingMejorValoradasResponse(items=[_a_ranking_item(item) for item in items])

        return _manejar(context, ejecutar)

    def RecomendacionesEstudiante(
        self, request: RecomendacionesEstudianteRequest, context
    ) -> RecomendacionesEstudianteResponse:
        def ejecutar() -> RecomendacionesEstudianteResponse:
            items = self._servicio.recomendaciones_estudiante(request.estudiante_id, request.limite)
            return RecomendacionesEstudianteResponse(
                items=[
                    RecomendacionItem(
                        clase_id=item.clase_id,
                        porcentaje_recomendacion=item.porcentaje_recomendacion,
                        total_vistas=item.total_vistas,
                        promedio_calificacion=item.promedio_calificacion,
                        fecha_calculo=item.fecha_calculo,
                    )
                    for item in items
                ]
            )

        return _manejar(context, ejecutar)

    # ---------------------------------------------------------------- ingesta
    def SincronizarVista(self, request: SincronizarVistaRequest, context) -> SincronizarVistaResponse:
        def ejecutar() -> SincronizarVistaResponse:
            self._servicio.sincronizar_vista(
                request.clase_id,
                request.estudiante_id,
                request.duracion_vista,
            )
            return SincronizarVistaResponse(registrada=True)

        return _manejar(context, ejecutar)

    def SincronizarCalificacion(
        self, request: SincronizarCalificacionRequest, context
    ) -> SincronizarCalificacionResponse:
        def ejecutar() -> SincronizarCalificacionResponse:
            self._servicio.sincronizar_calificacion(
                request.clase_id,
                request.estudiante_id,
                request.puntuacion,
            )
            return SincronizarCalificacionResponse(registrada=True)

        return _manejar(context, ejecutar)

    def CargarEventosCSV(self, request: CargarEventosCSVRequest, context) -> CargarEventosCSVResponse:
        def ejecutar() -> CargarEventosCSVResponse:
            resumen = self._servicio.cargar_eventos_csv(request.contenido, request.reemplazar)
            return CargarEventosCSVResponse(
                registros_cargados=resumen.registros_cargados,
                registros_omitidos=resumen.registros_omitidos,
            )

        return _manejar(context, ejecutar)

    def RecalcularTendencias(
        self, request: RecalcularTendenciasRequest, context
    ) -> RecalcularTendenciasResponse:
        def ejecutar() -> RecalcularTendenciasResponse:
            self._servicio.recalcular_tendencias(request.semana or None)
            return RecalcularTendenciasResponse(recalculada=True)

        return _manejar(context, ejecutar)


def _a_ranking_item(item) -> RankingItem:
    return RankingItem(
        clase_id=item.clase_id,
        total_vistas=item.total_vistas,
        promedio_calificacion=item.promedio_calificacion,
        total_calificaciones=item.total_calificaciones,
        posicion=item.posicion,
    )


def _manejar(context, ejecutar):
    try:
        return ejecutar()
    except DomainError as exc:
        context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(exc))
    except Exception as exc:  # noqa: BLE001 — el gRPC exige respuesta no-raise
        logger.exception("Error interno en analitica-service")
        context.abort(grpc.StatusCode.INTERNAL, f"INTERNO: {exc}")


def crear_servidor(
    servicio: AnaliticaService,
    version: str,
    puerto: str,
    workers: int = 10,
) -> grpc.Server:
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=workers))
    add_AnaliticaServiceServicer_to_server(AnaliticaServicer(servicio, version), server)
    server.add_insecure_port(f"[::]:{puerto}")
    return server


def iniciar_servidor(
    servicio: AnaliticaService,
    version: str,
    puerto: str,
    workers: Optional[int] = None,
) -> grpc.Server:
    server = crear_servidor(servicio, version, puerto, workers or 10)
    server.start()
    logger.info("analitica-service escuchando en gRPC puerto %s", puerto)
    return server
