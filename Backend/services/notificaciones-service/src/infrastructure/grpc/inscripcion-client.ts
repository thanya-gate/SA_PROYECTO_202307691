import { config } from '../../config/env';
import { InscripcionGrpcClient } from '../../application/ports/inscripcion-grpc-client';
import { createGrpcClient, unary } from './client';

export class InscripcionGrpcClientImpl implements InscripcionGrpcClient {
  private readonly client: any;

  constructor() {
    this.client = createGrpcClient({
      protoFile: 'inscripcion.proto',
      servicePath: ['yousac', 'inscripcion', 'v1'],
      serviceName: 'InscripcionService',
      address: config.INSCRIPCION_GRPC_ADDR,
    });
  }

  async listarEstudiantesDeCurso(cursoId: string, semestre: string): Promise<string[]> {
    const res = await unary(this.client, 'ListarEstudiantesDeCurso', {
      cursoId,
      semestre,
    });
    return res.estudianteIds ?? [];
  }

  async listarCursos(): Promise<Array<{ cursoId: string; codigo: string }>> {
    const res = await unary(this.client, 'ListarCursos', {});
    return (res.cursos ?? []).map((c: any) => ({ cursoId: c.cursoId, codigo: c.codigo }));
  }
}
