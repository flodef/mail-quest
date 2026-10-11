// libmime ne publie pas de types — on n'utilise que decodeWords.
declare module "libmime" {
  export class Libmime {
    decodeWords(str: string): string;
  }
}
