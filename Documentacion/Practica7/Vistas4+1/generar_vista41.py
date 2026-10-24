"""Regenera el montaje 4+1 a partir de los cinco SVG principales de Práctica 7.

Los diagramas fuente se renderizan sin cambiar su contenido. El SVG final y el
archivo draw.io incluyen las cinco vistas como imágenes incrustadas, por lo que
pueden abrirse sin depender de rutas externas. Para editar cada vista en detalle,
se conservan sus archivos draw.io individuales.
"""

from __future__ import annotations

import base64
import re
import shutil
import subprocess
import tempfile
import time
from pathlib import Path


HERE = Path(__file__).resolve().parent
PRACTICE = HERE.parent
SOURCES = {
    "logical": HERE / "VistaLogica_DiagramaSecuencia_P7_G4.drawio.svg",
    "components": HERE / "VistaDespliegue_Practica7_G4.drawio.svg",
    "scenarios": PRACTICE / "CDU" / "CDU_AltoNivel_P7_202307691.drawio.svg",
    "process": HERE / "VistaProcesos_DiagramaActividades_P7_G4.drawio.svg",
    "physical": HERE / "VistaFisica_Practica7_G4.drawio.svg",
}
POSITIONS = {
    "logical": (60, 340, 1500, 1200),
    "components": (2370, 350, 1500, 1086),
    "scenarios": (1510, 1670, 980, 484),
    "process": (60, 2230, 1650, 1495),
    "physical": (2160, 2260, 1750, 1000),
}
SVG_OUTPUT = HERE / "Vista4+1_Practica7_G4.drawio.svg"
DRAWIO_OUTPUT = HERE / "XML" / "Vista4+1_Practica7_G4.drawio"


def chrome_executable() -> str:
    for candidate in (
        shutil.which("chrome"),
        shutil.which("google-chrome"),
        shutil.which("chromium"),
        shutil.which("msedge"),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    ):
        if candidate and Path(candidate).is_file():
            return str(candidate)
    raise RuntimeError("Se requiere Chrome, Chromium o Edge para renderizar los SVG fuente")


def render_png(browser: str, source: Path, target: Path, profile: Path) -> bytes:
    if not source.is_file():
        raise FileNotFoundError(source)
    content = source.read_text(encoding="utf-8")
    tag = re.search(r"<svg\b[^>]*>", content, re.S)
    if not tag:
        raise ValueError(f"SVG sin etiqueta raíz: {source}")
    width = re.search(r'\bwidth="(\d+)', tag.group())
    height = re.search(r'\bheight="(\d+)', tag.group())
    if not width or not height:
        raise ValueError(f"SVG sin tamaño explícito: {source}")
    page = target.with_suffix(".html")
    page.write_text(
        '<!doctype html><html><head><meta charset="utf-8"><style>'
        'html,body{margin:0;background:#121212;overflow:hidden}'
        'img{display:block}</style></head><body>'
        f'<img src="{source.as_uri()}" width="{width.group(1)}" '
        f'height="{height.group(1)}"></body></html>',
        encoding="utf-8",
    )
    command = [
        browser,
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--hide-scrollbars",
        f"--user-data-dir={profile}",
        f"--window-size={width.group(1)},{height.group(1)}",
        f"--screenshot={target}",
        page.as_uri(),
    ]
    subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=30)
    for _ in range(40):
        if target.is_file() and target.stat().st_size > 0:
            return target.read_bytes()
        time.sleep(0.25)
    raise RuntimeError(f"No se generó la vista previa de {source}")


def svg_document(images: dict[str, str]) -> str:
    out = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="3850" viewBox="0 0 4000 3850" role="img" aria-labelledby="title desc">',
        '<title id="title">Vista 4+1 · Práctica 7</title>',
        '<desc id="desc">Montaje de los diagramas principales de escenarios, lógica, componentes, procesos y despliegue físico.</desc>',
        '<defs><marker id="arrow" markerWidth="90" markerHeight="90" refX="78" refY="45" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L90 45 L0 90 Z" fill="#455966"/></marker></defs>',
        '<rect x="0" y="0" width="4000" height="3850" fill="#121212"/>',
        '<text x="2000" y="165" text-anchor="middle" fill="#FFFFFF" font-family="Arial,Helvetica,sans-serif" font-size="126" font-weight="700">VISTA 4+1</text>',
        '<text x="2000" y="218" text-anchor="middle" fill="#FFFFFF" font-family="Arial,Helvetica,sans-serif" font-size="31">YOUSAC Academix Pass &amp; CertiHub · Práctica 7</text>',
        '<rect x="1450" y="1560" width="1100" height="620" rx="285" fill="#2a2104" stroke="#765c18" stroke-width="3"/>',
        '<text x="2000" y="1630" text-anchor="middle" fill="#FFFFFF" font-family="Arial,Helvetica,sans-serif" font-size="42" font-weight="700">Vista +1: Caso de Uso</text>',
    ]
    for name, data in images.items():
        x, y, width, height = POSITIONS[name]
        out.append(
            f'<image x="{x}" y="{y}" width="{width}" height="{height}" '
            f'preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,{data}"/>'
        )
    for path in (
        "M1590 880 H2315",
        "M3120 1470 V2205",
        "M2105 2820 H1745",
        "M850 2185 V1600",
    ):
        out.append(
            f'<path d="{path}" fill="none" stroke="#455966" '
            'stroke-width="24" marker-end="url(#arrow)"/>'
        )
    out.append('</svg>')
    return "\n".join(out) + "\n"


