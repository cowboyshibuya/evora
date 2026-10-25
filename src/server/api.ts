import { env } from "cloudflare:workers";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { addMonths, addYears, format, parseISO } from "date-fns";
import { database, initializeLocalDatabase } from "./db";
import { getAuth } from "./auth";
import { AUTH_PROVIDERS } from "../lib/auth-providers";
import { companies, entries, memberships, user, invitations } from "./schema";
import { seedDemo } from "./seed";
import { companyInput, entryInput } from "../lib/validation";
import { calculateInvoiceTotals } from "../lib/invoices";
import { COMPANY_LOGO_MAX_BYTES, companyLogoError } from "../lib/company-logo";
import { canEditRecords, canManageCompany } from "../lib/permissions";

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}
const safeBody = async (request: Request) => {
  const text = await new Response(limitedBody(request, 1_000_000)).text();
  return JSON.parse(text);
};

function limitedBody(request: Request, limit: number) {
  let bytes = 0;
  return (
    request.body?.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          bytes += chunk.byteLength;
          if (bytes > limit)
            controller.error(new HttpError(413, "This upload is too large."));
          else controller.enqueue(chunk);
        },
      }),
    ) ?? null
  );
}

async function readCompanyRequest(request: Request) {
  if (!request.headers.get("content-type")?.includes("multipart/form-data"))
    return {
      input: companyInput.parse(await safeBody(request)),
      logo: undefined,
      removeLogo: false,
    };
  const limit = COMPANY_LOGO_MAX_BYTES + 64 * 1024;
  if (Number(request.headers.get("content-length")) > limit)
    fail(413, "Choose a company logo smaller than 2 MB.");
  const form = await new Response(limitedBody(request, limit), {
    headers: { "Content-Type": request.headers.get("content-type") || "" },
  }).formData();
  const file = form.get("logo");
  if (file !== null && !(file instanceof File))
    fail(400, "Choose an image to upload.");
  const logo = file instanceof File ? file : undefined;
  const removeLogo = form.get("removeLogo") === "true";
  if (logo && removeLogo)
    fail(400, "Choose a logo or remove the existing one.");
  if (logo) {
    const error = companyLogoError(logo);
    if (error) fail(logo.size > COMPANY_LOGO_MAX_BYTES ? 413 : 400, error);
  }
  return {
    input: companyInput.parse(JSON.parse(String(form.get("company") || "{}"))),
    logo,
    removeLogo,
  };
}

async function storeCompanyLogo(companyId: string, file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const png =
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  const jpeg =
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255;
  const webp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!(
    (file.type === "image/png" && png) ||
    (file.type === "image/jpeg" && jpeg) ||
    (file.type === "image/webp" && webp)
  ))
    fail(400, "This file is not a valid PNG, JPEG, or WebP image.");
  const key = `${companyId}/logos/${crypto.randomUUID()}`;
  await env.FILES.put(key, bytes, { httpMetadata: { contentType: file.type } });
  return key;
}

