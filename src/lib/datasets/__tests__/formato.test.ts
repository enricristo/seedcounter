import { describe, it, expect } from 'vitest';
import { reconhecerFormato, parDeLabelYolo, ehImagem } from '../formato';

describe('reconhecerFormato', () => {
  it('yolo: data.yaml + labels', () => {
    const r = reconhecerFormato(['data.yaml', 'train/images/a.jpg', 'train/labels/a.txt', 'valid/images/b.jpg', 'valid/labels/b.txt', 'README.roboflow.txt']);
    expect(r.formato).toBe('yolo');
    expect(r.imagens).toEqual(['train/images/a.jpg', 'valid/images/b.jpg']);
    expect(r.anotacao).toContain('data.yaml');
  });
  it('roboflow-multiclass: _classes.csv em train/valid/test', () => {
    const r = reconhecerFormato(['train/_classes.csv', 'train/a.jpg', 'valid/_classes.csv', 'valid/b.jpg']);
    expect(r.formato).toBe('roboflow-multiclass');
    expect(r.anotacao).toEqual(['train/_classes.csv', 'valid/_classes.csv']);
  });
  it('mascara-de-instancia: Scanned_* e Segmented_*/seed', () => {
    const r = reconhecerFormato(['Scanned_A/1.jpg', 'Segmented_A/seed/1.png', 'Segmented_A/seed/2.png']);
    expect(r.formato).toBe('mascara-de-instancia');
    expect(r.imagens).toEqual(['Scanned_A/1.jpg']);
  });
  it('pasta-por-classe e solto', () => {
    expect(reconhecerFormato(['x/1.jpg', 'y/2.jpg']).formato).toBe('pasta-por-classe');
    expect(reconhecerFormato(['1.jpg', '2.png', 'notas.csv']).formato).toBe('solto');
  });
  it('parDeLabelYolo troca images→labels e extensão→txt', () => {
    expect(parDeLabelYolo('train/images/a.rf.123.jpg')).toBe('train/labels/a.rf.123.txt');
  });
  it('ehImagem cobre tif/tiff', () => {
    expect(ehImagem('x.TIF')).toBe(true); expect(ehImagem('x.txt')).toBe(false);
  });
});
