# Version 0.3.2: English and Spanish popup

This update adds a local Language selector with English as the default. Acceptance: all popup labels, statuses, errors, capability explanations, and editor text switch between English and Spanish; the choice persists; upgrading and switching preserve playback preferences, selected episode IDs, and manual pauses; the fixed-size, quiet idle popup remains intact. Tests and a compiled Chrome preview cover these criteria. Native installation checks remain listed separately.

The popup language is independent of the service player's locale. Service support and playback behavior remain scoped to the controls already observed below.

## Playback scope retained from 0.3.1

La versión añade la oferta nativa de siguiente episodio de HBO a dos opciones distintas: créditos y final real. Implementa una lista explícita de episodios de Crunchyroll sin inferir una secuencia de catálogo. Conserva los interruptores global, de plataforma y de cada acción.

## Criterios de aceptación

1. Solo activar controles reconocidos, visibles y habilitados del reproductor actual. Intro, resumen, créditos, final y lista tienen preferencias independientes.
2. Todas las opciones que cambian de episodio están apagadas inicialmente. Créditos necesita la señal explícita del servicio; final necesita que el vídeo haya terminado; selección necesita coincidencia exacta con una lista elegida.
3. Como máximo un intento de avance por episodio mientras esté en el registro de 64 episodios del documento. Tras solicitar avance no se activan otros controles del episodio anterior. Revalidar ajustes, control, vídeo e identidad justo antes del clic.
4. Pausa, búsqueda, salto y cancelación manual tienen prioridad. Pausa explícita de pestaña conservada en navegación y recargas. Preferencias conservadas al apagar y encender.
5. Navegación SPA, eventos de nueva carga y reemplazo de vídeo descartan controles antiguos. La URL nueva por sí sola no libera controles del vídeo anterior.
6. Popup accesible con panel Plataformas, funciones sin soporte explicadas, lista editable, pausa y última acción. Ningún overlay.
7. Listas de hasta 100 IDs locales, sin historial ni APIs privadas. Enlaces inválidos rechazan la lista entera; vaciarla apaga su interruptor. No se activa al migrar desde versiones anteriores.
8. Build MV3, fuente completa, pruebas y documentación que distinguen fixtures de ejecución real.

Los criterios de lógica están cubiertos por las pruebas. Los casos de ejecución instalada que faltan están identificados en VERIFICATION.md; no se presentan como aprobados.

## Evidencia y límites

Se inspeccionaron los reproductores reales antes de implementar selectores. HBO reutiliza player-ux-skip-button para «Omitir intro», «Omitir resumen» y «Saltar» promocional; solo los dos primeros se automatizan. Su oferta up_next contiene player-ux-up-next-container, player-ux-up-next-button y player-ux-up-next-label. Se observó el nombre accesible con cuenta atrás y el estado con autoplay apagado. Se pulsó la oferta activa y se confirmó el cambio de episodio.

La [ayuda oficial de HBO](https://help.hbomax.com/us/Answer/Detail/000002541) identifica esa oferta como aviso de créditos. El adaptador no usa los dígitos del contador para decidir tiempos. El mismo control puede usarse al final real si el servicio lo mantiene visible; su autoplay propio puede adelantarse.

Crunchyroll dispone de un botón permanente de siguiente episodio. Permite omitir un ID que el usuario haya seleccionado sin inferir qué episodio viene después. HBO no presenta ese control durante todo el episodio y el panel observado carga solo parte de una temporada: su lista se mantiene separada. Crunchyroll no expuso un control de resumen; la [ayuda oficial](https://help.crunchyroll.com/article/what-is-the-skip-intro-feature) indica que Skip Intro no cubre resúmenes.

Solo se anuncian las variantes de reproductor y etiquetas españolas observadas. No se alteran anuncios, DRM ni controles de acceso. El avance nativo de cada plataforma sigue siendo independiente.
