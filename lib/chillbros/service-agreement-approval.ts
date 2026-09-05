"use server";

import { sendApprovalNotification } from "@/lib/chillbros/approval-notifications";
import { acceptServiceAgreementAction } from "@/lib/chillbros/service-agreement-actions";
import { getServiceAgreementByToken } from "@/lib/chillbros/service-agreement-queries";

export async function acceptServiceAgreementAndNotifyAction(token: string, signatureName: string) {
  const result = await acceptServiceAgreementAction(token, signatureName);
  if (!result.ok) return result;
  const agreement = await getServiceAgreementByToken(token);
  if (agreement) {
    await sendApprovalNotification({
      subject: `Chill Bros plan accepted · ${agreement.agreementNumber}`,
      documentLabel: "Monthly service agreement",
      documentNumber: agreement.agreementNumber,
      signedBy: agreement.signatureName ?? signatureName,
      customerName: agreement.customerName,
    });
  }
  return result;
}
