# Informe de verificación 0.2.0

Fecha: 7 de septiembre de 2026.

## Resultado del código y build

`npm run check` completó TypeScript, 206 pruebas en ocho suites y la compilación MV3. La corrección posterior del texto de intro de HBO y la etiqueta de versión pasó las 21 pruebas del popup y se recompiló. No hay dependencias de ejecución remotas.

| Suite | Pruebas | Cobertura principal |
| --- | ---: | --- |
| Ajustes | 20 | Valores iniciales, validación, migración desde 0.1, preservación de elecciones e independencia por plataforma |
| Worker | 18 | Emisores permitidos de ambos servicios, escritura serializada, switches de plataformas, pausa por pestaña, errores de almacenamiento |
| Adaptador Crunchyroll | 19 | Fixture observado, etiquetas exactas, créditos explícitos, final real simulado, controles ambiguos, idioma |
| Adaptador HBO Max | 55 | Etiquetas reales, promociones ignoradas, visibilidad y menús, controles ambiguos, UUID, idioma y controles desconectados |
| Motor | 43 | Duplicados, controles ocultos, avance compartido, interacción manual, navegación, carga del vídeo y bloqueo por plataforma antes del clic |
| Popup | 21 | Panel Plataformas, servicio actual, toggles independientes, funciones no admitidas, errores, pausa/reanudación |
| Script de contenido Crunchyroll | 15 | Bootstrap, carreras de ajustes/pausa, input manual, eventos y navegación SPA |
| Script de contenido HBO Max | 15 | Resumen e intro en el mismo botón, preferencias del servicio, desactivación inmediata, navegación y controles manuales |

Se mantienen las regresiones de inicialización de 0.1: una lectura antigua no puede reemplazar ajustes o pausas recientes; el input manual previo a cargar ajustes se recuerda. La revisión de 0.2 cubre la reutilización del botón entre resumen e intro, la desactivación de plataforma incluso justo antes del clic, la preservación de preferencias y el orden entre cambio de ruta y eventos de carga.

## Inspección real de Crunchyroll

Se inspeccionó el reproductor actual en español, sin APIs privadas ni selectores supuestos. Se observó y activó manualmente «Saltar intro», confirmando el cambio de posición realizado por el propio servicio. Se observó el aviso «Saltar créditos», el botón permanente «Siguiente episodio» y el switch nativo «Reproducir siguiente». Se activó manualmente el botón normal de siguiente episodio y se comprobó que la URL cambió al siguiente identificador.

La extensión no estuvo instalada durante esas acciones. Estas observaciones validan los controles y las señales que fundamentan el adaptador; no acreditan por sí mismas un salto automático realizado por la extensión.

## Inspección real de HBO Max

Se inspeccionó el reproductor actual de `play.hbomax.com` en español latinoamericano (`es-419`) en una sesión de Chrome ya autenticada. Se observaron el botón genérico «Saltar» durante una promoción y los controles «Omitir resumen» y «Omitir intro». Se activó manualmente «Omitir intro» y se comprobó el salto realizado por el propio servicio. El botón mantiene su texto al ocultarse, por lo que la visibilidad de sus ancestros forma parte de la detección.

La etiqueta de resumen y su estado visible se observaron; no se presenta como una prueba completa de salto automático. El contenedor `up_next` observado estaba vacío y oculto. No se logró verificar una oferta activa y segura de avance al final: créditos y siguiente episodio permanecen no disponibles en HBO Max. No se implementaron selectores para esas acciones por suposición. La [evidencia de HBO](../fixtures/hbomax/README.md) describe el fixture reducido y sus variaciones sintéticas.

## Popup en navegador

Se abrió el popup compilado en una página local de prueba con una API de Chrome simulada. En 0.2 se revisó HBO activo a 350 × 595 píxeles y el panel Plataformas a 350 × 307 píxeles, sin desbordamiento horizontal. Se apagó solo HBO y se comprobó «Plataforma desactivada», con intro y resumen conservados. Al cambiar el contexto simulado a Crunchyroll, siguió activo con sus opciones independientes y el avance apagado. Las funciones no admitidas aparecieron deshabilitadas. Esta prueba verifica presentación y comportamiento del popup, no el alojamiento nativo del popup en Chrome.

## Pendiente de validación con extensión instalada

La lista [MANUAL-TESTS.md](MANUAL-TESTS.md) permanece sin marcar: instalación, ejecución automática en ambos servicios, final natural de Crunchyroll, fullscreen, pausa tras suspensión real del worker y navegación completa. No se verificaron resúmenes de Crunchyroll, avance de HBO Max, variantes antiguas del reproductor ni etiquetas en otros idiomas. `video.ended`, estados de carga y variaciones de DOM se simularon en las pruebas.

La entrega es un prerelease con detección conservadora y pruebas de regresión. No se presenta como compatibilidad universal ni como una ejecución completa validada en producción. Si Crunchyroll mantiene oculto el botón siguiente, las opciones de avance no lo fuerzan. El avance nativo de cada servicio sigue siendo independiente.
