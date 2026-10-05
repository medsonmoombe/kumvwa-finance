type Meta = Record<string, unknown> | string | undefined;

function emit(level: string, meta: Meta, msg?: string): void {
  const metaObj = typeof meta === 'string' ? undefined : meta;
  const message = typeof meta === 'string' ? meta : msg;
  const extra = metaObj ? ` ${JSON.stringify(metaObj)}` : '';
  // eslint-disable-next-line no-console
  console.log(`[worker] ${level} ${message ?? ''}${extra}`);
}

export const logger = {
  info: (meta: Meta, msg?: string): void => emit('INFO', meta, msg),
  warn: (meta: Meta, msg?: string): void => emit('WARN', meta, msg),
  error: (meta: Meta, msg?: string): void => emit('ERROR', meta, msg),
};
