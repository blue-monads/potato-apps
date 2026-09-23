// Code 128 (Subset B) barcode encoder and SVG renderer

const CODE128_PATTERNS: string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
];

const START_B = 104;
const STOP = 106;

export interface BarcodeBar {
  x: number;
  width: number;
}

export interface BarcodeResult {
  totalWidth: number;
  bars: BarcodeBar[];
}

/**
 * Encodes ASCII string into Code 128B bar coordinates
 */
export function encodeCode128B(text: string, moduleWidth = 2): BarcodeResult | null {
  if (!text || text.length === 0) return null;

  const codes: number[] = [START_B];
  let checkSum = START_B;

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    // Code 128B supports ASCII 32..126
    if (charCode < 32 || charCode > 126) {
      // Fallback for non-ASCII characters: replace with '?' (ASCII 63 -> code 31)
      const val = 31;
      codes.push(val);
      checkSum += val * (i + 1);
    } else {
      const val = charCode - 32;
      codes.push(val);
      checkSum += val * (i + 1);
    }
  }

  codes.push(checkSum % 103);
  codes.push(STOP);

  const bars: BarcodeBar[] = [];
  let currentX = 10; // Quiet zone

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code];
    if (!pattern) continue;

    for (let j = 0; j < pattern.length; j++) {
      const width = parseInt(pattern[j], 10) * moduleWidth;
      const isBar = j % 2 === 0;
      if (isBar) {
        bars.push({ x: currentX, width });
      }
      currentX += width;
    }
  }

  currentX += 10; // Trailing quiet zone

  return {
    totalWidth: currentX,
    bars,
  };
}

/**
 * Generates a random realistic barcode (EAN-13 style or SKU style)
 */
export function generateRandomBarcode(): string {
  const types = ["ean13", "code128"];
  const type = types[Math.floor(Math.random() * types.length)];

  if (type === "ean13") {
    // 12 random digits
    let digits = "";
    for (let i = 0; i < 12; i++) {
      digits += Math.floor(Math.random() * 10).toString();
    }
    return digits;
  } else {
    // SKU style: e.g. "PRD-48291"
    const prefix = ["SKU", "PRD", "ITM", "PKG", "BAR"][Math.floor(Math.random() * 5)];
    const num = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}-${num}`;
  }
}
