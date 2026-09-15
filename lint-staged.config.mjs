/**
 * lint-staged config — batches staged files so the biome command line never
 * exceeds the Windows limit ("The command line is too long"). Biome is the
 * repo's single lint+format tool (constitution VIII).
 */
const MAX_FILES_PER_COMMAND = 40;
const BIOME = 'npx biome check --write --no-errors-on-unmatched --files-ignore-unknown=true';

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export default {
  '*.{js,jsx,ts,tsx,json,css,md}': (files) =>
    chunk(files, MAX_FILES_PER_COMMAND).map(
      (batch) => `${BIOME} ${batch.map((f) => `"${f}"`).join(' ')}`,
    ),
};
