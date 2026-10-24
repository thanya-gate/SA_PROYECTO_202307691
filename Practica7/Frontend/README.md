# Academix Pass & CertiHub — Frontend de Práctica 7

Frontend independiente de YOUSAC para el catálogo de eventos académicos,
reservas simuladas y verificación pública de credenciales.

## Desarrollo local

```bash
npm install
npm run dev
```

La aplicación se abre normalmente en `http://localhost:3000`.

## Contratos mock

La app usa adaptadores locales en `lib/mock-api.ts`. No necesita backend,
variables de entorno ni conexión directa con RabbitMQ.

Rutas públicas:

- `/` — catálogo de eventos.
- `/evento?eventId=evt-soa` — detalle de evento.
- `/reservar?eventId=evt-soa` — solicitud de reserva.
- `/reservas?reservationId=RSV-2026-000184` — consulta de reserva.
- `/verificar?identifier=CERT-2026-000742` — verificación de credencial.

Escenarios documentados:

- Catálogo vacío: `/?scenario=empty`.
- Error de catálogo: `/?scenario=error`.
- Evento sin cupo: `/evento?eventId=evt-cert`.
- Evento inexistente: `/evento?eventId=evento-no-existe`.
- Reserva pendiente: `RSV-2026-000184`.
- Reserva confirmada con ticket: `RSV-2026-000185`.
- Reserva rechazada: `RSV-2026-000186`.
- Reserva sin cupo: `RSV-2026-000187`.
- Reserva inexistente: `RSV-NO-ENCONTRADA`.
- Error de reserva: `RSV-ERROR`.
- Credencial válida: `CERT-2026-000742`.
- Credencial inválida: `CERT-INVALIDA-2026`.
- Credencial no encontrada: cualquier identificador válido no registrado.
- Error de credencial: `CERT-ERROR`.

Para probar estados alternativos de una nueva reserva, usa estos correos de
prueba en el formulario:

- `duplicado@demo.test` — solicitud duplicada.
- `prerrequisito@demo.test` — reserva rechazada por prerrequisito.
- `error@demo.test` — indisponibilidad del servicio.

## Verificación

```bash
npm test
npm run typecheck
npm run build
```

El build está configurado como exportación estática de Next.js y produce la
carpeta `out/`.

## Configuración para Vercel

Crear el proyecto usando `Practica7/Frontend` como **Root Directory**. Vercel
detectará Next.js y ejecutará `npm run build`. No se requieren variables de
entorno. Después del despliegue se deben revisar las rutas `/`, `/reservas` y
`/verificar`, además de los enlaces con parámetros de consulta.
