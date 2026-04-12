export default function ProgressBar({ currentStep, totalSteps }) {
  const labels = ['Data', 'Orario', 'Tipo', 'Bici', 'Contatti', 'Pagamento'];

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Barra lineare */}
      <div style={{
        height: 4,
        background: '#E0E0E0',
        borderRadius: 2,
        marginBottom: 12,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${((currentStep) / totalSteps) * 100}%`,
          background: 'var(--verde)',
          borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Step dots */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        {labels.map((label, i) => {
          const stepNum = i + 1;
          const done    = stepNum < currentStep;
          const active  = stepNum === currentStep;

          return (
            <div key={i} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flex: 1,
            }}>
              <div style={{
                width: 24, height: 24,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.7rem',
                fontWeight: 700,
                background: done ? 'var(--verde)' : active ? 'var(--verde)' : '#E0E0E0',
                color: (done || active) ? 'white' : '#999',
                transition: 'all 0.2s',
              }}>
                {done ? '✓' : stepNum}
              </div>
              <div style={{
                fontSize: '0.62rem',
                marginTop: 4,
                color: active ? 'var(--verde)' : '#999',
                fontWeight: active ? 700 : 400,
                textAlign: 'center',
              }}>
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
