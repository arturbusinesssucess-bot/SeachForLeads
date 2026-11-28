import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export interface FluxProgress {
  label: string;
  value?: number;
}

const ease = [0.22, 1, 0.36, 1] as const;

// Adapted from Ruixen UI's Progressive Flux Loader for the workspace.
export function ProgressiveFluxLoader({ label, value }: FluxProgress) {
  const reduced = useReducedMotion();
  const current = typeof value === "number" ? Math.max(0, Math.min(100, value)) : undefined;
  const determined = current !== undefined;
  const rounded = determined ? Math.round(current) : undefined;

  return (
    <div className="flux-loader">
      <div className="flux-loader-label" aria-hidden="true">
        {reduced ? <span className="flux-loader-text">{label}</span> : (
          <AnimatePresence mode="wait">
            <motion.span
              key={label}
              className="flux-loader-text"
              initial={{ opacity: 0, z: -380, scale: 0.65, filter: "blur(14px)" }}
              animate={{ opacity: [0, 1, 1, 1], z: [-380, 60, -8, 0], scale: [0.65, 1.08, 0.985, 1], filter: ["blur(14px)", "blur(0px)", "blur(0px)", "blur(0px)"] }}
              exit={{ opacity: 0, z: 220, scale: 1.35, filter: "blur(10px)", transition: { duration: 0.28 } }}
              transition={{ duration: 0.9, ease }}
            >
              {label.split(" ").map((word, wordIndex) => (
                <span className="flux-loader-word" key={wordIndex}>
                  {Array.from(word, (letter, letterIndex) => (
                    <motion.span
                      key={letterIndex}
                      initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ duration: 0.4, ease, delay: 0.12 + wordIndex * 0.07 + letterIndex * 0.027 }}
                    >
                      {letter}
                    </motion.span>
                  ))}
                </span>
              ))}
            </motion.span>
          </AnimatePresence>
        )}
      </div>
      <div
        className="flux-loader-track"
        role="progressbar"
        aria-label="Progresso da busca"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rounded}
        aria-valuetext={determined ? `${rounded}% · ${label}` : label}
        data-indeterminate={determined ? undefined : ""}
      >
        <motion.div
          className="flux-loader-fill"
          initial={false}
          animate={{ width: determined ? `${current}%` : "36%" }}
          transition={{ duration: reduced ? 0 : 0.55, ease }}
        >
          {!reduced && <span className="flux-loader-sheen" />}
        </motion.div>
      </div>
    </div>
  );
}
