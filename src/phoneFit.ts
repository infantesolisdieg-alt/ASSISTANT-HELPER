// Algunos celulares muestran la página como si fueran una computadora (modo "Sitio de escritorio" o
// un navegador que ignora la etiqueta viewport): el área de dibujo mide ~980 px aunque la pantalla
// mida ~400, y todo se ve diminuto. En ese caso se escala la página (zoom) para que ocupe el ancho
// real del teléfono. Las reglas de teléfono del CSS también se activan con max-device-width.

export function fitPhoneScreen(): void {
  const html = document.documentElement;
  const apply = () => {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const screenWidth = window.screen?.width || window.innerWidth;
    const ratio = window.innerWidth / screenWidth;
    if (coarse && screenWidth < 768 && ratio > 1.25) {
      html.style.zoom = String(ratio);
      html.style.setProperty('--fit', String(ratio));
      html.classList.add('phone-fit');
    } else if (html.classList.contains('phone-fit')) {
      html.style.zoom = '';
      html.style.removeProperty('--fit');
      html.classList.remove('phone-fit');
    }
  };
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
}
