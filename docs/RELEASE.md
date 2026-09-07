# Versión 0.2: Crunchyroll y HBO Max

Objetivo: automatizar únicamente controles reales del reproductor web inspeccionado. La base 0.1 de Crunchyroll se amplía con intros y resúmenes de HBO Max, y un panel «Plataformas» para habilitar cada servicio por separado. Se conserva la separación entre motor compartido, registro de servicios y adaptadores.

## Criterios de aceptación

1. Intro y resumen tienen preferencias independientes. Solo se activa un control visible, habilitado y reconocido dentro del reproductor actual. Una función sin evidencia queda deshabilitada y explicada.
2. Saltar créditos y avanzar al terminar son opciones distintas, desactivadas inicialmente. Un botón permanente de siguiente episodio no identifica créditos. Se necesita una señal explícita del servicio para créditos; el final real del elemento de vídeo permite avanzar al terminar.
3. Interruptor global, botón «Plataformas» con switches independientes, ajustes del servicio de la pestaña actual, pausa temporal y estado de compatibilidad en un popup accesible, sin overlays. Apagar o encender no modifica las acciones guardadas. Ambas plataformas están habilitadas inicialmente, con créditos y siguiente episodio apagados.
4. Preferencias locales validadas. Pausa de pestaña conservada durante navegación y recargas, eliminada al cerrar la pestaña o reiniciar Chrome.
5. Como máximo un intento por acción y episodio mientras el identificador esté en el registro de los últimos 64 episodios con acciones, en memoria del documento. Créditos y siguiente episodio comparten límite de avance. Ningún clic sobre elementos desconectados, ocultos, ambiguos o correspondientes a otra navegación.
6. Interacción manual cancela acciones pendientes. Pausar o buscar manualmente inhibe la automatización durante ese episodio hasta reanudarla explícitamente desde el popup.
7. Cambios de episodio, navegación SPA y pantalla completa funcionan sin recargas adicionales. No se modifica currentTime ni se usan tiempos de contenido inventados.
8. Pruebas de detección, preferencias, duplicados y navegación. Compilación MV3 cargable en Chrome, instrucciones y separación explícita entre pruebas con fixtures y verificación real.

## Límites de plataforma y alcance

Los DOM de Crunchyroll y HBO Max no son APIs públicas estables. Solo se admiten las variantes inspeccionadas en español; otras variantes fallan sin hacer clic. El servicio decide qué episodios tienen controles de salto. HBO Max admite intro y resumen; créditos y siguiente episodio quedan deshabilitados hasta verificar sus controles. Crunchyroll admite intro, créditos y siguiente episodio, pero no resumen. No se omiten anuncios ni se alteran DRM, suscripciones o restricciones regionales. Desactivar el avance de esta extensión no desactiva la reproducción automática propia del servicio.

La lista de episodios se investiga por separado. Las rutas observadas contienen identificadores estables de vídeo y las páginas de catálogo muestran enlaces a episodios, pero no se ha validado una secuencia completa y fiable durante la reproducción. Números de episodio, doblajes y temporadas no bastan para inferirla. La versión no incluye una lista que pueda saltar episodios erróneos.

No hay telemetría, sincronización remota, APIs privadas, guardado de historial ni transmisión de contenido. Los identificadores usados para prevenir duplicados permanecen en memoria del documento y son limitados.

## Evidencia previa a selectores

Inspección real el 7 de septiembre de 2026, Chrome, Crunchyroll en español de España. El reproductor está en el documento principal, contenedor `#player-container`, controles `[data-testid="player-controls-root"]`, vídeo HTML y botón permanente `[data-testid="next-episode-button"]`. El botón de salto contiene `[data-testid="skip-intro-icon"]`; cuando no hay salto, permanece oculto con `aria-hidden="true"` y texto vacío. La presencia del icono por sí sola nunca autoriza un salto. Se recopilan los estados visibles antes de implementar sus detectores.

HBO Max se inspeccionó el mismo día en `play.hbomax.com`, idioma `es-419`. El reproductor principal usa `playerContainer`, vídeo `VideoElement` y grupo `overlay-root`. Su botón `player-ux-skip-button` se reutiliza para «Saltar» en promociones, «Omitir resumen» y «Omitir intro». Solo las dos últimas etiquetas, con texto y `aria-label` coincidentes y control visible, permiten actuar. El contenedor conserva texto al ocultarse con `visibility: hidden`. Los fixtures reducidos documentan estos estados sin datos de cuenta, fuentes de vídeo ni identificadores reales de episodios.
