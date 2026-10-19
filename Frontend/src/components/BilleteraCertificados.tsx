import { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import { academixApi, type CertificadoAcademix } from '../api/academix';
import { Button } from './ui/Button';

export function descargarCertificado(c: CertificadoAcademix): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const ancho = doc.internal.pageSize.getWidth();
  doc.setFontSize(28);
  doc.text('Certificado de participación', ancho / 2, 120, { align: 'center' });
  doc.setFontSize(14);
  doc.text('Academix Pass & CertiHub certifica que', ancho / 2, 180, { align: 'center' });
  doc.setFontSize(22);
  doc.text(c.titular, ancho / 2, 220, { align: 'center' });
  doc.setFontSize(14);
  doc.text(`participó en: ${c.titulo}`, ancho / 2, 260, { align: 'center' });
  doc.text(`Emitido el ${new Date(c.emitidoEn).toLocaleDateString('es-GT')}`, ancho / 2, 290, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`Código de autenticidad: ${c.codigo}`, ancho / 2, 360, { align: 'center' });
  doc.text(`Estado de verificación: ${c.estadoTexto}`, ancho / 2, 380, { align: 'center' });
  doc.save(`certificado-${c.codigo}.pdf`);
}

// Billetera universitaria: credenciales emitidas por CertiHub al estudiante.
export function BilleteraCertificados({ token }: { token: string }) {
  const [certificados, setCertificados] = useState<CertificadoAcademix[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    academixApi
      .certificados(token)
      .then((res) => active && setCertificados(res.credenciales ?? []))
      .catch((err: unknown) => active && setError(err instanceof Error ? err.message : 'CertiHub no disponible'));
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <section className="perfil__form" aria-label="Mis certificados">
      <header className="perfil__contenido-header">
        <h2 className="perfil__titulo">Mis certificados</h2>
        <p className="perfil__subtitulo">Diplomas y constancias emitidos por CertiHub al asistir a talleres de Academix Pass.</p>
      </header>
      {error ? (
        <p className="catalogo__estado">{error}</p>
      ) : certificados === null ? (
        <p className="catalogo__estado" role="status">Cargando certificados…</p>
      ) : certificados.length === 0 ? (
        <p className="catalogo__estado">Aún no tienes certificados. Reserva un taller desde la vista de una clase.</p>
      ) : (
        <ul className="talleres">
          {certificados.map((c) => (
            <li key={c.codigo} className="talleres__item">
              <strong>{c.titulo}</strong>
              <span className="talleres__meta">
                Código {c.codigo} · {new Date(c.emitidoEn).toLocaleDateString('es-GT')}
              </span>
              <span className={`talleres__estado${c.estadoTexto === 'VALIDA' ? ' talleres__estado--ok' : ''}`}>
                {c.estadoTexto === 'VALIDA' ? 'Verificado' : 'No válido'}
              </span>
              <Button type="button" variant="secondary" onClick={() => descargarCertificado(c)}>
                Descargar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
