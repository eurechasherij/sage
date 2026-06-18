// Minimal, dependency-free JSONC parser. bun.lock is JSONC (trailing commas, and
// potentially comments), which JSON.parse rejects. Both passes are string-aware so
// content inside string values (package names, integrity hashes) is never touched.

const stripComments = (s: string): string => {
  let out = "";
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (inStr) {
      out += c;
      if (c === "\\") {
        out += s[i + 1] ?? "";
        i++;
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      out += c;
      continue;
    }
    if (c === "/" && s[i + 1] === "/") {
      i += 2;
      while (i < s.length && s[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && s[i + 1] === "*") {
      i += 2;
      while (i < s.length && !(s[i] === "*" && s[i + 1] === "/")) i++;
      i++; // skip the closing '/'
      continue;
    }
    out += c;
  }
  return out;
};

const dropTrailingCommas = (s: string): string => {
  let out = "";
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (inStr) {
      out += c;
      if (c === "\\") {
        out += s[i + 1] ?? "";
        i++;
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      out += c;
      continue;
    }
    if (c === ",") {
      let j = i + 1;
      while (j < s.length && /\s/.test(s[j]!)) j++;
      if (s[j] === "}" || s[j] === "]") continue; // trailing comma -> drop
    }
    out += c;
  }
  return out;
};

export const parseJsonc = <T>(text: string): T =>
  JSON.parse(dropTrailingCommas(stripComments(text))) as T;
