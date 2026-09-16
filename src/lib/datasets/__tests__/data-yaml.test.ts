import { describe, it, expect } from 'vitest';
import { lerNamesDoDataYaml } from '../data-yaml';

describe('lerNamesDoDataYaml', () => {
  it('lista inline com aspas simples (formato do Roboflow)', () => {
    const y = "train: ../train/images\nval: ../valid/images\n\nnc: 2\nnames: ['inviavel', 'viavel']\n\nroboflow:\n  workspace: x\n";
    expect(lerNamesDoDataYaml(y)).toEqual(['inviavel', 'viavel']);
  });
  it('lista em linhas', () => {
    expect(lerNamesDoDataYaml('nc: 2\nnames:\n  - a\n  - b\n')).toEqual(['a', 'b']);
  });
  it('sem names devolve vazio', () => {
    expect(lerNamesDoDataYaml('nc: 0\n')).toEqual([]);
  });
});
