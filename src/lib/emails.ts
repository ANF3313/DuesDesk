import { Resend } from "resend";
import { formatCents } from "./money";
import { formatDateLong } from "./dates";

let client: Resend | null = null;

function getResend(): Resend {
  if (!client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    client = new Resend(key);
  }
  return client;
}

function from(): string {
  return process.env.EMAIL_FROM || "onboarding@resend.dev";
}

/** User-provided text is always escaped before it touches email HTML. */
function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shell(heading: string, inner: string, orgName: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f7f7f5;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <p style="font-size:13px;font-weight:600;color:#2c6446;margin:0 0 16px;">${esc(orgName)}</p>
    <div style="background:#ffffff;border:1px solid #e4e3de;border-radius:12px;padding:28px;">
      <h1 style="font-size:19px;color:#171613;margin:0 0 12px;">${heading}</h1>
      ${inner}
    </div>
    <p style="font-size:12px;color:#8a897f;margin:16px 4px 0;">Sent with DuesDesk on behalf of ${esc(orgName)}.</p>
  </div>
</body></html>`;
}

function payButton(payUrl: string): string {
  return `<a href="${payUrl}" style="display:inline-block;background:#2c6446;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:8px;margin-top:8px;">View &amp; pay online</a>
  <p style="font-size:12px;color:#8a897f;margin:16px 0 0;">Or copy this link into your browser:<br>${payUrl}</p>`;
}

const amountRow = (label: string, value: string) =>
  `<p style="font-size:14px;color:#52514a;margin:4px 0;">${label}: <strong style="color:#171613;">${value}</strong></p>`;

export async function sendInvoiceEmail(opts: {
  to: string;
  memberName: string;
  orgName: string;
  memo: string;
  amountCents: number;
  dueDate: string;
  payUrl: string;
}) {
  await getResend().emails.send({
    from: from(),
    to: opts.to,
    subject: `${opts.orgName}: ${opts.memo} — ${formatCents(opts.amountCents)} due ${formatDateLong(opts.dueDate)}`,
    html: shell(
      `Hi ${esc(opts.memberName)},`,
      `<p style="font-size:14px;color:#52514a;line-height:1.6;margin:0 0 16px;">You have a new balance from ${esc(opts.orgName)}.</p>
       ${amountRow("For", esc(opts.memo))}
       ${amountRow("Amount", formatCents(opts.amountCents))}
       ${amountRow("Due", formatDateLong(opts.dueDate))}
       ${payButton(opts.payUrl)}`,
      opts.orgName,
    ),
    text: `Hi ${opts.memberName},\n\nYou have a new balance from ${opts.orgName}.\n\nFor: ${opts.memo}\nAmount: ${formatCents(opts.amountCents)}\nDue: ${formatDateLong(opts.dueDate)}\n\nPay online: ${opts.payUrl}`,
  });
}

export async function sendReceiptEmail(opts: {
  to: string;
  memberName: string;
  orgName: string;
  memo: string;
  amountCents: number;
}) {
  await getResend().emails.send({
    from: from(),
    to: opts.to,
    subject: `Payment received — ${formatCents(opts.amountCents)} to ${opts.orgName}`,
    html: shell(
      "Payment received",
      `<p style="font-size:14px;color:#52514a;line-height:1.6;margin:0 0 16px;">Thanks, ${esc(opts.memberName)} — your payment went through.</p>
       ${amountRow("For", esc(opts.memo))}
       ${amountRow("Amount", formatCents(opts.amountCents))}
       <p style="font-size:13px;color:#8a897f;margin:16px 0 0;">Keep this email for your records.</p>`,
      opts.orgName,
    ),
    text: `Thanks, ${opts.memberName} — your payment of ${formatCents(opts.amountCents)} for "${opts.memo}" went through. Keep this email for your records.`,
  });
}

export async function sendPaymentIssueEmail(opts: {
  to: string;
  memberName: string;
  orgName: string;
  memo: string;
  amountCents: number;
  payUrl: string;
}) {
  await getResend().emails.send({
    from: from(),
    to: opts.to,
    subject: `Payment didn't go through — ${opts.orgName}`,
    html: shell(
      `Hi ${esc(opts.memberName)},`,
      `<p style="font-size:14px;color:#52514a;line-height:1.6;margin:0 0 16px;">Your bank payment of ${formatCents(opts.amountCents)} for “${esc(opts.memo)}” didn't go through. This usually means the bank declined the debit. Nothing was charged — you can try again below.</p>
       ${payButton(opts.payUrl)}`,
      opts.orgName,
    ),
    text: `Hi ${opts.memberName},\n\nYour bank payment of ${formatCents(opts.amountCents)} for "${opts.memo}" didn't go through. Nothing was charged — you can try again here: ${opts.payUrl}`,
  });
}

