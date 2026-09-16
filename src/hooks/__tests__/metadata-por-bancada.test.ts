import { describe, it, expect } from 'vitest';
import { idDoRegistroDeMetadados } from '../useMetadata';

/**
 * Metadados carregam a CALIBRAÇÃO. Se duas bancadas compartilhassem o
 * registro, abrir uma digitalização de 4800 DPI ao lado de uma foto de
 * celular faria as medidas em mm de uma sair com o µm/px da outra — erro
 * silencioso, que só apareceria no laudo.
 */
describe('registro de metadados por bancada', () => {
  it('a bancada 1 mantém a chave antiga — quem já usa o app não perde a bancada salva', () => {
    expect(idDoRegistroDeMetadados('b1')).toBe('current_metadata');
    expect(idDoRegistroDeMetadados(undefined)).toBe('current_metadata');
  });

  it('as demais têm registro próprio', () => {
    expect(idDoRegistroDeMetadados('b2')).toBe('metadata_b2');
    expect(idDoRegistroDeMetadados('b3')).toBe('metadata_b3');
    expect(idDoRegistroDeMetadados('b4')).toBe('metadata_b4');
  });

  it('nenhuma bancada compartilha registro com outra', () => {
    const ids = ['b1', 'b2', 'b3', 'b4'].map(idDoRegistroDeMetadados);
    expect(new Set(ids).size).toBe(4);
  });
});
