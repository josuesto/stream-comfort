# Procedencia de los fixtures

Esta página documenta Crunchyroll. La [evidencia de HBO Max](hbomax/README.md) y su fixture están separados por servicio.

Inspección directa del reproductor web de Crunchyroll, Chrome, 7 de septiembre de 2026, interfaz es-es. No se consultaron APIs internas.

`player-es.html` conserva la jerarquía relevante, tipos de elementos, data-testid, etiquetas ARIA y texto observados. Se eliminaron clases visuales innecesarias, rutas SVG, fuentes de vídeo, título del episodio y datos de cuenta. El rango del fixture es sintético y no representa tiempos de contenido.

Estados reales observados:

* Sin salto: el mismo botón permanece montado con texto vacío o anterior, `aria-hidden="true"`, `tabindex="-1"` y opacidad cero. El icono no identifica por sí solo el tipo de salto.
* Intro: `aria-label="Saltar intro"`, texto `Saltar intro`, `aria-hidden="false"`. Se activó manualmente el control real y se observó el salto de reproducción. Esto verifica el control, no la ejecución de la extensión instalada.
* Créditos: el mismo botón cambia a `Saltar créditos` en etiqueta y texto. La prueba deriva este estado cambiando solo esos dos valores del fixture.
* Siguiente episodio: `button[data-testid="next-episode-button"]`, etiqueta `Siguiente episodio`. Está presente también durante el contenido normal. Los controles inferiores se ocultan con opacidad cero en un ancestro.
* Reproducción automática del servicio: menú con switch `Reproducir siguiente`. La extensión no lo modifica.

## Resumen: evidencia nueva del 8 de septiembre de 2026

Se inspeccionó otro episodio con un resumen en el reproductor real de Crunchyroll, Chrome, interfaz `es` y ruta `es-es`. El botón nativo usa `aria-label="Saltar resumen"` y texto `Saltar resumen`, dentro de `[data-testid="player-controls-root"]` y `#player-container`. Reutiliza el SVG con `data-testid="skip-intro-icon"`.

Se observaron ambos estados: visible con `aria-hidden="false"`, `tabindex="0"` y opacidad 1; oculto con el mismo texto, `aria-hidden="true"`, `tabindex="-1"` y opacidad 0. En esta sesión se ocultaba junto con los controles. Mostrar los controles mediante el teclado permitió activar el botón por su nombre accesible. El clic nativo movió la reproducción aproximadamente de 1:21 a 1:56 dentro del mismo episodio. Estos tiempos documentan el resultado manual y nunca se usan en la implementación.

`player-recap-es.html` conserva la jerarquía relevante y el botón visible observado. Se omiten clases, rutas SVG, fuentes de vídeo, títulos, identificadores de contenido y datos de cuenta. Los rangos y estados multimedia de prueba son sintéticos.

El [artículo oficial](https://help.crunchyroll.com/article/what-is-the-skip-intro-feature), consultado el mismo día, aún decía que no había salto de resúmenes. La nueva evidencia directa justifica el soporte del control observado, sin extrapolarlo a otros idiomas, episodios o variantes. La falta de un botón de resumen en la inspección inicial del 7 de septiembre no demostraba que toda la plataforma careciera de él.

El clic del control real se verificó manualmente, no con la nueva extensión instalada. La detección y automatización nuevas se prueban con fixtures. El estado `video.ended` sigue simulado; los finales naturales y la matriz completa instalada permanecen en la lista manual.

Los fixtures de error, navegación, ambigüedad, vídeo pausado, ocultación y controles deshabilitados son variaciones sintéticas para probar guardas. No son capturas de otros servicios ni prueba de compatibilidad con otras variantes del reproductor.
