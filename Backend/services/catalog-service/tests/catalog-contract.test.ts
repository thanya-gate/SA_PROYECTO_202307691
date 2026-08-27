import fs from 'fs';
import path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { mapError } from '../src/interfaces/grpc/server';
import { DomainError } from '../src/domain/errors/domain-error';

describe('contrato gRPC de capítulos y materiales', () => {
  test('expone los RPC y campos principales del proto real', () => {
    const protoPath = path.resolve(__dirname, '../../../proto/catalogo.proto');
    expect(fs.existsSync(protoPath)).toBe(true);
    const definition = protoLoader.loadSync(protoPath, {
      keepCase: false,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const loaded = grpc.loadPackageDefinition(definition) as any;
    const service = loaded.yousac.catalogo.v1.CatalogoService.service;
    expect(Object.keys(service)).toEqual(expect.arrayContaining([
      'ListarCapitulos',
      'CrearCapitulo',
      'ActualizarCapitulo',
      'EliminarCapitulo',
      'RegistrarMaterial',
      'AgregarVersionMaterial',
      'RegistrarDescargaMaterial',
    ]));
    expect(Object.keys(definition)).toEqual(expect.arrayContaining([
      'yousac.catalogo.v1.Capitulo',
      'yousac.catalogo.v1.MaterialAdjunto',
      'yousac.catalogo.v1.CrearCapituloRequest',
      'yousac.catalogo.v1.RegistrarMaterialRequest',
    ]));
  });

  test.each([
    [new DomainError('ENTRADA_INVALIDA', 'dato inválido', 400), grpc.status.INVALID_ARGUMENT],
    [new DomainError('CAPITULO_NO_ENCONTRADO', 'no existe', 404), grpc.status.NOT_FOUND],
    [new DomainError('CONFLICTO', 'solapamiento', 409), grpc.status.ALREADY_EXISTS],
  ])('traduce errores de dominio a status gRPC', (error, status) => {
    expect(mapError(error).code).toBe(status);
  });
});
