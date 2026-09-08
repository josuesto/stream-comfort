# Stream Comfort

Extensión para Chrome con controles independientes de comodidad y preferencias locales. El objetivo es cubrir más plataformas de streaming de forma gradual. La versión 0.3.1 se concentra en los reproductores web en español de Crunchyroll y HBO Max.

La versión 0.3.1 corrige el parpadeo del popup: mantiene su tamaño y solo actualiza la interfaz cuando cambia el estado.

## Qué puedes activar

| Opción | Crunchyroll | HBO Max | Inicialmente |
| --- | --- | --- | --- |
| Saltar intros | Botón «Saltar intro» | Botón «Omitir intro» | Activada |
| Saltar resúmenes | El reproductor inspeccionado no ofrece ese control | Botón «Omitir resumen» | Preferencia activada; disponible solo en HBO |
| Saltar créditos | Requiere «Saltar créditos» y el botón siguiente visibles | Usa la oferta nativa «Siguiente episodio» de los créditos | Desactivada |
| Siguiente episodio | Al terminar realmente el vídeo, si queda visible el botón siguiente | Al terminar realmente el vídeo, si queda visible la oferta siguiente | Desactivada |
| Saltar episodios elegidos | Lista de hasta 100 enlaces de episodios elegidos por ti | Sin control siguiente durante todo el episodio; alcance separado | Desactivada |

La extensión no calcula dónde termina una intro ni utiliza tiempos de contenido inventados. Activa controles reales, visibles y reconocidos. Saltar créditos puede omitir escenas finales.

**Activar extensión** conserva tus elecciones al apagar y encender. **Plataformas** permite encender o apagar cada servicio por separado. Ninguno de esos interruptores activa las opciones de avance. **Pausar en esta pestaña** suspende la automatización de esa pestaña hasta que la reanudes, cierres la pestaña o reinicies Chrome.

## Instalación y actualización

Necesitas Chrome 120 o posterior.

1. Descomprime el ZIP en una carpeta que puedas conservar.
2. Abre chrome://extensions y activa **Modo de desarrollador**.
3. Pulsa **Cargar descomprimida** y selecciona la carpeta **dist**, que contiene manifest.json.
4. Fija **Stream Comfort** en el menú de extensiones si quieres acceder fácilmente al popup.
5. Recarga las páginas de los servicios que estaban abiertas antes de instalarla.

Si ya está instalada desde esta carpeta, pulsa **Recargar** en su tarjeta y recarga las páginas de streaming. La tarjeta debe mostrar **0.3.1**. No la desinstales: desinstalar elimina los ajustes. La actualización conserva las elecciones existentes y añade la lista de episodios desactivada.

El ZIP no se instala directamente. Chrome utiliza los archivos de la carpeta dist; consérvala en su ubicación.

## Uso

