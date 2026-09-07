# Evidencia de HBO Max

Inspección real en Chrome, 7 de septiembre de 2026. `www.hbomax.com` redirigió a `https://play.hbomax.com`. Interfaz `lang="es-419"`. El reproductor reside en el documento principal.

Se observaron `playerContainer`, el vídeo `VideoElement` y el grupo `overlay-root` con `aria-label="video player"`. El botón `player-ux-skip-button` cambia su etiqueta y texto según la acción:

* `Saltar`: observado durante una promoción previa. Se ignora en la extensión.
* `Omitir resumen`: observado en el resumen del episodio. Comparte el botón con la intro.
* `Omitir intro`: observado y activado manualmente; el servicio adelantó la reproducción al final de la intro.

El contenedor `data-testid="skip"` alterna `visibility: visible` y `visibility: hidden`. El texto anterior puede permanecer montado cuando el control ya está oculto. La visibilidad es necesaria; una etiqueta oculta no prueba un segmento activo.

El fixture conserva jerarquía, etiquetas y data-testid relevantes. El estado de resumen en las pruebas cambia etiqueta y texto a los valores reales observados. Se omiten clases visuales, rutas SVG, identificadores de episodios reales, títulos, cuentas, fuentes de vídeo y scripts del sitio. Los estados de ambigüedad, menús, vídeo pausado, final y navegación son variaciones sintéticas de prueba.

Los controles de reproducción duplicados para distintas disposiciones también se observaron en el DOM. El detector no usa unicidad de esos botones para identificar al reproductor; exige unicidad del vídeo, grupo y botón de salto.

La inspección del servicio no equivale a verificar una ejecución de la extensión instalada.
