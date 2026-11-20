import Wave from "react-wavify"

export default function WavesBackground({ saudacao = true }: { saudacao?: boolean }) {
  return (
    <div className="relative h-full w-full overflow-hidden contain-paint bg-gradient-to-b from-[hsl(217,45%,28%)] via-[hsl(250,40%,22%)] to-[hsl(260,45%,16%)]">
      <Wave
        fill="hsl(217, 91%, 55%)"
        paused={false}
        className="absolute bottom-[80%] left-0 w-full"
        style={{ height: 200, opacity: 0.6 }}
        options={{ height: 30, amplitude: 25, speed: 0.12, points: 4 }}
      />
      <Wave
        fill="hsl(250, 65%, 52%)"
        paused={false}
        className="absolute bottom-[65%] left-0 w-full"
        style={{ height: 220, opacity: 0.85 }}
        options={{ height: 25, amplitude: 30, speed: 0.18, points: 3 }}
      />
      <Wave
        fill="hsl(200, 80%, 50%)"
        paused={false}
        className="absolute bottom-[50%] left-0 w-full"
        style={{ height: 200, opacity: 0.8 }}
        options={{ height: 20, amplitude: 22, speed: 0.15, points: 4 }}
      />
      <Wave
        fill="hsl(260, 65%, 55%)"
        paused={false}
        className="absolute bottom-[38%] left-0 w-full"
        style={{ height: 200, opacity: 0.85 }}
        options={{ height: 25, amplitude: 28, speed: 0.2, points: 3 }}
      />
      <Wave
        fill="hsl(250, 55%, 45%)"
        paused={false}
        className="absolute bottom-[25%] left-0 w-full"
        style={{ height: 200, opacity: 0.7 }}
        options={{ height: 20, amplitude: 20, speed: 0.1, points: 5 }}
      />
      <Wave
        fill="hsl(217, 80%, 50%)"
        paused={false}
        className="absolute bottom-[12%] left-0 w-full"
        style={{ height: 180, opacity: 0.5 }}
        options={{ height: 15, amplitude: 18, speed: 0.22, points: 4 }}
      />
      <Wave
        fill="hsl(245, 58%, 48%)"
        paused={false}
        className="absolute bottom-0 left-0 w-full"
        style={{ height: 160, opacity: 0.9 }}
        options={{ height: 20, amplitude: 22, speed: 0.14, points: 3 }}
      />

      <div
        className="absolute w-24 h-24 rounded-full opacity-80"
        style={{
          background: "linear-gradient(135deg, hsl(217, 91%, 65%), hsl(217, 91%, 45%))",
          top: "35%",
          left: "12%",
        }}
      />

      {/* Marcas decorativas */}
      {[
        { top: "8%", left: "5%" },
        { top: "15%", left: "55%" },
        { top: "25%", left: "12%" },
        { top: "30%", left: "40%" },
        { top: "35%", left: "75%" },
        { top: "40%", left: "90%" },
        { top: "50%", left: "3%" },
        { top: "55%", left: "25%" },
        { top: "50%", left: "60%" },
        { top: "60%", left: "90%" },
      ].map((pos, i) => (
        <span
          key={i}
          className="absolute text-white/40 text-sm font-light select-none"
          style={{ top: pos.top, left: pos.left }}
        >
          ✕
        </span>
      ))}

      {saudacao ? (
        <div className="absolute bottom-16 left-0 right-0 px-10 text-center">
          <h2 className="mb-2 text-2xl font-bold text-white md:text-3xl">
            Seja bem-vindo à sua base de controle
          </h2>
          <p className="text-base text-white/80 md:text-lg">
            Entre para continuar no sistema
          </p>
        </div>
      ) : null}
    </div>
  )
}
