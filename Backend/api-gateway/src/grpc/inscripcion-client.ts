import path from 'path';
import fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { config } from '../config/env';
import { GrpcError } from './auth-client';

function resolveProtoPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'proto', 'inscripcion.proto'),
    path.resolve(process.cwd(), '..', 'proto', 'inscripcion.proto'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`No se encontró el contrato gRPC inscripcion.proto. Buscado en: ${candidates.join(', ')}`);
  }
  return found;
}

function createClient(): any {
  const packageDefinition = protoLoader.loadSync(resolveProtoPath(), {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const inscripcionProto = grpc.loadPackageDefinition(packageDefinition) as any;
  const InscripcionService = inscripcionProto.yousac.inscripcion.v1.InscripcionService;
  return new InscripcionService(config.INSCRIPCION_GRPC_ADDR, grpc.credentials.createInsecure());
}

function unary(method: string, req: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    client[method](req, (err: grpc.ServiceError | null, res: any) => {
      if (err) {
        reject(new GrpcError(err.code, err.message));
      } else {
        resolve(res);
      }
    });
  });
}

const client = createClient();

export const inscripcionGrpc = {
  health: () => unary('Health', {}),

  registrarCurso: (req: { codigo: string; nombre: string; escuela: string; semestre: string; anio: number }) =>
    unary('RegistrarCurso', req),
  registrarDocente: (usuarioId: string) => unary('RegistrarDocente', { usuarioId }),
  registrarAuxiliar: (usuarioId: string) => unary('RegistrarAuxiliar', { usuarioId }),

  inscribirEstudiante: (req: { estudianteId: string; cursoId: string; semestre: string }) =>
    unary('InscribirEstudiante', req),
  asignarCatedraticoCurso: (req: { docenteId: string; cursoId: string; semestre: string }) =>
    unary('AsignarCatedraticoCurso', req),
  asignarAuxiliarCatedratico: (req: { auxiliarId: string; asignacionDocenteId: string }) =>
    unary('AsignarAuxiliarCatedratico', req),

  consultarPanelEstudiante: (estudianteId: string) => unary('ConsultarPanelEstudiante', { estudianteId }),
  consultarCursosCatedratico: (catedraticoUsuarioId: string) =>
    unary('ConsultarCursosCatedratico', { catedraticoUsuarioId }),
  consultarEstadoMatricula: (estudianteId: string, cursoId: string) =>
    unary('ConsultarEstadoMatricula', { estudianteId, cursoId }),

  listarCursos: () => unary('ListarCursos', {}),
  listarDocentes: () => unary('ListarDocentes', {}),
  listarAuxiliares: () => unary('ListarAuxiliares', {}),
  listarAsignaciones: () => unary('ListarAsignaciones', {}),
  eliminarDocente: (docenteId: string) => unary('EliminarDocente', { docenteId }),
};
