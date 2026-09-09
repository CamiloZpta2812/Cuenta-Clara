import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RUTA_POR_TAB, TAB_INICIAL, rutaDeTab, tabDeRuta, accionDeNavegacion,
} from './rutas.js';

test('cada pestaña va y vuelve por su dirección', () => {
  Object.keys(RUTA_POR_TAB).forEach((tab) => {
    assert.equal(tabDeRuta(rutaDeTab(tab)), tab, `no volvió ${tab}`);
  });
});

test('la raíz no es ninguna pestaña', () => {
  // Null y no "resumen": quien llama tiene que poder corregir la barra.
  assert.equal(tabDeRuta('/'), null);
  assert.equal(tabDeRuta(''), null);
  assert.equal(tabDeRuta(null), null);
});

test('una dirección que no existe tampoco es ninguna', () => {
  assert.equal(tabDeRuta('/loquesea'), null);
  assert.equal(tabDeRuta('/deuda/2'), null);
});

test('la barra sobrante y las mayúsculas no rompen nada', () => {
  assert.equal(tabDeRuta('/deuda/'), 'deuda');
  assert.equal(tabDeRuta('deuda'), 'deuda');
  assert.equal(tabDeRuta('/Deuda'), 'deuda');
});

test('una pestaña que no existe cae en la inicial, no en undefined', () => {
  assert.equal(rutaDeTab('inventada'), `/${RUTA_POR_TAB[TAB_INICIAL]}`);
  assert.equal(rutaDeTab(undefined), '/resumen');
});

test('las direcciones se leen: nada de ids de programador', () => {
  assert.equal(rutaDeTab('buckets'), '/ahorro');
  assert.equal(rutaDeTab('gastosfijos'), '/gastos-fijos');
});

test('no hay dos pestañas compartiendo dirección', () => {
  const rutas = Object.values(RUTA_POR_TAB);
  assert.equal(rutas.length, new Set(rutas).size);
});

/* --------------------------------------------- empujar o no empujar --- */

test('si la dirección ya es la de la pestaña, no se toca', () => {
  /*
   * Es lo que corta el círculo. El botón atrás cambia la pestaña; si el efecto
   * volviera a empujar, el historial crecería hacia adelante mientras el
   * usuario intenta retroceder, y nunca saldría de la app.
   */
  assert.equal(accionDeNavegacion('/deuda', 'deuda'), null);
  assert.equal(accionDeNavegacion('/ahorro', 'buckets'), null);
});

test('cambiar de pestaña apila, para poder volver', () => {
  assert.deepEqual(accionDeNavegacion('/resumen', 'deuda'),
    { ruta: '/deuda', metodo: 'pushState' });
});

test('entrar por la raíz corrige sin apilar', () => {
  // Si apilara, el atrás te devolvería a "/" y la app te sacaría otra vez.
  assert.deepEqual(accionDeNavegacion('/', 'resumen'),
    { ruta: '/resumen', metodo: 'replaceState' });
});

test('una dirección que no existe también se corrige sin apilar', () => {
  assert.deepEqual(accionDeNavegacion('/loquesea', 'resumen'),
    { ruta: '/resumen', metodo: 'replaceState' });
});
