# Pruebas manuales de la primera versión

Checklist pendiente de completar con la extensión instalada en Chrome y el reproductor admitido de Crunchyroll. Marca solo lo que ejecutes; anota versión de Chrome, idioma, resultado y si el control esperado estaba visible. No publiques datos de cuenta, cookies ni fuentes de vídeo.

Para separar el comportamiento del servicio y el de la extensión, desactiva primero **Reproducir siguiente** en Crunchyroll. Mantén inicialmente desactivados **Saltar créditos** y **Siguiente episodio** en la extensión.

- [ ] **Instalación:** cargar `dist` descomprimida en Chrome 120+. La tarjeta de la extensión, el worker y el popup no muestran errores de manifiesto, JavaScript o CSP.
- [ ] **Página no compatible:** abrir el popup fuera de Crunchyroll y en una página de catálogo sin reproductor. Debe explicar el estado, deshabilitar las acciones de página y permitir cambiar el interruptor global.
- [ ] **Preferencias:** cambiar intro y avance, apagar y volver a encender la extensión. Debe conservar cada elección; cerrar/reabrir Chrome debe conservarlas también. Resúmenes y lista de episodios deben seguir identificados como no disponibles.
- [ ] **Intro activada:** reproducir normalmente un episodio con «Saltar intro». Debe activar una vez el botón real, sin overlays ni saltos repetidos. No se debe estimar un punto final de intro.
- [ ] **Intro desactivada:** en una nueva reproducción, desactivar intros antes de su control. No debe producirse un clic de la extensión. Si buscas manualmente para preparar la prueba, usa después **Reanudar en esta pestaña**.
- [ ] **Créditos:** confirmar primero que con la opción desactivada no avanza. Activarla, reproducir y comprobar que solo usa «Siguiente episodio» cuando aparece «Saltar créditos» y ambos controles necesarios son visibles. El botón siguiente permanente durante el contenido no debe bastar. Esta prueba puede omitir escenas finales.
- [ ] **Final natural:** con créditos desactivados, activar **Siguiente episodio** y dejar terminar el vídeo sin buscar manualmente. Con un siguiente episodio y su control visible, debe avanzar una sola vez. Repetir con esa opción apagada y el avance nativo del servicio apagado: la extensión no debe avanzar.
- [ ] **Sin siguiente episodio/control oculto:** comprobar que no fuerza la navegación si falta el botón siguiente, está oculto o está deshabilitado. Registrar los casos en que la interfaz del servicio impide el avance.
- [ ] **Control manual:** pausar, buscar o usar un salto manual antes de una acción automática. El popup debe indicar suspensión manual. Continuar la reproducción no basta para liberarla: **Reanudar en esta pestaña** o un nuevo episodio sí. Cambiar volumen o entrar en pantalla completa no debe generar esa suspensión.
- [ ] **Pausa por pestaña:** pausar desde el popup, recargar y cambiar de episodio. No debe automatizar hasta reanudarla. Otra pestaña no debe heredar esa pausa. Cerrar la pestaña y abrir una nueva no debe recuperar su pausa anterior.
- [ ] **Navegación:** pasar a otro episodio mediante el servicio y usar atrás/adelante del navegador. No debe clicar controles que aún correspondan al episodio anterior; debe volver a detectar los controles del nuevo reproductor sin recarga adicional.
- [ ] **Pantalla completa y segundo plano:** comprobar un salto permitido en pantalla completa. Cambiar a otra pestaña antes de un control: la extensión no debe actuar mientras el documento está oculto. Al regresar debe reevaluar el estado actual.
- [ ] **Popup:** recorrer controles con Tab y accionarlos con teclado. Los estados y textos deben ser legibles; cualquier desplazamiento debe permitir llegar a pausa/reanudación y mensajes. No debe habilitar opciones sin soporte ni perder elecciones al reabrirse.

Las pruebas con fixtures cubren errores y situaciones ambiguas difíciles de reproducir de forma estable en el servicio. No sustituyen esta lista. Si una prueba falla o el DOM del servicio cambia, documenta el caso y deja desactivada la acción afectada hasta corregirla.
