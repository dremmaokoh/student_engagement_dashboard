import { useEffect, useState } from "react";

const SLIDES = [
  {
    image: "/auth/lecturer-student-conversation.jpg",
    position: "center 42%",
    kicker: "Higher education insight",
    title: "Empowering Better Learning Outcomes",
    description:
      "Understand student engagement and identify opportunities to improve academic participation.",
  },
  {
    image: "/auth/lecturer-student-support.jpg",
    position: "center 48%",
    kicker: "Student support",
    title: "Every Student Matters",
    description: "Monitor student activity and identify learners who may need additional support.",
  },
  {
    image: "/auth/students-library-laptops.jpg",
    position: "center 50%",
    kicker: "Actionable engagement",
    title: "Turn Data Into Action",
    description: "Give lecturers meaningful insights into student engagement across their courses.",
  },
  {
    image: "/auth/lecturer-lecture-hall.jpg",
    position: "center 40%",
    kicker: "Evidence-led teaching",
    title: "Supporting Academic Excellence",
    description: "Make informed decisions through clear, evidence-based engagement insights.",
  },
];

const ROTATION_MS = 6000;

function ArrowIcon({ direction }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {direction === "previous" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
}

export default function AuthCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setReducedMotion(query.matches);

    syncPreference();
    query.addEventListener?.("change", syncPreference);
    return () => query.removeEventListener?.("change", syncPreference);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % SLIDES.length);
    }, ROTATION_MS);

    return () => window.clearTimeout(timer);
  }, [activeIndex, paused, reducedMotion, cycle]);

  function goTo(index) {
    setActiveIndex((index + SLIDES.length) % SLIDES.length);
    setCycle((current) => current + 1);
  }

  function handleBlur(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setPaused(false);
    }
  }

  return (
    <div
      className="auth-carousel"
      data-paused={paused ? "true" : "false"}
      aria-roledescription="carousel"
      aria-label="Student engagement highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={handleBlur}
    >
      <div className="auth-carousel__media" aria-hidden="true">
        {SLIDES.map((slide, index) => (
          <img
            key={slide.image}
            className={`auth-carousel__image${index === activeIndex ? " is-active" : ""}`}
            src={slide.image}
            alt=""
            style={{ objectPosition: slide.position }}
            loading={index === 0 ? "eager" : "lazy"}
            decoding="async"
          />
        ))}
        <div className="auth-carousel__scrim" />
      </div>

      <div className="auth-carousel__content">
        <div className="auth-carousel__kicker">{SLIDES[activeIndex].kicker}</div>

        <div className="auth-carousel__slides">
          {SLIDES.map((slide, index) => (
            <div
              key={slide.title}
              className={`auth-carousel__slide${index === activeIndex ? " is-active" : ""}`}
              aria-hidden={index !== activeIndex}
            >
              <h2>{slide.title}</h2>
              <p>{slide.description}</p>
            </div>
          ))}
        </div>

        <div className="auth-carousel__footer">
          <div className="auth-carousel__controls">
            <button
              type="button"
              className="auth-carousel__arrow"
              onClick={() => goTo(activeIndex - 1)}
              aria-label="Previous slide"
            >
              <ArrowIcon direction="previous" />
            </button>
            <button
              type="button"
              className="auth-carousel__arrow"
              onClick={() => goTo(activeIndex + 1)}
              aria-label="Next slide"
            >
              <ArrowIcon direction="next" />
            </button>
          </div>

          <div className="auth-carousel__indicators" aria-label="Choose a slide">
            {SLIDES.map((slide, index) => (
              <button
                key={slide.title}
                type="button"
                className={`auth-carousel__indicator${index === activeIndex ? " is-active" : ""}`}
                onClick={() => goTo(index)}
                aria-label={`Show slide ${index + 1}: ${slide.title}`}
                aria-current={index === activeIndex ? "true" : undefined}
              />
            ))}
          </div>

          <span className="auth-carousel__count" aria-hidden="true">
            {String(activeIndex + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
          </span>
        </div>
      </div>
    </div>
  );
}
