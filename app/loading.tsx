export default function Loading() {
  return (
    <main
      className="fixed inset-0 z-[9999] min-h-dvh w-full overflow-hidden bg-black"
      aria-live="polite"
      aria-busy="true"
      aria-label="Chill Bros loading"
    >
      <div
        role="img"
        aria-label="Chill Bros loading screen"
        className="absolute inset-0 h-full w-full bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url('/chill-bros-loader.png'), url('/chill-bros-loader.webp')",
        }}
      />
    </main>
  );
}
