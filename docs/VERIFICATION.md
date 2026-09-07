# Informe de verificación 0.1.0

Fecha: 7 de septiembre de 2026.

## Resultado del código y build

`npm run check` completó TypeScript, 99 pruebas en seis suites y la compilación MV3.

| Suite | Pruebas | Cobertura principal |
| --- | ---: | --- |
| Ajustes | 12 | Valores iniciales, validación, versiones desconocidas, preservación de elecciones |
| Worker | 13 | Emisores permitidos, escritura serializada, pausa por pestaña, errores de almacenamiento |
| Adaptador Crunchyroll | 19 | Fixture observado, etiquetas exactas, créditos explícitos, final real simulado, controles ambiguos, idioma |
| Motor | 33 | Duplicados, controles ocultos, avance compartido, interacción manual, navegación y carga del vídeo |
| Popup | 7 | Toggles, funciones no admitidas, conservación de elecciones, errores, pausa/reanudación |
| Script de contenido | 15 | Bootstrap, carreras de ajustes/pausa, input manual, eventos y navegación SPA |

La revisión encontró y corrigió carreras de inicialización: una lectura antigua podía reemplazar un ajuste o pausa más reciente; el input manual previo a cargar ajustes no se recordaba. También se cubrió la activación de controles mediante teclado y el orden entre cambio de ruta y eventos de carga.

## Inspección real de Crunchyroll

Se inspeccionó el reproductor actual en español, sin APIs privadas ni selectores supuestos. Se observó y activó manualmente «Saltar intro», confirmando el cambio de posición realizado por el propio servicio. Se observó el aviso «Saltar créditos», el botón permanente «Siguiente episodio» y el switch nativo «Reproducir siguiente». Se activó manualmente el botón normal de siguiente episodio y se comprobó que la URL cambió al siguiente identificador.

La extensión no estuvo instalada durante esas acciones. Estas observaciones validan los controles y las señales que fundamentan el adaptador; no acreditan por sí mismas un salto automático realizado por la extensión.

## Popup en navegador

Se abrió el popup compilado en una página local de prueba con una API de Chrome simulada. Se revisó el diseño a 350 × 578 píxeles en estado activo y se accionaron intro, interruptor global y pausa de pestaña. Las elecciones independientes sobrevivieron a apagar/encender; las funciones no admitidas aparecieron deshabilitadas. Esta prueba verifica presentación y comportamiento del popup, no el alojamiento nativo del popup en Chrome.

## Pendiente de validación con extensión instalada

La lista [MANUAL-TESTS.md](MANUAL-TESTS.md) permanece sin marcar: instalación, ejecución automática en servicio, final natural, fullscreen, pausa tras suspensión real del worker y navegación completa. No se verificaron resúmenes, HBO/Max, variantes antiguas del reproductor ni etiquetas en otros idiomas. `video.ended`, estados de carga y variaciones de DOM se simularon en las pruebas.

La entrega es una primera versión con detección conservadora y pruebas de regresión. No se presenta como compatibilidad universal ni como una ejecución completa validada en producción. Si Crunchyroll mantiene oculto el botón siguiente, las opciones de avance no lo fuerzan. El avance nativo del servicio sigue siendo independiente.
