import logging
import signal
import time

import grpc

from analitica_pb2 import HealthRequest
from analitica_pb2_grpc import AnaliticaServiceStub

from .container import crear_contenedor
from .interfaces.grpc.server import iniciar_servidor

logger = logging.getLogger("analitica.main")


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    contenedor = crear_contenedor()
    config = contenedor.config

    if not contenedor.cache.ping():
        logger.warning("Redis no responde; las consultas operarán sin caché")

    server = iniciar_servidor(
        contenedor.servicio,
        config.version,
        config.grpc_port,
    )

    def _detener(_signum=None, _frame=None) -> None:
        logger.info("Deteniendo analitica-service...")
        server.stop(5)
        contenedor.cerrar()

    signal.signal(signal.SIGINT, _detener)
    signal.signal(signal.SIGTERM, _detener)

    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        _detener()


def consultar_health(host: str = "localhost", puerto: str = "50054", timeout: float = 3.0) -> str:
    canal = grpc.insecure_channel(f"{host}:{puerto}")
    try:
        stub = AnaliticaServiceStub(canal)
        resp = stub.Health(HealthRequest(), timeout=timeout)
        return resp.status
    finally:
        canal.close()
