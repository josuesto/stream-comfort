# Stream Comfort

Extensión para Chrome que automatiza controles de reproducción de Crunchyroll. Popup sencillo, opciones independientes y preferencias locales. Primera versión: reproductor web actual de Crunchyroll con controles en español; HBO/Max queda pendiente.

## Qué puedes activar

| Opción | Comportamiento | Estado inicial |
| --- | --- | --- |
| Activar extensión | Enciende o apaga la automatización conservando las opciones elegidas. | Activada |
| Saltar intros | Activa el botón visible y reconocido «Saltar intro». | Activada |
| Saltar resúmenes | Reservada para un control real de resumen aún no verificado. | Preferencia activada, función deshabilitada |
| Saltar créditos | Usa «Siguiente episodio» solo cuando también aparece la señal explícita «Saltar créditos». Puede omitir escenas finales. | Desactivada |
| Siguiente episodio | Usa el control normal de siguiente episodio cuando el vídeo ha terminado realmente. | Desactivada |
| Saltar episodios elegidos | Lista para elegir episodios concretos; no implementada en esta versión. | No disponible |

Encender la extensión no activa el avance de episodios ni restablece tus preferencias. «Siguiente episodio» y «Saltar episodios elegidos» son funciones distintas.

## Instalar el build

Necesitas Chrome 120 o posterior.

1. Descomprime el ZIP de la entrega en una carpeta que puedas conservar.
2. Abre `chrome://extensions` en Chrome y activa **Modo de desarrollador**.
3. Pulsa **Cargar descomprimida** y selecciona la carpeta `dist`, que contiene `manifest.json`.
4. Fija **Stream Comfort** desde el menú de extensiones si quieres tener el popup a mano.
5. Recarga las páginas de Crunchyroll que ya estuvieran abiertas antes de instalarla.

El ZIP no se instala directamente y no necesitas Chrome Web Store. Conserva la carpeta cargada: Chrome utiliza sus archivos. Tras sustituir el build, pulsa **Actualizar** en la tarjeta de la extensión y recarga Crunchyroll.

## Usarla

Abre un episodio en `https://www.crunchyroll.com`, inicia sesión por tu cuenta si el servicio lo solicita y abre el popup. El estado indica si el reproductor es compatible. Activa las opciones que quieras; los cambios se guardan en este dispositivo y se aplican a las pestañas de Crunchyroll.

**Pausar en esta pestaña** suspende todas las acciones de la extensión en esa pestaña, conservando tus opciones. La pausa continúa al recargar la página o cambiar de episodio. Termina al reanudarla, cerrar la pestaña o reiniciar Chrome; recargar o desactivar la extensión también reinicia su sesión temporal.

Una pausa o búsqueda manual en el reproductor suspende la automatización del episodio actual. El popup lo explica y ofrece **Reanudar en esta pestaña**. Cambiar de episodio también libera esta suspensión manual. Reanudar no enciende el interruptor global si lo habías apagado. Los controles manuales de salto tienen prioridad sobre la extensión.

Crunchyroll tiene su propia opción **Reproducir siguiente**. La extensión no la cambia: si deseas detenerte al terminar un episodio, desactiva también esa opción en el reproductor del servicio.

## Compatibilidad y límites

- Solo se ha inspeccionado la variante actual del reproductor en español de España, dentro del documento principal. Las variantes antiguas con iframe y otros idiomas no están admitidas. Un control desconocido se deja sin activar.
- Cada episodio debe ofrecer un control real de salto. La extensión no estima dónde empieza o termina el contenido, no asigna `currentTime` y no usa tiempos arbitrarios.
- El avance exige que el botón normal de siguiente episodio esté visible y habilitado. La extensión no fuerza controles ocultos ni supone que su mera presencia indique créditos.
- Los resúmenes permanecen deshabilitados hasta obtener evidencia del control real. No hay soporte de HBO/Max en esta entrega.
- Solo automatiza una pestaña mientras su documento está visible; no avanza silenciosamente desde pestañas en segundo plano.
- Evita intentos duplicados y descarta controles de una navegación anterior. Si no puede confirmar que el reproductor ya corresponde al nuevo episodio, espera sin hacer clic. El registro de intentos es temporal y limitado; una recarga inicia una sesión nueva.
- No omite anuncios ni modifica DRM, suscripciones o restricciones regionales. No está afiliada a Crunchyroll.

