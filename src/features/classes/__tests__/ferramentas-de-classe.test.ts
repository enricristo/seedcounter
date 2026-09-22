import { describe, it, expect } from 'vitest';
import {
  categoriaDaClasse,
  classeDaTecla,
  ferramentasDoProtocolo,
  PRIMEIRA_TECLA,
  TECLAS_DE_CLASSE,
} from '../ferramentas-de-classe';
import { PROTOCOLOS, CLASSES } from '../../../lib/normas/classes-de-semente';

describe('ferramentas de classe', () => {
  it('protocolo simples (e ausente) não produz botão nenhum', () => {
    // Em orquídea as classes SÃO viável e inviável: dois botões a mais diriam
    // a mesma coisa duas vezes.
    expect(ferramentasDoProtocolo(PROTOCOLOS.simples)).toEqual([]);
    expect(ferramentasDoProtocolo(undefined)).toEqual([]);
  });

  it('germinação dá cinco botões, na ordem do protocolo, começando na tecla 1', () => {
    const f = ferramentasDoProtocolo(PROTOCOLOS.germinacao);
    expect(f.map((x) => x.classe)).toEqual(['normal', 'anormal', 'dura', 'dormente', 'morta']);
    expect(f.map((x) => x.atalho)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('forrageira acrescenta a vazia no fim, com a tecla 6', () => {
    const f = ferramentasDoProtocolo(PROTOCOLOS.forrageira);
    expect(f).toHaveLength(6);
    const vazia = f[5];
    expect(vazia.classe).toBe('vazia');
    expect(vazia.atalho).toBe('6');
    // A única que não é semente — e é por isso que ela existe separada.
    expect(vazia.ehSemente).toBe(false);
    expect(f.slice(0, 5).every((x) => x.ehSemente)).toBe(true);
  });

  it('a categoria vem de `germinou`, não de uma segunda tabela', () => {
    for (const chave of Object.keys(CLASSES) as (keyof typeof CLASSES)[]) {
      const esperado = CLASSES[chave].germinou ? 'viable' : 'inviable';
      expect(categoriaDaClasse(chave), chave).toBe(esperado);
    }
    // Só a plântula normal germinou; as outras cinco marcam inviável.
    expect(categoriaDaClasse('normal')).toBe('viable');
    expect(categoriaDaClasse('dormente')).toBe('inviable');
  });

  it('cada botão carrega o rótulo e a explicação da norma — o aluno lê ali', () => {
    const f = ferramentasDoProtocolo(PROTOCOLOS.germinacao);
    const anormal = f.find((x) => x.classe === 'anormal');
    expect(anormal?.rotulo).toBe(CLASSES.anormal.rotulo);
    expect(anormal?.explicacao).toBe(CLASSES.anormal.explicacao);
    expect(anormal?.explicacao.length).toBeGreaterThan(20);
  });

  it('as seis classes têm ícones distintos — forma além da cor (Lei 4)', () => {
    const f = ferramentasDoProtocolo(PROTOCOLOS.forrageira);
    expect(new Set(f.map((x) => x.icone)).size).toBe(f.length);
  });

  it('tecla fora da lista do protocolo não escolhe nada', () => {
    expect(classeDaTecla('1', PROTOCOLOS.germinacao)).toBe('normal');
    expect(classeDaTecla('5', PROTOCOLOS.germinacao)).toBe('morta');
    // Germinação tem cinco classes: o 6 não pode cair na última "porque
    // estava perto".
    expect(classeDaTecla('6', PROTOCOLOS.germinacao)).toBeNull();
    expect(classeDaTecla('6', PROTOCOLOS.forrageira)).toBe('vazia');
    expect(classeDaTecla('7', PROTOCOLOS.forrageira)).toBeNull();
    expect(classeDaTecla('1', PROTOCOLOS.simples)).toBeNull();
  });

  it('a tecla é a posição: a primeira classe é o 1, e são seis no máximo', () => {
    // Em 23/09 as classes começavam no 3, para não tomar o 1 e o 2 dos modos
    // de exibição. O dono decidiu o contrário: número na mão de quem conta é
    // classe, e a exibição passou para o N.
    expect(PRIMEIRA_TECLA).toBe(1);
    expect(TECLAS_DE_CLASSE).toEqual(['1', '2', '3', '4', '5', '6']);
  });
});
