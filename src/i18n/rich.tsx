// Traduce una oración que lleva partes con formato (por ejemplo <strong>): el texto completo se
// traduce y las piezas se insertan en el lugar de sus llaves.
//   tRich('{name} shares {p} of the text.', { name: <strong>Ana</strong>, p: '32%' })

import { Fragment, type ReactNode } from 'react';
import { t } from './index';

export function tRich(en: string, parts: Record<string, ReactNode>): ReactNode {
  const pieces = t(en).split(/\{(\w+)\}/);
  return pieces.map((piece, i) =>
    i % 2 === 1 ? <Fragment key={i}>{piece in parts ? parts[piece] : `{${piece}}`}</Fragment> : piece,
  );
}
