const SIZE = 29;
const DATA_CODEWORDS = 55;
const ECC_CODEWORDS = 15;

function multiply(left, right) {
  let product = 0;
  for (let bit = 7; bit >= 0; bit -= 1) {
    product = (product << 1) ^ ((product >>> 7) * 0x11d);
    if ((right >>> bit) & 1) product ^= left;
  }
  return product;
}

function errorCorrection(data) {
  let generator = [1];
  let root = 1;
  for (let i = 0; i < ECC_CODEWORDS; i += 1) {
    const next = new Array(generator.length + 1).fill(0);
    generator.forEach((value, index) => {
      next[index] ^= value;
      next[index + 1] ^= multiply(value, root);
    });
    generator = next;
    root = multiply(root, 2);
  }
  const remainder = new Array(ECC_CODEWORDS).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let i = 0; i < ECC_CODEWORDS; i += 1) remainder[i] ^= multiply(generator[i + 1], factor);
  }
  return remainder;
}

function makeData(text) {
  const bytes = [...new TextEncoder().encode(text)];
  if (bytes.length > 53) throw new Error("Nội dung QR vượt quá giới hạn mã thiết bị.");
  const bits = [];
  const append = (value, length) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };
  append(0b0100, 4);
  append(bytes.length, 8);
  bytes.forEach((byte) => append(byte, 8));
  const maxBits = DATA_CODEWORDS * 8;
  for (let i = 0; i < Math.min(4, maxBits - bits.length); i += 1) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((value, bit) => (value << 1) | bit, 0));
  }
  for (let pad = 0; data.length < DATA_CODEWORDS; pad += 1) data.push(pad % 2 ? 0x11 : 0xec);
  return [...data, ...errorCorrection(data)];
}

function createMatrix(codewords) {
  const matrix = Array.from({ length: SIZE }, () => new Array(SIZE).fill(false));
  const reserved = Array.from({ length: SIZE }, () => new Array(SIZE).fill(false));
  const setFunction = (x, y, value) => {
    if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) {
      matrix[y][x] = value;
      reserved[y][x] = true;
    }
  };

  const finder = (centerX, centerY) => {
    for (let dy = -1; dy <= 7; dy += 1) {
      for (let dx = -1; dx <= 7; dx += 1) {
        const x = centerX + dx;
        const y = centerY + dy;
        const inside = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
        const dark = inside && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
        setFunction(x, y, dark);
      }
    }
  };

  finder(0, 0);
  finder(SIZE - 7, 0);
  finder(0, SIZE - 7);
  for (let i = 8; i < SIZE - 8; i += 1) {
    setFunction(i, 6, i % 2 === 0);
    setFunction(6, i, i % 2 === 0);
  }
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      setFunction(22 + dx, 22 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  setFunction(8, SIZE - 8, true);

  const formatValue = (((0b01 << 3) | 0) << 10);
  let remainder = formatValue;
  for (let i = 14; i >= 10; i -= 1) {
    if ((remainder >>> i) & 1) remainder ^= 0x537 << (i - 10);
  }
  const format = (formatValue | remainder) ^ 0x5412;
  const formatBit = (index) => ((format >>> index) & 1) !== 0;
  for (let i = 0; i <= 5; i += 1) setFunction(8, i, formatBit(i));
  setFunction(8, 7, formatBit(6));
  setFunction(8, 8, formatBit(7));
  setFunction(7, 8, formatBit(8));
  for (let i = 9; i < 15; i += 1) setFunction(14 - i, 8, formatBit(i));
  for (let i = 0; i < 8; i += 1) setFunction(SIZE - 1 - i, 8, formatBit(i));
  for (let i = 8; i < 15; i += 1) setFunction(8, SIZE - 15 + i, formatBit(i));

  const bits = codewords.flatMap((byte) => Array.from({ length: 8 }, (_, bit) => (byte >>> (7 - bit)) & 1));
  let bitIndex = 0;
  let upward = true;
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let offset = 0; offset < SIZE; offset += 1) {
      const y = upward ? SIZE - 1 - offset : offset;
      for (let column = 0; column < 2; column += 1) {
        const x = right - column;
        if (reserved[y][x]) continue;
        let value = bitIndex < bits.length ? bits[bitIndex] === 1 : false;
        bitIndex += 1;
        if ((x + y) % 2 === 0) value = !value;
        matrix[y][x] = value;
      }
    }
    upward = !upward;
  }
  return matrix;
}

export function createQrSvg(payload) {
  const matrix = createMatrix(makeData(payload));
  const quiet = 4;
  const viewSize = SIZE + quiet * 2;
  const modules = [];
  matrix.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) modules.push(`<rect x="${x + quiet}" y="${y + quiet}" width="1" height="1"/>`);
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewSize} ${viewSize}" role="img" aria-label="QR code nhận dạng thiết bị"><rect width="${viewSize}" height="${viewSize}" fill="#fff"/><g fill="#10233f">${modules.join("")}</g></svg>`;
}
