import { expect, test, describe, beforeEach, vi } from 'vitest';
import { getUserSettings, saveUserSettings } from './settings';

// O ambiente de teste (node) não possui localStorage; criamos um stub
// simples em memória para validar a leitura/gravação das configurações.
function installLocalStorageMock() {
  const store = new Map<string, string>();
  const mock = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
  };
  vi.stubGlobal('localStorage', mock);
  return store;
}

describe('getUserSettings', () => {
  beforeEach(() => {
    installLocalStorageMock();
  });

  test('retorna os valores padrão quando não há nada salvo', () => {
    expect(getUserSettings()).toEqual({ newPerDay: 20, reviewsPerDay: 200 });
  });

  test('mescla valores salvos parciais com os padrões', () => {
    localStorage.setItem('aprovacard_settings', JSON.stringify({ newPerDay: 5 }));
    expect(getUserSettings()).toEqual({ newPerDay: 5, reviewsPerDay: 200 });
  });

  test('usa integralmente os valores salvos quando completos', () => {
    localStorage.setItem('aprovacard_settings', JSON.stringify({ newPerDay: 10, reviewsPerDay: 50 }));
    expect(getUserSettings()).toEqual({ newPerDay: 10, reviewsPerDay: 50 });
  });

  test('faz fallback para os padrões quando o JSON está corrompido', () => {
    localStorage.setItem('aprovacard_settings', '{ isto não é json válido');
    expect(getUserSettings()).toEqual({ newPerDay: 20, reviewsPerDay: 200 });
  });
});

describe('saveUserSettings', () => {
  beforeEach(() => {
    installLocalStorageMock();
  });

  test('persiste as configurações e permite recuperá-las', () => {
    saveUserSettings({ newPerDay: 30, reviewsPerDay: 300 });
    expect(getUserSettings()).toEqual({ newPerDay: 30, reviewsPerDay: 300 });
  });
});
