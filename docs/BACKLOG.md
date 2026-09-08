# Backlog breve

El objetivo a largo plazo es ofrecer controles de comodidad en todas las plataformas de streaming donde sea posible verificar una integración fiable. La prioridad actual es cerrar la verificación con la extensión instalada en Crunchyroll y HBO Max, los dos servicios disponibles para probar. Otros servicios se añadirán de forma gradual cuando haya acceso a sus reproductores reales o fixtures representativos; no se anuncian como compatibles ni se solicitan sus permisos por adelantado.

| Prioridad | Trabajo | Condición para incorporarlo |
| --- | --- | --- |
| 1 | Completar la ejecución instalada de Crunchyroll y HBO Max | Ejecutar y registrar la lista manual, especialmente final natural, controles visibles, pantalla completa, navegación y desactivación por plataforma. |
| 2 | Créditos y siguiente episodio en HBO Max | Observar y probar el control real de avance y una señal explícita de créditos. El contenedor vacío `up_next` observado no basta. Mantener ambos interruptores deshabilitados hasta obtener evidencia. |
| 3 | Resúmenes de Crunchyroll | Observar un control real de resumen y sus estados visible/oculto; añadir pruebas antes de habilitar el interruptor. No reutilizar el icono de intro como prueba. |
| 4 | Otros idiomas y variantes del reproductor | Obtener evidencia por variante, incluir fixtures y comprobar que controles desconocidos siguen sin activarse. Los iframes necesitan un análisis de permisos y mensajería propio. |
| 5 | Lista de episodios elegidos | Prototipo separado, desactivado inicialmente, basado en identificadores estables y temporada/idioma declarados. Validar la secuencia completa y detenerse ante elementos ambiguos o incompletos. Sin inferir relleno. |
| 6 | Explicaciones de estado más precisas | Mejorar mensajes locales cuando falta un control, está oculto o una variante no es compatible, sin overlays ni registro del historial. |
| 7 | Ampliar la cobertura de plataformas | Incorporar un servicio a la vez con acceso de prueba o fixtures representativos, controles verificados y sus permisos mínimos. Mantener la arquitectura de adaptadores compartiendo motor y preferencias. |

No se planifican saltos basados en tiempos estimados, listas automáticas de relleno, modificación de anuncios o DRM, ni sincronización de contenido de reproducción con un servidor.
