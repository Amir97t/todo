import { memo } from "react";
import useTheme from "../../context/useTheme";

const STARS = [
  { left: "7%", top: "13%", size: 2, opacity: 0.65 },
  { left: "13%", top: "27%", size: 1.5, opacity: 0.45 },
  { left: "18%", top: "9%", size: 2.5, opacity: 0.7 },
  { left: "24%", top: "20%", size: 1.5, opacity: 0.5 },
  { left: "31%", top: "12%", size: 2, opacity: 0.55 },
  { left: "37%", top: "30%", size: 1.5, opacity: 0.4 },
  { left: "44%", top: "8%", size: 2, opacity: 0.7 },
  { left: "52%", top: "18%", size: 1.5, opacity: 0.5 },
  { left: "59%", top: "11%", size: 2.5, opacity: 0.7 },
  { left: "67%", top: "23%", size: 1.5, opacity: 0.45 },
  { left: "74%", top: "9%", size: 2, opacity: 0.6 },
  { left: "82%", top: "18%", size: 1.5, opacity: 0.45 },
  { left: "91%", top: "12%", size: 2.5, opacity: 0.65 },

  { left: "9%", top: "39%", size: 1.5, opacity: 0.4 },
  { left: "16%", top: "48%", size: 2, opacity: 0.55 },
  { left: "28%", top: "42%", size: 1.5, opacity: 0.45 },
  { left: "35%", top: "55%", size: 2, opacity: 0.6 },
  { left: "47%", top: "39%", size: 1.5, opacity: 0.4 },
  { left: "56%", top: "51%", size: 2, opacity: 0.55 },
  { left: "64%", top: "42%", size: 1.5, opacity: 0.45 },
  { left: "72%", top: "56%", size: 2, opacity: 0.6 },
  { left: "84%", top: "43%", size: 1.5, opacity: 0.45 },
  { left: "94%", top: "50%", size: 2, opacity: 0.55 },

  { left: "4%", top: "68%", size: 1.5, opacity: 0.35 },
  { left: "12%", top: "78%", size: 2, opacity: 0.5 },
  { left: "23%", top: "71%", size: 1.5, opacity: 0.4 },
  { left: "34%", top: "82%", size: 2, opacity: 0.45 },
  { left: "48%", top: "70%", size: 1.5, opacity: 0.35 },
  { left: "58%", top: "84%", size: 2, opacity: 0.5 },
  { left: "69%", top: "73%", size: 1.5, opacity: 0.4 },
  { left: "79%", top: "82%", size: 2, opacity: 0.5 },
  { left: "89%", top: "69%", size: 1.5, opacity: 0.35 },
  { left: "96%", top: "80%", size: 2, opacity: 0.45 },
];

const CRATERS = [
  { left: "22%", top: "26%", size: "17%" },
  { left: "59%", top: "18%", size: "12%" },
  { left: "46%", top: "53%", size: "20%" },
  { left: "72%", top: "64%", size: "13%" },
  { left: "18%", top: "63%", size: "10%" },
  { left: "62%", top: "43%", size: "9%" },
];

const CLOUDS = [
  {
    left: "-4%",
    top: "22%",
    width: "240px",
    height: "70px",
    opacity: 0.45,
    scale: 1,
  },
  {
    left: "26%",
    top: "12%",
    width: "190px",
    height: "58px",
    opacity: 0.3,
    scale: 0.85,
  },
  {
    right: "-5%",
    top: "30%",
    width: "280px",
    height: "78px",
    opacity: 0.38,
    scale: 1.1,
  },
];

