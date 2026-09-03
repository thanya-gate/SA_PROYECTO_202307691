# Pruebas unitarias

Esta guía explica cómo instalar las dependencias y ejecutar todas las pruebas unitarias de YoUSAC, tanto juntas como por módulo. También incluye los comandos específicos del cuaderno de apuntes incorporado en la Fase 2.

Las suites usan dobles de prueba para sus dependencias externas. Por lo tanto, no requieren Docker, archivos `.env`, PostgreSQL, Redis, SMTP, Google Cloud Storage ni microservicios gRPC levantados.

## 1. Requisitos

- Node.js 20 y npm para los servicios TypeScript y el frontend.
- Go 1.24 para `reproduccion-service`.
- Python 3.11, 3.12 o 3.14 para `analitica-service`. El pipeline utiliza Python 3.12.
- Ejecutar los comandos desde la raíz del repositorio, salvo que se indique lo contrario.

En Windows PowerShell se recomienda usar `npm.cmd`. En Linux y macOS se utiliza `npm`.

## 2. Preparación inicial

La instalación solo es necesaria la primera vez, después de clonar el repositorio o cuando cambie algún archivo de dependencias.

### Windows PowerShell

```powershell
$nodePackages = @(
  'Backend/services/auth-service',
  'Backend/services/catalog-service',
  'Backend/services/inscripcion-service',
  'Backend/services/notificaciones-service',
  'Backend/api-gateway',
  'Frontend'
)

foreach ($package in $nodePackages) {
  npm.cmd --prefix $package ci
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

python -m venv Backend/services/analitica-service/.venv
& Backend/services/analitica-service/.venv/Scripts/python.exe -m pip install `
  -r Backend/services/analitica-service/requirements.txt

Push-Location Backend/services/reproduccion-service
go mod download
Pop-Location
```

### Linux o macOS

```bash
set -e

for package in \
  Backend/services/auth-service \
  Backend/services/catalog-service \
  Backend/services/inscripcion-service \
  Backend/services/notificaciones-service \
  Backend/api-gateway \
  Frontend
do
  npm --prefix "$package" ci
done

python3 -m venv Backend/services/analitica-service/.venv
Backend/services/analitica-service/.venv/bin/python -m pip install \
  -r Backend/services/analitica-service/requirements.txt

(cd Backend/services/reproduccion-service && go mod download)
```

## 3. Ejecutar todas las pruebas juntas

Estos comandos reproducen localmente el trabajo principal de `.github/workflows/unit-tests.yml`. Se detienen al encontrar la primera suite fallida.

### Windows PowerShell

```powershell
$nodePackages = @(
  'Backend/services/auth-service',
  'Backend/services/catalog-service',
  'Backend/services/inscripcion-service',
  'Backend/services/notificaciones-service',
  'Backend/api-gateway',
  'Frontend'
)

