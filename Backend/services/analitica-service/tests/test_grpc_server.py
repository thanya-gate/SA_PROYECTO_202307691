import grpc
import pytest

from analitica.application.services.analitica_service import AnaliticaService
from analitica.domain.entities import RankingItem, Recomendacion
from analitica.interfaces.grpc.server import AnaliticaServicer
from analitica_pb2 import (
    ClasesMasVistasRequest,
    HealthRequest,
    RecomendacionesEstudianteRequest,
    SincronizarCalificacionRequest,
    SincronizarVistaRequest,
)


class ContextoFalso:
    def __init__(self):
        self.status = None
        self.details = None

    def abort(self, status_code, details):
        self.status = status_code
        self.details = details
        raise RuntimeError("abort solicitado")


class RepoGrpc:
    def clases_mas_vistas(self, semana, limite):
        return "2026-08-24", [RankingItem("clase-1", limite, 4.5, 2, 1)]

    def tendencias_examenes(self, limite, desde=None, hasta=None):
        return "2026-08-24", []

    def ranking_mejor_valoradas(self, limite):
        return []

    def recomendaciones_estudiante(self, estudiante_id, limite):
        return [Recomendacion("clase-2", 90.0, limite, 4.0, "2026-08-26")]

    def sincronizar_vista(self, clase_id, estudiante_id, duracion_vista):
        return None

    def sincronizar_calificacion(self, clase_id, estudiante_id, puntuacion):
        return None

    def recalcular_tendencias(self, semana):
        return semana or "2026-08-24"

    def health(self):
        return True


class CacheGrpc:
    def get(self, _key):
        return None

    def set(self, _key, _value, _ttl):
        return None

    def delete(self, *_keys):
        return None

    def delete_por_prefijo(self, _prefix):
        return None

    def ping(self):
        return True


def make_servicer():
    return AnaliticaServicer(AnaliticaService(RepoGrpc(), CacheGrpc()), "test-version")


def test_adaptador_grpc_mapea_salidas_y_health():
    servicer = make_servicer()
    health = servicer.Health(HealthRequest(), ContextoFalso())
    assert health.status == "OK"
    assert health.version == "test-version"

    response = servicer.ClasesMasVistas(ClasesMasVistasRequest(limite=4), ContextoFalso())
    assert response.semana == "2026-08-24"
    assert response.items[0].clase_id == "clase-1"
    assert response.items[0].total_vistas == 4

    recommendations = servicer.RecomendacionesEstudiante(
        RecomendacionesEstudianteRequest(estudiante_id="student", limite=2), ContextoFalso()
    )
    assert recommendations.items[0].porcentaje_recomendacion == 90.0
    assert recommendations.items[0].clase_id == "clase-2"


def test_adaptador_grpc_confirma_sincronizaciones():
    servicer = make_servicer()
    vista = servicer.SincronizarVista(
        SincronizarVistaRequest(clase_id="clase", estudiante_id="student", duracion_vista=10),
        ContextoFalso(),
    )
    assert vista.registrada is True
    calificacion = servicer.SincronizarCalificacion(
        SincronizarCalificacionRequest(clase_id="clase", estudiante_id="student", puntuacion=5),
        ContextoFalso(),
    )
    assert calificacion.registrada is True


def test_adaptador_grpc_mapea_entrada_invalida_a_invalid_argument():
    servicer = make_servicer()
    context = ContextoFalso()
    with pytest.raises(RuntimeError):
        servicer.RecomendacionesEstudiante(RecomendacionesEstudianteRequest(), context)
    assert context.status == grpc.StatusCode.INVALID_ARGUMENT
    assert "ESTUDIANTE_REQUERIDO" in context.details


def test_adaptador_grpc_mapea_excepciones_no_controladas_a_internal():
    class BrokenRepo(RepoGrpc):
        def ranking_mejor_valoradas(self, _limite):
            raise RuntimeError("database down")

    servicer = AnaliticaServicer(AnaliticaService(BrokenRepo(), CacheGrpc()), "test")
    context = ContextoFalso()
    with pytest.raises(RuntimeError):
        from analitica_pb2 import RankingMejorValoradasRequest

        servicer.RankingMejorValoradas(RankingMejorValoradasRequest(limite=1), context)
    assert context.status == grpc.StatusCode.INTERNAL
