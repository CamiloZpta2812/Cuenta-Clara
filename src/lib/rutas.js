/*
 * Qué dirección le corresponde a cada pestaña.
 *
 * La app vivía entera en "/". Funcionaba, pero el botón atrás salía de la app,
 * recargar te devolvía al principio, y no había forma de guardar un enlace a
 * la pantalla de Deuda. Nada de eso es rendimiento —cambiar de pestaña no
 * descarga nada— pero sí es lo que uno espera de una página.
 *
 * La dirección no es el id interno: `buckets` es un nombre de programador y
 * `gastosfijos` sin guion se lee mal. La tabla traduce, y traducir en un solo
 * sitio es lo que evita que la barra de direcciones y el menú discrepen.
 */

export const RUTA_POR_TAB = {
  resumen: 'resumen',
  mes: 'mes',
  calendario: 'calendario',
  gastosfijos: 'gastos-fijos',
  cobros: 'cobros',
  buckets: 'ahorro',
  deuda: 'deuda',
  movimientos: 'movimientos',
  tarjeta: 'tarjeta',
  configuracion: 'configuracion',
};

export const TAB_INICIAL = 'resumen';

const TAB_POR_RUTA = Object.fromEntries(
  Object.entries(RUTA_POR_TAB).map(([tab, ruta]) => [ruta, tab]),
);

/* La dirección de una pestaña, siempre con barra al principio. */
export function rutaDeTab(tab) {
  return `/${RUTA_POR_TAB[tab] || RUTA_POR_TAB[TAB_INICIAL]}`;
}

/*
 * La pestaña que corresponde a una dirección, o null si no corresponde a
 * ninguna.
 *
 * Devuelve null y no la pestaña inicial a propósito: quien llama necesita
 * poder distinguir "esta dirección es de otra cosa" de "esta dirección es
 * Resumen", porque en el primer caso hay que corregir la barra de direcciones
 * y en el segundo no.
 */
export function tabDeRuta(pathname) {
  const limpio = String(pathname || '').replace(/^\/+|\/+$/g, '').toLowerCase();
  if (!limpio) return null;
  return TAB_POR_RUTA[limpio] || null;
}

/*
 * Qué hacerle a la barra de direcciones cuando cambia la pestaña, o null si no
 * hay nada que hacerle.
 *
 * Vive aquí y no dentro del efecto porque es la parte que se puede equivocar
 * de dos maneras silenciosas, y las dos se prueban mejor así que leyéndolas:
 *
 *   Si empujara siempre, el botón atrás dejaría de servir para salir de la
 *   app: atrás cambia la pestaña, la pestaña empuja una dirección nueva, y el
 *   historial crece hacia adelante mientras el usuario intenta retroceder.
 *
 *   Y si empujara al corregir una dirección que no existe, el atrás llevaría
 *   de vuelta a la dirección rota que la app acaba de arreglar.
 */
export function accionDeNavegacion(pathnameActual, tab) {
  const ruta = rutaDeTab(tab);
  if (pathnameActual === ruta) return null;
  return {
    ruta,
    metodo: tabDeRuta(pathnameActual) === null ? 'replaceState' : 'pushState',
  };
}
