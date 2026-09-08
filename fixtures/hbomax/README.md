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


## Oferta siguiente observada en la continuación de 0.3

Se observó up_next visible con player-ux-up-next-container, el botón player-ux-up-next-dismiss («Cancelar reproducción automática»), player-ux-up-next-button y el texto player-ux-up-next-label («Siguiente episodio»). El nombre accesible del botón incluye una cuenta atrás cambiante. Se capturó el estado con 12 segundos, y se volvió a observar y pulsar con 11 segundos; la ruta cambió al UUID del siguiente episodio.

up-next-es.html conserva esa jerarquía y atributos, sin títulos, UUID, contenido audiovisual ni datos de cuenta. El número T1 E6 es la etiqueta de episodio observada, no una regla usada para inferir secuencias. El contador solo se reconoce como parte de la etiqueta; sus dígitos no definen cuándo avanzar.

Después de cancelar se observó mediante el árbol de accesibilidad la etiqueta «Reproducir siguiente episodio, La reproducción automática está apagada». Después se capturó el DOM con el autoplay de episodios desactivado en los ajustes nativos. up-next-off-es.html conserva esa variante observada, sin botón de cancelar y con el icono de reproducción. El estado ended y los casos de controles duplicados/ocultos son sintéticos; no se capturó en vivo una oferta estable junto al final real del vídeo.

El panel de episodios observado cargaba solo una parte de la temporada. No se extrajeron listas de cuenta ni se implementaron selectores para adivinar el próximo elemento de ese panel.

La [documentación de HBO](https://help.hbomax.com/us/Answer/Detail/000002541) sitúa la oferta siguiente en el inicio de créditos. [Su explicación de cancelación](https://help.hbomax.com/us-en/Answer/Detail/000002541) aclara que el avance nativo puede continuar al final del episodio después de cancelar la cuenta atrás.

Al dejar terminar el vídeo con autoplay nativo apagado, HBO retiró el reproductor y regresó al catálogo. El script atiende ended antes de los handlers del elemento; la retirada del reproductor y el orden del evento tienen regresiones de contenido. La ejecución instalada completa de esa corrección aún no está certificada.
