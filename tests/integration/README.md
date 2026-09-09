# Integración y paridad del servidor Cloud

`cloud-parity.mjs` ejecuta la misma batería HTTP contra el borde público de
YoUSAC. Comprueba el frontend, el API Gateway y sus seis dependencias gRPC;
después valida autenticación, catálogo, capítulos, materiales, foro,
notificaciones, analítica, inscripción, reproducción y cuaderno de apuntes.

La prueba usa únicamente `fetch` de Node 20, por lo que no agrega dependencias
ni se conecta directamente a PostgreSQL, Redis o gRPC. La URL de evaluación es
la pública de la VM; el gateway se accede por `/api` cuando el tráfico pasa por
nginx/Caddy.

## Ejecución completa desde PowerShell

```powershell
$env:CLOUD_BASE_URL = 'https://DOMINIO_PUBLICO'
$env:CLOUD_TEST_EMAIL = 'usuario-de-prueba@ingenieria.usac.edu.gt'
$env:CLOUD_TEST_PASSWORD = 'contraseña-de-prueba'
$env:CLOUD_CLASS_ID = 'UUID_DE_UNA_CLASE' # opcional; si no, usa la primera
$env:CLOUD_WRITE_TESTS = 'true'
$env:CLOUD_FORUM_WRITE_TESTS = 'true'
$env:CLOUD_REQUIRE_SAMPLE_DATA = 'true'
$env:CLOUD_REPORT_FILE = 'artifacts/cloud-parity.json'
node tests/integration/cloud-parity.mjs
```

La cuenta debe tener `ROLE_ESTUDIANTE`, `ROLE_AUXILIAR` o `ROLE_ADMIN` para
ejecutar checkpoint, apuntes y foro. Las pruebas de escritura crean un apunte
temporal y lo eliminan; el foro no tiene endpoint de borrado, por lo que deja
una duda identificada en la salida. Ejecutarlas contra una base de datos de
prueba o con `CLOUD_FORUM_WRITE_TESTS=false` evita contaminar datos reales.

Si solo se desea una comprobación de lectura, omitir `CLOUD_WRITE_TESTS`.
`CLOUD_REQUIRE_SAMPLE_DATA=true` hace fallar la prueba cuando la clase no tiene
al menos un capítulo, material y duda; es recomendable para la evidencia final.

Cuando el gateway se publica en una dirección distinta al frontend:

```powershell
$env:CLOUD_WEB_BASE_URL = 'https://DOMINIO_PUBLICO'
$env:CLOUD_API_BASE_URL = 'https://DOMINIO_PUBLICO/api'
```

Para comparar contra un entorno local/de referencia, se ejecuta exactamente la
misma batería agregando:

```powershell
$env:REFERENCE_BASE_URL = 'http://localhost:8081'
$env:REFERENCE_API_BASE_URL = 'http://localhost:8081/api'
$env:REFERENCE_TEST_EMAIL = $env:CLOUD_TEST_EMAIL
$env:REFERENCE_TEST_PASSWORD = $env:CLOUD_TEST_PASSWORD
node tests/integration/cloud-parity.mjs
```

El resultado termina con código `0` solo si el Cloud está operativo. Si se
configura `REFERENCE_BASE_URL`, también exige que ambas ejecuciones tengan el
mismo resultado por comprobación. El reporte JSON no contiene contraseñas ni
tokens y puede adjuntarse como evidencia del workflow.
