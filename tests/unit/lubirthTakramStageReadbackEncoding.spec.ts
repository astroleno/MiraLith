import { expect, test } from "@playwright/test";

const modulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramStageReadbackEncoding";

test("encodes half-float readback values as compact float32 bytes", async () => {
  const encoding = await import(modulePath);
  const payload = encoding.encodeTakramStageReadbackValues(
    new Float32Array([0, 0.5, 1]),
    "half-float"
  );

  expect(payload).toMatchObject({ scalar: "float32-le", byteLength: 12 });
  expect(Buffer.from(payload.dataBase64, "base64")).toEqual(
    Buffer.from(new Float32Array([0, 0.5, 1]).buffer)
  );
});

test("encodes output readback values as clamped uint8 bytes", async () => {
  const encoding = await import(modulePath);
  const payload = encoding.encodeTakramStageReadbackValues(
    new Float32Array([0, 0.5, 1, 2, -1]),
    "unorm8"
  );

  expect(payload).toMatchObject({ scalar: "uint8", byteLength: 5 });
  expect(Buffer.from(payload.dataBase64, "base64")).toEqual(
    Buffer.from([0, 128, 255, 255, 0])
  );
});
