/**
 * Thin bridge over the native `Voltrix` module plus every shell helper the
 * app needs (state read, daemon log, config read/write, apply trigger).
 *
 * Native contract (VoltrixModule.kt):
 *   NativeModules.Voltrix.exec(command) -> Promise<{code, stdout, stderr}>
 * The promise REJECTS only when su is missing/timed out; otherwise it always
 * resolves and the exit code lives in `code`, so shell failures are detected
 * by inspecting the result, not by catching.
 */
import {NativeModules} from 'react-native';

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface VoltrixState {
  capacity?: number;
  status?: string;
  profile?: string;
  temp_c?: number;
  voltage_mv?: number;
  current_ma?: number;
  power_w?: number;
  health?: string;
  charge_level?: number;
  charge_limit?: number;
  disable_thermal?: string;
  always_fast?: string;
  thermal_hot_c?: number;
  thermal_cool_c?: number;
  thermal_gate_active?: boolean;
  charger_type_detected?: string;
  level_calibration?: string;
  avail_total?: number;
  ts?: number;
}

export const PATHS = {
  state: '/data/adb/voltrix/state.json',
  config: '/data/adb/voltrix/config.sh',
  log: '/data/adb/voltrix/daemon.log',
  script: '/data/adb/modules/voltrix/script/charge.sh',
} as const;

/** Turn any thrown/rejected value into a short human-readable line. */
export function errMsg(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

/** Runs `su -c <command>`; rejects only when su itself cannot run. */
export async function exec(command: string): Promise<ExecResult> {
  const mod = NativeModules.Voltrix;
  if (!mod || typeof mod.exec !== 'function') {
    throw new Error('VOLTRIX native module not linked');
  }
  const res: ExecResult = await mod.exec(command);
  if (res == null || typeof res.code !== 'number') {
    throw new Error('Unexpected response from native module');
  }
  return res;
}

/** exec() that also fails when the command exits non-zero. */
export async function execOk(command: string): Promise<string> {
  const res = await exec(command);
  if (res.code !== 0) {
    const detail = (res.stderr || res.stdout || '').trim();
    throw new Error(detail || `Command failed (exit ${res.code})`);
  }
  return res.stdout;
}

/** Root probe: success means `su -c id` ran and reported uid 0. */
export async function checkRoot(): Promise<boolean> {
  try {
    const res = await exec('id');
    return res.code === 0 && /uid=0/.test(res.stdout);
  } catch (e) {
    console.warn('VOLTRIX root check failed:', errMsg(e));
    return false;
  }
}

/** Reads state.json; `{}` when the file does not exist yet, null when unusable. */
export async function readState(): Promise<VoltrixState | null> {
  const raw = await execOk(
    `cat '${PATHS.state}' 2>/dev/null || echo {}`,
  );
  const text = raw.trim();
  if (!text) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      return Object.keys(obj).length === 0 ? null : (obj as VoltrixState);
    }
    return null;
  } catch {
    return null;
  }
}

/** Last 100 daemon log lines (or a friendly placeholder). */
export async function readLog(): Promise<string> {
  return execOk(
    `tail -100 '${PATHS.log}' 2>/dev/null || echo 'No log yet.'`,
  );
}

/** Full apply: runs charge.sh (1-5s) which rewrites state.json. */
export async function runApplyScript(): Promise<void> {
  const res = await exec(`sh '${PATHS.script}' 2>&1`);
  if (res.code !== 0) {
    const detail = (res.stderr || res.stdout || '').trim();
    throw new Error(detail || `charge.sh exited with ${res.code}`);
  }
}

const SAFE_KEY = /^[A-Z][A-Z0-9_]*$/;
const SAFE_VALUE = /^[a-zA-Z0-9._-]+$/;

/**
 * KEY=value upsert in config.sh, mirroring the old web cfgSet:
 * grep ^KEY= → sed replace, else append. Both key and value are validated
 * against a strict charset BEFORE they are interpolated into the shell.
 */
export async function cfgSet(key: string, value: string): Promise<void> {
  if (!SAFE_KEY.test(key)) {
    throw new Error(`Refusing to write unsafe key: ${key}`);
  }
  if (!SAFE_VALUE.test(value)) {
    throw new Error(`Refusing to write unsafe value: ${value}`);
  }
  const cmd = [
    `f='${PATHS.config}'`,
    `if grep -q '^${key}=' "$f" 2>/dev/null; then`,
    `  sed -i 's|^${key}=.*|${key}=${value}|' "$f"`,
    `else`,
    `  echo '${key}=${value}' >> "$f"`,
    `fi`,
  ].join('\n');
  await execOk(cmd);
}

