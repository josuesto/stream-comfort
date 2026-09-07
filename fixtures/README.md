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

Recap no observado. No se incluye un selector ni un fixture que simule soporte de resumen. El estado `video.ended` se simula en pruebas; el comportamiento completo de extensión instalada al terminar queda en la lista manual.

Los fixtures de error, navegación, ambigüedad, vídeo pausado, ocultación y controles deshabilitados son variaciones sintéticas para probar guardas. No son capturas de otros servicios ni prueba de compatibilidad con otras variantes del reproductor.
