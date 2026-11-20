/**
 * Fundo de cards/modais alinhado ao menu lateral (`bg-sidebar` — tom “folha” do tema).
 */
export function ShellCardBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit] bg-sidebar dark:bg-card"
      aria-hidden
    />
  );
}
