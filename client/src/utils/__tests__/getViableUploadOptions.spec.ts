import { EToolResources } from 'librechat-data-provider';
import type { FileConfig } from 'librechat-data-provider';
import { getViableUploadOptions, type UploadOptionContext } from '../files';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const POTX = 'application/vnd.openxmlformats-officedocument.presentationml.template';

/** context accepts plain text + csv (text), pdf + xlsx (ocr); nothing else */
const fileConfig = {
  text: { supportedMimeTypes: [/^text\/(plain|csv)$/] },
  ocr: {
    supportedMimeTypes: [
      /^application\/pdf$/,
      /^application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet$/,
    ],
  },
  stt: { supportedMimeTypes: [] },
} as unknown as FileConfig;

const baseCtx = (over: Partial<UploadOptionContext> = {}): UploadOptionContext => ({
  provider: 'anthropic',
  endpoint: 'anthropic',
  endpointType: 'anthropic',
  useResponsesApi: false,
  fileSearchEnabled: true,
  codeEnabled: true,
  contextEnabled: true,
  fileSearchAllowedByAgent: true,
  codeAllowedByAgent: true,
  fileConfig,
  ...over,
});

const file = (type: string, name: string) => new File(['x'], name, { type });

describe('getViableUploadOptions', () => {
  it('returns empty for no files', () => {
    expect(getViableUploadOptions([], baseCtx())).toEqual([]);
  });

  it('returns empty when a file type cannot be inferred', () => {
    expect(getViableUploadOptions([file('', 'mystery.unknownext')], baseCtx())).toEqual([]);
  });

  describe('Anthropic (PDF/image only for provider attach)', () => {
    it('routes a spreadsheet to code + text, not the provider', () => {
      expect(getViableUploadOptions([file(XLSX, 'report.xlsx')], baseCtx())).toEqual([
        EToolResources.execute_code,
        EToolResources.context,
      ]);
    });

    it('routes a PowerPoint template to file search and code, not the provider', () => {
      expect(getViableUploadOptions([file(POTX, 'brand-template.potx')], baseCtx())).toEqual([
        EToolResources.file_search,
        EToolResources.execute_code,
      ]);
    });

    // company: provider attachments ("Add Photos") are images only (see COMPANY.md)
    it('offers every tool destination for a PDF, but not the provider (images only)', () => {
      expect(getViableUploadOptions([file('application/pdf', 'doc.pdf')], baseCtx())).toEqual([
        EToolResources.file_search,
        EToolResources.execute_code,
        EToolResources.context,
      ]);
    });

    it('yields a single option for a zip (code only) so it can auto-route', () => {
      expect(getViableUploadOptions([file('application/zip', 'a.zip')], baseCtx())).toEqual([
        EToolResources.execute_code,
      ]);
    });

    it('does not attach a PDF directly to the provider even when capabilities are off (images only)', () => {
      const ctx = baseCtx({ fileSearchEnabled: false, codeEnabled: false, contextEnabled: false });
      expect(getViableUploadOptions([file('application/pdf', 'doc.pdf')], ctx)).toEqual([]);
    });

    it('attaches an image directly to the provider ("Add Photos")', () => {
      const ctx = baseCtx({ fileSearchEnabled: false, codeEnabled: false, contextEnabled: false });
      expect(getViableUploadOptions([file('image/png', 'photo.png')], ctx)).toEqual([undefined]);
    });

    it('returns nothing for a spreadsheet when no capabilities are enabled', () => {
      const ctx = baseCtx({ fileSearchEnabled: false, codeEnabled: false, contextEnabled: false });
      expect(getViableUploadOptions([file(XLSX, 'report.xlsx')], ctx)).toEqual([]);
    });
  });

  describe('provider-specific direct attachment', () => {
    // company: provider-specific direct attach is narrowed to images (see COMPANY.md)
    it('does not let Google attach video directly (provider attach is images only)', () => {
      const ctx = baseCtx({
        provider: 'google',
        endpoint: 'google',
        endpointType: 'google',
        fileSearchEnabled: false,
        codeEnabled: false,
        contextEnabled: false,
      });
      expect(getViableUploadOptions([file('video/mp4', 'clip.mp4')], ctx)).toEqual([]);
    });

    it('does not let Anthropic attach video directly', () => {
      const ctx = baseCtx({
        fileSearchEnabled: false,
        codeEnabled: false,
        contextEnabled: false,
      });
      expect(getViableUploadOptions([file('video/mp4', 'clip.mp4')], ctx)).toEqual([]);
    });

    it('does not let Bedrock attach a spreadsheet directly (provider attach is images only)', () => {
      const ctx = baseCtx({
        provider: 'bedrock',
        endpoint: 'bedrock',
        endpointType: 'bedrock',
        fileSearchEnabled: false,
        codeEnabled: false,
        contextEnabled: false,
      });
      expect(getViableUploadOptions([file(XLSX, 'report.xlsx')], ctx)).toEqual([]);
    });

    it('does not honor a permissive custom endpoint config for non-image direct attach', () => {
      const ctx = baseCtx({
        provider: 'MyGateway',
        endpoint: 'MyGateway',
        endpointType: 'custom',
        fileSearchEnabled: false,
        codeEnabled: false,
        contextEnabled: false,
        endpointSupportedMimeTypes: [/.*/],
      });
      expect(getViableUploadOptions([file(XLSX, 'report.xlsx')], ctx)).toEqual([]);
    });

    it('does not offer direct attach for a video even when the custom config allows video (images only)', () => {
      const ctx = baseCtx({
        provider: 'MyGateway',
        endpoint: 'MyGateway',
        endpointType: 'custom',
        fileSearchEnabled: false,
        codeEnabled: false,
        contextEnabled: false,
        endpointSupportedMimeTypes: [/^image\/.*$/, /^application\/pdf$/, /^video\/.*$/],
      });
      expect(getViableUploadOptions([file('video/mp4', 'clip.mp4')], ctx)).toEqual([]);
      expect(getViableUploadOptions([file('audio/wav', 'tone.wav')], ctx)).toEqual([]);
      expect(getViableUploadOptions([file('image/png', 'photo.png')], ctx)).toEqual([undefined]);
    });

    it('does not offer video for a custom endpoint that inherits the default config', () => {
      const ctx = baseCtx({
        provider: 'MyGateway',
        endpoint: 'MyGateway',
        endpointType: 'custom',
        fileSearchEnabled: false,
        codeEnabled: false,
        contextEnabled: false,
        endpointSupportedMimeTypes: undefined,
      });
      expect(getViableUploadOptions([file('video/mp4', 'clip.mp4')], ctx)).toEqual([]);
    });

    it('does not treat a non-permissive custom config as broad provider support', () => {
      const ctx = baseCtx({
        provider: 'MyGateway',
        endpoint: 'MyGateway',
        endpointType: 'custom',
        fileSearchEnabled: false,
        codeEnabled: false,
        contextEnabled: false,
        endpointSupportedMimeTypes: [/^application\/pdf$/],
      });
      expect(getViableUploadOptions([file(XLSX, 'report.xlsx')], ctx)).toEqual([]);
    });
  });

  it('drops an option when the agent disallows it', () => {
    const ctx = baseCtx({ contextEnabled: false, fileSearchEnabled: false });
    expect(getViableUploadOptions([file(XLSX, 'report.xlsx')], ctx)).toEqual([
      EToolResources.execute_code,
    ]);
  });
});
