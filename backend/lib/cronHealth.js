const supabase = require('./supabase');

// Età massima (in ore) ammessa dall'ultimo run riuscito, per ogni cron.
// Oltre la soglia il cron è considerato "non eseguito". Questa mappa fa anche
// da elenco dei cron monitorati: solo i job qui presenti vengono controllati.
const CRON_EXPECTATIONS = {
  'deposit':             26,
  'firma-reminder':      26,
  'reminder':            26,
  'auto-cancel-pending': 26,
  'retry-cauzioni':      26,
  'reconcile-cauzioni':  26,
  'daily-summary':       26,
  'cleanup-documenti':   26,
  'cleanup-audit':       216, // settimanale → 9 giorni
  'gdpr-cleanup':        816, // mensile → 34 giorni
};

// Registra l'esecuzione riuscita di un cron (upsert del battito).
// Non-bloccante: in caso di errore logga soltanto e non lancia mai eccezioni —
// un problema col battito non deve mai rompere il lavoro del cron.
async function recordCronRun(job) {
  try {
    const { error } = await supabase
      .from('cron_health')
      .upsert({ job, last_run_at: new Date().toISOString() }, { onConflict: 'job' });
    if (error) console.error('[cronHealth] upsert error:', error.message);
  } catch (e) {
    console.error('[cronHealth] unexpected error:', e.message);
  }
}

// Controlla i battiti: ritorna l'elenco dei cron in ritardo oltre la soglia.
// Ogni voce: { job, ageHours } — ageHours è null se il cron non ha mai girato.
// Lancia un errore se la lettura della tabella fallisce.
async function checkCronHealth() {
  const { data, error } = await supabase
    .from('cron_health')
    .select('job, last_run_at');
  if (error) throw new Error(`Lettura cron_health fallita: ${error.message}`);

  const lastByJob = {};
  for (const row of (data || [])) lastByJob[row.job] = row.last_run_at;

  const now = Date.now();
  const down = [];
  for (const [job, maxHours] of Object.entries(CRON_EXPECTATIONS)) {
    const last = lastByJob[job];
    if (!last) {
      down.push({ job, ageHours: null });
      continue;
    }
    const ageHours = (now - new Date(last).getTime()) / 3600000;
    if (ageHours > maxHours) down.push({ job, ageHours: Math.round(ageHours) });
  }
  return down;
}

module.exports = { CRON_EXPECTATIONS, recordCronRun, checkCronHealth };
