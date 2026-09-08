# Verification report 0.3.2

Fecha: 7 de septiembre de 2026.

## Código y build

**npm run check** completó TypeScript, 260 pruebas en nueve suites y el build MV3. El manifiesto conserva la descripción inglesa y las mismas dos plataformas y permiso storage. Créditos, siguiente episodio y lista siguen apagados inicialmente.

| Suite | Pruebas | Cobertura |
| --- | ---: | --- |
| Ajustes | 22 | Defaults, validación, migración y preferencias independientes |
| Identidad y lista | 11 | Enlaces exactos, deduplicación, entradas inválidas, límites, migración y vaciado |
| Worker | 21 | Emisores, escrituras serializadas, listas, plataformas y pausa |
| Crunchyroll | 19 | Botones observados, señales de créditos, visibilidad, identidad y ambigüedad |
| HBO Max | 69 | Intro/resumen, oferta siguiente, etiquetas, autoplay apagado, menús y controles inseguros |
| Motor | 47 | Duplicados, prioridad de lista, avance compartido, controles anteriores, input manual y navegación |
| Popup | 36 | Plataformas, lista, errores, estados, pausa y editor durante navegación |
| Contenido Crunchyroll | 15 | Inicialización, carreras, eventos, interacción manual y SPA |
| Contenido HBO | 20 | Intro/resumen, créditos/final, cancelación nativa y preferencias |

La geometría de jsdom, el estado ended, los cambios de carga y el input trusted usado en los handlers se simulan. No se afirma que esas simulaciones sean ejecuciones de Chrome instalado.

## Controles observados en los servicios

**Crunchyroll:** se inspeccionó el reproductor en español. Se observó y pulsó «Saltar intro», confirmando el salto nativo. Se observaron «Saltar créditos», «Siguiente episodio» permanente y «Reproducir siguiente». Se pulsó manualmente siguiente y se confirmó el cambio de ID. En la investigación de 0.3 se volvió a observar el botón permanente y los enlaces públicos de episodio actual/siguiente. Las inspecciones no probaron todavía el clic automático de la lista nueva.

**HBO Max:** se observaron «Saltar» promocional, «Omitir resumen» y «Omitir intro», y se pulsó intro. El texto permanece montado cuando se oculta; por eso la detección comprueba ancestros. En la continuación se capturó la oferta nativa de créditos con nombre accesible «Reproducir siguiente episodio» y contador. Se pulsó manualmente cuando indicaba 11 segundos y se confirmó que la ruta pasó a otro UUID, con el título del siguiente episodio. El fixture reducido conserva sus atributos relevantes.

Se observó también el nombre accesible con autoplay apagado después de cancelar la cuenta atrás. No se capturó un estado estable de vídeo terminado junto a esa oferta; ese caso se cubre mediante fixture y estado ended simulado. La documentación de HBO explica que cancelar la cuenta atrás permite continuar hasta el final, tras lo cual su autoplay puede avanzar. No se interpreta como un fallo del servicio.

Se abrió el panel real de episodios de HBO: mostraba una parte de la temporada y no un botón siguiente permanente. No se añadió una deducción de secuencia basada en los elementos visibles.

## Extensión instalada: evidencia anterior

La captura del usuario confirma la instalación de 0.2.0. Después se observó un salto en HBO: el vídeo pasó de 90,69 a 209,19 segundos en 19,91 segundos reales, cruzando una intro previamente inspeccionada. Entre esas muestras no hubo clic manual de salto, búsqueda ni cambio de velocidad.

No se instrumentó el clic ni se aislaron otras automatizaciones de Chrome. Esa observación respalda la intro en aquella sesión, pero no verifica causalmente toda la extensión. El resumen no se aisló. No se extrapola esa comprobación a las nuevas acciones de 0.3.0.

## Popup compilado

Se revisó en Chrome con una API de Chrome simulada en una página local. En Crunchyroll se abrió el editor, se añadió el episodio representativo, se guardó la lista y se encendió su interruptor. Se comprobó que HBO conservó sus preferencias y mostró créditos/siguiente disponibles y lista deshabilitada con explicación. Se revisaron visualmente el panel principal y el editor. Ancho de contenido 350 píxeles, sin desbordamiento horizontal; el panel principal puede requerir desplazamiento vertical en el límite de 600 píxeles de Chrome.

Esto prueba presentación y comportamiento del popup compilado, no su alojamiento nativo ni la comunicación con el Chrome real.

## Continuación con 0.3.0 instalada