export type ConfigMap = Record<string, string>;

/** Parses KEY=value lines from config.sh output. */
export function parseConfig(text: string): ConfigMap {
  const out: ConfigMap = {};
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (m && m[1] !== undefined && m[2] !== undefined) {
      out[m[1]] = m[2].trim();
    }
  }
  return out;
}

/** Reads config.sh (missing file yields an empty map). */
export async function loadConfig(): Promise<ConfigMap> {
  const raw = await execOk(
    `cat '${PATHS.config}' 2>/dev/null || true`,
  );
  return parseConfig(raw);
}

export interface Settings {
  disableThermal: boolean;
  thermalCoolC: number;
  thermalHotC: number;
  throttlesDisabled: boolean;
  performanceLevel: number;
  performanceMa: number;
  alwaysFast: boolean;
  chargeLimit: number;
}

/** Defaults exactly as load_cfg() in module/script/charge.sh. */
export const DEFAULT_SETTINGS: Settings = {
  disableThermal: true,
  thermalCoolC: 40,
  thermalHotC: 45,
  throttlesDisabled: true,
  performanceLevel: 16,
  performanceMa: 13400,
  alwaysFast: false,
  chargeLimit: 0,
};

function num(v: string | undefined, dflt: number, min: number, max: number): number {
  const n = v == null ? NaN : Number(v);
  if (!Number.isFinite(n)) {
    return dflt;
  }
  return Math.min(max, Math.max(min, n));
}

function bool(v: string | undefined, dflt: boolean): boolean {
  if (v === 'true') {
    return true;
  }
  if (v === 'false') {
    return false;
  }
  return dflt;
}

/** Maps a parsed config.sh onto the Settings model (clamped to slider ranges). */
export function settingsFromConfig(cfg: ConfigMap): Settings {
  return {
    disableThermal: bool(cfg.DISABLE_THERMAL, DEFAULT_SETTINGS.disableThermal),
    thermalCoolC: num(cfg.THERMAL_COOL_C, DEFAULT_SETTINGS.thermalCoolC, 30, 48),
    thermalHotC: num(cfg.THERMAL_HOT_C, DEFAULT_SETTINGS.thermalHotC, 38, 55),
    throttlesDisabled:
      bool(cfg.DISABLE_NIGHT_CHARGING, DEFAULT_SETTINGS.throttlesDisabled) ||
      bool(cfg.DISABLE_SMART_CHG, DEFAULT_SETTINGS.throttlesDisabled) ||
      bool(cfg.DISABLE_RESTRICT, DEFAULT_SETTINGS.throttlesDisabled),
    performanceLevel: num(
      cfg.PERFORMANCE_LEVEL,
      DEFAULT_SETTINGS.performanceLevel,
      0,
      16,
    ),
    performanceMa: num(cfg.PERFORMANCE_MA, DEFAULT_SETTINGS.performanceMa, 1000, 13400),
    alwaysFast: bool(cfg.ALWAYS_FAST, DEFAULT_SETTINGS.alwaysFast),
    chargeLimit: num(cfg.CHARGE_LIMIT, DEFAULT_SETTINGS.chargeLimit, 0, 100),
  };
}

/** Writes every Settings key to config.sh (validated, sequential). */
export async function writeSettings(s: Settings): Promise<void> {
  const throttleVal = s.throttlesDisabled ? 'true' : 'false';
  const pairs: Array<[string, string]> = [
    ['DISABLE_THERMAL', s.disableThermal ? 'true' : 'false'],
    ['THERMAL_COOL_C', String(s.thermalCoolC)],
    ['THERMAL_HOT_C', String(s.thermalHotC)],
    ['DISABLE_NIGHT_CHARGING', throttleVal],
    ['DISABLE_SMART_CHG', throttleVal],
    ['DISABLE_RESTRICT', throttleVal],
    ['PERFORMANCE_LEVEL', String(s.performanceLevel)],
    ['PERFORMANCE_MA', String(s.performanceMa)],
    ['ALWAYS_FAST', s.alwaysFast ? 'true' : 'false'],
    ['CHARGE_LIMIT', String(s.chargeLimit)],
  ];
  for (const [key, value] of pairs) {
    await cfgSet(key, value);
  }
}
