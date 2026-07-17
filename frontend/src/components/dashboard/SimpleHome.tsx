import { ArrowRight, Plus } from "lucide-react";
import type { ReactNode } from "react";

import type { TranslationKey } from "../../i18n";

type Translate = (key: TranslationKey) => string;

type SimpleHomeProps = {
  children: ReactNode;
  hasChannel: boolean;
  onAddChannel: () => void;
  onOpenAdvanced: () => void;
  t: Translate;
};

const onboardingSteps = [
  {
    detail: "simpleHome.step1.detail",
    title: "simpleHome.step1.title",
  },
  {
    detail: "simpleHome.step2.detail",
    title: "simpleHome.step2.title",
  },
  {
    detail: "simpleHome.step3.detail",
    title: "simpleHome.step3.title",
  },
] as const satisfies ReadonlyArray<{
  detail: TranslationKey;
  title: TranslationKey;
}>;

export function SimpleHome({
  children,
  hasChannel,
  onAddChannel,
  onOpenAdvanced,
  t,
}: SimpleHomeProps) {
  return (
    <div className="simple-home" data-channel-state={hasChannel ? "ready" : "empty"}>
      <header className="simple-home__hero">
        <div className="simple-home__intro">
          <h1>{t("simpleHome.title")}</h1>
          <p>{t("simpleHome.subtitle")}</p>
        </div>
        <button className="primary-action simple-home__add-channel" onClick={onAddChannel} type="button">
          <Plus aria-hidden="true" size={20} />
          {t("simpleHome.addChannel")}
        </button>
      </header>

      <section aria-label={t("simpleHome.steps.aria")} className="simple-home__onboarding">
        <ol>
          {onboardingSteps.map((step, index) => (
            <li className="simple-home-step" key={step.title}>
              <span aria-hidden="true" className="simple-home__step-number">{index + 1}</span>
              <div>
                <h3>{t(step.title)}</h3>
                <p>{t(step.detail)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="simple-home__content">{children}</div>

      <button className="simple-home__advanced" onClick={onOpenAdvanced} type="button">
        <span>
          <strong>{t("simpleHome.advanced")}</strong>
          <small>{t("simpleHome.advancedDetail")}</small>
        </span>
        <ArrowRight aria-hidden="true" size={17} />
      </button>
    </div>
  );
}
