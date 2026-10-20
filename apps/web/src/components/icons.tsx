export function Arrow({ diagonal = false, down = false, className = '' }: { diagonal?: boolean; down?: boolean; className?: string }) {
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true"><g transform={diagonal ? 'rotate(-45 12 12)' : down ? 'rotate(90 12 12)' : undefined}><path d="M3 12h17m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" /></g></svg>;
}
