# Stream Comfort

Extensión para Chrome que automatiza los controles reales de las plataformas de streaming. Popup sencillo, interruptores independientes por plataforma y preferencias locales. El objetivo a largo plazo es ampliar la cobertura a todas las plataformas que permitan una integración fiable. Por ahora el desarrollo y la verificación se concentran en Crunchyroll y HBO Max, los dos servicios disponibles para probar. La compatibilidad actual se limita a los reproductores y controles en español inspeccionados; una función sin evidencia permanece deshabilitada.

## Qué puedes activar

| Opción | Comportamiento | Estado inicial |
| --- | --- | --- |
| Activar extensión | Enciende o apaga la automatización conservando las opciones elegidas. | Activada |
| Plataformas | Abre los interruptores independientes de Crunchyroll y HBO Max. | Ambas activadas |
| Saltar intros | Activa «Saltar intro» en Crunchyroll u «Omitir intro» en HBO Max cuando el control está visible y reconocido. | Activada en ambas |
| Saltar resúmenes | Activa «Omitir resumen» en HBO Max. El control de Crunchyroll todavía no está verificado. | Preferencia activada; función disponible solo en HBO Max |
| Saltar créditos | En Crunchyroll, usa «Siguiente episodio» solo cuando también aparece la señal explícita «Saltar créditos». Puede omitir escenas finales. | Desactivada; no disponible en HBO Max |
| Siguiente episodio | En Crunchyroll, usa el control normal de siguiente episodio cuando el vídeo ha terminado realmente. | Desactivada; no disponible en HBO Max |
| Saltar episodios elegidos | Lista para elegir episodios concretos; no implementada en esta versión. | No disponible |

Encender la extensión o una plataforma conserva todas tus elecciones: no activa el avance de episodios ni restablece las opciones de salto. Los cambios de HBO Max no modifican Crunchyroll, ni a la inversa. «Siguiente episodio» y «Saltar episodios elegidos» son funciones distintas.

## Instalar el build

Necesitas Chrome 120 o posterior.

1. Descomprime el ZIP de la entrega en una carpeta que puedas conservar.
2. Abre `chrome://extensions` en Chrome y activa **Modo de desarrollador**.
3. Pulsa **Cargar descomprimida** y selecciona la carpeta `dist`, que contiene `manifest.json`.
4. Fija **Stream Comfort** desde el menú de extensiones si quieres tener el popup a mano.
5. Recarga las páginas de Crunchyroll y HBO Max que ya estuvieran abiertas antes de instalarla.

El ZIP no se instala directamente y no necesitas Chrome Web Store. Conserva la carpeta cargada: Chrome utiliza sus archivos. Para actualizar, sustituye el contenido de `dist` en la misma carpeta que ya cargaste, pulsa el botón de recarga de la tarjeta de la extensión y recarga las páginas de los servicios. No la desinstales para actualizar: desinstalar elimina los ajustes. La versión 0.2 añade acceso exclusivamente a `play.hbomax.com`, que Chrome puede pedirte que revises. Se conservan tus preferencias de Crunchyroll; HBO Max se incorpora con los valores iniciales de la tabla.

## Usarla