El usuario confirmó que recargó la extensión y que su tarjeta muestra 0.3.0. Se abrieron páginas nuevas para continuar las comprobaciones. La recarga fue manual porque la herramienta de navegador de esta sesión bloquea las páginas internas de Chrome.

Hasta ejecutar todos los casos, quedan pendientes las acciones nuevas con la extensión instalada, el final natural, fullscreen y la comprobación completa de pausa/navegación. Son pruebas pendientes de la lista manual, no funciones que se anuncien como verificadas en producción.

## Corrección del popup en 0.3.1

El usuario reportó que el popup parpadeaba o saltaba al pulsar el icono. Se encontró que cada sondeo reescribía texto y atributos aunque el estado fuera idéntico. Un test con el editor abierto detectó 240 mutaciones de DOM en diez segundos. Con la corrección registra cero; conserva foco, selección del texto y desplazamiento. Las pruebas existentes siguen comprobando que los cambios reales de estado y plataforma sí actualizan los controles. Se añadió una regresión que descarta una respuesta antigua de estado después de pausar, evitando mostrar un estado anterior.

El documento mantiene un tamaño de 350 × 600 píxeles con desplazamiento interior y espacio reservado para la barra. La medición en Chrome del popup compilado con API simulada confirma las mismas dimensiones antes y después de abrir Plataformas, sin desbordamiento horizontal. Chrome adapta automáticamente el popup a su contenido; el tamaño elegido respeta su límite documentado. [Documentación de chrome.action](https://developer.chrome.com/docs/extensions/reference/api/action).

La versión 0.3.1 incluyó 246 pruebas. El usuario confirmó después que el parpadeo había desaparecido. Esta confirmación del síntoma original no se extrapola a las comprobaciones de reproducción que siguen pendientes.

## Hallazgo al final real de HBO

Con el autoplay nativo de episodios temporalmente apagado, se dejó terminar un vídeo desde el control de posición real del servicio. HBO retiró el reproductor y volvió a la página de la serie. Esto invalida esperar a una comprobación diferida para usar su botón siguiente. El script ahora atiende el evento ended en captura, de forma síncrona, y revalida el estado real del vídeo y el control antes del clic. Dos regresiones comprueban el clic antes de retirar el reproductor y el rechazo de eventos ajenos o sin final real. La navegación automática instalada de este cambio continúa pendiente de comprobación completa.

También se capturó el DOM real de la oferta con autoplay apagado, sin botón de cancelar; está reducido en up-next-off-es.html y pasó las 69 pruebas del adaptador. El ajuste nativo de HBO se restauró a activado al interrumpirse la comprobación para corregir el popup.


## English and Spanish popup (0.3.2)

The popup defaults to English, including upgrades with no saved language. Its Language selector saves English or Spanish locally through the existing serialized, popup-only settings channel. Platform switches, action choices, selected episode IDs, and pauses are preserved. No permissions or playback selectors were added.

The nine suites now total 260 tests. Language coverage checks migration, invalid and inherited values, worker restart and concurrent writes, sender restrictions, popup reopening, editor drafts and validation errors, unsupported pages and player-locale explanations, failed saves, conflicting pending edits, and matching translation parameters. Both English and Spanish idle-popup regressions record zero DOM mutations over ten seconds while retaining editor focus, selection, and scroll.

The actual compiled popup was exercised in a local Chrome page with a simulated Chrome API: HBO controls in English and Spanish; the Platforms panel in both languages; reopening with the saved English choice; and the Crunchyroll editor retaining an invalid draft while its error switched languages. Measured document bounds stayed 350 × 600; body clientWidth and scrollWidth were both 335 in the checked English and Spanish panels, with no horizontal overflow.

This validates the compiled UI in Chrome plus the settings protocol in tests, not native extension storage through the toolbar popup. The user separately confirmed that the original popup stuttering stopped before this language change. The new installed language option still needs a reload and the short manual check below. No additional streaming-player languages or live playback scenarios were verified by this update.

## Resultado

Implementación y regresiones de 0.3.2 verificadas con fixtures basados en controles reales. Navegación manual de la oferta siguiente de HBO comprobada en vivo. Ejecución instalada completa aún sin certificar. La entrega permanece prerelease con esos límites explícitos.

Fuentes de comportamiento nativo: [HBO Max](https://help.hbomax.com/us-en/Answer/Detail/000002541), [Crunchyroll](https://help.crunchyroll.com/article/what-is-the-skip-intro-feature). Véase [MANUAL-TESTS.md](MANUAL-TESTS.md).
