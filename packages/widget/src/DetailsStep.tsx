import { memo, type FormEvent, type ChangeEvent } from "react";
import type { WidgetConfig } from "./config";
import { translate } from "./i18n";
import type { DetailsData } from "./flow/state";

interface DetailsStepProps {
  config: WidgetConfig;
  value: DetailsData;
  errors: Record<string, string>;
  onChange: (value: DetailsData) => void;
  onContinue: () => void;
}

const countries = [
  ["AU", "Australia"],
  ["CA", "Canada"],
  ["IN", "India"],
  ["GB", "United Kingdom"],
  ["US", "United States"],
] as const;

export const DetailsStep = memo(function DetailsStep({
  config,
  value,
  errors,
  onChange,
  onContinue,
}: DetailsStepProps) {
  const field = (key: keyof DetailsData, labelKey: string, type: string) => {
    const error = errors[key];
    const message = error ? translate(config, error) : "";
    return (
      <div className="ow-field">
        <label htmlFor={`ow-${key}`}>{translate(config, labelKey)}</label>
        <input
          id={`ow-${key}`}
          name={key}
          type={type}
          value={value[key]}
          autoComplete={key === "fullName" ? "name" : key === "email" ? "email" : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `ow-${key}-error` : undefined}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange({ ...value, [key]: event.currentTarget.value })
          }
        />
        {error && <span className="ow-error" id={`ow-${key}-error`}>{message}</span>}
      </div>
    );
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onContinue();
  };

  const countryError = errors.country;
  return (
    <form onSubmit={submit} noValidate>
      {field("fullName", "fullName", "text")}
      {field("dateOfBirth", "dateOfBirth", "date")}
      <div className="ow-field">
        <label htmlFor="ow-country">{translate(config, "country")}</label>
        <select
          id="ow-country"
          name="country"
          value={value.country}
          aria-invalid={Boolean(countryError)}
          aria-describedby={countryError ? "ow-country-error" : undefined}
          onChange={(event) => onChange({ ...value, country: event.currentTarget.value })}
        >
          <option value="">{translate(config, "selectCountry")}</option>
          {countries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
        {countryError && (
          <span className="ow-error" id="ow-country-error">
            {translate(config, countryError)}
          </span>
        )}
      </div>
      {field("email", "email", "email")}
      <div className="ow-live" aria-live="polite" aria-atomic="true">
        {Object.keys(errors).length > 0 && <span>{translate(config, "required")}</span>}
      </div>
      <div className="ow-actions">
        <button className="ow-primary" type="submit">{translate(config, "continue")}</button>
      </div>
    </form>
  );
});