Abre un episodio en [Crunchyroll](https://www.crunchyroll.com) o [HBO Max](https://play.hbomax.com), inicia sesión por tu cuenta si el servicio lo solicita y abre el popup. El encabezado identifica la plataforma de la pestaña actual y sus interruptores muestran únicamente las opciones de esa plataforma. Las funciones sin soporte aparecen deshabilitadas con su explicación.

Pulsa **Plataformas** para activar o apagar Crunchyroll y HBO Max por separado; pulsa **Volver** para regresar a los controles de salto. Apagar una plataforma suspende la automatización en todas sus pestañas y conserva sus preferencias. El estado **Plataforma desactivada** explica cómo reactivarla. Puedes cambiar estos dos interruptores incluso desde una página no compatible.

**Activar extensión** es el interruptor global. Para automatizar una acción deben estar encendidos el interruptor global, el de su plataforma y el de esa acción; la pestaña también debe estar sin pausa y el reproductor debe ofrecer un control compatible. Los cambios se guardan en este dispositivo y se aplican a las pestañas de la plataforma correspondiente. No necesitas recargar la página al cambiar preferencias.

**Pausar en esta pestaña** suspende todas las acciones de la extensión en esa pestaña, conservando tus opciones. La pausa continúa al recargar la página o cambiar de episodio. Termina al reanudarla, cerrar la pestaña o reiniciar Chrome; recargar o desactivar la extensión también reinicia su sesión temporal.

Una pausa o búsqueda manual en el reproductor suspende la automatización del episodio actual. El popup lo explica y ofrece **Reanudar en esta pestaña**. Cambiar de episodio también libera esta suspensión manual. Reanudar no enciende el interruptor global ni el de la plataforma si los habías apagado. Los controles manuales de salto tienen prioridad sobre la extensión.

El avance automático propio de cada servicio se controla en su reproductor o configuración; la extensión no lo cambia. En Crunchyroll se observó la opción **Reproducir siguiente**. Si deseas detenerte al terminar un episodio, revisa también el avance nativo del servicio: apagar la extensión no lo detiene.

## Compatibilidad y límites

- Se inspeccionaron el reproductor actual de Crunchyroll en español de España (`es-es`) y el de HBO Max en español latinoamericano (`es-419`), ambos dentro del documento principal. Las variantes antiguas con iframe y otros idiomas no están verificadas. Un control desconocido se deja sin activar.
- Cada episodio debe ofrecer un control real de salto. La extensión no estima dónde empieza o termina el contenido, no asigna `currentTime` y no usa tiempos arbitrarios.
- El avance exige que el botón normal de siguiente episodio esté visible y habilitado. La extensión no fuerza controles ocultos ni supone que su mera presencia indique créditos.
- En HBO Max se admiten los controles exactos «Omitir intro» y «Omitir resumen». El botón genérico «Saltar» observado durante una promoción se ignora. Los créditos y el siguiente episodio de HBO Max permanecen deshabilitados hasta verificar sus señales y controles reales.
- Los resúmenes de Crunchyroll permanecen deshabilitados hasta obtener evidencia del control real.
- Solo automatiza una pestaña mientras su documento está visible; no avanza silenciosamente desde pestañas en segundo plano.
- Evita intentos duplicados y descarta controles de una navegación anterior. Si no puede confirmar que el reproductor ya corresponde al nuevo episodio, espera sin hacer clic. El registro de intentos es temporal y limitado; una recarga inicia una sesión nueva.
- No omite anuncios ni modifica DRM, suscripciones o restricciones regionales. No está afiliada a Crunchyroll ni a HBO Max.

Si el popup muestra una página no compatible, abre un episodio de Crunchyroll o HBO Max y recarga la página si acabas de instalar o actualizar la extensión. Si una opción no tiene un control compatible, no se ejecutará aunque su preferencia esté guardada.

## Lista de episodios: alcance separado

Durante la inspección de Crunchyroll se encontraron identificadores de episodios actual/siguiente y números en los elementos cargados de la página. En HBO Max se usa el identificador de la ruta del episodio para descartar controles anteriores; no se ha verificado una secuencia de episodios. Nada de ello garantiza una lista completa ni una secuencia estable entre temporadas, idiomas o doblajes. Por eso esta versión no permite seleccionar episodios para omitir: podría avanzar al episodio incorrecto.

Un prototipo posterior deberá ser voluntario, usar identificadores estables y declarar la temporada y el idioma de la lista. Necesitará comprobar la secuencia antes de avanzar. No se inferirán episodios de relleno ni se saltarán episodios por números ambiguos.

## Privacidad y permisos

El único permiso de API solicitado es `storage`. El script se ejecuta exclusivamente en `https://www.crunchyroll.com/*` y `https://play.hbomax.com/*`; no se solicita acceso general a todas las páginas ni el permiso `tabs`. Los interruptores de **Plataformas** controlan la automatización; no cambian los permisos de sitios que Chrome concede a la extensión.

Las preferencias se guardan en `chrome.storage.local` y las pausas de pestaña en `chrome.storage.session`. Los identificadores necesarios para evitar repeticiones permanecen temporalmente en memoria. No hay backend, telemetría, sincronización remota, exportación de datos ni guardado de historial o contenido de páginas. Todo el código, los estilos y los iconos vienen incluidos en la extensión.

## Compilar y verificar

Desde la carpeta del código fuente, con Node.js 22.12 o posterior y npm instalados:

```sh
npm ci
npm run check
```

`check` ejecuta la comprobación de TypeScript, las pruebas y la compilación. El resultado cargable está en `dist/`. También puedes ejecutar por separado `npm run typecheck`, `npm test` y `npm run build`.

La estructura mantiene separados los ajustes y tipos (`src/shared`), el motor de automatización (`src/core`), los adaptadores y controles manuales de cada servicio (`src/services`), el worker (`src/background.ts`), el script de página (`src/content.ts`) y el popup (`src/popup`). Los nuevos servicios deben aportar su propio adaptador y evidencia, sin ampliar permisos hasta incorporarlos.

## Qué se ha verificado

**En los servicios reales:** se inspeccionaron controles y señales en Chrome el 7 de septiembre de 2026. En Crunchyroll se pulsó «Saltar intro» y se observó el salto; también se observaron «Saltar créditos», el botón permanente de siguiente episodio y la opción nativa «Reproducir siguiente». En HBO Max se observaron «Omitir resumen» y «Omitir intro», y se activó manualmente este último para confirmar el salto del servicio.

**Con fixtures y pruebas automatizadas:** se comprueban detección, controles ocultos o ambiguos, ajustes independientes por plataforma, prevención de duplicados, navegación de episodios, mensajes y controles del popup, incluido el panel **Plataformas**. El final de vídeo se simula en las pruebas. Los fixtures conservan la estructura relevante observada y excluyen datos de cuenta y fuentes de vídeo. El [informe de verificación](docs/VERIFICATION.md) registra los resultados del build y las pruebas de esta entrega.

**Pendiente:** una ejecución completa con la extensión instalada sobre ambos servicios, incluyendo los saltos automáticos, pantalla completa y cambios de episodio; el final natural y el avance se deben comprobar en Crunchyroll. Observar un control real y probar el código con fixtures no equivale a verificar esa ejecución completa. No se han verificado los resúmenes de Crunchyroll ni los créditos o el avance de HBO Max.

Consulta la [procedencia de los fixtures](fixtures/README.md), el [alcance y criterios de aceptación](docs/RELEASE.md), la [lista de pruebas manuales](docs/MANUAL-TESTS.md) y el [backlog](docs/BACKLOG.md).
