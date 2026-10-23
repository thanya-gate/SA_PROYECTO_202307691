# Logs de GKE hacia ELK

Despliegue independiente del Kustomize padre (que fuerza `yousac-prod`). Solo crea Namespace, ConfigMap y DaemonSet en `logging`, sin RBAC ni token de ServiceAccount. La metadata sale del nombre del archivo, sin consultar la API. La imagen oficial está fijada en `5.1.5`.

Recolecta únicamente `/var/log/containers/*_yousac-prod_*.log` con parser CRI explícito (la imagen 5.1.5 incluida usa `message` por defecto) y conserva `log` y `stream`. Monta `/var/log` completo en solo lectura para resolver los enlaces hacia `/var/log/pods`. Sin privilegios, hostNetwork ni escalación. Véase [seguridad de Autopilot](https://docs.cloud.google.com/kubernetes-engine/docs/concepts/autopilot-security).

## Despliegue

```bash
CTX=gke_yousac-202300396-2026_us-central1_yousac-prod
kubectl kustomize observability/fluent-bit
kubectl --context "$CTX" apply -f observability/fluent-bit/namespace.yaml
kubectl --context "$CTX" apply --dry-run=server -k observability/fluent-bit
kubectl --context "$CTX" apply -k observability/fluent-bit
kubectl --context "$CTX" -n logging rollout status ds/fluent-bit --timeout=180s
kubectl --context "$CTX" -n logging exec ds/fluent-bit -- /fluent-bit/bin/fluent-bit --dry-run -c /fluent-bit/etc/fluent-bit.conf
```

Los archivos nuevos se leen desde el final. Checkpoints y cola están en `emptyDir` (512 MiB); la cola de salida se limita a 448 MB, con reintentos ilimitados. Al llenar la cola se descartan chunks antiguos. Se sincroniza el buffer a disco, se intenta vaciar al apagar y Kubernetes concede hasta 60 s al pod para cerrar. Esto mitiga interrupciones breves y terminaciones ordenadas; una pérdida abrupta del nodo o una caída de ELK más larga que la capacidad del buffer todavía puede perder logs pendientes. El transporte TCP `json_lines` a `10.20.3.10:5044` no confirma indexación. El DaemonSet consume más almacenamiento efímero por nodo; persistir a través de la pérdida total de un nodo requiere almacenamiento duradero y añadiría costo de Filestore.

## ELK y rotación

Desde `infra/ansible`, con un inventario que identifique exclusivamente la VM de observabilidad:

```bash
ansible-playbook -i INVENTARIO playbooks/elk.yml --syntax-check
ansible-playbook -i INVENTARIO playbooks/elk.yml --limit vm-observability-yousac \
  --tags elk_pipeline,elk_rotation --extra-vars '{"elastic_password":"${ELASTIC_PASSWORD}"}'
```

La variable literal permite a Logstash usar el secreto ya presente en el entorno del contenedor. Estas etiquetas no ejecutan las tareas que cambian credenciales ni importan dashboards. La configuración de Docker se fusiona recursivamente, se respalda si existía y se valida con `dockerd --validate` antes de escribirla. Se reinicia Docker cuando cambia y se recrean los cuatro servicios conservando los volúmenes. La etiqueta `elk_rotation` siempre recrea el stack para permitir recuperar una ejecución interrumpida. Hay interrupción del servicio durante esta operación. [Docker exige recrear los contenedores existentes](https://docs.docker.com/engine/logging/configure/).

Comprobar `docker inspect` para elasticsearch, logstash, kibana y caddy: `HostConfig.LogConfig` debe contener `json-file`, `max-size=10m`, `max-file=3`. Comprobar `/_cluster/health` y `/api/status` de Kibana, sin publicar credenciales.

## Prueba del parser

`python3 observability/fluent-bit/tests/check-cri.py` comprueba con la imagen real que el parser versionado conserva `log` y `stream`.

Generar el pipeline aislado desde la plantilla real:

```bash
python3 observability/fluent-bit/tests/check-logstash.py > /tmp/yousac-logstash-test.conf
docker run --rm --hostname localhost --network none \
  -v /tmp/yousac-logstash-test.conf:/tmp/test.conf:ro \
  -e LS_JAVA_OPTS='-Xms256m -Xmx256m' \
  docker.elastic.co/logstash/logstash:8.15.3 \
  -f /tmp/test.conf --log.level error
```

Debe producir un evento con `service=api-gateway`, `message` iniciado en `LOGIN_FALLIDO`, `security_event=login_no_autorizado` y `stream=stderr`, sin errores de las aserciones Ruby. No conecta a Elasticsearch ni indexa el evento sintético.

## Verificación real

Después de recuperar ELK, enviar una sola petición de login inválido con correo ficticio institucional y contraseña desechable. Exigir HTTP 401 y localizar `LOGIN_FALLIDO` en los logs del gateway. En Discover usar `yousac-logs-*`, intervalo UTC absoluto y estas consultas KQL:

```text
source : "yousac-gke"
```

```text
source : "yousac-gke"
and kubernetes.container_name : "api-gateway"
and log : "LOGIN_FALLIDO"
and security_event : "login_no_autorizado"
```

Registrar cantidad, índice, ID y captura. Comprobar también eventos recientes con `source : "yousac-vm"`. El documento de prueba autorizado se elimina exclusivamente por índice/ID tras inspeccionar su contenido, y se confirma HTTP 404 en la lectura posterior.

## Rollback

Eliminar solo el recolector con `kubectl --context "$CTX" delete ds/fluent-bit configmap/fluent-bit -n logging`; conservar el namespace y sus posibles recursos ajenos. Se pierden los pendientes en `emptyDir`.

En la VM, restaurar la copia previa de `logstash.conf` y reiniciar solo Logstash con `docker compose restart logstash`. Para revertir Docker, restaurar el backup de `daemon.json` (si antes no existía, retirarlo), validar, reiniciar Docker y recrear los cuatro servicios con `docker compose up -d --force-recreate elasticsearch logstash kibana caddy` desde `/opt/yousac-elk`. Nunca usar `down -v`. Mantener retirada la salida `stdout rubydebug`: reactivarla produciría un bucle de recolección de logs de la propia VM.
