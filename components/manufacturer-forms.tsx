"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  saveManufacturer,
  saveMachine,
  deleteMachine,
} from "@/app/manufacturer/actions";
import {
  materials,
  processes,
  processLabels,
  specialties,
  type ManufacturerProfile,
  type Machine,
} from "@/lib/manufacturing/schemas";
function Capabilities({
  value,
  machine = false,
}: {
  value?: Partial<ManufacturerProfile & Machine>;
  machine?: boolean;
}) {
  return (
    <>
      <fieldset>
        <legend>
          Supported processes{machine ? " (select at least one)" : ""}
        </legend>
        <div className="check-grid">
          {processes.map((p) => (
            <label key={p}>
              <input
                type="checkbox"
                name="processes"
                value={p}
                defaultChecked={value?.processes?.includes(p)}
              />
              {processLabels[p]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Materials and grades</legend>
        <div className="check-grid">
          {materials.map((m) => (
            <label key={m}>
              <input
                type="checkbox"
                name="materials"
                value={m}
                defaultChecked={value?.materials?.includes(m)}
              />
              {m}
            </label>
          ))}
        </div>
        <label>
          Other exact materials / grades (comma-separated)
          <input
            name="other_materials"
            maxLength={1000}
            defaultValue={value?.materials
              ?.filter((m) => !materials.some((v) => v === m))
              .join(", ")}
          />
        </label>
      </fieldset>
      <fieldset>
        <legend>
          {machine
            ? "Machine working envelope"
            : "Business-wide maximum part size"}{" "}
          (mm)
        </legend>
        <p>
          Leave unknown values blank. State axis limits as X, Y, Z; matching
          does not assume part rotation or multiple setups.
        </p>
        <div className="account-grid">
          {(["x", "y", "z"] as const).map((axis) => (
            <label key={axis}>
              {axis.toUpperCase()}
              <input
                name={`max_${axis}_mm`}
                type="number"
                min="0.001"
                max="1000000"
                step="any"
                defaultValue={value?.[`max_${axis}_mm`] ?? ""}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Smallest achievable ± tolerance (mm)
        <input
          name="tolerance_mm"
          type="number"
          min="0.000001"
          max="1000"
          step="any"
          defaultValue={value?.tolerance_mm ?? ""}
        />
        <small>For ±0.01 mm, enter 0.01. Leave blank if unknown.</small>
      </label>
    </>
  );
}
export function BusinessForm({
  profile,
  userId,
}: {
  profile?: ManufacturerProfile;
  userId: string;
}) {
  const [state, action, pending] = useActionState(saveManufacturer, {});
  return (
    <form className="account-form" action={action}>
      <input name="account_context" type="hidden" value={userId} />
      <div className="account-grid">
        <label>
          Business name
          <input
            name="business_name"
            required
            maxLength={160}
            defaultValue={profile?.business_name}
          />
        </label>
        <label>
          Location
          <input
            name="location"
            placeholder="City, region, country"
            required
            maxLength={240}
            defaultValue={profile?.location}
          />
        </label>
        <label>
          Business contact email
          <input
            name="contact_email"
            type="email"
            required
            maxLength={254}
            defaultValue={profile?.contact_email}
          />
        </label>
        <label>
          Phone (optional)
          <input
            name="contact_phone"
            maxLength={60}
            defaultValue={profile?.contact_phone}
          />
        </label>
      </div>
      <label>
        Business description
        <textarea
          name="description"
          maxLength={2000}
          defaultValue={profile?.description}
        />
      </label>
      <Capabilities value={profile} />
      <label>
        Production capacity / lead-time notes
        <textarea
          name="capacity_notes"
          maxLength={1000}
          defaultValue={profile?.capacity_notes}
        />
      </label>
      <label>
        Known business limitations
        <textarea
          name="limitations"
          maxLength={2000}
          defaultValue={profile?.limitations}
        />
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          name="published"
          defaultChecked={profile?.published}
        />
        Publish this business profile and equipment to verified Calliper users
      </label>
      <small>
        Your listed business contact details will be visible. Your login email
        is not included automatically.
      </small>
      <Button disabled={pending}>
        {pending ? "Saving…" : "Save business profile"}
      </Button>
      <p role={state.error ? "alert" : "status"}>
        {state.error || state.success}
      </p>
    </form>
  );
}
export function MachineForm({
  machine,
  userId,
}: {
  machine?: Machine;
  userId: string;
}) {
  const [state, action, pending] = useActionState(saveMachine, {});
  return (
    <form className="account-form" action={action}>
      <input name="account_context" type="hidden" value={userId} />
      {machine && <input name="id" type="hidden" value={machine.id} />}
      <div className="account-grid">
        <label>
          Machine name
          <input
            name="name"
            required
            maxLength={160}
            defaultValue={machine?.name}
          />
        </label>
        <label>
          Category
          <select
            name="category"
            defaultValue={machine?.category ?? "cnc_milling_3_axis"}
          >
            {processes.map((p) => (
              <option value={p} key={p}>
                {processLabels[p]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Manufacturer / brand
          <input name="brand" maxLength={120} defaultValue={machine?.brand} />
        </label>
        <label>
          Model
          <input name="model" maxLength={120} defaultValue={machine?.model} />
        </label>
      </div>
      <Capabilities value={machine} machine />
      <fieldset>
        <legend>Confirmed additional capabilities</legend>
        <div className="check-grid">
          {specialties.map((s) => (
            <label key={s}>
              <input
                type="checkbox"
                name="special_capabilities"
                value={s}
                defaultChecked={machine?.special_capabilities.includes(s)}
              />
              {s.replaceAll("_", " ")}
            </label>
          ))}
        </div>
        <small>
          An unchecked capability is unspecified, not a declaration that it is
          impossible.
        </small>
      </fieldset>
      <label>
        Limitations / equipment notes
        <textarea name="notes" maxLength={2000} defaultValue={machine?.notes} />
      </label>
      <Button disabled={pending}>
        {pending ? "Saving…" : machine ? "Save machine" : "Add machine"}
      </Button>
      <p role={state.error ? "alert" : "status"}>
        {state.error || state.success}
      </p>
    </form>
  );
}
export function RemoveMachine({ id, userId }: { id: string; userId: string }) {
  const [state, action, pending] = useActionState(deleteMachine, {});
  return (
    <details>
      <summary>Remove machine</summary>
      <p>This removes its declared capabilities from future matches.</p>
      <form action={action}>
        <input name="account_context" type="hidden" value={userId} />
        <input type="hidden" name="id" value={id} />
        <Button variant="outline" disabled={pending}>
          {pending ? "Removing…" : "Confirm removal"}
        </Button>
        <p role="status">{state.error || state.success}</p>
      </form>
    </details>
  );
}
