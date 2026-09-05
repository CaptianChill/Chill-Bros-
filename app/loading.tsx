export default function Loading() {
  return (
    <main
      className="fixed inset-0 z-[9999] flex min-h-dvh w-full items-center justify-center overflow-hidden bg-black px-3 py-[max(0.75rem,env(safe-area-inset-top))]"
      aria-live="polite"
      aria-busy="true"
      aria-label="Chill Bros loading"
    >
      <div
        role="img"
        aria-label="Chill Bros Cooling and Cooking, Your Pros"
        className="h-full max-h-dvh w-full max-w-[1122px] bg-contain bg-center bg-no-repeat drop-shadow-[0_0_30px_rgba(45,125,255,0.28)]"
        style={{
          backgroundImage: "url('/chill-bros-load-screen.webp'), url('/logo.png')",
        }}
      />
    </main>
  );
}