Si el popup muestra una página no compatible, abre un episodio de Crunchyroll y recarga la página si acabas de instalar o actualizar la extensión. Si una opción no tiene un control compatible, no se ejecutará aunque su preferencia esté guardada.

## Lista de episodios: alcance separado

Durante la inspección se encontraron identificadores de episodios actual/siguiente y números en los elementos cargados de la página. Eso no garantiza una lista completa ni una secuencia estable entre temporadas, idiomas o doblajes. Por eso esta versión no permite seleccionar episodios para omitir: podría avanzar al episodio incorrecto.

Un prototipo posterior deberá ser voluntario, usar identificadores estables y declarar la temporada y el idioma de la lista. Necesitará comprobar la secuencia antes de avanzar. No se inferirán episodios de relleno ni se saltarán episodios por números ambiguos.

## Privacidad y permisos

El único permiso de API solicitado es `storage`. El script se ejecuta exclusivamente en `https://www.crunchyroll.com/*`; no se solicitan permisos para HBO/Max, acceso general a todas las páginas ni el permiso `tabs`.

Las preferencias se guardan en `chrome.storage.local` y las pausas de pestaña en `chrome.storage.session`. Los identificadores necesarios para evitar repeticiones permanecen temporalmente en memoria. No hay backend, telemetría, sincronización remota, exportación de datos ni guardado de historial o contenido de páginas. Todo el código, los estilos y los iconos vienen incluidos en la extensión.

## Compilar y verificar

Desde la carpeta del código fuente, con Node.js 22.12 o posterior y npm instalados:

```sh
npm ci
npm run check
```

`check` ejecuta la comprobación de TypeScript, las pruebas y la compilación. El resultado cargable está en `dist/`. También puedes ejecutar por separado `npm run typecheck`, `npm test` y `npm run build`.

La estructura mantiene separados los ajustes y tipos (`src/shared`), el motor de automatización (`src/core`), el adaptador de Crunchyroll (`src/services`), el worker (`src/background.ts`), el script de página (`src/content.ts`) y el popup (`src/popup`). Los nuevos servicios deben aportar su propio adaptador y evidencia, sin ampliar permisos hasta incorporarlos.

## Qué se ha verificado

**En el servicio real:** se inspeccionaron controles y señales del reproductor en Chrome el 7 de septiembre de 2026. Se pulsó el botón real «Saltar intro» y se observó el salto. También se observaron «Saltar créditos», el botón permanente de siguiente episodio y la opción nativa «Reproducir siguiente».

**Con fixtures y pruebas automatizadas:** pasaron 99 pruebas, TypeScript y la compilación. Se comprueban detección, controles ocultos o ambiguos, ajustes, prevención de duplicados, navegación de episodios, mensajes y controles del popup. El final de vídeo se simula en las pruebas. Los fixtures conservan la estructura relevante observada y excluyen datos de cuenta y fuentes de vídeo. Consulta el [informe de verificación](docs/VERIFICATION.md).

**Pendiente:** una ejecución completa con la extensión instalada sobre Crunchyroll, incluyendo el salto automático, el final natural, pantalla completa y cambios de episodio. Observar un control real y probar el código con fixtures no equivale a verificar esa ejecución completa. No se ha verificado un control de resumen.

Consulta la [procedencia de los fixtures](fixtures/README.md), el [alcance y criterios de aceptación](docs/RELEASE.md), la [lista de pruebas manuales](docs/MANUAL-TESTS.md) y el [backlog](docs/BACKLOG.md).
