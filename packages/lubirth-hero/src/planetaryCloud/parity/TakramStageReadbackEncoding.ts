function bytesToBase64(bytes: Uint8Array) {
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
  }
  return btoa(chunks.join(""));
}

function float32LittleEndianBytes(values: Float32Array) {
  const platformLittleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  if (platformLittleEndian) {
    return new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
  }
  const bytes = new Uint8Array(values.byteLength);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < values.length; index += 1) {
    view.setFloat32(index * 4, values[index] ?? 0, true);
  }
  return bytes;
}

export function encodeTakramStageReadbackValues(
  values: Float32Array,
  precision: "half-float" | "unorm8"
) {
  const bytes = precision === "unorm8"
    ? Uint8Array.from(values, (value) =>
        Math.max(0, Math.min(255, Math.round(value * 255)))
      )
    : float32LittleEndianBytes(values);
  return {
    scalar: precision === "unorm8" ? "uint8" as const : "float32-le" as const,
    byteLength: bytes.byteLength,
    dataBase64: bytesToBase64(bytes)
  };
}
