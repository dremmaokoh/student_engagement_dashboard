import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CLASSIFICATION_FILTER_OPTIONS } from "../../lib/classificationTrend.js";

/**
 * Small searchable combobox for the trend chart. It is presentation-only: the
 * selected value is passed back to the chart, which decides which series to draw.
 */
export default function ClassificationTrendFilter({ value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const inputRef = useRef(null);
  const baseId = useId();
  const listId = `${baseId}-classification-options`;
  const labelId = `${baseId}-classification-label`;

  const selected =
    CLASSIFICATION_FILTER_OPTIONS.find((option) => option.value === value) || CLASSIFICATION_FILTER_OPTIONS[0];

  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return CLASSIFICATION_FILTER_OPTIONS;
    }
    return CLASSIFICATION_FILTER_OPTIONS.filter((option) => option.label.toLowerCase().includes(needle));
  }, [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  function openMenu() {
    if (disabled) {
      return;
    }
    setQuery("");
    setActiveIndex(Math.max(0, CLASSIFICATION_FILTER_OPTIONS.findIndex((option) => option.value === value)));
    setOpen(true);
  }

  function closeMenu(restoreFocus = false) {
    setOpen(false);
    setQuery("");
    if (restoreFocus) {
      buttonRef.current?.focus();
    }
  }

  function choose(option) {
    onChange(option.value);
    closeMenu(true);
  }

  function handleButtonKeyDown(event) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMenu();
    }
  }

  function handleInputKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (options.length ? (current + 1) % options.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (options.length ? (current - 1 + options.length) % options.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (options[activeIndex]) {
        choose(options[activeIndex]);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === "Tab") {
      closeMenu();
    }
  }

  const activeOption = options[activeIndex];

  return (
    <div className="classification-trend-filter" ref={containerRef}>
      <span className="classification-trend-filter-label" id={labelId}>
        Show
      </span>
      <button
        type="button"
        ref={buttonRef}
        className="classification-trend-filter-control"
        aria-label={`Classification filter: ${selected.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={handleButtonKeyDown}
      >
        <span className="classification-trend-filter-value">{selected.label}</span>
        <svg className="classification-trend-filter-caret" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1.5 5 5.5 9 1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      {open ? (
        <div className="classification-trend-filter-menu">
          <input
            ref={inputRef}
            type="search"
            className="classification-trend-filter-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search classifications"
            aria-label="Search classifications"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeOption ? `${listId}-${activeOption.value}` : undefined}
            autoComplete="off"
          />
          <ul className="classification-trend-filter-options" id={listId} role="listbox" aria-labelledby={labelId}>
            {options.map((option, index) => (
              <li
                key={option.value}
                id={`${listId}-${option.value}`}
                role="option"
                aria-selected={option.value === value}
                className={`classification-trend-filter-option ${index === activeIndex ? "is-active" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                <span
                  className="classification-trend-filter-swatch"
                  style={option.color ? { background: option.color } : undefined}
                  aria-hidden="true"
                />
                <span>{option.label}</span>
                {option.value === value ? <span className="classification-trend-filter-check">✓</span> : null}
              </li>
            ))}
            {options.length === 0 ? <li className="classification-trend-filter-empty">No matches</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