Abre un episodio en [Crunchyroll](https://www.crunchyroll.com) o [HBO Max](https://play.hbomax.com), inicia sesión personalmente si hace falta y abre el popup. El encabezado identifica la plataforma actual. Cada acción tiene su propio interruptor; las funciones que el reproductor no permite se explican junto a su control deshabilitado.

Pulsa **Plataformas** para habilitar cada servicio; **Volver** regresa a sus opciones. Para ejecutar una acción deben estar activados la extensión, la plataforma y la acción, sin pausa de pestaña ni suspensión manual. Los cambios se aplican sin recargar.

Una pausa, búsqueda, salto manual o cancelación de la cuenta atrás de HBO suspende la automatización de ese episodio. Usa **Reanudar en esta pestaña** para continuar; pasar a un nuevo episodio también libera la suspensión manual. La pausa explícita de pestaña, en cambio, continúa al navegar o recargar. Cambiar volumen o entrar en pantalla completa no suspende por sí solo la automatización.

**Última acción** muestra el último control que la extensión intentó activar durante esta sesión del documento. No es un historial guardado ni una confirmación de que el servicio completó la navegación.

El avance propio del servicio es independiente. Apagar **Siguiente episodio** en la extensión no desactiva el autoplay de Crunchyroll o HBO Max. Si quieres detenerte al terminar, revisa también sus ajustes nativos. HBO muestra una cuenta atrás durante los créditos; cancelarla permite verlos, pero su reproducción automática puede continuar al final real del episodio. [Ayuda de HBO Max](https://help.hbomax.com/us-en/Answer/Detail/000002541).

## Elegir episodios de Crunchyroll

1. Abre el popup en un episodio de Crunchyroll y pulsa **Elegir episodios**.
2. Pega enlaces públicos de episodios, uno por línea, o pulsa **Añadir episodio actual**. Se aceptan hasta 100; las entradas repetidas se unifican.
3. Guarda la lista y activa por separado **Saltar episodios elegidos**. Guardar conserva el interruptor; vaciar la lista lo desactiva.
4. Cuando reproduzcas uno de esos episodios, la extensión pulsará el botón normal **Siguiente episodio**, si está visible y habilitado. Los episodios que no figuran en la lista no se omiten.

Se guarda el identificador exacto del enlace, sin parámetros ni historial. No se deduce el orden de temporada, no se clasifican episodios de relleno y no se adivinan equivalencias entre doblajes. El servicio decide a qué episodio lleva su botón siguiente. Si no lo expone o está oculto, la extensión espera.

La lista de HBO se mantiene fuera de alcance: el reproductor inspeccionado no ofrece un botón permanente de siguiente episodio; su panel carga una parte de la temporada. Automatizar el siguiente elemento visible del catálogo podría saltar al contenido equivocado. Sus créditos y su avance al finalizar sí usan la oferta nativa observada.

## Compatibilidad y privacidad

- Reproductor actual de Crunchyroll en español de España y HBO Max en español latinoamericano, en el documento principal. No se anuncian otros idiomas, iframes o plataformas como verificados.
- Los controles pueden faltar en ciertos episodios. Crunchyroll explica que su función Skip Intro no cubre resúmenes; no se observó un control de resumen en la sesión inspeccionada. [Ayuda de Crunchyroll](https://help.crunchyroll.com/article/what-is-the-skip-intro-feature).
- El avance exige un control visible y habilitado. El final se identifica por el estado real del vídeo, nunca por cercanía a su duración. El autoplay nativo puede actuar antes.
- La extensión solo automatiza documentos visibles. Descarta controles ambiguos, ocultos o anteriores a una navegación.
- Cada avance consume un único intento y bloquea otras acciones del episodio anterior. El registro de intentos mantiene como máximo 64 episodios en memoria; recargar el documento inicia uno nuevo.
- No se omiten anuncios ni se modifica DRM, suscripciones o restricciones regionales. El botón promocional genérico «Saltar» de HBO se ignora.
- Único permiso de API: **storage**. Solo se ejecutan scripts en www.crunchyroll.com y play.hbomax.com. No hay permiso general de navegación ni acceso a todas las páginas.
- Ajustes y listas elegidas en chrome.storage.local; pausa temporal en chrome.storage.session. No hay backend, telemetría, sincronización remota ni recopilación de historial. Los identificadores que elijas sí se conservan como preferencias.
- No está afiliada a los servicios.

## Código, build y verificación

Desde la carpeta del código, con Node.js 22.12 o posterior, ejecuta **npm ci** y después **npm run check**. Este comando comprueba TypeScript, ejecuta las pruebas y compila el build cargable en **dist/**. También están disponibles **npm test**, **npm run typecheck** y **npm run build**.

La estructura separa tipos, ajustes e identidad de episodios en src/shared; automatización en src/core; adaptadores en src/services; worker y script de página en src; popup en src/popup. Cada nuevo servicio requiere evidencia propia y permisos mínimos.

La versión 0.3.1 pasa **246 pruebas en nueve suites**. Se verificaron controles reales de ambos servicios y la navegación manual del botón siguiente de HBO. También se probó el popup compilado con una API de Chrome simulada. Esto no equivale a una ejecución completa de 0.3.1 instalada: la lista de pruebas reales sigue siendo necesaria.

Consulta el [informe de verificación](docs/VERIFICATION.md), los [criterios de aceptación](docs/RELEASE.md), la [lista manual](docs/MANUAL-TESTS.md), la [arquitectura de Chrome](docs/CHROME-ARCHITECTURE.md) y el [backlog](docs/BACKLOG.md).
