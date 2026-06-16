/**
 * feriados.ts — Feriados nacionais brasileiros e contagem de dias úteis.
 *
 * Dias úteis = dias que NÃO são sábado/domingo e NÃO são feriado nacional.
 * Inclui os feriados móveis (derivados da Páscoa): Sexta-feira Santa, e — como
 * pontos facultativos em que, na prática, não há venda — Carnaval (seg/ter) e
 * Corpus Christi. (Para considerar SÓ os feriados nacionais oficiais, remova
 * carnaval/corpus de feriadosNacionais.)
 */

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/** Domingo de Páscoa (algoritmo Anonymous Gregorian / Meeus-Jones-Butcher). */
export function domingoDePascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3=março, 4=abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

const cacheFeriados = new Map<number, Set<string>>();

/** Conjunto de feriados (YYYY-MM-DD) de um ano: fixos + móveis. Memoizado. */
export function feriadosNacionais(ano: number): Set<string> {
  const hit = cacheFeriados.get(ano);
  if (hit) return hit;

  const fixos = [
    `${ano}-01-01`, // Confraternização Universal
    `${ano}-04-21`, // Tiradentes
    `${ano}-05-01`, // Dia do Trabalho
    `${ano}-09-07`, // Independência
    `${ano}-10-12`, // Nossa Senhora Aparecida
    `${ano}-11-02`, // Finados
    `${ano}-11-15`, // Proclamação da República
    `${ano}-12-25`, // Natal
  ];
  const pascoa = domingoDePascoa(ano);
  const moveis = [
    iso(addDays(pascoa, -48)), // Carnaval (segunda) — facultativo, sem venda
    iso(addDays(pascoa, -47)), // Carnaval (terça)  — facultativo, sem venda
    iso(addDays(pascoa, -2)),  // Sexta-feira Santa — nacional
    iso(addDays(pascoa, 60)),  // Corpus Christi    — facultativo, sem venda
  ];
  const set = new Set([...fixos, ...moveis]);
  cacheFeriados.set(ano, set);
  return set;
}

/** É dia útil? (não é fim de semana nem feriado) */
export function ehDiaUtil(d: Date): boolean {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  return !feriadosNacionais(d.getFullYear()).has(iso(d));
}

/** Conta dias úteis de `inicio` até `fim` (inclusive). */
export function diasUteisNoIntervalo(inicio: Date, fim: Date): number {
  const cur = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const end = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
  let count = 0;
  while (cur <= end) {
    if (ehDiaUtil(cur)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function diasUteisNoMes(ano: number, mes: number): number {
  return diasUteisNoIntervalo(new Date(ano, mes - 1, 1), new Date(ano, mes, 0));
}

export function diasUteisNoAno(ano: number): number {
  return diasUteisNoIntervalo(new Date(ano, 0, 1), new Date(ano, 11, 31));
}

/** Dias úteis decorridos no mês, do dia 1º até `hoje` (inclusive). Clampado ao mês. */
export function diasUteisDecorridosNoMes(ano: number, mes: number, hoje: Date): number {
  const ini = new Date(ano, mes - 1, 1);
  const ultimo = new Date(ano, mes, 0);
  let fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (fim > ultimo) fim = ultimo;
  if (fim < ini) return 0;
  return diasUteisNoIntervalo(ini, fim);
}

/** Dias úteis decorridos no ano, de 1º/jan até `hoje` (inclusive). Clampado ao ano. */
export function diasUteisDecorridosNoAno(ano: number, hoje: Date): number {
  const ini = new Date(ano, 0, 1);
  const ultimo = new Date(ano, 11, 31);
  let fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (fim > ultimo) fim = ultimo;
  if (fim < ini) return 0;
  return diasUteisNoIntervalo(ini, fim);
}
