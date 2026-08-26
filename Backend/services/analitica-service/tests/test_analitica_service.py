import json

import pytest

from analitica.application.services.analitica_service import (
    AnaliticaService,
    PoliticasTtl,
    PREFIJO_MAS_VISTAS,
    PREFIJO_RANKING,
    PREFIJO_RECOMENDACIONES,
    PREFIJO_TENDENCIAS,
)
from analitica.domain.entities import RankingItem, Recomendacion
from analitica.domain.errors import (
    ClaseRequeridaError,
    EstudianteRequeridoError,
    PuntuacionInvalidaError,
    SemanaInvalidaError,
)


class FakeCache:
    def __init__(self):
        self.values = {}
        self.get_calls = []
        self.set_calls = []
        self.deleted = []
        self.deleted_prefixes = []

    def get(self, clave):
        self.get_calls.append(clave)
        return self.values.get(clave)

    def set(self, clave, valor, ttl_segundos):
        self.set_calls.append((clave, valor, ttl_segundos))
        self.values[clave] = valor

    def delete(self, *claves):
        self.deleted.extend(claves)
        for clave in claves:
            self.values.pop(clave, None)

    def delete_por_prefijo(self, prefijo):
        self.deleted_prefixes.append(prefijo)
        self.values = {key: value for key, value in self.values.items() if not key.startswith(prefijo)}

    def ping(self):
        return True


class FakeRepository:
    def __init__(self):
        self.most_viewed = ("2026-08-24", [RankingItem("clase-1", 20, 4.5, 2, 1)])
        self.trends = ("2026-08-24", [RankingItem("clase-2", 10, 3.0, 1, 1)])
        self.ranking = [RankingItem("clase-3", 8, 5.0, 3, 1)]
        self.recommendations = [Recomendacion("clase-4", 92.0, 7, 4.0, "2026-08-26")]
        self.calls = []

    def clases_mas_vistas(self, semana, limite):
        self.calls.append(("mas_vistas", semana, limite))
        return self.most_viewed

    def tendencias_examenes(self, limite, desde=None, hasta=None):
        self.calls.append(("tendencias", limite, desde, hasta))
        return self.trends

    def ranking_mejor_valoradas(self, limite):
        self.calls.append(("ranking", limite))
        return self.ranking

    def recomendaciones_estudiante(self, estudiante_id, limite):
        self.calls.append(("recomendaciones", estudiante_id, limite))
        return self.recommendations

    def sincronizar_vista(self, clase_id, estudiante_id, duracion_vista):
        self.calls.append(("vista", clase_id, estudiante_id, duracion_vista))

    def sincronizar_calificacion(self, clase_id, estudiante_id, puntuacion):
        self.calls.append(("calificacion", clase_id, estudiante_id, puntuacion))

    def recalcular_tendencias(self, semana):
        self.calls.append(("recalcular", semana))
        return semana or "2026-08-24"

    def health(self):
        return True


def make_service(ttl=None):
    repo = FakeRepository()
    cache = FakeCache()
    return AnaliticaService(repo, cache, ttl), repo, cache


def test_aplica_limites_por_defecto_y_maximo_y_guarda_ttl():
    service, repo, cache = make_service(PoliticasTtl(mas_vistas=11))

    semana, items = service.clases_mas_vistas(None, 0)
    assert semana == "2026-08-24"
    assert items[0].clase_id == "clase-1"
    assert repo.calls[-1] == ("mas_vistas", None, 20)
    assert cache.set_calls[-1][2] == 11

    service.ranking_mejor_valoradas(999)
    assert repo.calls[-1] == ("ranking", 100)


def test_usa_cache_y_reconstruye_entidades_sin_consultar_repositorio():
    service, repo, cache = make_service()
    first = service.ranking_mejor_valoradas(2)
    assert len(repo.calls) == 1
    repo.ranking = [RankingItem("no-debe-aparecer", 1, 1.0, 1, 1)]

    second = service.ranking_mejor_valoradas(2)
    assert second == first
    assert len(repo.calls) == 1
    assert cache.get_calls[-1] == "analitica:ranking:2"

    cache.values["analitica:recomendaciones:student:10"] = json.dumps([
        {"clase_id": "cached", "porcentaje_recomendacion": 80.0, "total_vistas": 1,
         "promedio_calificacion": 4.0, "fecha_calculo": "2026-08-26"}
    ])
    assert service.recomendaciones_estudiante(" student ", 0)[0].clase_id == "cached"
    assert not any(call[0] == "recomendaciones" for call in repo.calls)


def test_valida_fechas_de_consultas_y_rango():
    service, repo, _cache = make_service()

    with pytest.raises(SemanaInvalidaError):
        service.clases_mas_vistas("2026-02-30", 10)
    with pytest.raises(SemanaInvalidaError):
        service.tendencias_examenes(10, "2026-08-25", "2026-08-24")
    with pytest.raises(SemanaInvalidaError):
        service.tendencias_examenes(10, "no-es-fecha", None)
    assert repo.calls == []

    service.tendencias_examenes(3, "2026-08-24", "2026-08-26")
    assert repo.calls[-1] == ("tendencias", 3, "2026-08-24", "2026-08-26")


def test_recomendaciones_requiere_estudiante_y_normaliza_limite():
    service, repo, _cache = make_service()
    with pytest.raises(EstudianteRequeridoError):
        service.recomendaciones_estudiante("  ", 10)
    assert repo.calls == []

    service.recomendaciones_estudiante("student", 1000)
    assert repo.calls[-1] == ("recomendaciones", "student", 100)


def test_sincronizaciones_validan_y_invalidan_caches_dependientes():
    service, repo, cache = make_service()
    with pytest.raises(ClaseRequeridaError):
        service.sincronizar_vista("", "student", 10)
    with pytest.raises(EstudianteRequeridoError):
        service.sincronizar_vista("clase", "", 10)
    assert repo.calls == []

    service.sincronizar_vista(" clase ", " student ", -20)
    assert repo.calls[-1] == ("vista", "clase", "student", 0)
    assert cache.deleted_prefixes[-3:] == [PREFIJO_MAS_VISTAS, PREFIJO_TENDENCIAS, PREFIJO_RANKING]

    with pytest.raises(PuntuacionInvalidaError):
        service.sincronizar_calificacion("clase", "student", 6)
    assert repo.calls[-1][0] == "vista"

    service.sincronizar_calificacion("clase", "student", 5)
    assert repo.calls[-1] == ("calificacion", "clase", "student", 5)
    assert cache.deleted_prefixes[-2:] == [PREFIJO_RANKING, f"{PREFIJO_RECOMENDACIONES}student:"]


def test_recalcular_tendencias_invalida_consultas_y_devuelve_semana():
    service, repo, cache = make_service()
    assert service.recalcular_tendencias("2026-08-24") == "2026-08-24"
    assert repo.calls[-1] == ("recalcular", "2026-08-24")
    assert cache.deleted_prefixes[-3:] == [PREFIJO_MAS_VISTAS, PREFIJO_TENDENCIAS, PREFIJO_RANKING]
