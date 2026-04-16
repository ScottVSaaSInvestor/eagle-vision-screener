import type { ScreeningRecord } from '@/engine/types';

export function exportToPDF() {
  window.print();
}

export function exportToJSON(record: ScreeningRecord) {
  const json = JSON.stringify(record, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `eagle-vision-${record.inputs.company_name.replace(/\s+/g, '-').toLowerCase()}-${record.job_id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
