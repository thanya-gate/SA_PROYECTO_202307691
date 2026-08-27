# Pruebas unitarias

El repositorio mantiene pruebas unitarias independientes para cada servicio backend y para el frontend. Las suites usan dobles de prueba y no requieren PostgreSQL, Redis, SMTP, GCS, servicios gRPC externos ni Docker.

## TypeScript

Ejecutar desde el directorio de cada paquete:

```bash
cd Backend/services/auth-service
npm test -- --runInBand
npm run test:coverage -- --runInBand

cd ../catalog-service
npm test -- --runInBand
npm run test:coverage -- --runInBand

cd ../inscripcion-service
npm test -- --runInBand
npm run test:coverage -- --runInBand

cd ../notificaciones-service
npm test -- --runInBand
npm run test:coverage -- --runInBand

cd ../../api-gateway
npm test -- --runInBand
npm run test:coverage -- --runInBand

cd ../../Frontend
npm test -- --runInBand
npm run test:coverage -- --runInBand
```

Las suites cubren autenticación, sesiones, JWT, OAuth mock, perfiles, roles y permisos; catálogo de cursos, capítulos, materiales y versionado; inscripciones y asignaciones; notificaciones, plantillas, cola y reintentos; gateway, carga de archivos y errores HTTP; además de las validaciones de navegación y materiales del frontend.

## Go

```bash
cd Backend/services/reproduccion-service
go test ./... -v
go test ./... -coverprofile=coverage.out
```

La suite usa repositorios falsos y cubre validación de checkpoints, progreso, calificaciones, historial, delegación y mapeo de códigos gRPC.

## Python

Se soportan Python 3.11, 3.12 y 3.14. El archivo `requirements.txt` selecciona automáticamente versiones con wheels compatibles con Python 3.14 para evitar compilación local de `grpcio` y `psycopg2-binary`:

```bash
cd Backend/services/analitica-service
python3 -m venv .venv
source .venv/bin/activate
pip3 install -r requirements.txt
python3 -m pytest -v
python3 -m pytest --cov=src/analitica
deactivate
```

Las pruebas usan repositorios y cachés falsos para límites, fechas, TTL, recomendaciones, rankings, invalidación, sincronización y errores gRPC.

## Integración SQL fuera del alcance unitario

La suite SQL existente se conserva como prueba de contrato y requiere una base PostgreSQL de prueba:

```bash
cd Backend/services/catalog-service
TEST_DATABASE_URL=postgresql://yousac:yousac_secret@localhost:5433/yousac_catalogo \
npm run test:db
```

Esta prueba no es requisito para ejecutar las suites unitarias. La meta aproximada es mantener al menos 90% de cobertura en validaciones, RBAC y manejo de errores nuevos; la cobertura total se interpreta junto con los límites propios de cada paquete.

## CI

El flujo `.github/workflows/unit-tests.yml` ejecuta primero todas las suites unitarias de TypeScript, Go y Python. Los builds se ejecutan únicamente cuando todas las pruebas terminan correctamente; cualquier fallo detiene el pipeline.
