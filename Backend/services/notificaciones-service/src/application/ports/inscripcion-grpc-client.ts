export interface InscripcionGrpcClient {
  listarEstudiantesDeCurso(cursoId: string, semestre: string): Promise<string[]>;
}
