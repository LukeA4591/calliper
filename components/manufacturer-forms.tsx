"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Globe2,
  LockKeyhole,
  Save,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  saveManufacturer,
  setManufacturerPublication,
} from "@/app/manufacturer/actions";
import {
  materials,
  processes,
  processLabels,
  type ManufacturerProfile,
  type ProfileMachine,
} from "@/lib/manufacturing/schemas";

export function BusinessForm({
  profile,
  userId,
  machines,
}: {
  machines: ProfileMachine[];
  profile?: ManufacturerProfile;
  userId: string;
}) {
  const [state, action, pending] = useActionState(saveManufacturer, {});
  const [equipment, setEquipment] = useState(machines);
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.success || state.error) {
      feedback.current?.focus({ preventScroll: true });
      feedback.current?.scrollIntoView({ block: "center" });
    }
  }, [state]);
  return (
    <form
      action={action}
      className="manufacturer-form"
      onReset={(event) => event.preventDefault()}
    >
      <input name="account_context" type="hidden" value={userId} />
      <section className="manufacturer-card" id="business-details">
        <div className="manufacturer-section-heading">
          <span>01</span>
          <div>
            <h2>Your business</h2>
            <p>The details engineers will see on your profile.</p>
          </div>
        </div>
        <div className="manufacturer-fields">
          <label>
            Business name <span>Required</span>
            <input
              name="business_name"
              required
              maxLength={160}
              defaultValue={profile?.business_name}
              placeholder="Your workshop or company name"
              autoComplete="organization"
            />
          </label>
          <label>
            Location <span>Required</span>
            <input
              name="location"
              required
              maxLength={240}
              defaultValue={profile?.location}
              placeholder="City, region, country"
            />
          </label>
          <label>
            Business contact email <span>Required</span>
            <input
              name="contact_email"
              type="email"
              required
              maxLength={254}
              defaultValue={profile?.contact_email}
              placeholder="hello@yourbusiness.co.nz"
              autoComplete="email"
            />
          </label>
          <label>
            Phone <span>Optional</span>
            <input
              name="contact_phone"
              type="tel"
              maxLength={60}
              defaultValue={profile?.contact_phone}
              placeholder="Business phone number"
              autoComplete="tel"
            />
          </label>
          <label className="manufacturer-full-width">
            About your business <span>Optional</span>
            <textarea
              name="description"
              rows={3}
              maxLength={2000}
              defaultValue={profile?.description}
              placeholder="Tell engineers what you make and the work you do best."
            />
          </label>
        </div>
      </section>
      <section className="manufacturer-card" id="business-capabilities">
        <div className="manufacturer-section-heading">
          <span>02</span>
          <div>
            <h2>What you can make</h2>
            <p>
              Name your machines, choose their type, and add each working
              envelope.
            </p>
          </div>
        </div>
        <input
          type="hidden"
          name="machines"
          value={JSON.stringify(equipment)}
        />
        <div className="manufacturer-machines">
          {equipment.map((machine, index) => (
            <fieldset className="manufacturer-machine" key={machine.id}>
              <legend>Machine {index + 1}</legend>
              <label>
                Machine name <span>Required</span>
                <input
                  required
                  maxLength={160}
                  placeholder="e.g. kirax PC - 30w3"
                  value={machine.name}
                  onChange={(event) =>
                    setEquipment((rows) =>
                      rows.map((row) =>
                        row.id === machine.id
                          ? { ...row, name: event.target.value }
                          : row,
                      ),
                    )
                  }
                />
              </label>
              <fieldset className="manufacturer-machine-types">
                <legend>Machine type</legend>
                <p className="manufacturer-hint">
                  Select the type that best describes this machine.
                </p>
                <div className="manufacturer-options">
                  {processes.map((process) => (
                    <label key={process}>
                      <input
                        type="radio"
                        name={`machine-type-${machine.id}`}
                        value={process}
                        checked={machine.category === process}
                        onChange={() =>
                          setEquipment((rows) =>
                            rows.map((row) =>
                              row.id === machine.id
                                ? { ...row, category: process }
                                : row,
                            ),
                          )
                        }
                      />
                      <span>{processLabels[process]}</span>
                      <Check size={16} aria-hidden="true" />
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>Maximum part size (mm)</legend>
                <p className="manufacturer-hint">
                  This machine’s x, y and z limits. Leave unknown values blank.
                </p>
                <div className="manufacturer-dimensions">
                  {(["x", "y", "z"] as const).map((axis) => (
                    <label key={axis}>
                      {axis} axis (mm)
                      <input
                        type="number"
                        min="0.001"
                        max="1000000"
                        step="any"
                        placeholder="Not specified"
                        value={machine[`max_${axis}_mm`] ?? ""}
                        onChange={(event) =>
                          setEquipment((rows) =>
                            rows.map((row) =>
                              row.id === machine.id
                                ? {
                                    ...row,
                                    [`max_${axis}_mm`]:
                                      event.target.value === ""
                                        ? null
                                        : Number(event.target.value),
                                  }
                                : row,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setEquipment((rows) =>
                    rows.filter((row) => row.id !== machine.id),
                  )
                }
              >
                <Trash2 aria-hidden="true" />
                Remove machine {index + 1}
              </Button>
            </fieldset>
          ))}
          {!equipment.length && (
            <p className="manufacturer-machine-empty">
              Add your first machine to show engineers what you can make.
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={equipment.length >= 50 || pending}
            onClick={() =>
              setEquipment((rows) => [
                ...rows,
                {
                  id: crypto.randomUUID(),
                  name: "",
                  category: "cnc_milling_3_axis",
                  max_x_mm: null,
                  max_y_mm: null,
                  max_z_mm: null,
                },
              ])
            }
          >
            <Plus aria-hidden="true" />
            Add machine
          </Button>
          <p className="manufacturer-hint">
            Machine changes are saved with your business profile.
          </p>
        </div>
        <fieldset>
          <legend>Business materials & grades</legend>
          <div className="manufacturer-options">
            {materials.map((m) => (
              <label key={m}>
                <input
                  type="checkbox"
                  name="materials"
                  value={m}
                  defaultChecked={profile?.materials.includes(m)}
                />
                <span>{m}</span>
                <Check size={16} aria-hidden="true" />
              </label>
            ))}
          </div>
          <label className="manufacturer-other-materials">
            Other materials or grades <span>Optional</span>
            <input
              name="other_materials"
              maxLength={1000}
              defaultValue={profile?.materials
                .filter((m) => !materials.some((v) => v === m))
                .join(", ")}
              placeholder="Separate each material with a comma"
            />
          </label>
        </fieldset>
        <label className="manufacturer-tolerance">
          Smallest achievable ± tolerance (mm) <span>Optional</span>
          <input
            name="tolerance_mm"
            type="number"
            min="0.000001"
            max="1000"
            step="any"
            placeholder="e.g. 0.01"
            defaultValue={profile?.tolerance_mm ?? ""}
          />
          <small>For ±0.01 mm, enter 0.01. Leave blank if unknown.</small>
        </label>
      </section>
      <section className="manufacturer-card" id="business-capacity">
        <div className="manufacturer-section-heading">
          <span>03</span>
          <div>
            <h2>Working with you</h2>
            <p>Help engineers understand the work you can take on.</p>
          </div>
        </div>
        <label>
          Capacity & lead times <span>Optional</span>
          <textarea
            name="capacity_notes"
            rows={3}
            maxLength={1000}
            defaultValue={profile?.capacity_notes}
            placeholder="Typical quantities, turnaround times or current availability."
          />
        </label>
        <label>
          Limitations & additional notes <span>Optional</span>
          <textarea
            name="limitations"
            rows={3}
            maxLength={2000}
            defaultValue={profile?.limitations}
            placeholder="Anything an engineer should discuss with you before sending a job."
          />
        </label>
      </section>
      <div className="manufacturer-save-bar">
        <p>
          {profile?.published
            ? "Saving updates your published business profile."
            : "Save your details first. Publish when you’re ready."}
        </p>
        <Button disabled={pending} size="lg">
          <Save aria-hidden="true" />
          {pending ? "Saving…" : "Save business profile"}
        </Button>
      </div>
      {(state.error || state.success) && (
        <div
          ref={feedback}
          tabIndex={-1}
          className={`manufacturer-feedback ${state.error ? "text-danger" : "text-success"}`}
          role={state.error ? "alert" : "status"}
        >
          <p>{state.error || "Your business details have been saved."}</p>
          {state.success && !profile?.published && (
            <a href="#publish-profile">
              Ready to share? Publish your profile{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          )}
        </div>
      )}
    </form>
  );
}

export function PublicationForm({
  userId,
  published,
  hasProfile,
}: {
  userId: string;
  published: boolean;
  hasProfile: boolean;
}) {
  const [state, action, pending] = useActionState(
    setManufacturerPublication,
    {},
  );
  return (
    <form action={action} className="manufacturer-publication">
      <input name="account_context" type="hidden" value={userId} />
      <input
        name="intent"
        type="hidden"
        value={published ? "unpublish" : "publish"}
      />
      <div className="manufacturer-visibility-icon">
        {published ? (
          <Globe2 size={22} aria-hidden="true" />
        ) : (
          <LockKeyhole size={22} aria-hidden="true" />
        )}
      </div>
      <h2>{published ? "Your profile is live" : "Ready when you are"}</h2>
      <p>
        {published
          ? "Verified Calliper users can see your saved business details and capabilities."
          : hasProfile
            ? "Your draft is saved. Publish it to share your business details and capabilities with verified Calliper users."
            : "Save your business profile, then publish it here when you’re ready to share it."}
      </p>
      <Button
        variant={published ? "outline" : "default"}
        disabled={pending || !hasProfile}
      >
        {pending
          ? "Updating…"
          : published
            ? "Unpublish profile"
            : "Publish profile"}
        {!published && <ArrowRight aria-hidden="true" />}
      </Button>
      <small>
        {published
          ? "Unpublishing makes your profile private again."
          : "Your profile stays private until you publish."}
      </small>
      {(state.error || state.success) && (
        <p
          className={state.error ? "text-danger" : "text-success"}
          role={state.error ? "alert" : "status"}
        >
          {state.error || state.success}
        </p>
      )}
    </form>
  );
}
