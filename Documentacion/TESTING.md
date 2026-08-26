# Pruebas

Las pruebas se ejecutan por paquete:

```bash
cd Backend/services/catalog-service
npm test -- --runInBand
```

Verifica capítulos, rangos de tiempo, materiales, repositorio y contrato gRPC.

```bash
cd Backend/api-gateway
npm test -- --runInBand
```

Verifica autenticación, roles, MIME, extensiones, nombres, límite de 50 MB, subida, versionado, eliminación y limpieza de archivos.

```bash
cd Frontend
npm test -- --runInBand
```

Verifica duración de videos, validación local de capítulos, ordenamiento, navegación y subida de materiales.

Para revisar cobertura, sustituir `test` por:

```bash
npm run test:coverage -- --runInBand
```

El contrato SQL se ejecuta contra una base PostgreSQL de prueba:

```bash
cd Backend/services/catalog-service
TEST_DATABASE_URL=postgresql://yousac:yousac_secret@localhost:5433/yousac_catalogo \
npm run test:db
```

Actualmente las suites automatizadas están escritas en TypeScript/TSX; la prueba SQL valida directamente los procedimientos y restricciones de PostgreSQL.
