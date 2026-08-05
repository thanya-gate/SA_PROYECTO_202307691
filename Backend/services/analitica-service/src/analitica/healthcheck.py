import os
import sys

from analitica.main import consultar_health


def main() -> None:
    host = os.getenv("HEALTHCHECK_HOST", "localhost")
    puerto = os.getenv("HEALTHCHECK_PORT", os.getenv("GRPC_PORT", "50054"))
    try:
        estado = consultar_health(host, puerto)
    except Exception as exc:  # noqa: BLE001 — exit code es la señal del healthcheck
        print(f"healthcheck fallo: {exc}", file=sys.stderr)
        sys.exit(1)

    if estado != "OK":
        print(f"healthcheck fallo: estado '{estado}'", file=sys.stderr)
        sys.exit(1)
    print("healthcheck OK")


if __name__ == "__main__":
    main()
