import { Children, useEffect, useRef, useState, type ReactNode } from "react";

interface KpiCarouselProps {
  children: ReactNode;
  label: string;
  desktopColumns?: 1 | 3 | 4;
}

const desktopGrid = {
  1: "md:grid-cols-1",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

/** Una sola instancia de cada KPI: carrusel móvil y grilla desde 768px. */
export default function KpiCarousel({ children, label, desktopColumns = 3 }: KpiCarouselProps) {
  const slides = Children.toArray(children);
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const multiple = slides.length > 1;

  const slidePosition = (track: HTMLDivElement, index: number) => {
    const slide = track.children[index] as HTMLElement | undefined;
    if (!slide) return 0;
    const center = slide.offsetLeft + slide.offsetWidth / 2 - track.clientWidth / 2;
    return Math.max(0, Math.min(center, track.scrollWidth - track.clientWidth));
  };

  const updateActive = () => {
    const track = trackRef.current;
    if (!track) return;
    let closest = 0;
    let distance = Infinity;
    Array.from(track.children).forEach((_, index) => {
      const nextDistance = Math.abs(slidePosition(track, index) - track.scrollLeft);
      if (nextDistance < distance) { closest = index; distance = nextDistance; }
    });
    setActive(closest);
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new ResizeObserver(updateActive);
    observer.observe(track);
    updateActive();
    return () => observer.disconnect();
  }, [slides.length]);

  const goTo = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({
      left: slidePosition(track, Math.max(0, Math.min(index, slides.length - 1))),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

  return (
    <div className="min-w-0 max-w-full">
      <div
        ref={trackRef}
        role="region"
        aria-label={label}
        tabIndex={multiple ? 0 : undefined}
        onScroll={updateActive}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || window.matchMedia("(min-width: 768px)").matches) return;
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            goTo(active + (event.key === "ArrowRight" ? 1 : -1));
          }
        }}
        className={`relative flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 md:grid md:gap-4 md:overflow-visible md:pb-0 ${desktopGrid[desktopColumns]}`}
      >
        {slides.map((slide, index) => (
          <div key={index} className={`min-w-0 shrink-0 snap-center [&>*]:h-full ${multiple ? "w-[88%] max-w-[320px]" : "w-full"} md:w-auto md:max-w-none`}>
            {slide}
          </div>
        ))}
      </div>
      {multiple && (
        <div role="group" aria-label={`Navegar ${label.toLocaleLowerCase("es-CO")}`} className="mt-1 flex justify-center gap-1 md:hidden">
          {slides.map((_, index) => (
            <button key={index} type="button" onClick={() => goTo(index)} aria-label={`Ver métrica ${index + 1} de ${slides.length}`} aria-current={active === index ? "true" : undefined} className="flex h-8 w-8 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
              <span aria-hidden="true" className={`h-1.5 rounded-full transition-all motion-reduce:transition-none ${active === index ? "w-4 bg-orange-600" : "w-1.5 bg-zinc-300"}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
