
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return respond({ error: "Server configuration is incomplete" }, 500);
  }

  const authorization = req.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return respond({ error: "Please sign in as an administrator" }, 401);
  }

  const token = authorization.slice(7);

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } =
    await authClient.auth.getUser(token);

  if (authError || !authData.user) {
    return respond({ error: "Invalid or expired session" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || callerProfile?.role !== "admin") {
    return respond({ error: "Administrator access required" }, 403);
  }

  let body: {
    full_name?: string;
    email?: string;
    college_id?: number;
  };

  try {
    body = await req.json();
  } catch {
    return respond({ error: "Invalid JSON request" }, 400);
  }

  const fullName = body.full_name?.trim();
  const email = body.email?.trim().toLowerCase();
  const collegeId = Number(body.college_id);

  if (
    !fullName ||
    fullName.length > 120 ||
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !Number.isSafeInteger(collegeId) ||
    collegeId <= 0
  ) {
    return respond({
      error: "Enter a valid name, email, and college",
    }, 400);
  }

  const { data: college, error: collegeError } = await adminClient
    .from("colleges")
    .select("id")
    .eq("id", collegeId)
    .maybeSingle();

  if (collegeError || !college) {
    return respond({ error: "Selected college was not found" }, 400);
  }

  const { data: invitation, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
    });

  if (inviteError || !invitation.user) {
    return respond({
      error: inviteError?.message ?? "Could not invite faculty member",
    }, 400);
  }

  const facultyUser = invitation.user;

  const { error: insertError } = await adminClient
    .from("profiles")
    .insert({
      id: facultyUser.id,
      full_name: fullName,
      email,
      role: "faculty",
      college_id: collegeId,
    });

  if (insertError) {
    // Roll back the new account if its profile could not be created.
    const { error: cleanupError } =
      await adminClient.auth.admin.deleteUser(facultyUser.id);

    if (cleanupError) {
      console.error("Account cleanup failed:", cleanupError.message);
    }

    console.error("Faculty profile creation failed:", insertError.message);

    return respond({
      error: "Faculty profile creation failed. Check the database configuration.",
    }, 500);
  }

  return respond({
    message: "Faculty invitation sent and profile created successfully",
  }, 201);
});