foreach ($package in $nodePackages) {
  Write-Host "`n==> Pruebas de $package"
  npm.cmd --prefix $package test -- --runInBand
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "`n==> Pruebas de reproduccion-service"
Push-Location Backend/services/reproduccion-service
go test ./... -v
$goExitCode = $LASTEXITCODE
Pop-Location
if ($goExitCode -ne 0) { exit $goExitCode }

Write-Host "`n==> Pruebas de analitica-service"
Push-Location Backend/services/analitica-service
& .venv/Scripts/python.exe -m pytest -v
$pythonExitCode = $LASTEXITCODE
Pop-Location
if ($pythonExitCode -ne 0) { exit $pythonExitCode }
```

### Linux o macOS

```bash
set -e

for package in \
  Backend/services/auth-service \
  Backend/services/catalog-service \
  Backend/services/inscripcion-service \
  Backend/services/notificaciones-service \
  Backend/api-gateway \
  Frontend
do
  echo "==> Pruebas de $package"
  npm --prefix "$package" test -- --runInBand
done

(cd Backend/services/reproduccion-service && go test ./... -v)
(cd Backend/services/analitica-service && .venv/bin/python -m pytest -v)
```

Una ejecución correcta termina con `PASS`, `passed` u `ok` en todas las suites y devuelve código de salida `0`.

## 4. Pruebas del cuaderno de apuntes

Las pruebas del cuaderno están distribuidas entre frontend, API Gateway y `reproduccion-service` para validar el flujo completo por capas, sin convertirlas en pruebas de integración.

### 4.1 Frontend

Desde la raíz del repositorio:

```powershell
npm.cmd --prefix Frontend test -- --runInBand `
  tests/apuntes-api.test.ts `
  tests/apunte-editor.test.tsx
```

En Linux o macOS se reemplaza `npm.cmd` por `npm` y se pueden colocar los tres argumentos en una sola línea.

Estas dos suites comprueban:

- Construcción y codificación de las rutas para listar, guardar, actualizar, eliminar y exportar apuntes.
- Envío del token de sesión y de los cuerpos HTTP correctos.
- Descarga Markdown, nombre del archivo, tipo MIME y manejo de errores HTTP.
- Inserción automática de marcadores `[MM:SS]`.
- Navegación al segundo exacto al seleccionar un marcador en la vista previa.
- Formato Markdown desde la barra del editor.
- Creación y actualización de apuntes, incluyendo la conservación de su posición original.
- Mensajes de error, eliminación confirmada y exportación a PDF y `.md`.

Resultado de referencia: `2 suites passed` y `12 tests passed`.

### 4.2 API Gateway

```powershell
npm.cmd --prefix Backend/api-gateway test -- --runInBand `
  tests/gateway-apuntes.test.ts
```

La suite comprueba:

- Sesión obligatoria y roles permitidos.
- Aislamiento por el identificador del estudiante autenticado.
- Listado general y filtro por clase.
- Creación y actualización con normalización de la posición.
- Rechazo de campos inválidos y de marcadores que no cumplan exactamente `[MM:SS]`.
- Eliminación y exportación Markdown con encabezados HTTP correctos.

Resultado de referencia: `1 suite passed` y `9 tests passed`.

### 4.3 Backend Go: dominio, servicio, persistencia y gRPC

```powershell
Push-Location Backend/services/reproduccion-service
go test -v -run 'Apunte|Marcador|Cuaderno' `
  ./internal/domain `
  ./internal/application/service `
  ./internal/infrastructure/persistence/postgres `
  ./internal/interfaces/grpc
Pop-Location
```

El mismo comando funciona en Bash si se eliminan los acentos graves de continuación y se escribe en una sola línea.

Estas pruebas comprueban:

- Campos obligatorios, longitud del título y posición no negativa.
- Marcadores válidos y rechazo de formatos como `[1:30]`, `[01:5]` o `[01:60]`.
- Conversión de marcadores a segundos.
- Construcción del archivo de un apunte y del cuaderno Markdown consolidado.
- Delegación del servicio para guardar, listar, eliminar y exportar.
- Creación, actualización, listado y eliminación en el adaptador PostgreSQL mediante un pool simulado.
- Aislamiento de actualizaciones y eliminaciones por `estudiante_id`.
- Traducción de solicitudes, respuestas y errores gRPC.

No se necesita una base de datos real para estas pruebas de persistencia.

## 5. Ejecutar una sola capa o módulo

### Paquetes TypeScript

```powershell
npm.cmd --prefix Backend/services/auth-service test -- --runInBand
npm.cmd --prefix Backend/services/catalog-service test -- --runInBand
npm.cmd --prefix Backend/services/inscripcion-service test -- --runInBand
npm.cmd --prefix Backend/services/notificaciones-service test -- --runInBand
npm.cmd --prefix Backend/api-gateway test -- --runInBand
npm.cmd --prefix Frontend test -- --runInBand
```

Para ejecutar un solo archivo Jest se agrega su ruta al final:

```powershell
npm.cmd --prefix Frontend test -- --runInBand tests/apunte-editor.test.tsx
```

También se puede filtrar por nombre:

```powershell
npm.cmd --prefix Frontend test -- --runInBand -t "exporta el apunte"
```

### Reproducción Go

```powershell
Push-Location Backend/services/reproduccion-service
go test ./... -v
Pop-Location
```

### Analítica Python

```powershell
Push-Location Backend/services/analitica-service
& .venv/Scripts/python.exe -m pytest -v
Pop-Location
```

## 6. Cobertura

### Jest

```powershell
npm.cmd --prefix Backend/api-gateway run test:coverage -- --runInBand
npm.cmd --prefix Frontend run test:coverage -- --runInBand
```

Los reportes HTML y LCOV se generan en el directorio `coverage/` de cada paquete y están ignorados por Git.

### Go

```powershell
Push-Location Backend/services/reproduccion-service
go test ./... -coverprofile=coverage.out
go tool cover -func=coverage.out
go tool cover -html=coverage.out
Pop-Location
```

La última instrucción abre el reporte HTML en el navegador. `coverage.out` también está ignorado por Git.

### Python

```powershell
Push-Location Backend/services/analitica-service
& .venv/Scripts/python.exe -m pytest --cov=src/analitica --cov-report=term-missing
Pop-Location
```

Como referencia del cuaderno, la ejecución verificada el 2 de septiembre de 2026 obtuvo:

| Capa | Cobertura de sentencias |
|---|---:|
| `Frontend/src/components/ApunteEditor.tsx` | 79.60% |
| `Frontend/src/api/reproduccion.ts` | 76.47% |
| Dominio Go de reproducción | 98.30% |
| Servicio de aplicación Go | 100.00% |
| Persistencia PostgreSQL Go | 44.40% global del paquete |
| Adaptador gRPC Go | 91.80% |

El porcentaje global de persistencia también incluye checkpoints, historial y calificaciones; las operaciones de apuntes sí cuentan con casos directos de éxito y error.

## 7. Línea base de todas las suites

La siguiente línea base fue ejecutada localmente el 2 de septiembre de 2026:

| Módulo | Resultado |
|---|---:|
| `auth-service` | 35 pruebas aprobadas |
| `catalog-service` | 31 pruebas aprobadas |
| `inscripcion-service` | 10 pruebas aprobadas |
| `notificaciones-service` | 11 pruebas aprobadas |
| `api-gateway` | 40 pruebas aprobadas |
| `Frontend` | 42 pruebas aprobadas |
| `analitica-service` | 10 pruebas aprobadas |
| `reproduccion-service` | Todos los paquetes Go aprobados |

Los totales pueden aumentar cuando se agreguen funcionalidades; lo importante es que ninguna suite termine con fallos.

## 8. Prueba SQL opcional

La prueba SQL del catálogo es una prueba de contrato separada y sí requiere una base PostgreSQL de prueba:

```bash
cd Backend/services/catalog-service
TEST_DATABASE_URL=postgresql://yousac:yousac_secret@localhost:5433/yousac_catalogo \
  npm run test:db
```

No es necesaria para ejecutar las suites unitarias anteriores.

## 9. Integración continua

El workflow `.github/workflows/unit-tests.yml` ejecuta:

1. Los seis paquetes de la matriz TypeScript, cada uno con sus suites Jest.
2. Las pruebas Go de reproducción.
3. Las pruebas Pytest de analítica.
4. Los builds únicamente después de que todas las pruebas hayan finalizado correctamente.

Se ejecuta en `push` hacia `main` o `develop`, y en pull requests cuyo destino sea `main` o `develop`. Por lo tanto, un push únicamente a una rama `feature/*` no lo activa por sí solo; el pull request hacia `develop` sí lo ejecuta.

Cualquier comando de pruebas que termine con un código diferente de cero bloquea las etapas posteriores del pipeline.

## 10. Solución de problemas

- **`jest` no se reconoce:** ejecutar `npm.cmd --prefix <paquete> ci` desde la raíz.
- **PowerShell bloquea `npm.ps1`:** utilizar `npm.cmd`, como muestran los ejemplos.
- **No existe `.venv`:** repetir la preparación de Python de la sección 2.
- **Falla la activación del entorno virtual:** no es obligatorio activarlo; se puede llamar directamente a `.venv/Scripts/python.exe`.
- **Go descarga módulos durante la primera prueba:** es normal; `go mod download` permite hacerlo previamente.
- **Aparecen mensajes `console.error` en notificaciones:** algunos casos prueban deliberadamente fallos SMTP y pueden escribir el error esperado aunque la suite termine aprobada.
- **Pytest muestra una advertencia de Protobuf:** actualmente no hace fallar la suite; debe revisarse cuando se regeneren los contratos protobuf.
- **`npm audit` reporta vulnerabilidades:** es un reporte de dependencias y no implica por sí solo que las pruebas hayan fallado. No ejecutar `npm audit fix --force` sin revisar los cambios incompatibles que podría introducir.
