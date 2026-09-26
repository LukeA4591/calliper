import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { createFixture } from "../lib/forge/fixture";
import { analysisSchema } from "../lib/forge/types";
import { checkIds } from "../lib/forge/review-schema";
import {
  groundDrawingReview,
  applyDrawingReview,
} from "../lib/forge/drawing-review";
export async function testManufacturingDatabase(local: Record<string, string>) {
  assert.equal(new URL(local.API_URL).hostname, "127.0.0.1");
  assert.equal(new URL(local.API_URL).port, "55431");
  const admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const clients = Array.from({ length: 4 }, () =>
    createClient(local.API_URL, local.PUBLISHABLE_KEY || local.ANON_KEY, {
      auth: { persistSession: false },
    }),
  );
  const ids: string[] = [];
  const password = "Local-Test-Password-123!";
  try {
    for (let i = 0; i < 4; i++) {
      const email = `forge-role-${Date.now()}-${i}@example.test`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { account_type: i < 2 ? "manufacturer" : "designer" },
      });
      assert.equal(error, null);
      ids.push(data.user!.id);
      assert.equal(
        (await clients[i].auth.signInWithPassword({ email, password })).error,
        null,
      );
    }
    const [maker, other, designer, otherDesigner] = clients;
    const profile = {
      business_name: "Isolated test manufacturer",
      contact_email: "business@example.test",
      location: "Test city",
      processes: ["cnc_milling_3_axis"],
      materials: ["Aluminium 6061-T6"],
    };
    for (let i = 0; i < 2; i++)
      assert.equal(
        (
          await clients[i]
            .from("manufacturer_profiles")
            .insert({ ...profile, user_id: ids[i] })
        ).error,
        null,
      );
    assert.equal(
      (await other.from("manufacturer_profiles").select().eq("user_id", ids[0]))
        .data?.length,
      0,
    );
    assert.ok(
      (
        await designer
          .from("manufacturer_profiles")
          .insert({ ...profile, user_id: ids[2] })
      ).error,
    );
    assert.ok(
      (
        await maker
          .from("manufacturer_profiles")
          .insert({ ...profile, user_id: ids[3] })
      ).error,
    );
    assert.equal(
      (
        await other
          .from("manufacturer_profiles")
          .update({ business_name: "Intrusion" })
          .eq("user_id", ids[0])
          .select()
      ).data?.length,
      0,
    );
    assert.equal(
      (
        await other
          .from("manufacturer_profiles")
          .delete()
          .eq("user_id", ids[0])
          .select()
      ).data?.length,
      0,
    );
    assert.ok(
      (
        await maker
          .from("manufacturer_profiles")
          .update({ user_id: ids[1] })
          .eq("user_id", ids[0])
      ).error,
    );
    const { data: machine, error } = await maker
      .from("machines")
      .insert({
        manufacturer_id: ids[0],
        name: "Test mill",
        category: "cnc_milling_3_axis",
        processes: ["cnc_milling_3_axis"],
        max_x_mm: 500,
      })
      .select()
      .single();
    assert.equal(error, null);
    assert.equal(
      (await other.from("machines").select().eq("id", machine.id)).data?.length,
      0,
    );
    assert.ok(
      (
        await other.from("machines").insert({
          manufacturer_id: ids[0],
          name: "Forged",
          category: "cnc_milling_3_axis",
          processes: ["cnc_milling_3_axis"],
        })
      ).error,
    );
    assert.ok(
      (
        await maker
          .from("machines")
          .update({ manufacturer_id: ids[1] })
          .eq("id", machine.id)
      ).error,
    );
    assert.ok(
      (
        await maker
          .from("machines")
          .update({ max_x_mm: -1 })
          .eq("id", machine.id)
      ).error,
    );
    assert.equal(
      (
        await maker
          .from("manufacturer_profiles")
          .update({ published: true })
          .eq("user_id", ids[0])
      ).error,
      null,
    );
    assert.equal(
      (await designer.from("machines").select().eq("id", machine.id)).data
        ?.length,
      1,
    );
    assert.equal(
      (
        await other
          .from("machines")
          .update({ name: "Intrusion" })
          .eq("id", machine.id)
          .select()
      ).data?.length,
      0,
    );
    assert.equal(
      (await other.from("machines").delete().eq("id", machine.id).select()).data
        ?.length,
      0,
    );
    assert.equal(
      (
        await maker
          .from("machines")
          .update({ name: "Updated mill" })
          .eq("id", machine.id)
      ).error,
      null,
    );
    // The complete-profile RPC must keep ownership and roll back all partial writes.
    const machinePayload = {
      id: machine.id,
      name: "Updated mill",
      category: "cnc_milling_3_axis",
      max_x_mm: 500,
      max_y_mm: null,
      max_z_mm: null,
    };
    assert.ok(
      (
        await other.rpc("save_manufacturer_profile", {
          business: { ...profile, business_name: "Must roll back" },
          equipment: [machinePayload],
        })
      ).error,
    );
    assert.equal(
      (
        await other
          .from("manufacturer_profiles")
          .select("business_name")
          .eq("user_id", ids[1])
          .single()
      ).data?.business_name,
      profile.business_name,
    );
    assert.ok(
      (
        await designer.rpc("save_manufacturer_profile", {
          business: profile,
          equipment: [],
        })
      ).error,
    );
    assert.ok(
      (
        await maker.rpc("save_manufacturer_profile", {
          business: { ...profile, business_name: "Invalid sizes" },
          equipment: [{ ...machinePayload, max_x_mm: -1 }],
        })
      ).error,
    );
    assert.equal(
      (
        await maker
          .from("manufacturer_profiles")
          .select("business_name")
          .eq("user_id", ids[0])
          .single()
      ).data?.business_name,
      profile.business_name,
    );
    assert.equal(
      (
        await maker
          .from("machines")
          .select("max_x_mm")
          .eq("id", machine.id)
          .single()
      ).data?.max_x_mm,
      500,
    );
    const fixture = createFixture();
    const review = groundDrawingReview(
      {
        manufacturing: {
          summary: "No route recommended.",
          processes: [],
          material: { stated: null, quote: "" },
        },
        pageAudits: [
          {
            page: 1,
            holeCalloutCount: 0,
            toleranceCalloutCount: 0,
            holeScanComplete: false,
            toleranceScanComplete: false,
            limitations: ["Synthetic persistence test"],
          },
        ],
        checks: checkIds.map((id) => ({
          id,
          outcome: "not_assessed",
          summary: "Synthetic persistence test",
          observations: [],
        })),
        warnings: ["Synthetic integration result; no AI request was sent."],
      },
      {
        consent: true,
        sourceFileId: fixture.pdfFileId,
        units: "mm",
        pages: [
          {
            page: 1,
            image: "data:image/jpeg;base64,/9j/AAAA",
            spans: [],
            textTruncated: false,
          },
        ],
      },
      2,
      "test-model",
      "test-review",
    );
    const record = {
      owner_id: ids[2],
      id: "test-analysis",
      data: { ...applyDrawingReview(fixture, review), id: "test-analysis" },
    };
    assert.equal((await designer.from("analyses").insert(record)).error, null);
    const savedReview = await designer
      .from("analyses")
      .select("data")
      .eq("id", record.id)
      .single();
    assert.equal(savedReview.error, null);
    assert.deepEqual(
      analysisSchema.parse(savedReview.data?.data).review,
      review.review,
    );
    assert.equal(
      (await designer.from("analyses").select().eq("id", record.id)).data
        ?.length,
      1,
    );
    assert.equal(
      (await otherDesigner.from("analyses").select().eq("id", record.id)).data
        ?.length,
      0,
    );
    assert.ok(
      (
        await otherDesigner
          .from("analyses")
          .insert({ ...record, id: "forged", data: { id: "forged" } })
      ).error,
    );
    assert.ok(
      (await maker.from("analyses").insert({ ...record, owner_id: ids[0] }))
        .error,
    );
    assert.equal(
      (
        await otherDesigner
          .from("analyses")
          .update({ data: { id: record.id } })
          .eq("id", record.id)
          .select()
      ).data?.length,
      0,
    );
    assert.equal(
      (
        await otherDesigner
          .from("analyses")
          .delete()
          .eq("id", record.id)
          .select()
      ).data?.length,
      0,
    );
    assert.ok(
      (
        await designer
          .from("analyses")
          .update({ owner_id: ids[3] })
          .eq("id", record.id)
      ).error,
    );
    assert.ok(
      (
        await designer
          .from("account_roles")
          .update({ role: "manufacturer" })
          .eq("user_id", ids[2])
      ).error,
    );
    assert.ok(
      (
        await designer
          .from("account_roles")
          .insert({ user_id: ids[3], role: "manufacturer" })
      ).error,
    );
    assert.equal(
      (await designer.from("account_roles").select().eq("user_id", ids[0])).data
        ?.length,
      0,
    );
    assert.equal(
      (
        await designer.auth.updateUser({
          data: { account_type: "manufacturer" },
        })
      ).error,
      null,
    );
    assert.equal(
      (
        await designer
          .from("account_roles")
          .select()
          .eq("user_id", ids[2])
          .single()
      ).data?.role,
      "designer",
    );
    const anonymous = createClient(
      local.API_URL,
      local.PUBLISHABLE_KEY || local.ANON_KEY,
      { auth: { persistSession: false } },
    );
    for (const table of [
      "account_roles",
      "manufacturer_profiles",
      "machines",
      "analyses",
    ])
      assert.ok(
        (await anonymous.from(table).select()).error,
        `${table} denies anonymous reads`,
      );
    const email = `unverified-${Date.now()}@example.test`;
    const { data: u } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { account_type: "manufacturer" },
    });
    ids.push(u.user!.id);
    assert.ok(
      (await anonymous.auth.signInWithPassword({ email, password })).error,
      "Unverified accounts cannot sign in",
    );
    assert.match(ids[0], /^[a-f0-9-]{36}$/);
    const sql = (statement: string) =>
      execFileSync(
        "docker",
        [
          "exec",
          "supabase_db_saasathon-starter",
          "psql",
          "-U",
          "postgres",
          "-d",
          "postgres",
          "-c",
          statement,
        ],
        { stdio: "ignore" },
      );
    sql(`update auth.users set email_confirmed_at=null where id='${ids[0]}'`);
    assert.equal(
      (await maker.from("account_roles").select()).data?.length,
      0,
      "A still-issued session cannot bypass revoked email verification",
    );
    assert.equal(
      (await maker.from("manufacturer_profiles").select()).data?.length,
      0,
    );
    assert.equal((await maker.from("machines").select()).data?.length, 0);
    assert.equal(
      (
        await maker
          .from("manufacturer_profiles")
          .update({ business_name: "Unverified write" })
          .eq("user_id", ids[0])
          .select()
      ).data?.length,
      0,
    );
    sql(`update auth.users set email_confirmed_at=now() where id='${ids[0]}'`);
    assert.equal(
      (await maker.from("machines").delete().eq("id", machine.id)).error,
      null,
    );
    assert.equal(
      (await designer.from("analyses").delete().eq("id", record.id)).error,
      null,
    );
    console.log(
      "PASS: roles, manufacturer drafts/publication, equipment and analyses enforce verified access and two-account isolation; metadata edits cannot elevate roles",
    );
  } finally {
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  }
}
