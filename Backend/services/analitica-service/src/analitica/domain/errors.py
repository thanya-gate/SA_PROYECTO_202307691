class DomainError(Exception):
    """Error base del dominio de Analítica."""


class EntradaInvalidaError(DomainError):
    """Parámetros de entrada inválidos."""


class ClaseRequeridaError(EntradaInvalidaError):
    pass


class EstudianteRequeridoError(EntradaInvalidaError):
    pass


class PuntuacionInvalidaError(EntradaInvalidaError):
    pass


class SemanaInvalidaError(EntradaInvalidaError):
    pass


class CsvInvalidoError(EntradaInvalidaError):
    pass
