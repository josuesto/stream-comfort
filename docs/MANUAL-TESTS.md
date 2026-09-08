# Lista manual breve de 0.3.2

Ejecutar con la extensión instalada en Chrome 120+, Crunchyroll es-es y HBO es-419. Registrar servicio, versión, control visible y resultado. Las casillas siguen pendientes; las inspecciones ya realizadas están en [VERIFICATION.md](VERIFICATION.md).

Antes de probar el avance de la extensión, revisar el autoplay nativo del servicio para distinguir ambos. Créditos, final y lista deben empezar apagados. Tras buscar o pausar manualmente, usar **Reanudar en esta pestaña** si se quiere probar automatización.

- [ ] Recargar la extensión, confirmar versión 0.3.2 y abrir su popup sin errores. Fuera de un episodio debe explicar la falta de compatibilidad y permitir los interruptores global/plataformas.
- [ ] Elegir ajustes distintos por servicio, apagar/encender global y plataformas, cerrar/reabrir Chrome. Las elecciones deben conservarse sin activar avances nuevos.
- [ ] En ambos servicios, comprobar intro encendida y apagada. Un clic máximo y «Última acción» coherente. En HBO repetir con resumen, seguido de intro; el «Saltar» promocional debe ignorarse.
- [ ] Activar créditos. Crunchyroll solo debe avanzar cuando aparecen «Saltar créditos» y siguiente visibles; HBO cuando ofrece su siguiente episodio durante créditos. Repetir apagado.
- [ ] Activar solo siguiente episodio. Dejar terminar el vídeo: nunca adelantar créditos; solo intentar avanzar si el servicio mantiene visible y habilitado su botón. Repetir con la opción apagada y autoplay nativo apagado.
- [ ] En Crunchyroll, guardar dos enlaces exactos en la lista. No debe activarse al guardarla. Encenderla y abrir un episodio elegido: un avance máximo mediante el botón normal; uno no elegido no debe omitirse. Vaciarla debe apagarla. No debe actuar si falta el botón siguiente.
- [ ] Pausar/buscar/saltar manualmente; en HBO cancelar la cuenta atrás. Debe suspender automatización del episodio hasta reanudar desde popup o cambiar de episodio. Volumen y fullscreen no deben suspenderla.
- [ ] Pausar desde el popup, navegar y recargar: debe continuar la pausa. Otra pestaña no debe heredarla. Apagar/encender una plataforma no debe quitarla.
- [ ] Cambiar episodio y usar atrás/adelante. Nunca clicar controles anteriores mientras carga el nuevo vídeo. Comprobar un salto permitido en pantalla completa y ausencia de acciones en segundo plano.
- [ ] Recorrer popup y editor con teclado, guardar/cancelar, probar enlace inválido, cambiar de episodio durante edición. Guardar debe mantener el servicio original; añadir el episodio anterior debe quedar deshabilitado después de navegar.

No marcar una ejecución real como aprobada por un resultado simulado. No publicar datos de cuenta, fuentes de vídeo ni historial.

- [ ] Abrir el popup durante 30 segundos, cambiar entre Plataformas y controles, y editar una lista. No debe saltar de tamaño, parpadear periódicamente ni perder el foco, la selección de texto o la posición de desplazamiento.

## Language option

- [ ] After updating to 0.3.2, the popup starts in English if no language was previously saved. Existing skip and platform choices stay intact.
- [ ] Select Español, close and reopen the popup, then restart Chrome. Spanish persists. Switch back to English and check labels, Platforms, status, errors, and the episode editor.
- [ ] Change language while editing an episode list. The draft remains; no episodes are skipped or enabled by the language change. The selector is also available on an unsupported page.
- [ ] Leave each language open briefly and switch panels: the popup retains its outer size and scrolls internally without periodic flicker.

The user has confirmed the original popup stutter stopped after the 0.3.1 fix. This does not mark every installed playback check above as completed.
