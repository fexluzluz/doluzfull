import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateEmployeeRequest {
  email: string;
  full_name: string;
  phone?: string;
  password: string;
  client_id: string;
  company_name: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { email, full_name, phone, password, client_id, company_name }: CreateEmployeeRequest = await req.json();

    console.log("Creating employee:", { email, full_name, client_id });

    // Create user via admin API (doesn't affect the current session)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
      },
    });

    if (authError) {
      console.error("Auth error:", authError);
      throw new Error(authError.message);
    }

    if (!authData.user) {
      throw new Error("Erro ao criar usuário");
    }

    console.log("User created:", authData.user.id);

    // Wait for profile trigger to execute
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Get the profile
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", authData.user.id)
      .single();

    if (profileError || !profileData) {
      console.error("Profile error:", profileError);
      throw new Error("Erro ao obter perfil do usuário");
    }

    console.log("Profile found:", profileData.id);

    // Update profile with phone and must_change_password flag
    const profileUpdate: Record<string, any> = { must_change_password: true };
    if (phone) {
      profileUpdate.phone = phone;
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", profileData.id);

    if (updateError) {
      console.error("Profile update error:", updateError);
    }

    // Create the employee link
    const { error: employeeError } = await supabaseAdmin.from("client_employees").insert({
      client_id,
      profile_id: profileData.id,
      is_active: true,
    });

    if (employeeError) {
      console.error("Employee link error:", employeeError);
      throw new Error(employeeError.message);
    }

    console.log("Employee linked to client");

    // Add employee role
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: authData.user.id,
      role: "employee",
    });

    if (roleError) {
      console.error("Role error:", roleError);
      // Don't throw, role might already exist
    }

    console.log("Employee role assigned");

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authData.user.id,
        profile_id: profileData.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in create-employee function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
