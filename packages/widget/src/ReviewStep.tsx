import type { WidgetConfig } from "./config";
import { translate } from "./i18n";
import type { CapturedImage, DetailsData } from "./flow/state";

interface ReviewStepProps {
  config: WidgetConfig;
  details: DetailsData;
  images: Partial<Record<"id_capture" | "selfie", CapturedImage>>;
  errors: Record<string, string>;
  submitting: boolean;
  onEdit: (step: "details" | "id_capture" | "selfie") => void;
  onSubmit: () => void;
}

export function ReviewStep({
  config,
  details,
  images,
  errors,
  submitting,
  onEdit,
  onSubmit,
}: ReviewStepProps) {
  const hasDetailsStep = config.steps.includes("details");
  return (
    <section className="ow-review">
      {hasDetailsStep && (
        <section aria-labelledby="ow-review-details">
          <div className="ow-review-heading">
            <h2 id="ow-review-details">{translate(config, "details")}</h2>
            <button
              className="ow-muted"
              type="button"
              onClick={() => onEdit("details")}
            >
              {translate(config, "edit")}
            </button>
          </div>
          <dl>
            <dt>{translate(config, "fullName")}</dt>
            <dd>{details.fullName || "—"}</dd>
            <dt>{translate(config, "dateOfBirth")}</dt>
            <dd>{details.dateOfBirth || "—"}</dd>
            <dt>{translate(config, "country")}</dt>
            <dd>{details.country || "—"}</dd>
            <dt>{translate(config, "email")}</dt>
            <dd>{details.email || "—"}</dd>
          </dl>
        </section>
      )}
      {(["id_capture", "selfie"] as const).map((step) => {
        if (!config.steps.includes(step)) return null;
        const image = images[step];
        return (
          <section key={step} aria-labelledby={`ow-review-${step}`}>
            <div className="ow-review-heading">
              <h2 id={`ow-review-${step}`}>{translate(config, step)}</h2>
              <button
                className="ow-muted"
                type="button"
                onClick={() => onEdit(step)}
              >
                {image
                  ? translate(config, "retake")
                  : translate(config, "edit")}
              </button>
            </div>
            {image ? (
              <img
                className="ow-review-image"
                src={image.previewUrl}
                alt={translate(config, step)}
              />
            ) : (
              <p>—</p>
            )}
          </section>
        );
      })}
      {errors.submit && (
        <p className="ow-error" role="alert">
          {errors.submit}
        </p>
      )}
      <div className="ow-actions">
        <button
          className="ow-primary"
          type="button"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting
            ? translate(config, "submitting")
            : translate(config, "submit")}
        </button>
      </div>
    </section>
  );
}
