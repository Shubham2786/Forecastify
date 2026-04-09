import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const sns = new SNSClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

interface AlertItem {
  productName: string;
  severity: string;
  alertType: string;
  message: string;
  currentStock: number;
  unit: string;
  demandLevel: string;
  daysUntilStockout: number;
  suggestedRestock: number;
  recommendation: string;
}

function buildEmailBody(alerts: AlertItem[], storeName: string, location: string): string {
  const criticals = alerts.filter(a => a.severity === "critical");
  const warnings = alerts.filter(a => a.severity === "warning");
  const date = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  let body = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  FORECASTIFY — STOCK ALERT REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Store: ${storeName}
Location: ${location}
Date: ${date}
Total Alerts: ${alerts.length} (${criticals.length} Critical, ${warnings.length} Warnings)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

  if (criticals.length > 0) {
    body += `🔴 CRITICAL ALERTS — Immediate Action Required\n${"─".repeat(45)}\n\n`;
    for (const a of criticals) {
      body += `⚠️  ${a.productName}
   Stock: ${a.currentStock} ${a.unit} | Demand: ${a.demandLevel}
   Days left: ${a.daysUntilStockout} days
   ${a.message}
   ✅ Action: ${a.recommendation}
   📦 Restock: +${a.suggestedRestock} ${a.unit} needed
\n`;
    }
  }

  if (warnings.length > 0) {
    body += `🟡 WARNINGS — Stock Running Low\n${"─".repeat(45)}\n\n`;
    for (const a of warnings) {
      body += `📋 ${a.productName}
   Stock: ${a.currentStock} ${a.unit} | Demand: ${a.demandLevel}
   Days left: ${a.daysUntilStockout} days
   ${a.message}
   ✅ Action: ${a.recommendation}
   📦 Restock: +${a.suggestedRestock} ${a.unit}
\n`;
    }
  }

  // Summary table
  body += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  QUICK RESTOCK LIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  for (const a of alerts) {
    const icon = a.severity === "critical" ? "🔴" : "🟡";
    body += `${icon} ${a.productName.padEnd(30)} +${String(a.suggestedRestock).padStart(4)} ${a.unit.padEnd(6)} (${a.daysUntilStockout}d left)\n`;
  }

  body += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This alert was sent by Forecastify.
Login to your dashboard for detailed analysis.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  return body;
}

function buildSubject(alerts: AlertItem[]): string {
  const criticals = alerts.filter(a => a.severity === "critical").length;
  const warnings = alerts.filter(a => a.severity === "warning").length;

  if (criticals > 0) {
    return `🔴 CRITICAL: ${criticals} product${criticals > 1 ? "s" : ""} at stockout risk — Forecastify`;
  }
  if (warnings > 0) {
    return `🟡 ${warnings} low stock alert${warnings > 1 ? "s" : ""} — Forecastify`;
  }
  return `📊 Stock Alert Report — Forecastify`;
}

export async function POST(request: Request) {
  try {
    const { alerts, storeName, location } = await request.json();

    if (!alerts?.length) {
      return Response.json({ error: "No alerts to send" }, { status: 400 });
    }

    const topicArn = process.env.AWS_SNS_TOPIC_ARN;
    if (!topicArn) {
      return Response.json({ error: "SNS topic not configured" }, { status: 500 });
    }

    // Only send emails for critical and warning alerts
    const importantAlerts = alerts.filter((a: AlertItem) => a.severity === "critical" || a.severity === "warning");
    if (!importantAlerts.length) {
      return Response.json({ message: "No critical/warning alerts to email", sent: false });
    }

    const subject = buildSubject(importantAlerts);
    const body = buildEmailBody(importantAlerts, storeName || "Store", location || "");

    const command = new PublishCommand({
      TopicArn: topicArn,
      Subject: subject,
      Message: body,
    });

    const result = await sns.send(command);

    return Response.json({
      sent: true,
      messageId: result.MessageId,
      alertCount: importantAlerts.length,
      subject,
    });
  } catch (err: any) {
    console.error("SNS send error:", err.message);
    return Response.json({ error: err.message || "Failed to send alert email" }, { status: 500 });
  }
}
