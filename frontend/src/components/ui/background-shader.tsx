export default function BackgroundShader() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{ backgroundImage: "var(--login-bg-image)" }}
      />
      <div
        className="absolute inset-0"
        style={{ backgroundImage: "var(--login-bg-overlay)" }}
      />
      <div
        className="absolute left-[8%] top-[10%] h-64 w-64 rounded-full blur-3xl"
        style={{ background: "var(--login-bg-orb-1)" }}
      />
      <div
        className="absolute bottom-[8%] right-[10%] h-72 w-72 rounded-full blur-3xl"
        style={{ background: "var(--login-bg-orb-2)" }}
      />
    </div>
  )
}
