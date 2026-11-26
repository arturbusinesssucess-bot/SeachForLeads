import NumberFlow from "@number-flow/react";
import { Briefcase, CheckCheck, Database } from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

const plans = [
  {
    name: "Start",
    description: "Para começar a prospectar e organizar seus primeiros leads.",
    monthly: 3490,
    companies: 250,
    crm: 300,
  },
  {
    name: "Reach",
    description: "Para manter uma rotina de prospecção toda semana.",
    monthly: 4790,
    companies: 550,
    crm: 650,
    featured: true,
  },
  {
    name: "Expansion",
    description: "Para rodar mais campanhas e ampliar sua prospecção.",
    monthly: 6490,
    companies: 900,
    crm: 1100,
  },
];

const annualDiscount = 20;
const numbers = new Intl.NumberFormat("pt-BR");
const priceFormat = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
const included = ["CRM em lista e quadro", "Funil personalizável", "Analytics"];

export default function PricingSection({ surface = "app" }: { surface?: "app" | "landing" }) {
  const [yearly, setYearly] = useState(false);
  const reduceMotion = useReducedMotion();
  const onLanding = surface === "landing";
  const Title = onLanding ? motion.h2 : motion.h1;
  const reveal = (index: number) => {
    if (reduceMotion) return { initial: false as const };
    const initial = { opacity: 0, y: -20, filter: "blur(10px)" };
    const visible = { opacity: 1, y: 0, filter: "blur(0px)" };
    const transition = { delay: index * 0.25, duration: 0.5 };
    return onLanding
      ? { initial, whileInView: visible, transition, viewport: { once: true } }
      : { initial, animate: visible, transition };
  };

  return (
    <div className="plans-pricing">
      <header className="plans-pricing-heading">
        <Title id="plans-title" {...reveal(0)}>
          Escolha o plano certo para a sua{" "}
          <motion.span {...reveal(1)}>prospecção</motion.span>
        </Title>
        <motion.p {...reveal(2)}>Compare quantas empresas você pode encontrar e quantos leads pode salvar no CRM.</motion.p>
      </header>

      <motion.div className="plans-period-wrap" {...reveal(3)}>
        <LayoutGroup id="plans-period">
          <div className="plans-period" role="group" aria-label="Período de cobrança">
            {[false, true].map((annual) => (
              <button key={String(annual)} type="button" aria-pressed={yearly === annual} onClick={() => setYearly(annual)}>
                {yearly === annual && (reduceMotion
                  ? <span className="plans-period-highlight" aria-hidden="true" />
                  : <motion.span className="plans-period-highlight" layoutId="selected" aria-hidden="true"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }} />)}
                <span className="plans-period-label">
                  {annual ? "Anual" : "Mensal"}
                  {annual && <span className="plans-savings">≈{annualDiscount}% OFF</span>}
                </span>
              </button>
            ))}
          </div>
        </LayoutGroup>
      </motion.div>

      <div className="plans-cards">
        {plans.map((plan, index) => {
          const cents = yearly ? Math.round(plan.monthly * 12 * (100 - annualDiscount) / 10000) * 100 : plan.monthly;
          const price = cents / 100;
          const displayFormat = yearly ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : priceFormat;
          const priceText = `R$ ${price.toLocaleString("pt-BR", displayFormat)}`;
          return (
            <motion.article className={`plans-card${plan.featured ? " plans-card--featured" : ""}`}
              key={plan.name} aria-labelledby={`plan-${plan.name}`} {...reveal(4 + index)}>
              <header className="plans-card-heading">
                <div className="plans-card-title">
                  {onLanding ? <h3 id={`plan-${plan.name}`}>{plan.name}</h3> : <h2 id={`plan-${plan.name}`}>{plan.name}</h2>}
                  {plan.featured && <span>Recomendado</span>}
                </div>
                <p>{plan.description}</p>
                <div className="plans-card-price">
                  <span className="plans-card-amount" aria-hidden="true">
                    R$ <NumberFlow value={price} locales="pt-BR" format={displayFormat} animated={!reduceMotion} />
                  </span>
                  <span className="plans-sr-only">{priceText}</span>
                  <span className="plans-card-period">/{yearly ? "ano" : "mês"}</span>
                </div>
              </header>

              <div className="plans-card-body">
                <button type="button" className={`plans-cta app-button${plan.featured ? " app-button--primary" : ""}`}
                  disabled aria-describedby="plans-availability">
                  <svg className="app-button-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  <span className="app-button-label">{plan.featured ? "Testar por 30 dias" : `Assinar ${plan.name}`}</span>
                </button>
                <ul className="plans-card-quotas">
                  <li><Briefcase size={20} aria-hidden="true" /><span><strong>{numbers.format(plan.companies)}</strong> empresas novas por mês</span></li>
                  <li><Database size={20} aria-hidden="true" /><span><strong>{numbers.format(plan.crm)}</strong> leads salvos no CRM</span></li>
                </ul>
                <div className="plans-card-includes">
                  {onLanding ? <h4>Recursos do plano</h4> : <h3>Recursos do plano</h3>}
                  <ul>
                    {included.map((item) => (
                      <li key={item}><span className="plans-include-icon"><CheckCheck size={15} aria-hidden="true" /></span>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
      <p id="plans-availability" className="plans-availability">Assinaturas e teste grátis em breve.</p>
    </div>
  );
}