/** First-of-month summary to org staff: collected, outstanding, who's behind. */
export async function sendBoardDigestEmail(opts: {
  to: string[];
  orgName: string;
  monthLabel: string;
  collectedCents: number;
  outstandingCents: number;
  overdueLines: Array<{ label: string; memo: string; amountCents: number }>;
}) {
  const overdueHtml =
    opts.overdueLines.length === 0
      ? `<p style="font-size:14px;color:#167647;margin:12px 0 0;">Nothing overdue. Enjoy the quiet.</p>`
      : `<p style="font-size:13px;font-weight:600;color:#171613;margin:16px 0 6px;">Overdue right now</p>` +
        opts.overdueLines
          .map(
            (l) =>
              `<p style="font-size:13px;color:#52514a;margin:2px 0;">${esc(l.label)} — ${esc(l.memo)}: <strong style="color:#b42318;">${formatCents(l.amountCents)}</strong></p>`,
          )
          .join("");

  for (const to of opts.to) {
    await getResend().emails.send({
      from: from(),
      to,
      subject: `${opts.orgName}: your ${opts.monthLabel} summary`,
      html: shell(
        `Your ${esc(opts.monthLabel)} summary`,
        `${amountRow("Collected in " + esc(opts.monthLabel), formatCents(opts.collectedCents))}
         ${amountRow("Still outstanding", formatCents(opts.outstandingCents))}
         ${overdueHtml}
         <p style="font-size:12px;color:#8a897f;margin:20px 0 0;">Sent automatically on the 1st of each month.</p>`,
        opts.orgName,
      ),
      text: `${opts.orgName} — ${opts.monthLabel} summary\nCollected: ${formatCents(opts.collectedCents)}\nOutstanding: ${formatCents(opts.outstandingCents)}\nOverdue items: ${opts.overdueLines.length}`,
    });
  }
}

export async function sendTeamInviteEmail(opts: {
  to: string;
  inviteeName: string;
  orgName: string;
  inviteUrl: string;
}) {
  await getResend().emails.send({
    from: from(),
    to: opts.to,
    subject: `You're invited to help run ${opts.orgName} on DuesDesk`,
    html: shell(
      `Hi ${esc(opts.inviteeName)},`,
      `<p style="font-size:14px;color:#52514a;line-height:1.6;margin:0 0 16px;">You've been invited to join <strong>${esc(opts.orgName)}</strong> on DuesDesk — the tool it uses to collect dues and keep the books. Accept below to get access to the dashboard.</p>
       <a href="${opts.inviteUrl}" style="display:inline-block;background:#2c6446;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:8px;margin-top:8px;">Accept invite</a>
       <p style="font-size:12px;color:#8a897f;margin:16px 0 0;">This invite expires in 7 days. Or copy this link into your browser:<br>${opts.inviteUrl}</p>`,
      opts.orgName,
    ),
    text: `Hi ${opts.inviteeName},\n\nYou've been invited to join ${opts.orgName} on DuesDesk. Accept here (expires in 7 days): ${opts.inviteUrl}`,
  });
}

/** Announcement blast. Individually addressed — recipients never see each other. */
export async function sendAnnouncementEmails(opts: {
  recipients: string[];
  subject: string;
  body: string;
  orgName: string;
}): Promise<number> {
  const resend = getResend();
  const bodyHtml = `<p style="font-size:14px;color:#52514a;line-height:1.7;margin:0;">${esc(opts.body).replaceAll("\n", "<br>")}</p>`;
  const unique = [...new Set(opts.recipients.map((r) => r.toLowerCase()))];

  let sent = 0;
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const { error } = await resend.batch.send(
      chunk.map((to) => ({
        from: from(),
        to,
        subject: `${opts.orgName}: ${opts.subject}`,
        html: shell(esc(opts.subject), bodyHtml, opts.orgName),
        text: `${opts.subject}\n\n${opts.body}\n\n— ${opts.orgName}`,
      })),
    );
    if (error) throw new Error(error.message);
    sent += chunk.length;
  }
  return sent;
}
