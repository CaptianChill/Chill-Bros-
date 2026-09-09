"use client";

import { useEffect, useRef } from "react";

const TINTS = [
  ["#7ec8ff", "rgba(126,200,255,.85)"], ["#7ec8ff", "rgba(126,200,255,.85)"], ["#7ec8ff", "rgba(126,200,255,.85)"],
  ["#5dffa8", "rgba(93,255,168,.85)"], ["#5dffa8", "rgba(93,255,168,.85)"], ["#5dffa8", "rgba(93,255,168,.85)"],
  ["#ffffff", "rgba(215,240,255,.85)"], ["#ffffff", "rgba(215,240,255,.85)"],
  ["#a7f0ff", "rgba(167,240,255,.8)"],
  ["#c9b8ff", "rgba(201,184,255,.75)"],
  ["#ffe6b8", "rgba(255,230,184,.7)"],
] as const;

const DIRS = [
  [520,240,25],[-520,260,155],[480,-300,-32],[-460,-280,212],
  [120,600,79],[-140,580,104],[600,60,6],[-600,80,174],
] as const;

const HEADS = [
  ["#ffffff", "rgba(126,200,255,.8)"],
  ["#5dffa8", "rgba(93,255,168,.8)"],
  ["#a7f0ff", "rgba(167,240,255,.8)"],
  ["#c9b8ff", "rgba(201,184,255,.7)"],
] as const;

const STAR_COUNT = 260;
const COMET_COUNT = 14;

function populate(sky: HTMLDivElement) {
  const frag = document.createDocumentFragment();

  for (let i = 0; i < STAR_COUNT; i += 1) {
    const s = document.createElement("div");
    s.className = "st";
    const [core, halo] = TINTS[Math.floor(Math.random() * TINTS.length)];
    const size = (Math.random() * 2.1 + 0.7).toFixed(1);
    s.style.cssText =
      `width:${size}px;height:${size}px;` +
      `top:${(Math.random() * 100).toFixed(2)}%;left:${(Math.random() * 100).toFixed(2)}%;` +
      `background:${core};box-shadow:0 0 ${(Math.random() * 5 + 2).toFixed(1)}px ${halo};` +
      `animation-delay:${(Math.random() * 3.5).toFixed(2)}s;` +
      `animation-duration:${(Math.random() * 2.8 + 1.8).toFixed(2)}s`;
    frag.appendChild(s);
  }

  for (let j = 0; j < COMET_COUNT; j += 1) {
    const c = document.createElement("div");
    c.className = "cm";
    const [dx, dy, r] = DIRS[j % DIRS.length];
    const [head, tail] = HEADS[Math.floor(Math.random() * HEADS.length)];
    const len = (Math.random() * 80 + 85).toFixed(0);
    c.style.cssText =
      `width:${len}px;` +
      `top:${(Math.random() * 100).toFixed(1)}%;left:${(Math.random() * 100).toFixed(1)}%;` +
      `background:linear-gradient(90deg,transparent,${tail},${head});` +
      `--dx:${dx}px;--dy:${dy}px;--r:${r}deg;` +
      `animation-delay:${(Math.random() * 7).toFixed(2)}s;` +
      `animation-duration:${(Math.random() * 4 + 4).toFixed(2)}s`;
    frag.appendChild(c);
  }

  sky.appendChild(frag);
}

export function StarfieldSky() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sky = ref.current;
    if (!sky) return;
    populate(sky);
    return () => {
      sky.replaceChildren();
    };
  }, []);

  return <div ref={ref} className="starfield-sky" aria-hidden="true" />;
}
