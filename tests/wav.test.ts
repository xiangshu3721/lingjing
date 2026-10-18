import { describe, expect, it } from 'vitest';
import { encodeWav } from '../src/scenes/recorder/wav';

describe('WAV 编码', () => {
  it('文件头与长度正确', async () => {
    const data = new Float32Array([0, 0.5, -0.5, 1]);
    const fake = { numberOfChannels: 1, sampleRate: 8000, length: 4, getChannelData: () => data } as unknown as AudioBuffer;
    const blob = encodeWav(fake);
    expect(blob.size).toBe(44 + 8);
    const v = new DataView(await blob.arrayBuffer());
    expect(String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3))).toBe('RIFF');
    expect(v.getUint32(24, true)).toBe(8000);
    expect(Math.abs(v.getInt16(44 + 2, true) - 16383)).toBeLessThanOrEqual(1);
    expect(v.getInt16(44 + 6, true)).toBe(0x7fff);
  });
});