def drawio_document(images: dict[str, str]) -> str:
    out = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<mxfile host="app.diagrams.net">',
        '  <diagram name="Vista 4+1 · Práctica 7" id="vista41-practica7-g4">',
        '    <mxGraphModel dx="4000" dy="3850" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="4000" pageHeight="3850" math="0" shadow="0" background="#121212">',
        '      <root>',
        '        <mxCell id="0"/><mxCell id="1" parent="0"/>',
        '        <mxCell id="bg" value="" style="rounded=0;fillColor=#121212;strokeColor=none;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="4000" height="3850" as="geometry"/></mxCell>',
        '        <mxCell id="title" value="VISTA 4+1" style="text;html=1;align=center;verticalAlign=middle;fontColor=#FFFFFF;fontSize=126;fontStyle=1;strokeColor=none;fillColor=none;" vertex="1" parent="1"><mxGeometry x="1400" y="50" width="1200" height="140" as="geometry"/></mxCell>',
        '        <mxCell id="subtitle" value="YOUSAC Academix Pass &amp; CertiHub · Práctica 7" style="text;html=1;align=center;verticalAlign=middle;fontColor=#FFFFFF;fontSize=31;strokeColor=none;fillColor=none;" vertex="1" parent="1"><mxGeometry x="1230" y="190" width="1540" height="60" as="geometry"/></mxCell>',
        '        <mxCell id="scenarioPanel" value="" style="ellipse;whiteSpace=wrap;html=1;fillColor=#2a2104;strokeColor=#765c18;strokeWidth=3;" vertex="1" parent="1"><mxGeometry x="1450" y="1560" width="1100" height="620" as="geometry"/></mxCell>',
        '        <mxCell id="scenarioTitle" value="Vista +1: Caso de Uso" style="text;html=1;align=center;verticalAlign=middle;fontColor=#FFFFFF;fontSize=42;fontStyle=1;strokeColor=none;fillColor=none;" vertex="1" parent="1"><mxGeometry x="1540" y="1585" width="920" height="80" as="geometry"/></mxCell>',
    ]
    for name, data in images.items():
        x, y, width, height = POSITIONS[name]
        out.append(
            f'        <mxCell id="image_{name}" value="" '
            f'style="shape=image;image=data:image/png,{data};imageAspect=0;aspect=fixed;" '
            f'vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" '
            f'width="{width}" height="{height}" as="geometry"/></mxCell>'
        )
    for index, (x1, y1, x2, y2) in enumerate(
        ((1590, 880, 2315, 880), (3120, 1470, 3120, 2205),
         (2105, 2820, 1745, 2820), (850, 2185, 850, 1600)),
        start=1,
    ):
        out.append(
            f'        <mxCell id="arrow{index}" value="" edge="1" parent="1" '
            'style="edgeStyle=none;html=1;strokeColor=#455966;strokeWidth=24;endArrow=block;endFill=1;">'
            f'<mxGeometry relative="1" as="geometry"><mxPoint x="{x1}" y="{y1}" as="sourcePoint"/>'
            f'<mxPoint x="{x2}" y="{y2}" as="targetPoint"/></mxGeometry></mxCell>'
        )
    out.extend(['      </root>', '    </mxGraphModel>', '  </diagram>', '</mxfile>'])
    return "\n".join(out) + "\n"


def main() -> None:
    browser = chrome_executable()
    with tempfile.TemporaryDirectory(prefix="practica7-vista41-") as temp:
        tempdir = Path(temp)
        images = {}
        for name, source in SOURCES.items():
            png = render_png(browser, source, tempdir / f"{name}.png", tempdir / f"profile-{name}")
            images[name] = base64.b64encode(png).decode("ascii")
            print(f"{name}: {source.name} ({len(png)} bytes PNG)")
    SVG_OUTPUT.write_text(svg_document(images), encoding="utf-8")
    DRAWIO_OUTPUT.write_text(drawio_document(images), encoding="utf-8")
    print(f"SVG: {SVG_OUTPUT}")
    print(f"Editable: {DRAWIO_OUTPUT}")


if __name__ == "__main__":
    main()