function CelestialBackground() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 select-none overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      {/* Light sky */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${
          isDark ? "opacity-0" : "opacity-100"
        }`}
        style={{
          background: `
            linear-gradient(
              180deg,
              #78c8ed 0%,
              #b8e2f2 42%,
              #f8edd0 100%
            )
          `,
        }}
      />

      {/* Dark sky */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${
          isDark ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background: `
            radial-gradient(
              circle at 75% 24%,
              rgba(72, 85, 150, 0.22),
              transparent 30%
            ),
            linear-gradient(
              180deg,
              #080d25 0%,
              #111735 48%,
              #191b3a 100%
            )
          `,
        }}
      />

      {/* Soft light in the lower sky */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${
          isDark ? "opacity-0" : "opacity-100"
        }`}
        style={{
          background:
            "radial-gradient(circle at 50% 100%, rgba(255,248,220,0.55), transparent 48%)",
        }}
      />

      {/* Stars */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${
          isDark ? "opacity-100" : "opacity-0"
        }`}
      >
        {STARS.map((star, index) => (
          <span
            key={index}
            className="absolute rounded-full bg-white"
            style={{
              left: star.left,
              top: star.top,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              boxShadow:
                star.size >= 2 ? "0 0 5px rgba(255,255,255,0.35)" : undefined,
            }}
          />
        ))}
      </div>

      {/* Soft atmospheric dust */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${
          isDark ? "opacity-100" : "opacity-40"
        }`}
        style={{
          backgroundImage: `
            radial-gradient(
              circle at 17% 34%,
              rgba(255,255,255,0.1) 0 1px,
              transparent 2px
            ),
            radial-gradient(
              circle at 71% 62%,
              rgba(255,255,255,0.08) 0 1px,
              transparent 2px
            ),
            radial-gradient(
              circle at 43% 76%,
              rgba(255,255,255,0.06) 0 1px,
              transparent 2px
            )
          `,
          backgroundSize: "180px 180px, 240px 240px, 300px 300px",
        }}
      />

      {/* Sun */}
      <div
        className={`absolute transition-all duration-700 ${
          isDark ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
        }`}
        style={{
          top: "clamp(70px, 11vh, 150px)",
          right: "clamp(-50px, 6vw, 110px)",
          width: "clamp(130px, 15vw, 230px)",
          height: "clamp(130px, 15vw, 230px)",
        }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,220,1) 0%, rgba(255,218,84,1) 30%, rgba(255,171,45,0.95) 60%, rgba(255,171,45,0) 72%)",
            filter: "drop-shadow(0 0 24px rgba(255,185,50,0.45))",
          }}
        />

        <div
          className="absolute inset-[20%] rounded-full"
          style={{
            background:
              "radial-gradient(circle at 38% 35%, #fffbe0 0%, #ffe76b 38%, #ffc12d 72%)",
          }}
        />

        <span className="absolute left-1/2 top-1/2 h-[150%] w-px -translate-x-1/2 -translate-y-1/2 rotate-45 bg-amber-200/20" />
        <span className="absolute left-1/2 top-1/2 h-[150%] w-px -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-amber-200/20" />
      </div>

      {/* Moon */}
      <div
        className={`absolute transition-all duration-700 ${
          isDark ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
        }`}
        style={{
          top: "clamp(90px, 13vh, 170px)",
          right: "clamp(-35px, 8vw, 120px)",
          width: "clamp(125px, 14vw, 210px)",
          height: "clamp(125px, 14vw, 210px)",
        }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(217,225,255,0.32) 0%, rgba(138,157,223,0.18) 45%, rgba(138,157,223,0) 72%)",
            filter: "drop-shadow(0 0 22px rgba(140,165,255,0.25))",
          }}
        />

        <div
          className="absolute inset-[18%] overflow-hidden rounded-full"
          style={{
            background:
              "radial-gradient(circle at 36% 30%, #f8f8f4 0%, #dddcd9 58%, #c4c3c4 100%)",
            boxShadow:
              "inset -14px -12px 24px rgba(90,95,120,0.18), 0 0 18px rgba(215,225,255,0.16)",
          }}
        >
          {CRATERS.map((crater, index) => (
            <span
              key={index}
              className="absolute rounded-full"
              style={{
                left: crater.left,
                top: crater.top,
                width: crater.size,
                height: crater.size,
                background:
                  "radial-gradient(circle at 35% 30%, rgba(120,122,130,0.10), rgba(100,103,112,0.20))",
                boxShadow: "inset -2px -2px 4px rgba(70,72,80,0.08)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Clouds */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${
          isDark ? "opacity-0" : "opacity-100"
        }`}
      >
        {CLOUDS.map((cloud, index) => (
          <div
            key={index}
            className="absolute rounded-full"
            style={{
              left: cloud.left,
              right: cloud.right,
              top: cloud.top,
              width: cloud.width,
              height: cloud.height,
              opacity: cloud.opacity,
              transform: `scale(${cloud.scale})`,
              background: `
                radial-gradient(
                  circle at 24% 65%,
                  rgba(255,255,255,0.9) 0 24%,
                  transparent 25%
                ),
                radial-gradient(
                  circle at 44% 42%,
                  rgba(255,255,255,0.95) 0 30%,
                  transparent 31%
                ),
                radial-gradient(
                  circle at 66% 58%,
                  rgba(255,255,255,0.9) 0 27%,
                  transparent 28%
                ),
                linear-gradient(
                  180deg,
                  rgba(255,255,255,0.88),
                  rgba(255,255,255,0.3)
                )
              `,
              filter: "blur(0.4px)",
            }}
          />
        ))}
      </div>

      {/* Very subtle bottom glow */}
      <div
        className="absolute inset-x-0 bottom-0 h-[32%]"
        style={{
          background: isDark
            ? "linear-gradient(to top, rgba(15,17,45,0.2), transparent)"
            : "linear-gradient(to top, rgba(255,249,225,0.25), transparent)",
        }}
      />
    </div>
  );
}

export default memo(CelestialBackground);
