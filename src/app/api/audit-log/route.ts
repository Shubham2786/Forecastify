import { CloudTrailClient, LookupEventsCommand } from "@aws-sdk/client-cloudtrail";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { createClient } from "@supabase/supabase-js";

const ct = new CloudTrailClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const sns = new SNSClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET — fetch recent CloudTrail events
export async function GET() {
  try {
    const endTime = new Date();
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - 24);

    const result = await ct.send(new LookupEventsCommand({
      StartTime: startTime,
      EndTime: endTime,
      MaxResults: 50,
    }));

    const events = result.Events?.map(e => ({
      eventId: e.EventId,
      eventName: e.EventName,
      eventTime: e.EventTime?.toISOString(),
      username: e.Username,
      sourceIP: e.CloudTrailEvent ? JSON.parse(e.CloudTrailEvent).sourceIPAddress : null,
      region: e.CloudTrailEvent ? JSON.parse(e.CloudTrailEvent).awsRegion : null,
      resources: e.Resources?.map(r => ({ type: r.ResourceType, name: r.ResourceName })),
    })) || [];

    return Response.json({ events, count: events.length });
  } catch (err: any) {
    console.error("CloudTrail lookup error:", err.message);
    return Response.json({ events: [], error: err.message });
  }
}

// POST — log a user action to Supabase + optionally notify via SNS
export async function POST(request: Request) {
  try {
    const { userId, action, details, severity } = await request.json();
    if (!userId || !action) {
      return Response.json({ error: "userId and action required" }, { status: 400 });
    }

    // Get user info
    const { data: profile } = await supabase
      .from("profiles").select("full_name, store_name, city")
      .eq("id", userId).single();

    // Log to Supabase (app-level audit log)
    const { error: logError } = await supabase.from("audit_logs").insert({
      user_id: userId,
      user_name: profile?.full_name || "Unknown",
      store_name: profile?.store_name || "Unknown",
      action,
      details: details || null,
      severity: severity || "info",
    });

    // If it's a critical action, send SNS notification
    if (severity === "critical" && process.env.AWS_SNS_TOPIC_ARN) {
      await sns.send(new PublishCommand({
        TopicArn: process.env.AWS_SNS_TOPIC_ARN,
        Subject: `🔔 Alert: ${action} — ${profile?.store_name || "Store"}`,
        Message: `User: ${profile?.full_name || "Unknown"}\nStore: ${profile?.store_name || "Unknown"}\nAction: ${action}\nDetails: ${details || "N/A"}\nTime: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
      }));
    }

    return Response.json({
      logged: !logError,
      error: logError?.message || null,
    });
  } catch (err: any) {
    console.error("Audit log error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
