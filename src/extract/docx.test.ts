// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseDocxXml } from './docx';
import { paragraphsFromPlainText } from './lines';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

const styles = `<?xml version="1.0"?>
<w:styles ${W}>
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>
    <w:pPr><w:spacing w:line="480" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:rFonts w:asciiTheme="majorHAnsi"/><w:sz w:val="32"/></w:rPr>
  </w:style>
</w:styles>`;

const theme = `<?xml version="1.0"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements><a:fontScheme>
<a:majorFont><a:latin typeface="Calibri Light"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont>
</a:fontScheme></a:themeElements></a:theme>`;

const body = (paras: string, sect = '<w:sectPr><w:pgMar w:top="1440" w:right="1701" w:bottom="1440" w:left="1701"/></w:sectPr>') =>
  `<?xml version="1.0"?><w:document ${W}><w:body>${paras}${sect}</w:body></w:document>`;

const longText = 'This paragraph has more than eight words so it counts as body text for alignment.';

describe('parseDocxXml', () => {
  it('resolves fonts, sizes, spacing, alignment and margins through styles', () => {
    const xml = body(`
      <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>My Title</w:t></w:r></w:p>
      <w:p><w:r><w:t>${longText}</w:t></w:r></w:p>
      <w:p><w:r><w:t xml:space="preserve">${longText} </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>Bold part.</w:t></w:r></w:p>`);
    const { paragraphs, format } = parseDocxXml(xml, styles, theme);
    expect(paragraphs).toEqual(['My Title', longText, `${longText} Bold part.`]);
    expect(format.font).toBe('Times New Roman');
    expect(format.fontShare).toBeGreaterThan(0.9);
    expect(format.fontSizePt).toBe(12);
    expect(format.lineSpacing).toBe(2);
    expect(format.alignment).toBe('justify');
    expect(format.marginsCm).toEqual({ top: 2.54, right: 3, bottom: 2.54, left: 3 });
    expect(format.hasTitleStyle).toBe(true);
  });

  it('uses theme fonts and direct formatting', () => {
    const xml = body(`
      <w:p><w:pPr><w:jc w:val="left"/><w:spacing w:line="360" w:lineRule="auto"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:asciiTheme="minorHAnsi"/><w:sz w:val="22"/></w:rPr><w:t>${longText}</w:t></w:r></w:p>`);
    const { format } = parseDocxXml(xml, styles, theme);
    expect(format.font).toBe('Calibri');
    expect(format.fontSizePt).toBe(11);
    expect(format.lineSpacing).toBe(1.5);
    expect(format.alignment).toBe('left');
    expect(format.hasTitleStyle).toBe(false);
  });

  it('reports exact line heights instead of a multiple', () => {
    const xml = body(`<w:p><w:pPr><w:spacing w:line="480" w:lineRule="exact"/></w:pPr><w:r><w:t>${longText}</w:t></w:r></w:p>`);
    const { format } = parseDocxXml(xml, styles, theme);
    expect(format.lineSpacing).toBeNull();
    expect(format.lineSpacingExactPt).toBe(24);
  });

  it('works without styles.xml', () => {
    const { format } = parseDocxXml(body(`<w:p><w:r><w:t>${longText}</w:t></w:r></w:p>`, ''), null, null);
    expect(format.font).toBe('Times New Roman');
    expect(format.fontSizePt).toBe(10);
    expect(format.marginsCm).toBeNull();
  });
});

describe('paragraphsFromPlainText', () => {
  it('keeps short lines and joins wrapped lines', () => {
    const wrapped = 'This is a long line of text that was wrapped by the editor at a fixed\nwidth and continues here.';
    const p = paragraphsFromPlainText(`Ana López\r\nMexico City\r\n\r\n${wrapped}`);
    expect(p).toEqual(['Ana López\nMexico City', wrapped.replace('\n', ' ')]);
  });
});