export async function handleApi(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url),
      path = url.pathname.replace(/^\/api\/?/, ""),
      method = request.method;
    if (!["GET", "HEAD"].includes(method)) {
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin && origin !== env.APP_URL)
        fail(
          403,
          "This request could not be verified. Refresh the page and try again.",
        );
    }
    await initializeLocalDatabase();
    const auth = getAuth(request),
      db = database();
    // Better Auth's disabledPaths matches literal paths. Block the legacy
    // parameterized reset callback here as well as its disabled POST endpoint.
    if (path.startsWith("auth/reset-password/"))
      return json({ error: "Not found." }, 404);
    if (path.startsWith("auth/")) return auth.handler(request);
    if (path === "health") return json({ ok: true });
    if (path === "auth-providers" && method === "GET") {
      return json({
        providers: AUTH_PROVIDERS.filter(({ id }) =>
          Boolean(auth.options.socialProviders?.[id]),
        ).map(({ id }) => id),
      });
    }
    const identity = await auth.api.getSession({ headers: request.headers });
    if (!identity)
      return json(
        { error: "Sign in to continue.", code: "UNAUTHENTICATED" },
        401,
      );
    const userId = identity.user.id;
    if (path === "demo" && method === "POST") {
      if (!identity.user.isAnonymous)
        fail(400, "Demo data is available in demo workspaces only.");
      const existing = await db
        .select()
        .from(memberships)
        .where(eq(memberships.userId, userId));
      if (!existing.length) await seedDemo(userId);
      return json({ ok: true });
    }
    if (path === "companies" && method === "POST") {
      const { input, logo } = await readCompanyRequest(request);
      const id = crypto.randomUUID();
      const logoKey = logo ? await storeCompanyLogo(id, logo) : "";
      try {
        await db.batch([
          db.insert(companies).values({
            ...input,
            id,
            logoKey,
            createdAt: new Date().toISOString(),
          }),
          db.insert(memberships).values({
            id: crypto.randomUUID(),
            companyId: id,
            userId,
            role: "owner",
          }),
        ]);
      } catch (error) {
        if (logoKey) await env.FILES.delete(logoKey);
        throw error;
      }
      return json({ id }, 201);
    }
    if (path === "invitations/accept" && method === "POST") {
      const { token } = z
        .object({ token: z.string().min(20).max(200) })
        .parse(await safeBody(request));
      const invite = (
        await db.select().from(invitations).where(eq(invitations.token, token))
      )[0];
      if (!invite || invite.expiresAt < new Date().toISOString())
        fail(400, "This invitation has expired or has already been accepted.");
      if (
        identity.user.email.toLowerCase() !== invite.email.toLowerCase() ||
        identity.user.isAnonymous ||
        !identity.user.emailVerified
      )
        fail(
          403,
          "Sign in to Google or GitHub with the verified email address this invitation was created for.",
        );
      await db.batch([
        db
          .insert(memberships)
          .values({
            id: crypto.randomUUID(),
            companyId: invite.companyId,
            userId,
            role: invite.role,
          })
          .onConflictDoNothing(),
        db.delete(invitations).where(eq(invitations.id, invite.id)),
      ]);
      return json({ companyId: invite.companyId });
    }
    const companyList = await db
      .select({ company: companies, role: memberships.role })
      .from(memberships)
      .innerJoin(companies, eq(companies.id, memberships.companyId))
      .where(eq(memberships.userId, userId))
      .orderBy(asc(companies.createdAt));
    const companyId =
      url.searchParams.get("company") || companyList[0]?.company.id;
    const membership = companyList.find((c) => c.company.id === companyId);
    if (companyId && !membership)
      fail(403, "You do not have access to this company.");
    const role = membership?.role;
    const requireWrite = () => {
      if (!companyId || !canEditRecords(role))
        fail(
          403,
          "Your role allows viewing only. Ask an administrator for edit access.",
        );
    };
    const requireAdmin = () => {
      if (!canManageCompany(role))
        fail(403, "Only company administrators can make this change.");
    };
    if (path === "workspace" && method === "GET") {
      return json({
        user: {
          id: userId,
          name: identity.user.name,
          email: identity.user.email,
          isAnonymous: identity.user.isAnonymous,
        },
        companies: companyList.map((c) => ({ ...c.company, role: c.role })),
        company: membership ? { ...membership.company, role } : null,
        entries: companyId
          ? await db
              .select()
              .from(entries)
              .where(eq(entries.companyId, companyId))
              .orderBy(desc(entries.createdAt))
          : [],
        members: companyId
          ? await db
              .select({
                id: memberships.id,
                name: user.name,
                email: user.email,
                role: memberships.role,
              })
              .from(memberships)
              .innerJoin(user, eq(memberships.userId, user.id))
              .where(eq(memberships.companyId, companyId))
          : [],
      });
    }
    if (!companyId || !membership)
      fail(400, "Create a company to get started.");
    if (path === "company/logo" && method === "GET") {
      if (!membership.company.logoKey) fail(404, "This company has no logo.");
      const logo = await env.FILES.get(membership.company.logoKey);
      if (!logo) fail(404, "The company logo could not be found.");
      return new Response(logo.body, {
        headers: {
          "Content-Type":
            logo.httpMetadata?.contentType || "application/octet-stream",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (path === "company" && method === "PUT") {
      requireAdmin();
      const { input, logo, removeLogo } = await readCompanyRequest(request);
      if (
        input.currency !== membership.company.currency &&
        (
          await db
            .select({ id: entries.id, kind: entries.kind })
            .from(entries)
            .where(eq(entries.companyId, companyId))
        ).some(
          (entry) => entry.kind === "transaction" || entry.kind === "invoice",
        )
      )
        fail(
          400,
          "Currency cannot be changed after invoices or financial transactions have been recorded. Create a separate company for another currency.",
        );
      const oldLogoKey = membership.company.logoKey;
      const logoKey = logo
        ? await storeCompanyLogo(companyId, logo)
        : removeLogo
          ? ""
          : oldLogoKey;
      try {
        const updated = await db
          .update(companies)
          .set({ ...input, logoKey })
          .where(
            and(eq(companies.id, companyId), eq(companies.logoKey, oldLogoKey)),
          )
          .returning({ id: companies.id });
        if (!updated.length)
          fail(
            409,
            "Company details changed elsewhere. Refresh and try again.",
          );
      } catch (error) {
        if (logoKey && logoKey !== oldLogoKey) await env.FILES.delete(logoKey);
        throw error;
      }
      if (oldLogoKey && oldLogoKey !== logoKey)
        await env.FILES.delete(oldLogoKey);
      return json({ ok: true });
    }
    if (path === "invitations" && method === "POST") {
      requireAdmin();
      if (identity.user.isAnonymous)
        fail(403, "Create an account before inviting your team.");
      const input = z
        .object({
          email: z.email(),
          role: z.enum(["admin", "member", "viewer"]),
        })
        .parse(await safeBody(request));
      const token = crypto.randomUUID() + crypto.randomUUID(),
        inviteUrl = `${import.meta.env.DEV ? url.origin : env.APP_URL}/?invite=${token}`;
      await db.insert(invitations).values({
        ...input,
        email: input.email.toLowerCase(),
        id: crypto.randomUUID(),
        companyId,
        token,
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      });
      return json({ url: inviteUrl }, 201);
    }
    if (
      path.startsWith("members/") &&
      (method === "DELETE" || method === "PUT")
    ) {
      requireAdmin();
      const id = path.split("/")[1],
        member = (
          await db
            .select()
            .from(memberships)
            .where(
              and(eq(memberships.id, id), eq(memberships.companyId, companyId)),
            )
        )[0];
      if (!member) fail(404, "Member not found.");
      if (member.role === "owner" || member.userId === userId)
        fail(
          400,
          "The company owner and your own membership cannot be changed here.",
        );
      if (method === "DELETE")
        await db.delete(memberships).where(eq(memberships.id, id));
      else {
        const input = z
          .object({ role: z.enum(["admin", "member", "viewer"]) })
          .parse(await safeBody(request));
        await db.update(memberships).set(input).where(eq(memberships.id, id));
      }
      return json({ ok: true });
    }
    if (path === "upload" && method === "POST") {
      requireWrite();
      if (Number(request.headers.get("content-length")) > 21 * 1048576)
        fail(413, "Choose a file smaller than 20 MB.");
      const form = await new Response(limitedBody(request, 21 * 1048576), {
          headers: {
            "Content-Type": request.headers.get("content-type") || "",
          },
        }).formData(),
        file = form.get("file");
      if (!(file instanceof File) || !file.size)
        fail(400, "Choose a file to upload.");
      if (file.size > 20 * 1048576)
        fail(413, "Choose a file smaller than 20 MB.");
      const id = crypto.randomUUID(),
        key = `${companyId}/${id}`,
        now = new Date().toISOString();
      await env.FILES.put(key, file.stream(), {
        httpMetadata: { contentType: file.type || "application/octet-stream" },
      });
      try {
        await db.insert(entries).values({
          id,
          companyId,
          kind: "document",
          title: file.name.slice(0, 240),
          date: z.iso.date().parse(form.get("date") || now.slice(0, 10)),
          amount: 0,
          category: String(form.get("folder") || "Company").slice(0, 100),
          status: "active",
          data: { key, size: file.size, mime: file.type },
          createdAt: now,
          updatedAt: now,
        });
      } catch (error) {
        await env.FILES.delete(key);
        throw error;
      }
      return json({ id }, 201);
    }
    if (path === "import" && method === "POST") {
      requireWrite();
      const input = z
        .object({
          hash: z.string().regex(/^[a-f0-9]{64}$/),
          records: z.array(entryInput).min(1).max(100),
        })
        .parse(await safeBody(request));
      if (
        input.records.some(
          (record) => record.kind !== "transaction" || record.data.invoiceId,
        )
      )
        fail(400, "Only independent transactions can be imported.");
      const existing = await db
        .select({ id: entries.id })
        .from(entries)
        .where(eq(entries.id, `import_${companyId}_${input.hash}_0`))
        .limit(1);
      if (existing.length)
        fail(409, "This file has already been imported into this company.");
      const now = new Date().toISOString();
      const statements = input.records.map((record, i) =>
        db.insert(entries).values({
          ...record,
          id: `import_${companyId}_${input.hash}_${i}`,
          companyId,
          createdAt: now,
          updatedAt: now,
        }),
      );
      await db.batch([statements[0], ...statements.slice(1)]);
      return json({ imported: input.records.length }, 201);
    }
    if (path === "entries" && method === "POST") {
      requireWrite();
      const input = entryInput.parse(await safeBody(request));
      if (input.kind === "transaction" && input.data.invoiceId)
        fail(400, "Use Record payment to create invoice payment records.");
      if (input.kind === "document")
        fail(400, "Use file upload to add a document.");
      if (input.kind === "invoice" && input.status === "paid")
        fail(400, "Create the invoice first, then record the payment.");
      normalizeInvoice(input);
      const id = crypto.randomUUID(),
        now = new Date().toISOString();
      await db
        .insert(entries)
        .values({ ...input, id, companyId, createdAt: now, updatedAt: now });
      return json({ id }, 201);
    }
    if (path.startsWith("entries/")) {
      const [, id, action] = path.split("/"),
        record = (
          await db
            .select()
            .from(entries)
            .where(and(eq(entries.id, id), eq(entries.companyId, companyId)))
        )[0];
      if (!record) fail(404, "This item no longer exists.");
      if (
        method === "GET" &&
        action === "download" &&
        record.kind === "document"
      ) {
        const file = await env.FILES.get(String(record.data.key));
        if (!file) fail(404, "The file could not be found.");
        return new Response(file.body, {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(record.title)}`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      requireWrite();
      if (method === "POST" && action === "pay" && record.kind === "invoice") {
        if (!["sent", "overdue", "paid"].includes(record.status))
          fail(400, "Mark the invoice as sent before recording payment.");
        const now = new Date().toISOString();
        // Read the invoice inside the atomic batch so a concurrent edit cannot
        // post an outdated amount or overwrite newer invoice details.
        const results = await env.DB.batch([
          env.DB.prepare(
            `INSERT INTO entries (id, company_id, kind, title, date, amount, category, status, data, created_at, updated_at)
            SELECT 'payment_' || id, company_id, 'transaction',
              json_extract(data, '$.client') || ' · ' || json_extract(data, '$.number'), ?,
              CASE WHEN json_extract(data, '$.direction') = 'payable' THEN -amount ELSE amount END,
              CASE WHEN json_extract(data, '$.direction') = 'payable' THEN category ELSE 'Client work' END,
              'completed', json_object('counterparty', json_extract(data, '$.client'), 'invoiceId', id, 'method', 'Bank transfer'), ?, ?
            FROM entries WHERE id = ? AND company_id = ? AND kind = 'invoice' AND status IN ('sent', 'overdue', 'paid')
            ON CONFLICT(id) DO NOTHING`,
          ).bind(now.slice(0, 10), now, now, id, companyId),
          env.DB.prepare(
            `UPDATE entries SET status = 'paid', data = json_set(data, '$.paidAt', ?), updated_at = ?
            WHERE id = ? AND company_id = ? AND kind = 'invoice' AND status IN ('sent', 'overdue', 'paid')`,
          ).bind(now, now, id, companyId),
        ]);
        if (!results[1].meta.changes)
          fail(
            409,
            "This invoice changed. Refresh it before recording payment.",
          );
        return json({ ok: true });
      }
      if (
        (record.kind === "invoice" && record.status === "paid") ||
        record.data.invoiceId
      )
        fail(
          400,
          "Recorded invoice payments are locked to keep your accounts consistent.",
        );
      const editableRecordScope = and(
        eq(entries.id, id),
        eq(entries.companyId, companyId),
        eq(entries.updatedAt, record.updatedAt),
        record.kind === "invoice" ? ne(entries.status, "paid") : undefined,
      );
      if (method === "PUT") {
        const input = entryInput.parse(await safeBody(request));
        if (input.kind === "transaction" && input.data.invoiceId)
          fail(400, "Invoice links cannot be added to manual transactions.");
        if (input.kind !== record.kind)
          fail(400, "The item type cannot be changed.");
        if (record.kind === "document") input.data = record.data;
        normalizeInvoice(input);
        if (input.kind === "invoice" && input.status === "paid")
          fail(400, "Use Record payment to mark an invoice as paid.");
        if (
          input.kind === "event" &&
          input.status === "done" &&
          record.status !== "done" &&
          ["monthly", "yearly"].includes(String(input.data.recurrence))
        ) {
          const now = new Date().toISOString(),
            nextDate = format(
              input.data.recurrence === "yearly"
                ? addYears(parseISO(input.date), 1)
                : addMonths(parseISO(input.date), 1),
              "yyyy-MM-dd",
            );
          await db.batch([
            db
              .update(entries)
              .set({ ...input, updatedAt: now })
              .where(and(eq(entries.id, id), eq(entries.companyId, companyId))),
            db
              .insert(entries)
              .values({
                ...input,
                id: `repeat_${id}`,
                companyId,
                status: "pending",
                date: nextDate,
                createdAt: now,
                updatedAt: now,
              })
              .onConflictDoNothing(),
          ]);
          return json({ ok: true });
        }
        const updated = await db
          .update(entries)
          .set({ ...input, updatedAt: new Date().toISOString() })
          .where(editableRecordScope)
          .run();
        if (!updated.meta.changes)
          fail(
            409,
            "This item changed while you were editing. Refresh it and try again.",
          );
        return json({ ok: true });
      }
      if (method === "DELETE") {
        const removed = await db
          .delete(entries)
          .where(editableRecordScope)
          .run();
        if (!removed.meta.changes)
          fail(409, "This item changed. Refresh it before deleting.");
        if (record.kind === "document")
          await env.FILES.delete(String(record.data.key));
        return json({ ok: true });
      }
    }
    fail(404, "This endpoint could not be found.");
  } catch (error) {
    if (error instanceof z.ZodError)
      return json(
        {
          error:
            error.issues[0]?.message || "Check the information you entered.",
        },
        400,
      );
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    if (error instanceof SyntaxError)
      return json({ error: "The request contains invalid JSON." }, 400);
    const detail =
      error instanceof Error
        ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`
        : "";
    if (detail.includes("UNIQUE constraint failed"))
      return json(
        {
          error:
            "This invoice number or imported record already exists. Choose a unique invoice number.",
        },
        409,
      );
    console.error(
      "Evora API request failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return json(
      { error: "Unable to complete this request. Please try again." },
      500,
    );
  }
}

function normalizeInvoice(input: z.infer<typeof entryInput>) {
  if (input.kind !== "invoice") return;
  const lines = z
    .array(
      z.object({
        description: z.string().min(1).max(500),
        quantity: z.number().positive().max(100000),
        unitPrice: z.number().int().nonnegative().max(999999999),
      }),
    )
    .min(1)
    .max(100)
    .parse(input.data.lines);
  const taxRate = z
    .number()
    .min(0)
    .max(100)
    .parse(input.data.taxRate ?? 0);
  const direction = z
    .enum(["receivable", "payable"])
    .parse(input.data.direction ?? "receivable");
  const totals = calculateInvoiceTotals(lines, taxRate);
  input.amount = z
    .number()
    .int()
    .nonnegative()
    .max(999999999999, "This invoice exceeds the supported amount.")
    .parse(totals.total);
  const client = z.string().trim().min(1).max(240).parse(input.data.client);
  const number = z.string().trim().min(1).max(80).parse(input.data.number);
  const clientEmail = z
    .union([z.email(), z.literal("")])
    .parse(input.data.clientEmail ?? "");
  const issuedDate = z.iso.date().parse(input.data.issuedDate ?? input.date);
  if (input.date < issuedDate)
    fail(400, "The due date must be on or after the issue date.");
  input.data = {
    ...input.data,
    client,
    clientEmail,
    number,
    issuedDate,
    lines,
    taxRate,
    direction,
  };
}
